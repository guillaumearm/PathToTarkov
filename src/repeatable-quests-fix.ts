import { IRepeatableTemplates } from "@spt/models/eft/common/tables/IRepeatableQuests";
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
  templates: IRepeatableTemplates | undefined
): void => {
  (["Elimination", "Completion", "Exploration"] as const).forEach(
    (k: keyof IRepeatableTemplates) => {
      if (templates && templates[k]) {
        templates[k].traderId = FENCE_ID;
        templates[k].location = "any";
      }
    }
  );
};
