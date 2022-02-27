# Path to Tarkov
Connect all available maps through the extracts points.

## Description
This mod bring the notion of "offraid position" for the player, it locks certains maps according to this offraid position, change all player spawn points to reflect this positions and lock/unlock the hideout stash according to the config file.

For example, if the position is "FactoryZB-1011", only Customs and Factory maps should be available for infiltration.

All corresponding offraid positions, extracts and spawn points can be configured via `config.json` file.

New spawn points can be added in `player_spawnpoints.json`

## Features
- Maps are locked/unlocked according to the offraid position
- Hideout is locked/unlocked according to the offraid position (`Car` by default)
- Tweak exfiltrations points (fixed for each map + removed restrictions)
- Changed spawn points according to the offraid position

## The Default configuration
By default, you are on `Car` offraid position.

This means you can spawn on Customs, Interchange, Woods or Lighthouse at the corresponding car extract.

The hideout stash is only accessible on the `Car`.

When player die, the position is reset to the `Car` position.

Everything is configurable.

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

Can move to Lab via: 
- Power station (car extract)

### Military reserve
Can move to Customs via:
- Scav lands (one way ticket)

Can move to Shoreline via:
- Cliff descent (one way ticket)

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
