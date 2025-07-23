import type { Config, MapName, UserConfig } from './config';
import { checkAccessVia, isWildcardAccessVia } from './helpers';
import {
  isSameMap,
  resolveLocationIdFromMapName,
  resolveMapNameFromLocation,
} from './map-name-resolver';
import type { PathToTarkovController } from './path-to-tarkov-controller';
import type { TradersController } from './traders-controller';

// Warning: This type should be the same than the corresponding client type
export type ExfilTarget = {
  // used for exfils
  readonly exitName: string;
  readonly isTransit: boolean;
  readonly transitMapId: string; // transit only
  readonly transitSpawnPointId: string; // transit only
  readonly offraidPosition: string; // empty on transit

  // for extract tooltips display
  readonly nextMaps: string[];
  readonly nextTraders: string[];
};

// Warning: This type should be the same than the corresponding client type
export type ExfilsTargets = {
  [exitName: string]: ExfilTarget[];
};

import type { ILocationBase } from '@spt/models/eft/common/ILocationBase';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { ALL_DUMPED_EXFILS_FROM_SCRIPT } from './_generated/all-vanilla-exfils';

export const getExfilsTargets = (
  pttController: PathToTarkovController,
  config: Config,
  mapName: MapName,
  locationBase: ILocationBase,
): ExfilsTargets => {
  const result: ExfilsTargets = {};

  const exfilsConfig = config.exfiltrations[mapName];
  if (!exfilsConfig) {
    return result;
  }

  const userConfig = pttController.getUserConfig();

  // Get all extracts including Scav ones from external resources
  const allExtracts = getAllExtractsFromExternalResources(mapName);

  // Debug logging
  const baseExtracts = locationBase.exits.map(exit => exit.Name);
  const scavExtracts = allExtracts.filter(name => !baseExtracts.includes(name));
  if (scavExtracts.length > 0) {
    pttController.debug(
      `Found ${scavExtracts.length} additional Scav extracts for ${mapName}: ${scavExtracts.join(', ')}`,
    );
  }

  void allExtracts.forEach(exfilName => {
    const targets = (exfilsConfig[exfilName] || []).map<ExfilTarget>(targetValue => {
      const parsed = parseExilTargetFromPTTConfig(targetValue);

      return {
        exitName: exfilName,
        isTransit: Boolean(parsed.transitTargetMapName),
        offraidPosition: parsed.targetOffraidPosition ?? '',
        transitMapId: resolveLocationIdFromMapName(parsed.transitTargetMapName ?? ''),
        transitSpawnPointId: parsed.transitTargetSpawnPointId ?? '',
        nextMaps: getNextMaps(config, parsed, mapName),
        nextTraders: getNextTraders(pttController.tradersController, config, userConfig, parsed),
      };
    });

    if (targets.length > 0) {
      result[exfilName] = targets;
    }
  });

  return result;
};

const getNextMaps = (
  config: Config,
  parsedExfilTarget: ParsedExfilTarget,
  currentMapName: string,
): string[] => {
  const transitMapName = parsedExfilTarget.transitTargetMapName;
  const offraidPosition = parsedExfilTarget.targetOffraidPosition;

  if (transitMapName) {
    if (
      isSameMap(currentMapName, transitMapName) ||
      transitMapName === 'sandbox_high' ||
      transitMapName === 'factory4_night'
    ) {
      return [];
    }

    return [resolveLocationIdFromMapName(transitMapName)];
  }

  if (offraidPosition) {
    const locationIds = Object.keys(config.infiltrations[offraidPosition] ?? {})
      .filter(
        mapName =>
          mapName !== 'sandbox_high' &&
          mapName !== 'factory4_night' &&
          !isSameMap(currentMapName, mapName),
      )
      .map(resolveLocationIdFromMapName);

    return locationIds;
  }

  return ['PTT_ERROR_GET_NEXT_MAPS'];
};

const getNextTraders = (
  tradersController: TradersController,
  config: Config,
  userConfig: UserConfig,
  parsedExfilTarget: ParsedExfilTarget,
): string[] => {
  if (!userConfig.gameplay.tradersAccessRestriction) {
    return [];
  }

  if (parsedExfilTarget.transitTargetMapName) {
    return [];
  }

  const offraidPosition = parsedExfilTarget.targetOffraidPosition;
  if (offraidPosition) {
    const traderIds: string[] = Object.keys(config.traders_config).filter(traderId => {
      const traderConfig = config.traders_config[traderId];

      // do not show traders that are not installed
      if (!tradersController.isTraderInstalled(traderId)) {
        return false;
      }

      // do not show traders that are always enabled
      if (isWildcardAccessVia(traderConfig.access_via)) {
        return false;
      }

      // show accessible traders
      if (checkAccessVia(traderConfig.access_via, offraidPosition)) {
        return true;
      }

      // do not show the other traders
      return false;
    });

    return traderIds;
  }

  return ['PTT_ERROR_GET_NEXT_TRADERS'];
};

type ParsedExfilTarget = {
  targetOffraidPosition: string | null; // is null on transit
  transitTargetMapName: string | null;
  transitTargetSpawnPointId: string | null;
};

/**
 * @param compoundExfilName e.g. "Gate 3.MY_OFFRAID_POSITION" for extract and "Gate 3.bigmap.MY_SPAWN_POINT" for transit
 */
export const parseExfilTargetFromExitName = (
  compoundExfilName: string,
): ParsedExfilTarget & { exitName: string | null } => {
  const splitted = compoundExfilName.split('.');

  if (splitted.length === 0) {
    return {
      exitName: null,
      targetOffraidPosition: null,
      transitTargetMapName: null,
      transitTargetSpawnPointId: null,
    };
  }

  const exitName = splitted[0];

  if (splitted.length === 1) {
    return {
      exitName,
      targetOffraidPosition: null,
      transitTargetMapName: null,
      transitTargetSpawnPointId: null,
    };
  }

  if (splitted.length === 2) {
    const offraidPosition = splitted[1];
    return {
      exitName,
      targetOffraidPosition: offraidPosition,
      transitTargetMapName: null,
      transitTargetSpawnPointId: null,
    };
  }

  const locationId = resolveMapNameFromLocation(splitted[1]);
  const spawnPointId = splitted[2];

  return {
    exitName,
    targetOffraidPosition: null,
    transitTargetMapName: locationId,
    transitTargetSpawnPointId: spawnPointId,
  };
};

// Helper function to get all extracts including Scav ones from external resources
const getAllExtractsFromExternalResources = (mapName: string): string[] => {
  try {
    const externalResourcesPath = path.join(
      __dirname,
      '..',
      'external-resources',
      'maps',
      `${mapName}_allExtracts.json`,
    );

    if (fs.existsSync(externalResourcesPath)) {
      const extractsData = JSON.parse(fs.readFileSync(externalResourcesPath, 'utf8'));
      return extractsData.map((exit: any) => exit.Name);
    }
  } catch (error) {
    // Fall back to generated data if external resources not available
  }

  // Fall back to using the generated all exfils data with aliases
  const ALL_EXFILS: Record<string, string[]> = {
    ...ALL_DUMPED_EXFILS_FROM_SCRIPT,
    bigmap: ALL_DUMPED_EXFILS_FROM_SCRIPT.customs,
    rezervbase: ALL_DUMPED_EXFILS_FROM_SCRIPT.reserve,
    factory4_day: ALL_DUMPED_EXFILS_FROM_SCRIPT.factory,
    factory4_night: ALL_DUMPED_EXFILS_FROM_SCRIPT.factory,
    tarkovstreets: ALL_DUMPED_EXFILS_FROM_SCRIPT.streets,
    sandbox: ALL_DUMPED_EXFILS_FROM_SCRIPT.groundzero,
    sandbox_high: ALL_DUMPED_EXFILS_FROM_SCRIPT.groundzero,
  };

  return ALL_EXFILS[mapName] || [];
};

/**
 * @param exfilTargetFromConfig e.g. "MY_OFFRAID_POSITION" for extract and "bigmap.MY_SPAWN_POINT" for transit
 */
export const parseExilTargetFromPTTConfig = (exfilTargetFromConfig: string): ParsedExfilTarget => {
  const splitted = exfilTargetFromConfig.split('.');

  if (splitted.length === 0) {
    return {
      targetOffraidPosition: null,
      transitTargetMapName: null,
      transitTargetSpawnPointId: null,
    };
  }

  if (splitted.length === 1) {
    return {
      targetOffraidPosition: splitted[0],
      transitTargetMapName: null,
      transitTargetSpawnPointId: null,
    };
  }

  return {
    targetOffraidPosition: null,
    transitTargetMapName: splitted[0],
    transitTargetSpawnPointId: splitted[1],
  };
};
