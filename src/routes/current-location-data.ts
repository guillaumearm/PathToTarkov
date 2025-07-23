import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

import type { MapName } from '../config';
import type { ExfilsTargets } from '../exfils-targets';
import { getExfilsTargets } from '../exfils-targets';
import { resolveMapNameFromLocation } from '../map-name-resolver';
import type { PathToTarkovController } from '../path-to-tarkov-controller';

// Warning: This type should be the same than the corresponding client type
export type CurrentLocationDataResponse = {
  readonly exfilsTargets: ExfilsTargets;
};

// Warning: This type should be the same than the corresponding client type
export type CurrentLocationDataRequest = {
  readonly locationId: string;
};

// Warning: Those should be aligned with the client
const ROUTE_NAME = 'CurrentLocationData';
const FULL_ROUTE_NAME = `/PathToTarkov/${ROUTE_NAME}`;

export const registerCurrentLocationDataRoute = (
  staticRouter: StaticRouterModService,
  pttController: PathToTarkovController,
): void => {
  staticRouter.registerStaticRouter(
    `Trap-PathToTarkov-${ROUTE_NAME}`,
    [
      {
        url: FULL_ROUTE_NAME,
        action: async (_url, info: CurrentLocationDataRequest, sessionId): Promise<string> => {
          pttController.debug(`${FULL_ROUTE_NAME} called for location "${info.locationId}"`);
          const config = pttController.getConfig(sessionId);
          const mapName = resolveMapNameFromLocation(info.locationId) as MapName;

          const locations = pttController.db.getTables().locations;
          if (!locations) {
            throw new Error('Locations table not available');
          }

          const locationKey = info.locationId.toLowerCase() as keyof typeof locations;
          const location = locations[locationKey];

          if (!location || !('base' in location) || !location.base) {
            throw new Error(`Location "${info.locationId}" not found or has no base data`);
          }

          const locationBase = location.base;

          const response: CurrentLocationDataResponse = {
            exfilsTargets: getExfilsTargets(pttController, config, mapName, locationBase),
          };

          return JSON.stringify(response);
        },
      },
    ],
    '',
  );
};
