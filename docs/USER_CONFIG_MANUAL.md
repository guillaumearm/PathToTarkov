# UserConfig.json5 documentation

The `UserConfig.json5` is generated on server start and is not distributed with Path To Tarkov.

This allows players to configure their experience without interfering with new updates.

Here is the default one formatted in a json5 format:

```js
{
  selectedConfig: 'Default', // this is the name of the used ptt config, check the `Trap-PathToTarkov/configs` directory for more
  gameplay: {
    multistash: true, // multistash feature
    tradersAccessRestriction: true, // traders access restriction feature
    resetOffraidPositionOnPlayerDeath: true, // on player death, reset the offraid position according to the config
    playerScavMoveOffraidPosition: false, // extract with a scav will move the offraid position when possible
    keepFoundInRaidTweak: true, // Keep Found-In-Raid twea
  },
  runUninstallProcedure: false, // pass this is to true to run the uninstall procedure.
}
```

## Why should I need a special procedure for uninstallation ?

[Read this documentation about uninstalling PTT](./HOW_TO_UNINSTALL.md)