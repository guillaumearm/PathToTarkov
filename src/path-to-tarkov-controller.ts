import type { IBodyHealth, IGlobals } from '@spt/models/eft/common/IGlobals';
import type { ILocationBase } from '@spt/models/eft/common/ILocationBase';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';

import type { Config, MapName, Profile, SpawnConfig } from './config';
import { EMPTY_STASH, MAPLIST, VANILLA_STASH_IDS } from './config';

import type { EntryPoints } from './helpers';

import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  getEntryPointsForMaps,
  isIgnoredArea,
} from './helpers';

import { getTemplateIdFromStashId, StashController } from './stash-controller';
import { TradersController } from './traders-controller';
import type { DependencyContainer } from 'tsyringe';
import type { LocationController } from '@spt/controllers/LocationController';
import { deepClone } from './utils';
import { resolveMapNameFromLocation } from './map-name-resolver';
import type {
  ILocationsGenerateAllResponse,
  Path,
} from '@spt/models/eft/common/ILocationsSourceDestinationBase';
import type { ILocations } from '@spt/models/spt/server/ILocations';
import type { IGetLocationRequestData } from '@spt/models/eft/location/IGetLocationRequestData';
import type { DataCallbacks } from '@spt/callbacks/DataCallbacks';
import type { IEmptyRequestData } from '@spt/models/eft/common/IEmptyRequestData';
import type { ITemplateItem } from '@spt/models/eft/common/tables/ITemplateItem';
import type { IHideoutArea } from '@spt/models/eft/hideout/IHideoutArea';
import type { LocationCallbacks } from '@spt/callbacks/LocationCallbacks';
import type { IGetBodyResponseData } from '@spt/models/eft/httpResponse/IGetBodyResponseData';
import type { Inventory } from '@spt/models/eft/common/tables/IBotBase';

type IndexedLocations = Record<string, ILocationBase>;

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
      [resolveMapNameFromLocation(location.Id)]: location,
    };
  }, {});
};

export class PathToTarkovController {
  public stashController: StashController;
  public tradersController: TradersController;

  private entrypoints: EntryPoints;

  constructor(
    public config: Config,
    public spawnConfig: SpawnConfig,
    private readonly container: DependencyContainer,
    private readonly db: DatabaseServer,
    public readonly saveServer: SaveServer,
    configServer: ConfigServer,
    getIsTraderLocked: (traderId: string) => boolean,
    private readonly logger: ILogger,
    private readonly debug: (data: string) => void,
  ) {
    this.stashController = new StashController(() => this.config, db, saveServer, this.debug);
    this.tradersController = new TradersController(
      () => this.config,
      getIsTraderLocked,
      db,
      saveServer,
      configServer,
      this.logger,
    );
    this.entrypoints = {};
    this.overrideControllers();
  }

  generateEntrypoints(): void {
    this.entrypoints = getEntryPointsForMaps(this.db);
  }

  private getUIPaths(givenLocations: ILocationBase[]): Path[] {
    // skip factory4_night to avoid ui bug
    const locations = givenLocations.filter(location => location.Id !== 'factory4_night');

    const newPathIds: Set<string> = new Set();

    locations.forEach(sourceLocation => {
      locations.forEach(destinationLocation => {
        if (sourceLocation._Id !== destinationLocation._Id) {
          const pairOfSourceAndDest = [sourceLocation._Id, destinationLocation._Id].sort() as [
            string,
            string,
          ];
          newPathIds.add(pairOfSourceAndDest.join('|'));
        }
      });
    });

    const newPaths: Path[] = [];

    newPathIds.forEach(pathId => {
      const [sourceId, DestinationId] = pathId.split('|');
      newPaths.push({
        Source: sourceId,
        Destination: DestinationId,
      });
    });

    this.debug(`${newPaths.length} paths built for the UI`);
    return newPaths;
  }

  createGenerateAll(originalFn: (sessionId: string) => ILocationsGenerateAllResponse) {
    return (sessionId: string): ILocationsGenerateAllResponse => {
      const offraidPosition = this.getOffraidPosition(sessionId);
      const result = originalFn(sessionId);
      const locations = deepClone(result.locations);
      const indexedLocations = getIndexedLocations(locations);

      const unlockedMaps = this.config.infiltrations[offraidPosition];
      const unlockedLocationBases: ILocationBase[] = [];

      MAPLIST.forEach(mapName => {
        const locked = Boolean(!unlockedMaps[mapName as MapName]);
        const locationBase = indexedLocations[mapName];

        if (locationBase) {
          if (!locked) {
            this.debug(`[${sessionId}] unlock map ${mapName}`);
            unlockedLocationBases.push(locationBase);
          }

          locationBase.Locked = locked;
          locationBase.Enabled = !locked;

          // necessary for Fika
          this.updateSpawnPoints(locationBase, offraidPosition, sessionId);
        }
      });

      const newPaths = this.getUIPaths(unlockedLocationBases);
      return { locations, paths: newPaths };
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
      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawLocationBase = originalFn(url, info, sessionId) as any as string;
      const parsed = JSON.parse(rawLocationBase);
      const locationBase: ILocationBase = parsed.data;

      // This will handle spawnpoints for SPT
      // For fika, check the other call of `updateSpawnPoints`
      this.updateSpawnPoints(locationBase, offraidPosition, sessionId);

      return JSON.stringify(parsed) as any;
    };
  }

  private createGetTemplateItems(
    originalFn: (url: string, info: IEmptyRequestData, sessionId: string) => string,
  ) {
    return (url: string, info: IEmptyRequestData, sessionId: string): string => {
      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawResult = originalFn(url, info, sessionId);

      const parsed = JSON.parse(rawResult);
      const items: Record<string, ITemplateItem> = parsed.data;

      const size = this.stashController.getStashSize(offraidPosition);

      if (size === null) {
        this.debug(`[${sessionId}] main stash selected`);
        return rawResult;
      }

      this.debug(`[${sessionId}] override secondary stash size to ${size}`);

      VANILLA_STASH_IDS.forEach(stashId => {
        const item = items[stashId];

        const grid = item?._props?.Grids?.[0];
        const gridProps = grid?._props;

        if (gridProps) {
          gridProps.cellsV = size;
        } else {
          throw new Error('Path To  Tarkov: cannot set size for custom stash');
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
      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawResult = originalFn(url, info, sessionId) as any as string;

      const parsed = JSON.parse(rawResult);
      const areas: IHideoutArea[] = parsed.data;

      const hideoutEnabled = this.stashController.getHideoutEnabled(offraidPosition);

      areas.forEach(area => {
        if (!isIgnoredArea(area, this.config)) {
          area.enabled = hideoutEnabled;
        }
      });

      if (hideoutEnabled) {
        this.debug(`[${sessionId}] main hideout enabled`);
      } else {
        this.debug(`[${sessionId}] main hideout disabled`);
      }

      return JSON.stringify(parsed) as any;
    };
  }

  private createGetGlobals(
    originalFn: (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ) => IGetBodyResponseData<IGlobals>,
  ) {
    return (
      url: string,
      info: IEmptyRequestData,
      sessionId: string,
    ): IGetBodyResponseData<IGlobals> => {
      this.debug(`[${sessionId}] Datacallbacks.getGlobals call`);
      const offraidPosition = this.getOffraidPosition(sessionId);
      const rawResult = originalFn(url, info, sessionId) as any as string;

      const parsed = JSON.parse(rawResult);
      const globals: IGlobals = parsed.data;
      const regenDb = globals.config.Health.Effects.Regeneration;

      // hydration restrictions
      if (!checkAccessVia(this.config.offraid_regen_config.hydration.access_via, offraidPosition)) {
        this.debug(`[${sessionId}] disable hideout hydration regen`);
        regenDb.Hydration = 0;
      }

      // energy restrictions
      if (!checkAccessVia(this.config.offraid_regen_config.energy.access_via, offraidPosition)) {
        this.debug(`[${sessionId}] disable hideout energy regen`);
        regenDb.Energy = 0;
      }

      // health restrictions
      if (!checkAccessVia(this.config.offraid_regen_config.health.access_via, offraidPosition)) {
        this.debug(`[${sessionId}] disable hideout health regen`);
        Object.keys(regenDb.BodyHealth).forEach(k => {
          const bodyHealth = regenDb.BodyHealth[k as keyof IBodyHealth];
          bodyHealth.Value = 0;
        });
      }

      return JSON.stringify(parsed) as any;
    };
  }

  private overrideControllers(): void {
    this.container.afterResolution<LocationController>(
      'LocationController',
      (_t, result): void => {
        const locationController = Array.isArray(result) ? result[0] : result;
        const originalGenerateAll = locationController.generateAll.bind(locationController);

        locationController.generateAll = this.createGenerateAll(originalGenerateAll);
      },
      { frequency: 'Always' },
    );

    this.container.afterResolution<LocationCallbacks>(
      'LocationCallbacks',
      (_t, result): void => {
        const locationCallbacks = Array.isArray(result) ? result[0] : result;

        const originalGet = locationCallbacks.getLocation.bind(locationCallbacks);
        locationCallbacks.getLocation = this.createGetLocation(originalGet);
      },
      { frequency: 'Always' },
    );

    this.container.afterResolution<DataCallbacks>(
      'DataCallbacks',
      (_t, result): void => {
        const dataCallbacks = Array.isArray(result) ? result[0] : result;

        // override getTemplateItems
        const originalGetTemplateItems = dataCallbacks.getTemplateItems.bind(dataCallbacks);

        dataCallbacks.getTemplateItems = this.createGetTemplateItems(originalGetTemplateItems);

        // override getHideoutAreas
        const originalGetHideoutAreas = dataCallbacks.getHideoutAreas.bind(dataCallbacks);

        dataCallbacks.getHideoutAreas = this.createGetHideoutAreas(originalGetHideoutAreas);

        // override getGlobals
        const originalGetGlobals = dataCallbacks.getGlobals.bind(dataCallbacks);
        dataCallbacks.getGlobals = this.createGetGlobals(originalGetGlobals);
      },
      { frequency: 'Always' },
    );
  }

  /**
   * This is for upgrading profiles for PTT versions < 5.2.0
   */
  cleanupLegacySecondaryStashesLink(sessionId: string): void {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const inventory = profile.characters.pmc.Inventory as Inventory | undefined;
    const secondaryStashIds: string[] = [
      EMPTY_STASH.id,
      ...this.config.hideout_secondary_stashes.map(config => config.id),
    ];

    if (!inventory) {
      return;
    }

    let stashLinkRemoved = 0;

    inventory.items = inventory.items.filter(item => {
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
      this.debug(`[${sessionId}] cleaned up ${stashLinkRemoved} legacy stash links`);
      this.saveServer.saveProfile(sessionId);
    }
  }

  init(sessionId: string): void {
    changeRestrictionsInRaid(this.config, this.db); // TODO: no need to override everytime
    this.stashController.initProfile(sessionId);

    const offraidPosition = this.getOffraidPosition(sessionId);
    this.updateOffraidPosition(sessionId, offraidPosition);
  }

  private removePlayerSpawnsForLocation(locationBase: ILocationBase): void {
    locationBase.SpawnPointParams = locationBase.SpawnPointParams.filter(params => {
      // remove Player from Categories array
      params.Categories = params.Categories.filter(cat => cat !== 'Player');

      if (!params.Categories.length) {
        // remove the spawn point if Categories is empty
        return false;
      }

      return true;
    });
  }

  private updateSpawnPoints(
    locationBase: ILocationBase,
    offraidPosition: string,
    sessionId: string,
  ): void {
    const mapName = resolveMapNameFromLocation(locationBase.Id);

    if (!this.config.infiltrations[offraidPosition]) {
      this.debug(
        `[${sessionId}] no offraid position '${offraidPosition}' found in config.infiltrations`,
      );
      return;
    }

    const spawnpoints = this.config.infiltrations[offraidPosition][mapName as MapName];

    if (spawnpoints && spawnpoints.length > 0) {
      if (spawnpoints[0] === '*') {
        // don't update the spawnpoints if wildcard is used
        return;
      }

      this.debug(`[${sessionId}] all player spawns cleaned up for location ${mapName}`);
      this.removePlayerSpawnsForLocation(locationBase);

      spawnpoints.forEach(spawnId => {
        const spawnData =
          this.spawnConfig[mapName as MapName] && this.spawnConfig[mapName as MapName][spawnId];
        if (spawnData) {
          const spawnPoint = createSpawnPoint(
            spawnData.Position,
            spawnData.Rotation,
            this.entrypoints[mapName],
            spawnId,
          );
          locationBase?.SpawnPointParams.push(spawnPoint);
          this.debug(`[${sessionId}] player spawn '${spawnId}' added for location ${mapName}`);
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

    Object.keys(this.config.exfiltrations).forEach(mapName => {
      const extractPoints = Object.keys(this.config.exfiltrations[mapName as MapName]);

      const location = locations?.[mapName as MapName];

      if (location) {
        const entrypointsForMap = this.entrypoints[mapName] ?? [];

        if (entrypointsForMap.length === 0) {
          this.logger.error(`Path To Tarkov: no entrypoints found for map '${mapName}'!`);
        }

        if (this.config.vanilla_exfils_requirements) {
          const usedExitNames = new Set<string>();

          // filter all exits and keep vanilla requirements (except for ScavCooperation requirements)
          location.base.exits = location.base.exits
            .filter(exit => {
              return extractPoints.includes(exit.Name);
            })
            .map(exit => {
              usedExitNames.add(exit.Name);

              if (exit.PassageRequirement === 'ScavCooperation') {
                return createExitPoint(entrypointsForMap)(exit.Name);
              }

              exit.EntryPoints = entrypointsForMap.join(',');
              exit.ExfiltrationTime = 10;
              exit.Chance = 100;

              return exit;
            });

          // add missing extractPoints (potentially scav extracts)
          extractPoints.forEach(extractName => {
            if (!usedExitNames.has(extractName)) {
              const exitPoint = createExitPoint(entrypointsForMap)(extractName);
              location.base.exits.push(exitPoint);
            }
          });
        } else {
          // erase all exits and create custom exit points without requirements
          location.base.exits = extractPoints.map(createExitPoint(entrypointsForMap));
        }
        exfilsCounter = exfilsCounter + location.base.exits.length;
      }
    });

    this.debug(
      `initialized ${exfilsCounter} exfiltrations ${
        this.config.vanilla_exfils_requirements ? 'with vanilla' : 'without'
      } requirements`,
    );
  }

  getInitialOffraidPosition = (sessionId: string): string => {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const profileTemplateId = profile.info.edition;

    const overrideByProfiles = this.config.override_by_profiles[profileTemplateId] ?? {};

    return overrideByProfiles.initial_offraid_position ?? this.config.initial_offraid_position;
  };

  getOffraidPosition = (sessionId: string): string => {
    const defaultOffraidPosition = this.getInitialOffraidPosition(sessionId);
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
        `[${sessionId}] Unknown offraid position '${offraidPosition}', reset to default '${defaultOffraidPosition}'`,
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
      this.logger.info(`=> PathToTarkov: player offraid position changed to '${offraidPosition}'`);
    }

    this.stashController.updateStash(offraidPosition, sessionId);

    if (this.config.traders_access_restriction) {
      this.tradersController.updateTraders(offraidPosition, sessionId);
    }

    this.saveServer.saveProfile(sessionId);
  }
}
