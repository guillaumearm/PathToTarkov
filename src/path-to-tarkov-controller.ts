import type { BodyHealth, Effects } from "@spt-aki/models/eft/common/IGlobals";
import type { SpawnPointParam } from "@spt-aki/models/eft/common/ILocationBase";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import {
  Config,
  ConfigGetter,
  MAPLIST,
  MapName,
  PRAPOR_ID,
  Profile,
  SpawnConfig,
} from "./config";
import {
  changeRestrictionsInRaid,
  checkAccessVia,
  createExitPoint,
  createSpawnPoint,
  EntryPoints,
  getEntryPointsForMaps,
} from "./helpers";
import { StashController } from "./stash-controller";
import { TradersController } from "./traders-controller";

class OffraidRegenController {
  private regen_db: Effects["Regeneration"];
  private getRegenConfig: () => Config["offraid_regen_config"];

  private regen_hydration_enabled = true;
  private regen_energy_enabled = true;
  private regen_health_enabled = true;

  // saved values
  private energy_value: number | null = null;
  private hydration_value: number | null = null;
  private bodyhealth_values: Partial<BodyHealth> = {};

  constructor(getConfig: ConfigGetter, private db: DatabaseServer) {
    const regen = db.getTables().globals?.config.Health.Effects.Regeneration;

    if (!regen) {
      throw new Error(
        "Fatal OffraidRegenController constructor: unable to get Regeneration health effects"
      );
    }

    this.regen_db = regen;
    this.getRegenConfig = () => getConfig().offraid_regen_config;
  }

  private _getEmptyBodyHealthValues(): BodyHealth {
    const result: Partial<BodyHealth> = {};

    Object.keys(this.bodyhealth_values).forEach((bodyPart) => {
      result[bodyPart as keyof BodyHealth] = { Value: 0 };
    });

    return result as BodyHealth;
  }

  // this will snapshot the current regen config
  init(): void {
    this.energy_value = this.regen_db.Energy;
    this.hydration_value = this.regen_db.Hydration;

    Object.keys(this.regen_db.BodyHealth).forEach((bodyPart) => {
      this.bodyhealth_values[bodyPart as keyof BodyHealth] = {
        Value: this.regen_db.BodyHealth[bodyPart as keyof BodyHealth].Value,
      };
    });
  }

  _enableHydration() {
    if (this.regen_hydration_enabled) {
      return;
    }

    this.regen_db.Hydration = this.hydration_value ?? 0;
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

    this.regen_db.Energy = this.energy_value ?? 0;
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

    this.regen_db.BodyHealth = this.bodyhealth_values as BodyHealth;
    this.regen_health_enabled = true;
  }

  _disableHealth() {
    if (!this.regen_health_enabled) {
      return;
    }

    this.regen_db.BodyHealth = this._getEmptyBodyHealthValues();
    this.regen_health_enabled = false;
  }

  updateOffraidRegen(offraidPosition: string): void {
    if (
      checkAccessVia(
        this.getRegenConfig().hydration.access_via,
        offraidPosition
      )
    ) {
      this._enableHydration();
    } else {
      this._disableHydration();
    }

    if (
      checkAccessVia(this.getRegenConfig().energy.access_via, offraidPosition)
    ) {
      this._enableEnergy();
    } else {
      this._disableEnergy();
    }

    if (
      checkAccessVia(this.getRegenConfig().health.access_via, offraidPosition)
    ) {
      this._enableHealth();
    } else {
      this._disableHealth();
    }
  }
}

export class PathToTarkovController {
  public stashController: StashController;
  public tradersController: TradersController;
  private offraidRegenController: OffraidRegenController;

  private entrypoints: EntryPoints;

  constructor(
    public config: Config,
    public spawnConfig: SpawnConfig,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    configServer: ConfigServer,
    private readonly logger: ILogger,
    private readonly debug: (data: string) => void
  ) {
    this.stashController = new StashController(
      () => this.config,
      db,
      saveServer
    );
    this.tradersController = new TradersController(
      () => this.config,
      db,
      saveServer,
      configServer,
      this.logger
    );
    this.offraidRegenController = new OffraidRegenController(
      () => this.config,
      db
    );

    this.entrypoints = getEntryPointsForMaps(db);
  }

  init(sessionId: string): void {
    this.stashController.initProfile(sessionId);
    this.offraidRegenController.init();

    const offraidPosition = this.getOffraidPosition(sessionId);
    this.updateOffraidPosition(sessionId, offraidPosition);

    changeRestrictionsInRaid(this.config, this.db);
    // this._hijackLuasCustomSpawnPointsUpdate();
  }

  // fix for missing `insuranceStart` property when player died
  fixInsuranceDialogues(): void {
    const traders = this.db.getTables().traders ?? {};
    const praporTrader = traders?.[PRAPOR_ID];

    Object.keys(traders).forEach((traderId) => {
      const trader = traders?.[traderId];
      if (trader && !trader.dialogue) {
        trader.dialogue = praporTrader?.dialogue;
      }
    });
  }

  // DISABLED since 3.0.0
  // This is a fix to ensure Lua's Custom Spawn Point mod do not override player spawn point
  // _hijackLuasCustomSpawnPointsUpdate(): void {
  //   // if disabled via config
  //   if (this.config.bypass_luas_custom_spawn_points_tweak) {
  //     return;
  //   }

  //   const LUAS_CSP_MODNAME = "Lua-CustomSpawnPoints";
  //   const locationsRoute = HttpRouter.onStaticRoute["/client/locations"];
  //   const luasUpdateFn = locationsRoute[LUAS_CSP_MODNAME];

  //   // if Lua's Custom Spawn Points is not loaded
  //   if (!luasUpdateFn) {
  //     return;
  //   }

  //   locationsRoute[LUAS_CSP_MODNAME] = (url, info, sessionId) => {
  //     // _response is not used since we need to call `LocationController.generateAll()` after `_updateSpawnPoints`
  //     const _response = luasUpdateFn(url, info, sessionId);

  //     this._updateSpawnPoints(this.getOffraidPosition(sessionId));

  //     return HttpResponse.getBody(LocationController.generateAll());
  //   };

  //   Logger.info(
  //     "=> PathToTarkov: Lua's Custom Spawn Points Update function hijacked!"
  //   );
  // }

  private addSpawnPoint(mapName: string, spawnPoint: SpawnPointParam): void {
    const location = this.db.getTables().locations?.[mapName as MapName];

    location?.base.SpawnPointParams.push(spawnPoint);
  }

  private removePlayerSpawns(mapName: string): void {
    const location = this.db.getTables().locations?.[mapName as MapName];
    const base = location?.base;

    if (!base) {
      return;
    }

    base.SpawnPointParams = base.SpawnPointParams.filter((params) => {
      // remove Player from Categories array
      params.Categories = params.Categories.filter((cat) => cat !== "Player");

      if (!params.Categories.length) {
        // remove the spawn point if Categories is empty
        return false;
      }

      return true;
    });
  }

  private removeAllPlayerSpawns(): void {
    MAPLIST.forEach((mapName) => {
      if (mapName !== "laboratory") {
        this.removePlayerSpawns(mapName);
      }
    });
  }

  private updateLockedMaps(offraidPosition: string): void {
    const unlockedMaps = this.config.infiltrations[offraidPosition];
    const locations = this.db.getTables().locations;

    MAPLIST.forEach((mapName) => {
      if (mapName === "laboratory") {
        const playerIsAtLab = checkAccessVia(
          this.config.laboratory_access_via,
          offraidPosition
        );
        const unlocked =
          !this.config.laboratory_access_restriction || Boolean(playerIsAtLab);

        const location = locations?.[mapName as MapName];

        if (location) {
          location.base.Locked = !unlocked;
        }
      } else if (mapName !== "laboratory") {
        const locked = !unlockedMaps[mapName as MapName];
        const location = locations?.[mapName as MapName];

        if (location) {
          location.base.Locked = locked;
        }
      }
    });
  }

  private updateSpawnPoints(offraidPosition: string): void {
    // Remove all player spawn points
    this.removeAllPlayerSpawns();

    // Add new spawn points according to player offraid position
    Object.keys(this.config.infiltrations[offraidPosition]).forEach(
      (mapName) => {
        const spawnpoints: string[] | undefined =
          this.config.infiltrations[offraidPosition][mapName as MapName];

        if (spawnpoints) {
          spawnpoints.forEach((spawnId) => {
            const spawnData =
              this.spawnConfig[mapName as MapName] &&
              this.spawnConfig[mapName as MapName][spawnId];
            if (spawnData) {
              const spawnPoint = createSpawnPoint(
                spawnData.Position,
                spawnData.Rotation,
                this.entrypoints[mapName],
                spawnId
              );
              this.addSpawnPoint(mapName, spawnPoint);
            }
          });
        }
      }
    );
  }

  initExfiltrations(): void {
    if (this.config.bypass_exfils_override) {
      return;
    }

    // Exfiltrations tweaks without requirements
    const locations = this.db.getTables().locations;
    let exfilsCounter = 0;

    Object.keys(this.config.exfiltrations).forEach((mapName) => {
      const extractPoints = Object.keys(
        this.config.exfiltrations[mapName as MapName]
      );

      const location = locations?.[mapName as MapName];

      if (location) {
        const entrypointsForMap = this.entrypoints[mapName];

        if (this.config.vanilla_exfils_requirements) {
          // filter all exits and keep vanilla requirements (except for ScavCooperation requirements)
          location.base.exits = location.base.exits
            .filter((exit) => {
              return extractPoints.includes(exit.Name);
            })
            .map((exit) => {
              if (exit.PassageRequirement === "ScavCooperation") {
                return createExitPoint(entrypointsForMap)(exit.Name);
              }

              exit.EntryPoints = entrypointsForMap.join(",");
              exit.ExfiltrationTime = 10;
              exit.Chance = 100;

              return exit;
            });
        } else {
          // erase all exits and create custom exit points without requirements
          location.base.exits = extractPoints.map(
            createExitPoint(entrypointsForMap)
          );
        }
        exfilsCounter = exfilsCounter + location.base.exits.length;
      }
    });

    this.debug(
      `initialized ${exfilsCounter} exfiltrations ${
        this.config.vanilla_exfils_requirements ? "with vanilla" : "without"
      } requirements`
    );
  }

  getOffraidPosition = (sessionId: string): string => {
    const defaultOffraidPosition = this.config.initial_offraid_position;
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    if (!profile.PathToTarkov.offraidPosition) {
      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
    }

    const offraidPosition = profile.PathToTarkov.offraidPosition;

    if (!this.config.infiltrations[offraidPosition]) {
      this.debug(
        `Unknown offraid position '${offraidPosition}', reset to default '${defaultOffraidPosition}'`
      );

      profile.PathToTarkov.offraidPosition = defaultOffraidPosition;
      return profile.PathToTarkov.offraidPosition;
    }

    return offraidPosition;
  };

  updateOffraidPosition(sessionId: string, offraidPosition?: string): void {
    if (!offraidPosition) {
      offraidPosition = this.getOffraidPosition(sessionId);
    }

    const profile: Profile = this.saveServer.getProfile(sessionId);

    const prevOffraidPosition = profile?.PathToTarkov?.offraidPosition;

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    profile.PathToTarkov.offraidPosition = offraidPosition;

    if (prevOffraidPosition !== offraidPosition) {
      this.logger.info(
        `=> PathToTarkov: player offraid position changed to '${offraidPosition}'`
      );
    }
    this.updateLockedMaps(offraidPosition);
    this.updateSpawnPoints(offraidPosition);

    this.stashController.updateStash(offraidPosition, sessionId);
    this.offraidRegenController.updateOffraidRegen(offraidPosition);

    if (this.config.traders_access_restriction) {
      this.tradersController.updateTraders(offraidPosition, sessionId);
    }

    this.saveServer.saveProfile(sessionId);
  }
}
