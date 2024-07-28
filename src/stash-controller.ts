import type { Inventory } from "@spt/models/eft/common/tables/IBotBase";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ConfigGetter, Profile } from "./config";
import { EMPTY_STASH, STANDARD_STASH_ID } from "./config";
import { checkAccessVia, isIgnoredArea } from "./helpers";
import {
  deepClone,
  getGridIdFromStashId,
  getMainStashId,
  getTemplateIdFromStashId,
} from "./utils";

export class StashController {
  constructor(
    private getConfig: ConfigGetter,
    private db: DatabaseServer,
    private saveServer: SaveServer,
    private readonly debug: (data: string) => void,
  ) {}

  getInventory(sessionId: string): Inventory {
    const profile = this.saveServer.getProfile(sessionId);
    return profile.characters.pmc.Inventory;
  }

  private disableHideout() {
    const areas = this.db.getTables().hideout?.areas;

    areas?.forEach((area) => {
      if (!isIgnoredArea(area, this.getConfig())) {
        area.enabled = false;
      }
    });
  }

  private enableHideout() {
    const areas = this.db.getTables().hideout?.areas;

    areas?.forEach((area) => {
      if (!isIgnoredArea(area, this.getConfig())) {
        area.enabled = true;
      }
    });
  }

  private setSecondaryStashLocales(templateId: string) {
    const locales = this.db.getTables()?.locales?.global;

    if (!locales) {
      throw new Error("Path To Tarkov: cannot retrieve locales");
    }

    let nbLocalesUpdated = 0;
    Object.keys(locales).forEach((localeName) => {
      const locale = locales[localeName];

      locale[`${templateId} Name`] = "stash name";
      locale[`${templateId} ShortName`] = "stash short name";
      locale[`${templateId} Description`] = "stash description";
      // locale[`${templateId} Description`] = locale[`${STANDARD_STASH_ID} Description`]
      nbLocalesUpdated = nbLocalesUpdated + 3;
    });

    this.debug(
      `${nbLocalesUpdated} locales updated for template ${templateId}`,
    );
  }

  initSecondaryStashTemplates(): number {
    const standardTemplate =
      this.db.getTables()?.templates?.items[STANDARD_STASH_ID];

    if (!standardTemplate) {
      throw new Error("Path To Tarkov: standard stash template not found");
    }

    const stashConfigs = [
      EMPTY_STASH,
      ...this.getConfig().hideout_secondary_stashes,
    ];

    let nbAddedTemplates = 0;

    stashConfigs.forEach(({ id, size }) => {
      const newTemplate = deepClone(standardTemplate);
      const templateId = getTemplateIdFromStashId(id);

      // this.setSecondaryStashLocales(templateId);

      newTemplate._id = templateId;
      newTemplate._name = `${id} of size ${size}`;

      const grid = newTemplate?._props?.Grids?.[0];
      const gridProps = grid?._props;

      if (gridProps) {
        grid._id = getGridIdFromStashId(id);
        grid._parent = templateId;
        gridProps.cellsV = size;
      } else {
        throw new Error(
          "Path To  Tarkov: cannot set size on custom stash template",
        );
      }

      const items = this.db.getTables()?.templates?.items;

      if (items) {
        items[newTemplate._id] = newTemplate;
        nbAddedTemplates = nbAddedTemplates + 1;
      }
    });

    return nbAddedTemplates;
  }

  initProfile(sessionId: string): void {
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    if (!profile.PathToTarkov.mainStashId) {
      profile.PathToTarkov.mainStashId = profile.characters.pmc.Inventory.stash;
    }
  }

  private setMainStash(sessionId: string): void {
    const inventory = this.getInventory(sessionId);
    const profile: Profile = this.saveServer.getProfile(sessionId);
    inventory.stash = getMainStashId(profile);
  }

  private setSecondaryStash(stashId: string, sessionId: string): void {
    const profile = this.saveServer.getProfile(sessionId);
    const inventory = profile.characters.pmc.Inventory;

    inventory.stash = stashId;

    const templateId = getTemplateIdFromStashId(stashId);

    if (
      !inventory.items.find(
        (item) => item._id === stashId && item._tpl === templateId,
      )
    ) {
      inventory.items.push({ _id: stashId, _tpl: templateId });
    }
  }

  updateStash(offraidPosition: string, sessionId: string): void {
    const multiStashEnabled = this.getConfig().hideout_multistash_enabled;

    const mainStashAvailable = checkAccessVia(
      this.getConfig().hideout_main_stash_access_via,
      offraidPosition,
    );
    const secondaryStash = this.getConfig().hideout_secondary_stashes.find(
      (stash) => checkAccessVia(stash.access_via, offraidPosition),
    );

    if (!multiStashEnabled || mainStashAvailable) {
      // this.enableHideout();
      // this.resetSize();
      this.setMainStash(sessionId);
    } else if (secondaryStash) {
      // this.disableHideout();
      // this.setSize(secondaryStash.size);
      this.setSecondaryStash(secondaryStash.id, sessionId);
    } else {
      // this.disableHideout();
      // this.setSize(0);
      this.setSecondaryStash(EMPTY_STASH.id, sessionId);
    }
  }

  // TODO: refactor with updateStash logic
  getStashSize(offraidPosition: string): number | null {
    const multiStashEnabled = this.getConfig().hideout_multistash_enabled;

    const mainStashAvailable = checkAccessVia(
      this.getConfig().hideout_main_stash_access_via,
      offraidPosition,
    );

    const secondaryStash = this.getConfig().hideout_secondary_stashes.find(
      (stash) => checkAccessVia(stash.access_via, offraidPosition),
    );

    if (multiStashEnabled === false || mainStashAvailable) {
      return null;
    }

    if (secondaryStash) {
      return secondaryStash.size;
    }

    return 0;
  }
}
