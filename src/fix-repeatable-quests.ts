import type { RepeatableQuestGenerator } from '@spt/generators/RepeatableQuestGenerator';
import type { TraderInfo } from '@spt/models/eft/common/tables/IBotBase';
import type { IRepeatableQuest } from '@spt/models/eft/common/tables/IRepeatableQuests';
import type { IRepeatableQuestConfig } from '@spt/models/spt/config/IQuestConfig';
import type { IQuestTypePool } from '@spt/models/spt/repeatable/IQuestTypePool';
import type { DependencyContainer } from 'tsyringe';

export const fixRepeatableQuests = (
  container: DependencyContainer,
  debug: (data: string) => void,
): void => {
  container.afterResolution<RepeatableQuestGenerator>(
    'RepeatableQuestGenerator',
    (_t, result): void => {
      const allResults = Array.isArray(result) ? result : [result];

      allResults.forEach(questGenerator => {
        const originalFn = questGenerator.generateRepeatableQuest.bind(questGenerator);

        questGenerator.generateRepeatableQuest = (
          pmcLevel: number,
          pmcTraderInfo: Record<string, TraderInfo>,
          questTypePool: IQuestTypePool,
          repeatableConfig: IRepeatableQuestConfig,
        ): IRepeatableQuest => {
          const repeatableQuest = originalFn(
            pmcLevel,
            pmcTraderInfo,
            questTypePool,
            repeatableConfig,
          ) as IRepeatableQuest | undefined;

          if (repeatableQuest) {
            debug(`Repeatable quest of type '${repeatableQuest.type}' generated!`);

            if (!repeatableQuest.traderId) {
              debug('no traderId found on generated repeatable quest, generating another quest...');
              return null as any;
            }
          } else {
            debug(`Cannot generate repeatable quest`);
          }

          return repeatableQuest!;
        };
      });
    },
    { frequency: 'Always' },
  );
};
