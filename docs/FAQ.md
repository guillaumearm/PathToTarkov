# Frequently Asked Questions

Don't be afraid to ask questions, in the end this will contribute to this document.

## General questions about Path To Tarkov

### When I die the offraid position is reset
This is normal, it's a feature of the mod.

You might want to turn off this feature setting the `reset_offraid_position_on_player_die` to `false` property in your `UserConfig.json5` file.

### Where is Jaeger ?
Path To Tarkov automatically hide locked traders so you need to finish the quest [Introduction](https://escapefromtarkov.fandom.com/wiki/Introduction) to unlock Jaeger.

You can use F12 BepInEx in-game menu if you want to show locked traders.


## If you encounter any problems

### My profile is broken after removing the mod
This is because you need to run the [uninstall procedure](./HOW_TO_UNINSTALL.md) before removing the mod.

If you run the procedure and still experiment an issue, please [report the bug](./HOW_TO_REPORT_A_BUG.md)

### I have a syntax error after editing a config file
Use a json5 syntax validator will help you -> https://codebeautify.org/json5-validator

### Nothing changes when I edit a config file
Be sure that the config you are editing is selected in your `UserConfig.json5` file.

### I don't know where is the `UserConfig.json5` file
This file is not distributed with the mod but automatically generated on server start.

You'll find it at `Trap-PathToTarkov/configs/UserConfig.json5` after starting your server.

### I have config analysis errors when making my config
[Read the manual on config creation](./HOW_TO_CREATE_CONFIG.md)

## For config makers
### How can I add my custom player spawnpoints ?
[Read this](./HOW_TO_ADD_PLAYER_SPAWNPOINTS.md)
