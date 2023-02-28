// eslint-disable-next-line @typescript-eslint/no-var-requires
const { execSync } = require("child_process");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require("../package.json");

const modName = packageJson.fullName;

const main = async () => {
  [
    "rm -rf dist/user",
    "rm -rf dist/BepInEx",
    `mkdir -p ./dist/user/mods/${modName}`,
    "mkdir -p ./dist/BepInEx/plugins",
    "cp ./PTT-Extracts/bin/Debug/netstandard2.0/PTTExtracts.dll ./dist/BepInEx/plugins/",
    `cp -R dist/src ./dist/user/mods/${modName}`,
    `cp package.json ./dist/user/mods/${modName}`,
    `cp README.md ./dist/user/mods/${modName}`,
    `cp ALL_EXFILS.md ./dist/user/mods/${modName}`,
    `cp LICENSE ./dist/user/mods/${modName}`,
    `cp -R config ./dist/user/mods/${modName}`,
    'echo "> Successfully prepared files!"',
  ].forEach((cmd) => process.stdout.write(execSync(cmd)));
};

main();
