import type { SaveServer } from '@spt/servers/SaveServer';
import type { IItem } from '@spt/models/eft/common/tables/IItem';

export class KeepFoundInRaidTweak {
  constructor(private saveServer: SaveServer) {}

  public setFoundInRaidOnEquipment(sessionId: string, isPlayerScav: boolean): number {
    const profile = this.saveServer.getProfile(sessionId);
    const characterData = profile.characters[isPlayerScav ? 'scav' : 'pmc'];
    const inventory = characterData.Inventory;
    const allEquipmentItems = KeepFoundInRaidTweak.getItemsContainedIn(
      inventory.items,
      inventory.equipment,
    );

    const nbImpactedItems = KeepFoundInRaidTweak.setSpawnedInSessionOnItems(allEquipmentItems);
    this.saveServer.saveProfile(sessionId);

    return nbImpactedItems;
  }

  private static getItemsContainedIn(items: IItem[], parentId: string): IItem[] {
    const resultItems: IItem[] = [];

    items.forEach(item => {
      if (!item._id || !item.parentId) {
        return;
      }

      if (item.parentId === parentId) {
        resultItems.push(item);
        const deeperItems = this.getItemsContainedIn(items, item._id);
        resultItems.push(...deeperItems);
      }
    });

    return resultItems;
  }

  private static setSpawnedInSessionOnItems(items: IItem[]): number {
    let counter = 0;

    items.forEach(item => {
      if (item.upd) {
        if (!item.upd.SpawnedInSession) {
          item.upd.SpawnedInSession = true;
          counter = counter + 1;
        }
      } else {
        item.upd = { SpawnedInSession: true };
        counter = counter + 1;
      }
    });

    return counter;
  }
}
