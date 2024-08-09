// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require('child_process');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mkdirp } = require('mkdirp');
// // eslint-disable-next-line @typescript-eslint/no-var-requires
// const cpr = require('cpr');

const main = async modName => {
  [
    'rimraf dist/user',
    'rimraf dist/BepInEx',
    () => mkdirp.sync(`./dist/user/mods/${modName}`),
    () => mkdirp.sync('./dist/BepInEx/plugins'),
    'cpr ./PTT-Extracts/bin/Debug/netstandard2.0/PTTExtracts.dll ./dist/BepInEx/plugins/PTTExtracts.dll -o',
    `cpr package.json ./dist/user/mods/${modName}/package.json -o`,
    `cpr dist/src ./dist/user/mods/${modName}/src -o`,
    `cpr config ./dist/user/mods/${modName}/config -o`,
    `cpr ALL_EXFILS.md ./dist/user/mods/${modName}/ALL_EXFILS.md -o`,
    `cpr LOGO.jpg ./dist/user/mods/${modName}/LOGO.jpg -o`,
    `cpr README.md ./dist/user/mods/${modName}/README.md -o`,
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
