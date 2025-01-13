import { type LocaleName } from '../config';

export type AllLocalesInDb = Record<string, Record<string, string>>;

type LocaleKey = string;

type LocaleKeysLowerCaseMapping = {
  [localeName: string]: {
    [lowerCasedLocaleKey: string]: LocaleKey;
  };
};

export class LocaleResolver {
  private readonly localeKeysMapping: LocaleKeysLowerCaseMapping = {};

  constructor(allLocales: AllLocalesInDb) {
    void Object.keys(allLocales).forEach(localeName => {
      const localeValues: Record<string, string> = {};
      this.localeKeysMapping[localeName] = localeValues;

      void Object.keys(allLocales[localeName]).forEach(localeKey => {
        localeValues[localeKey.toLowerCase()] = localeKey;
      });
    });
  }

  public retrieveKey(exfilName: string, locale: LocaleName): string {
    return this.localeKeysMapping?.[locale]?.[exfilName.toLowerCase()] ?? exfilName;
  }
}
