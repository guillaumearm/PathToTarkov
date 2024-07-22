import type { RepeatableQuestController } from "@spt/controllers/RepeatableQuestController";
import type { DependencyContainer } from "tsyringe";

export const disableRepeatableQuests = (
  container: DependencyContainer,
  debug: (data: string) => void,
): void => {
  container.afterResolution<RepeatableQuestController>(
    "RepeatableQuestController",
    (_t, result): void => {
      const allResults = Array.isArray(result) ? result : [result];

      allResults.forEach((questController) => {
        questController.getClientRepeatableQuests = () => {
          debug(
            "RepeatableQuestController.getClientRepeatableQuests method called",
          );

          return [];
        };
      });
    },
    { frequency: "Always" },
  );
};
