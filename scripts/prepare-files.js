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
  const serverModDir = `./dist/user/mods/${modName}`;

  void [
    'rimraf dist/user',
    'rimraf dist/BepInEx',
    () => mkdirp.sync(serverModDir),
    () => mkdirp.sync('./dist/BepInEx/plugins'),
    `cpr ./PTT-Plugin/bin/Debug/net471/${PTT_DLL_FILENAME} ./dist/BepInEx/plugins/${PTT_DLL_FILENAME} -o`,
    `cpr ./PTT-Packets/bin/Debug/net471/${PTT_PACKETS_DLL_FILENAME} ./dist/BepInEx/plugins/${PTT_PACKETS_DLL_FILENAME} -o`,
    `cpr package.json ${serverModDir}/package.json -o`,
    `cpr dist/src ${serverModDir}/src -o`,
    `cpr configs ${serverModDir}/configs -o`,
    `rimraf ${serverModDir}/configs/**/*.jpg ${serverModDir}/configs/**/*.jpeg ${serverModDir}/configs/**/*.png ${serverModDir}/configs/**/*.gif`,
    `cpr ${serverModDir}/configs/shared_player_spawnpoints.json5 ${serverModDir}/src/do_not_distribute/shared_player_spawnpoints.json5 -o`,
    `rimraf ${serverModDir}/configs/shared_player_spawnpoints.json5`,
    `rimraf ${serverModDir}/configs/UserConfig.json5`,
    `cpr ALL_EXFILS.md ${serverModDir}/ALL_EXFILS.md -o`,
    `cpr README.txt ${serverModDir}/README.txt -o`,
    // `cpr README.md ${serverModDir}/README.md -o`,
    // `cpr ./docs ${serverModDir}/docs -o`,
    `cpr LICENSE ${serverModDir}/LICENSE -o`,
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
