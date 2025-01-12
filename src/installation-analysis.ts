import path from 'path';

import { CONFIGS_DIR, SPAWN_CONFIG_FILENAME } from './config';
import { fileExists } from './utils';

export const performPathToTarkovInstallationAnalysis = (): void => {
  if (fileExists(path.join(CONFIGS_DIR, SPAWN_CONFIG_FILENAME))) {
    throw new Error(
      `Path To Tarkov Error: the file configs/${SPAWN_CONFIG_FILENAME} is not supposed to be there, please remove this file or re-install PTT`,
    );
  }
};
