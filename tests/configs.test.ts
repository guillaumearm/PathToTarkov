import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import type { Config, SpawnConfig } from '../src/config';
import { processConfig, processSpawnConfig } from '../src/config';
import { readJsonFile } from '../src/utils';
import { analyzeConfig } from '../src/config-analysis';
import { CONFIG_FILENAME, SPAWN_CONFIG_FILENAME, CONFIGS_DIR } from '../src/config';
import { ExfilsTooltipsTemplater } from '../src/services/ExfilsTooltipsTemplater';

const SHARED_PLAYER_SPAWNPOINTS_NAME = SPAWN_CONFIG_FILENAME;

const loadConfigs = (
  dirPath: string,
  rawSpawnConfig: SpawnConfig,
): { config: Config; spawnConfig: SpawnConfig } => {
  const config = processConfig(readJsonFile(path.join(dirPath, CONFIG_FILENAME)));
  const spawnConfig = processSpawnConfig(rawSpawnConfig, config);
  return { config, spawnConfig };
};

const getDirectories = (source: string) =>
  readdirSync(source, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

describe('PTT embedded configs', () => {
  const rawSpawnConfig: SpawnConfig = readJsonFile(
    path.join(CONFIGS_DIR, SHARED_PLAYER_SPAWNPOINTS_NAME),
  );

  const enLocales: Record<string, string> = JSON.parse(
    readFileSync('./external-resources/locales_global_en.json').toString(),
  );

  const originalConsole = console;

  beforeEach(() => {
    global.console = require('console');
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  void getDirectories(CONFIGS_DIR).forEach(configName => {
    describe(`${configName} config`, () => {
      const configPath = path.join(CONFIGS_DIR, configName);
      const { config, spawnConfig } = loadConfigs(configPath, rawSpawnConfig);
      const { errors, warnings } = analyzeConfig(config, spawnConfig);

      test(`no error detected during config analysis`, () => {
        expect(errors).toHaveLength(0);
      });

      test(`no warning detected during config analysis`, () => {
        expect(warnings).toHaveLength(0);
      });

      test(`exfils tooltips are rendered without any error (english locale)`, () => {
        const allLocales = { en: enLocales };
        const templater = new ExfilsTooltipsTemplater(allLocales);

        const localeValues = templater.debugTooltipsForLocale('en', config);

        const localeKeysWithErrors = Object.entries(localeValues)
          .filter(([_key, val]) => val.startsWith(ExfilsTooltipsTemplater.ERROR_NO_EXFIL))
          .map(([key]) => key);

        expect(localeKeysWithErrors).toHaveLength(0);
      });
    });
  });
});
