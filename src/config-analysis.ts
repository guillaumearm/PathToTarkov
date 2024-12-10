import { isValidExfilForMap } from './all-exfils';
import type { ByMap } from './config';
import { EMPTY_STASH, type Config, type MapName, type SpawnConfig } from './config';
import { ensureArray } from './utils';

const MIN_NEEDED_MAPS = [
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
];

const ALLOWED_MAPS = [...MIN_NEEDED_MAPS, 'sandbox_high'];

export type ConfigValidationResult = {
  errors: string[];
  warnings: string[];
};

const checkAccessViaErrors = (
  field: string,
  givenAccessVia: string | string[],
  config: Config,
): string[] => {
  const accessVia = ensureArray(givenAccessVia);

  if (accessVia.length === 1 && accessVia[0] === '*') {
    return [];
  }

  const errors: string[] = [];

  accessVia.forEach(offraidPosition => {
    if (!config.infiltrations[offraidPosition]) {
      errors.push(`wrong ${field}: "${offraidPosition}" is not a valid offraid position`);
    }
  });

  return errors;
};

const getErrorsForOffraidPositions = (config: Config): string[] => {
  const errors: string[] = [];

  errors.push(
    ...checkAccessViaErrors(
      'hideout_main_stash_access_via',
      config.hideout_main_stash_access_via,
      config,
    ),
  );

  errors.push(...checkAccessViaErrors('respawn_at', config.respawn_at ?? [], config));

  errors.push(
    ...checkAccessViaErrors(
      'hydration.access_via',
      config.offraid_regen_config.hydration.access_via,
      config,
    ),
  );

  errors.push(
    ...checkAccessViaErrors(
      'energy.access_via',
      config.offraid_regen_config.energy.access_via,
      config,
    ),
  );

  errors.push(
    ...checkAccessViaErrors(
      'health.access_via',
      config.offraid_regen_config.health.access_via,
      config,
    ),
  );

  config.hideout_secondary_stashes.forEach(secondaryStashConfig => {
    errors.push(
      ...checkAccessViaErrors(
        `hideout_secondary_stashes.${secondaryStashConfig.name}.access_via`,
        secondaryStashConfig.access_via,
        config,
      ),
    );
  });

  Object.keys(config.traders_config).forEach(traderId => {
    const trader = config.traders_config[traderId];
    errors.push(
      ...checkAccessViaErrors(`traders_config.${traderId}.access_via`, trader.access_via, config),
    );
  });

  // check exfils offraid positions
  Object.keys(config.exfiltrations).forEach(mapName => {
    const offraidByExfil = config.exfiltrations[mapName as MapName];

    Object.keys(offraidByExfil).forEach(extractName => {
      const offraidPosition = offraidByExfil[extractName];
      if (!config.infiltrations[offraidPosition]) {
        errors.push(
          `wrong offraidPosition: "${offraidPosition}" in exfiltrations.${mapName}.${extractName}`,
        );
      }
    });
  });

  return errors;
};

const getInfiltrationHash = (spawns: ByMap<string[]>): string => {
  const results = Object.keys(spawns).flatMap(mapName => {
    return spawns[mapName as MapName].map(spawnName => {
      return `${mapName}.${spawnName}`;
    });
  });

  return results.sort().join('/');
};

const getWarningsForOffraidPositions = (config: Config): string[] => {
  const warnings: string[] = [];
  const offraidPosByHash: Record<string, string> = {};

  Object.keys(config.infiltrations).forEach(offraidPosition => {
    const spawnsByMap = config.infiltrations[offraidPosition];
    const hash = getInfiltrationHash(spawnsByMap);

    if (offraidPosByHash[hash]) {
      warnings.push(
        `offraid position "${offraidPosition}" seems to be a duplicate of "${offraidPosByHash[hash]}"`,
      );
    } else {
      offraidPosByHash[hash] = offraidPosition;
    }
  });

  return warnings;
};

const getErrorsForExfils = (config: Config): string[] => {
  const errors: string[] = [];

  Object.keys(config.exfiltrations).forEach(mapName => {
    // 1. check all exfils maps are valid
    if (!ALLOWED_MAPS.includes(mapName)) {
      errors.push(`${mapName} is now allowed as a map name in "exfiltrations"`);
    }

    // 2. check for map with no exfils (only when all transits are disabled)
    if (
      config.disable_all_transits &&
      Object.keys(config.exfiltrations[mapName as MapName]).length === 0
    ) {
      errors.push(`no exfils found for map ${mapName} in "exfiltrations"`);
    }
  });

  // 3. check for missing maps
  MIN_NEEDED_MAPS.forEach(mapName => {
    if (!config.exfiltrations[mapName as MapName]) {
      errors.push(`${mapName} is missing in "exfiltrations"`);
    }
  });

  // 4. Check for extract point name validity
  Object.keys(config.exfiltrations).forEach(mapName => {
    Object.keys(config.exfiltrations[mapName as MapName]).forEach(exfilName => {
      if (!isValidExfilForMap(mapName, exfilName)) {
        errors.push(`invalid extract name "${exfilName}" for map "${mapName}"`);
      }
    });
  });

  return errors;
};

// Note: offraidPosition is already checked by `getErrorsForOffraidPositions`
const getErrorsSecondaryStashes = (config: Config): string[] => {
  const errors: string[] = [];
  const names: Set<string> = new Set();

  config.hideout_secondary_stashes.forEach(stashConfig => {
    if (stashConfig.name === EMPTY_STASH.name) {
      errors.push(
        `secondary stash ${stashConfig.name} is a special reserved name, please choose another.`,
      );
    }

    if (names.has(stashConfig.name)) {
      errors.push(`duplicated secondary stash ${stashConfig.name} found`);
    }
    names.add(stashConfig.name);
  });

  return errors;
};

const getWarningsSecondaryStahes = (config: Config): string[] => {
  const warnings: string[] = [];
  const offraidPositions = new Set<string>();

  config.hideout_secondary_stashes.forEach(stashConfig => {
    ensureArray(stashConfig.access_via).forEach(offraidPosition => {
      if (offraidPositions.has(offraidPosition)) {
        warnings.push(`offraid position is already used by stash "${stashConfig.name}"`);
      } else {
        offraidPositions.add(offraidPosition);
      }
    });
  });

  return warnings;
};

const getErrorsForInfils = (config: Config, spawnConfig: SpawnConfig): string[] => {
  const errors: string[] = [];

  Object.values(config.infiltrations).forEach(spawnPointsByMap => {
    Object.keys(spawnPointsByMap).forEach(mapName => {
      // 1. check for map validity
      if (!ALLOWED_MAPS.includes(mapName)) {
        errors.push(`${mapName} is now allowed as a map name in "infiltrations"`);
        return;
      }

      // 2. check for existing spawnpoints for given map (in player_spawnpoints.json)
      if (!spawnConfig[mapName as MapName]) {
        errors.push(`no spawn points found for map ${mapName} in player_spawnpoints.json`);
        return;
      }

      const spawnPoints = spawnPointsByMap[mapName as MapName];
      // ignore wildcards
      if (spawnPoints[0] === '*') {
        return;
      }

      // 4. check for spawnPoints validity
      spawnPoints.forEach(spawnPointName => {
        const spawn = spawnConfig[mapName as MapName][spawnPointName];
        if (!spawn) {
          errors.push(`unknown player spawnpoint reference ${spawnPointName} for map ${mapName}`);
        }
      });
    });
  });

  return errors;
};

const getErrorsForAdditionalSpawnpoints = (config: Config): string[] => {
  const errors: string[] = [];

  const additionalSpawnConfig = config.infiltrations_config?.additional_player_spawnpoints ?? {};

  Object.keys(additionalSpawnConfig).forEach(mapName => {
    if (!ALLOWED_MAPS.includes(mapName)) {
      errors.push(
        `${mapName} is now allowed as a map name in "infiltrations_config.additional_player_spawnpoints"`,
      );
      return;
    }
  });

  return errors;
};

export const analyzeConfig = (config: Config, spawnConfig: SpawnConfig): ConfigValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. check there is at least one offraid position
  if (Object.keys(config.infiltrations).length === 0) {
    errors.push('no offraid position found in "infiltrations"');
  }

  // 2. check there is at least one map
  if (Object.keys(config.exfiltrations).length === 0) {
    errors.push('no map found found in "exfiltrations"');
  }

  // 3. check initial_offraid_position
  if (!config.infiltrations[config.initial_offraid_position]) {
    errors.push(`wrong initial_offraid_position "${config.initial_offraid_position}"`);
  }

  // 4. check all offraid positions
  errors.push(...getErrorsForOffraidPositions(config));
  warnings.push(...getWarningsForOffraidPositions(config));

  // 5. checks for exfil maps
  errors.push(...getErrorsForExfils(config));

  // 6. check for secondary stashes
  errors.push(...getErrorsSecondaryStashes(config));
  warnings.push(...getWarningsSecondaryStahes(config));

  // 7. check for infiltrations maps and spawn points
  errors.push(...getErrorsForInfils(config, spawnConfig));

  // 8. check for additional spawnpoints
  errors.push(...getErrorsForAdditionalSpawnpoints(config));

  return {
    errors,
    warnings,
  };
};
