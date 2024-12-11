using System.Collections.Generic;
using BepInEx.Configuration;

namespace PTT.Settings;

internal class Config
{
    private static readonly List<ConfigEntryBase> ConfigEntries = [];
    private const string TradersSection = "Traders";

    internal static ConfigEntry<bool> ShowLockedTraders { get; set; }

    internal static void Init(ConfigFile config)
    {
        ShowLockedTraders = config.Bind(TradersSection, "Show locked traders", false, "Please reload the traders page when you toggle this option.");
        ConfigEntries.Add(ShowLockedTraders);
    }
}
