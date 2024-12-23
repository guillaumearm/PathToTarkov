using Comfort.Common;
using EFT;
using SPT.Reflection.Patching;
using System.Reflection;
using PTT.Services;

namespace PTT.Patches;

internal class OnGameStartedPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(GameWorld).GetMethod(nameof(GameWorld.OnGameStarted));
    }

    [PatchPrefix]
    public static bool PatchPrefix()
    {
        var exfilsTargetsService = Singleton<ExfilsTargetsService>.Instance;

        if (exfilsTargetsService != null)
        {
            exfilsTargetsService.Init();
        }
        else
        {
            Plugin.LogSource.LogError("[PTT] ExfilsTargetsService instance not found");
        }

        return true;
    }
}
