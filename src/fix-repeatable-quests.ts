// import type { RepeatableQuestController } from '@spt/controllers/RepeatableQuestController';
import type { RepeatableQuestGenerator } from '@spt/generators/RepeatableQuestGenerator';
import type { TraderInfo } from '@spt/models/eft/common/tables/IBotBase';
import type {
  // IPmcDataRepeatableQuest,
  IRepeatableQuest,
} from '@spt/models/eft/common/tables/IRepeatableQuests';
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

  // container.afterResolution<RepeatableQuestController>(
  //   'RepeatableQuestController',
  //   (_t, result): void => {
  //     const repeatableQuestController = Array.isArray(result) ? result[0] : result;

  //     repeatableQuestController.getClientRepeatableQuests = function (
  //       sessionID: string,
  //     ): IPmcDataRepeatableQuest[] {
  //       // TRAP: shameless copy-paste of the current 3.9.5 SPT implementation (with fix)
  //       const returnData: Array<IPmcDataRepeatableQuest> = [];
  //       const fullProfile = repeatableQuestController.profileHelper.getFullProfile(sessionID)!;
  //       const pmcData = fullProfile.characters.pmc;
  //       const currentTime = repeatableQuestController.timeUtil.getTimestamp();

  //       // Daily / weekly / Daily_Savage
  //       for (const repeatableConfig of repeatableQuestController.questConfig.repeatableQuests) {
  //         // Get daily/weekly data from profile, add empty object if missing
  //         const generatedRepeatables =
  //           repeatableQuestController.getRepeatableQuestSubTypeFromProfile(
  //             repeatableConfig,
  //             pmcData,
  //           );
  //         const repeatableTypeLower = repeatableConfig.name.toLowerCase();

  //         const canAccessRepeatables = repeatableQuestController.canProfileAccessRepeatableQuests(
  //           repeatableConfig,
  //           pmcData,
  //         );
  //         if (!canAccessRepeatables) {
  //           // Dont send any repeatables, even existing ones
  //           continue;
  //         }

  //         // Existing repeatables are still valid, add to return data and move to next sub-type
  //         if (currentTime < generatedRepeatables.endTime - 1) {
  //           returnData.push(generatedRepeatables);

  //           repeatableQuestController.logger.debug(
  //             `[Quest Check] ${repeatableTypeLower} quests are still valid.`,
  //           );

  //           continue;
  //         }

  //         // Current time is past expiry time

  //         // Set endtime to be now + new duration
  //         generatedRepeatables.endTime = currentTime + repeatableConfig.resetTime;
  //         generatedRepeatables.inactiveQuests = [];
  //         repeatableQuestController.logger.debug(`Generating new ${repeatableTypeLower}`);

  //         // Put old quests to inactive (this is required since only then the client makes them fail due to non-completion)
  //         // Also need to push them to the "inactiveQuests" list since we need to remove them from offraidData.profile.Quests
  //         // after a raid (the client seems to keep quests internally and we want to get rid of old repeatable quests)
  //         // and remove them from the PMC's Quests and RepeatableQuests[i].activeQuests
  //         repeatableQuestController.processExpiredQuests(generatedRepeatables, pmcData);

  //         // Create dynamic quest pool to avoid generating duplicates
  //         const questTypePool = repeatableQuestController.generateQuestPool(
  //           repeatableConfig,
  //           pmcData.Info.Level,
  //         );

  //         // Add repeatable quests of this loops sub-type (daily/weekly)
  //         for (
  //           let i = 0;
  //           i < repeatableQuestController.getQuestCount(repeatableConfig, pmcData);
  //           i++
  //         ) {
  //           let quest: IRepeatableQuest | undefined = undefined;
  //           let lifeline = 0;
  //           while (!quest && questTypePool.types.length > 0) {
  //             quest = repeatableQuestController.repeatableQuestGenerator.generateRepeatableQuest(
  //               pmcData.Info.Level,
  //               pmcData.TradersInfo,
  //               questTypePool,
  //               repeatableConfig,
  //             );
  //             lifeline++;
  //             if (lifeline > 10) {
  //               repeatableQuestController.logger.debug(
  //                 'We were stuck in repeatable quest generation. This should never happen. Please report',
  //               );
  //               break;
  //             }
  //           }

  //           // TRAP: here is my edit, the fix is to check if there is no generated quests or a missing traderId
  //           // the missing traderId happens when all traders are locked
  //           const noMoreQuestTypesAvailable = questTypePool.types.length === 0;
  //           if (!quest || !quest?.traderId || noMoreQuestTypesAvailable) {
  //             break;
  //           }
  //           quest.side = repeatableConfig.side;
  //           generatedRepeatables.activeQuests.push(quest);
  //         }

  //         // Nullguard
  //         fullProfile.spt.freeRepeatableRefreshUsedCount ||= {};

  //         // Reset players free quest count for this repeatable sub-type as we're generating new repeatables for this group (daily/weekly)
  //         fullProfile.spt.freeRepeatableRefreshUsedCount[repeatableTypeLower] = 0;

  //         // Create stupid redundant change requirements from quest data
  //         for (const quest of generatedRepeatables.activeQuests) {
  //           generatedRepeatables.changeRequirement[quest._id] = {
  //             changeCost: quest.changeCost,
  //             changeStandingCost: repeatableQuestController.randomUtil.getArrayValue([0, 0.01]), // Randomise standing cost to replace
  //           };
  //         }

  //         // Reset free repeatable values in player profile to defaults
  //         generatedRepeatables.freeChanges = repeatableConfig.freeChanges;
  //         generatedRepeatables.freeChangesAvailable = repeatableConfig.freeChanges;

  //         returnData.push({
  //           id: repeatableConfig.id,
  //           name: generatedRepeatables.name,
  //           endTime: generatedRepeatables.endTime,
  //           activeQuests: generatedRepeatables.activeQuests,
  //           inactiveQuests: generatedRepeatables.inactiveQuests,
  //           changeRequirement: generatedRepeatables.changeRequirement,
  //           freeChanges: generatedRepeatables.freeChanges,
  //           freeChangesAvailable: generatedRepeatables.freeChanges,
  //         });
  //       }

  //       return returnData;
  //     };
  //   },
  //   { frequency: 'Always' },
  // );
};
