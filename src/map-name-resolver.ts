// MapName indexed by lower-cased possible location ids
const LOCATIONS_MAPS: Record<string, string> = {
  customs: 'bigmap',
  factory: 'factory4_day',
  reservebase: 'rezervbase',
  interchange: 'interchange',
  woods: 'woods',
  lighthouse: 'lighthouse',
  shoreline: 'shoreline',
  laboratory: 'laboratory',
  lab: 'laboratory',
  ['streets of tarkov']: 'tarkovstreets',
  groundzero: 'sandbox',
};

export const resolveMapNameFromLocation = (location: string): string => {
  const locationName = location.toLowerCase();
  const mapName = LOCATIONS_MAPS[locationName];

  return mapName ?? locationName;
};

/**
 * Replace `factory4_night` by `factory_day`
 * Replace `sandbox_high` by `sandbox`
 */
const ensureNoSpecialMaps = (locationId: string): string => {
  if (locationId === 'factory4_night') {
    return 'factory4_day';
  }

  if (locationId === 'sandbox_high') {
    return 'sandbox';
  }

  return locationId;
};

/**
 * Check that 2 locations are the same.
 *
 * Please note that `factory4_day` and `factory4_night` are considered as same map here.
 * There is also `sandbox` and `sandbox_high` (obviously)
 */
export const isSameMap = (locationA: string, locationB: string): boolean => {
  const resolvedLocationA = ensureNoSpecialMaps(resolveMapNameFromLocation(locationA));
  const resolvedLocationB = ensureNoSpecialMaps(resolveMapNameFromLocation(locationB));

  return resolvedLocationA === resolvedLocationB;
};

const LOCATION_IDS: Record<string, string> = {
  customs: 'bigmap',
  factory: 'factory4_day',
  factory4: 'factory4_day',
  reservebase: 'RezervBase',
  rezervbase: 'RezervBase',
  interchange: 'Interchange',
  woods: 'Woods',
  lighthouse: 'Lighthouse',
  shoreline: 'Shoreline',
  lab: 'laboratory',
  ['streets of tarkov']: 'TarkovStreets',
  tarkovstreets: 'TarkovStreets',
  streets: 'TarkovStreets',
  sandbox: 'Sandbox',
  sandbox_high: 'Sandbox_high',
  groundzero: 'Sandbox',
  terminal: 'Terminal',
};

export const resolveLocationIdFromMapName = (givenMapName: string): string => {
  const mapName = givenMapName.toLowerCase();
  const locationId = LOCATION_IDS[mapName];

  return locationId ?? mapName;
};
