import type { MapName } from './config';
import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { PathToTarkovController } from './path-to-tarkov-controller';
import { resolveMapNameFromLocation } from './map-name-resolver';
import type { DependencyContainer } from 'tsyringe';

export type EndOfRaidPayload = {
  sessionId: string;
  locationName: string;
  exitName: string | null;
  newOffraidPosition: string | null; // null when in transit
  isPlayerScav: boolean;
  isTransit: boolean;
};

export type PTTInstance = {
  readonly container: DependencyContainer;
  readonly pathToTarkovController: PathToTarkovController;
  readonly executeOnStartAPICallbacks: (sessionId: string) => void;
  readonly logger: ILogger;
  readonly debug: (data: string) => void;
};

export class EndOfRaidController {
  constructor(private ptt: PTTInstance) {}

  public end(payload: EndOfRaidPayload): void {
    const { sessionId, locationName, exitName, newOffraidPosition, isPlayerScav, isTransit } =
      payload;

    const mapName = resolveMapNameFromLocation(locationName) as MapName;
    if (!mapName) {
      this.ptt.logger.error(
        `Path To Tarkov Error: cannot resolve map name from location '${locationName}'`,
      );
      return;
    }

    if (isPlayerScav && !this.ptt.pathToTarkovController.isScavMoveOffraidPosition(sessionId)) {
      this.ptt.debug('end of raid: scav player detected, pmc offraid position not changed');
      return;
    }

    this.ptt.debug(`end of raid: exitName='${exitName}' and currentMapName='${mapName}'`);

    const playerIsDead = !exitName;

    if (playerIsDead) {
      this.ptt.debug('end of raid: player dies');
      this.ptt.pathToTarkovController.onPlayerDies(sessionId);
      return;
    }

    if (newOffraidPosition) {
      this.ptt.pathToTarkovController.onPlayerExtracts({
        sessionId,
        mapName,
        newOffraidPosition,
        isPlayerScav,
      });

      this.ptt.debug(`end of raid: new offraid position ${newOffraidPosition}`);
    } else if (isTransit) {
      this.ptt.debug(`end of raid: transit detected`);
    } else {
      this.ptt.logger.warning(`end of raid: no offraid position found`);
    }
  }
}
