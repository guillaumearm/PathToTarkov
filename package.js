"use strict";

const fs = require('fs');
const path = require('path');

const OFFRAID_POSITION_FILE = path.join(__dirname, 'offraid_position.txt')

const isValidMap = (mapName) => {
    return mapName !== 'base' && mapName !== 'hideout' && mapName !== 'privatearea' && mapName !== 'private area' && mapName !== 'develop';
}

const STASH_IDS = [
    "566abbc34bdc2d92178b4576", // Standard
    "5811ce572459770cba1a34ea", // Left Behind
    "5811ce662459770f6f490f32", // Prepare for escape
    "5811ce772459770e9e5f9532"  // Edge of darkness
];

class StashController {
    constructor(database) {
        // null means stash is unlocked
        this.stashSizes = null;
        this.items = database.templates.items
    }

    lock() {
        if (this.stashSizes) {
            return;
        }

        this.stashSizes = {};

        STASH_IDS.forEach(stashId => {
            const gridProps = this.items[stashId]._props.Grids[0]._props;
            this.stashSizes[stashId] = gridProps.cellsV;
            gridProps.cellsV = 0;
        });
    }

    unlock() {
        if (!this.stashSizes) {
            return;
        }

        STASH_IDS.forEach(stashId => {
            this.items[stashId]._props.Grids[0]._props.cellsV = this.stashSizes[stashId];
        });

        this.stashSizes = {};
    }

}

function initialExtractionsTweaks(database, config) {
    const locations = database.locations;

    // Extraction tweaks
    for (let i in locations) {
        if (isValidMap(i)) {
            for (let x in locations[i].base.exits) {
                // Remove extracts restrictions
                if (config.remove_all_exfils_restrictions && locations[i].base.exits[x].Name !== "EXFIL_Train" && !locations[i].base.exits[x].Name.includes("lab") || locations[i].base.exits[x].Name === "lab_Vent") {
                    if (locations[i].base.exits[x].PassageRequirement !== "None") {
                        locations[i].base.exits[x].PassageRequirement = "None";
                    }
                    if (locations[i].base.exits[x].ExfiltrationType !== "Individual") {
                        locations[i].base.exits[x].ExfiltrationType = "Individual";
                    }
                    if (locations[i].base.exits[x].Id !== '') {
                        locations[i].base.exits[x].Id = '';
                    }
                    if (locations[i].base.exits[x].Count !== 0) {
                        locations[i].base.exits[x].Count = 0;
                    }
                    if (locations[i].base.exits[x].RequirementTip !== '') {
                        locations[i].base.exits[x].RequirementTip = '';
                    }
                    if (locations[i].base.exits[x].RequiredSlot) {
                        delete locations[i].base.exits[x].RequiredSlot;
                    }
                }

                // Make all extractions available to extract
                if (locations[i].base.exits[x].Name !== "EXFIL_Train") {
                    if (locations[i].base.exits[x].Chance !== 100) {
                        locations[i].base.exits[x].Chance = 100;
                    }
                }
            }
        }
    }
}

const MAPLIST = [
    'laboratory',
    'factory4_day',
    'factory4_night',
    'bigmap', // customs
    'interchange',
    'lighthouse',
    'rezervbase',
    'shoreline',
    'woods',
]

const createSpawnPoint = (pos, rot, entrypoints) => {
    return {
        "Position": pos,
        "Rotation": rot || 0.0,
        "Sides": [
            "All"
        ],
        "Categories": [
            "Player"
        ],
        "Infiltration": entrypoints[0] || '',
        "DelayToCanSpawnSec": 3,
        "ColliderParams": {
            "_parent": "SpawnSphereParams",
            "_props": {
                "Center": {
                    "x": 0,
                    "y": 0,
                    "z": 0
                },
                "Radius": 0.0
            }
        },
        "BotZoneName": ""
    }
}

const createExitPoint = (entrypoints) => (name) => {
    return {
        "Name": name,
        "EntryPoints": entrypoints.join(','),
        "Chance": 100,
        "Count": 0,
        "Id": "",
        "MinTime": 0,
        "MaxTime": 0,
        "ExfiltrationType": "Individual",
        "PassageRequirement": "None",
        "PlayersCount": 0,
        "ExfiltrationTime": 10
    }
}

const removePlayerSpawns = (database, mapName) => {
    const base = database.locations[mapName].base;
    base.SpawnPointParams = base.SpawnPointParams
        .filter(params => params.Categories[0] !== 'Player')
}

const addSpawnPoint = (database, mapName, spawnPoint) => {
    database.locations[mapName].base.SpawnPointParams.push(spawnPoint)
}

const updateLockedMaps = (database, config, playerOffraidPosition) => {
    const unlockedMaps = config.infiltrations[playerOffraidPosition];

    MAPLIST.forEach(mapName => {
        if (mapName === 'laboratory') {
            const playerIsAtLab = config.laboratory_access_via.includes(playerOffraidPosition)
            const unlocked = !config.laboratory_access_restriction || Boolean(playerIsAtLab);
            database.locations[mapName].base.Locked = !unlocked;
        } else if (mapName !== 'laboratory') {
            database.locations[mapName].base.Locked = !unlockedMaps[mapName];
        }
    })
}

const getPosition = (spawnData) => {
    const pos = spawnData.Position;

    // work with Lua-CustomSpawnPointPointMaker format
    if (Array.isArray(pos)) {
        return { x: pos[0], y: pos[1], z: pos[2] }
    }

    return pos;
}

const updateSpawnPoints = (database, config, spawnConfig, playerOffraidPosition, entrypoints) => {
    // Remove all player spawn points
    MAPLIST.forEach(mapName => {
        if (mapName !== 'laboratory') {
            removePlayerSpawns(database, mapName);
        }
    })

    // Add new spawn points according to player offraid position
    Object.keys(config.infiltrations[playerOffraidPosition]).forEach(mapName => {
        const spawnpoints = config.infiltrations[playerOffraidPosition][mapName];

        if (spawnpoints) {
            spawnpoints.forEach(spawnId => {
                const spawnData = spawnConfig[mapName] && spawnConfig[mapName][spawnId];
                if (spawnData) {
                    const spawnPoint = createSpawnPoint(getPosition(spawnData), spawnData.Rotation, entrypoints[mapName]);
                    addSpawnPoint(database, mapName, spawnPoint);
                }
            });



        }
    })
}

const getEntryPointsForMaps = (database) => {
    const result = {};

    MAPLIST.forEach(mapName => {
        result[mapName] = [];

        database.locations[mapName].base.exits.forEach(exitPayload => {
            const entrypoints = exitPayload.EntryPoints.split(',').map(x => x.trim()).filter(x => !!x);
            result[mapName] = [...result[mapName], ...entrypoints];
        })
    });

    return result;
}

const STASH_ID = '5811ce772459770e9e5f9532' //Edge of darkness stash 10x68

class PathToTarkov {
    constructor() {
        const mod = require("./package.json");
        const config = require("./config/config.json");
        const spawnConfig = require("./config/player_spawnpoints.json");


        if (!config.enabled) {
            Logger.warning('=> PathToTarkov is disabled!')
            return;
        }

        Logger.info(`Loading: ${mod.name} v${mod.version}`);


        let offraidPosition;

        try {
            offraidPosition = fs.readFileSync(OFFRAID_POSITION_FILE, 'utf8').trim();
        } catch (_e) {
            // if the file does not exist, set the offraid position with initial_offraid_position in config
            offraidPosition = config.initial_offraid_position;

            // then save the file
            fs.writeFileSync(OFFRAID_POSITION_FILE, offraidPosition);
        }

        ModLoader.onLoad[mod.name] = function () {
            const database = DatabaseServer.tables;
            const entrypoints = getEntryPointsForMaps(database);

            const stashController = new StashController(database);

            // Lock maps according to the saved offraid position
            updateLockedMaps(database, config, offraidPosition);

            Logger.info(`=> PathToTarkov: player offraid position initialized to '${offraidPosition}'`)

            // create spawn points
            updateSpawnPoints(database, config, spawnConfig, offraidPosition, entrypoints)

            // Remove extracts restrictions
            initialExtractionsTweaks(database, config);

            // setup extracts according to config
            Object.keys(config.exfiltrations).forEach(mapName => {
                const extractPoints = Object.keys(config.exfiltrations[mapName]);
                database.locations[mapName].base.exits = extractPoints.map(createExitPoint(entrypoints[mapName]));
            });

            // lock stash if needed
            if (config.hideout_stash_access_restriction && !config.hideout_stash_access_via.includes(offraidPosition)) {
                stashController.lock();
            }

            // TODO: lock/unlock traders if needed

            // detect if the player is a scav
            let isPlayerScav = null;

            // detect the map name
            let currentLocationName = null;

            let endRaidCb = () => { };

            const vanillaSaveProgress = InraidController.saveProgress;
            InraidController.saveProgress = (offraidData, sessionId) => {
                isPlayerScav = offraidData.isPlayerScav;
                currentLocationName = SaveServer.profiles[sessionId].inraid.location.toLowerCase();

                // TODO: remove
                Logger.info(`=> save currentLocationName progress: ${currentLocationName}`);

                // TODO: pass `isPlayerScav` and `currentLocationName` as arguments (`endRaidCb`)
                endRaidCb();
                endRaidCb = () => { };
                currentLocationName = null;
                return vanillaSaveProgress(offraidData, sessionId);
            }

            const vanillaEndOfflineRaid = MatchController.endOfflineRaid;

            // change the player offraid position according to the extract point used during the raid
            MatchController.endOfflineRaid = (info, sessionId) => {
                // TODO: remove
                Logger.info('=> end of raid detected')

                endRaidCb = () => {
                    if (isPlayerScav && !config.player_scav_move_offraid_position) {
                        return;
                    }

                    const playerDied = !info.exitName;

                    if (config.reset_offraid_position_on_player_die && playerDied) {
                        // TODO refactor: because used twice
                        const prevPosition = offraidPosition;
                        offraidPosition = config.initial_offraid_position;

                        if (prevPosition !== offraidPosition) {
                            fs.writeFileSync(OFFRAID_POSITION_FILE, offraidPosition);
                            Logger.info(`=> PathToTarkov: player died, the offraid position has changed to '${offraidPosition}'`)
                        }
                        updateLockedMaps(database, config, offraidPosition);
                        updateSpawnPoints(database, config, spawnConfig, offraidPosition, entrypoints);

                        // lock/unlock stash if needed
                        if (config.hideout_stash_access_restriction && config.hideout_stash_access_via.includes(offraidPosition)) {
                            stashController.unlock();
                        } else if (config.hideout_stash_access_restriction && !config.hideout_stash_access_via.includes(offraidPosition)) {
                            stashController.lock();
                        }

                        // TODO: lock/unlock traders if needed

                        return;
                    }

                    const extractsConf = config.exfiltrations[currentLocationName];

                    if (extractsConf && extractsConf[info.exitName]) {
                        const prevPosition = offraidPosition;
                        offraidPosition = extractsConf[info.exitName];

                        if (prevPosition !== offraidPosition) {
                            fs.writeFileSync(OFFRAID_POSITION_FILE, offraidPosition);
                            Logger.info(`=> PathToTarkov: player offraid position changed to '${offraidPosition}'`)
                        }
                        updateLockedMaps(database, config, offraidPosition);
                        updateSpawnPoints(database, config, spawnConfig, offraidPosition, entrypoints);

                        // lock/unlock stash if needed
                        if (config.hideout_stash_access_restriction && config.hideout_stash_access_via.includes(offraidPosition)) {
                            stashController.unlock();
                        } else if (config.hideout_stash_access_restriction && !config.hideout_stash_access_via.includes(offraidPosition)) {
                            stashController.lock();
                        }

                        // TODO: lock/unlock traders if needed

                    }
                }

                return vanillaEndOfflineRaid(info, sessionId);
            }

            Logger.success('=> PathToTarkov loaded!');
        };
    }
}

module.exports = new PathToTarkov();