// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('node:fs/promises');

const EXTERNAL_RESOURCES_DIR = 'external-resources';
const LOCATION_NAME_MAPPING_FILENAME = 'location_name_mapping.json';
const LOCALES_FILENAME = 'locales_global_en.json';
const MAP_LOCATIONS_FILENAME = 'map_locations.json';
const MAPS_DIR = 'maps';

const MARKDOWN_MAIN_TITLE = 'All exfiltrations';

const MARKDOWN_TABLE_HEADER = `
|identifier|description|mapgenie.io|escapefromtarkov.fandom.com|
|----------|-----------|-----------|---------------------------|
`.trim();

const MAPGENIE_REMAPPING = {
  laboratory: 'lab',
};

const lowerLocaleKeys = locales => {
  const result = {};
  const localeKeys = Object.keys(locales);

  localeKeys.forEach(localeKey => {
    result[localeKey.toLowerCase()] = locales[localeKey];
  });

  if (Object.keys(result).length < localeKeys.length) {
    console.warn('Warning: some locales has been lost during key lower casing!');
  }

  return result;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LOCATION_NAME_MAPPING = require(
  `../${EXTERNAL_RESOURCES_DIR}/${LOCATION_NAME_MAPPING_FILENAME}`,
);
const LOCALES = lowerLocaleKeys(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require(`../${EXTERNAL_RESOURCES_DIR}/${LOCALES_FILENAME}`),
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MAP_LOCATIONS = require(`../${EXTERNAL_RESOURCES_DIR}/${MAP_LOCATIONS_FILENAME}`);

const getMapJsonFilePath = mapName =>
  `${EXTERNAL_RESOURCES_DIR}/${MAPS_DIR}/${mapName}_allExtracts.json`;

const getMapGenieMapName = mapName => {
  if (MAPGENIE_REMAPPING[mapName]) {
    return MAPGENIE_REMAPPING[mapName];
  }

  return mapName;
};

const getEftFandomMapName = mapDisplayName => {
  if (mapDisplayName === 'Military Reserve') {
    return 'Reserve';
  }
  if (mapDisplayName === 'Laboratory') {
    return 'The_Lab';
  }
  return mapDisplayName.replaceAll(' ', '_');
};

const resolveMapLocation = (mapName, exitResolvedName) => {
  if (!MAP_LOCATIONS[mapName]) {
    throw new Error(`Error: map name '${mapName}' does not exist in MAPGENIE_LOCATIONS`);
  }

  const mapLocation = MAP_LOCATIONS[mapName].find(
    l => l.description.toLowerCase() === exitResolvedName.toLowerCase(),
  );

  if (!mapLocation) {
    console.error(`Warning: cannot resolve map location ${exitResolvedName} for map '${mapName}'`);
    return null;
  }

  return mapLocation;
};

const getMapGenieLocationUrl = (mapName, mapGenieLocationId) => {
  const mapGenieMapName = getMapGenieMapName(mapName);

  if (!mapGenieLocationId) {
    return 'no link';
  }

  return `[link](https://mapgenie.io/tarkov/maps/${mapGenieMapName}?locationIds=${mapGenieLocationId})`;
};

const getEftFandomLocationUrl = (mapName, markerId) => {
  const eftFandomMapName = getEftFandomMapName(mapName);

  if (!markerId) {
    return 'no link';
  }

  return `[link](https://escapefromtarkov.fandom.com/wiki/Map:${eftFandomMapName}?marker=${markerId})`;
  // return `[link](https://escapefromtarkov.fandom.com/wiki/Map:Streets_of_Tarkov?marker=${markerId})`;
};

class ConfigError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'Configuration Error';
  }
}

const resolveMapDisplayName = mapName => LOCATION_NAME_MAPPING[mapName];

const resolveLocale = localeId => {
  const value = LOCALES[localeId.toLowerCase()];

  if (!value) {
    throw new ConfigError(`Cannot resolve locale from '${localeId}' key`);
  }

  return value;
};

const loadMapExits = async mapName => {
  const filePath = getMapJsonFilePath(mapName);

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(fileContent).map(exit => exit.Name);
  } catch (err) {
    throw new ConfigError(`cannot load '${filePath}, reason=${err.toString()}'`);
  }
};

const loadMapsExits = async allMapNames => {
  const result = {};

  for (const mapName of allMapNames) {
    const mapExits = await loadMapExits(mapName);
    result[mapName] = mapExits;
  }

  return result;
};

const simpleDedup = array => {
  const resultObj = {};

  array.forEach(elem => {
    resultObj[elem] = true;
  });

  return Object.keys(resultObj);
};

const mergeMapsExits = (mapsExitsLeft, mapsExitsRight) => {
  const result = {};

  const mapNames = Object.keys({ ...mapsExitsLeft, ...mapsExitsRight });

  for (const mapName of mapNames) {
    const exitsLeft = mapsExitsLeft[mapName] || [];
    const exitsRight = mapsExitsRight[mapName] || [];
    const allExits = simpleDedup([...exitsLeft, ...exitsRight]);

    result[mapName] = allExits;
  }

  return result;
};

const formatMapsExits = mapsExits => {
  const allMapNames = Object.keys(mapsExits);

  return allMapNames
    .reduce((output, mapName) => {
      const mapDisplayName = resolveMapDisplayName(mapName);
      const title = `## ${mapDisplayName}`;
      const exits = mapsExits[mapName];

      const formattedRow = exits.map(exitName => {
        const resolvedExitName = resolveLocale(exitName);
        const mapLocation = resolveMapLocation(mapName, resolvedExitName);

        const mapGenieLocationUrl = getMapGenieLocationUrl(mapName, mapLocation?.mapgenie_id);
        const eftFandomUrl = getEftFandomLocationUrl(
          mapDisplayName,
          mapLocation?.eft_fandom_marker,
        );

        return `| "${exitName}" | ${resolveLocale(exitName)} | ${mapGenieLocationUrl} | ${eftFandomUrl} |`;
      });

      return output + `${title}\n${MARKDOWN_TABLE_HEADER}\n${formattedRow.join('\n')}\n\n`;
    }, '')
    .trim();
};

const getMarkdownContent = allMapsExits => {
  return `\
# ${MARKDOWN_MAIN_TITLE}
${formatMapsExits(allMapsExits)}
`;
};

const getJsContent = allMapsExits => {
  return `\
// This file was AUTO-GENERATED by "generate-all-exfils.js" script
// Run "npm run build:exfils" to regenerate it
export const ALL_DUMPED_EXFILS_FROM_SCRIPT = ${JSON.stringify(allMapsExits, undefined, 2)}
`;
};

const main = async firstArg => {
  const allMapNames = Object.keys(LOCATION_NAME_MAPPING);

  const mapsExits = await loadMapsExits(allMapNames);
  const allMapsExits = mergeMapsExits(mapsExits, {});

  if (firstArg === '--javascript') {
    return getJsContent(allMapsExits);
  } else if (firstArg === '--markdown') {
    return getMarkdownContent(allMapsExits);
  }

  throw new Error(`Bad argument "${firstArg}"`);
};

main(process.argv[2])
  .then(result => {
    process.stdout.write(result);
    process.stdout.write('\n');
  })
  .catch(err => {
    if (err instanceof ConfigError) {
      console.error(err.toString());
    } else {
      console.error(err);
    }
  });
