using System.Reflection;
using EFT.UI;
using SPT.Reflection.Patching;

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