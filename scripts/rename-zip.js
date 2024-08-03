// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const main = async () => {
  const zipFileName = `${packageJson.fullName}-${packageJson.version}.zip`;
  execSync(`mv mod.zip ${zipFileName}`);
  console.log(`Renamed 'mod.zip' into '${zipFileName}'`);
};

main();
