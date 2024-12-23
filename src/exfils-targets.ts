import type { Config, MapName } from './config';
import { resolveLocationIdFromMapName, resolveMapNameFromLocation } from './map-name-resolver';
import { ensureArray } from './utils';

// Warning: This type should be the same than the corresponding client type
export type ExfilTarget = {
  isTransit: boolean;
  transitMapId: string; // transit only
  transitSpawnPointId: string; // transit only
  offraidPosition: string; // empty on transit
};

// Warning: This type should be the same than the corresponding client type
export type ExfilsTargets = {
  [exitName: string]: ExfilTarget[];
};

// Warning: This type should be the same than the corresponding client type
export type ExfilsTargetsResponse = {
  data: ExfilsTargets;
};

// Warning: This type should be the same than the corresponding client type
export type ExfilsTargetsRequest = {
  locationId: string;
};

export const getExfilsTargets = (config: Config, mapName: MapName): ExfilsTargetsResponse => {
  const response: ExfilsTargetsResponse = {
    data: {},
  };

  const exfilsConfig = config.exfiltrations[mapName];
  if (!exfilsConfig) {
    return response;
  }

  void Object.keys(exfilsConfig).forEach(exfilName => {
    const targets = ensureArray(exfilsConfig[exfilName]).map<ExfilTarget>(targetValue => {
      const parsed = parseExilTargetFromPTTConfig(targetValue);

      return {
        isTransit: Boolean(!parsed.targetOffraidPosition),
        offraidPosition: parsed.targetOffraidPosition ?? '',
        transitMapId: resolveLocationIdFromMapName(parsed.transitTargetMapName ?? ''),
        transitSpawnPointId: parsed.transitTargetSpawnPointId ?? '',
      };
    });

    response.data[exfilName] = targets;
  });

  return response;
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
