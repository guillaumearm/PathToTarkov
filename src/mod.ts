import type { IMod } from "@spt-aki/models/external/mod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
import type { DependencyContainer } from "tsyringe";
import { createPathToTarkovAPI } from "./api";
import {
  Config,
  CONFIG_PATH,
  MapName,
  PACKAGE_JSON_PATH,
  SpawnConfig,
  SPAWN_CONFIG_PATH,
} from "./config";
import { createStaticRoutePeeker, StaticRoutePeeker } from "./helpers";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import { getModDisplayName, noop, PackageJson, readJsonFile } from "./utils";

class PathToTarkov implements IMod {
  private logger: ILogger;
  private debug: (data: string) => void;

  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

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

  private watchOnGameStart(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/start",
      (url, info: unknown, sessionId) => {
        if (
          !this.pathToTarkovController.stashController.getInventory(sessionId)
        ) {
          this.debug(
            `/client/game/start: no pmc data found, init will be handled on profile creation`
          );
          // no pmc data found, will be handled by `onProfileCreated`
          return;
        }

        this.pathToTarkovController.init(sessionId);
        this.executeOnStartAPICallbacks(sessionId);

        this.logger.info(`=> PathToTarkov: game started!`);
      }
    );
  }

  private watchOnProfileCreated(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/profile/create",
      (url, info: unknown, sessionId) => {
        this.pathToTarkovController.init(sessionId);
        this.executeOnStartAPICallbacks(sessionId);

        this.logger.info(`=> PathToTarkov: pmc created!`);
      }
    );
  }

  private watchEndOfRaid(
    staticRoutePeeker: StaticRoutePeeker,
    saveServer: SaveServer
  ): void {
    type EndRaidCb = (
      currentLocationName: string,
      isPLayerScav: boolean
    ) => void;

    let endRaidCb: EndRaidCb = noop;
    let endRaidCbExecuted = false;
    let savedCurrentLocationName: string | null = null;
    let savedIsPlayerScav: boolean | null = null;

    staticRoutePeeker.watchRoute(
      "/raid/profile/save",
      (url, info: { isPlayerScav: boolean }, sessionId) => {
        const isPlayerScav = info.isPlayerScav;

        saveServer.load();
        const profile = saveServer.getProfile(sessionId);
        const currentLocationName = profile.inraid.location.toLowerCase();

        this.debug(`save profile: currentLocationName=${currentLocationName}`);

        if (endRaidCb !== noop) {
          endRaidCb(currentLocationName, isPlayerScav);
          endRaidCb = noop;
        } else if (!endRaidCbExecuted) {
          savedCurrentLocationName = currentLocationName;
          savedIsPlayerScav = isPlayerScav;
        }

        endRaidCbExecuted = false;
      }
    );

    staticRoutePeeker.watchRoute(
      "/client/match/offline/end",
      (url, info: { exitName: string | null }, sessionId) => {
        endRaidCb = (currentLocationName, isPlayerScav) => {
          this.debug(
            `end of raid: exitName='${info.exitName}' and currentLocationName='${currentLocationName}'`
          );
          if (
            isPlayerScav &&
            !this.pathToTarkovController.config
              .player_scav_move_offraid_position
          ) {
            this.debug("end of raid: scav player detected");
            return;
          }

          const playerDied = !info.exitName;

          if (
            this.pathToTarkovController.config
              .reset_offraid_position_on_player_die &&
            playerDied
          ) {
            this.debug("end of raid: player dies");
            this.pathToTarkovController.updateOffraidPosition(
              sessionId,
              this.pathToTarkovController.config.initial_offraid_position
            );
            return;
          }

          const extractsConf =
            this.pathToTarkovController.config.exfiltrations[
              currentLocationName as MapName
            ];

          const newOffraidPosition =
            extractsConf && extractsConf[info.exitName ?? ""];

          if (newOffraidPosition) {
            this.debug(
              `end of raid: new offraid position ${newOffraidPosition}`
            );
            this.pathToTarkovController.updateOffraidPosition(
              sessionId,
              newOffraidPosition
            );
          } else {
            this.debug(`end of raid: no new offraid position found`);
          }
        };

        if (savedCurrentLocationName !== null && savedIsPlayerScav !== null) {
          endRaidCb(savedCurrentLocationName, savedIsPlayerScav);
          endRaidCb = noop;
          endRaidCbExecuted = true;
          savedCurrentLocationName = null;
          savedIsPlayerScav = null;
        }
      }
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

    // TODO const eventWatcher = new EventWatcher(this);

    const staticRouter = container.resolve<StaticRouterModService>(
      "StaticRouterModService"
    );

    const staticRoutePeeker = createStaticRoutePeeker(staticRouter);

    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    this.watchEndOfRaid(staticRoutePeeker, saveServer);

    staticRoutePeeker.register();

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`
    );
  }
}

module.exports = { mod: new PathToTarkov() };
