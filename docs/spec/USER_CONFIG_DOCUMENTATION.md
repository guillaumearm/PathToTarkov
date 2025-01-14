# UserConfig.json5 documentation

This file is not shipped with Path To Tarkov and will be generated on server start.

It allows player to configure their PTT experience without interfering with config updates.

Here is the default one in a json5 format:

```js
{
  selectedConfig: 'Default', // this is the name of the used ptt config, check the `Trap-PathToTarkov/configs` directory for more
  runUninstallProcedure: false, // pass this is to true to run the uninstall procedure
}
```

## Why should I need a special procedure for uninstallation ?

[Read this documentation about uninstalling PTT](../HOW_TO_UNINSTALL.md)