import path from 'path';
import type { DependencyContainer } from 'tsyringe';

import type { IPostSptLoadMod } from '@spt/models/external/IPostSptLoadMod';
import type { IPreSptLoadMod } from '@spt/models/external/IPreSptLoadMod';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

import { createPathToTarkovAPI } from './api';
import type { Config, MapName, SpawnConfig, UserConfig } from './config';
import {
  CONFIG_FILENAME,
  CONFIGS_DIR,
  getUserConfig,
  PACKAGE_JSON_PATH,
  processConfig,
  processSpawnConfig,
  SPAWN_CONFIG_FILENAME,
} from './config';
import { EventWatcher } from './event-watcher';
import { createStaticRoutePeeker } from './helpers';

import { PathToTarkovController } from './path-to-tarkov-controller';
import { purgeProfiles } from './uninstall';
import type { PackageJson } from './utils';
import { getModDisplayName, noop, readJsonFile } from './utils';
import { EndOfRaidController } from './end-of-raid-controller';
import { fixRepeatableQuests } from './fix-repeatable-quests';

import { analyzeConfig } from './config-analysis';
import { TradersAvailabilityService } from './services/TradersAvailabilityService';
import type { ExfilsTargetsRequest } from './exfils-targets';
import { getExfilsTargets } from './exfils-targets';
import { resolveMapNameFromLocation } from './map-name-resolver';
import type { JsonUtil } from '@spt/utils/JsonUtil';

class PathToTarkov implements IPreSptLoadMod, IPostSptLoadMod {
  private packageJson: PackageJson;
  private userConfig: UserConfig;
  private config: Config;
  private spawnConfig: SpawnConfig;
  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preSptLoad(container: DependencyContainer): void {
    this.container = container;
    const jsonUtil = container.resolve<JsonUtil>('JsonUtil');
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH, jsonUtil);

    this.userConfig = getUserConfig(jsonUtil);
    this.config = processConfig(
      readJsonFile(
        path.join(CONFIGS_DIR, this.userConfig.selectedConfig, CONFIG_FILENAME),
        jsonUtil,
      ),
    );
    this.spawnConfig = processSpawnConfig(
      readJsonFile(path.join(CONFIGS_DIR, SPAWN_CONFIG_FILENAME), jsonUtil),
      this.config,
    );

    this.logger = container.resolve<ILogger>('WinstonLogger');
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    if (this.userConfig.runUninstallProcedure) {
      return;
    }

    this.logger.info(`===> Loading ${getModDisplayName(this.packageJson, true)}`);

    if (this.config.debug) {
      this.debug('debug mode enabled');
    }

    const analysisResult = analyzeConfig(this.config, this.spawnConfig);

    analysisResult.warnings.forEach(warn => {
      this.logger.warning(`[Path To Tarkov Config] ${warn}`);
    });

    analysisResult.errors.forEach(err => {
      this.logger.error(`[Path To Tarkov Config] ${err}`);
    });

    if (analysisResult.errors.length > 0) {
      throw new Error(
        `Fatal Error when loading the selected Path To Tarkov config "${this.userConfig.selectedConfig}"`,
      );
    }

    const configServer = container.resolve<ConfigServer>('ConfigServer');
    const db = container.resolve<DatabaseServer>('DatabaseServer');
    const saveServer = container.resolve<SaveServer>('SaveServer');

    const staticRouter = container.resolve<StaticRouterModService>('StaticRouterModService');

    const eventWatcher = new EventWatcher(this, saveServer);
    const endOfRaidController = new EndOfRaidController(this);

    const getRaidCache = eventWatcher.getRaidCache.bind(eventWatcher);

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      new TradersAvailabilityService(),
      container,
      db,
      saveServer,
      configServer,
      getRaidCache,
      this.logger,
      this.debug,
    );

    eventWatcher.onEndOfRaid(payload => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter), container);

    // TODO: refactor this part
    staticRouter.registerStaticRouter(
      'Trap-PathToTarkov-ExfilsTargets',
      [
        {
          url: '/PathToTarkov/ExfilsTargets',
          action: async (_url, info: ExfilsTargetsRequest, sessionId): Promise<string> => {
            this.debug(`/PathToTarkov/ExfilsTargets called for location "${info.locationId}"`);
            const config = this.pathToTarkovController.getConfig(sessionId);
            const mapName = resolveMapNameFromLocation(info.locationId);
            const response = getExfilsTargets(config, mapName as MapName);
            return JSON.stringify(response);
          },
        },
      ],
      '',
    );

    if (this.config.traders_access_restriction) {
      fixRepeatableQuests(container);
      this.debug('Apply fix for unavailable repeatable quests (due to locked traders)');
    }
  }

  public postDBLoad(_container: DependencyContainer): void {
    if (this.userConfig.runUninstallProcedure) {
      return;
    }
    this.pathToTarkovController.debugExfiltrationsTooltips(this.config);
  }

  public postSptLoad(container: DependencyContainer): void {
    this.container = container;
    const db = container.resolve<DatabaseServer>('DatabaseServer');
    const saveServer = container.resolve<SaveServer>('SaveServer');
    const quests = db.getTables()?.templates?.quests;

    if (!quests) {
      throw new Error('cannot retrieve quests templates from db');
    }

    if (this.userConfig.runUninstallProcedure) {
      this.logger.warning('=> Path To Tarkov is disabled!');
      purgeProfiles(this.config, quests, saveServer, this.logger);
      return;
    }

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController,
      this.logger,
    );

    if (this.config.enable_legacy_ptt_api) {
      (globalThis as any).PathToTarkovAPI = api;
      this.debug('API enabled');
    } else {
      this.debug('API disabled');
    }

    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.pathToTarkovController.loaded(this.config);
    this.pathToTarkovController.debugExfiltrationsTooltips(this.config);
    this.logger.success(`===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`);
  }
}

module.exports = { mod: new PathToTarkov() };
