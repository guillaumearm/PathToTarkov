import type { IBodyHealth, IEffects } from "@spt/models/eft/common/IGlobals";
import type { ILocationBase } from "@spt/models/eft/common/ILocationBase";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";

import type {
  Config,
  ConfigGetter,
  MapName,
  Profile,
  SpawnConfig,
} from "./config";
import { EMPTY_STASH, MAPLIST, VANILLA_STASH_IDS } from "./config";

import type { EntryPoints } from "./helpers";

import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  getEntryPointsForMaps,
  isIgnoredArea,
} from "./helpers";

import { StashController } from "./stash-controller";
import { TradersController } from "./traders-controller";
import type { DependencyContainer } from "tsyringe";
import type { LocationController } from "@spt/controllers/LocationController";
import { deepClone, getTemplateIdFromStashId } from "./utils";
import { resolveMapNameFromLocation } from "./map-name-resolver";
import type {
  ILocationsGenerateAllResponse,
  Path,
} from "@spt/models/eft/common/ILocationsSourceDestinationBase";
import type { ILocations } from "@spt/models/spt/server/ILocations";
import type { IGetLocationRequestData } from "@spt/models/eft/location/IGetLocationRequestData";
import type { DataCallbacks } from "@spt/callbacks/DataCallbacks";
import type { IEmptyRequestData } from "@spt/models/eft/common/IEmptyRequestData";
import type { ITemplateItem } from "@spt/models/eft/common/tables/ITemplateItem";
import type { IHideoutArea } from "@spt/models/eft/hideout/IHideoutArea";
import type { LocationCallbacks } from "@spt/callbacks/LocationCallbacks";
import type { IGetBodyResponseData } from "@spt/models/eft/httpResponse/IGetBodyResponseData";
import type { Inventory } from "@spt/models/eft/common/tables/IBotBase";

class OffraidRegenController {
  private getRegenConfig: () => Config["offraid_regen_config"];

  private regen_hydration_enabled = true;
  private regen_energy_enabled = true;
  private regen_health_enabled = true;

  // saved values
  private energy_value: number | null = null;
  private hydration_value: number | null = null;
  private bodyhealth_values: Partial<IBodyHealth> = {};

  constructor(
    getConfig: ConfigGetter,
    private db: DatabaseServer,
  ) {
    this.getRegenConfig = () => getConfig().offraid_regen_config;
  }

  private _getEmptyBodyHealthValues(): IBodyHealth {
    const result: Partial<IBodyHealth> = {};

    Object.keys(this.bodyhealth_values).forEach((bodyPart) => {
      result[bodyPart as keyof IBodyHealth] = { Value: 0 };
    });

    return result as IBodyHealth;
  }

  private get regen_db(): IEffects["Regeneration"] {
    const regen =
      this.db.getTables().globals?.config.Health.Effects.Regeneration;

    if (!regen) {
      throw new Error(
        "Fatal OffraidRegenController constructor: unable to get Regeneration health effects",
      );
    }

    return regen;
  }

  // this will snapshot the current regen config
  init(): void {
    this.energy_value = this.regen_db.Energy;
    this.hydration_value = this.regen_db.Hydration;

    Object.keys(this.regen_db.BodyHealth).forEach((bodyPart) => {
      this.bodyhealth_values[bodyPart as keyof IBodyHealth] = {
        Value: this.regen_db.BodyHealth[bodyPart as keyof IBodyHealth].Value,
      };
    });
  }

  _enableHydration() {
    if (this.regen_hydration_enabled) {
      return;
    }

    this.regen_db.Hydration = this.hydration_value ?? 0;
    this.regen_hydration_enabled = true;
  }

  _disableHydration() {
    if (!this.regen_hydration_enabled) {
      return;
    }

    this.regen_db.Hydration = 0;
    this.regen_hydration_enabled = false;
  }

  _enableEnergy() {
    if (this.regen_energy_enabled) {
      return;
    }

    this.regen_db.Energy = this.energy_value ?? 0;
    this.regen_energy_enabled = true;
  }

  _disableEnergy() {
    if (!this.regen_energy_enabled) {
      return;
    }

    this.regen_db.Energy = 0;
    this.regen_energy_enabled = false;
  }

  _enableHealth() {
    if (this.regen_health_enabled) {
      return;
    }

    this.regen_db.BodyHealth = this.bodyhealth_values as IBodyHealth;
    this.regen_health_enabled = true;
  }

  _disableHealth() {
    if (!this.regen_health_enabled) {
      return;
    }

    this.regen_db.BodyHealth = this._getEmptyBodyHealthValues();
    this.regen_health_enabled = false;
  }

  updateOffraidRegen(offraidPosition: string): void {
    if (
      checkAccessVia(
        this.getRegenConfig().hydration.access_via,
        offraidPosition,
      )
    ) {
      this._enableHydration();
    } else {
      this._disableHydration();
    }

    if (
      checkAccessVia(this.getRegenConfig().energy.access_via, offraidPosition)
    ) {
      this._enableEnergy();
    } else {
      this._disableEnergy();
    }

    if (
      checkAccessVia(this.getRegenConfig().health.access_via, offraidPosition)
    ) {
      this._enableHealth();
    } else {
      this._disableHealth();
    }
  }
}

type IndexedLocations = Record<string, ILocationBase>;

// indexed by mapName
const getIndexedLocations = (locations: ILocations): IndexedLocations => {
  // WARNING: type lies here
  // TODO: improve type
  const locationsList: ILocationBase[] = Object.values(locations).filter(
    (l: ILocationBase) => l && l.Id,
  );

  return locationsList.reduce(
    (indexed: IndexedLocations, location: ILocationBase) => {
      return {
        ...indexed,
        [resolveMapNameFromLocation(location.Id)]: location,
      };
    },
    {},
  );
};

export class PathToTarkovController {
  public stashController: StashController;
  public tradersController: TradersController;
  private offraidRegenController: OffraidRegenController;

  private entrypoints: EntryPoints;

  constructor(
    public config: Config,
    public spawnConfig: SpawnConfig,
    private readonly container: DependencyContainer,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    getIsTraderLocked: (traderId: string) => boolean,
    private readonly logger: ILogger,
    private readonly debug: (data: string) => void,
  ) {
    this.stashController = new StashController(
      () => this.config,
      db,
      saveServer,
      this.debug,
    );
    this.tradersController = new TradersController(
      () => this.config,
      getIsTraderLocked,
      db,
      saveServer,
      this.logger,
    );
    this.offraidRegenController = new OffraidRegenController(
      () => this.config,
      db,
    );

    this.entrypoints = {};
    this.overrideControllers();
  }

  generateEntrypoints(): void {
    this.entrypoints = getEntryPointsForMaps(this.db);
  }

  private getUIPaths(_indexedLocations: IndexedLocations): Path[] {
    // TODO: use the ptt config to generate paths
    // TODO: migrate in a different class

    const newPaths: Path[] = [];
    return newPaths;
  }

  createGenerateAll(
    originalFn: (sessionId: string) => ILocationsGenerateAllResponse,
  ) {
    return (sessionId: string): ILocationsGenerateAllResponse => {
      this.debug("call locationController.generateAll");
      const offraidPosition = this.getOffraidPosition(sessionId);
      const result = originalFn(sessionId);
      const locations = deepClone(result.locations);
      const indexedLocations = getIndexedLocations(locations);

      const unlockedMaps = this.config.infiltrations[offraidPosition];

      MAPLIST.forEach((mapName) => {
        const locked = Boolean(!unlockedMaps[mapName as MapName]);
        const locationBase = indexedLocations[mapName];

        if (locationBase) {
          if (locked && !locationBase.Locked) {
            this.debug(`lock map ${mapName}`);
          } else if (!locked && locationBase.Locked) {
            this.debug(`unlock map ${mapName}`);
          }

          locationBase.Locked = locked;

          // necessary for Fika
          this.updateSpawnPoints(locationBase, offraidPosition);
        }
      });

      // const newPaths = this.getUIPaths(indexedLocations);
      return { locations, paths: result.paths };
    };
  }

  private createGetLocation(
    originalFn: (
      url: string,
      info: IGetLocationRequestData,
      sessionId: string,
    ) => IGetBodyResponseData<ILocationBase>,
  ) {
    return (
      url: string,
      info: IGetLocationRequestData,
      sessionId: string,
    ): IGetBodyResponseData<ILocationBase> => {
      this.debug("call locationCallbacks.getLocation");

      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawLocationBase = originalFn(url, info, sessionId) as any as string;
      const parsed = JSON.parse(rawLocationBase);
      const locationBase: ILocationBase = parsed.data;

      // This will handle spawnpoints for SPT
      // For fika, check the other call of `updateSpawnPoints`
      this.updateSpawnPoints(locationBase, offraidPosition);

      return JSON.stringify(parsed) as any;
    };
  }

  private createGetTemplateItems(
    originalFn: (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ) => string,
  ) {
    return (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ): string => {
      this.debug("call dataCallbacks.getTemplateItems");

      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawResult = originalFn(url, info, sessionId);

      const parsed = JSON.parse(rawResult);
      const items: Record<string, ITemplateItem> = parsed.data;

      const size = this.stashController.getStashSize(offraidPosition);

      if (size === null) {
        return rawResult;
      }

      VANILLA_STASH_IDS.forEach((stashId) => {
        const item = items[stashId];

        const grid = item?._props?.Grids?.[0];
        const gridProps = grid?._props;

        if (gridProps) {
          gridProps.cellsV = size;
        } else {
          throw new Error("Path To  Tarkov: cannot set size for custom stash");
        }
      });

      return JSON.stringify(parsed);
    };
  }

  private createGetHideoutAreas(
    originalFn: (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ) => IGetBodyResponseData<IHideoutArea[]>,
  ) {
    return (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ): IGetBodyResponseData<IHideoutArea[]> => {
      this.debug("call dataCallbacks.getHideoutAreas");

      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawResult = originalFn(url, info, sessionId) as any as string;

      const parsed = JSON.parse(rawResult);
      const areas: IHideoutArea[] = parsed.data;

      const hideoutEnabled =
        this.stashController.getHideoutEnabled(offraidPosition);

      areas.forEach((area) => {
        if (!isIgnoredArea(area, this.config)) {
          area.enabled = hideoutEnabled;
        }
      });

      if (hideoutEnabled) {
        this.debug("main hideout enabled");
      } else {
        this.debug("main hideout disabled");
      }

      return JSON.stringify(parsed) as any;
    };
  }

  private overrideControllers(): void {
    this.container.afterResolution<LocationController>(
      "LocationController",
      (_t, result): void => {
        const locationController = Array.isArray(result) ? result[0] : result;
        const originalGenerateAll =
          locationController.generateAll.bind(locationController);

        locationController.generateAll =
          this.createGenerateAll(originalGenerateAll);
      },
      { frequency: "Always" },
    );

    this.container.afterResolution<LocationCallbacks>(
      "LocationCallbacks",
      (_t, result): void => {
        const locationCallbacks = Array.isArray(result) ? result[0] : result;

        const originalGet =
          locationCallbacks.getLocation.bind(locationCallbacks);
        locationCallbacks.getLocation = this.createGetLocation(originalGet);
      },
      { frequency: "Always" },
    );

    this.container.afterResolution<DataCallbacks>(
      "DataCallbacks",
      (_t, result): void => {
        const dataCallbacks = Array.isArray(result) ? result[0] : result;

        const originalGetTemplateItems =
          dataCallbacks.getTemplateItems.bind(dataCallbacks);

        dataCallbacks.getTemplateItems = this.createGetTemplateItems(
          originalGetTemplateItems,
        );

        const originalGetHideoutAreas =
          dataCallbacks.getHideoutAreas.bind(dataCallbacks);

        dataCallbacks.getHideoutAreas = this.createGetHideoutAreas(
          originalGetHideoutAreas,
        );
      },
      { frequency: "Always" },
    );
  }

  /**
   * This is for upgrading profiles for PTT versions < 5.2.0
   */
  cleanupLegacySecondaryStashesLink(sessionId: string): void {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const inventory = profile.characters.pmc.Inventory as Inventory | undefined;
    const secondaryStashIds = [
      EMPTY_STASH.id,
      this.config.hideout_secondary_stashes.map((config) => config.id),
    ];

    if (!inventory) {
      return;
    }

    let stashLinkRemoved = 0;

    inventory.items = inventory.items.filter((item) => {
      if (
        secondaryStashIds.includes(item._id) &&
        item._tpl !== getTemplateIdFromStashId(item._id)
      ) {
        stashLinkRemoved = stashLinkRemoved + 1;
        return false;
      }

      return true;
    });

    if (stashLinkRemoved > 0) {
      this.debug(`cleaned up ${stashLinkRemoved} legacy stash links`);
      this.saveServer.saveProfile(sessionId);
    }
  }

  init(sessionId: string): void {
    changeRestrictionsInRaid(this.config, this.db); // TODO: no need to override everytime
    this.stashController.initProfile(sessionId);
    this.offraidRegenController.init();

    const offraidPosition = this.getOffraidPosition(sessionId);
    this.updateOffraidPosition(sessionId, offraidPosition);
  }

  // This is a fix to ensure Lua's Custom Spawn Point mod do not override player spawn point
  public hijackLuasCustomSpawnPointsUpdate(): void {
    // TODO: get rid of the config option "bypass_luas_custom_spawn_points_tweak"
    return;
  }

  private removePlayerSpawnsForLocation(locationBase: ILocationBase): void {
    locationBase.SpawnPointParams = locationBase.SpawnPointParams.filter(
      (params) => {
        // remove Player from Categories array
        params.Categories = params.Categories.filter((cat) => cat !== "Player");

        if (!params.Categories.length) {
          // remove the spawn point if Categories is empty
          return false;
        }

        return true;
      },
    );
  }

  private updateSpawnPoints(
    locationBase: ILocationBase,
    offraidPosition: string,
  ): void {
    const mapName = resolveMapNameFromLocation(locationBase.Id);

    if (!this.config.infiltrations[offraidPosition]) {
      this.debug(
        `no offraid position '${offraidPosition}' found in config.infiltrations`,
      );
      return;
    }

    const spawnpoints =
      this.config.infiltrations[offraidPosition][mapName as MapName];

    if (spawnpoints && spawnpoints.length > 0) {
      if (spawnpoints[0] === "*") {
        // don't update the spawnpoints if wildcard is used
        return;
      }

      this.debug(`all player spawns cleaned up`);
      this.removePlayerSpawnsForLocation(locationBase);

      spawnpoints.forEach((spawnId) => {
        const spawnData =
          this.spawnConfig[mapName as MapName] &&
          this.spawnConfig[mapName as MapName][spawnId];
        if (spawnData) {
          const spawnPoint = createSpawnPoint(
            spawnData.Position,
            spawnData.Rotation,
            this.entrypoints[mapName],
            spawnId,
          );
          locationBase?.SpawnPointParams.push(spawnPoint);
          this.debug(`player spawn '${spawnId}' added`);
        }
      });
    }
  }

  initExfiltrations(): void {
    if (this.config.bypass_exfils_override) {
      return;
    }

    // Exfiltrations tweaks without requirements
    const locations = this.db.getTables().locations;
    let exfilsCounter = 0;

    Object.keys(this.config.exfiltrations).forEach((mapName) => {
      const extractPoints = Object.keys(
        this.config.exfiltrations[mapName as MapName],
      );

      const location = locations?.[mapName as MapName];

      if (location) {
        const entrypointsForMap = this.entrypoints[mapName] ?? [];

        if (entrypointsForMap.length === 0) {
          this.logger.error(
            `Path To Tarkov: no entrypoints found for map '${mapName}'!`,
          );
        }

        if (this.config.vanilla_exfils_requirements) {
          // filter all exits and keep vanilla requirements (except for ScavCooperation requirements)
          location.base.exits = location.base.exits
            .filter((exit) => {
              return extractPoints.includes(exit.Name);
            })
            .map((exit) => {
              if (exit.PassageRequirement === "ScavCooperation") {
                return createExitPoint(entrypointsForMap)(exit.Name);
              }

              exit.EntryPoints = entrypointsForMap.join(",");
              exit.ExfiltrationTime = 10;
              exit.Chance = 100;

              return exit;
            });
        } else {
          // erase all exits and create custom exit points without requirements
          location.base.exits = extractPoints.map(
            createExitPoint(entrypointsForMap),
          );
        }
        exfilsCounter = exfilsCounter + location.base.exits.length;
      }
    });

    this.debug(
      `initialized ${exfilsCounter} exfiltrations ${
        this.config.vanilla_exfils_requirements ? "with vanilla" : "without"
      } requirements`,
    );
  }

  getOffraidPosition = (sessionId: string): string => {
    const defaultOffraidPosition = this.config.initial_offraid_position;
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    if (!profile.PathToTarkov.offraidPosition) {
      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
    }

    const offraidPosition = profile.PathToTarkov.offraidPosition;

    if (!this.config.infiltrations[offraidPosition]) {
      this.debug(
        `Unknown offraid position '${offraidPosition}', reset to default '${defaultOffraidPosition}'`,
      );

      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
      return profile.PathToTarkov.offraidPosition;
    }

    return offraidPosition;
  };

  updateOffraidPosition(sessionId: string, offraidPosition?: string): void {
    if (!offraidPosition) {
      offraidPosition = this.getOffraidPosition(sessionId);
    }

    const profile: Profile = this.saveServer.getProfile(sessionId);

    const prevOffraidPosition = profile?.PathToTarkov?.offraidPosition;

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    profile.PathToTarkov.offraidPosition = offraidPosition;

    if (prevOffraidPosition !== offraidPosition) {
      this.logger.info(
        `=> PathToTarkov: player offraid position changed to '${offraidPosition}'`,
      );
    }

    this.stashController.updateStash(offraidPosition, sessionId);
    this.offraidRegenController.updateOffraidRegen(offraidPosition); // TODO: handle by sessionId

    if (this.config.traders_access_restriction) {
      this.tradersController.updateTraders(offraidPosition, sessionId);
    }

    this.saveServer.saveProfile(sessionId);
  }
}
