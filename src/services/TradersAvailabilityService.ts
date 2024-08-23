import type { IQuestStatus } from '@spt/models/eft/common/tables/IBotBase';
import type { IQuest } from '@spt/models/eft/common/tables/IQuest';

type Quests = Record<string, IQuest>;

type TradersLockedByQuests = {
  [traderId: string]: {
    [questId: string]: boolean;
  };
};

const QUEST_STATUS_SUCCESS = 4;

export class TradersAvailabilityService {
  private tradersLockedByQuests: TradersLockedByQuests | null = null;

  public init(quests: Quests): TradersAvailabilityService {
    const tradersLockedByQuests: TradersLockedByQuests = {};

    Object.keys(quests).forEach(questId => {
      tradersLockedByQuests[questId] = {};

      const rewards = quests[questId].rewards.Success ?? [];
      rewards.forEach(reward => {
        if (reward.type === 'TraderUnlock' && reward.target) {
          if (!tradersLockedByQuests[reward.target]) {
            tradersLockedByQuests[reward.target] = {};
          }

          tradersLockedByQuests[reward.target][questId] = true;
        }
      });
    });

    this.tradersLockedByQuests = tradersLockedByQuests;

    return this;
  }

  isAvailable(traderId: string, pmcQuests: IQuestStatus[]): boolean {
    if (this.tradersLockedByQuests === null) {
      throw new Error('TraderAvailabilityService is not initialized');
    }

    const unlockQuests = this.tradersLockedByQuests[traderId];

    if (!unlockQuests || Object.keys(unlockQuests).length === 0) {
      return true;
    }

    const completedQuest = pmcQuests.find(
      q => q.status === QUEST_STATUS_SUCCESS && unlockQuests[q.qid],
    );

    return Boolean(completedQuest);
  }
}
