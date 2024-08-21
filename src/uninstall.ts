import type { ILogger } from '@spt/models/spt/utils/ILogger';
import type { SaveServer } from '@spt/servers/SaveServer';
import type { Config, Profile } from './config';
import { getMainStashId, setInventorySlotIds } from './helpers';
import type { IQuest } from '@spt/models/eft/common/tables/IQuest';
import { TradersAvailabilityService } from './services/TradersAvailabilityService';

const restoreMainStash = (profile: Profile, logger: ILogger): void => {
  const pmcInventory = profile.characters.pmc.Inventory;

  const mainStashId = getMainStashId(profile);

  if (mainStashId !== pmcInventory.stash) {
    logger.success(
      `=> PathToTarkov: restore the selected stash to main stash for profile '${profile.info.username}'`,
    );
    pmcInventory.stash = mainStashId;
  }
};

const restoreTraders = (
  config: Config,
  tradersAvailabilityService: TradersAvailabilityService,
  profile: Profile,
  logger: ILogger,
) => {
  let nbTradersLocked = 0;
  let nbTradersUnlocked = 0;

  Object.keys(config.traders_config).forEach(traderId => {
    const pmc = profile.characters.pmc;
    const trader = pmc.TradersInfo?.[traderId];

    if (!trader) {
      return;
    }

    const unlocked = tradersAvailabilityService.isAvailable(traderId, pmc.Quests);

    if (trader.unlocked && !unlocked) {
      nbTradersLocked += 1;
    } else if (!trader.unlocked && unlocked) {
      nbTradersUnlocked += 1;
    }

    trader.unlocked = unlocked;
  });

  if (nbTradersLocked > 0) {
    logger.success(
      `=> PathToTarkov: ${nbTradersLocked} trader${
        nbTradersLocked === 1 ? '' : 's'
      } locked for profile '${profile.info.username}'`,
    );
  }

  if (nbTradersUnlocked > 0) {
    logger.success(
      `=> PathToTarkov: ${nbTradersUnlocked} trader${
        nbTradersUnlocked === 1 ? '' : 's'
      } unlocked for profile '${profile.info.username}'`,
    );
  }
};

// Used for uninstallation process
export const purgeProfiles = (
  config: Config,
  quests: Record<string, IQuest>,
  saveServer: SaveServer,
  logger: ILogger,
): void => {
  // because we want to be sure to be able to read `SaveServer.profiles`
  saveServer.load();

  const tradersAvailabilityService = new TradersAvailabilityService().init(quests);

  Object.keys(saveServer.getProfiles()).forEach(sessionId => {
    const profile: Profile = saveServer.getProfile(sessionId);
    const mainStashId = getMainStashId(profile);

    restoreMainStash(profile, logger);
    restoreTraders(config, tradersAvailabilityService, profile, logger);
    setInventorySlotIds(profile, mainStashId, config.hideout_secondary_stashes);
  });

  saveServer.save();
};
