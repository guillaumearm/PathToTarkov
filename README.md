# Path to Tarkov
Connect all available maps through the extracts points, bring a multi-stash system and lock traders according to the player offraid position.

## Description
This mod bring the notion of "offraid position" for the player, it locks certains maps according to this offraid position, change all player spawn points to reflect this positions, change the hideout stash and lock/unlock traders according to the config file.

For example, if the position is "FactoryZB-1011", only Customs and Factory maps should be available for infiltration.

All corresponding offraid positions, extracts and spawn points can be configured via `config.json` file.

New spawn points can be added in `player_spawnpoints.json`

## Features
- Maps are locked/unlocked according to the offraid position
- Several hideout stash according to your offraid position (and the configuration file)
- Hideout features disabled when player is not on the main stash position
- Traders are available only on certains offraid position
- Tweak exfiltrations points (fixed for each map + removed restrictions)
- Changed spawn points according to the offraid position
- Certains offraid locations enable/disable the hydration/energy/health restoration (according to config)

## How to edit the current offraid position
The offraid position is stored in your profile in a dedicated field `PathToTarkov`, you can edit it with a regular text editor.


## Known issues
- Sadly, Scav exfils cannot be used by a pmc (I don't know if it's a BSG limitation or if SPT-AKI doesn't implement a way to tweak this values)
- Some hideout features cannot be disabled without crashing the game (generator, water collector and air filtering unit)

## UnInstallation
Before deleting the mod, you can set the `enabled` props to `false` in `config.json` and start the server once.

It does 2 things in all existing profiles: 
1. Ensure the main stash is selected
2. Unlock all traders listed in the config (Please note Jaeger will be unlocked even if the regarding quest is not completed)

## The Default configuration
By default, you are on `FactoryZB-1011` offraid position.

This means you can spawn on Customs or Factory.

The hideout and the main stash are only accessible on the `FactoryZB-1011`, `FactoryZB-1012` and `FactoryZB-1013`.

When player die, the position is reset to the `FactoryZB-1011` position.

Everything is configurable.

## Modding API
Example: 
```js
if (!globalThis.PathToTarkovAPI) {
    Logger.error(`=> ${this.modName}: PathToTarkovAPI not found, are you sure a version of PathToTarkov >= 2.5.0 is installed ?`);
    return;
}

PathToTarkovAPI.onStart((sessionId) => {
    const config = PathToTarkovAPI.getConfig();
    const spawnConfig = PathToTarkovAPI.getSpawnConfig();

    // make some config changes
    config.player_scav_move_offraid_position = false;

    PathToTarkovAPI.setConfig(config);
    PathToTarkovAPI.setSpawnConfig(spawnConfig); // not needed if not changed, it's just for the example

    // should be called after setting new configs
    PathToTarkovAPI.refresh(sessionId);
})
```

### Traders availability
#### Prapor
- Gate 0 (Factory)
- Factory Gate (Woods)
#### Therapist
- Gate 0 (Factory)
- Factory Gate (Woods)
#### Mechanic
You have access to your hideout and your main stash too

- ZB-1011 (Customs)
- ZB-1012 (Customs)
- ZB-1013 (Customs)
- ZB-1014 (Woods)
- Gate 3 (Factory)
- Med tent gates (Factory)
- Cellars (Factory)

#### Skier
- RUAF Roadblock (Customs)
- Northern UN Roadblock (Woods)

#### Ragman
- Railway exfil (Interchange)
- Crossroads (Customs)

#### Jaeger
Accessible via the `Car`:
- Dorms vehicule extract (Customs)
- Bridge vehicule extract (Woods)
- Power Station vehicule extract (Interchange)
- Road to military base vehicule extract (Lighthouse)

#### Peacekeeper
Accessible via the `Boat`:
- Smuggler's Boat (customs)
- Pier Boat (Shoreline)

#### Fence
Available ewverywhere (with insurance enabled to avoid a client bug)

#### Priscilu
From the mod [Priscilu: the trader](https://hub.sp-tarkov.com/files/file/475-priscilu-the-trader/#overview) made by [Reis](https://hub.sp-tarkov.com/user/2833-reis/)
- Outskirts (Woods)

#### Operator
From the mod [Alex-AIO](https://hub.sp-tarkov.com/files/file/375-alex-aio/#overview) made by [Alex](https://hub.sp-tarkov.com/user/10993-alex/)
- Scav lands (Reserve)

#### Other traders
- All traders froms [Andrudis-QuestManiac](https://hub.sp-tarkov.com/files/file/113-andrudis-questmaniac) made by [Andrudis](https://hub.sp-tarkov.com/user/3674-andrudis/)

### All moves

### Factory
Can move to Customs via:
- Gate 3
- Med tent gates
- Cellars

Can move to Woods via:
- Gate 0

### Customs
Can move to Factory via:
- ZB-1011
- ZB-1012
- ZB-1013

Can move to Woods via:
- RUAF Roadblock
- Dorms vehicule extract
- Smuggler's boat (one way ticket)
- ZB-1013 (spawn to ZB-1014)

Can move to Interchange via:
- Dorms vehicule extract
- Crossroads

Can move to Lighthouse via:
- Dorms vehicule extract
- Smuggler's boat (one way ticket)

Can move to Shoreline via:
- Smuggler's boat

Can move to Lab via:
- Dorms vehicule extract

### Woods
Can move to Factory via:
- Factory Gate

Can move to Customs via:
- Northern UN Roadblock
- Bridge car extract

Can move to milirary reserve via:
- Outskirts (one way ticket)


### Interchange
Can move to Customs via:
- Railway exfil
- Power station (car extract)

Can move to Woods via:
- Power station (car extract)

Can move to Lighthouse via:
- Power station (car extract)

Can move to Military reserve via:
- Safe room

Can move to Lab via: 
- Power station (car extract)

### Military reserve
Can move to Customs via:
- Scav lands (one way ticket)

Can move to Shoreline via:
- Cliff descent (one way ticket)

Can move to Interchange via:
- D-2

### Shoreline
Can move to Customs via:
- Pier boat
- Road to Customs

Can move to Military reserve via:
- Path to lighthouse

Can move to Lighthouse via:
- Path to lighthouse
- Tunnel
- Pier boat (one way ticket)

Can move to Woods via:
- Pier boat (one way ticket)

### Lighthouse
Can move to Customs via:
- Road to military base vehicule extraction

Can move to Interchange via:
- Road to military base vehicule extraction

Can move to Woods via:
- Road to military base vehicule extraction

Can move to Military base via:
- Path to shoreline

Can move to Shoreline via:
- Path to shoreline
- Side tunnel

### Laboratory
- Accessible via `Car`
- Extract from this map does not change the offraid position

## Known limitations:
- Scav extracts cannot be used by a pmc
