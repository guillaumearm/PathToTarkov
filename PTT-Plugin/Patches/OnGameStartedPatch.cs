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
        if (Plugin.ExfilsTargetsService != null)
        {
            Plugin.ExfilsTargetsService.Init();
        }
        else
        {
            Helpers.Logger.Error("ExfilsTargetsService instance not found");
        }

        return true;
    }
}
