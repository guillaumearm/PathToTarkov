import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { Config, SpawnConfig } from './config';
import type { PathToTarkovController } from './path-to-tarkov-controller';
import { deepClone } from './utils';

export type StartCallback = (sessionId: string) => void;

export type PathToTarkovAPI = {
  onStart(cb: StartCallback): void;
  getConfig(): Config;
  getSpawnConfig(): SpawnConfig;
  setConfig(newConfig: Config): void;
  setSpawnConfig(newSpawnConfig: SpawnConfig): void;
  refresh(sessionId: string): void;
};

const warnDeprecationMessage = (methodName?: string) =>
  `PathToTarkovAPI${methodName ? '.' + methodName : ''} is used and can cause several issues during your openworld experience.`;

// This is deprecated since PTT 5.2.0
export const createPathToTarkovAPI = (
  controller: PathToTarkovController,
  logger: ILogger,
): [PathToTarkovAPI, (sessionId: string) => void] => {
  let onStartCallbacks: StartCallback[] = [];

  const executeOnStartAPICallbacks = (sessionId: string): void => {
    onStartCallbacks.forEach(cb => cb(sessionId));
    onStartCallbacks = [];
  };

  const api = {
    onStart: (cb: StartCallback) => {
      logger.warning(warnDeprecationMessage());
      if (!cb) {
        return;
      }

      onStartCallbacks.push(cb);
    },
    getConfig: () => deepClone(controller.getConfig()),
    getSpawnConfig: () => deepClone(controller.spawnConfig),
    setConfig: (newConfig: Config) => {
      logger.warning(warnDeprecationMessage('setConfig'));
      controller.setConfig(newConfig);
    },
    setSpawnConfig: (newSpawnConfig: SpawnConfig) => {
      logger.warning(warnDeprecationMessage('setSpawnConfig'));
      controller.spawnConfig = newSpawnConfig;
    },
    refresh: (sessionId: string) => {
      logger.warning(warnDeprecationMessage('refresh'));

      if (controller.getConfig().traders_access_restriction) {
        controller.tradersController.initTraders();
      }

      controller.initPlayer(sessionId, false);
    },
  };

  return [api, executeOnStartAPICallbacks];
};
