import type { StaticRoutePeeker } from './helpers';
import type { EndOfRaidPayload, PTTInstance } from './end-of-raid-controller';
import type { SaveServer } from '@spt/servers/SaveServer';

type EndOfRaidCallback = (payload: EndOfRaidPayload) => void;

type RaidCache = {
  saved: boolean;
  endOfRaid: boolean;
  sessionId: string | null;
  currentLocationName: string | null;
  exitName: string | null | undefined;
  isPlayerScav: boolean | null;
};

const createInitialRaidCache = (sessionId: string): RaidCache => ({
  saved: false,
  endOfRaid: false,
  sessionId: sessionId,
  currentLocationName: null,
  exitName: undefined,
  isPlayerScav: null,
});

export class EventWatcher {
  private raidCaches: Record<string, RaidCache>; // indexed by sessionId
  private endOfRaidCallback: EndOfRaidCallback | null = null;

  constructor(
    private ptt: PTTInstance,
    private saveServer: SaveServer,
  ) {
    this.raidCaches = {};
  }

  private cleanRaidCache(sessionId: string): void {
    delete this.raidCaches[sessionId];
  }

  private initRaidCache(sessionId: string): void {
    this.raidCaches[sessionId] = createInitialRaidCache(sessionId);
  }

  private getRaidCache(sessionId: string): RaidCache | null {
    const raidCache = this.raidCaches[sessionId];

    if (!raidCache) {
      this.ptt.logger.error(`Path To Tarkov: cannot get raidCache for '${sessionId}'`);
      return null;
    }

    return raidCache;
  }

  private watchOnGameStart(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute('/client/game/start', (url, info: unknown, sessionId) => {
      this.initRaidCache(sessionId);

      const profile = this.saveServer.getProfile(sessionId);
      const inventory = profile.characters.pmc.Inventory;

      if (!inventory) {
        this.ptt.debug(
          `/client/game/start: no pmc data found, init will be handled on profile creation`,
        );
        // no pmc data found, init will be handled by `watchOnProfileCreated`
        return;
      }

      this.ptt.pathToTarkovController.initPlayer(sessionId, false);
      this.ptt.executeOnStartAPICallbacks(sessionId);

      this.ptt.logger.info(`=> PathToTarkov: game started!`);
    });
  }

  private watchOnProfileCreated(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute('/client/game/profile/create', (url, info: unknown, sessionId) => {
      this.initRaidCache(sessionId);

      this.ptt.pathToTarkovController.initPlayer(sessionId, true);
      this.ptt.executeOnStartAPICallbacks(sessionId);

      this.ptt.logger.info(`=> PathToTarkov: pmc created!`);
    });
  }

  private watchStartOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      '/client/raid/configuration',
      (url, info: { location: string }, sessionId) => {
        this.initRaidCache(sessionId);
        const raidCache = this.getRaidCache(sessionId);

        if (!raidCache) {
          return;
        }

        raidCache.currentLocationName = info.location;
        this.ptt.debug(
          `offline raid started on location '${info.location}' with sessionId '${sessionId}'`,
        );
      },
    );
  }

  private watchSave(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      '/raid/profile/save',
      (url, info: { isPlayerScav: boolean }, sessionId: string) => {
        const raidCache = this.getRaidCache(sessionId);

        if (!raidCache) {
          return;
        }

        raidCache.saved = true;
        raidCache.isPlayerScav = info.isPlayerScav;

        this.ptt.debug(`profile saved: raidCache.isPlayerScav=${info.isPlayerScav}`);

        if (!raidCache.endOfRaid) {
          this.ptt.debug('end of raid: callback execution delayed...');
          return;
        }

        return this.runEndOfRaidCallback(sessionId);
      },
    );
  }

  private watchEndOfRaid(staticRoutePeeker: StaticRoutePeeker): void {
    staticRoutePeeker.watchRoute(
      '/client/match/offline/end',
      (url, info: { exitName: string | null }, sessionId: string) => {
        const raidCache = this.getRaidCache(sessionId);

        if (!raidCache) {
          return;
        }

        raidCache.endOfRaid = true;
        raidCache.sessionId = sessionId;
        raidCache.exitName = info.exitName;

        this.ptt.debug(`end of raid detected for exit '${info.exitName}'`);

        if (!raidCache.saved) {
          this.ptt.debug('end of raid: callback execution delayed on profile save...');
          return;
        }

        return this.runEndOfRaidCallback(sessionId);
      },
    );
  }

  private getEndOfRaidPayload(sessionId: string): EndOfRaidPayload {
    const {
      currentLocationName: locationName,
      isPlayerScav,
      exitName,
    } = this.raidCaches[sessionId];

    if (sessionId === null) {
      throw new Error('raidCache.sessionId is null');
    }

    if (locationName === null) {
      throw new Error('raidCache.currentLocationName is null');
    }

    if (isPlayerScav === null) {
      throw new Error('raidCache.isPlayerScav is null');
    }

    if (exitName === undefined) {
      throw new Error('raidCache.exitName is undefined');
    }

    return {
      sessionId,
      locationName,
      isPlayerScav,
      exitName,
    };
  }

  private runEndOfRaidCallback(sessionId: string): void {
    if (this.endOfRaidCallback) {
      try {
        const endOfRaidPayload = this.getEndOfRaidPayload(sessionId);
        this.endOfRaidCallback(endOfRaidPayload);
      } catch (error: any) {
        this.ptt.logger.error(`Path To Tarkov Error: ${error.message}`);
      } finally {
        this.cleanRaidCache(sessionId);
      }
    } else {
      this.ptt.logger.error('Path To Tarkov Error: no endOfRaidCallback on EventWatcher!');
    }
  }

  public onEndOfRaid(cb: EndOfRaidCallback): void {
    if (this.endOfRaidCallback) {
      throw new Error('Path To Tarkov EventWatcher: endOfRaidCallback already setted!');
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
