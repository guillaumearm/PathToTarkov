import type { DependencyContainer } from "tsyringe";

import type { IPostSptLoadMod } from "@spt/models/external/IPostSptLoadMod";
import type { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { StaticRouterModService } from "@spt/services/mod/staticRouter/StaticRouterModService";

import { createPathToTarkovAPI } from "./api";
import type { Config, SpawnConfig } from "./config";
import { CONFIG_PATH, PACKAGE_JSON_PATH, SPAWN_CONFIG_PATH } from "./config";
import { EventWatcher } from "./event-watcher";
import { createStaticRoutePeeker } from "./helpers";
import { enableKeepFoundInRaidTweak } from "./keep-fir-tweak";

import { PathToTarkovController } from "./path-to-tarkov-controller";
import { purgeProfiles } from "./uninstall";
import type { PackageJson } from "./utils";
import { getModDisplayName, noop, readJsonFile } from "./utils";
import { EndOfRaidController } from "./end-of-raid-controller";
import { fixRepeatableQuests } from "./fix-repeatable-quests";

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

    this.logger.info(
      `===> Loading ${getModDisplayName(this.packageJson, true)}`,
    );

    if (this.config.debug) {
      this.debug("debug mode enabled");
    }

    const db = container.resolve<DatabaseServer>("DatabaseServer");
    const saveServer = container.resolve<SaveServer>("SaveServer");

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
      container,
      db,
      saveServer,
      getIsTraderLocked,
      this.logger,
      this.debug,
    );

    const eventWatcher = new EventWatcher(this);
    const endOfRaidController = new EndOfRaidController(this);

    eventWatcher.onEndOfRaid((payload) => endOfRaidController.end(payload));
    eventWatcher.register(createStaticRoutePeeker(staticRouter));

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

  private modConfig = require("../config/Tooltips.json");
  
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

    const saveServer = container.resolve<SaveServer>("SaveServer");
    const profiles = saveServer.getProfiles();

    Object.keys(profiles).forEach((profileId) => {
      this.pathToTarkovController.cleanupLegacySecondaryStashesLink(profileId);
    });

    const nbAddedTemplates =
      this.pathToTarkovController.stashController.initSecondaryStashTemplates();
    this.debug(`${nbAddedTemplates} secondary stash templates added`);

    this.logger.success(
      `===> Successfully loaded ${getModDisplayName(this.packageJson, true)}`,
    );

    const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
    const database = databaseServer.getTables();
    const locales = database.locales.global;
    
    const tooltipLocale = this.modConfig.language.toLowerCase();
    const localesToChange = this.modConfig.localesToChange;
    const localesToChangeAdditional = this.modConfig.localesToChangeAdditional;
    const additionalLocalesToggle = this.modConfig.additionalLocalesToggle;
    const moddedTraderExtracts = this.modConfig.moddedTraderExtracts;
    const moddedTraderCompat = this.modConfig.moddedTraderCompat;

    // updated to cover all language locales
    const updateLocale = (localeObj) => {
      for (let i = 0; i < localesToChange.length; i += 2) {
        localeObj[localesToChange[i]] = localesToChange[i + 1];
      }
      if (additionalLocalesToggle) {
        for (let i = 0; i < localesToChangeAdditional.length; i += 2) {
          localeObj[localesToChangeAdditional[i]] = localesToChangeAdditional[i + 1];
        }
      }
      if (moddedTraderCompat) {
        for (let i = 0; i < moddedTraderExtracts.length; i += 2) {
          localeObj[moddedTraderExtracts[i]] = moddedTraderExtracts[i + 1];
        }
      }
    };

    const localeMappings = {
      english: locales.en,
      en: locales.en,
      chinese: locales.ch,
      ch: locales.ch,
      czech: locales.cz,
      cz: locales.cz,
      french: locales.fr,
      fr: locales.fr,
      german: locales.ge,
      ge: locales.ge,
      hungarian: locales.hu,
      hu: locales.hu,
      italian: locales.it,
      it: locales.it,
      japanese: locales.jp,
      jp: locales.jp,
      korean: locales.kr,
      kr: locales.kr,
      polish: locales.pl,
      pl: locales.pl,
      portuguese: locales.po,
      po: locales.po,
      slovakian: locales.sk,
      sk: locales.sk,
      spanish: locales.es,
      es: locales.es,
      turkish: locales.tu,
      tu: locales.tu,
      russian: locales.ru,
      ru: locales.ru,
      romanian: locales.ro,
      ro: locales.ro
    };

    // Get the locale object based on tooltipLocale
    const selectedLocale = localeMappings[tooltipLocale];

    // Update the selected locale if it exists
    if (selectedLocale) {
      updateLocale(selectedLocale);
    }
  }
}

module.exports = { mod: new PathToTarkov() };
