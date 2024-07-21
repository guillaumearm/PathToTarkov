import type { Config, SpawnConfig } from "./config";
import type { PathToTarkovController } from "./path-to-tarkov-controller";
import { deepClone } from "./utils";

export type StartCallback = (sessionId: string) => void;

export type PathToTarkovAPI = {
  onStart(cb: StartCallback): void;
  getConfig(): Config;
  getSpawnConfig(): SpawnConfig;
  setConfig(newConfig: Config): void;
  setSpawnConfig(newSpawnConfig: SpawnConfig): void;
  refresh(sessionId: string): void;
};

export const createPathToTarkovAPI = (
  controller: PathToTarkovController,
): [PathToTarkovAPI, (sessionId: string) => void] => {
  let onStartCallbacks: StartCallback[] = [];

  const executeOnStartAPICallbacks = (sessionId: string): void => {
    onStartCallbacks.forEach((cb) => cb(sessionId));
    onStartCallbacks = [];
  };

  const api = {
    onStart: (cb: StartCallback) => {
      if (!cb) {
        return;
      }

      onStartCallbacks.push(cb);
    },
    getConfig: () => deepClone(controller.config),
    getSpawnConfig: () => deepClone(controller.spawnConfig),
    setConfig: (newConfig: Config) => {
      controller.config = newConfig;
    },
    setSpawnConfig: (newSpawnConfig: SpawnConfig) => {
      controller.spawnConfig = newSpawnConfig;
    },
    refresh: (sessionId: string) => {
      controller.initExfiltrations();

      if (controller.config.traders_access_restriction) {
        controller.tradersController.initTraders();
      }

      controller.init(sessionId);
    },
  };

  return [api, executeOnStartAPICallbacks];
};
