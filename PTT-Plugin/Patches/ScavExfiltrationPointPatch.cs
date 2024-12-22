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
    protected static bool Prefix(ref bool __result)
    {
        __result = true;
        return false;
    }
}
