import { InRaidHelper } from "@spt-aki/helpers/InRaidHelper";
import { Item } from "@spt-aki/models/eft/common/tables/IItem";
import type { DependencyContainer } from "tsyringe";

type PTTInstance = {
  readonly container: DependencyContainer;
  readonly debug: (data: string) => void;
  readonly itemsFoundInRaid: Record<string, true>;
};

const setSpawnedInSessionOnAllItems = (items: Item[]): number => {
  let counter = 0;

  items.forEach((item) => {
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
};

const setSpawnedInSessionOnSpecificItems = (
  items: Item[],
  firItems: Record<string, true>
): number => {
  let counter = 0;

  items.forEach((item) => {
    const fir = Boolean(firItems[item._id]);

    if (fir && item.upd) {
      if (!item.upd.SpawnedInSession) {
        item.upd.SpawnedInSession = true;
        counter = counter + 1;
      }
    } else if (fir) {
      item.upd = { SpawnedInSession: true };
      counter = counter + 1;
    }
  });

  return counter;
};

export const enableKeepFoundInRaidTweak = (ptt: PTTInstance): void => {
  ptt.container.afterResolution<InRaidHelper>(
    "InRaidHelper",
    (_t, result): void => {
      const inraidHelper = Array.isArray(result) ? result[0] : result;

      inraidHelper.markFoundItems = (_pmcData, profile, isPlayerScav) => {
        if (isPlayerScav) {
          const count = setSpawnedInSessionOnAllItems(profile.Inventory.items);
          ptt.debug(
            `raid survived with a scav, added 'SpawnedInSession' flag on ${count} items`
          );
        } else {
          const count = setSpawnedInSessionOnSpecificItems(
            profile.Inventory.items,
            ptt.itemsFoundInRaid
          );
          ptt.debug(
            `raid survived with a pmc, added 'SpawnedInSession' flag on ${count} items`
          );
        }

        return profile;
      };

      inraidHelper.removeFoundInRaidStatusFromItems = (profile) => {
        const isPlayerScav = profile.Info.Side === "Savage";

        if (isPlayerScav) {
          const count = setSpawnedInSessionOnAllItems(profile.Inventory.items);
          ptt.debug(
            `raid ran through with a scav, added 'SpawnedInSession' flag on ${count} items`
          );
        } else {
          const count = setSpawnedInSessionOnSpecificItems(
            profile.Inventory.items,
            ptt.itemsFoundInRaid
          );
          ptt.debug(
            `raid ran through with a pmc, added 'SpawnedInSession' flag on ${count} items`
          );
        }

        return profile;
      };
    },
    { frequency: "Always" }
  );
};
