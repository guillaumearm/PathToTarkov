import type { DependencyContainer } from "tsyringe";

import type { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import { createPathToTarkovAPI } from "./api";
import type { Config, SpawnConfig } from "./config";
import {
  CONFIG_PATH,
  PACKAGE_JSON_PATH,
  processConfig,
  processSpawnConfig,
  SPAWN_CONFIG_PATH,
} from "./config";
import { EventWatcher } from "./event-watcher";
import { createStaticRoutePeeker } from "./helpers";
import { enableKeepFoundInRaidTweak } from "./keep-fir-tweak";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import type { PackageJson } from "./utils";
import { getModDisplayName, noop, readJsonFile } from "./utils";
import { EndOfRaidController } from "./end-of-raid-controller";
import { getModLoader } from "./modLoader";
import { fixRepeatableQuests } from "./fix-repeatable-quests";

class PathToTarkov implements IPreSptLoadMod, IPostSptLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preSptLoad(container: DependencyContainer): void {
    this.container = container;
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);
    this.config = processConfig(readJsonFile(CONFIG_PATH));
    this.spawnConfig = processSpawnConfig(readJsonFile(SPAWN_CONFIG_PATH));

    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    if (this.config.debug) {
      this.debug("debug mode enabled");
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");
    const modLoader = getModLoader(container);

    const staticRouter = container.resolve<StaticRouterModService>(
      "StaticRouterModService",
    );

    if (!this.config.enabled) {
      this.logger.warning("=> Path To Tarkov is disabled!");

      if (this.config.bypass_uninstall_procedure === true) {
        this.logger.warning(
          "=> PathToTarkov: uninstall process aborted because 'bypass_uninstall_procedure' field is true in config.json",
        );
        return;
      }

      purgeProfiles(this.config, saveServer, this.logger);
      return;
    }

    // TODO: compat with Custom Quests
    const getIsTraderLocked = () => false;

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      db,
      saveServer,
      getIsTraderLocked,
      this.logger,
      this.debug,
      createStaticRoutePeeker(staticRouter),
      modLoader,
    );

    const eventWatcher = new EventWatcher(this);
    const endOfRaidController = new EndOfRaidController(this);

    eventWatcher.onEndOfRaid((payload) => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter));

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`,
    );

    const tweakFoundInRaid = !this.config.bypass_keep_found_in_raid_tweak;

    if (tweakFoundInRaid) {
      enableKeepFoundInRaidTweak(this);
      this.debug("option keep_found_in_raid_tweak enabled");
    }

    if (!this.config.bypass_luas_custom_spawn_points_tweak) {
      this.pathToTarkovController.hijackLuasCustomSpawnPointsUpdate();
    }

    if (this.config.traders_access_restriction) {
      fixRepeatableQuests(container, this.debug);
      this.debug(
        "Apply fix for unavailable repeatable quests (due to locked traders)",
      );
    }
  }

  public postSptLoad(container: DependencyContainer): void {
    this.container = container;

    if (!this.config.enabled) {
      return;
    }

    this.pathToTarkovController.generateEntrypoints();

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController,
    );

    (globalThis as any).PathToTarkovAPI = api;

    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.pathToTarkovController.initExfiltrations();

    if (this.config.traders_access_restriction) {
      this.pathToTarkovController.tradersController.initTraders();
    }

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`,
    );
  }
}

module.exports = { mod: new PathToTarkov() };
