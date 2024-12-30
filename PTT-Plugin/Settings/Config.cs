using BepInEx.Configuration;

namespace PTT.Settings;

internal class Config
{
    private const string AdvancedSection = "0. Advanced";
    private const string TradersSection = "1. Traders";
    private const string ExfilSection = "2. Exfiltration";

    internal static ConfigEntry<bool> DebugMode { get; set; }
    internal static ConfigEntry<bool> ShowLockedTraders { get; set; }
    internal static ConfigEntry<bool> ExfilAutoselectCancel { get; set; }
    internal static ConfigEntry<bool> SilentMissingInteractableExfilsWarning { get; set; }

    internal static void Init(ConfigFile config)
    {
        SilentMissingInteractableExfilsWarning = config.Bind(
            AdvancedSection,
            "Silent Missing Interactable Exfils API Warning",
            false,
            new ConfigDescription(
                "If you want to play without the Interactable Exfils API it's still possible. You may want to silent the warning on game start using this option.",
                null,
                new ConfigurationManagerAttributes { IsAdvanced = true }
            )
        );

        DebugMode = config.Bind(
            AdvancedSection,
            "Development Mode",
            false,
            new ConfigDescription(
                "For development purpose. it does nothing very special",
                null,
                new ConfigurationManagerAttributes { IsAdvanced = true }
            )
        );

        ShowLockedTraders = config.Bind(
            TradersSection,
            "Show locked traders",
            false,
            new ConfigDescription(
                "Please reload the traders page when you toggle this option.",
                null,
                new ConfigurationManagerAttributes { }
            )
        );

        ExfilAutoselectCancel = config.Bind(
            ExfilSection,
            "Cancel action auto-selected",
            true,
            new ConfigDescription(
                "Disable this so you can just press double-F on extract.",
                null,
                new ConfigurationManagerAttributes { }
            )
        );
    }
}
