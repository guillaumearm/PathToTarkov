import type { IBodyHealth, IEffects } from "@spt/models/eft/common/IGlobals";
import type { ILocationBase, SpawnPointParam } from "@spt/models/eft/common/ILocationBase";
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
import { MAPLIST } from "./config";

import type { EntryPoints, StaticRoutePeeker } from "./helpers";
import { isLuasCSPModLoaded } from "./helpers";

import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  getEntryPointsForMaps,
} from "./helpers";

import { StashController } from "./stash-controller";
import { TradersController } from "./traders-controller";
import type { ModLoader } from "./modLoader";
import { DependencyContainer } from "tsyringe";
import { LocationController } from "@spt/controllers/LocationController";
import { deepClone } from "./utils";
import { resolveMapNameFromLocation } from "./map-name-resolver";
import { ILocationsGenerateAllResponse, Path } from "@spt/models/eft/common/ILocationsSourceDestinationBase";
import { ILocations } from "@spt/models/spt/server/ILocations";
import { IGetLocationRequestData } from "@spt/models/eft/location/IGetLocationRequestData";

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


type IndexedLocations = Record<string, ILocationBase>

// indexed by mapName
const getIndexedLocations = (locations: ILocations): IndexedLocations => {
      // WARNING: type lies here
      // TODO: improve type
      const locationsList: ILocationBase[] = Object.values(locations).filter(
        (l: ILocationBase) => l && l.Id,
      );

      return locationsList.reduce((indexed: IndexedLocations, location: ILocationBase) => {
        return {
          ...indexed,
          [resolveMapNameFromLocation(location.Id)]: location
        }
      }, {})
}

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
    private staticRouterPeeker: StaticRoutePeeker,
    private modLoader: ModLoader,
  ) {
    this.stashController = new StashController(
      () => this.config,
      db,
      saveServer,
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
    this.overrideControllers()
  }

  generateEntrypoints(): void {
    this.entrypoints = getEntryPointsForMaps(this.db);
  }

  private getUIPaths(indexedLocations: IndexedLocations): Path[] {
    // TODO: use the ptt config to generate paths
    // TODO: migrate in a different class

    const newPaths: Path[] = []
    return newPaths
  }

  createGenerateAll(originalFn: (sessionId: string) => ILocationsGenerateAllResponse) {
    return (sessionId: string): ILocationsGenerateAllResponse => {
      this.debug("call locationController.generateAll");
      const offraidPosition = this.getOffraidPosition(sessionId)
      const result = originalFn(sessionId);
      const locations = deepClone(result.locations);
      const indexedLocations = getIndexedLocations(locations)

      const unlockedMaps = this.config.infiltrations[offraidPosition];

      // TODO: improve typing here
      // const locationsList: ILocationBase[] = Object.values(locations).filter(
      //   (l: ILocationBase) => l && l.Id,
      // );

      // this.debug(
      //   JSON.stringify(
      //     locationsList.map((l) => l.Id),
      //     undefined,
      //     2,
      //   ),
      // );

      // debug(JSON.stringify(Object.keys(locationsList[0]), undefined, 2))
      // debug(JSON.stringify(locationsList[0], undefined, 2))

      MAPLIST.forEach((mapName) => {
        const locked = Boolean(!unlockedMaps[mapName as MapName]);
        const locationBase = indexedLocations[mapName]

        if (locationBase) {
          this.debug(`apply lock to map ${mapName} | locked=${locked}`);
          locationBase.Locked = locked;
          // this.updateSpawnPoints(locationBase, offraidPosition)
        }
      });


      const newPaths = this.getUIPaths(indexedLocations)
      return { locations, paths: newPaths };
    }
  }

  private createGetLocation(originalFn: (sessionId: string, request: IGetLocationRequestData) => ILocationBase) {
    return (sessionId: string, request: IGetLocationRequestData): ILocationBase => {
      this.debug("call locationController.get");

      const offraidPosition = this.getOffraidPosition(sessionId)
      const locationBase = originalFn(sessionId, request);
      this.updateSpawnPoints(locationBase, offraidPosition)

      return locationBase
    }
  }

  private overrideControllers(): void {
    this.container.afterResolution<LocationController>(
      "LocationController",
      (_t, result): void => {
        const locationController = Array.isArray(result) ? result[0] : result;
        const originalGenerateAll =
          locationController.generateAll.bind(locationController);

        locationController.generateAll = this.createGenerateAll(originalGenerateAll)
          
        const originalGet = locationController.get.bind(locationController)
        locationController.get = this.createGetLocation(originalGet)
      },
      { frequency: "Always" },
    );
  }

  init(sessionId: string): void {
    this.stashController.initProfile(sessionId);
    this.offraidRegenController.init();

    const offraidPosition = this.getOffraidPosition(sessionId);
    this.updateOffraidPosition(sessionId, offraidPosition);

    changeRestrictionsInRaid(this.config, this.db);
  }

  // This is a fix to ensure Lua's Custom Spawn Point mod do not override player spawn point
  public hijackLuasCustomSpawnPointsUpdate(): void {
    return
  //   const LUAS_CSP_ROUTE = "/client/locations";

  //   if (isLuasCSPModLoaded(this.modLoader)) {
  //     this.debug(
  //       `Lua's Custom Spawn Point detected, hijack '${LUAS_CSP_ROUTE}' route`,
  //     );
  //   } else {
  //     this.debug("Lua's Custom Spawn Point not detected.");
  //     return;
  //   }

  //   this.staticRouterPeeker.watchRoute(
  //     LUAS_CSP_ROUTE,
  //     (url, info, sessionId, output) => {
  //       this.logger.info(
  //         "=> Path To Tarkov: '/client/locations' route called !",
  //       );

  //       this.updateSpawnPoints(this.getOffraidPosition(sessionId));

  //       return output;
  //     },
  //   );

  //   this.staticRouterPeeker.register(
  //     "Trap-PathToTarkov-Lua-CustomSpawnPoints-integration",
  //   );

  //   this.logger.info(
  //     `=> PathToTarkov: Lua's Custom Spawn Points '${LUAS_CSP_ROUTE}' route hijacked!`,
  //   );
  }

  private addSpawnPoint(locationBase: ILocationBase, spawnPoint: SpawnPointParam): void {
    locationBase?.SpawnPointParams.push(spawnPoint);
  }

  private removePlayerSpawns(locationBase: ILocationBase): void {
    locationBase.SpawnPointParams = locationBase.SpawnPointParams.filter((params) => {
      // remove Player from Categories array
      params.Categories = params.Categories.filter((cat) => cat !== "Player");

      if (!params.Categories.length) {
        // remove the spawn point if Categories is empty
        return false;
      }

      return true;
    });
  }

  // private removeAllPlayerSpawns(): void {
  //   MAPLIST.forEach((mapName) => {
  //     this.removePlayerSpawns(mapName);
  //   });
  // }

  private updateLockedMaps(offraidPosition: string): void {
    const unlockedMaps = this.config.infiltrations[offraidPosition];
    const locations = this.db.getTables().locations;

    MAPLIST.forEach((mapName) => {
      const locked = Boolean(!unlockedMaps[mapName as MapName]);
      const location = locations?.[mapName as MapName];

      if (location) {
        location.base.Locked = locked;
      }
    });
  }

  private updateSpawnPoints(locationBase: ILocationBase, offraidPosition: string): void {
    const mapName = resolveMapNameFromLocation(locationBase.Id)

    if (!this.config.infiltrations[offraidPosition]) {
      this.debug(`no offraid position '${offraidPosition}' found in config.infiltrations`)
      return
    }

    const spawnpoints = this.config.infiltrations[offraidPosition][mapName as MapName]
    
    if (spawnpoints && spawnpoints.length > 0) {
      if (spawnpoints[0] === '*') { // don't update the spawnpoints if wildcard is used
        return
      }

      this.removePlayerSpawns(locationBase);

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
          this.addSpawnPoint(locationBase, spawnPoint);
          this.debug(`player spawn '${spawnId}' added`)
        } else {
          this.debug(`no spawn data found for spawnpoint ${spawnId} on map ${mapName}`)
        }
      });
    } else {
      this.debug(`no spawn point found for map ${mapName} at offraid position '${offraidPosition}'`)
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
    // this.updateLockedMaps(offraidPosition);
    // this.updateSpawnPoints(offraidPosition);

    this.stashController.updateStash(offraidPosition, sessionId);
    this.offraidRegenController.updateOffraidRegen(offraidPosition);

    if (this.config.traders_access_restriction) {
      this.tradersController.updateTraders(offraidPosition, sessionId);
    }

    this.saveServer.saveProfile(sessionId);
  }
}
