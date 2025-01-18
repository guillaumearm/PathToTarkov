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
import type { Config, SpawnConfig, UserConfig } from './config';
import {
  ADDITIONAL_PLAYER_SPAWNPOINTS_FILENAME,
  CONFIG_FILENAME,
  CONFIGS_DIR,
  DO_NOT_DISTRIBUTE_DIR,
  getUserConfig,
  loadAdditionalPlayerSpawnpoints,
  mergeAdditionalSpawnpoints,
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
import type { JsonUtil } from '@spt/utils/JsonUtil';
import { registerCustomRoutes } from './routes';
import { performPathToTarkovInstallationAnalysis } from './installation-analysis';
import { getPTTLogHeader } from './ptt-log-header';
import { registerVersionRoute } from './routes/version';

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

  public runStaticAnalysis(): void {
    const analysisResult = analyzeConfig(this.config, this.spawnConfig);

    if (analysisResult.warnings.length > 0) {
      this.logger.info(
        getPTTLogHeader(`Warnings found in "${this.userConfig.selectedConfig}" config`),
      );
      analysisResult.warnings.forEach(warn => {
        this.logger.warning(`[Path To Tarkov Config] ${warn}`);
      });
    }

    if (analysisResult.errors.length > 0) {
      this.logger.info(
        getPTTLogHeader(`Errors found in "${this.userConfig.selectedConfig}" config`),
      );
      analysisResult.errors.forEach(err => {
        this.logger.error(`[Path To Tarkov Config] ${err}`);
      });

      this.logger.info(
        getPTTLogHeader('The following stacktrace is not a bug, please fix your config'),
      );
      throw new Error(
        `Fatal Error when loading the selected Path To Tarkov config "${this.userConfig.selectedConfig}"`,
      );
    }
  }

  public preSptLoad(container: DependencyContainer): void {
    this.container = container;
    this.logger = container.resolve<ILogger>('WinstonLogger');
    const jsonUtil = container.resolve<JsonUtil>('JsonUtil');
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH, jsonUtil);

    performPathToTarkovInstallationAnalysis();

    this.userConfig = getUserConfig(jsonUtil);

    this.config = processConfig(
      readJsonFile(
        path.join(CONFIGS_DIR, this.userConfig.selectedConfig, CONFIG_FILENAME),
        jsonUtil,
      ),
    );

    const spawnConfig = processSpawnConfig(
      readJsonFile(path.join(DO_NOT_DISTRIBUTE_DIR, SPAWN_CONFIG_FILENAME), jsonUtil),
      this.config,
    );

    const additionalSpawnConfig = loadAdditionalPlayerSpawnpoints(
      path.join(
        CONFIGS_DIR,
        this.userConfig.selectedConfig,
        ADDITIONAL_PLAYER_SPAWNPOINTS_FILENAME,
      ),
      jsonUtil,
    );

    this.spawnConfig = mergeAdditionalSpawnpoints(spawnConfig, additionalSpawnConfig);

    this.debug = (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true);

    this.logger.info(`===> Loading ${getModDisplayName(this.packageJson, true)}`);
    this.debug(`UserConfig is ${JSON.stringify(this.userConfig, undefined, 2)}`);

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
      this.userConfig,
      this.packageJson,
      new TradersAvailabilityService(),
      container,
      db,
      saveServer,
      configServer,
      getRaidCache,
      this.logger,
      this.debug,
    );

    if (this.userConfig.runUninstallProcedure) {
      // We register the version route here to let the client know when ptt is uninstalled
      registerVersionRoute(staticRouter, {
        uninstalled: true,
        fullVersion: this.packageJson.version,
      });
      return;
    }

    this.pathToTarkovController.init();
    this.runStaticAnalysis();

    eventWatcher.onEndOfRaid(payload => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter), container);

    registerCustomRoutes(staticRouter, this.pathToTarkovController);

    if (this.userConfig.gameplay.tradersAccessRestriction) {
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
      this.logger.success(getPTTLogHeader('Uninstall done'));
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

    this.logger.success(
      getPTTLogHeader(`Successfully loaded ${getModDisplayName(this.packageJson, true)}`),
    );
  }
}

module.exports = { mod: new PathToTarkov() };
