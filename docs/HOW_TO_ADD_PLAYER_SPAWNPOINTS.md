# How to add custom player spawnpoints

There is two way of adding player spawnpoints in PTT.

1. Using `infiltrations_config.additional_player_spawnpoints` config property as [explained here in the config specification](./specification/README.md#infiltrations_config-infiltrationsconfig)
2. Providing an `additional_player_spawnpoints.json5` file alongside the ptt config (same format as the [shared_player_spawnpoints.json5](../configs/shared_player_spawnpoints.json5))

## Override spawnpoints
If your custom spawnpoint has the same name as an existing ptt spawnpoint, it will override it. This let you adjust some existing spawnpoints specifically for your config.

## ⚠️ About the `shared_player_spawnpoints.json5` file

This file is in a `do_not_distribute` directory for a good reason, those spawnpoints are supposed to be shared across PTT configs, this allow easier maintainance on different configs.

Please note: contributions are welcome for editing the `shared_player_spawnpoints.json5`.
