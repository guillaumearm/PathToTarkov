import type { IBodyHealth, IGlobals } from '@spt/models/eft/common/IGlobals';
import type { IExit, ILocationBase, ISpawnPointParam } from '@spt/models/eft/common/ILocationBase';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';

import type {
  ByLocale,
  Config,
  ConfigGetter,
  LocaleName,
  MapName,
  Profile,
  SpawnConfig,
  UserConfig,
} from './config';
import { DEFAULT_FALLBACK_LANGUAGE, MAPLIST, VANILLA_STASH_IDS } from './config';

import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  disableRunThrough,
  isIgnoredArea,
  isPlayerSpawnPoint,
  mutateLocales,
  PTT_INFILTRATION,
  rejectPlayerCategory,
} from './helpers';

import { StashController } from './stash-controller';
import { TradersController } from './traders-controller';
import type { DependencyContainer } from 'tsyringe';
import type { LocationController } from '@spt/controllers/LocationController';
import type { PackageJson } from './utils';
import { deepClone, isNotUndefined, shuffle } from './utils';
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
import { ExfilsTooltipsTemplater } from './services/ExfilsTooltipsTemplater';
import type { RaidCache } from './event-watcher';
import type { AllLocalesInDb } from './services/LocaleResolver';

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
    private readonly userConfig: UserConfig,
    private readonly packageJson: PackageJson,
    private tradersAvailabilityService: TradersAvailabilityService,
    private readonly container: DependencyContainer,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    configServer: ConfigServer,
    private readonly getRaidCache: (sessionId: string) => RaidCache | null,
    private readonly logger: ILogger,
    public readonly debug: (data: string) => void,
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
    this.stashController = new StashController(
      this.getConfig,
      userConfig,
      db,
      saveServer,
      this.debug,
    );
    this.tradersController = new TradersController(
      this.tradersAvailabilityService,
      userConfig,
      db,
      saveServer,
      configServer,
      this.logger,
    );
  }

  init(): void {
    this.overrideControllers();
  }

  getFullVersion(): string {
    return this.packageJson.version;
  }

  loaded(config: Config): void {
    // const allLocales = this.db.getTables()?.locales?.global;
    const quests = this.db.getTables()?.templates?.quests;

    if (!quests) {
      throw new Error('Path To Tarkov: no quests found in db');
    }

    this.tradersAvailabilityService.init(quests);
    this.injectTooltipsInLocales(config);
    this.injectPromptTemplatesInLocales(config);
    this.injectOffraidPositionDisplayNamesInLocales(config);
    this.tradersController.initTraders(config);

    const nbAddedTemplates = this.stashController.initSecondaryStashTemplates(
      config.hideout_secondary_stashes,
    );
    this.debug(`${nbAddedTemplates} secondary stash templates added`);

    disableRunThrough(this.db);
    this.debug('disabled run through in-raid status');
  }

  getUserConfig(): UserConfig {
    return this.userConfig;
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

  isScavMoveOffraidPosition(): boolean {
    return this.userConfig.gameplay.playerScavMoveOffraidPosition;
  }

  onPlayerDies(sessionId: string): void {
    if (this.userConfig.gameplay.resetOffraidPositionOnPlayerDeath) {
      const initialOffraidPosition = this.getRespawnOffraidPosition(sessionId);
      this.updateOffraidPosition(sessionId, initialOffraidPosition);
    }
  }

  // returns the new offraid position (or null if not found)
  onPlayerExtracts(params: {
    sessionId: string;
    mapName: MapName;
    newOffraidPosition: string;
    isPlayerScav: boolean;
  }): void {
    const { sessionId, newOffraidPosition, isPlayerScav } = params;

    if (this.userConfig.gameplay.keepFoundInRaidTweak) {
      const firTweak = new KeepFoundInRaidTweak(this.saveServer);
      const nbImpactedItems = firTweak.setFoundInRaidOnEquipment(sessionId, isPlayerScav);
      this.debug(
        `[${sessionId}] FIR tweak added SpawnedInSession on ${nbImpactedItems} item${nbImpactedItems > 1 ? 's' : ''}`,
      );
    } else {
      this.debug(`[${sessionId}] FIR tweak disabled`);
    }

    this.updateOffraidPosition(sessionId, newOffraidPosition);
  }

  /**
   * Warning: this function will mutate the given locationBase
   */
  syncLocationBase(locationBase: ILocationBase, sessionId: string): void {
    const raidCache = this.getRaidCache(sessionId);

    if (raidCache && raidCache.exitStatus === 'Transit') {
      // handle when a player took a vanilla transit
      this.updateInfiltrationForPlayerSpawnPoints(locationBase);
    }

    if (raidCache && raidCache.transitTargetMapName && raidCache.transitTargetSpawnPointId) {
      // handle when a player took a ptt transit
      this.updateSpawnPointsForTransit(
        locationBase,
        sessionId,
        raidCache.transitTargetMapName,
        raidCache.transitTargetSpawnPointId,
      );
    } else {
      // handle when a player took a ptt extract
      this.updateSpawnPoints(locationBase, sessionId);
    }

    this.updateLocationBaseExits(locationBase, sessionId);
    this.updateLocationBaseTransits(locationBase, sessionId);
  }

  debugExfiltrationsTooltips(config: Config): void {
    const debugLocale = config.debug_exfiltrations_tooltips_locale;
    if (!debugLocale) {
      return;
    }

    const localeValues = this.getTooltipsTemplater().debugTooltipsForLocale(debugLocale, config);
    this.debug(`debug exfils tooltips => ${JSON.stringify(localeValues, undefined, 2)}`);
  }

  private createTooltipsTemplater(): ExfilsTooltipsTemplater {
    const allLocales = this.db.getTables()?.locales?.global;

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    return new ExfilsTooltipsTemplater(allLocales);
  }

  private getTooltipsTemplater(): ExfilsTooltipsTemplater {
    if (!this.tooltipsTemplater) {
      this.tooltipsTemplater = this.createTooltipsTemplater();
    }

    return this.tooltipsTemplater;
  }

  // TODO: make it dynamic (aka intercept instead of mutating the db)
  private injectTooltipsInLocales(config: Config): void {
    const allLocales = this.db.getTables()?.locales?.global;

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    const partialLocales = this.getTooltipsTemplater().computeLocales(config);
    const report = mutateLocales(allLocales, partialLocales);

    const nbValuesUpdated = report.nbTotalValuesUpdated / report.nbLocalesImpacted;
    this.debug(
      `${nbValuesUpdated} extract tooltip values updated for ${report.nbLocalesImpacted} locales (total of ${report.nbTotalValuesUpdated})`,
    );
  }

  // TODO: refactor in a dedicated service
  // TODO: make it dynamic (aka intercept instead of mutating the db)
  private injectPromptTemplatesInLocales(config: Config): void {
    const allLocales = this.db.getTables()?.locales?.global;

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    // 1. prepare transits_prompt_template
    const DEFAULT_TRANSITS_PROMPT_TEMPLATE_KEY = 'PTT_TRANSITS_PROMPT_TEMPLATE';
    const DEFAULT_TRANSITS_PROMPT_TEMPLATE_VALUE = 'Transit to {0}';
    const DEFAULT_TRANSITS_PROMPT_TEMPLATE: ByLocale<string> = {
      [DEFAULT_FALLBACK_LANGUAGE]: DEFAULT_TRANSITS_PROMPT_TEMPLATE_VALUE,
    };
    const transitsPromptTemplate =
      config.transits_prompt_template ?? DEFAULT_TRANSITS_PROMPT_TEMPLATE;

    // 2. prepare extracts_prompt_template
    const DEFAULT_EXTRACTS_PROMPT_TEMPLATE_KEY = 'PTT_EXTRACTS_PROMPT_TEMPLATE';
    const DEFAULT_EXTRACTS_PROMPT_TEMPLATE_VALUE = 'Extract to {0}';
    const DEFAULT_EXTRACTS_PROMPT_TEMPLATE: ByLocale<string> = {
      [DEFAULT_FALLBACK_LANGUAGE]: DEFAULT_EXTRACTS_PROMPT_TEMPLATE_VALUE,
    };
    const extractsPromptTemplate =
      config.extracts_prompt_template ?? DEFAULT_EXTRACTS_PROMPT_TEMPLATE;

    // 3. prepare new locales
    const newLocales: Partial<AllLocalesInDb> = {};
    Object.keys(allLocales).forEach(locale => {
      const localeValues: Record<string, string> = {
        [DEFAULT_TRANSITS_PROMPT_TEMPLATE_KEY]:
          transitsPromptTemplate[locale as LocaleName] ?? DEFAULT_TRANSITS_PROMPT_TEMPLATE_VALUE,
        [DEFAULT_EXTRACTS_PROMPT_TEMPLATE_KEY]:
          extractsPromptTemplate[locale as LocaleName] ?? DEFAULT_EXTRACTS_PROMPT_TEMPLATE_VALUE,
      };
      newLocales[locale] = localeValues;
    });

    // 4. mutate locales
    const report = mutateLocales(allLocales, newLocales);

    const nbValuesUpdated = report.nbTotalValuesUpdated / report.nbLocalesImpacted;
    this.debug(
      `${nbValuesUpdated} prompt templates values updated for ${report.nbLocalesImpacted} locales (total of ${report.nbTotalValuesUpdated})`,
    );
  }

  private injectOffraidPositionDisplayNamesInLocales(config: Config): void {
    const allLocales = this.db.getTables()?.locales?.global;

    if (!allLocales) {
      throw new Error('Path To Tarkov: no locales found in db');
    }

    // 1. create new locales
    const newLocales: Partial<AllLocalesInDb> = {};
    Object.keys(allLocales).forEach(locale => {
      const localeValues: Record<string, string> = {};

      const offraidPositions = config.offraid_positions ?? {};
      Object.keys(offraidPositions).forEach(offraidPosition => {
        const displayNameValue = ExfilsTooltipsTemplater.resolveOffraidPositionDisplayName(config, {
          offraidPosition,
          locale: locale as LocaleName,
        });

        localeValues[`PTT_OFFRAIDPOS_DISPLAY_NAME_${offraidPosition}`] = displayNameValue;
      });

      newLocales[locale] = localeValues;
    });

    // 2. mutate locales
    const report = mutateLocales(allLocales, newLocales);

    const nbValuesUpdated = report.nbTotalValuesUpdated / report.nbLocalesImpacted;
    this.debug(
      `${nbValuesUpdated} prompt templates values updated for ${report.nbLocalesImpacted} locales (total of ${report.nbTotalValuesUpdated})`,
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
      this.userConfig.gameplay.tradersAccessRestriction,
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
        if (!isIgnoredArea(area)) {
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
    const newSpawnPoints: ISpawnPointParam[] = locationBase.SpawnPointParams.map(spawn => {
      const newSpawn = rejectPlayerCategory(spawn);

      if (newSpawn.Categories.length === 0) {
        return undefined;
      }

      return newSpawn;
    }).filter(isNotUndefined);

    locationBase.SpawnPointParams = newSpawnPoints;
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

  private updateSpawnPointsForTransit(
    locationBase: ILocationBase,
    sessionId: string,
    transitTargetMapName: string,
    transitTargetSpawnPointId: string,
  ): void {
    if (!this.isLocationBaseAvailable(locationBase)) {
      return;
    }
    const mapName = resolveMapNameFromLocation(locationBase.Id);

    if (mapName !== transitTargetMapName) {
      return;
    }

    const spawnId = transitTargetSpawnPointId;
    const spawnData =
      this.spawnConfig[mapName as MapName] && this.spawnConfig[mapName as MapName][spawnId];
    if (spawnData) {
      const spawnPoint = createSpawnPoint(spawnData.Position, spawnData.Rotation, spawnId);

      if (!spawnPoint.Infiltration) {
        this.logger.warning(
          `=> PathToTarkov: spawn '${spawnId}' has no Infiltration (player in transit)`,
        );
      }

      this.removePlayerSpawnsForLocation(locationBase);
      locationBase.SpawnPointParams.push(spawnPoint);

      this.debug(
        `[${sessionId}] player spawn '${spawnId}' added for location ${mapName} (player in transit)`,
      );
    }

    this.debug(
      `Transit detected on map "${mapName}" via spawnpoint "${transitTargetSpawnPointId}"`,
    );
  }

  /**
   * The purpose of this function is to set the PTT Infiltration field for all player spawnpoints
   * It will allow exfils to be available even when player took a vanilla transit
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

    const noVanillaTransits = !config.enable_all_vanilla_transits;
    if (noVanillaTransits) {
      this.updateLocationDisableAllTransits(locationBase);
    }
  }

  private updateLocationDisableAllTransits(locationBase: ILocationBase): void {
    const transits = locationBase.transits ?? [];

    transits.forEach(transit => {
      transit.active = false;
    });
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
