import path from 'path';
import type { Config, SpawnConfig } from '../src/config';
import { processConfig, processSpawnConfig } from '../src/config';
import { readJsonFile } from '../src/utils';
import { analyzeConfig } from '../src/config-analysis';

const loadConfig = (dirPath: string): Config => {
  return processConfig(readJsonFile(path.join(dirPath, 'config.json')));
};

const loadSpawnConfig = (dirPath: string): SpawnConfig => {
  return processSpawnConfig(readJsonFile(path.join(dirPath, 'player_spawnpoints.json')));
};

describe('PTT embedded configs', () => {
  const testConfig = (dirPath: string) => {
    const config = loadConfig('./config');
    const spawnConfig = loadSpawnConfig('./config');

    const { errors, warnings } = analyzeConfig(config, spawnConfig);

    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  };

  it('should validate the default config', () => {
    testConfig('./config');
  });
});
