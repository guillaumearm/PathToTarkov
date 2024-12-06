using System.Reflection;
using SPT.Reflection.Patching;
using EFT.Interactive;

namespace PTT.Extracts
{
    public class ScavExfiltrationPointPatch : ModulePatch
    {
        protected override MethodBase GetTargetMethod()
        {
            return typeof(ScavExfiltrationPoint).GetMethod("InfiltrationMatch", BindingFlags.Public | BindingFlags.Instance);
        }
        [PatchPrefix]
        private static bool Prefix(ref bool __result)
        {
            __result = true;
            return false;
        }
    }
}