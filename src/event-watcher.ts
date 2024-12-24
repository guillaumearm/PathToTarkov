import type { StaticRoutePeeker } from './helpers';
import type { EndOfRaidPayload, PTTInstance } from './end-of-raid-controller';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { IStartLocalRaidRequestData } from '@spt/models/eft/match/IStartLocalRaidRequestData';
import type { IEndLocalRaidRequestData } from '@spt/models/eft/match/IEndLocalRaidRequestData';
import type { MatchController } from '@spt/controllers/MatchController';
import type { DependencyContainer } from 'tsyringe';
import type { ILocationBase } from '@spt/models/eft/common/ILocationBase';
import { deepClone } from './utils';
import type { MatchCallbacks } from '@spt/callbacks/MatchCallbacks';
import type { ExitStatus } from '@spt/models/enums/ExitStatis';
import { parseExfilTargetFromExitName, parseExilTargetFromPTTConfig } from './exfils-targets';
import { resolveMapNameFromLocation } from './map-name-resolver';
import type { MapName } from './config';

type EndOfRaidCallback = (payload: EndOfRaidPayload) => void;

export type RaidCache = {
  sessionId: string | null;
  currentLocationName: string | null;
  exitName: string | null | undefined;
  targetOffraidPosition: string | null; // used by extracts only
  transitTargetMapName: string | null; // used by transits only
  transitTargetSpawnPointId: string | null; // used by transits only
  isPlayerScav: boolean | null;
  exitStatus: ExitStatus | null;
};

const createInitialRaidCache = (sessionId: string): RaidCache => ({
  sessionId: sessionId,
  currentLocationName: null,
  exitName: undefined,
  targetOffraidPosition: null,
  transitTargetMapName: null,
  transitTargetSpawnPointId: null,
  isPlayerScav: null,
  exitStatus: null,
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

  private initRaidCache(sessionId: string): void {
    const existingRaidCache = this.raidCaches[sessionId];

    // raid cache is not resetted when player is in a map transit
    if (existingRaidCache && existingRaidCache.exitStatus === 'Transit') {
      return;
    }

    this.raidCaches[sessionId] = createInitialRaidCache(sessionId);
  }

  public getRaidCache(sessionId: string): RaidCache | null {
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
          const result = deepClone(originalStartLocalRaid(sessionId, data));
          const locationBase: ILocationBase = result.locationLoot;
          this.ptt.pathToTarkovController.syncLocationBase(locationBase, sessionId);

          this.initRaidCache(sessionId);
          const raidCache = this.getRaidCache(sessionId);

          if (!raidCache) {
            this.ptt.logger.error(`no PTT raid cache found when starting the raid`);
            return result;
          }

          // void data.mode; // => "PVE_OFFLINE"
          // void data.playerSide; // => "Pmc" | "Savage"
          raidCache.isPlayerScav = data.playerSide === 'Savage';
          raidCache.currentLocationName = data.location;

          this.ptt.debug(
            `offline raid started on location '${data.location}' with sessionId '${sessionId}'`,
          );

          return result;
        };
      },
      { frequency: 'Always' },
    );
  }

  private watchEndOfRaid(container: DependencyContainer): void {
    container.afterResolution<MatchCallbacks>(
      'MatchCallbacks',
      (_t, result): void => {
        const matchCallbacks = Array.isArray(result) ? result[0] : result;
        const originalEndLocalRaid = matchCallbacks.endLocalRaid.bind(matchCallbacks);

        matchCallbacks.endLocalRaid = (
          url: string,
          data: IEndLocalRaidRequestData,
          sessionId: string,
        ) => {
          const result = originalEndLocalRaid(url, data, sessionId);

          const raidCache = this.getRaidCache(sessionId);
          if (!raidCache) {
            this.ptt.logger.error(`no PTT raid cache found`);
            return result;
          }

          raidCache.sessionId = sessionId;
          raidCache.exitStatus = data.results.result;

          const parsedExfilTarget = parseExfilTargetFromExitName(data.results.exitName ?? '');

          raidCache.exitName = parsedExfilTarget.exitName;
          raidCache.targetOffraidPosition = parsedExfilTarget.targetOffraidPosition;
          raidCache.transitTargetMapName = parsedExfilTarget.transitTargetMapName;
          raidCache.transitTargetSpawnPointId = parsedExfilTarget.transitTargetSpawnPointId;

          this.ptt.debug(
            `end of raid detected for exit '${raidCache.exitName}' with status '${raidCache.exitStatus}'`,
          );
          this.runEndOfRaidCallback(sessionId);

          return result;
        };
      },
      { frequency: 'Always' },
    );
  }

  private getEndOfRaidPayload(sessionId: string): EndOfRaidPayload {
    const {
      currentLocationName,
      isPlayerScav,
      exitName,
      targetOffraidPosition,
      transitTargetMapName,
      transitTargetSpawnPointId,
    } = this.raidCaches[sessionId];

    if (sessionId === null) {
      throw new Error('raidCache.sessionId is null');
    }

    if (currentLocationName === null) {
      throw new Error('raidCache.currentLocationName is null');
    }

    if (isPlayerScav === null) {
      throw new Error('raidCache.isPlayerScav is null');
    }

    if (exitName === undefined) {
      throw new Error('raidCache.exitName is undefined');
    }

    if (targetOffraidPosition && transitTargetMapName && transitTargetSpawnPointId) {
      throw new Error('raidCache cannot determine if we are in transit or extract');
    }

    if (transitTargetMapName && !transitTargetSpawnPointId) {
      throw new Error('raidCache.transitTargetSpawnPointId is null');
    }

    if (!transitTargetMapName && transitTargetSpawnPointId) {
      throw new Error('raidCache.transitTargetMapName is null');
    }

    // This part is here to handle regular extracts when Interactable Exfils API is not installed
    let newOffraidPosition = targetOffraidPosition;
    let isTransit = !targetOffraidPosition;

    if (exitName && !targetOffraidPosition && !transitTargetMapName && !transitTargetSpawnPointId) {
      isTransit = false;

      const mapName = resolveMapNameFromLocation(currentLocationName) as MapName;
      const config = this.ptt.pathToTarkovController.getConfig(sessionId);

      const exfilTargets = config.exfiltrations[mapName]?.[exitName] ?? [];

      const foundOffraidPosition = exfilTargets.find(exfilTarget =>
        Boolean(parseExilTargetFromPTTConfig(exfilTarget).targetOffraidPosition),
      );

      if (!foundOffraidPosition) {
        throw new Error(
          `cannot determine offraid position from config for map "${mapName}" using extract "${exitName}"`,
        );
      }

      newOffraidPosition = foundOffraidPosition;

      this.ptt.logger.warning(
        `Path To Tarkov: new offraid position automatically determined from config for map "${mapName}" using extract "${exitName}"`,
      );
    }

    return {
      sessionId,
      locationName: currentLocationName,
      isPlayerScav,
      exitName,
      newOffraidPosition,
      isTransit,
    };
  }

  private runEndOfRaidCallback(sessionId: string): void {
    if (this.endOfRaidCallback) {
      try {
        const endOfRaidPayload = this.getEndOfRaidPayload(sessionId);
        this.endOfRaidCallback(endOfRaidPayload);
      } catch (error: any) {
        this.ptt.logger.error(`Path To Tarkov Error: ${error.message}`);
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
    this.watchStartOfRaid(container);
    this.watchEndOfRaid(container);

    staticRoutePeeker.register();
  }
}
