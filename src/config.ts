import type { ISptProfile } from "@spt/models/eft/profile/ISptProfile";
import { join } from "path";
import { deepClone } from "./utils";

type ByMap<T> = {
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
};

export type MapName = keyof ByMap<unknown>;

export type AccessVia = string | string[];

export type PositionXYZ = {
  x: number;
  y: number;
  z: number;
};

export type SpawnPointGenericPosition = [number, number, number] | PositionXYZ;

/**
 * player_spawnpoints.json
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
  id: string;
  size: number;
  access_via: AccessVia;
};

type AllLocales<T> = {
  ch?: T;
  cz?: T;
  en?: T;
  "es-mx"?: T;
  es?: T;
  fr?: T;
  ge?: T;
  hu?: T;
  it?: T;
  jp?: T;
  kr?: T;
  pl?: T;
  po?: T;
};

export type LocaleName = keyof AllLocales<unknown>;

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

type TraderConfig = {
  disable_warning?: boolean;
  override_description?: boolean;
  location_description?: AllLocales<string>;
  access_via: AccessVia;
  insurance_always_enabled?: boolean;
  insurance_config?: InsuranceConfig;
  repair_always_enabled?: boolean;
  repair_config?: RepairConfig;
  heal_always_enabled?: boolean;
};

type SpawnPointName = string;
type OffraidPosition = string;

type Exfiltrations = ByMap<{
  [spawnPointName: SpawnPointName]: OffraidPosition;
}>;

type Infiltrations = {
  [exfiltrationPoint: OffraidPosition]: ByMap<SpawnPointName[]>;
};

export type OffraidRegenConfig = {
  hydration: { access_via: AccessVia };
  energy: { access_via: AccessVia };
  health: { access_via: AccessVia };
};

export type Config = {
  enabled: boolean;
  debug?: boolean;
  bypass_keep_found_in_raid_tweak?: boolean;
  initial_offraid_position: string;
  reset_offraid_position_on_player_die: boolean;
  hideout_multistash_enabled: boolean;
  player_scav_move_offraid_position: boolean;
  workbench_always_enabled: boolean;
  vanilla_exfils_requirements?: boolean;
  bypass_exfils_override?: boolean;
  bypass_uninstall_procedure: boolean;
  enable_run_through?: boolean;
  enable_legacy_ptt_api?: boolean;
  restrictions_in_raid: Record<string, { Value: number }>;
  offraid_regen_config: OffraidRegenConfig;
  hideout_main_stash_access_via: AccessVia;
  hideout_secondary_stashes: StashConfig[];
  traders_access_restriction: boolean;
  traders_config: Record<string, TraderConfig>;
  exfiltrations: Exfiltrations;
  infiltrations: Infiltrations;
};

export type PathToTarkovReloadedTooltipsConfig = {
  language?: string;
  moddedTraderCompat?: boolean;
  additionalLocalesToggle?: boolean;
  moddedTraderExtracts?: string[];
  localesToChangeAdditional?: string[];
  localesToChange?: string[];
};

export type Profile = ISptProfile & {
  PathToTarkov?: {
    offraidPosition?: string;
    mainStashId?: string;
  };
};

export type ConfigGetter = () => Config;

export const PACKAGE_JSON_PATH = join(__dirname, "../package.json");
export const CONFIG_PATH = join(__dirname, "../config/config.json");
export const SPAWN_CONFIG_PATH = join(
  __dirname,
  "../config/player_spawnpoints.json",
);

export const PRAPOR_ID = "54cb50c76803fa8b248b4571";
export const FENCE_ID = "579dc571d53a0658a154fbec";
export const JAEGER_ID = "5c0647fdd443bc2504c2d371";
export const JAEGER_INTRO_QUEST = "5d2495a886f77425cd51e403";

export const STANDARD_STASH_ID = "566abbc34bdc2d92178b4576";

export const VANILLA_STASH_IDS = [
  STANDARD_STASH_ID, // Standard
  "5811ce572459770cba1a34ea", // Left Behind
  "5811ce662459770f6f490f32", // Prepare for escape
  "5811ce772459770e9e5f9532", // Edge of darkness
  "6602bcf19cc643f44a04274b", // Unheard
];

export const EMPTY_STASH: Omit<StashConfig, "access_via"> = {
  id: "PathToTarkov_Empty_Stash",
  size: 0,
};

export const MAPLIST = [
  "laboratory",
  "factory4_day",
  "factory4_night",
  "bigmap", // customs
  "interchange",
  "lighthouse",
  "rezervbase", // military reserve
  "shoreline",
  "woods",
  "tarkovstreets",
  "sandbox", // ground zero
  "sandbox_high", // ground zero for high level player (> 20)
];

// sandbox_high is a special map for high level players (> 20)
export const prepareGroundZeroHigh = <T>(maps: ByMap<T>): ByMap<T> => {
  if (maps.sandbox && !maps.sandbox_high) {
    return {
      ...maps,
      sandbox_high: maps.sandbox,
    };
  }

  return maps;
};

export const processConfig = (originalConfig: Config): Config => {
  const config = deepClone(originalConfig);

  config.exfiltrations = prepareGroundZeroHigh(config.exfiltrations);

  Object.keys(config.infiltrations).forEach((offraidPosition) => {
    config.infiltrations[offraidPosition] = prepareGroundZeroHigh(
      config.infiltrations[offraidPosition],
    );
  });

  return config;
};

export const processSpawnConfig = (spawnConfig: SpawnConfig): SpawnConfig => {
  return prepareGroundZeroHigh(spawnConfig);
};
