import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ConfigGetter, LocaleName } from "./config";
import { IRagFair } from "@spt/models/eft/common/IGlobals";
import { JAEGER_ID, PRAPOR_ID } from "./config";
import { checkAccessVia, isJaegerIntroQuestCompleted } from "./helpers";
import { isEmptyArray } from "./utils";

/**
 * Used only when `traders_access_restriction` is true
 */
export class TradersController {
  constructor(
    private readonly getConfig: ConfigGetter,
    private readonly getIsTraderLocked: (traderId: string) => boolean,
    private readonly db: DatabaseServer,
    private readonly saveServer: SaveServer,
    private readonly logger: ILogger,
  ) {}

  initFlea(): void {
    const globals = this.db.getTables().globals;
    const ragfairConfig = globals?.config.RagFair as IRagFair;
    const locales = this.db.getTables().locales;
    const config = this.getConfig();
    const tradersConfig = config.traders_config;

    if (config.flea_access_restriction) {
      const ragfairTraderConfig = tradersConfig["ragfair"];

      if (ragfairTraderConfig.override_description) {
        const locationDescription = ragfairTraderConfig.location_description;

        Object.entries(locales?.global ?? {}).forEach(([locale, globalLocale]) => {
          const desc = locationDescription?.[locale as LocaleName];
          const localeId = `ragfair/Unlocked at character LVL {0}`;

          if (desc && globalLocale?.[localeId]) {
            globalLocale[localeId] = desc;
          }
        });
      }

      ragfairConfig.minUserLevel = 420;
    }
  }
  
  initTraders(): void {
    this.fixInsuranceDialogues();

    const config = this.getConfig();
    const tradersConfig = config.traders_config;
    const traders = this.db.getTables().traders;
    const locales = this.db.getTables().locales;

    if (!traders) {
      throw new Error("Fatal initTraders: no traders found in db");
    }

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
                  `=> PathToTarkov: no locales '${locale}' found for trader '${traderId}'`,
                );
              }
            }
          });
        }

        // insurances update
        if (tradersConfig[traderId].insurance_always_enabled) {
          const insuranceTraderConfig =
            tradersConfig[traderId].insurance_config || {};

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
          const repairTraderConfig =
            tradersConfig[traderId].repair_config || {};

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

        // offraid pay-to-heal config
        if (tradersConfig[traderId].heal_always_enabled) {
          trader.base.loyaltyLevels = trader.base.loyaltyLevels.map(
            (loyaltyLevel, index) => {
              if (loyaltyLevel.heal_price_coef > 0) {
                return loyaltyLevel;
              }

              const addedPriceCoef = index === 3 ? 35 : index * 10;

              return {
                ...loyaltyLevel,
                heal_price_coef: 100 + addedPriceCoef,
              };
            },
          );
        }
      } else if (!this.getConfig().traders_config[traderId].disable_warning) {
        this.logger.warning(
          `=> PathToTarkov: Unknown trader id found during init: '${traderId}'`,
        );
      }
    });
  }

  // fix for missing `insuranceStart` and `insuranceFound` properties when player died
  private fixInsuranceDialogues(): void {
    const traders = this.db.getTables().traders ?? {};
    const praporDialogue = traders?.[PRAPOR_ID]?.dialogue;

    if (!praporDialogue) {
      throw new Error(
        "Fatal PTTController fixInsuranceDialogues: Prapor dialogue object is required",
      );
    }

    Object.keys(traders).forEach((traderId) => {
      const trader = traders?.[traderId];

      if (trader && !trader.dialogue) {
        trader.dialogue = praporDialogue;
      } else if (trader?.dialogue) {
        for (const dialogueKey of [
          "insuranceStart",
          "insuranceFound",
          "insuranceFailed",
          "insuranceFailedLabs",
          "insuranceExpired",
          "insuranceComplete",
        ]) {
          if (
            !trader.dialogue[dialogueKey] ||
            isEmptyArray(trader.dialogue[dialogueKey])
          ) {
            trader.dialogue[dialogueKey] = praporDialogue[dialogueKey] ?? [];
          }
        }
      }
    });
  }

  updateTraders(offraidPosition: string, sessionId: string): void {
    const tradersConfig = this.getConfig().traders_config;

    const profile = this.saveServer.getProfile(sessionId);
    const pmc = profile.characters.pmc;
    const tradersInfo = pmc.TradersInfo;
    const isJaegerAvailable = isJaegerIntroQuestCompleted(pmc.Quests);

    const globals = this.db.getTables().globals;
    const ragfairConfig = globals?.config.RagFair as IRagFair;
    const locales = this.db.getTables().locales;
    const enLocale = locales?.global?.["en"];

    const config = this.getConfig();
    const fleaAccessLevel = config.flea_access_level;

    Object.keys(tradersConfig).forEach((traderId) => {
      let unlocked =
        checkAccessVia(tradersConfig[traderId].access_via, offraidPosition) &&
        !this.getIsTraderLocked(traderId);

      if (traderId === JAEGER_ID) {
        unlocked = unlocked && isJaegerAvailable;
      }

      if (tradersInfo[traderId]) {
        tradersInfo[traderId].unlocked = unlocked;

        if (tradersInfo["ragfair"].unlocked) {
          if (fleaAccessLevel && profile.characters.pmc.Info.Level < fleaAccessLevel) {
            const localeId = "ragfair/Unlocked at character LVL {0}";
            const desc = `Gain a name for yourself before trying to trade here (Level ${fleaAccessLevel})`;

            if (enLocale && enLocale[localeId]) {
              enLocale[localeId] = desc;
            }

            ragfairConfig.minUserLevel = fleaAccessLevel;
          } else {
            ragfairConfig.minUserLevel = 420;
          }
        }
      } 
    });
  }
}
