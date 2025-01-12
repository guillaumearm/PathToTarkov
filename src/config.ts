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
  enabled?: boolean; // no longer supported
  debug?: boolean;
  debug_exfiltrations_tooltips_locale?: string;
  override_by_profiles?: OverrideByProfiles;
  bypass_keep_found_in_raid_tweak?: boolean;
  initial_offraid_position: string;
  respawn_at?: string[];
  reset_offraid_position_on_player_die: boolean;
  hideout_multistash_enabled: boolean;
  player_scav_move_offraid_position: boolean;
  vanilla_exfils_requirements?: boolean; // no longer supported
  bypass_exfils_override?: boolean;
  enable_automatic_transits_creation?: boolean;
  enable_all_vanilla_transits?: boolean;
  bypass_uninstall_procedure?: boolean; // no longer supported
  enable_run_through?: boolean;
  enable_legacy_ptt_api?: boolean;
  restrictions_in_raid: Record<string, { Value: number }>;
  offraid_regen_config: OffraidRegenConfig;
  hideout_main_stash_access_via: AccessVia;
  hideout_secondary_stashes: RawStashConfig[];
  traders_access_restriction: boolean;
  traders_config: TradersConfig;
  exfiltrations: RawExfiltrations;
  infiltrations: Infiltrations;
  infiltrations_config?: InfiltrationsConfig;
  exfiltrations_config?: ByMap<Record<ExtractName, ExfiltrationConfig>>;
  exfiltrations_tooltips_template?: string;
  transits_prompt_template?: ByLocale<string>;
  extracts_prompt_template?: ByLocale<string>;
  offraid_positions?: Record<OffraidPositionName, OffraidPositionDefinition>;
};

export type Config = Omit<
  RawConfig,
  'hideout_secondary_stashes' | 'infiltrations_config' | 'exfiltrations'
> & {
  hideout_secondary_stashes: StashConfig[];
  infiltrations_config: InfiltrationsConfig;
  exfiltrations: Exfiltrations;
};

export type UserConfig = {
  selectedConfig: string;
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
      const exfilTargets = targetsByExfil[exfilName];
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

  rawConfig.exfiltrations = prepareGroundZeroHigh(rawConfig.exfiltrations);

  Object.keys(rawConfig.infiltrations).forEach(offraidPosition => {
    rawConfig.infiltrations[offraidPosition] = prepareGroundZeroHigh(
      rawConfig.infiltrations[offraidPosition],
    );
  });

  const stashConfigs: StashConfig[] = rawConfig.hideout_secondary_stashes.map(toStashConfig);
  const infiltrationsConfig = rawConfig.infiltrations_config ?? {};
  const exfiltrations = fromRawExfiltrations(rawConfig.exfiltrations);

  const config: Config = {
    ...rawConfig,
    hideout_secondary_stashes: stashConfigs,
    infiltrations_config: infiltrationsConfig,
    exfiltrations,
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
    const userConfig: UserConfig = {
      selectedConfig: DEFAULT_SELECTED_PTT_CONFIG,
      runUninstallProcedure: false,
    };
    writeJsonFile(USER_CONFIG_PATH, userConfig);
    return userConfig;
  }

  const res: UserConfig = readJsonFile(USER_CONFIG_PATH, jsonUtil);

  if (!res.selectedConfig) {
    return {
      ...res,
      selectedConfig: DEFAULT_SELECTED_PTT_CONFIG,
    };
  }

  return res;
};
