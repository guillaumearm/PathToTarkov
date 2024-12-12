import { readFileSync } from 'node:fs';

describe('external resources', () => {
  describe('EN locales', () => {
    const locales: Record<string, string> = JSON.parse(
      readFileSync('./external-resources/locales_global_en.json').toString(),
    );

    it('should have the same length once lower cased', () => {
      const localeNames = Object.keys(locales);

      const lowerCasedLocales = localeNames.reduce<Record<string, string>>((acc, localeName) => {
        acc[localeName.toLowerCase()] = locales[localeName];
        return acc;
      }, {});

      const nbLowerCasedLocales = Object.keys(lowerCasedLocales).length;
      expect(nbLowerCasedLocales).toBe(localeNames.length);
    });
  });
});
