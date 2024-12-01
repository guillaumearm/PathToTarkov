import type { DependencyContainer } from 'tsyringe';
import type { ConfigServer } from '@spt/servers/ConfigServer';
import type { ConfigTypes } from '@spt/models/enums/ConfigTypes';
import type { IInRaidConfig } from '@spt/models/spt/config/IInRaidConfig';

// TODO: filter to get only items that are in the player equipment (need to use "equipment" field as a parentId)
// const setSpawnedInSessionOnAllItems = (items: IItem[]): number => {
//   let counter = 0;

//   items.forEach(item => {
//     if (item.upd) {
//       if (!item.upd.SpawnedInSession) {
//         item.upd.SpawnedInSession = true;
//         counter = counter + 1;
//       }
//     } else {
//       item.upd = { SpawnedInSession: true };
//       counter = counter + 1;
//     }
//   });

//   return counter;
// };

export const applyKeepFoundInRaidTweak = (container: DependencyContainer): void => {
  const configServer = container.resolve<ConfigServer>('ConfigServer');
  const inRaidConfig = configServer.getConfig<IInRaidConfig>('spt-inraid' as ConfigTypes.IN_RAID);

  // this does not work
  inRaidConfig.alwaysKeepFoundInRaidonRaidEnd = true;
};
