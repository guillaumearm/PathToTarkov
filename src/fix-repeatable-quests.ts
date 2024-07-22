import type { RepeatableQuestController } from "@spt/controllers/RepeatableQuestController";
import type { DependencyContainer } from "tsyringe";

export const fixRepeatableQuests = (
  container: DependencyContainer,
  debug: (data: string) => void,
): void => {
  container.afterResolution<RepeatableQuestController>(
    "RepeatableQuestController",
    (_t, result): void => {
      const allResults = Array.isArray(result) ? result : [result];

      allResults.forEach((questController) => {
        const originalFn =
          questController.getClientRepeatableQuests.bind(questController);

        questController.getClientRepeatableQuests = (sessionId: string) => {
          const repeatableQuests = originalFn(sessionId);

          debug(
            "RepeatableQuestController.getClientRepeatableQuests method called",
          );

          return repeatableQuests.map((q) => {
            return {
              ...q,
              activeQuests: q.activeQuests.filter((q) => Boolean(q.traderId)),
              inactiveQuests: q.inactiveQuests.filter((q) =>
                Boolean(q.traderId),
              ),
            };
          });
        };
      });
    },
    { frequency: "Always" },
  );
};
