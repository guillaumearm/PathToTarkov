using Comfort.Common;
using EFT;
using SPT.Reflection.Patching;
using System.Reflection;
using PTT.Services;

namespace PTT.Patches;

internal class LocalRaidStartedPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(Class301).GetMethod(nameof(Class301.LocalRaidStarted));
    }

    [PatchPostfix]
    public static void PatchPostfix(Class301 __instance, LocalRaidSettings settings)
    {
        LocalRaidSettingsRetriever.Settings = settings;
    }
}
