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
        Plugin.GameStarted();
    }
}
