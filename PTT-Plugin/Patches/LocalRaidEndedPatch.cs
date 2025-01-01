using Comfort.Common;
using EFT;
using SPT.Reflection.Patching;
using System.Reflection;
using PTT.Services;
using System.Linq;
using System.Collections.Generic;

namespace PTT.Patches;

internal class LocalRaidEndedPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(Class301).GetMethod(nameof(Class301.LocalRaidEnded));
    }

    [PatchPrefix]
    public static bool PatchPrefix(Class301 __instance, LocalRaidSettings settings, ref GClass1924 results, GClass1301[] lostInsuredItems, Dictionary<string, GClass1301[]> transferItems)
    {
        string customExtractName = Plugin.ExfilsTargetsService.ConsumeExtractName();

        if (customExtractName != null)
        {
            results.exitName = customExtractName;
        }

        return true;
    }
}
