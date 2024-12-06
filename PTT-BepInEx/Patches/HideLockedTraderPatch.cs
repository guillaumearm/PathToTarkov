using System.Reflection;
using SPT.Reflection.Patching;
using EFT;
using EFT.UI;

namespace PTT.Patches;

// old
internal class HideLockedTraderPanelPatch : ModulePatch
{
    protected override MethodBase GetTargetMethod() =>
        typeof(TraderPanel).GetMethod("Show", BindingFlags.Instance | BindingFlags.Public);

    [PatchPostfix]
    protected static void Postfix(TraderPanel __instance, ref Profile.TraderInfo trader)
    {
        if (Utils.Trader.IsHidden(ref trader))
        {
            __instance.HideGameObject();
        }
    }
}

// new
internal class HideLockedTraderCardPatch : ModulePatch
{
    protected override MethodBase GetTargetMethod() =>
        typeof(TraderCard).GetMethod("Show", BindingFlags.Instance | BindingFlags.Public);

    [PatchPostfix]
    protected static void Postfix(TraderCard __instance, ref Profile.TraderInfo trader)
    {
        if (Utils.Trader.IsHidden(ref trader))
        {
            __instance.HideGameObject();
        }
    }
}

