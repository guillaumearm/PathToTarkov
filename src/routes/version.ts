import type { StaticRouterModService } from '@spt/services/mod/staticRouter/StaticRouterModService';

// Warning: This type should be the same than the corresponding client type
type VersionResponse = {
  readonly fullVersion: string;
  readonly uninstalled: boolean; // when mod is present but uninstalled
};

// Warning: This should be aligned with the client
const ROUTE_NAME = 'Version';
const FULL_ROUTE_NAME = `/PathToTarkov/${ROUTE_NAME}`;

export const registerVersionRoute = (
  staticRouter: StaticRouterModService,
  { uninstalled, fullVersion }: { uninstalled: boolean; fullVersion: string },
): void => {
  staticRouter.registerStaticRouter(
    `Trap-PathToTarkov-${ROUTE_NAME}`,
    [
      {
        url: FULL_ROUTE_NAME,
        action: async (_url, _info: unknown, _sessionId: string): Promise<string> => {
          const response: VersionResponse = {
            fullVersion,
            uninstalled,
          };
          return JSON.stringify(response);
        },
      },
    ],
    '',
  );
};
