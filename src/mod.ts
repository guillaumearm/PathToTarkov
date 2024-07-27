import type { DependencyContainer } from "tsyringe";

import type { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import { createPathToTarkovAPI } from "./api";
import type { Config, MapName, SpawnConfig } from "./config";
import {
  CONFIG_PATH,
  MAPLIST,
  PACKAGE_JSON_PATH,
  SPAWN_CONFIG_PATH,
} from "./config";
import { EventWatcher } from "./event-watcher";
import { createStaticRoutePeeker } from "./helpers";
import { enableKeepFoundInRaidTweak } from "./keep-fir-tweak";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import type { PackageJson } from "./utils";
import { deepClone, getModDisplayName, noop, readJsonFile } from "./utils";
import { EndOfRaidController } from "./end-of-raid-controller";
import { getModLoader } from "./modLoader";
import { fixRepeatableQuests } from "./fix-repeatable-quests";
import type { LocationController } from "../types/controllers/LocationController";
import { ILocations } from "@spt/models/spt/server/ILocations";
import { ILocation } from "@spt/models/eft/common/ILocation";
import { ILocationBase } from "@spt/models/eft/common/ILocationBase";
import { resolveMapNameFromLocation } from "./map-name-resolver";
import { Path } from "@spt/models/eft/common/ILocationsSourceDestinationBase";

const findLocation = (locations: ILocationBase[], mapName: string): ILocationBase | undefined => {
  return locations.find(l => resolveMapNameFromLocation(l?.Id) === mapName)
}

const overrideLockedMaps = (
  container: DependencyContainer,
  debug: (data: string) => void,
): void => {
  container.afterResolution<LocationController>(
    "LocationController",
    (_t, result): void => {
      const locationController = Array.isArray(result) ? result[0] : result;
      const originalFn = locationController.generateAll.bind(locationController);

      locationController.generateAll = (sessionId) => {
        debug("call locationController.generateAll");
        const result = originalFn(sessionId);
        const locations = deepClone(result.locations);


        // TODO: improve typing here
        const locationsList: ILocationBase[] = Object.values(locations).filter((l: ILocationBase) => l && l.Id)

        // debug(JSON.stringify(Object.keys(locationsList[0]), undefined, 2))
        // debug(JSON.stringify(locationsList[0], undefined, 2))


        MAPLIST.forEach((mapName) => {
          const locked = mapName === "sandbox"; // TODO: get locked maps for current user
          const location = findLocation(locationsList, mapName)

          if (location) {
            debug(`apply lock to map ${mapName} | locked=${locked}`)
            location.Locked = locked;
          }
        });

        // const newPaths: Path[] = [{
        //   Source: findLocation(locationsList, "bigmap")!._Id,
        //   Destination: findLocation(locationsList, "sandbox")!._Id,
        // }, {
        //   Source: findLocation(locationsList, "sandbox")!._Id,
        //   Destination: findLocation(locationsList, "laboratory")!._Id,
        // },{
        //   Source: findLocation(locationsList, "bigmap")!._Id,
        //   Destination: findLocation(locationsList, "interchange")!._Id,
        // },{
        //   Source: findLocation(locationsList, "rezervbase")!._Id,
        //   Destination: findLocation(locationsList, "interchange")!._Id,
        // },
        // {
        //   Source: findLocation(locationsList, "bigmap")!._Id,
        //   Destination: findLocation(locationsList, "factory4_day")!._Id,
        // },{
        //   Source: findLocation(locationsList, "woods")!._Id,
        //   Destination: findLocation(locationsList, "factory4_day")!._Id,
        // },{
        //   Source: findLocation(locationsList, "rezervbase")!._Id,
        //   Destination: findLocation(locationsList, "lighthouse")!._Id,
        // },
        // {
        //   Source: findLocation(locationsList, "shoreline")!._Id,
        //   Destination: findLocation(locationsList, "lighthouse")!._Id,
        // },
        // {
        //   Source: findLocation(locationsList, "shoreline")!._Id,
        //   Destination: findLocation(locationsList, "woods")!._Id,
        // }]

        const newPaths: Path[] = [{
          Source: findLocation(locationsList, "sandbox")!._Id,
          Destination: findLocation(locationsList, "lighthouse")!._Id,
        }]

        return { locations, paths: newPaths };
      };
    },
    { frequency: "Always" },
  );
};

class PathToTarkov implements IPreSptLoadMod, IPostSptLoadMod {
  private packageJson: PackageJson;
  private config: Config;
  private spawnConfig: SpawnConfig;

  public logger: ILogger;
  public debug: (data: string) => void;
  public container: DependencyContainer;
  public executeOnStartAPICallbacks: (sessionId: string) => void = noop;
  public pathToTarkovController: PathToTarkovController;

  public preSptLoad(container: DependencyContainer): void {
    this.container = container;
    this.packageJson = readJsonFile(PACKAGE_JSON_PATH);
    this.config = readJsonFile(CONFIG_PATH);
    this.spawnConfig = readJsonFile(SPAWN_CONFIG_PATH);

    this.logger = container.resolve<ILogger>("WinstonLogger");
    this.debug = this.config.debug
      ? (data: string) => this.logger.debug(`Path To Tarkov: ${data}`, true)
      : noop;

    if (this.config.debug) {
      this.debug("debug mode enabled");
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");
    const modLoader = getModLoader(container);

    const staticRouter = container.resolve<StaticRouterModService>(
      "StaticRouterModService",
    );

    if (!this.config.enabled) {
      this.logger.warning("=> Path To Tarkov is disabled!");

      if (this.config.bypass_uninstall_procedure === true) {
        this.logger.warning(
          "=> PathToTarkov: uninstall process aborted because 'bypass_uninstall_procedure' field is true in config.json",
        );
        return;
      }

      purgeProfiles(this.config, saveServer, this.logger);
      return;
    }

    // TODO: compat with Custom Quests
    const getIsTraderLocked = () => false;

    this.pathToTarkovController = new PathToTarkovController(
      this.config,
      this.spawnConfig,
      db,
      saveServer,
      getIsTraderLocked,
      this.logger,
      this.debug,
      createStaticRoutePeeker(staticRouter),
      modLoader,
    );

    const eventWatcher = new EventWatcher(this);
    const endOfRaidController = new EndOfRaidController(this);

    eventWatcher.onEndOfRaid((payload) => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter));

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`,
    );

    overrideLockedMaps(container, this.debug); // TODO: move it inside the ptt controller

    const tweakFoundInRaid = !this.config.bypass_keep_found_in_raid_tweak;

    if (tweakFoundInRaid) {
      enableKeepFoundInRaidTweak(this);
      this.debug("option keep_found_in_raid_tweak enabled");
    }

    if (!this.config.bypass_luas_custom_spawn_points_tweak) {
      this.pathToTarkovController.hijackLuasCustomSpawnPointsUpdate();
    }

    if (this.config.traders_access_restriction) {
      fixRepeatableQuests(container, this.debug);
      this.debug(
        "Apply fix for unavailable repeatable quests (due to locked traders)",
      );
    }
  }

  public postSptLoad(container: DependencyContainer): void {
    this.container = container;

    if (!this.config.enabled) {
      return;
    }

    this.pathToTarkovController.generateEntrypoints();

    const [api, executeOnStartAPICallbacks] = createPathToTarkovAPI(
      this.pathToTarkovController,
    );

    (globalThis as any).PathToTarkovAPI = api;

    this.executeOnStartAPICallbacks = executeOnStartAPICallbacks;

    this.pathToTarkovController.initExfiltrations();

    if (this.config.traders_access_restriction) {
      this.pathToTarkovController.tradersController.initTraders();
    }

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`,
    );
  }
}

module.exports = { mod: new PathToTarkov() };
