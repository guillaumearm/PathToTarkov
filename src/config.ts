import { IAkiProfile } from "@spt-aki/models/eft/profile/IAkiProfile";
import { join } from "path";

type ByMap<T> = {
  factory4_day: T;
  factory4_night: T;
  bigmap: T;
  woods: T;
  rezervbase: T;
  interchange: T;
  shoreline: T;
  lighthouse: T;
};

export type MapName = keyof ByMap<unknown>;

export type AccessVia = string | string[];

export type SpawnPointGenericPosition =
  | [number, number, number]
  | {
      x: number;
      y: number;
      z: number;
    };

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
type StashConfig = {
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
  insuranceMultiplier?: number;
  insurance_price_coef?: number;
  min_payment?: number;
  min_return_hour?: number;
  max_return_hour?: number;
  max_storage_time?: number;
};

type RepairConfig = {
  quality?: string;
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
};

type SpawnPointName = string;
type ExfiltrationPoint = string;

type Exfiltrations = ByMap<{
  [spawnPointName: SpawnPointName]: ExfiltrationPoint;
}>;

type Infiltrations = {
  [exfiltrationPoint: ExfiltrationPoint]: ByMap<SpawnPointName[]>;
};

export type Config = {
  enabled: boolean;
  debug?: boolean;
  initial_offraid_position: string;
  reset_offraid_position_on_player_die: boolean;
  hideout_multistash_enabled: boolean;
  laboratory_access_restriction: boolean;
  laboratory_access_via: AccessVia;
  player_scav_move_offraid_position: boolean;
  workbench_always_enabled: boolean;
  bypass_exfils_override: boolean;
  bypass_uninstall_procedure: boolean;
  bypass_luas_custom_spawn_points_tweak?: boolean;
  restrictions_in_raid: Record<string, { Value: number }>;
  offraid_regen_config: {
    hydration: { access_via: AccessVia };
    energy: { access_via: AccessVia };
    health: { access_via: AccessVia };
  };
  hideout_main_stash_access_via: AccessVia;
  hideout_secondary_stashes: StashConfig[];
  traders_access_restriction: boolean;
  traders_config: Record<string, TraderConfig>;
  exfiltrations: Exfiltrations;
  infiltrations: Infiltrations;
};

export type Profile = IAkiProfile & {
  PathToTarkov?: {
    mainStashId?: string;
    offraidPosition?: string;
  };
};

export type ConfigGetter = () => Config;

export const PACKAGE_JSON_PATH = join(__dirname, "../package.json");
export const CONFIG_PATH = join(__dirname, "../config/config.json");
export const SPAWN_CONFIG_PATH = join(
  __dirname,
  "../config/player_spawnpoints.json"
);

export const PRAPOR_ID = "54cb50c76803fa8b248b4571";
export const JAEGER_ID = "5c0647fdd443bc2504c2d371";
export const JAEGER_INTRO_QUEST = "5d2495a886f77425cd51e403";

export const STASH_IDS = [
  "566abbc34bdc2d92178b4576", // Standard
  "5811ce572459770cba1a34ea", // Left Behind
  "5811ce662459770f6f490f32", // Prepare for escape
  "5811ce772459770e9e5f9532", // Edge of darkness
];

export const EMPTY_STASH_ID = "PathToTarkov_Empty_Stash";

export const MAPLIST = [
  "laboratory",
  "factory4_day",
  "factory4_night",
  "bigmap", // customs
  "interchange",
  "lighthouse",
  "rezervbase",
  "shoreline",
  "woods",
];
