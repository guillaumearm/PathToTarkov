using System.Reflection;
using SPT.Reflection.Patching;
using EFT.UI;
using HarmonyLib;
using UnityEngine;

using PTT.Scripts;

namespace PTT.Patches;


public class KaenoTraderScrollingCompatPatch : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return AccessTools.Method(typeof(TraderScreensGroup), nameof(TraderScreensGroup.Show));
    }

    [PatchPostfix]
    public static void PatchPostFix()
    {
        GameObject gameObject = GameObject.Find("Menu UI");
        var script = gameObject.GetComponentInChildren<KaenoTraderScrollingCompatScript>();

        if (script == null)
        {
            gameObject.AddComponent<KaenoTraderScrollingCompatScript>();
        }
    }
}
