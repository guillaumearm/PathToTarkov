import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { StaticRouterModService } from "@spt-aki/services/mod/staticRouter/StaticRouterModService";
import { DependencyContainer } from "tsyringe";
import { MapName } from "./config";
import { createStaticRoutePeeker, StaticRoutePeeker } from "./helpers";
import { PathToTarkovController } from "./path-to-tarkov-controller";

import { noop } from "./utils";

type PTTInstance = {
  container: DependencyContainer;
  pathToTarkovController: PathToTarkovController;
  logger: ILogger;
  debug: (data: string) => void;
  executeOnStartAPICallbacks: (sessionId: string) => void;
};

export class EventWatcher {
  constructor(private ptt: PTTInstance) {}

  private watchOnGameStart(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/start",
      (url, info: unknown, sessionId) => {
        if (
          !this.ptt.pathToTarkovController.stashController.getInventory(
            sessionId
          )
        ) {
          this.ptt.debug(
            `/client/game/start: no pmc data found, init will be handled on profile creation`
          );
          // no pmc data found, will be handled by `onProfileCreated`
          return;
        }

        this.ptt.pathToTarkovController.init(sessionId);
        this.ptt.executeOnStartAPICallbacks(sessionId);

        this.ptt.logger.info(`=> PathToTarkov: game started!`);
      }
    );
  }

  private watchOnProfileCreated(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/profile/create",
      (url, info: unknown, sessionId) => {
        this.ptt.pathToTarkovController.init(sessionId);
        this.ptt.executeOnStartAPICallbacks(sessionId);

        this.ptt.logger.info(`=> PathToTarkov: pmc created!`);
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
      "/client/match/offline/start",
      (url, info: { locationName: string }, sessionId) => {
        const locationName = info.locationName.toLowerCase();
        this.ptt.debug(
          `offline raid started for '${sessionId}' on map '${locationName}'`
        );

        savedCurrentLocationName = locationName;
      }
    );

    staticRoutePeeker.watchRoute(
      "/raid/profile/save",
      (url, info: { isPlayerScav: boolean }, sessionId) => {
        const isPlayerScav = info.isPlayerScav;
        const profile = saveServer.getProfile(sessionId);

        if (!profile) {
          this.ptt.debug(`profile '${sessionId}' not found`);
        }

        this.ptt.debug(
          `save profile: currentLocationName=${savedCurrentLocationName} isPlayerScav=${isPlayerScav}`
        );

        if (endRaidCb !== noop && savedCurrentLocationName) {
          endRaidCb(savedCurrentLocationName, isPlayerScav);
          endRaidCb = noop;
        } else if (!endRaidCbExecuted) {
          savedIsPlayerScav = isPlayerScav;
        }

        endRaidCbExecuted = false;
      }
    );

    staticRoutePeeker.watchRoute(
      "/client/match/offline/end",
      (url, info: { exitName: string | null }, sessionId) => {
        endRaidCb = (currentLocationName, isPlayerScav) => {
          this.ptt.debug(
            `end of raid: exitName='${info.exitName}' and currentLocationName='${currentLocationName}'`
          );
          if (
            isPlayerScav &&
            !this.ptt.pathToTarkovController.config
              .player_scav_move_offraid_position
          ) {
            this.ptt.debug("end of raid: scav player detected");
            return;
          }

          const playerDied = !info.exitName;

          if (
            this.ptt.pathToTarkovController.config
              .reset_offraid_position_on_player_die &&
            playerDied
          ) {
            this.ptt.debug("end of raid: player dies");
            this.ptt.pathToTarkovController.updateOffraidPosition(
              sessionId,
              this.ptt.pathToTarkovController.config.initial_offraid_position
            );
            return;
          }

          const extractsConf =
            this.ptt.pathToTarkovController.config.exfiltrations[
              currentLocationName as MapName
            ];

          const newOffraidPosition =
            extractsConf && extractsConf[info.exitName ?? ""];

          if (newOffraidPosition) {
            this.ptt.debug(
              `end of raid: new offraid position ${newOffraidPosition}`
            );
            this.ptt.pathToTarkovController.updateOffraidPosition(
              sessionId,
              newOffraidPosition
            );
          } else {
            this.ptt.debug(`end of raid: no new offraid position found`);
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

  public listen(): void {
    const saveServer = this.ptt.container.resolve<SaveServer>("SaveServer");
    const staticRouter = this.ptt.container.resolve<StaticRouterModService>(
      "StaticRouterModService"
    );

    const staticRoutePeeker = createStaticRoutePeeker(staticRouter);

    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    this.watchEndOfRaid(staticRoutePeeker, saveServer);

    staticRoutePeeker.register();
  }
}
