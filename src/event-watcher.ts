import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { DependencyContainer } from "tsyringe";
import type { MapName } from "./config";
import type { StaticRoutePeeker } from "./helpers";
import type { PathToTarkovController } from "./path-to-tarkov-controller";

import { noop } from "./utils";

type PTTInstance = {
  readonly container: DependencyContainer;
  readonly pathToTarkovController: PathToTarkovController;
  readonly logger: ILogger;
  readonly debug: (data: string) => void;
  readonly executeOnStartAPICallbacks: (sessionId: string) => void;
};

export const LOCATIONS_MAPS: Record<string, string> = {
  customs: "bigmap",
  factory: "factory4_day",
  reservebase: "rezervbase",
  interchange: "interchange",
  woods: "woods",
  lighthouse: "lighthouse",
  shoreline: "shoreline",
  laboratory: "laboratory",
  ["streets of tarkov"]: "tarkovstreets",
};

export const getMapNameFromLocationName = (location: string): string => {
  const locationName = location.toLowerCase();
  const mapName = LOCATIONS_MAPS[locationName];

  return mapName ?? "none";
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
    type EndRaidCb = (currentMapName: string, isPLayerScav: boolean) => void;

    let endRaidCb: EndRaidCb = noop;
    let endRaidCbExecuted = false;
    let savedCurrentMapName: string | null = null;
    let savedIsPlayerScav: boolean | null = null;

    // staticRoutePeeker.watchRoute(
    //   "/client/match/offline/start",
    //   (url, info: { locationName: string }, sessionId) => {
    //     const mapName = getMapNameFromLocationName(info.locationName);

    //     const profile = saveServer.getProfile(sessionId);

    //     if (!profile) {
    //       this.ptt.debug(`profile '${sessionId}' not found`);
    //     }

    //     this.ptt.debug(
    //       `offline raid started for '${sessionId}' on map '${mapName}'`
    //     );

    //     savedCurrentMapName = mapName;
    //   }
    // );

    staticRoutePeeker.watchRoute("/client/raid/configuration", (url, info: { location: string }, sessionId) => {
      this.ptt.debug(`location detected: ${info.location}`)
      const mapName = getMapNameFromLocationName(info.location);

      const profile = saveServer.getProfile(sessionId);

      if (!profile) {
        this.ptt.debug(`profile '${sessionId}' not found`);
      }

      this.ptt.debug(
        `offline raid started for '${sessionId}' on map '${mapName}'`
      );

      savedCurrentMapName = mapName;
    })

    // staticRoutePeeker.watchRoute("/client/location/getLocalloot", (url, info) => {
    //   console.log('=> /client/location/getLocalloot', info)
    // })

    staticRoutePeeker.watchRoute(
      "/raid/profile/save",
      (url, info: { isPlayerScav: boolean }, sessionId) => {
        const isPlayerScav = info.isPlayerScav;
        const profile = saveServer.getProfile(sessionId);

        if (!profile) {
          this.ptt.debug(`profile '${sessionId}' not found`);
        }

        this.ptt.debug(
          `save profile: currentMapName=${savedCurrentMapName} isPlayerScav=${isPlayerScav}`
        );

        if (endRaidCb !== noop && savedCurrentMapName) {
          endRaidCb(savedCurrentMapName, isPlayerScav);
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
        endRaidCb = (currentMapName, isPlayerScav) => {
          this.ptt.debug(
            `end of raid: exitName='${info.exitName}' and currentMapName='${currentMapName}'`
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
              currentMapName as MapName
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

        if (savedCurrentMapName !== null && savedIsPlayerScav !== null) {
          endRaidCb(savedCurrentMapName, savedIsPlayerScav);
          endRaidCb = noop;
          endRaidCbExecuted = true;
          savedCurrentMapName = null;
          savedIsPlayerScav = null;
        }
      }
    );
  }

  public listen(
    saveServer: SaveServer,
    staticRoutePeeker: StaticRoutePeeker
  ): void {
    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    this.watchEndOfRaid(staticRoutePeeker, saveServer);

    staticRoutePeeker.register();
  }
}
