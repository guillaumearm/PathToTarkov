import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { SaveServer } from "@spt-aki/servers/SaveServer";
import { Config, Profile } from "./config";

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
    const mainStashId: string | undefined =
      profile.PathToTarkov && profile.PathToTarkov.mainStashId;

    if (
      profile &&
      profile.PathToTarkov &&
      mainStashId &&
      mainStashId !== profile.characters.pmc.Inventory.stash
    ) {
      logger.success(
        `=> PathToTarkov: restore the selected stash to main stash for profile '${profile.info.username}'`
      );
      profile.characters.pmc.Inventory.stash = mainStashId;
    }

    let nbTradersRestored = 0;
    Object.keys(config.traders_config).forEach((traderId) => {
      const trader = profile.characters.pmc.TradersInfo?.[traderId];

      if (trader && trader.unlocked === false) {
        // TODO 1: check for jaeger quest
        // TODO 2: check if player is level 15 (for flea market aka ragfair)
        trader.unlocked = true;
        nbTradersRestored += 1;
      }
    });

    if (nbTradersRestored > 0) {
      logger.success(
        `=> PathToTarkov: ${nbTradersRestored} trader${
          nbTradersRestored === 1 ? "" : "s"
        } restored for profile '${profile.info.username}'`
      );
    }
  });

  saveServer.save();
};
