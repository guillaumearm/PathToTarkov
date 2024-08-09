// eslint-disable-next-line @typescript-eslint/no-var-requires
const { renameSync } = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const main = async () => {
  const zipFileName = `${packageJson.fullName}-${packageJson.version}.zip`;
  renameSync('mod.zip', zipFileName);
  console.log(`Renamed 'mod.zip' into '${zipFileName}'`);
};

main();
