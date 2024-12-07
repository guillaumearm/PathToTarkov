// eslint-disable-next-line @typescript-eslint/no-var-requires
const Tooltips = require('../configs/Default/Tooltips.json');

const localesToChange = Tooltips.localesToChange ?? [];
const additionalLocales =
  (Tooltips.additionalLocalesToggle ? Tooltips.localesToChangeAdditional : []) ?? [];
const moddedLocales = (Tooltips.moddedTraderCompat ? Tooltips.moddedTraderExtracts : []) ?? [];
const allLocales = [...localesToChange, ...additionalLocales, ...moddedLocales];

const localeMappings = {
  english: 'en',
  en: 'en',
  chinese: 'ch',
  ch: 'ch',
  czech: 'cz',
  cz: 'cz',
  french: 'fr',
  fr: 'fr',
  german: 'ge',
  ge: 'ge',
  hungarian: 'hu',
  hu: 'hu',
  italian: 'it',
  it: 'it',
  japanese: 'jp',
  jp: 'jp',
  korean: 'kr',
  kr: 'kr',
  polish: 'pl',
  pl: 'pl',
  portuguese: 'po',
  po: 'po',
  slovakian: 'sk',
  sk: 'sk',
  spanish: 'es',
  es: 'es',
  turkish: 'tu',
  tu: 'tu',
  russian: 'ru',
  ru: 'ru',
  romanian: 'ro',
  ro: 'ro',
};

const getLang = rawLang => {
  return localeMappings[rawLang] ?? rawLang ?? 'en';
};

const createExfilConfig = (rawLang, localeValue) => {
  const lang = getLang(rawLang);

  return {
    displayName: {
      // ch: localeValue,
      // cz: localeValue,
      // en: localeValue,
      // 'es-mx': localeValue,
      // es: localeValue,
      // fr: localeValue,
      // ge: localeValue,
      // hu: localeValue,
      // it: localeValue,
      // jp: localeValue,
      // kr: localeValue,
      // pl: localeValue,
      // po: localeValue,
      // ro: localeValue,
      // ru: localeValue,
      // sk: localeValue,
      // tu: localeValue,
      [lang]: localeValue,
    },
  };
};

const isOdd = n => Boolean(n % 2);
const isEven = n => !isOdd(n);

const extractExfiltrationsConfigFromLocales = locales => {
  const exfiltrationsConfig = {};
  locales.forEach((localeKey, i) => {
    if (isEven(i)) {
      const localeValue = locales[i + 1];
      exfiltrationsConfig[localeKey] = createExfilConfig(Tooltips.language, localeValue);
    }
  });
  return exfiltrationsConfig;
};

const exfiltrations_config = extractExfiltrationsConfigFromLocales(allLocales);

console.log(JSON.stringify(exfiltrations_config, undefined, 2));
