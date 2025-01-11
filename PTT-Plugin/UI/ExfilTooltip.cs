using System.Collections.Generic;
using System.Linq;
using Comfort.Common;
using EFT;
using EFT.Interactive;
using PTT.Data;
using PTT.Helpers;

namespace PTT.UI;

public class ExfilTooltip(ExfiltrationPoint ExfilPoint)
{
    private const string PREFIX_LAYOUT_MAPS = "<width=100%><align=\"left\"><size=40%>";
    private const string PREFIX_LAYOUT_TRADERS = "<width=100%><align=\"left\"><size=40%>";
    public string GetPrimaryText()
    {
        string locationId = Singleton<GameWorld>.Instance?.LocationId ?? "";
        string localized = $"{locationId.ToLower()}.{ExfilPoint.Settings.Name}".Localized();
        return $"<width=100%><align=\"left\">{localized}";
    }

    public string GetSecondaryText()
    {
        List<string> lines = [];

        string[] traders = GetLocalizedTraders();
        string[] maps = GetLocalizedMaps();

        if (maps.Any())
        {
            string[] mapsWithColors = maps.Select(map => $"<color=\"green\">{map}").ToArray();
            string mapsText = string.Join("<color=\"white\">, ", mapsWithColors);
            string finalText = $"{GetMapsWord(maps)}: {mapsText}";
            lines.Add($"{PREFIX_LAYOUT_MAPS}<color=\"white\">{finalText}");
        }

        if (traders.Any())
        {
            string[] tradersWithColors = traders.Select(trader => $"<color=\"orange\">{trader}").ToArray();
            string tradersText = string.Join("<color=\"white\">, ", tradersWithColors);
            string finalText = $"{GetTradersWord(traders)}: {tradersText}";
            lines.Add($"{PREFIX_LAYOUT_TRADERS}<color=\"white\">{finalText}");
        }

        return string.Join("\n", lines);
    }

    private string GetMapsWord(string[] maps)
    {
        string localeKey = maps.Length <= 1 ? "MAP" : "5b47574386f77428ca22b343";
        string translated = localeKey.Localized();
        return StringUtils.Titleize(translated);
    }

    private string GetTradersWord(string[] traders)
    {
        string localeKey = traders.Length <= 1 ? "Merchant" : "MERCHANTS";
        string translated = localeKey.Localized();
        return StringUtils.Titleize(translated);
    }

    private string[] GetLocalizedTraders()
    {
        var traders = new HashSet<string>();

        var exfilTargets = Plugin.CurrentLocationDataService.GetExfilTargets(ExfilPoint);

        if (exfilTargets == null || !exfilTargets.Any())
        {
            return [];
        }

        exfilTargets.ForEach(exfilTarget =>
        {
            foreach (string nextTrader in exfilTarget.nextTraders)
            {
                traders.Add(nextTrader);
            }
        });

        return traders.Select(traderId => $"{traderId} Nickname".Localized()).ToArray();
    }

    private string[] GetLocalizedMaps()
    {
        HashSet<string> maps = [];
        List<ExfilTarget> exfilTargets = Plugin.CurrentLocationDataService.GetExfilTargets(ExfilPoint);

        if (exfilTargets == null || !exfilTargets.Any())
        {
            return [];
        }

        exfilTargets.ForEach(exfilTarget =>
        {
            foreach (string nextMap in exfilTarget.nextMaps)
            {
                maps.Add(nextMap);
            }
        });

        return maps.Select(mapId => mapId.Localized()).ToArray();
    }

    // not implemented yet
    public string[] GetRequirementsTexts()
    {
        return [];
    }
}