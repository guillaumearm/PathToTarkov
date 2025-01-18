
# Create your own PTT Configuration

To customize a Path to Tarkov configuration without overwriting it during future updates:

1. Copy the configuration directory you want to use as a starting point and rename it, for example, to `MyConfig`.
2. Update the `selectedConfig` value in your `UserConfig.json5` file to point to your custom configuration:

```js
selectedConfig: "MyConfig",
```

## Resources for config makers
I suggest you to keep those 2 files opened in a browser tab when writing a config:
- [`ALL_EXFILS.md`](../ALL_EXFILS.md) (list of vanilla exfils)
- [`shared_player_spawnpoints.json5`](../configs/shared_player_spawnpoints.json5) (list of ptt spawnpoints)
- [How to add player spawnpoints](./HOW_TO_ADD_PLAYER_SPAWNPOINTS.md)

### Follow the PTT config tutorial
In [this tutorial](./TUTORIAL_CONFIG.md), we will create a new config from scrath.

### Check the PTT config specification
Here is the link to the [PTT Config specification](./specification/README.md) if you want more details on all features.

### Use a linter to validate syntax of your config
https://codebeautify.org/json5-validator

### Check `Trap-PathToTarkov/configs/Examples` directory
check [here](../configs/Examples/) for sample configurations
