import type { DatabaseServer } from "@spt/servers/DatabaseServer";
import type { PathToTarkovReloadedTooltipsConfig } from "./config";

export const pathToTarkovReloadedTooltipsConfigCompat = (
  db: DatabaseServer,
  tooltipsConfig: PathToTarkovReloadedTooltipsConfig,
): void => {
  const database = db.getTables();
  const locales = database.locales?.global;

  if (!locales) {
    throw new Error("Cannot load locales from db");
  }

  const tooltipLocale = tooltipsConfig.language?.toLowerCase() ?? "en";
  const localesToChange = tooltipsConfig.localesToChange ?? [];
  const localesToChangeAdditional =
    tooltipsConfig.localesToChangeAdditional ?? [];
  const additionalLocalesToggle = tooltipsConfig.additionalLocalesToggle;
  const moddedTraderExtracts = tooltipsConfig.moddedTraderExtracts ?? [];
  const moddedTraderCompat = tooltipsConfig.moddedTraderCompat;

  // updated to cover all language locales
  const updateLocale = (localeObj: Record<string, string>): void => {
    for (let i = 0; i < localesToChange.length; i += 2) {
      localeObj[localesToChange[i]] = localesToChange[i + 1];
    }
    if (additionalLocalesToggle) {
      for (let i = 0; i < localesToChangeAdditional.length; i += 2) {
        localeObj[localesToChangeAdditional[i]] =
          localesToChangeAdditional[i + 1];
      }
    }
    if (moddedTraderCompat) {
      for (let i = 0; i < moddedTraderExtracts.length; i += 2) {
        localeObj[moddedTraderExtracts[i]] = moddedTraderExtracts[i + 1];
      }
    }
  };

  const localeMappings = {
    english: locales.en,
    en: locales.en,
    chinese: locales.ch,
    ch: locales.ch,
    czech: locales.cz,
    cz: locales.cz,
    french: locales.fr,
    fr: locales.fr,
    german: locales.ge,
    ge: locales.ge,
    hungarian: locales.hu,
    hu: locales.hu,
    italian: locales.it,
    it: locales.it,
    japanese: locales.jp,
    jp: locales.jp,
    korean: locales.kr,
    kr: locales.kr,
    polish: locales.pl,
    pl: locales.pl,
    portuguese: locales.po,
    po: locales.po,
    slovakian: locales.sk,
    sk: locales.sk,
    spanish: locales.es,
    es: locales.es,
    turkish: locales.tu,
    tu: locales.tu,
    russian: locales.ru,
    ru: locales.ru,
    romanian: locales.ro,
    ro: locales.ro,
  };

  // Get the locale object based on tooltipLocale
  const selectedLocale =
    localeMappings[tooltipLocale as keyof typeof localeMappings];

  if (!selectedLocale) {
    throw new Error(
      `incorrect language '${tooltipLocale}' found in Tooltips.json`,
    );
  }

  updateLocale(selectedLocale);
};
