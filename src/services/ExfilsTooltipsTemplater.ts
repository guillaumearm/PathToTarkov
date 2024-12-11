import type { ByLocale, Config, LocaleName, MapName } from '../config';
import { deepClone } from '../utils';

const EXFIL_DISPLAY_NAME_VARIABLE = '$exfilDisplayName';
const OFFRAID_POSITION_DISPLAY_NAME_VARIABLE = '$offraidPositionDisplayName';

const DEFAULT_FALLBACK_LANGUAGE = 'en';

type AllLocalesInDb = Record<string, Record<string, string>>;
type PartialLocales = Partial<Record<string, Record<string, string>>>;

export type MinimumConfigForTooltipsTemplater = Pick<
  Config,
  'exfiltrations' | 'exfiltrations_config' | 'exfiltrations_tooltips_template' | 'offraid_positions'
>;

export type LocalesMutationReport = {
  nbLocalesImpacted: number;
  nbTotalValuesUpdated: number;
};

type ComputeLocaleValueParameter = {
  locale: LocaleName;
  exfilName: string;
  offraidPosition: string;
};

export class ExfilsTooltipsTemplater {
  // this is used to be sure to keep the vanilla locales even after mutations are applied to the database
  private readonly snapshotLocales: AllLocalesInDb;

  constructor(allLocales: AllLocalesInDb) {
    this.snapshotLocales = deepClone(allLocales);
  }

  public computeLocales(config: MinimumConfigForTooltipsTemplater): PartialLocales {
    const result: PartialLocales = {};

    Object.keys(this.snapshotLocales).forEach(locale => {
      const localeValues: Record<string, string> = {};
      result[locale] = localeValues;

      Object.keys(config.exfiltrations).forEach(mapName => {
        const exfils = config.exfiltrations[mapName as MapName];

        Object.keys(exfils).forEach(exfilName => {
          const offraidPosition = exfils[exfilName];

          const computeParams: ComputeLocaleValueParameter = {
            locale: locale as LocaleName,
            exfilName,
            offraidPosition,
          };

          localeValues[exfilName] = this.computeLocaleValue(config, computeParams);
        });
      });
    });

    return result;
  }

  public static mutateLocales(
    allLocales: AllLocalesInDb,
    partialLocales: PartialLocales,
  ): LocalesMutationReport {
    const report: LocalesMutationReport = {
      nbLocalesImpacted: 0,
      nbTotalValuesUpdated: 0,
    };

    void Object.keys(allLocales).forEach(localeName => {
      if (partialLocales[localeName]) {
        const values = allLocales[localeName];
        const newValues = partialLocales[localeName] ?? {};
        const nbNewValues = Object.keys(newValues).length;

        if (nbNewValues > 0) {
          void Object.assign(values, newValues); // mutation here
          report.nbLocalesImpacted += 1;
          report.nbTotalValuesUpdated += nbNewValues;
        }
      }
    });

    return report;
  }

  private computeLocaleValue(
    config: MinimumConfigForTooltipsTemplater,
    { exfilName, offraidPosition, locale }: ComputeLocaleValueParameter,
  ): string {
    const exfilDisplayName = this.resolveExfilDisplayName(config, exfilName, locale);

    const offraidPositionDisplayName = ExfilsTooltipsTemplater.resolveOffraidPositionDisplayName(
      config,
      offraidPosition,
      locale,
    );

    const tooltipsTemplate = ExfilsTooltipsTemplater.resolveTooltipsTemplate(config, exfilName);

    const templatedValue = tooltipsTemplate
      .replace(EXFIL_DISPLAY_NAME_VARIABLE, exfilDisplayName)
      .replace(OFFRAID_POSITION_DISPLAY_NAME_VARIABLE, offraidPositionDisplayName);

    return templatedValue;
  }

  private resolveExfilDisplayName(
    config: MinimumConfigForTooltipsTemplater,
    exfilName: string,
    locale: LocaleName,
  ): string {
    const exfilConfig = config?.exfiltrations_config?.[exfilName];
    const resolvedDisplayName = ExfilsTooltipsTemplater.resolveDisplayName(
      locale,
      exfilConfig?.displayName,
    );

    if (resolvedDisplayName) {
      return resolvedDisplayName;
    }

    const vanillaResolvedValue = this.snapshotLocales[locale][exfilName];
    return vanillaResolvedValue ?? 'PTT_ERROR_NO_EXFIL_LOCALE_FOUND';
  }

  private static resolveOffraidPositionDisplayName(
    config: MinimumConfigForTooltipsTemplater,
    offraidPosition: string,
    locale: LocaleName,
  ): string {
    const offraidPositionDefinition = config.offraid_positions?.[offraidPosition];
    const resolvedDisplayName = ExfilsTooltipsTemplater.resolveDisplayName(
      locale,
      offraidPositionDefinition?.displayName,
    );

    if (resolvedDisplayName) {
      return resolvedDisplayName;
    }

    return offraidPosition;
  }

  private static resolveTooltipsTemplate(
    config: MinimumConfigForTooltipsTemplater,
    exfilName: string,
  ): string {
    const exfilConfig = config.exfiltrations_config?.[exfilName];

    if (exfilConfig?.override_tooltips_template) {
      return exfilConfig.override_tooltips_template;
    }

    if (config.exfiltrations_tooltips_template) {
      return config.exfiltrations_tooltips_template;
    }

    // by default, the tooltips template is the name of the exfil itself
    return EXFIL_DISPLAY_NAME_VARIABLE;
  }

  private static resolveDisplayName = (
    locale: LocaleName,
    displayName: ByLocale<string> | undefined,
  ): string | undefined => {
    if (!displayName) {
      return undefined;
    }

    return displayName[locale] ?? displayName[DEFAULT_FALLBACK_LANGUAGE];
  };
}
