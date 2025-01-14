import type { ISptProfile } from '@spt/models/eft/profile/ISptProfile';
import { join } from 'path';
import {
  deepClone,
  ensureArray,
  fileExists,
  getPTTMongoId,
  readJsonFile,
  writeJsonFile,
} from './utils';
import { parseExilTargetFromPTTConfig } from './exfils-targets';
import type { JsonUtil } from '@spt/utils/JsonUtil';

export type ByMap<T> = {
  factory4_day: T;
  factory4_night: T;
  bigmap: T;
  woods: T;
  rezervbase: T;
  interchange: T;
  shoreline: T;
  lighthouse: T;
  tarkovstreets: T;
  sandbox: T;
  sandbox_high: T;
  terminal: T;
};

type AvailableLocales<T> = {
  ch: T;
  cz: T;
  en: T;
  'es-mx': T;
  es: T;
  fr: T;
  ge: T;
  hu: T;
  it: T;
  jp: T;
  kr: T;
  pl: T;
  po: T;
  ro: T;
  ru: T;
  sk: T;
  tu: T;
};

export type ByLocale<T> = Partial<AvailableLocales<T>>;
export type ByLocaleFull<T> = AvailableLocales<T>;

export const INDEXED_AVAILABLE_LOCALES: AvailableLocales<true> = {
  ch: true,
  cz: true,
  en: true,
  'es-mx': true,
  es: true,
  fr: true,
  ge: true,
  hu: true,
  it: true,
  jp: true,
  kr: true,
  pl: true,
  po: true,
  ro: true,
  ru: true,
  sk: true,
  tu: true,
};

export const isLocaleAvailable = (givenLocale: string): boolean => {
  const availableLocales: Record<string, true | undefined> = INDEXED_AVAILABLE_LOCALES;
  const locale = givenLocale.trim().toLowerCase();
  return Boolean(availableLocales[locale]);
};

export const AVAILABLE_LOCALES: string[] = Object.keys(INDEXED_AVAILABLE_LOCALES);

export const DEFAULT_FALLBACK_LANGUAGE = 'en';

type ByProfileId<T> = Record<string, T | undefined>;

export type MapName = keyof ByMap<unknown>;

export type AccessVia = string | string[];

export type PositionXYZ = {
  x: number;
  y: number;
  z: number;
};

export type SpawnPointGenericPosition = [number, number, number] | PositionXYZ;

/**
 * shared_player_spawnpoints.json
 */
export type SpawnPoint = {
  Position: SpawnPointGenericPosition;
  Rotation: number;
};

export type SpawnConfig = ByMap<{
  [spawnPointName: string]: SpawnPoint;
}>;

/**
 * config.json
 */
export type StashConfig = {
  mongoId: string; // generated from name
  mongoGridId: string; // generated from name
  mongoTemplateId: string; // generated from name
  name: string; // should be uniq
  size: number;
  access_via: AccessVia;
};

export type RawStashConfig = {
  id: string;
  size: number;
  access_via: AccessVia;
};

export type LocaleName = keyof AvailableLocales<unknown>;

type InsuranceConfig = {
  insurance_price_coef?: number;
  min_payment?: number;
  min_return_hour?: number;
  max_return_hour?: number;
  max_storage_time?: number;
  return_chance_percent?: number;
};

type RepairConfig = {
  quality?: number;
  currency?: string;
  currency_coefficient?: number;
  repair_price_coef?: number;
};

type StaticTraderConfig = {
  disable_warning?: boolean;
  override_description?: boolean;
  location_description?: ByLocale<string>;
  insurance_always_enabled?: boolean;
  insurance_config?: InsuranceConfig;
  repair_always_enabled?: boolean;
  repair_config?: RepairConfig;
  heal_always_enabled?: boolean;
};

export type StaticTradersConfig = Record<string, StaticTraderConfig>;

type TraderConfig = StaticTraderConfig & {
  access_via: AccessVia;
};

export type TradersConfig = Record<string, TraderConfig>;

type SpawnPointName = string;
type OffraidPositionName = string;
type ExtractName = string;

type RawExfiltrations = ByMap<{
  [extractName: ExtractName]: OffraidPositionName | OffraidPositionName[];
}>;

type Exfiltrations = ByMap<{
  [extractName: ExtractName]: OffraidPositionName[];
}>;

type Infiltrations = {
  [offraidPosition: OffraidPositionName]: ByMap<SpawnPointName[]>;
};

export type OffraidRegenConfig = {
  hydration: { access_via: AccessVia };
  energy: { access_via: AccessVia };
  health: { access_via: AccessVia };
};

export type OverrideByProfiles = ByProfileId<{
  initial_offraid_position?: string;
  respawn_at?: string[];
  hideout_main_stash_access_via?: AccessVia;
}>;

export type InfiltrationsConfig = {
  additional_player_spawnpoints?: Partial<SpawnConfig>;
};

export type OffraidPositionDefinition = {
  displayName?: ByLocale<string>;
};

export type ExfiltrationConfig = {
  override_tooltips_template?: string;
  displayName?: ByLocale<string>;
};

type RawConfig = {
  initial_offraid_position: string;
  respawn_at?: string[];
  hideout_main_stash_access_via: AccessVia;
  hideout_secondary_stashes: RawStashConfig[];
  traders_config: TradersConfig;
  exfiltrations: RawExfiltrations;
  infiltrations: Infiltrations;
  infiltrations_config?: InfiltrationsConfig;
  exfiltrations_config?: ByMap<Record<ExtractName, ExfiltrationConfig>>;
  exfiltrations_tooltips_template?: string;
  transits_prompt_template?: ByLocale<string>;
  extracts_prompt_template?: ByLocale<string>;
  offraid_positions?: Record<OffraidPositionName, OffraidPositionDefinition>;
  restrictions_in_raid: Record<string, { Value: number }>;
  offraid_regen_config: OffraidRegenConfig;
  enable_automatic_transits_creation?: boolean;
  override_by_profiles?: OverrideByProfiles;
  debug_exfiltrations_tooltips_locale?: string;
  enable_legacy_ptt_api?: boolean;
  bypass_exfils_override?: boolean;
  enable_all_vanilla_transits?: boolean;
};

export type Config = Omit<
  RawConfig,
  'hideout_secondary_stashes' | 'infiltrations_config' | 'exfiltrations'
> & {
  hideout_secondary_stashes: StashConfig[];
  infiltrations_config: InfiltrationsConfig;
  exfiltrations: Exfiltrations;
};

// Warning: please impact the getUserConfig implementation when changing this type
export type UserConfig = {
  selectedConfig: string;
  gameplay: {
    multistash: boolean;
    tradersAccessRestriction: boolean;
    resetOffraidPositionOnPlayerDeath: boolean;
    playerScavMoveOffraidPosition: boolean;
    keepFoundInRaidTweak: boolean;
  };
  runUninstallProcedure?: false;
};

export type Profile = ISptProfile & {
  PathToTarkov?: {
    offraidPosition?: string;
    mainStashId?: string;
  };
};

export type ConfigGetter = (sessionId: string) => Config;

export const PACKAGE_JSON_PATH = join(__dirname, '../package.json');

export const CONFIGS_DIR = join(__dirname, '../configs');

/**
 * The `shared_player_spawnpoints.json5` file will be copied in this directory at release time.
 * This is an attempt to prevent config makers to distribute this file.
 *
 * Additional player spawnpoints should be embedded in the desired config
 */
export const DO_NOT_DISTRIBUTE_DIR = join(__dirname, '../src/do_not_distribute');

export const USER_CONFIG_PATH = join(CONFIGS_DIR, 'UserConfig.json5');
export const DEFAULT_SELECTED_PTT_CONFIG = 'Default';

export const CONFIG_FILENAME = 'config.json5';
export const SPAWN_CONFIG_FILENAME = 'shared_player_spawnpoints.json5';

export const PRAPOR_ID = '54cb50c76803fa8b248b4571';
export const FENCE_ID = '579dc571d53a0658a154fbec';
export const JAEGER_INTRO_QUEST = '5d2495a886f77425cd51e403';

export const STANDARD_STASH_ID = '566abbc34bdc2d92178b4576';

export const VANILLA_STASH_IDS = [
  STANDARD_STASH_ID, // Standard
  '5811ce572459770cba1a34ea', // Left Behind
  '5811ce662459770f6f490f32', // Prepare for escape
  '5811ce772459770e9e5f9532', // Edge of darkness
  '6602bcf19cc643f44a04274b', // Unheard
];

const DEFAULT_USER_CONFIG: UserConfig = {
  selectedConfig: DEFAULT_SELECTED_PTT_CONFIG,
  gameplay: {
    multistash: true,
    tradersAccessRestriction: true,
    resetOffraidPositionOnPlayerDeath: true,
    playerScavMoveOffraidPosition: false,
    keepFoundInRaidTweak: true,
  },
  runUninstallProcedure: false,
};

const toStashConfig = (rawStashConfig: RawStashConfig): StashConfig => {
  const name = rawStashConfig.id; // the id is actually the name (this is to avoid breaking changes in the ptt configs)
  const mongoId = getPTTMongoId(name);
  const mongoTemplateId = getPTTMongoId(`template_${name}`);
  const mongoGridId = getPTTMongoId(`grid_${name}`);

  return {
    name,
    size: rawStashConfig.size,
    access_via: rawStashConfig.access_via,
    mongoId,
    mongoTemplateId,
    mongoGridId,
  };
};

export const EMPTY_STASH = toStashConfig({
  id: 'PathToTarkov_Empty_Stash',
  size: 0,
  access_via: [], // not used but this simplify typing
});

export const SLOT_ID_HIDEOUT = 'hideout';
export const SLOT_ID_LOCKED_STASH = 'ptt_locked_stash';

export const MAPLIST = [
  'laboratory',
  'factory4_day',
  'factory4_night',
  'bigmap', // customs
  'interchange',
  'lighthouse',
  'rezervbase', // military reserve
  'shoreline',
  'woods',
  'tarkovstreets',
  'sandbox', // ground zero
  'sandbox_high', // ground zero for high level player (> 20)
  'terminal', // even if it's always locked, this is listed here in order to be able to hide the icon in the UI
];

// sandbox_high is a special map for high level players (> 20)
const prepareGroundZeroHighPartial = <T>(maps: Partial<ByMap<T>>): Partial<ByMap<T>> => {
  if (maps.sandbox && !maps.sandbox_high) {
    return {
      ...maps,
      sandbox_high: maps.sandbox,
    };
  }

  return maps;
};

const prepareGroundZeroHigh = <T>(maps: ByMap<T>): ByMap<T> => {
  return prepareGroundZeroHighPartial(maps) as ByMap<T>;
};

const fromRawExfiltrations = (rawExfiltrations: RawExfiltrations): Exfiltrations => {
  const exfiltrations: Record<string, Record<string, string[]>> = {};

  Object.keys(rawExfiltrations).forEach(mapName => {
    const targetsByExfils = rawExfiltrations[mapName as MapName] ?? {};
    exfiltrations[mapName] = {};

    Object.keys(targetsByExfils).forEach(extractName => {
      const exfilTargets = ensureArray(targetsByExfils[extractName]);
      exfiltrations[mapName][extractName] = exfilTargets;
    });
  });

  return exfiltrations as Exfiltrations;
};

// Warning: this mutate the exfiltrations config
const prepareAutomaticTransitsCreation = (config: Config): void => {
  const { infiltrations, exfiltrations } = config;

  Object.keys(exfiltrations).forEach(mapName => {
    const targetsByExfil = exfiltrations[mapName as MapName];

    Object.keys(targetsByExfil).forEach(exfilName => {
      const exfilTargets = ensureArray(targetsByExfil[exfilName]);
      const newExfilTargets: string[] = [];

      exfilTargets.forEach(exfilTarget => {
        newExfilTargets.push(exfilTarget);
        const offraidPosition = parseExilTargetFromPTTConfig(exfilTarget).targetOffraidPosition;

        if (offraidPosition && infiltrations[offraidPosition]) {
          Object.keys(infiltrations[offraidPosition]).forEach(targetMapName => {
            if (targetMapName !== mapName) {
              const spawns = infiltrations[offraidPosition][targetMapName as MapName] ?? [];
              spawns.forEach(spawnId => {
                const createdExfilTarget = `${targetMapName}.${spawnId}`;
                newExfilTargets.push(createdExfilTarget);
              });
            }
          });
        }
      });

      // to avoid duplicates
      targetsByExfil[exfilName] = [...new Set(newExfilTargets)];
    });
  });
};

export const processConfig = (originalConfig: RawConfig): Config => {
  const rawConfig = deepClone(originalConfig);

  rawConfig.infiltrations = rawConfig.infiltrations ?? {};
  rawConfig.infiltrations_config = rawConfig.infiltrations_config ?? {};
  rawConfig.exfiltrations = prepareGroundZeroHigh(rawConfig.exfiltrations ?? {});

  Object.keys(rawConfig.infiltrations).forEach(offraidPosition => {
    rawConfig.infiltrations[offraidPosition] = prepareGroundZeroHigh(
      rawConfig.infiltrations[offraidPosition],
    );

    Object.keys(rawConfig.infiltrations[offraidPosition] ?? {}).forEach(mapName => {
      const spawns = ensureArray(
        rawConfig.infiltrations[offraidPosition][mapName as MapName] ?? [],
      );
      rawConfig.infiltrations[offraidPosition][mapName as MapName] = spawns;
    });
  });

  const stashConfigs: StashConfig[] = rawConfig.hideout_secondary_stashes?.map(toStashConfig) ?? [];
  const infiltrationsConfig = rawConfig.infiltrations_config;
  const exfiltrations = fromRawExfiltrations(rawConfig.exfiltrations ?? {});

  const config: Config = {
    ...rawConfig,
    hideout_main_stash_access_via: rawConfig.hideout_main_stash_access_via ?? ['*'],
    hideout_secondary_stashes: stashConfigs,
    infiltrations_config: infiltrationsConfig,
    exfiltrations,
    offraid_regen_config: {
      ...rawConfig.offraid_regen_config,
      hydration: {
        ...rawConfig.offraid_positions?.hydration,
        access_via: [],
      },
      energy: {
        ...rawConfig.offraid_positions?.energy,
        access_via: [],
      },
      health: {
        ...rawConfig.offraid_positions?.health,
        access_via: [],
      },
    },
    traders_config: {
      ...rawConfig.traders_config,
    },
  };

  if (config.enable_automatic_transits_creation) {
    prepareAutomaticTransitsCreation(config);
  }

  return config;
};

const mergeAdditionalSpawnpoints = (
  spawnConfig: SpawnConfig,
  additionalSpawnConfig: Partial<SpawnConfig>,
): SpawnConfig => {
  const clonedSpawnConfig = deepClone(spawnConfig);

  Object.keys(additionalSpawnConfig).forEach(mapName => {
    const infilConfig = additionalSpawnConfig[mapName as MapName];
    const spawnPoints = clonedSpawnConfig[mapName as MapName];

    if (!infilConfig || !spawnPoints) {
      return;
    }

    Object.keys(infilConfig).forEach(spawnPointName => {
      const spawnPoint = infilConfig[spawnPointName];
      const spawnPoints = clonedSpawnConfig[mapName as MapName];

      if (spawnPoint) {
        spawnPoints[spawnPointName] = spawnPoint;
      }
    });
  });

  return clonedSpawnConfig;
};

export const processSpawnConfig = (spawnConfig: SpawnConfig, config: Config): SpawnConfig => {
  const additionalPlayerSpawnpoints =
    config.infiltrations_config?.additional_player_spawnpoints ?? {};

  const mergedConfig = mergeAdditionalSpawnpoints(spawnConfig, additionalPlayerSpawnpoints);
  return prepareGroundZeroHigh(mergedConfig);
};

export const getUserConfig = (jsonUtil: JsonUtil): UserConfig => {
  if (!fileExists(USER_CONFIG_PATH)) {
    const userConfig = DEFAULT_USER_CONFIG satisfies UserConfig;
    writeJsonFile(USER_CONFIG_PATH, jsonUtil, userConfig);
    return userConfig;
  }

  let needToWriteFile = false;
  const userConfig: UserConfig = deepClone(readJsonFile(USER_CONFIG_PATH, jsonUtil));

  if (!userConfig.selectedConfig) {
    userConfig.selectedConfig = DEFAULT_SELECTED_PTT_CONFIG;
    needToWriteFile = true;
  }

  if (userConfig.runUninstallProcedure === undefined) {
    userConfig.runUninstallProcedure = DEFAULT_USER_CONFIG.runUninstallProcedure;
    needToWriteFile = true;
  }

  if (!userConfig.gameplay) {
    userConfig.gameplay = DEFAULT_USER_CONFIG.gameplay;
    needToWriteFile = true;
  }

  if (userConfig.gameplay.keepFoundInRaidTweak === undefined) {
    userConfig.gameplay.keepFoundInRaidTweak = DEFAULT_USER_CONFIG.gameplay.keepFoundInRaidTweak;
    needToWriteFile = true;
  }

  if (userConfig.gameplay.multistash === undefined) {
    userConfig.gameplay.multistash = DEFAULT_USER_CONFIG.gameplay.multistash;
    needToWriteFile = true;
  }

  if (userConfig.gameplay.playerScavMoveOffraidPosition === undefined) {
    userConfig.gameplay.playerScavMoveOffraidPosition =
      DEFAULT_USER_CONFIG.gameplay.playerScavMoveOffraidPosition;
    needToWriteFile = true;
  }

  if (userConfig.gameplay.resetOffraidPositionOnPlayerDeath === undefined) {
    userConfig.gameplay.resetOffraidPositionOnPlayerDeath =
      DEFAULT_USER_CONFIG.gameplay.resetOffraidPositionOnPlayerDeath;
    needToWriteFile = true;
  }

  if (userConfig.gameplay.tradersAccessRestriction === undefined) {
    userConfig.gameplay.tradersAccessRestriction =
      DEFAULT_USER_CONFIG.gameplay.tradersAccessRestriction;
    needToWriteFile = true;
  }

  // Rewrite the file if needed

  if (needToWriteFile) {
    writeJsonFile(USER_CONFIG_PATH, jsonUtil, userConfig);
  }
  return userConfig;
};
