"use strict";

// deep clone taken on stackoverflow
function deepClone(item) {
    if (!item) { return item; } // null, undefined values check

    var types = [Number, String, Boolean],
        result;

    // normalizing primitives if someone did new String('aaa'), or new Number('444');
    types.forEach(function (type) {
        if (item instanceof type) {
            result = type(item);
        }
    });

    if (typeof result == "undefined") {
        if (Object.prototype.toString.call(item) === "[object Array]") {
            result = [];
            item.forEach(function (child, index, array) {
                result[index] = deepClone(child);
            });
        } else if (typeof item == "object") {
            // testing that this is DOM
            if (item.nodeType && typeof item.cloneNode == "function") {
                result = item.cloneNode(true);
            } else if (!item.prototype) { // check that this is a literal
                if (item instanceof Date) {
                    result = new Date(item);
                } else {
                    // it is an object literal
                    result = {};
                    for (var i in item) {
                        result[i] = deepClone(item[i]);
                    }
                }
            } else {
                // just keep the reference
                result = item;
                // depending what you would like here,
            }
        } else {
            result = item;
        }
    }

    return result;
}

const isValidMap = (mapName) => {
    return mapName !== 'base' && mapName !== 'hideout' && mapName !== 'privatearea' && mapName !== 'private area' && mapName !== 'develop';
}

function checkAccessVia(access_via, x) {
    return access_via === '*' || access_via[0] === '*' || access_via.includes(x);
}

function noop() { }

const PRAPOR_ID = '54cb50c76803fa8b248b4571';

const STASH_IDS = [
    "566abbc34bdc2d92178b4576", // Standard
    "5811ce572459770cba1a34ea", // Left Behind
    "5811ce662459770f6f490f32", // Prepare for escape
    "5811ce772459770e9e5f9532"  // Edge of darkness
];

const GENERIC_ITEM_ID = '54009119af1c881c07000029';

const EMPTY_STASH_ID = "PathToTarkov_Empty_Stash";

const isIgnoredArea = (area) => {

    if (typeof area.type !== 'number') { // invalid area
        return true;
    }

    if (area.type === 4) { // generator (prevent a crash at start)
        return true;
    } else if (area.type === 6) { // water collector (prevent infinite loading menu at start)
        return true;
    } else if (area.type === 16) { // place of fame
        return true;
    } else if (area.type === 17) { // air filtering unit (prevent a crash at start)
        return true;
    } else if (area.type === 21) { // christmas tree
        return true;
    }

    return false;
}

const changeRestrictionsInRaid = (config) => {
    const database = DatabaseServer.tables;

    const restrictionsConfig = config.restrictions_in_raid || {};

    database.globals.config.RestrictionsInRaid.forEach(payload => {

        if (restrictionsConfig[payload.TemplateId]) {
            payload.Value = restrictionsConfig[payload.TemplateId].Value;
        }
    })
}


class StashController {
    constructor(getConfig) {
        this.getConfig = getConfig;

        // null means stash is unlocked
        this.stashSizes = null;
        this.items = DatabaseServer.tables.templates.items
        this.areas = DatabaseServer.tables.hideout.areas;
    }

    getInventory(sessionId) {
        return SaveServer.profiles[sessionId].characters.pmc.Inventory;
    }

    _disableHideout() {
        this.areas.forEach(area => {
            if (!isIgnoredArea(area)) {
                area.enabled = false;
            }
        })
    }

    _enableHideout() {
        this.areas.forEach(area => {
            if (!isIgnoredArea(area)) {
                area.enabled = true;
            }
        })
    }

    initProfile(sessionId) {
        const profile = SaveServer.profiles[sessionId];

        if (!profile.PathToTarkov) {
            profile.PathToTarkov = {};
        }

        if (!profile.PathToTarkov.mainStashId) {
            profile.PathToTarkov.mainStashId = this.getInventory(sessionId).stash;
        }
    }

    _getMainStashId(sessionId) {
        return SaveServer.profiles[sessionId].PathToTarkov.mainStashId;
    }

    _setSize(n) {
        let shouldCollectStashSizes = false;

        if (!this.stashSizes) {
            this.stashSizes = {};
            shouldCollectStashSizes = true;
        }

        STASH_IDS.forEach(stashId => {
            const gridProps = this.items[stashId]._props.Grids[0]._props;
            if (shouldCollectStashSizes) {
                this.stashSizes[stashId] = gridProps.cellsV;
            }

            gridProps.cellsV = n;
        });
    }

    _resetSize() {
        if (!this.stashSizes) {
            return;
        }

        STASH_IDS.forEach(stashId => {
            this.items[stashId]._props.Grids[0]._props.cellsV = this.stashSizes[stashId];
        });

        this.stashSizes = null;
    }

    _setMainStash(sessionId) {
        const inventory = this.getInventory(sessionId);
        inventory.stash = this._getMainStashId(sessionId);
    }

    _setSecondaryStash(stashId, sessionId) {
        const inventory = SaveServer.profiles[sessionId].characters.pmc.Inventory;
        inventory.stash = stashId;

        if (!inventory.items.find(item => item._id === stashId)) {
            inventory.items.push({ _id: stashId, _tpl: STASH_IDS[0] });
        }
    }

    updateStash(offraidPosition, sessionId) {
        if (!this.getConfig().hideout_multistash_enabled) {
            return;
        }

        const mainStashAvailable = checkAccessVia(this.getConfig().hideout_main_stash_access_via, offraidPosition);
        const secondaryStash = this.getConfig().hideout_secondary_stashes.find(stash => checkAccessVia(stash.access_via, offraidPosition));

        if (mainStashAvailable) {
            this._enableHideout(sessionId);
            this._resetSize();
            this._setMainStash(sessionId);
        }
        else if (secondaryStash) {
            this._disableHideout(sessionId);
            this._setSize(secondaryStash.size);
            this._setSecondaryStash(secondaryStash.id, sessionId)
        }
        else {
            this._disableHideout(sessionId);
            this._setSize(0);
            this._setSecondaryStash(EMPTY_STASH_ID, sessionId)
        }
    }

}

class TraderController {
    constructor(getConfig) {
        this.getConfig = getConfig;
        this.traders = DatabaseServer.tables.traders;
        this.locales = DatabaseServer.tables.locales;
    }

    initTraders() {
        const config = this.getConfig();
        const tradersConfig = config.traders_config;
        const praporTrader = this.traders[PRAPOR_ID];

        Object.keys(tradersConfig).forEach(traderId => {
            const trader = this.traders[traderId];

            if (trader) {
                // be able to lock a trader
                trader.base.unlockedByDefault = false;

                if (tradersConfig[traderId].override_description) {
                    // change trader location in descriptions

                    Object.keys(this.locales.global).forEach(locale => {
                        const locationDescription = tradersConfig[traderId].location_description;
                        if (locationDescription && locationDescription[locale]) {
                            const traderLocales = this.locales.global[locale].trading[traderId];

                            if (traderLocales) {
                                traderLocales.Location = locationDescription[locale];
                            } else {
                                Logger.warning(`=> PathToTarkov: no locales '${locale}' found for trader '${traderId}'`);
                            }
                        }
                    });
                }


                // insurances update
                if (tradersConfig[traderId].insurance_always_enabled) {
                    const trader = this.traders[traderId];
                    const insuranceTraderConfig = tradersConfig[traderId].insurance_config || {};

                    if (!trader) {
                        Logger.error(`=> PathToTarkov: unknown trader found '${traderId}'`)
                    }

                    if (!trader.dialogue) { // prevent several issues (freeze and crash)
                        trader.dialogue = praporTrader.dialogue;
                    }

                    InsuranceConfig.insuranceMultiplier[traderId] = insuranceTraderConfig.insuranceMultiplier || 0.30;

                    trader.base.insurance.availability = true;
                    trader.base.insurance.min_payment = insuranceTraderConfig.min_payment || 0;
                    trader.base.insurance.min_return_hour = insuranceTraderConfig.min_return_hour || 1;
                    trader.base.insurance.max_return_hour = insuranceTraderConfig.max_return_hour || 2;
                    trader.base.insurance.max_storage_time = insuranceTraderConfig.max_storage_time || 480;

                    trader.base.loyaltyLevels.forEach(payloadLevel => {
                        payloadLevel.insurance_price_coef = insuranceTraderConfig.insurance_price_coef || 1;
                    })
                }

                // repairs update
                if (tradersConfig[traderId].repair_always_enabled) {
                    const trader = this.traders[traderId];
                    const repairTraderConfig = tradersConfig[traderId].repair_config || {};

                    if (!trader) {
                        Logger.error(`=> PathToTarkov: unknown trader found '${traderId}'`)
                    }

                    trader.base.repair.availability = true;

                    if (repairTraderConfig.quality) {
                        trader.base.repair.quality = repairTraderConfig.quality
                    }

                    if (repairTraderConfig.currency) {
                        trader.base.repair.currency = repairTraderConfig.currency
                    }

                    if (typeof repairTraderConfig.currency_coefficient == 'number') {
                        trader.base.repair.currency_coefficient = repairTraderConfig.currency_coefficient
                    }

                    if (typeof repairTraderConfig.repair_price_coef == 'number') {
                        trader.base.loyaltyLevels.forEach(payloadLevel => {
                            payloadLevel.repair_price_coef = repairTraderConfig.repair_price_coef;
                        })
                    }
                }

            } else if (!this.getConfig().traders_config[traderId].disable_warning) {
                Logger.warning(`=> PathToTarkov: Unknown trader id found during init: '${traderId}'`);
            }
        })
    }

    updateTraders(offraidPosition, sessionId) {
        const tradersConfig = this.getConfig().traders_config;
        const tradersInfo = SaveServer.profiles[sessionId].characters.pmc.TradersInfo;

        Object.keys(tradersConfig).forEach(traderId => {

            const unlocked = checkAccessVia(tradersConfig[traderId].access_via, offraidPosition);

            if (tradersInfo[traderId]) {
                tradersInfo[traderId].unlocked = unlocked;
            }


        })
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

const getPosition = (spawnData) => {
    const pos = spawnData.Position;

    // work with Lua-CustomSpawnPointPointMaker format
    if (Array.isArray(pos)) {
        return { x: pos[0], y: pos[1], z: pos[2] }
    }

    return pos;
}

const getEntryPointsForMaps = () => {
    const database = DatabaseServer.tables;

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

const onGameStart = (cb) => {
    const vanillaGameStart = GameController.gameStart;

    GameController.gameStart = (url, info, sessionId) => {
        const result = vanillaGameStart(url, info, sessionId);
        cb(sessionId);
        return result;
    }
}

const onProfileCreated = (cb) => {
    const vanillaCreateProfile = ProfileController.createProfile;

    ProfileController.createProfile = (info, sessionId) => {
        const result = vanillaCreateProfile(info, sessionId);
        cb(info, sessionId);
        return result;
    }
}

class OffraidRegenController {
    constructor(getConfig) {
        this.regen_db = DatabaseServer.tables.globals.config.Health.Effects.Regeneration;
        this.getRegenConfig = () => getConfig().offraid_regen_config;

        this.regen_hydration_enabled = true;
        this.regen_energy_enabled = true;
        this.regen_health_enabled = true;

        // saved values
        this.energy_value = null;
        this.hydration_value = null;
        this.bodyhealth_values = {};
    }

    _getEmptyBodyHealthValues() {
        const result = {};

        Object.keys(this.bodyhealth_values).forEach(bodyPart => {
            result[bodyPart] = { Value: 0 };
        });

        return result;
    }

    // this will snapshot the current regen config
    init() {
        this.energy_value = this.regen_db.Energy;
        this.hydration_value = this.regen_db.Hydration;

        Object.keys(this.regen_db.BodyHealth).forEach(bodyPart => {
            this.bodyhealth_values[bodyPart] = { Value: this.regen_db.BodyHealth[bodyPart].Value };
        })
    }

    _enableHydration() {
        if (this.regen_hydration_enabled) {
            return;
        }

        this.regen_db.Hydration = this.hydration_value;
        this.regen_hydration_enabled = true;
    }

    _disableHydration() {
        if (!this.regen_hydration_enabled) {
            return;
        }

        this.regen_db.Hydration = 0;
        this.regen_hydration_enabled = false;
    }

    _enableEnergy() {
        if (this.regen_energy_enabled) {
            return;
        }

        this.regen_db.Energy = this.energy_value;
        this.regen_energy_enabled = true;
    }

    _disableEnergy() {
        if (!this.regen_energy_enabled) {
            return;
        }

        this.regen_db.Energy = 0;
        this.regen_energy_enabled = false;
    }

    _enableHealth() {
        if (this.regen_health_enabled) {
            return;
        }

        this.regen_db.BodyHealth = this.bodyhealth_values;
        this.regen_health_enabled = true;
    }

    _disableHealth() {
        if (!this.regen_health_enabled) {
            return;
        }

        this.regen_db.BodyHealth = this._getEmptyBodyHealthValues();
        this.regen_health_enabled = false;
    }

    updateOffraidRegen(offraidPosition) {
        if (checkAccessVia(this.getRegenConfig().hydration.access_via, offraidPosition)) {
            this._enableHydration();
        } else {
            this._disableHydration();
        }

        if (checkAccessVia(this.getRegenConfig().energy.access_via, offraidPosition)) {
            this._enableEnergy();
        } else {
            this._disableEnergy();
        }

        if (checkAccessVia(this.getRegenConfig().health.access_via, offraidPosition)) {
            this._enableHealth();
        } else {
            this._disableHealth();
        }
    }
}

class PathToTarkovController {
    constructor(config, spawnConfig) {
        this.config = config;
        this.spawnConfig = spawnConfig;

        this.entrypoints = getEntryPointsForMaps();
        this.stashController = new StashController(() => this.config);
        this.traderController = new TraderController(() => this.config);
        this.offraidRegenController = new OffraidRegenController(() => this.config);
    }

    init(sessionId) {
        this.stashController.initProfile(sessionId);
        this.offraidRegenController.init();

        const offraidPosition = this.getOffraidPosition(sessionId)
        this.updateOffraidPosition(sessionId, offraidPosition);

        changeRestrictionsInRaid(this.config);

        this._hijackLuasCustomSpawnPointsUpdate();
    }

    // This is a fix to ensure Lua's Custom Spawn Point mod do not override player spawn point
    _hijackLuasCustomSpawnPointsUpdate() {
        // if disabled via config
        if (this.config.bypass_luas_custom_spawn_points_tweak) {
            return;
        }

        const LUAS_CSP_MODNAME = "Lua-CustomSpawnPoints";
        const locationsRoute = HttpRouter.onStaticRoute["/client/locations"];
        const luasUpdateFn = locationsRoute[LUAS_CSP_MODNAME];

        // if Lua's Custom Spawn Points is not loaded
        if (!luasUpdateFn) {
            return
        }

        locationsRoute[LUAS_CSP_MODNAME] = (url, info, sessionId) => {
            // _response is not used since we need to call `LocationController.generateAll()` after `_updateSpawnPoints`
            const _response = luasUpdateFn(url, info, sessionId);

            this._updateSpawnPoints(this.getOffraidPosition(sessionId));

            return HttpResponse.getBody(LocationController.generateAll());;
        }

        Logger.info("=> PathToTarkov: Lua's Custom Spawn Points Update function hijacked!");
    }

    _addSpawnPoint(mapName, spawnPoint) {
        DatabaseServer.tables.locations[mapName].base.SpawnPointParams.push(spawnPoint)
    }

    _removePlayerSpawns(mapName) {
        const base = DatabaseServer.tables.locations[mapName].base;

        base.SpawnPointParams = base.SpawnPointParams.filter(params => {
            // remove Player from Categories array
            params.Categories = params.Categories.filter(cat => cat !== 'Player');

            if (!params.Categories.length) {
                // remove the spawn point if Categories is empty
                return false;
            }

            return true;
        });
    }


    _removeAllPlayerSpawns() {
        MAPLIST.forEach(mapName => {
            if (mapName !== 'laboratory') {
                this._removePlayerSpawns(mapName);
            }
        })
    }

    _updateLockedMaps(offraidPosition) {
        const unlockedMaps = this.config.infiltrations[offraidPosition];

        const database = DatabaseServer.tables;

        MAPLIST.forEach(mapName => {
            if (mapName === 'laboratory') {
                const playerIsAtLab = checkAccessVia(this.config.laboratory_access_via, offraidPosition)
                const unlocked = !this.config.laboratory_access_restriction || Boolean(playerIsAtLab);
                database.locations[mapName].base.Locked = !unlocked;
            } else if (mapName !== 'laboratory') {
                database.locations[mapName].base.Locked = !unlockedMaps[mapName];
            }
        })
    }


    _updateSpawnPoints(offraidPosition) {
        // Remove all player spawn points
        this._removeAllPlayerSpawns();

        // Add new spawn points according to player offraid position
        Object.keys(this.config.infiltrations[offraidPosition]).forEach(mapName => {
            const spawnpoints = this.config.infiltrations[offraidPosition][mapName];

            if (spawnpoints) {
                spawnpoints.forEach(spawnId => {
                    const spawnData = this.spawnConfig[mapName] && this.spawnConfig[mapName][spawnId];
                    if (spawnData) {
                        const spawnPoint = createSpawnPoint(getPosition(spawnData), spawnData.Rotation, this.entrypoints[mapName]);
                        this._addSpawnPoint(mapName, spawnPoint);
                    }
                });



            }
        })
    }

    initExfiltrations() {
        const locations = DatabaseServer.tables.locations;

        // Extraction tweaks
        for (let i in locations) {
            if (isValidMap(i)) {
                for (let x in locations[i].base.exits) {
                    // Remove extracts restrictions
                    if (this.config.remove_all_exfils_restrictions && locations[i].base.exits[x].Name !== "EXFIL_Train" && !locations[i].base.exits[x].Name.includes("lab") || locations[i].base.exits[x].Name === "lab_Vent") {
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

        const database = DatabaseServer.tables;

        Object.keys(this.config.exfiltrations).forEach(mapName => {
            const extractPoints = Object.keys(this.config.exfiltrations[mapName]);
            database.locations[mapName].base.exits = extractPoints.map(createExitPoint(this.entrypoints[mapName]));
        });
    }

    getOffraidPosition = (sessionId) => {
        const profile = SaveServer.profiles[sessionId];

        if (!profile.PathToTarkov) {
            profile.PathToTarkov = {};
        }

        if (!profile.PathToTarkov.offraidPosition) {
            profile.PathToTarkov.offraidPosition = this.config.initial_offraid_position;
        }

        return profile.PathToTarkov.offraidPosition;
    }

    updateOffraidPosition(sessionId, offraidPosition) {
        if (!offraidPosition) {
            offraidPosition = this.getOffraidPosition(sessionId);
        }

        const profile = SaveServer.profiles[sessionId];

        const prevOffraidPosition = profile.PathToTarkov.offraidPosition;
        profile.PathToTarkov.offraidPosition = offraidPosition;

        if (prevOffraidPosition !== offraidPosition) {
            Logger.info(`=> PathToTarkov: player offraid position changed to '${offraidPosition}'`)
        }
        this._updateLockedMaps(offraidPosition);
        this._updateSpawnPoints(offraidPosition);

        this.stashController.updateStash(offraidPosition, sessionId);
        this.offraidRegenController.updateOffraidRegen(offraidPosition);

        if (this.config.traders_access_restriction) {
            this.traderController.updateTraders(offraidPosition, sessionId);
        }

        SaveServer.saveProfile(sessionId);
    }
}

// Used for uninstallation process
const purgeProfiles = (config) => {
    // be sure to be able to read `SaveServer.profiles`
    SaveServer.load();

    Object.keys(SaveServer.profiles).forEach(sessionId => {
        const profile = SaveServer.profiles[sessionId];
        const mainStashId = profile.PathToTarkov.mainStashId

        if (profile && profile.PathToTarkov && mainStashId && mainStashId !== profile.characters.pmc.Inventory.stash) {
            Logger.success(`=> PathToTarkov: restore the selected stash to main stash for profile '${profile.info.username}'`)
            profile.characters.pmc.Inventory.stash = mainStashId;
        }

        let nbTradersRestored = 0;
        Object.keys(config.traders_config).forEach(traderId => {
            const trader = profile.characters.pmc.TradersInfo[traderId];

            if (trader && trader.unlocked === false) {
                // TODO 1: check for jaeger quest
                // TODO 2: check if player is level 15 (for flea market aka ragfair)
                trader.unlocked = true;
                nbTradersRestored += 1;
            }
        });

        if (nbTradersRestored > 0) {
            Logger.success(`=> PathToTarkov: ${nbTradersRestored} trader${nbTradersRestored === 1 ? '' : 's'} restored for profile '${profile.info.username}'`)
        }
    })

    SaveServer.save();
}

class PathToTarkov {
    constructor() {
        const mod = require("./package.json");
        const config = require("./config/config.json");
        const spawnConfig = require("./config/player_spawnpoints.json");

        if (!config.enabled) {
            Logger.warning('=> PathToTarkov is disabled!')

            if (config.bypass_uninstall_procedure === true) {
                Logger.warning('=> PathToTarkov: uninstall process aborted because \'bypass_uninstall_procedure\' field is true in config.json');
                return;
            }

            purgeProfiles(config);

            return;
        }

        Logger.info(`Loading: ${mod.name} v${mod.version}`);

        const pathToTarkovController = new PathToTarkovController(config, spawnConfig);

        // setup api for modders
        const onStartCallbacks = [];

        const executeAPICallbacks = (sessionId) => {
            onStartCallbacks.forEach(cb => cb(sessionId));
        }

        globalThis.PathToTarkovAPI = {
            onStart: (cb) => {
                if (!cb) {
                    return;
                }

                onStartCallbacks.push(cb);
            },
            getConfig: () => deepClone(pathToTarkovController.config),
            getSpawnConfig: () => deepClone(pathToTarkovController.spawnConfig),
            setConfig: (newConfig) => {
                pathToTarkovController.config = newConfig;
            },
            setSpawnConfig: (newSpawnConfig) => {
                pathToTarkovController.spawnConfig = newSpawnConfig;
            },
            refresh: (sessionId) => {
                pathToTarkovController.initExfiltrations();

                if (pathToTarkovController.config.traders_access_restriction) {
                    pathToTarkovController.traderController.initTraders();
                }

                pathToTarkovController.init(sessionId);
            }
        };

        ModLoader.onLoad[mod.name] = function () {
            pathToTarkovController.initExfiltrations();

            if (pathToTarkovController.config.traders_access_restriction) {
                pathToTarkovController.traderController.initTraders();
            }

            onGameStart((sessionId) => {
                if (!pathToTarkovController.stashController.getInventory(sessionId)) {
                    // no pmc data found, will be handled by `onProfileCreated`
                    return;
                }

                pathToTarkovController.init(sessionId);
                executeAPICallbacks(sessionId);

                Logger.info(`=> PathToTarkov: game started!`);
            });

            onProfileCreated((_info, sessionId) => {
                pathToTarkovController.init(sessionId);
                executeAPICallbacks(sessionId);

                Logger.info(`=> PathToTarkov: pmc created!`);
            });

            let endRaidCb = noop;
            let endRaidCbExecuted = false;
            let savedCurrentLocationName = null;
            let savedIsPlayerScav = null;

            const vanillaSaveProgress = InraidController.saveProgress;
            InraidController.saveProgress = (offraidData, sessionId) => {
                const isPlayerScav = offraidData.isPlayerScav;
                const currentLocationName = SaveServer.profiles[sessionId].inraid.location.toLowerCase();

                if (endRaidCb !== noop) {
                    endRaidCb(currentLocationName, isPlayerScav);
                    endRaidCb = noop;
                } else if (!endRaidCbExecuted) {
                    savedCurrentLocationName = currentLocationName;
                    savedIsPlayerScav = isPlayerScav;
                }

                endRaidCbExecuted = false;
                return vanillaSaveProgress(offraidData, sessionId);
            }

            const vanillaEndOfflineRaid = MatchController.endOfflineRaid;

            // change the player offraid position according to the extract point used during the raid
            MatchController.endOfflineRaid = (info, sessionId) => {
                endRaidCb = (currentLocationName, isPlayerScav) => {
                    if (isPlayerScav && !pathToTarkovController.config.player_scav_move_offraid_position) {
                        return;
                    }

                    const playerDied = !info.exitName;

                    if (pathToTarkovController.config.reset_offraid_position_on_player_die && playerDied) {
                        pathToTarkovController.updateOffraidPosition(sessionId, pathToTarkovController.config.initial_offraid_position);
                        return;
                    }

                    const extractsConf = pathToTarkovController.config.exfiltrations[currentLocationName];
                    const newOffraidPosition = extractsConf && extractsConf[info.exitName];

                    if (newOffraidPosition) {
                        pathToTarkovController.updateOffraidPosition(sessionId, newOffraidPosition);
                    }
                }

                if (savedCurrentLocationName !== null && savedIsPlayerScav !== null) {
                    endRaidCb(savedCurrentLocationName, savedIsPlayerScav);
                    endRaidCb = noop;
                    endRaidCbExecuted = true;
                    savedCurrentLocationName = null;
                    savedIsPlayerScav = null;
                }

                return vanillaEndOfflineRaid(info, sessionId);
            }

            Logger.success('=> PathToTarkov loaded!');

        };
    }
}

module.exports = new PathToTarkov();