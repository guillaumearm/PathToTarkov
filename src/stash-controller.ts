import type { Inventory } from "@spt/models/eft/common/tables/IBotBase";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ConfigGetter, Profile, StashConfig } from "./config";
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

  private getMainStashAvailable(offraidPosition: string): boolean {
    const multiStashEnabled = this.getConfig().hideout_multistash_enabled;

    const mainStashAvailable = checkAccessVia(
      this.getConfig().hideout_main_stash_access_via,
      offraidPosition,
    );

    return mainStashAvailable || multiStashEnabled === false;
  }

  private getSecondaryStash(
    offraidPosition: string,
  ): Omit<StashConfig, "access_via"> {
    return (
      this.getConfig().hideout_secondary_stashes.find((stash) =>
        checkAccessVia(stash.access_via, offraidPosition),
      ) ?? EMPTY_STASH
    );
  }

  updateStash(offraidPosition: string, sessionId: string): void {
    const mainStashAvailable = this.getMainStashAvailable(offraidPosition);
    const secondaryStash = this.getSecondaryStash(offraidPosition);

    if (mainStashAvailable) {
      this.setMainStash(sessionId);
    } else {
      this.setSecondaryStash(secondaryStash.id, sessionId);
    }
  }

  getStashSize(offraidPosition: string): number | null {
    const mainStashAvailable = this.getMainStashAvailable(offraidPosition);
    const secondaryStash = this.getSecondaryStash(offraidPosition);

    if (mainStashAvailable) {
      return null;
    }

    return secondaryStash.size;
  }

  getHideoutEnabled(offraidPosition: string): boolean {
    return this.getMainStashAvailable(offraidPosition);
  }
}
