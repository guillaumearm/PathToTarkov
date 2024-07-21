import type { IRepeatableTemplates } from "@spt/models/eft/common/tables/IRepeatableQuests";
import type { IQuest } from "@spt/models/eft/common/tables/IQuest";

import { FENCE_ID } from "./config";

export type RepeatableTemplates = IRepeatableTemplates & {
  Pickup: IQuest; // this is because the type is missing in `IRepeatableTemplates` but exists in db
};

/**
 * This will prevent a crash of the client related to repeatable quests
 *
 * In order to reproduce this bug:
 * 1. disable the tweak
 * 2. create a new "SPT Developer" profile
 * 3. at some point your client should be blocked in a loading state during the creation of the profile
 */
export const tweakRepeatableQuestTemplates = (
  templates: RepeatableTemplates | undefined,
): void => {
  (["Elimination", "Completion", "Exploration", "Pickup"] as const).forEach(
    (k) => {
      if (templates && templates[k]) {
        templates[k].traderId = FENCE_ID;
        templates[k].location = "any";
      }
    },
  );
};
