import type { Inventory } from "@spt-aki/models/eft/common/IPmcData";

import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import { ConfigGetter, EMPTY_STASH_ID, Profile, STASH_IDS } from "./config";
import { checkAccessVia, isIgnoredArea } from "./helpers";

// indexed by stashId
type StashSizes = Record<string, number>;

export class StashController {
  // null means stash is unlocked
  private stashSizes: StashSizes | null = null;

  constructor(
    private getConfig: ConfigGetter,
    private db: DatabaseServer,
    private saveServer: SaveServer
  ) {
    // null means stash is unlocked
    this.stashSizes = null;
  }

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

  initProfile(sessionId: string): void {
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    if (!profile.PathToTarkov.mainStashId) {
      const stashId: string = this.getInventory(sessionId).stash;
      profile.PathToTarkov.mainStashId = stashId;
    }
  }

  private getMainStashId(sessionId: string): string {
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const stashId: string | undefined = profile.PathToTarkov?.mainStashId;

    if (!stashId) {
      throw new Error("Fatal: cannot retrieve mainStashId from profile");
    }

    return stashId;
  }

  private setSize(n: number): void {
    let shouldCollectStashSizes = false;

    if (!this.stashSizes) {
      this.stashSizes = {};
      shouldCollectStashSizes = true;
    }

    const items = this.db.getTables().templates?.items;

    STASH_IDS.forEach((stashId) => {
      const item = items?.[stashId];
      const gridProps = item?._props?.Grids?.[0]._props;

      if (shouldCollectStashSizes && this.stashSizes && gridProps) {
        this.stashSizes[stashId] = gridProps.cellsV;
      }

      if (gridProps) {
        gridProps.cellsV = n;
      }
    });
  }

  private resetSize(): void {
    if (!this.stashSizes) {
      return;
    }

    const items = this.db.getTables().templates?.items;

    STASH_IDS.forEach((stashId) => {
      const gridProps = items?.[stashId]?._props?.Grids?.[0];

      if (this.stashSizes && gridProps) {
        gridProps._props.cellsV = this.stashSizes[stashId];
      }
    });

    this.stashSizes = null;
  }

  private setMainStash(sessionId: string): void {
    const inventory = this.getInventory(sessionId);
    inventory.stash = this.getMainStashId(sessionId);
  }

  private setSecondaryStash(stashId: string, sessionId: string): void {
    const profile = this.saveServer.getProfile(sessionId);
    const inventory = profile.characters.pmc.Inventory;

    inventory.stash = stashId;

    if (!inventory.items.find((item) => item._id === stashId)) {
      inventory.items.push({ _id: stashId, _tpl: STASH_IDS[0] });
    }
  }

  updateStash(offraidPosition: string, sessionId: string): void {
    const multiStashEnabled = this.getConfig().hideout_multistash_enabled;

    const mainStashAvailable = checkAccessVia(
      this.getConfig().hideout_main_stash_access_via,
      offraidPosition
    );
    const secondaryStash = this.getConfig().hideout_secondary_stashes.find(
      (stash) => checkAccessVia(stash.access_via, offraidPosition)
    );

    if (!multiStashEnabled || mainStashAvailable) {
      this.enableHideout();
      this.resetSize();
      this.setMainStash(sessionId);
    } else if (secondaryStash) {
      this.disableHideout();
      this.setSize(secondaryStash.size);
      this.setSecondaryStash(secondaryStash.id, sessionId);
    } else {
      this.disableHideout();
      this.setSize(0);
      this.setSecondaryStash(EMPTY_STASH_ID, sessionId);
    }
  }
}
