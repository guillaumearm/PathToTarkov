import {
  AVAILABLE_LOCALES,
  type ByLocale,
  type Config,
  type LocaleName,
  type MapName,
} from '../config';
import { deepClone } from '../utils';

const DEFAULT_FALLBACK_LANGUAGE = 'en';

const EXFIL_DISPLAY_NAME_VARIABLE = '$exfilDisplayName';
const OFFRAID_POSITION_DISPLAY_NAME_VARIABLE = '$offraidPositionDisplayName';

type AllLocalesInDb = Record<string, Record<string, string>>;

export type MinimumConfigForTooltipsTemplater = Pick<
  Config,
  'exfiltrations' | 'exfiltrations_config' | 'exfiltrations_tooltips_template' | 'offraid_positions'
>;

export type LocalesMutationReport = {
  nbLocalesImpacted: number;
  nbTotalValuesUpdated: number;
};

export type ComputeLocaleValueParameter = {
  locale: LocaleName;
  exfilName: string;
  offraidPosition: string;
};

export class ExfilsTooltipsTemplater {
  public static readonly ERROR_NO_EXFIL = 'PTT_ERROR_NO_EXFIL_LOCALE_FOUND';

  // this is used to be sure to keep the vanilla locales even after mutations are applied to the database
  private readonly snapshotLocales: AllLocalesInDb;

  constructor(allLocales: AllLocalesInDb) {
    this.snapshotLocales = deepClone(allLocales);
  }

  public computeLocales(config: MinimumConfigForTooltipsTemplater): Partial<AllLocalesInDb> {
    const result: Partial<AllLocalesInDb> = {};

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

          // TODO: retrieve locale from exfilName
          localeValues[exfilName] = this.computeLocaleValue(config, computeParams);
        });
      });
    });

    return result;
  }

  public debugTooltipsForLocale(
    locale: string,
    config: MinimumConfigForTooltipsTemplater,
  ): Record<string, string> {
    const partialLocales = this.computeLocales(config);
    const mergedLocales: AllLocalesInDb = AVAILABLE_LOCALES.reduce<AllLocalesInDb>(
      (locales, locale) => {
        locales[locale] = {};
        return locales;
      },
      {},
    );
    void ExfilsTooltipsTemplater.mutateLocales(mergedLocales, partialLocales);
    return mergedLocales[locale];
  }

  public static mutateLocales(
    allLocales: AllLocalesInDb,
    partialLocales: Partial<AllLocalesInDb>,
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
    params: ComputeLocaleValueParameter,
  ): string {
    // TODO: retrieve locale from exfilName
    const exfilVanillaDisplayName = this.snapshotLocales[params.locale][params.exfilName];

    const exfilDisplayName =
      ExfilsTooltipsTemplater.resolveExfilDisplayName(config, params) ??
      exfilVanillaDisplayName ??
      ExfilsTooltipsTemplater.ERROR_NO_EXFIL;

    const offraidPositionDisplayName = ExfilsTooltipsTemplater.resolveOffraidPositionDisplayName(
      config,
      params,
    );

    const tooltipsTemplate = ExfilsTooltipsTemplater.resolveTooltipsTemplate(config, params);

    const templatedValue = tooltipsTemplate
      .replace(EXFIL_DISPLAY_NAME_VARIABLE, exfilDisplayName)
      .replace(OFFRAID_POSITION_DISPLAY_NAME_VARIABLE, offraidPositionDisplayName);

    return templatedValue;
  }

  private static resolveExfilDisplayName(
    config: MinimumConfigForTooltipsTemplater,
    { exfilName, locale }: ComputeLocaleValueParameter,
  ): string | undefined {
    const exfilConfig = config?.exfiltrations_config?.[exfilName];
    const resolvedDisplayName = ExfilsTooltipsTemplater.resolveDisplayName(
      locale,
      exfilConfig?.displayName,
    );

    return resolvedDisplayName;
  }

  private static resolveOffraidPositionDisplayName(
    config: MinimumConfigForTooltipsTemplater,
    { offraidPosition, locale }: ComputeLocaleValueParameter,
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
    { offraidPosition, exfilName }: ComputeLocaleValueParameter,
  ): string {
    const exfilConfig = config.exfiltrations_config?.[exfilName];
    if (exfilConfig?.override_tooltips_template?.trim()) {
      return exfilConfig.override_tooltips_template;
    }

    const offraidPositionDefinition = config.offraid_positions?.[offraidPosition];
    if (offraidPositionDefinition?.override_tooltips_template?.trim()) {
      return offraidPositionDefinition?.override_tooltips_template;
    }

    if (config.exfiltrations_tooltips_template?.trim()) {
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
