import type { StaticRoutePeeker } from "./helpers";
import type { EndOfRaidPayload, PTTInstance } from "./end-of-raid-controller";

type EndOfRaidCallback = (payload: EndOfRaidPayload) => void;

type RaidCache = {
  saved: boolean;
  endOfRaid: boolean;
  sessionId: string | null;
  currentLocationName: string | null;
  exitName: string | null | undefined;
  isPlayerScav: boolean | null;
};

const getEmptyRaidCache = (): RaidCache => ({
  saved: false,
  endOfRaid: false,
  sessionId: null,
  currentLocationName: null,
  exitName: undefined,
  isPlayerScav: null,
});

export class EventWatcher {
  private raidCache: RaidCache;
  private endOfRaidCallback: EndOfRaidCallback | null = null;

  constructor(private ptt: PTTInstance) {
    this.raidCache = getEmptyRaidCache();
  }

  private cleanRaidCache(): void {
    this.raidCache = getEmptyRaidCache();
  }

  private initRaidCache(sessionId: string): void {
    this.cleanRaidCache();
    this.raidCache.sessionId = sessionId;
  }

  private watchOnGameStart(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/game/start",
      (url, info: unknown, sessionId) => {
        this.initRaidCache(sessionId);

        if (
          !this.ptt.pathToTarkovController.stashController.getInventory(
            sessionId
          )
        ) {
          this.ptt.debug(
            `/client/game/start: no pmc data found, init will be handled on profile creation`
          );
          // no pmc data found, init will be handled by `watchOnProfileCreated`
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
        this.initRaidCache(sessionId);

        this.ptt.pathToTarkovController.init(sessionId);
        this.ptt.executeOnStartAPICallbacks(sessionId);

        this.ptt.logger.info(`=> PathToTarkov: pmc created!`);
      }
    );
  }

  private watchStartOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/raid/configuration",
      (url, info: { location: string }, sessionId) => {
        this.initRaidCache(sessionId);

        this.raidCache.currentLocationName = info.location;

        this.ptt.debug(
          `offline raid started on location '${info.location}' with sessionId '${sessionId}'`
        );
      }
    );
  }

  private watchSave(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/raid/profile/save",
      (url, info: { isPlayerScav: boolean }) => {
        this.raidCache.saved = true;
        this.raidCache.isPlayerScav = info.isPlayerScav;

        this.ptt.debug(
          `profile saved: raidCache.isPlayerScav=${info.isPlayerScav}`
        );

        if (!this.raidCache.endOfRaid) {
          this.ptt.debug("end of raid: callback execution delayed...");
          return;
        }

        return this.runEndOfRaidCallback();
      }
    );
  }

  private watchEndOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      "/client/match/offline/end",
      (url, info: { exitName: string | null }, sessionId: string) => {
        this.raidCache.endOfRaid = true;
        this.raidCache.sessionId = sessionId;
        this.raidCache.exitName = info.exitName;

        this.ptt.debug(`end of raid detected for exit '${info.exitName}'`);

        if (!this.raidCache.saved) {
          this.ptt.debug(
            "end of raid: callback execution delayed on profile save..."
          );
          return;
        }

        return this.runEndOfRaidCallback();
      }
    );
  }

  private getEndOfRaidPayload(): EndOfRaidPayload {
    const {
      sessionId,
      currentLocationName: locationName,
      isPlayerScav,
      exitName,
    } = this.raidCache;

    if (sessionId === null) {
      throw new Error("raidCache.sessionId is null");
    }

    if (locationName === null) {
      throw new Error("raidCache.currentLocationName is null");
    }

    if (isPlayerScav === null) {
      throw new Error("raidCache.isPlayerScav is null");
    }

    if (exitName === undefined) {
      throw new Error("raidCache.exitName is undefined");
    }

    return {
      sessionId,
      locationName,
      isPlayerScav,
      exitName,
    };
  }

  private runEndOfRaidCallback(): void {
    if (this.endOfRaidCallback) {
      try {
        const endOfRaidPayload = this.getEndOfRaidPayload();
        this.endOfRaidCallback(endOfRaidPayload);
      } catch (error: any) {
        this.ptt.logger.error(`Path To Tarkov Error: ${error.message}`);
      } finally {
        this.cleanRaidCache();
      }
    } else {
      this.ptt.logger.error(
        "Path To Tarkov Error: no endOfRaidCallback on EventWatcher!"
      );
    }
  }

  public onEndOfRaid(cb: EndOfRaidCallback): void {
    if (this.endOfRaidCallback) {
      throw new Error(
        "Path To Tarkov EventWatcher: endOfRaidCallback already setted!"
      );
    }

    this.endOfRaidCallback = cb;
  }

  public register(staticRoutePeeker: StaticRoutePeeker): void {
    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    this.watchStartOfRaid(staticRoutePeeker);
    this.watchSave(staticRoutePeeker);
    this.watchEndOfRaid(staticRoutePeeker);

    staticRoutePeeker.register();
  }
}
