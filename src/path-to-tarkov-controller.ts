import type { IBodyHealth, IGlobals } from '@spt/models/eft/common/IGlobals';
import type { IExit, ILocationBase } from '@spt/models/eft/common/ILocationBase';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';

import type { Config, ConfigGetter, MapName, Profile, SpawnConfig } from './config';
import { AVAILABLE_LOCALES, MAPLIST, VANILLA_STASH_IDS } from './config';

import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  disableRunThrough,
  isIgnoredArea,
  isPlayerSpawnPoint,
  PTT_INFILTRATION,
} from './helpers';

import { StashController } from './stash-controller';
import { TradersController } from './traders-controller';
import type { DependencyContainer } from 'tsyringe';
import type { LocationController } from '@spt/controllers/LocationController';
import { deepClone, shuffle } from './utils';
import { resolveMapNameFromLocation } from './map-name-resolver';
import type {
  ILocationsGenerateAllResponse,
  IPath,
} from '@spt/models/eft/common/ILocationsSourceDestinationBase';
import type { ILocations } from '@spt/models/spt/server/ILocations';
import type { DataCallbacks } from '@spt/callbacks/DataCallbacks';
import type { IEmptyRequestData } from '@spt/models/eft/common/IEmptyRequestData';
import type { ITemplateItem } from '@spt/models/eft/common/tables/ITemplateItem';
import type { IHideoutArea } from '@spt/models/eft/hideout/IHideoutArea';
import type { IGetBodyResponseData } from '@spt/models/eft/httpResponse/IGetBodyResponseData';
import { TradersAvailabilityService } from './services/TradersAvailabilityService';
import { fixRepeatableQuestsForPmc } from './fix-repeatable-quests';
import { KeepFoundInRaidTweak } from './keep-fir-tweak';
import type { AllLocalesInDb } from './services/ExfilsTooltipsTemplater';
import { ExfilsTooltipsTemplater } from './services/ExfilsTooltipsTemplater';

type IndexedLocations = Record<string, ILocationBase>;

// indexed by mapName
// Warning: do not re-use, it should only be use by the `generateAll` override
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
  public tradersController: TradersController;
  public getConfig: ConfigGetter;
  // configs are indexed by sessionId
  private configCache: Record<string, Config> = {};
  private stashController: StashController;
  private tooltipsTemplater: ExfilsTooltipsTemplater | undefined;

  constructor(
    private readonly baseConfig: Config,
    public spawnConfig: SpawnConfig,
    private tradersAvailabilityService: TradersAvailabilityService,
    private readonly container: DependencyContainer,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    configServer: ConfigServer,
    private readonly logger: ILogger,
    private readonly debug: (data: string) => void,
  ) {
    this.getConfig = sessionId => {
      const existingConfig = this.configCache[sessionId];

      if (existingConfig) {
        return existingConfig;
      }

      // TODO: instead of persisting the config directly, persist the performed action and replay them in order to rebuild the config
      const newConfig = deepClone(this.baseConfig);
      this.configCache[sessionId] = newConfig;

      return newConfig;
    };

    this.tradersAvailabilityService = new TradersAvailabilityService();
    this.stashController = new StashController(this.getConfig, db, saveServer, this.debug);
    this.tradersController = new TradersController(
      this.tradersAvailabilityService,
      db,
      saveServer,
      configServer,
      this.logger,
    );
    this.overrideControllers();
  }

  loaded(config: Config): void {
    const allLocales = this.db.getTables()?.locales?.global;
    const quests = this.db.getTables()?.templates?.quests;

    if (!quests) {
      throw new Error('Path To Tarkov: no quests found in db');
    }

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    this.tooltipsTemplater = new ExfilsTooltipsTemplater(allLocales);

    this.tradersAvailabilityService.init(quests);
    this.injectTooltipsInLocales(config);
    this.tradersController.initTraders(config);

    const nbAddedTemplates = this.stashController.initSecondaryStashTemplates(
      config.hideout_secondary_stashes,
    );
    this.debug(`${nbAddedTemplates} secondary stash templates added`);

    if (!config.enable_run_through) {
      disableRunThrough(this.db);
      this.debug('disabled run through in-raid status');
    }

    this.debugExfiltrationsTooltips(config);
  }

  setConfig(config: Config, sessionId: string): void {
    // TODO: validation ?
    this.configCache[sessionId] = config;
  }

  setSpawnConfig(spawnConfig: SpawnConfig): void {
    // TODO: validation ?
    this.spawnConfig = spawnConfig;
  }

  // on game start (or profile creation)
  initPlayer(sessionId: string, _isFreshProfile: boolean): void {
    // warning: this is not dynamic because of the mutation of the db
    changeRestrictionsInRaid(this.baseConfig, this.db);

    // warmup cache
    void this.getConfig(sessionId);

    this.stashController.initProfile(sessionId);
    this.fixRepeatableQuestsForProfile(sessionId);

    const offraidPosition = this.getOffraidPosition(sessionId);
    this.updateOffraidPosition(sessionId, offraidPosition);
  }

  isScavMoveOffraidPosition(sessionId: string): boolean {
    return this.getConfig(sessionId).player_scav_move_offraid_position;
  }

  onPlayerDies(sessionId: string): void {
    if (this.getConfig(sessionId).reset_offraid_position_on_player_die) {
      const initialOffraidPosition = this.getRespawnOffraidPosition(sessionId);

      this.updateOffraidPosition(sessionId, initialOffraidPosition);
    }
  }

  // returns the new offraid position (or null if not found)
  onPlayerExtracts(params: {
    sessionId: string;
    mapName: MapName;
    exitName: string;
    isPlayerScav: boolean;
  }): string | null {
    const { sessionId, mapName, exitName, isPlayerScav } = params;
    const config = this.getConfig(sessionId);

    if (config.bypass_keep_found_in_raid_tweak) {
      this.debug(`[${sessionId}] FIR tweak disabled`);
    } else {
      const firTweak = new KeepFoundInRaidTweak(this.saveServer);
      const nbImpactedItems = firTweak.setFoundInRaidOnEquipment(sessionId, isPlayerScav);
      this.debug(
        `[${sessionId}] FIR tweak added SpawnedInSession on ${nbImpactedItems} item${nbImpactedItems > 1 ? 's' : ''}`,
      );
    }

    const extractsConf = config.exfiltrations[mapName];
    const newOffraidPosition = extractsConf && exitName && extractsConf[exitName];

    if (newOffraidPosition) {
      this.updateOffraidPosition(sessionId, newOffraidPosition);
      return newOffraidPosition;
    }

    return null;
  }

  /**
   * Warning: this function will mutate the given locationBase
   */
  syncLocationBase(locationBase: ILocationBase, sessionId: string): void {
    this.updateInfiltrationForPlayerSpawnPoints(locationBase);
    this.updateSpawnPoints(locationBase, sessionId);
    this.updateLocationBaseExits(locationBase, sessionId);
    this.updateLocationBaseTransits(locationBase, sessionId);
  }

  private debugExfiltrationsTooltips(config: Config): void {
    const locale = config.debug_exfiltrations_tooltips_locale;
    if (!locale || !this.tooltipsTemplater) {
      return;
    }

    const partialLocales = this.tooltipsTemplater.computeLocales(config);
    const mergedLocales: AllLocalesInDb = AVAILABLE_LOCALES.reduce<AllLocalesInDb>(
      (locales, locale) => {
        locales[locale] = {};
        return locales;
      },
      {},
    );
    void ExfilsTooltipsTemplater.mutateLocales(mergedLocales, partialLocales);
    const valuesForCountry = mergedLocales[locale];

    this.debug(`debug exfils tooltips => ${JSON.stringify(valuesForCountry, undefined, 2)}`);
  }

  // TODO: make it dynamic (aka intercept instead of mutating the db)
  private injectTooltipsInLocales(config: Config): void {
    const allLocales = this.db.getTables()?.locales?.global;

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    if (!this.tooltipsTemplater) {
      throw new Error('Path To Tarkov: tooltips templater is missing');
    }

    const partialLocales = this.tooltipsTemplater.computeLocales(config);
    const report = ExfilsTooltipsTemplater.mutateLocales(allLocales, partialLocales);

    const nbValuesUpdated = report.nbTotalValuesUpdated / report.nbLocalesImpacted;
    this.debug(
      `${nbValuesUpdated} extract tooltip values updated for ${report.nbLocalesImpacted} locales (total of ${report.nbTotalValuesUpdated})`,
    );
  }

  private getRespawnOffraidPosition = (sessionId: string): string => {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const profileTemplateId = profile.info.edition;

    const overrideByProfiles = this.getConfig(sessionId).override_by_profiles?.[profileTemplateId];

    const respawnAt = shuffle(
      overrideByProfiles?.respawn_at ?? this.getConfig(sessionId).respawn_at ?? [],
    );

    if (respawnAt.length === 0) {
      return this.getInitialOffraidPosition(sessionId);
    }

    // TODO: if '*' -> pick a random offraid position from all available
    return respawnAt[0];
  };

  private fixRepeatableQuestsForProfile(sessionId: string): void {
    const profile = this.saveServer.getProfile(sessionId);
    const pmc = profile.characters.pmc;

    const nbRemovedQuests = fixRepeatableQuestsForPmc(pmc);
    this.debug(`${nbRemovedQuests} removed broken repeatable quests in profile ${sessionId}`);
  }

  private updateOffraidPosition(sessionId: string, offraidPosition?: string): void {
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

    const config = this.getConfig(sessionId);

    this.tradersController.updateTraders(
      config.traders_config,
      config.traders_access_restriction,
      offraidPosition,
      sessionId,
    );

    this.saveServer.saveProfile(sessionId);
  }

  private createGenerateAll(originalFn: (sessionId: string) => ILocationsGenerateAllResponse) {
    return (sessionId: string): ILocationsGenerateAllResponse => {
      const offraidPosition = this.getOffraidPosition(sessionId);
      const result = originalFn(sessionId);
      const locations = deepClone(result.locations);
      const indexedLocations = getIndexedLocations(locations);

      const unlockedMaps = this.getConfig(sessionId).infiltrations[offraidPosition];
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
          this.syncLocationBase(locationBase, sessionId);
        }
      });

      const newPaths: IPath[] = []; // TODO: keep the original path (with filter on locked maps)
      return { ...result, locations, paths: newPaths };
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

      const size = this.stashController.getStashSize(offraidPosition, sessionId);

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
          throw new Error('Path To Tarkov: cannot set size for custom stash');
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

      const hideoutEnabled = this.stashController.getHideoutEnabled(offraidPosition, sessionId);

      areas.forEach(area => {
        if (!isIgnoredArea(area, this.getConfig(sessionId).workbench_always_enabled)) {
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

      const offraidRegenConfig = this.getConfig(sessionId).offraid_regen_config;

      // hydration restrictions
      if (!checkAccessVia(offraidRegenConfig.hydration.access_via, offraidPosition)) {
        this.debug(`[${sessionId}] disable hideout hydration regen`);
        regenDb.Hydration = 0;
      }

      // energy restrictions
      if (!checkAccessVia(offraidRegenConfig.energy.access_via, offraidPosition)) {
        this.debug(`[${sessionId}] disable hideout energy regen`);
        regenDb.Energy = 0;
      }

      // health restrictions
      if (!checkAccessVia(offraidRegenConfig.health.access_via, offraidPosition)) {
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

  private removePlayerSpawnsForLocation(locationBase: ILocationBase): void {
    locationBase.SpawnPointParams = locationBase.SpawnPointParams.filter(params => {
      return !isPlayerSpawnPoint(params);
    });
  }

  private updateSpawnPoints(locationBase: ILocationBase, sessionId: string): void {
    if (!this.isLocationBaseAvailable(locationBase)) {
      return;
    }

    const mapName = resolveMapNameFromLocation(locationBase.Id);
    const infiltrations = this.getConfig(sessionId).infiltrations;
    const offraidPosition = this.getOffraidPosition(sessionId);

    if (!infiltrations[offraidPosition]) {
      this.debug(
        `[${sessionId}] no offraid position '${offraidPosition}' found in config.infiltrations`,
      );
      return;
    }

    const spawnpoints = infiltrations[offraidPosition][mapName as MapName];

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
          const spawnPoint = createSpawnPoint(spawnData.Position, spawnData.Rotation, spawnId);

          if (!spawnPoint.Infiltration) {
            this.logger.warning(`=> PathToTarkov: spawn '${spawnId}' has no Infiltration`);
          }

          locationBase.SpawnPointParams.push(spawnPoint);
          this.debug(`[${sessionId}] player spawn '${spawnId}' added for location ${mapName}`);
        }
      });
    }
  }

  /**
   * The purpose of this function is to set the PTT Infiltration field for all player spawnpoints
   * It will allow exfils to be available even when player took a transit
   */
  private updateInfiltrationForPlayerSpawnPoints(locationBase: ILocationBase): void {
    if (!this.isLocationBaseAvailable(locationBase)) {
      return;
    }

    locationBase.SpawnPointParams.forEach(spawnPoint => {
      if (isPlayerSpawnPoint(spawnPoint)) {
        spawnPoint.Infiltration = PTT_INFILTRATION;
      }
    });
  }

  // this will ignore unavailable maps (like terminal)
  private isLocationBaseAvailable(locationBase: ILocationBase): boolean {
    if (locationBase.Scene.path && locationBase.Scene.rcid) {
      return true;
    }

    return false;
  }

  /**
   * Disable transits if specified by the config
   */
  private updateLocationBaseTransits(locationBase: ILocationBase, sessionId: string): void {
    if (!this.isLocationBaseAvailable(locationBase)) {
      return;
    }

    const config = this.getConfig(sessionId);

    if (!config.disable_all_transits) {
      return;
    }

    if (config.disable_all_transits) {
      this.updateLocationDisableAllTransits(locationBase);
    }
  }

  private updateLocationDisableAllTransits(locationBase: ILocationBase): void {
    const transits = locationBase.transits ?? [];

    let nbTransitsWiped = 0;
    transits.forEach(transit => {
      transit.active = false;
      nbTransitsWiped += 1;
    });

    if (nbTransitsWiped) {
      this.debug(`${nbTransitsWiped} transits disabled for map "${locationBase.Name}"`);
    }
  }

  private updateLocationBaseExits(locationBase: ILocationBase, sessionId: string): void {
    if (!this.isLocationBaseAvailable(locationBase)) {
      return;
    }

    const config = this.getConfig(sessionId);

    if (config.bypass_exfils_override) {
      return;
    }

    const mapName = resolveMapNameFromLocation(locationBase.Id);
    const extractPoints = Object.keys(config.exfiltrations[mapName as MapName] ?? {});

    if (extractPoints.length === 0) {
      this.logger.error(`Path To Tarkov: no exfils found for map '${mapName}'!`);
      return;
    }

    // TODO(refactor): implement an indexBy util
    const indexedExits = locationBase.exits.reduce<Record<string, IExit | undefined>>(
      (indexed, exit) => {
        return {
          ...indexed,
          [exit.Name]: exit,
        };
      },
      {},
    );

    // erase all exits and create custom exit points without requirements
    locationBase.exits = extractPoints.map(exitName => {
      const originalExit = indexedExits[exitName];
      return createExitPoint(exitName, originalExit);
    });
  }

  private getInitialOffraidPosition = (sessionId: string): string => {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const profileTemplateId = profile.info.edition;
    const config = this.getConfig(sessionId);

    const overrideByProfiles = config.override_by_profiles?.[profileTemplateId];

    return overrideByProfiles?.initial_offraid_position ?? config.initial_offraid_position;
  };

  private getOffraidPosition = (sessionId: string): string => {
    const defaultOffraidPosition = this.getInitialOffraidPosition(sessionId);
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    if (!profile.PathToTarkov.offraidPosition) {
      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
    }

    const offraidPosition = profile.PathToTarkov.offraidPosition;

    if (!this.getConfig(sessionId).infiltrations[offraidPosition]) {
      this.debug(
        `[${sessionId}] Unknown offraid position '${offraidPosition}', reset to default '${defaultOffraidPosition}'`,
      );

      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
      return profile.PathToTarkov.offraidPosition;
    }

    return offraidPosition;
  };
}
