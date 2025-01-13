// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

const dllFileName = 'Trap.PathToTarkov.dll';
const packetsDllFileName = 'Trap.PathToTarkov-Packets.dll';
const cprFlags = '--overwrite';

const main = async modName => {
  [
    `cpr ./dist/user/mods/${modName} ../../../user/mods/${modName} ${cprFlags}`,
    `cpr ./dist/BepInEx/plugins/${dllFileName} ../../../BepInEx/plugins/${dllFileName} ${cprFlags}`,
    `cpr ./dist/BepInEx/plugins/${packetsDllFileName} ../../../BepInEx/plugins/${packetsDllFileName} ${cprFlags}`,
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
