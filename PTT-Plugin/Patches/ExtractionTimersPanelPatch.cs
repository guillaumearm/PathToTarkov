using System.Reflection;
using EFT.UI;
using SPT.Reflection.Patching;
using UnityEngine;
using UnityEngine.UI;

namespace PTT.Patches;

internal class ExtractionTimersPanelSwitchTimersPatch : ModulePatch
{
    static public bool ShowOnePoint = false;

    protected override MethodBase GetTargetMethod()
    {
        return typeof(ExtractionTimersPanel).GetMethod("SwitchTimers", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
    }

    [PatchPrefix]
    protected static bool Patch(ref ExtractionTimersPanel __instance, string pointName, bool showOnePoint)
    {
        ShowOnePoint = showOnePoint;
        return true;
    }
}

internal class ExtractionTimersPanelAwakePatch : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(ExtractionTimersPanel).GetMethod("Awake", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
    }

    [PatchPostfix]
    protected static void Patch(ref ExtractionTimersPanel __instance)
    {
        GameObject pointsMask = __instance.transform.Find("MainContainer")?.Find("MainTimer")?.Find("PointsMask")?.gameObject;
        if (pointsMask == null)
        {
            Helpers.Logger.Error("MainContainer>MainTimer>PointsMask cannot be found in ExtractionTimersPanel");
            return;
        }

        Mask mask = pointsMask.GetComponent<Mask>();
        if (mask == null)
        {
            Helpers.Logger.Error("mask component not found");
            return;
        }

        int sizeToAdd = 1000;
        mask.rectTransform.sizeDelta = new Vector2(mask.rectTransform.sizeDelta.x, sizeToAdd + mask.rectTransform.sizeDelta.y);
        Helpers.Logger.Info("Successfully patched ExtractionTimersPanel mask Y sizeDelta");
    }
}