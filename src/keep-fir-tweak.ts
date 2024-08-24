import type { MatchController } from '@spt/controllers/MatchController';
import type { IPmcData } from '@spt/models/eft/common/IPmcData';
import type { Item } from '@spt/models/eft/common/tables/IItem';
import type { SaveServer } from '@spt/servers/SaveServer';

import type { DependencyContainer } from 'tsyringe';

type PTTInstance = {
  readonly container: DependencyContainer;
  readonly debug: (data: string) => void;
};

const setSpawnedInSessionOnAllItems = (items: Item[]): number => {
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
};

export const enableKeepFoundInRaidTweak = (ptt: PTTInstance): void => {
  const saveServer = ptt.container.resolve<SaveServer>('SaveServer');

  ptt.container.afterResolution<MatchController>(
    'MatchController',
    (_t, result): void => {
      const matchController = Array.isArray(result) ? result[0] : result;

      const originalEndOfflineRaid = matchController.endOfflineRaid.bind(matchController);

      ptt.debug('Hello world here is the override of MatchCOntroller.endOfflineRaid');

      matchController.endOfflineRaid = (info, sessionId) => {
        originalEndOfflineRaid(info, sessionId);

        const profile = saveServer.getProfile(sessionId);
        const pmcData: IPmcData = profile.characters.pmc;
        const count = setSpawnedInSessionOnAllItems(pmcData.Inventory.items);
        ptt.debug(`added 'SpawnedInSession' flag on ${count} items`);
      };
    },
    { frequency: 'Always' },
  );
};
