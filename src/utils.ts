import { readFileSync } from "fs";
import path from "path";
import { StringLiteralLike } from "typescript";

export type PackageJson = {
  name: string;
  displayName: string;
  version: string;
}

type SpawnPoint = {
  Position: {
    x: number,
    y: number,
    z: number,
  },
  Rotation: number,
}

type SpawnPointName = string;
type SpawnPoints = Record<SpawnPointName, SpawnPoint>;

export type SpawnPointsByMap = {
  factory4_day: SpawnPoints;
  factory4_night: SpawnPoints;
  bigmap: SpawnPoints;
  woods: SpawnPoints;
  rezervbase: SpawnPoints;
  interchange: SpawnPoints;
  shoreline: SpawnPoints;
  lighthouse: SpawnPoints;
};

type StashConfig = {
  id: string;
  size: number;
  access_via: string[];
}

type AllLocales<T> = {
  ch?: T,
  cz?: T,
  en?: T,
  "es-mx"?: T,
  es?: T,
  fr?: T,
  ge?: T,
  hu?: T,
  it?: T,
  jp?: T,
  kr?: T,
  pl?: T,
  po?: T
}

type InsuranceConfig = {
  insuranceMultiplier?: number;
  insurance_price_coef?: number;
  min_payment?: number;
  min_return_hour?: number;
  max_return_hour?: number;
  max_storage_time?: number;
}

type RepairConfig = {
  quality?: string;
  currency?: string;
  currency_coefficient?: number;
  repair_price_coef?: number;
}

type TraderConfig = {
  "disable_warning"?: boolean;
  override_description?: boolean;
  location_description?: AllLocales<string>;
  access_via: string[] | string;
  insurance_always_enabled?: boolean;
  insurance_config?: InsuranceConfig;
  repair_always_enabled?: boolean;
  repair_config?: RepairConfig;
}

export type Config = {
  enabled: boolean;
  initial_offraid_position: string;
  reset_offraid_position_on_player_die: boolean;
  hideout_multistash_enabled: boolean;
  laboratory_access_restriction: boolean;
  laboratory_access_via: string[];
  player_scav_move_offraid_position: boolean;
  workbench_always_enabled: boolean;
  bypass_exfils_override: boolean;
  bypass_uninstall_procedure: boolean;
  bypass_luas_custom_spawn_points_tweak: boolean;
  restrictions_in_raid: Record<string, { Value: number }>;
  offraid_regen_config: {
    hydration: { access_via: string[] },
    energy: { access_via: string[] },
    health: { access_via: string[] },
  },
  hideout_main_stash_access_via: string[];
  hideout_secondary_stashes: StashConfig[];
  traders_access_restriction: boolean;
  traders_config: Record<string, TraderConfig>;
}

export const readPackageJson = (): PackageJson => {
  return JSON.parse(readFileSync(path.join(__dirname, '../package.json'), 'utf-8'));
}

export const getModDisplayName = (packageJson: PackageJson, withVersion = false): string => {
  if (withVersion) {
    return `${packageJson.displayName} v${packageJson.version}`;
  }
  return `${packageJson.displayName}`;
}