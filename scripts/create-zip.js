const { execSync } = require("child_process");
const packageJson = require("../package.json");
const zip = require("bestzip");

const main = async () => {
  const fileName = `${packageJson.zipNamePrefix}-${packageJson.version}`;

  execSync(`rm -rf ${fileName} ${fileName}.zip`);
  execSync(`cp -R dist ${fileName}`);

  await zip({
    source: fileName,
    destination: `${fileName}.zip`,
  });

  // execSync(`rm -rf ${fileName}`);
};

main();
