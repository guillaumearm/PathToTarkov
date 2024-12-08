import path from 'path';
import type { Config, SpawnConfig } from '../src/config';
import { processConfig, processSpawnConfig } from '../src/config';
import { readJsonFile } from '../src/utils';
import { analyzeConfig } from '../src/config-analysis';

const loadConfig = (dirPath: string): Config => {
  return processConfig(readJsonFile(path.join(dirPath, 'config.json')));
};

const loadSpawnConfig = (config: Config): SpawnConfig => {
  return processSpawnConfig(readJsonFile('./configs/shared_player_spawnpoints.json'), config);
};

describe('PTT embedded configs', () => {
  const originalConsole = console;

  beforeEach(() => {
    global.console = require('console');
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  const testConfig = (dirPath: string) => {
    const config = loadConfig(dirPath);
    const spawnConfig = loadSpawnConfig(config);

    const { errors, warnings } = analyzeConfig(config, spawnConfig);

    if (errors.length > 0) {
      errors.forEach(err => console.error(err));
    }

    if (warnings.length > 0) {
      warnings.forEach(warn => console.warn(warn));
    }

    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(0);
  };

  it('should validate the default config', () => {
    testConfig('./configs/Default');
  });

  it('should validate the ExampleOverrideByProfiles config', () => {
    testConfig('./configs/ExampleOverrideByProfiles');
  });

  it('should validate the LegacyPathToTarkovV4 config', () => {
    testConfig('./configs/LegacyPathToTarkovV4');
  });

  it('should validate the LegacyPathToTarkovV5 config', () => {
    testConfig('./configs/LegacyPathToTarkovV5');
  });

  it('should validate the LinearPath config', () => {
    testConfig('./configs/LinearPath');
  });

  it('should validate the OriginalNarcoticsConfig config', () => {
    testConfig('./configs/OriginalNarcoticsConfig');
  });

  it('should validate the PathToTarkovReloaded config', () => {
    testConfig('./configs/PathToTarkovReloaded');
  });

  it('should validate the DevilFlippy config', () => {
    testConfig('./configs/DevilFlippy');
  });
});
