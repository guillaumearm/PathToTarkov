import type { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import type { IInsuranceConfig } from "@spt-aki/models/spt/config/IInsuranceConfig";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import type { ConfigServer } from "@spt-aki/servers/ConfigServer";
import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import type { SaveServer } from "@spt-aki/servers/SaveServer";
import type { ConfigGetter, LocaleName } from "./config";
import { JAEGER_INTRO_QUEST, PRAPOR_ID } from "./config";
import { checkAccessVia } from "./helpers";

/**
 * Used only when `traders_access_restriction` is true
 */
export class TradersController {
  constructor(
    private readonly getConfig: ConfigGetter,
    private readonly getIsTraderLocked: (traderId: string) => boolean,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    private readonly configServer: ConfigServer,
    private readonly logger: ILogger
  ) {}

  private disableUnlockJaegerViaIntroQuest(): void {
    const quests = this.db.getTables().templates?.quests;
    const quest = quests?.[JAEGER_INTRO_QUEST];

    if (
      quest &&
      quest._id === JAEGER_INTRO_QUEST &&
      quest.QuestName === "Introduction"
    ) {
      quest.rewards.Success = quest.rewards.Success.filter(
        (payload) => payload.type !== "TraderUnlock"
      );
    }
  }

  initTraders(): void {
    const config = this.getConfig();
    const tradersConfig = config.traders_config;
    const traders = this.db.getTables().traders;
    const locales = this.db.getTables().locales;

    const praporTrader = traders?.[PRAPOR_ID];

    if (!praporTrader) {
      throw new Error("Fatal initTraders: prapor trador cannot be found");
    }

    this.disableUnlockJaegerViaIntroQuest();

    Object.keys(tradersConfig).forEach((traderId) => {
      const trader = traders[traderId];

      if (trader) {
        // be able to lock a trader
        trader.base.unlockedByDefault = false;

        if (tradersConfig[traderId].override_description) {
          // change trader location in descriptions

          Object.keys(locales?.global ?? []).forEach((locale) => {
            const locationDescription =
              tradersConfig[traderId].location_description;

            const desc =
              locationDescription && locationDescription[locale as LocaleName];

            if (desc) {
              const globalLocale = locales?.global?.[locale];
              const localeId = `${traderId} Description`;

              if (globalLocale && globalLocale[localeId]) {
                globalLocale[localeId] = desc;
              } else {
                this.logger.warning(
                  `=> PathToTarkov: no locales '${locale}' found for trader '${traderId}'`
                );
              }
            }
          });
        }

        // insurances update
        if (tradersConfig[traderId].insurance_always_enabled) {
          const traders = this.db.getTables().traders;
          const trader = traders?.[traderId];
          const insuranceTraderConfig =
            tradersConfig[traderId].insurance_config || {};

          if (!trader) {
            throw new Error(
              `Fatal initTraders: unknown trader found '${traderId}'`
            );
          }

          if (!trader.dialogue) {
            // prevent several issues (freeze and crash)
            trader.dialogue = praporTrader.dialogue;
          }

          const insuranceConfig = this.configServer.getConfig<IInsuranceConfig>(
            "aki-insurance" as ConfigTypes.INSURANCE
          );

          insuranceConfig.insuranceMultiplier[traderId] =
            insuranceTraderConfig.insuranceMultiplier || 0.3;

          trader.base.insurance.availability = true;
          trader.base.insurance.min_payment =
            insuranceTraderConfig.min_payment || 0;
          trader.base.insurance.min_return_hour =
            insuranceTraderConfig.min_return_hour || 1;
          trader.base.insurance.max_return_hour =
            insuranceTraderConfig.max_return_hour || 2;
          trader.base.insurance.max_storage_time =
            insuranceTraderConfig.max_storage_time || 480;

          trader.base.loyaltyLevels.forEach((payloadLevel) => {
            payloadLevel.insurance_price_coef =
              insuranceTraderConfig.insurance_price_coef || 1;
          });
        }

        // repairs update
        if (tradersConfig[traderId].repair_always_enabled) {
          const traders = this.db.getTables().traders;
          const trader = traders?.[traderId];

          const repairTraderConfig =
            tradersConfig[traderId].repair_config || {};

          if (!trader) {
            throw new Error(
              `=> PathToTarkov: unknown trader found '${traderId}'`
            );
          }

          trader.base.repair.availability = true;

          if (repairTraderConfig.quality) {
            trader.base.repair.quality = repairTraderConfig.quality;
          }

          if (repairTraderConfig.currency) {
            trader.base.repair.currency = repairTraderConfig.currency;
          }

          if (typeof repairTraderConfig.currency_coefficient == "number") {
            trader.base.repair.currency_coefficient =
              repairTraderConfig.currency_coefficient;
          }

          const repairPriceCoef = repairTraderConfig.repair_price_coef;
          if (typeof repairPriceCoef === "number") {
            trader.base.loyaltyLevels.forEach((payloadLevel) => {
              payloadLevel.repair_price_coef = repairPriceCoef;
            });
          }
        }
      } else if (!this.getConfig().traders_config[traderId].disable_warning) {
        this.logger.warning(
          `=> PathToTarkov: Unknown trader id found during init: '${traderId}'`
        );
      }
    });
  }

  updateTraders(offraidPosition: string, sessionId: string): void {
    const tradersConfig = this.getConfig().traders_config;

    const profile = this.saveServer.getProfile(sessionId);
    const tradersInfo = profile.characters.pmc.TradersInfo;

    Object.keys(tradersConfig).forEach((traderId) => {
      const unlocked =
        checkAccessVia(tradersConfig[traderId].access_via, offraidPosition) &&
        !this.getIsTraderLocked(traderId);

      if (tradersInfo[traderId]) {
        tradersInfo[traderId].unlocked = unlocked;
      }
    });
  }
}
