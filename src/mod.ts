import type { DependencyContainer } from 'tsyringe';

import type { IPostSptLoadMod } from '@spt/models/external/IPostSptLoadMod';
import type { IPreSptLoadMod } from '@spt/models/external/IPreSptLoadMod';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

import { createPathToTarkovAPI } from './api';
import type { Config, PathToTarkovReloadedTooltipsConfig, SpawnConfig, UserConfig } from './config';
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
import { createStaticRoutePeeker, disableRunThrough } from './helpers';

import { PathToTarkovController } from './path-to-tarkov-controller';
import { purgeProfiles } from './uninstall';
import type { PackageJson } from './utils';
import { getModDisplayName, noop, readJsonFile } from './utils';
import { EndOfRaidController } from './end-of-raid-controller';
import { fixRepeatableQuests } from './fix-repeatable-quests';
import { pathToTarkovReloadedTooltipsConfigCompat } from './pttr-tooltips';
import path from 'path';
import { analyzeConfig } from './config-analysis';
import { TradersAvailabilityService } from './services/TradersAvailabilityService';

const getTooltipsConfig = (
  userConfig: UserConfig,
): PathToTarkovReloadedTooltipsConfig | undefined => {
  try {
    return require(path.join(CONFIGS_DIR, userConfig.selectedConfig, 'Tooltips.json'));
  } catch (_err) {
    return undefined;
  }
};

class PathToTarkov implements IPreSptLoadMod, IPostSptLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;
  private tooltipsConfig: PathToTarkovReloadedTooltipsConfig | undefined;
  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preSptLoad(container: DependencyContainer): void {
    this.container = container;
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);

    const userConfig = getUserConfig();
    this.config = processConfig(
      readJsonFile(path.join(CONFIGS_DIR, userConfig.selectedConfig, CONFIG_FILENAME)),
    );
    this.spawnConfig = processSpawnConfig(
      readJsonFile(path.join(CONFIGS_DIR, userConfig.selectedConfig, SPAWN_CONFIG_FILENAME)),
    );

    this.tooltipsConfig = getTooltipsConfig(userConfig);

    this.logger = container.resolve<ILogger>('WinstonLogger');
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    if (!this.config.enabled) {
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
        `Fatal Error when loading the selected Path To Tarkov config "${userConfig.selectedConfig}"`,
      );
    }

    const configServer = container.resolve<ConfigServer>('ConfigServer');
    const db = container.resolve<DatabaseServer>('DatabaseServer');
    const saveServer = container.resolve<SaveServer>('SaveServer');

    const staticRouter = container.resolve<StaticRouterModService>('StaticRouterModService');

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      new TradersAvailabilityService(),
      container,
      db,
      saveServer,
      configServer,
      this.logger,
      this.debug,
    );

    const eventWatcher = new EventWatcher(this, saveServer);
    const endOfRaidController = new EndOfRaidController(this);

    eventWatcher.onEndOfRaid(payload => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter), container);

    if (this.config.traders_access_restriction) {
      fixRepeatableQuests(container);
      this.debug('Apply fix for unavailable repeatable quests (due to locked traders)');
    }
  }

  public postDBLoad(container: DependencyContainer): void {
    if (!this.config.enabled) {
      return;
    }

    void container;
  }

  public postSptLoad(container: DependencyContainer): void {
    this.container = container;
    const db = container.resolve<DatabaseServer>('DatabaseServer');
    const saveServer = container.resolve<SaveServer>('SaveServer');
    const quests = db.getTables()?.templates?.quests;

    if (!quests) {
      throw new Error('cannot retrieve quests templates from db');
    }

    if (!this.config.enabled) {
      this.logger.warning('=> Path To Tarkov is disabled!');

      if (this.config.bypass_uninstall_procedure === true) {
        this.logger.warning(
          "=> PathToTarkov: uninstall process aborted because 'bypass_uninstall_procedure' field is true in config.json",
        );
        return;
      }

      purgeProfiles(this.config, quests, saveServer, this.logger);
      return;
    }

    this.pathToTarkovController.tradersAvailabilityService.init(quests);

    if (this.tooltipsConfig) {
      pathToTarkovReloadedTooltipsConfigCompat(db, this.tooltipsConfig);
      this.debug('injected legacy PTTR Tooltips.json file');
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

    this.pathToTarkovController.tradersController.initTraders(this.config);

    const nbAddedTemplates =
      this.pathToTarkovController.stashController.initSecondaryStashTemplates(
        this.config.hideout_secondary_stashes,
      );
    this.debug(`${nbAddedTemplates} secondary stash templates added`);

    if (!this.config.enable_run_through) {
      disableRunThrough(db);
      this.debug('disabled run through in-raid status');
    }

    this.logger.success(`===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`);
  }
}

module.exports = { mod: new PathToTarkov() };
