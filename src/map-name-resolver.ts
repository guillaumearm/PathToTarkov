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
