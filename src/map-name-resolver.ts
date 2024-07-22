const LOCATIONS_MAPS: Record<string, string> = {
  customs: "bigmap",
  factory: "factory4_day",
  reservebase: "rezervbase",
  interchange: "interchange",
  woods: "woods",
  lighthouse: "lighthouse",
  shoreline: "shoreline",
  laboratory: "laboratory",
  lab: "laboratory",
  ["streets of tarkov"]: "tarkovstreets",
  groundzero: "sandbox",
};

export const resolveMapNameFromLocation = (location: string): string => {
  const locationName = location.toLowerCase();
  const mapName = LOCATIONS_MAPS[locationName];

  return mapName ?? locationName;
};
