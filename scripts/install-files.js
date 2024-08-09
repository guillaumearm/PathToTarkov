// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const dllFileName = 'PTTExtracts.dll';
const cprFlags = '--overwrite --delete-first';

const main = async modName => {
  [
    `cpr ./dist/user/mods/${modName} ../../../user/mods/${modName} ${cprFlags}`,
    `cpr ./dist/BepInEx/plugins/${dllFileName} ../../../BepInEx/plugins/${dllFileName} ${cprFlags}`,
    'echo "> Successfully installed files!"',
  ].forEach(cmd => {
    if (typeof cmd === 'string') {
      process.stdout.write(execSync(cmd));
    } else {
      cmd();
    }
  });
};

main(packageJson.fullName);
