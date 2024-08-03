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
    'rm -rf dist/user',
    'rm -rf dist/BepInEx',
    () => mkdirp.sync(`./dist/user/mods/${modName}`),
    () => mkdirp.sync('./dist/BepInEx/plugins'),
    'npx cpr ./PTT-Extracts/bin/Debug/netstandard2.0/PTTExtracts.dll ./dist/BepInEx/plugins/PTTExtracts.dll -o',
    `npx cpr package.json ./dist/user/mods/${modName}/package.json -o`,
    `npx cpr dist/src ./dist/user/mods/${modName} -o`,
    `npx cpr config ./dist/user/mods/${modName} -o`,
    `npx cpr ALL_EXFILS.md ./dist/user/mods/${modName}/ALL_EXFILS.md -o`,
    `npx cpr LOGO.jpg ./dist/user/mods/${modName}/LOGO.jpg -o`,
    `npx cpr README.md ./dist/user/mods/${modName}/README.md -o`,
    `npx cpr LICENSE ./dist/user/mods/${modName}/LICENSE -o`,
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
