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

export const isLocalAvailable = (givenLocale: string): boolean => {
  const availableLocales: Record<string, true | undefined> = INDEXED_AVAILABLE_LOCALES;
  const locale = givenLocale.trim().toLowerCase();
  return Boolean(availableLocales[locale]);
};

export const AVAILABLE_LOCALES: string[] = Object.keys(INDEXED_AVAILABLE_LOCALES);

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
  override_tooltips_template?: string; // this one will be used only if there is no override on exfil config
  displayName?: ByLocale<string>;
};

export type ExfiltrationConfig = {
  override_tooltips_template?: string;
  displayName?: ByLocale<string>;
};

type RawConfig = {
  enabled: boolean;
  debug?: boolean;
  debug_exfiltrations_tooltips_locale?: string;
  override_by_profiles?: OverrideByProfiles;
  bypass_keep_found_in_raid_tweak?: boolean;
  initial_offraid_position: string;
  respawn_at?: string[];
  reset_offraid_position_on_player_die: boolean;
  hideout_multistash_enabled: boolean;
  player_scav_move_offraid_position: boolean;
  workbench_always_enabled: boolean;
  vanilla_exfils_requirements?: boolean; // no longer supported
  bypass_exfils_override?: boolean;
  enable_all_vanilla_transits?: boolean;
  bypass_uninstall_procedure: boolean;
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
  exfiltrations_config?: Record<ExtractName, ExfiltrationConfig>; // TODO: validate in config-analysis
  exfiltrations_tooltips_template?: string; // TODO(config-analysis): error when unknown template variable usage is found
  offraid_positions?: Record<OffraidPositionName, OffraidPositionDefinition>; // TODO: validate in config-analysis
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
export const USER_CONFIG_PATH = join(CONFIGS_DIR, 'UserConfig.json');

export const CONFIG_FILENAME = 'config.json';
export const SPAWN_CONFIG_FILENAME = 'shared_player_spawnpoints.json';

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

export const processConfig = (originalConfig: RawConfig): Config => {
  const config = deepClone(originalConfig);

  config.exfiltrations = prepareGroundZeroHigh(config.exfiltrations);

  Object.keys(config.infiltrations).forEach(offraidPosition => {
    config.infiltrations[offraidPosition] = prepareGroundZeroHigh(
      config.infiltrations[offraidPosition],
    );
  });

  const stashConfigs: StashConfig[] = config.hideout_secondary_stashes.map(toStashConfig);
  const infiltrationsConfig = config.infiltrations_config ?? {};

  return {
    ...config,
    hideout_secondary_stashes: stashConfigs,
    infiltrations_config: infiltrationsConfig,
    exfiltrations: fromRawExfiltrations(config.exfiltrations),
  };
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

export const getUserConfig = (): UserConfig => {
  if (!fileExists(USER_CONFIG_PATH)) {
    const userConfig: UserConfig = {
      selectedConfig: 'Default',
    };
    writeJsonFile(USER_CONFIG_PATH, userConfig);
    return userConfig;
  }

  return readJsonFile(USER_CONFIG_PATH);
};
