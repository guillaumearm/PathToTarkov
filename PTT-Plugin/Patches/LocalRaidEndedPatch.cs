using EFT;
using SPT.Reflection.Patching;
using System.Reflection;
using System.Collections.Generic;
using PTT.Data;
using PTT.Services;

namespace PTT.Patches;

internal class LocalRaidEndedPatch() : ModulePatch
{
    private static string UsedCustomExtractName { get; set; } = null;

    protected override MethodBase GetTargetMethod()
    {
        // Try to find the LocalRaidEnded method
        var method = typeof(Class303).GetMethod("LocalRaidEnded", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);
        
        return method;
    }

    [PatchPrefix]
    public static bool PatchPrefix(Class303 __instance, LocalRaidSettings settings, ref GClass1959 results, GClass1301[] lostInsuredItems, Dictionary<string, GClass1301[]> transferItems)
    {
        string customExtractName = CurrentExfilTargetService.ConsumeExitName();

        if (customExtractName != null)
        {
            results.exitName = customExtractName;
        }

        Plugin.RaidEnded();
        return true;
    }
}
