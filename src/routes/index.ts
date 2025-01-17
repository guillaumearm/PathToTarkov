import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';
import type { PathToTarkovController } from 'src/path-to-tarkov-controller';

import { registerCurrentLocationDataRoute } from './current-location-data';
import { registerVersionRoute } from './version';

export const registerCustomRoutes = (
  staticRouter: StaticRouterModService,
  pttController: PathToTarkovController,
): void => {
  registerCurrentLocationDataRoute(staticRouter, pttController);
  registerVersionRoute(staticRouter, {
    uninstalled: false,
    fullVersion: pttController.getFullVersion(),
  });
};
