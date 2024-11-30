import type { DatabaseServer } from '@spt/servers/DatabaseServer';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { AccessVia, ConfigGetter, Profile, StashConfig } from './config';
import { EMPTY_STASH, STANDARD_STASH_ID } from './config';
import {
  checkAccessVia,
  getMainStashId,
  retrieveMainStashIdFromItems,
  setInventorySlotIds,
} from './helpers';
import { deepClone } from './utils';

export class StashController {
  constructor(
    private getConfig: ConfigGetter,
    private db: DatabaseServer,
    private saveServer: SaveServer,
    private readonly debug: (data: string) => void,
  ) {}

  initSecondaryStashTemplates(givenStashConfigs: StashConfig[]): number {
    const stashConfigs = [EMPTY_STASH, ...givenStashConfigs];
    const standardTemplate = this.db.getTables()?.templates?.items[STANDARD_STASH_ID];

    if (!standardTemplate) {
      throw new Error('Path To Tarkov: standard stash template not found');
    }

    let nbAddedTemplates = 0;

    stashConfigs.forEach(({ name, mongoTemplateId, mongoGridId, size }) => {
      const newTemplate = deepClone(standardTemplate);

      newTemplate._id = mongoTemplateId;
      newTemplate._name = `${name} of size ${size}`;

      const grid = newTemplate?._props?.Grids?.[0];
      const gridProps = grid?._props;

      if (gridProps) {
        grid._id = mongoGridId;
        grid._parent = mongoTemplateId;
        gridProps.cellsV = size;
      } else {
        throw new Error('Path To  Tarkov: cannot set size on custom stash template');
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
    const pmc = profile.characters.pmc;

    if (!profile.PathToTarkov) {
      profile.PathToTarkov = {};
    }

    const initialMainStashId = profile.PathToTarkov.mainStashId;

    if (!initialMainStashId) {
      const allStashConfigs = [EMPTY_STASH, ...this.getConfig(sessionId).hideout_secondary_stashes];
      const mainStashId = retrieveMainStashIdFromItems(pmc.Inventory.items, allStashConfigs);
      profile.PathToTarkov.mainStashId = mainStashId ?? pmc.Inventory.stash;
    }
  }

  private setMainStash(profile: Profile): void {
    const mainStashId = getMainStashId(profile);

    const inventory = profile.characters.pmc.Inventory;
    inventory.stash = mainStashId;
  }

  private setSecondaryStash(stash: Omit<StashConfig, 'access_via'>, profile: Profile): void {
    const stashId = stash.mongoId;
    const templateId = stash.mongoTemplateId;

    const inventory = profile.characters.pmc.Inventory;
    inventory.stash = stashId;

    if (!inventory.items.find(item => item._id === stashId && item._tpl === templateId)) {
      inventory.items.push({ _id: stashId, _tpl: templateId });
    }
  }

  private getMainStashAccessVia(sessionId: string): AccessVia {
    const defaultMainStashAccessVia = this.getConfig(sessionId).hideout_main_stash_access_via;
    const profile: Profile = this.saveServer.getProfile(sessionId);
    const profileTemplateId = profile.info.edition;

    const overrideByProfiles = this.getConfig(sessionId).override_by_profiles?.[profileTemplateId];

    return overrideByProfiles?.hideout_main_stash_access_via ?? defaultMainStashAccessVia;
  }

  private getMainStashAvailable(offraidPosition: string, sessionId: string): boolean {
    const multiStashEnabled = this.getConfig(sessionId).hideout_multistash_enabled;
    const mainStashAccessVia = this.getMainStashAccessVia(sessionId);
    const mainStashAvailable = checkAccessVia(mainStashAccessVia, offraidPosition);

    return mainStashAvailable || multiStashEnabled === false;
  }

  private getSecondaryStash(
    offraidPosition: string,
    sessionId: string,
  ): Omit<StashConfig, 'access_via'> {
    return (
      this.getConfig(sessionId).hideout_secondary_stashes.find(stash =>
        checkAccessVia(stash.access_via, offraidPosition),
      ) ?? EMPTY_STASH
    );
  }

  updateStash(offraidPosition: string, sessionId: string): void {
    const mainStashAvailable = this.getMainStashAvailable(offraidPosition, sessionId);
    const secondaryStash = this.getSecondaryStash(offraidPosition, sessionId);
    const profile: Profile = this.saveServer.getProfile(sessionId);

    if (mainStashAvailable) {
      this.setMainStash(profile);
    } else {
      this.setSecondaryStash(secondaryStash, profile);
    }

    const inventory = profile.characters.pmc.Inventory;
    const stashId = inventory.stash;
    const secondaryStashes = this.getConfig(sessionId).hideout_secondary_stashes;

    setInventorySlotIds(profile, stashId, secondaryStashes);
  }

  getStashSize(offraidPosition: string, sessionId: string): number | null {
    const mainStashAvailable = this.getMainStashAvailable(offraidPosition, sessionId);
    const secondaryStash = this.getSecondaryStash(offraidPosition, sessionId);

    if (mainStashAvailable) {
      return null;
    }

    return secondaryStash.size;
  }

  getHideoutEnabled(offraidPosition: string, sessionId: string): boolean {
    return this.getMainStashAvailable(offraidPosition, sessionId);
  }
}
