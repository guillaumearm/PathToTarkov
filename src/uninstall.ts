import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { Config, Profile } from "./config";
import { JAEGER_ID } from "./config";
import { isJaegerIntroQuestCompleted } from "./helpers";
import { getMainStashId } from "./utils";

// Used for uninstallation process
export const purgeProfiles = (
  config: Config,
  saveServer: SaveServer,
  logger: ILogger
): void => {
  // be sure to be able to read `SaveServer.profiles`
  saveServer.load();

  const profiles = saveServer.getProfiles();

  Object.keys(profiles).forEach((sessionId) => {
    const profile: Profile = saveServer.getProfile(sessionId);
    const pmc = profile.characters.pmc;

    const pmcInventory = pmc.Inventory;

    const mainStashId = getMainStashId(profile);

    if (mainStashId !== pmcInventory.stash) {
      logger.success(
        `=> PathToTarkov: restore the selected stash to main stash for profile '${profile.info.username}'`
      );
      pmcInventory.stash = mainStashId;
    }

    let nbTradersRestored = 0;
    let jaegerLocked = false;
    Object.keys(config.traders_config).forEach((traderId) => {
      const pmc = profile.characters.pmc;
      const trader = pmc.TradersInfo?.[traderId];
      const jaegerAvailable = isJaegerIntroQuestCompleted(pmc);

      if (
        trader &&
        trader.unlocked === false &&
        ((traderId === JAEGER_ID && jaegerAvailable) || traderId !== JAEGER_ID)
      ) {
        trader.unlocked = true;
        nbTradersRestored += 1;
      } else if (
        trader &&
        trader.unlocked === true &&
        traderId === JAEGER_ID &&
        !jaegerAvailable
      ) {
        trader.unlocked = false;
        jaegerLocked = true;
      }
    });

    if (nbTradersRestored > 0) {
      logger.success(
        `=> PathToTarkov: ${nbTradersRestored} trader${
          nbTradersRestored === 1 ? "" : "s"
        } restored for profile '${profile.info.username}'`
      );
    }

    if (jaegerLocked) {
      logger.success(
        `=> PathToTarkov: Jaeger trader locked (because introduction quest is not completed) for profile '${profile.info.username}'`
      );
    }
  });

  saveServer.save();
};
