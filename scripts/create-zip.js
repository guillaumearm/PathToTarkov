const { execSync } = require("child_process");
const packageJson = require("../package.json");
const zip = require("bestzip");

const main = async () => {
  const dirName = packageJson.fullName;
  const zipFileName = `${packageJson.fullName}-${packageJson.version}.zip`;

  execSync(`rm -rf ${dirName} ${zipFileName}`);
  execSync(`cp -R dist ${dirName}`);
  console.log(`Created '${dirName}' directory.`);

  await zip({
    source: dirName,
    destination: zipFileName,
  });
  console.log(`Created '${zipFileName}' file.`);

  execSync(`rm -rf ${dirName}`);
  console.log(`Removed '${dirName}' directory.`);
};

main();
