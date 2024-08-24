using System.Reflection;
using SPT.Reflection.Patching;
using EFT;
using EFT.UI;

namespace PTT
{
    internal class TraderLockPatch
    {
        internal class LockOldTraderCards : ModulePatch
        {
            protected override MethodBase GetTargetMethod() =>
                typeof(TraderPanel).GetMethod("Show", BindingFlags.Instance | BindingFlags.Public);

            [PatchPostfix]
            private static void Postfix(TraderCard __instance, ref Profile.TraderInfo trader)
            {
                if (trader.Unlocked)
                {
                    return;
                }
                __instance.HideGameObject(); // Lock the trader if not unlocked
            }
        }

        internal class LockNewTraderCards : ModulePatch
        {
            protected override MethodBase GetTargetMethod() =>
                typeof(TraderCard).GetMethod("Show", BindingFlags.Instance | BindingFlags.Public);

            [PatchPostfix]
            private static void Postfix(TraderCard __instance, ref Profile.TraderInfo trader)
            {
                if (trader.Unlocked)
                {
                    return;
                }
                __instance.HideGameObject(); // Lock the trader if not unlocked
            }
        }
    }
}