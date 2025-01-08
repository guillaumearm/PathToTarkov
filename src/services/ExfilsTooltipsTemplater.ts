import { parseExilTargetFromPTTConfig } from '../exfils-targets';
import {
  AVAILABLE_LOCALES,
  DEFAULT_FALLBACK_LANGUAGE,
  type ByLocale,
  type Config,
  type LocaleName,
  type MapName,
} from '../config';
import { deepClone } from '../utils';
import type { AllLocalesInDb } from './LocaleResolver';
import { LocaleResolver } from './LocaleResolver';
import { mutateLocales } from '../helpers';

const EXFIL_DISPLAY_NAME_VARIABLE = '$exfilDisplayName';
const OFFRAID_POSITION_DISPLAY_NAME_VARIABLE = '$offraidPositionDisplayName';

export type MinimumConfigForTooltipsTemplater = Pick<
  Config,
  'exfiltrations' | 'exfiltrations_config' | 'exfiltrations_tooltips_template' | 'offraid_positions'
>;

export type ComputeLocaleValueParameter = {
  locale: LocaleName;
  localeKey: string;
  exfilName: string;
  offraidPosition: string;
};

export class ExfilsTooltipsTemplater {
  public static readonly ERROR_NO_EXFIL = 'PTT_ERROR_EXFIL_LOCALE_NOT_FOUND';

  // this is used to be sure to keep the vanilla locales even after mutations are applied to the database
  private readonly snapshotLocales: AllLocalesInDb;
  private readonly localeResolver: LocaleResolver;

  constructor(allLocales: AllLocalesInDb) {
    this.snapshotLocales = deepClone(allLocales);
    this.localeResolver = new LocaleResolver(allLocales);
  }

  public computeLocales(config: MinimumConfigForTooltipsTemplater): Partial<AllLocalesInDb> {
    const result: Partial<AllLocalesInDb> = {};

    Object.keys(this.snapshotLocales).forEach(locale => {
      const localeValues: Record<string, string> = {};
      result[locale] = localeValues;

      Object.keys(config.exfiltrations).forEach(mapName => {
        const exfils = config.exfiltrations[mapName as MapName];

        Object.keys(exfils).forEach(exfilName => {
          const exfilTargets = exfils[exfilName] ?? [];

          const foundTargetOffraidPosition =
            exfilTargets
              .map(exfilTarget => {
                // here we need to parse in order to make sure we get an offraidPosition and not a transit notation
                const parsed = parseExilTargetFromPTTConfig(exfilTarget);
                return parsed.targetOffraidPosition;
              })
              .find(Boolean) ?? ''; // offraid position is empty when only transits are used

          const localeName = locale as LocaleName;
          const localeKey = this.localeResolver.retrieveKey(exfilName, localeName);

          const computeParams: ComputeLocaleValueParameter = {
            locale: localeName,
            localeKey,
            exfilName,
            offraidPosition: foundTargetOffraidPosition,
          };

          localeValues[localeKey] = this.computeLocaleValue(config, computeParams);
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
    void mutateLocales(mergedLocales, partialLocales);
    return mergedLocales[locale];
  }

  private computeLocaleValue(
    config: MinimumConfigForTooltipsTemplater,
    params: ComputeLocaleValueParameter,
  ): string {
    const exfilVanillaDisplayName = this.snapshotLocales[params.locale]?.[params.localeKey];

    const exfilDisplayName =
      ExfilsTooltipsTemplater.resolveExfilDisplayName(config, params) ??
      exfilVanillaDisplayName ??
      ExfilsTooltipsTemplater.ERROR_NO_EXFIL;

    const offraidPositionDisplayName = ExfilsTooltipsTemplater.resolveOffraidPositionDisplayName(
      config,
      params,
    );

    const tooltipsTemplate = ExfilsTooltipsTemplater.resolveTooltipsTemplate(
      config,
      params.exfilName,
    );

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

  public static resolveOffraidPositionDisplayName(
    config: MinimumConfigForTooltipsTemplater,
    { offraidPosition, locale }: { offraidPosition: string; locale: LocaleName },
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
    if (exfilConfig?.override_tooltips_template?.trim()) {
      return exfilConfig.override_tooltips_template;
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
