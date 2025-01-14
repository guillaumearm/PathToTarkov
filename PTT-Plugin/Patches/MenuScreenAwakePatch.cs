using EFT.UI;
using SPT.Reflection.Patching;
using System.Reflection;

namespace PTT.Patches
{
    public class MenuScreenAwakePatch : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(MenuScreen).GetMethod(nameof(MenuScreen.Awake));
        }

        [PatchPostfix]
        public static void Postfix(MenuScreen __instance)
        {
            Plugin.DisplayOutdatedVersionsWarnings();
        }
    }
}