import type { RepeatableQuestGenerator } from '@spt/generators/RepeatableQuestGenerator';
import type { TraderInfo } from '@spt/models/eft/common/tables/IBotBase';
import type { IRepeatableQuest } from '@spt/models/eft/common/tables/IRepeatableQuests';
import type { IRepeatableQuestConfig } from '@spt/models/spt/config/IQuestConfig';
import type { IQuestTypePool } from '@spt/models/spt/repeatable/IQuestTypePool';
import type { DependencyContainer } from 'tsyringe';
import { deepClone } from './utils';

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
