using System.Linq;
using System.Reflection;

using EFT.Interactive;
using EFT.UI.BattleTimer;
using SPT.Reflection.Patching;

using TMPro;
using UnityEngine;

using PTT.UI;

namespace PTT.Patches;

// TODO: verify if it's needed -> test with itemsToBringLabel (will be used for requirements)
internal class ExitTimerPanelSetTimerTextActivePatch : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(ExitTimerPanel).GetMethod("SetTimerTextActive", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
    }

    [PatchPrefix]
    protected static bool Patch(ref ExitTimerPanel __instance)
    {
        // this completely disable the implementation of SetTimerTextActive
        return false;
    }
}

internal class ExitTimerPanelUpdateVisitedStatusPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(ExitTimerPanel).GetMethod("UpdateVisitedStatus", BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);
    }

    [PatchPostfix]
    protected static void Patch(ref ExitTimerPanel __instance)
    {
        GameObject itemsObject = GetItemsObject(__instance);
        TextMeshProUGUI pointName = GetGUIFromProperty(__instance, "_pointName");
        TextMeshProUGUI pointStatusLabel = GetGUIFromProperty(__instance, "_pointStatusLabel");
        TextMeshProUGUI itemsToBringLabel = GetGUIFromProperty(__instance, "_itemsToBringLabel");
        ExfiltrationPoint exfilPoint = GetExfilPoint(__instance);

        if (itemsObject == null)
        {
            Helpers.Logger.Error("Cannot find _itemsObject property in ExitTimerPanel");
            return;
        }

        if (pointStatusLabel == null)
        {
            Helpers.Logger.Error("Cannot find _pointStatusLabel property in ExitTimerPanel");
            return;
        }

        if (pointName == null)
        {
            Helpers.Logger.Error("Cannot find _pointName property in ExitTimerPanel");
            return;
        }

        if (itemsToBringLabel == null)
        {
            Helpers.Logger.Error("Cannot find _itemsToBringLabel property in ExitTimerPanel");
            return;
        }

        if (exfilPoint == null)
        {
            Helpers.Logger.Error("No exfiltration point found in ExitTimerPanel");
            return;
        }

        var exfilTooltip = new ExfilTooltip(exfilPoint);

        pointName.text = exfilTooltip.GetPrimaryText();
        pointStatusLabel.text = exfilTooltip.GetSecondaryText();
        string[] requirementsTexts = exfilTooltip.GetRequirementsTexts();

        // printed only when only one extract point tooltip is shown
        if (requirementsTexts != null && requirementsTexts.Any() && ExtractionTimersPanelSwitchTimersPatch.ShowOnePoint)
        {
            itemsToBringLabel.text = string.Join("\n", requirementsTexts);
            itemsObject.SetActive(true); // needed for itemsToBringLabel
        }
        else
        {
            itemsObject.SetActive(false);
        }

        Helpers.Logger.Info("ExitTimerPanel.UpdateVisitedStatus method called");
    }

    private static ExfiltrationPoint GetExfilPoint(ExitTimerPanel panel)
    {
        var propertyInfo = typeof(ExitTimerPanel).GetField("_point", BindingFlags.Instance | BindingFlags.NonPublic);

        if (propertyInfo == null)
        {
            Helpers.Logger.Error($"Cannot find _point property in ExitTimerPanel");
            return null;
        }

        return propertyInfo.GetValue(panel) as ExfiltrationPoint;
    }

    private static TextMeshProUGUI GetGUIFromProperty(ExitTimerPanel panel, string prop)
    {
        var propertyInfo = typeof(ExitTimerPanel).GetField(prop, BindingFlags.Instance | BindingFlags.NonPublic);

        if (propertyInfo == null)
        {
            Helpers.Logger.Error($"Cannot find {prop} property in ExitTimerPanel");
            return null;
        }

        // this is supposed to be CustomTextMeshProUGUI but we are fine casting it into a regular TextMeshProUGUI here.
        return propertyInfo.GetValue(panel) as TextMeshProUGUI;
    }

    private static GameObject GetItemsObject(ExitTimerPanel panel)
    {
        var propertyInfo = typeof(ExitTimerPanel).GetField("_itemsObject", BindingFlags.Instance | BindingFlags.NonPublic);

        if (propertyInfo == null)
        {
            Helpers.Logger.Error($"Cannot find _itemsObject property in ExitTimerPanel");
            return null;
        }

        return propertyInfo.GetValue(panel) as GameObject;
    }
}
