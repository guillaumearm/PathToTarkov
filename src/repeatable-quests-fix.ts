import type { IRepeatableTemplates } from "@spt/models/eft/common/tables/IRepeatableQuests";
import type { IQuest } from "@spt/models/eft/common/tables/IQuest";
import type { IRepeatableQuestTypesConfig } from "@spt/models/spt/config/IQuestConfig";

import { FENCE_ID } from "./config";

/**
 * This will prevent a crash of the client related to repeatable quests
 *
 * In order to reproduce this bug:
 * 1. disable the tweak
 * 2. create a new "SPT Developer" profile
 * 3. at some point your client should be blocked in a loading state during the creation of the profile
 */
export const tweakRepeatableQuestTemplates = (
  templates: IRepeatableTemplates | undefined,
): boolean => {
  if (!templates) {
    return false;
  }

  const pickupQuest = (templates as unknown as Record<string, IQuest>)[
    "Pickup" satisfies keyof IRepeatableQuestTypesConfig
  ];

  pickupQuest.traderId = FENCE_ID;
  pickupQuest.location = "any";

  templates.Completion.traderId = FENCE_ID;
  templates.Completion.location = "any";

  templates.Exploration.traderId = FENCE_ID;
  templates.Exploration.location = "any";

  templates.Elimination.traderId = FENCE_ID;
  templates.Elimination.location = "any";

  return true;
};
