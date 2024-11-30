import type { StaticRoutePeeker } from './helpers';
import type { EndOfRaidPayload, PTTInstance } from './end-of-raid-controller';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { IStartLocalRaidRequestData } from '@spt/models/eft/match/IStartLocalRaidRequestData';
import type { IEndLocalRaidRequestData } from '@spt/models/eft/match/IEndLocalRaidRequestData';
import type { MatchController } from '@spt/controllers/MatchController';
import type { DependencyContainer } from 'tsyringe';

type EndOfRaidCallback = (payload: EndOfRaidPayload) => void;

type RaidCache = {
  sessionId: string | null;
  currentLocationName: string | null;
  exitName: string | null | undefined;
  isPlayerScav: boolean | null;
};

const createInitialRaidCache = (sessionId: string): RaidCache => ({
  sessionId: sessionId,
  currentLocationName: null,
  exitName: undefined,
  isPlayerScav: null,
  // TODO: add the exitStatus
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
    staticRoutePeeker.watchRoute('/client/game/start', (url, data: unknown, sessionId) => {
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
    staticRoutePeeker.watchRoute('/client/game/profile/create', (url, data: unknown, sessionId) => {
      this.initRaidCache(sessionId);

      this.ptt.pathToTarkovController.initPlayer(sessionId, true);
      this.ptt.executeOnStartAPICallbacks(sessionId);

      this.ptt.logger.info(`=> PathToTarkov: pmc created!`);
    });
  }

  private watchStartOfRaid(container: DependencyContainer): void {
    container.afterResolution<MatchController>(
      'MatchController',
      (_t, result): void => {
        const matchController = Array.isArray(result) ? result[0] : result;
        const originalStartLocalRaid = matchController.startLocalRaid.bind(matchController);

        matchController.startLocalRaid = (sessionId: string, data: IStartLocalRaidRequestData) => {
          const originalResult = originalStartLocalRaid(sessionId, data);

          this.initRaidCache(sessionId);
          const raidCache = this.getRaidCache(sessionId);

          if (!raidCache) {
            this.ptt.logger.error(`no PTT raid cache found when starting the raid`);
            return originalResult;
          }

          // TODO: remove those lines ?
          this.ptt.debug(`playerSide = ${data.playerSide}`);
          this.ptt.debug(`mode = ${data.mode}`);

          // TODO: find a way to detect if it's a scav raid
          raidCache.isPlayerScav = false;
          raidCache.currentLocationName = data.location;

          this.ptt.debug(
            `offline raid started on location '${data.location}' with sessionId '${sessionId}'`,
          );

          return originalResult;
        };
      },
      { frequency: 'Always' },
    );
  }

  // private watchSave(staticRoutePeeker: StaticRoutePeeker): void {
  //   staticRoutePeeker.watchRoute(
  //     '/raid/profile/save',
  //     (url, data: { isPlayerScav: boolean }, sessionId: string) => {
  //       const raidCache = this.getRaidCache(sessionId);

  //       if (!raidCache) {
  //         return;
  //       }

  //       raidCache.saved = true;
  //       raidCache.isPlayerScav = data.isPlayerScav;

  //       this.ptt.debug(`profile saved: raidCache.isPlayerScav=${data.isPlayerScav}`);

  //       if (!raidCache.endOfRaid) {
  //         this.ptt.debug('end of raid: callback execution delayed...');
  //         return;
  //       }

  //       return this.runEndOfRaidCallback(sessionId);
  //     },
  //   );
  // }

  private watchEndOfRaid(container: DependencyContainer): void {
    container.afterResolution<MatchController>(
      'MatchController',
      (_t, result): void => {
        const matchController = Array.isArray(result) ? result[0] : result;
        const originalEndLocalRaid = matchController.endLocalRaid.bind(matchController);

        matchController.endLocalRaid = (sessionId: string, data: IEndLocalRaidRequestData) => {
          const originalResult = originalEndLocalRaid(sessionId, data);

          const raidCache = this.getRaidCache(sessionId);

          if (!raidCache) {
            this.ptt.logger.error(`no PTT raid cache found`);
            return;
          }

          raidCache.sessionId = sessionId;
          raidCache.exitName = data.results.exitName;

          const exitStatus = data.results.result;

          this.ptt.debug(
            `end of raid detected for exit '${data.results.exitName}' with status '${exitStatus}'`,
          );
          this.runEndOfRaidCallback(sessionId);

          return originalResult;
        };
      },
      { frequency: 'Always' },
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

  public register(staticRoutePeeker: StaticRoutePeeker, container: DependencyContainer): void {
    this.watchOnGameStart(staticRoutePeeker);
    this.watchOnProfileCreated(staticRoutePeeker);
    // this.watchSave(staticRoutePeeker);
    this.watchStartOfRaid(container);
    this.watchEndOfRaid(container);

    staticRoutePeeker.register();
  }
}
