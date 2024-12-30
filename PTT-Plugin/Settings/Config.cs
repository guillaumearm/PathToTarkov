using BepInEx.Configuration;

namespace PTT.Settings;

internal class Config
{
    private const string TradersSection = "1. Traders";
    private const string ExfilSection = "2. Exfiltration";

    internal static ConfigEntry<bool> ShowLockedTraders { get; set; }
    internal static ConfigEntry<bool> ExfilAutoselectCancel { get; set; }

    internal static void Init(ConfigFile config)
    {
        ShowLockedTraders = config.Bind(
            TradersSection,
            "Show locked traders",
            false,
            "Please reload the traders page when you toggle this option."
        );

        ExfilAutoselectCancel = config.Bind(
            ExfilSection,
            "Cancel action auto-selected",
            true,
            "Disable this so you can just press double-F on extract."
        );
    }
}
