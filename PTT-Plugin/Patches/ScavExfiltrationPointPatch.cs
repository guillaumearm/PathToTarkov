using System.Reflection;
using SPT.Reflection.Patching;
using EFT.Interactive;

namespace PTT.Patches;

internal class ScavExfiltrationPointPatch : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        return typeof(ScavExfiltrationPoint).GetMethod("InfiltrationMatch", BindingFlags.Public | BindingFlags.Instance);
    }

    [PatchPrefix]
    protected static bool Prefix(ref bool __result, ref ScavExfiltrationPoint __instance)
    {
        Helpers.Logger.Info($"ScavExfiltrationPointPatch: Forcing InfiltrationMatch to true for exfil '{__instance?.Settings?.Name ?? "unknown"}'");
        __result = true;
        return false;
    }
}
