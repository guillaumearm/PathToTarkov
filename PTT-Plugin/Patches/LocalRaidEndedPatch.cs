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
        return typeof(Class301).GetMethod(nameof(Class301.LocalRaidEnded));
    }

    [PatchPrefix]
    public static bool PatchPrefix(Class301 __instance, LocalRaidSettings settings, ref GClass1924 results, GClass1301[] lostInsuredItems, Dictionary<string, GClass1301[]> transferItems)
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
