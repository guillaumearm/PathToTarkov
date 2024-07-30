import type { ILogger } from "@spt/models/spt/utils/ILogger";
import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { SaveServer } from "@spt/servers/SaveServer";
import type { ConfigGetter, LocaleName } from "./config";
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
          const traders = this.db.getTables().traders;
          const trader = traders?.[traderId];
          const insuranceTraderConfig =
            tradersConfig[traderId].insurance_config || {};

          if (!trader) {
            throw new Error(
              `Fatal initTraders: unknown trader found '${traderId}'`,
            );
          }

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
              `=> PathToTarkov: unknown trader found '${traderId}'`,
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

    Object.keys(tradersConfig).forEach((traderId) => {
      let unlocked =
        checkAccessVia(tradersConfig[traderId].access_via, offraidPosition) &&
        !this.getIsTraderLocked(traderId);

      if (traderId === JAEGER_ID) {
        unlocked = unlocked && isJaegerAvailable;
      }

      if (tradersInfo[traderId]) {
        tradersInfo[traderId].unlocked = unlocked;
      }
    });
  }
}
