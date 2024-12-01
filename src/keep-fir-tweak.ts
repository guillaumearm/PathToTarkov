// import type { MatchController } from '@spt/controllers/MatchController';
// import type { IPmcData } from '@spt/models/eft/common/IPmcData';
import type { IPmcData } from '@spt/models/eft/common/IPmcData';
import type { IItem } from '@spt/models/eft/common/tables/IItem';
import type { SaveServer } from '@spt/servers/SaveServer';

import type { DependencyContainer } from 'tsyringe';
import type { PathToTarkovController } from './path-to-tarkov-controller';

type PTTInstance = {
  readonly container: DependencyContainer;
  readonly pathToTarkovController: PathToTarkovController;
  readonly debug: (data: string) => void;
};

const setSpawnedInSessionOnAllItems = (items: IItem[]): number => {
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

export const applyKeepFoundInRaidTweak = (ptt: PTTInstance, sessionId: string): void => {
  const config = ptt.pathToTarkovController.getConfig(sessionId);
  const bypassTweak = config.bypass_keep_found_in_raid_tweak;

  if (bypassTweak) {
    return;
  }

  const saveServer = ptt.container.resolve<SaveServer>('SaveServer');
  const profile = saveServer.getProfile(sessionId);
  const pmcData: IPmcData = profile.characters.pmc;
  const count = setSpawnedInSessionOnAllItems(pmcData.Inventory.items);
  ptt.debug(`added 'SpawnedInSession' flag on ${count} items`);
};
