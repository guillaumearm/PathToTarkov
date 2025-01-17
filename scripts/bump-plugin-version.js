// eslint-disable-next-line @typescript-eslint/no-var-requires
const { writeFile } = require('node:fs/promises');

const PTT_PLUGIN_VERSION_CS_FILE = './PTT-Plugin/PluginVersion.cs';
const writePluginVersionFile = content => {
  return writeFile(PTT_PLUGIN_VERSION_CS_FILE, content);
};

// this function will enforce the `x.y.z` format (because needed for BepInEx)
const getSemanticVersion = version => {
  const firstPartVersion = version.split('-')[0] ?? '';

  if (!firstPartVersion) {
    return undefined;
  }

  const [major, minor, patch] = firstPartVersion.split('.');

  if (major === undefined || minor === undefined || patch === undefined) {
    return undefined;
  }

  // 0.0.0 is forbidden
  if (!major && !minor && !patch) {
    return undefined;
  }

  // TODO: extract x.y.z
  return `${major}.${minor}.${patch}`;
};

const getCSharpContent = version => {
  const semanticVersion = getSemanticVersion(version);

  if (!semanticVersion) {
    throw new Error('Cannot determine the semantic version');
  }

  return `\
namespace PTT;
internal static class PluginVersion
{
    internal const string VERSION = "${semanticVersion}";
    internal const string DISPLAY_VERSION = "${version}";
}
`;
};

const main = async version => {
  if (!version) {
    throw new Error('missing argument');
  }

  const fileContent = getCSharpContent(version);
  await writePluginVersionFile(fileContent);
  console.log(`> wrote "${PTT_PLUGIN_VERSION_CS_FILE}" file.`);
};

main(process.argv[2]).catch(console.error);
