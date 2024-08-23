import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { Config, ConfigGetter, SpawnConfig } from './config';
import type { PathToTarkovController } from './path-to-tarkov-controller';
import { deepClone } from './utils';
import type { ConfigValidationResult } from './config-analysis';
import { analyzeConfig } from './config-analysis';

export type StartCallback = (sessionId: string) => void;

export type PathToTarkovAPI = {
  onStart(cb: StartCallback): void;
  getConfig: ConfigGetter;
  getSpawnConfig(): SpawnConfig;
  setConfig(newConfig: Config, sessionId: string): void;
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

  const api: PathToTarkovAPI = {
    onStart: (cb: StartCallback) => {
      logger.warning(warnDeprecationMessage());
      if (!cb) {
        return;
      }

      onStartCallbacks.push(cb);
    },
    getConfig: (sessionId: string) => {
      logger.warning(warnDeprecationMessage('getConfig'));

      if (!sessionId) {
        throw new Error('PTT api -> no sessionId provided');
      }

      return deepClone(controller.getConfig(sessionId));
    },
    getSpawnConfig: () => {
      logger.warning(warnDeprecationMessage('getSpawnConfig'));
      return deepClone(controller.spawnConfig);
    },
    setConfig: (newConfig: Config, sessionId: string): ConfigValidationResult => {
      logger.warning(warnDeprecationMessage('setConfig'));
      if (!sessionId) {
        throw new Error('PTT api -> no sessionId provided');
      }

      const result = analyzeConfig(newConfig, controller.spawnConfig);

      if (result.errors.length === 0) {
        controller.setConfig(newConfig, sessionId);
      }

      return result;
    },
    setSpawnConfig: (newSpawnConfig: SpawnConfig) => {
      logger.warning(warnDeprecationMessage('setSpawnConfig'));
      controller.spawnConfig = newSpawnConfig;
    },
    refresh: (sessionId: string) => {
      logger.warning(warnDeprecationMessage('refresh'));
      if (!sessionId) {
        throw new Error('PTT api -> no sessionId provided');
      }

      if (controller.getConfig(sessionId).traders_access_restriction) {
        controller.tradersController.initTraders(controller.getConfig(sessionId));
      }

      controller.initPlayer(sessionId, false);
    },
  };

  return [api, executeOnStartAPICallbacks];
};
