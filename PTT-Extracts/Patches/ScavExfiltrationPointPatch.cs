using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT.Interactive;
using HarmonyLib;

namespace PTTExtracts.Patches
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
