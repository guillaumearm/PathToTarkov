// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mkdirp } = require('mkdirp');
// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const cpr = require('cpr');

const PTT_DLL_FILENAME = 'Trap.PathToTarkov.dll';
const PTT_PACKETS_DLL_FILENAME = 'Trap.PathToTarkov-Packets.dll';

const main = async modName => {
  [
    'rimraf dist/user',
    'rimraf dist/BepInEx',
    () => mkdirp.sync(`./dist/user/mods/${modName}`),
    () => mkdirp.sync('./dist/BepInEx/plugins'),
    `cpr ./PTT-Plugin/bin/Debug/net471/${PTT_DLL_FILENAME} ./dist/BepInEx/plugins/${PTT_DLL_FILENAME} -o`,
    `cpr ./PTT-Packets/bin/Debug/net471/${PTT_PACKETS_DLL_FILENAME} ./dist/BepInEx/plugins/${PTT_PACKETS_DLL_FILENAME} -o`,
    `cpr package.json ./dist/user/mods/${modName}/package.json -o`,
    `cpr dist/src ./dist/user/mods/${modName}/src -o`,
    `cpr configs ./dist/user/mods/${modName}/configs -o`,
    `cpr ./dist/user/mods/${modName}/configs/shared_player_spawnpoints.json5 ./dist/user/mods/${modName}/src/do_not_distribute/shared_player_spawnpoints.json5 -o`,
    `rimraf ./dist/user/mods/${modName}/configs/shared_player_spawnpoints.json5`,
    `rimraf ./dist/user/mods/${modName}/configs/UserConfig.json5`,
    `cpr ALL_EXFILS.md ./dist/user/mods/${modName}/ALL_EXFILS.md -o`,
    `cpr LOGO.jpg ./dist/user/mods/${modName}/LOGO.jpg -o`,
    `cpr README.md ./dist/user/mods/${modName}/README.md -o`,
    `cpr ./docs ./dist/user/mods/${modName}/docs -o`,
    `cpr LICENSE ./dist/user/mods/${modName}/LICENSE -o`,
    'echo "> Successfully prepared files!"',
  ].forEach(cmd => {
    if (typeof cmd === 'string') {
      process.stdout.write(execSync(cmd));
    } else {
      cmd();
    }
  });
};

main(packageJson.fullName);
