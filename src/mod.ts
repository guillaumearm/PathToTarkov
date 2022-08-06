import type { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import type { IPostAkiLoadMod } from "@spt-aki/models/external/IPostAkiLoadMod";
import type { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
import type { DependencyContainer } from "tsyringe";
import { createPathToTarkovAPI } from "./api";
import type { Config, SpawnConfig } from "./config";
import { CONFIG_PATH, PACKAGE_JSON_PATH, SPAWN_CONFIG_PATH } from "./config";
import { EventWatcher } from "./event-watcher";
import { createStaticRoutePeeker } from "./helpers";
import { enableKeepFoundInRaidTweak } from "./keep-fir-tweak";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import type { PackageJson } from "./utils";
import { getModDisplayName, noop, readJsonFile } from "./utils";

class PathToTarkov implements IPreAkiLoadMod, IPostAkiLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preAkiLoad(container: DependencyContainer): void {
    this.container = container;

    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);
    this.config = readJsonFile(CONFIG_PATH);
    this.spawnConfig = readJsonFile(SPAWN_CONFIG_PATH);

    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

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

    const tweakFoundInRaid = !this.config.bypass_keep_found_in_raid_tweak;

    if (tweakFoundInRaid) {
      enableKeepFoundInRaidTweak(this);
      this.debug("option keep_found_in_raid_tweak enabled");
    }

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`
    );
  }

  public postAkiLoad(container: DependencyContainer): void {
    this.container = container;

    if (!this.config.enabled) {
      return;
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");
    const configServer = container.resolve<ConfigServer>("ConfigServer");
    const modLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");

    const staticRouter = this.container.resolve<StaticRouterModService>(
      "StaticRouterModService"
    );

    // TODO: compat with Custom Quests
    const getIsTraderLocked = () => false;

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      db,
      saveServer,
      configServer,
      getIsTraderLocked,
      this.logger,
      this.debug,
      createStaticRoutePeeker(staticRouter),
      modLoader
    );

    this.pathToTarkovController.hijackLuasCustomSpawnPointsUpdate();

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController
    );

    (globalThis as any).PathToTarkovAPI = api;

    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.pathToTarkovController.initExfiltrations();
    this.pathToTarkovController.fixInsuranceDialogues();

    if (this.config.traders_access_restriction) {
      this.pathToTarkovController.tradersController.initTraders();
    }

    const eventWatcher = new EventWatcher(this);
    eventWatcher.listen(saveServer, createStaticRoutePeeker(staticRouter));

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );
  }
}

module.exports = { mod: new PathToTarkov() };
