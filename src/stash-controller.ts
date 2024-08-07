import type { Inventory } from "@spt/models/eft/common/tables/IBotBase";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ConfigGetter, Profile } from "./config";
import { EMPTY_STASH_ID, STANDARD_STASH_ID, STASH_IDS } from "./config";
import { checkAccessVia, isIgnoredArea } from "./helpers";
import { getMainStashId } from "./utils";

// indexed by stashId
type StashSizes = Record<string, number>;

export class StashController {
  // null means stash is unlocked
  private stashSizes: StashSizes | null = null;

  constructor(
    private getConfig: ConfigGetter,
    private db: DatabaseServer,
    private saveServer: SaveServer,
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
      profile.PathToTarkov.mainStashId = profile.characters.pmc.Inventory.stash;
    }
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
    const profile: Profile = this.saveServer.getProfile(sessionId);
    inventory.stash = getMainStashId(profile);
  }

  private setSecondaryStash(stashId: string, sessionId: string): void {
    const profile = this.saveServer.getProfile(sessionId);
    const inventory = profile.characters.pmc.Inventory;

    inventory.stash = stashId;

    if (!inventory.items.find((item) => item._id === stashId)) {
      inventory.items.push({ _id: stashId, _tpl: STANDARD_STASH_ID });
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
