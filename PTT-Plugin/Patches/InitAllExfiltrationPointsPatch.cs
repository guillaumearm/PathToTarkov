using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT;
using EFT.Interactive;
using HarmonyLib;

namespace PTT.Patches;

internal class InitAllExfiltrationPointsPatch : ModulePatch
{
    private static bool NameMatches(LocationExitClass x)
    {
        return exitName == x.Name;
    }

    private static string exitName;

    private static bool RandomRange(ExfiltrationPoint trigger)
    {
        return UnityEngine.Random.Range(0f, 100f) <= trigger.Settings.Chance;
    }

    private static bool IsNotScavExfil(ExfiltrationPoint x)
    {
        return x is not ScavExfiltrationPoint || x is SharedExfiltrationPoint;
    }

    private static bool IsScavExfil(ExfiltrationPoint x)
    {
        return x is ScavExfiltrationPoint;
    }

    protected override MethodBase GetTargetMethod()
    {
        return typeof(ExfiltrationControllerClass).GetMethod("InitAllExfiltrationPoints", BindingFlags.Public | BindingFlags.Instance);
    }

    [PatchPrefix]
    protected static bool PatchPrefix(ref ExfiltrationControllerClass __instance, MongoID locationId, LocationExitClass[] settings, bool justLoadSettings = false, string disabledScavExits = "", bool giveAuthority = true)
    {
        ExfiltrationPoint[] source = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray();
        ExfiltrationPoint[] scavExfilArr = source.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil)).ToArray();
        ExfiltrationPoint[] pmcExfilArr = source.Where(new Func<ExfiltrationPoint, bool>(IsNotScavExfil)).ToArray();

        List<ExfiltrationPoint> pmcExfilList = pmcExfilArr.ToList();

        foreach (ExfiltrationPoint scavExfil in scavExfilArr)
        {
            if (!pmcExfilList.Any(k => k.Settings.Name == scavExfil.Settings.Name))
            {
                pmcExfilList.Add(scavExfil);
            }
        }

        AccessTools.Property(typeof(ExfiltrationControllerClass), "ExfiltrationPoints").SetValue(__instance, pmcExfilList.ToArray());

        AccessTools.Property(typeof(ExfiltrationControllerClass), "ScavExfiltrationPoints").SetValue(__instance, source.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil)).Cast<ScavExfiltrationPoint>().ToArray());

        AccessTools.Field(typeof(ExfiltrationControllerClass), "list_0").SetValue(__instance, new List<ScavExfiltrationPoint>(__instance.ScavExfiltrationPoints.Length));
        AccessTools.Field(typeof(ExfiltrationControllerClass), "list_1").SetValue(__instance, new List<ScavExfiltrationPoint>());

        List<ScavExfiltrationPoint> list_0 = (List<ScavExfiltrationPoint>)AccessTools.Field(typeof(ExfiltrationControllerClass), "list_0").GetValue(__instance);
        List<ScavExfiltrationPoint> list_1 = (List<ScavExfiltrationPoint>)AccessTools.Field(typeof(ExfiltrationControllerClass), "list_1").GetValue(__instance);

        foreach (ScavExfiltrationPoint scavExfiltrationPoint in __instance.ScavExfiltrationPoints)
        {
            Plugin.LogSource.LogWarning("Scav Exfil name = " + scavExfiltrationPoint.Settings.Name);
            SharedExfiltrationPoint sharedExfiltrationPoint = scavExfiltrationPoint as SharedExfiltrationPoint;
            if (sharedExfiltrationPoint != null && sharedExfiltrationPoint.IsMandatoryForScavs)
            {
                list_1.Add(scavExfiltrationPoint);
            }
            else
            {
                list_0.Add(scavExfiltrationPoint);
            }
        }
        AccessTools.Field(typeof(ExfiltrationControllerClass), "list_0").SetValue(__instance, list_0);
        AccessTools.Field(typeof(ExfiltrationControllerClass), "list_1").SetValue(__instance, list_1);

        UnityEngine.Random.InitState((int)DateTimeOffset.UtcNow.ToUnixTimeSeconds());

        foreach (ExfiltrationPoint exfiltrationPoint in __instance.ExfiltrationPoints)
        {
            Plugin.LogSource.LogWarning("PMC Exfil name = " + exfiltrationPoint.Settings.Name);
            exitName = exfiltrationPoint.Settings.Name;
            LocationExitClass locationExit = settings.FirstOrDefault(new Func<LocationExitClass, bool>(NameMatches));
            int num = Array.IndexOf(source, exfiltrationPoint) + 1;
            MongoID mongoID = locationId.Add(num + 1);
            if (locationExit != null)
            {
                exfiltrationPoint.LoadSettings(mongoID, locationExit, giveAuthority);
                if (!justLoadSettings && !RandomRange(exfiltrationPoint))
                {
                    exfiltrationPoint.SetStatusLogged(EExfiltrationStatus.NotPresent, "ExfiltrationController.InitAllExfiltrationPoints-2");
                }
            }
            else
            {
                exfiltrationPoint.SetStatusLogged(EExfiltrationStatus.NotPresent, "ExfiltrationController.InitAllExfiltrationPoints-3");
            }
        }

        return false;
    }
}

