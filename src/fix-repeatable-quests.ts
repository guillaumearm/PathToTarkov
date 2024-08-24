import type { RepeatableQuestGenerator } from '@spt/generators/RepeatableQuestGenerator';
import type { TraderInfo } from '@spt/models/eft/common/tables/IBotBase';
import type { IRepeatableQuest } from '@spt/models/eft/common/tables/IRepeatableQuests';
import type { IRepeatableQuestConfig } from '@spt/models/spt/config/IQuestConfig';
import type { IQuestTypePool } from '@spt/models/spt/repeatable/IQuestTypePool';
import type { DependencyContainer } from 'tsyringe';
import { deepClone } from './utils';
import type { IPmcData } from '@spt/models/eft/common/IPmcData';

export const fixRepeatableQuests = (container: DependencyContainer): void => {
  container.afterResolution<RepeatableQuestGenerator>(
    'RepeatableQuestGenerator',
    (_t, result): void => {
      const repeatableQuestGenerator = Array.isArray(result) ? result[0] : result;

      const originalGenerateRepeatableQuest =
        repeatableQuestGenerator.generateRepeatableQuest.bind(repeatableQuestGenerator);

      repeatableQuestGenerator.generateRepeatableQuest = (
        pmcLevel: number,
        pmcTradersInfo: Record<string, TraderInfo>,
        questTypePool: IQuestTypePool,
        repeatableConfig: IRepeatableQuestConfig,
      ): IRepeatableQuest => {
        const clonedPmcTradersInfo = deepClone(pmcTradersInfo);

        // unlock all traders
        // this will avoid crashes with repeatable quests assigned to unknown traders (because locked)
        Object.keys(clonedPmcTradersInfo).forEach(traderId => {
          const traderInfo = clonedPmcTradersInfo[traderId];
          traderInfo.unlocked = true;
        });

        return originalGenerateRepeatableQuest(
          pmcLevel,
          clonedPmcTradersInfo,
          questTypePool,
          repeatableConfig,
        );
      };
    },
  );
};

// Repeatable quests without traderId will break the client
const isBrokenRepeatableQuest = (quest: IRepeatableQuest): boolean => {
  return !quest.traderId;
};

// this will fix corrupted profiles from previous version (< 5.3.3)
export const fixRepeatableQuestsForPmc = (pmc: IPmcData): number => {
  let nbQuestsRemoved = 0;

  const questFilterFn = (q: IRepeatableQuest): boolean => {
    const isBroken = isBrokenRepeatableQuest(q);
    if (isBroken) {
      nbQuestsRemoved += 1;
      return false;
    }
    return true;
  };

  pmc.RepeatableQuests.forEach(repeatableQuest => {
    repeatableQuest.activeQuests = repeatableQuest.activeQuests.filter(questFilterFn);
    repeatableQuest.inactiveQuests = repeatableQuest.inactiveQuests.filter(questFilterFn);
  });

  return nbQuestsRemoved;
};
