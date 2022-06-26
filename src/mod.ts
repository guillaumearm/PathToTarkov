import type { IMod } from "@spt-aki/models/external/mod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { DependencyContainer } from "tsyringe";
import { createPathToTarkovAPI } from "./api";
import {
  Config,
  CONFIG_PATH,
  PACKAGE_JSON_PATH,
  SpawnConfig,
  SPAWN_CONFIG_PATH,
} from "./config";
import { EventWatcher } from "./event-watcher";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import { getModDisplayName, noop, PackageJson, readJsonFile } from "./utils";

class PathToTarkov implements IMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public load(container: DependencyContainer): void {
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);
    this.config = readJsonFile(CONFIG_PATH);
    this.spawnConfig = readJsonFile(SPAWN_CONFIG_PATH);

    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    this.container = container;

    if (this.config.debug) {
      this.debug("debug mode enabled");
    }

    const saveServer = container.resolve<SaveServer>("SaveServer");

    if (!this.config.enabled) {
      this.logger.warning("=> Path To Tarkov is disabled!");

      if (this.config.bypass_uninstall_procedure === true) {
        this.logger.warning(
          "=> PathToTarkov: uninstall process aborted because 'bypass_uninstall_procedure' field is true in config.json"
        );
        return;
      }

      purgeProfiles(this.config, saveServer, this.logger);
      return;
    }

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`
    );
  }

  public delayedLoad(container: DependencyContainer): void {
    if (!this.config.enabled) {
      return;
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");
    const configServer = container.resolve<ConfigServer>("ConfigServer");

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      db,
      saveServer,
      configServer,
      this.logger
    );

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController
    );

    (globalThis as any).PathToTarkovAPI = api;
    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.container = container;
    this.pathToTarkovController.initExfiltrations();
    this.pathToTarkovController.fixInsuranceDialogues();

    if (this.config.traders_access_restriction) {
      this.pathToTarkovController.tradersController.initTraders();
    }

    const eventWatcher = new EventWatcher(this);
    eventWatcher.listen();

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );
  }
}

module.exports = { mod: new PathToTarkov() };
