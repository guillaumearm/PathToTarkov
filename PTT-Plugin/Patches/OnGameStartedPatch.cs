using EFT;
using PTT.Services;
using SPT.Reflection.Patching;
using System.Reflection;

namespace PTT.Patches;

internal class OnGameStartedPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(GameWorld).GetMethod(nameof(GameWorld.OnGameStarted));
    }

    [PatchPostfix]
    public static void Patch()
    {
        // if (Plugin.FikaIsInstalled)
        // {
        //     TransitVoteServiceFika.InitRaid();
        // }

        // if (Plugin.CurrentLocationDataService != null)
        // {
        //     Plugin.CurrentLocationDataService.Init();
        //     Helpers.Logger.Info("Initialized CurrentLocationDataService");
        // }
        // else
        // {
        //     Helpers.Logger.Error("CurrentLocationDataService instance not found");
        // }

        // CurrentExfilTargetService.Init();
        // Plugin.DisplayInteractableExfilsAPIWarning();
        Helpers.Logger.Info("OnGameStartedPatch executed!");
    }
}
