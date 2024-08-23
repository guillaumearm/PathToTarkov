﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT.Interactive;
using HarmonyLib;
using PTTExtracts.Core;

namespace PTTExtracts.Patches
{
    public class InitAllExfiltrationPointsPatch : ModulePatch
    {
        public static bool NameMatches(LocationExitClass x)
        {
            return exitName == x.Name;
        }

        public static string exitName;

        public static bool RandomRange(ExfiltrationPoint trigger)
        {
            return UnityEngine.Random.Range(0f, 100f) <= trigger.Settings.Chance;
        }

        public static bool IsNotScavExfil(ExfiltrationPoint x)
        {
            return x is not ScavExfiltrationPoint || x is SharedExfiltrationPoint;
        }

        public static bool IsScavExfil(ExfiltrationPoint x)
        {
            return x is ScavExfiltrationPoint;
        }

        protected override MethodBase GetTargetMethod()
        {
            return typeof(ExfiltrationControllerClass).GetMethod("InitAllExfiltrationPoints", BindingFlags.Public | BindingFlags.Instance);
        }

        [PatchPrefix]
        private static bool PatchPrefix(ref ExfiltrationControllerClass __instance, LocationExitClass[] settings, bool justLoadSettings = false, bool giveAuthority = true)
        {
            ExfiltrationPoint[] source = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray<ExfiltrationPoint>();
            ExfiltrationPoint[] scavExfilArr = source.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil)).ToArray<ExfiltrationPoint>();
            ExfiltrationPoint[] pmcExfilArr = source.Where(new Func<ExfiltrationPoint, bool>(IsNotScavExfil)).ToArray<ExfiltrationPoint>();

            List<ExfiltrationPoint> pmcExfilList = pmcExfilArr.ToList<ExfiltrationPoint>();

            CustomExtractHandler.PatchExfiltrationPoints(pmcExfilList);

            foreach (ExfiltrationPoint scavExfil in scavExfilArr)
            {
                if (!pmcExfilList.Any(k => k.Settings.Name == scavExfil.Settings.Name))
                {
                    pmcExfilList.Add(scavExfil);
                }
            }

            AccessTools.Property(typeof(ExfiltrationControllerClass), "ExfiltrationPoints").SetValue(__instance, pmcExfilList.ToArray());

            AccessTools.Property(typeof(ExfiltrationControllerClass), "ScavExfiltrationPoints").SetValue(__instance, source.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil)).Cast<ScavExfiltrationPoint>().ToArray<ScavExfiltrationPoint>());

            AccessTools.Field(typeof(ExfiltrationControllerClass), "list_0").SetValue(__instance, new List<ScavExfiltrationPoint>(__instance.ScavExfiltrationPoints.Length));
            AccessTools.Field(typeof(ExfiltrationControllerClass), "list_1").SetValue(__instance, new List<ScavExfiltrationPoint>());

            List<ScavExfiltrationPoint> list_0 = (List<ScavExfiltrationPoint>)AccessTools.Field(typeof(ExfiltrationControllerClass), "list_0").GetValue(__instance);
            List<ScavExfiltrationPoint> list_1 = (List<ScavExfiltrationPoint>)AccessTools.Field(typeof(ExfiltrationControllerClass), "list_1").GetValue(__instance);

            foreach (ScavExfiltrationPoint scavExfiltrationPoint in __instance.ScavExfiltrationPoints)
            {
                Logger.LogWarning("Scav Exfil name = " + scavExfiltrationPoint.Settings.Name);
                SharedExfiltrationPoint sharedExfiltrationPoint;
                if ((sharedExfiltrationPoint = (scavExfiltrationPoint as SharedExfiltrationPoint)) != null && sharedExfiltrationPoint.IsMandatoryForScavs)
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
                Logger.LogWarning("PMC Exfil name = " + exfiltrationPoint.Settings.Name);
                exitName = exfiltrationPoint.Settings.Name;
                LocationExitClass gclass = settings.FirstOrDefault(new Func<LocationExitClass, bool>(NameMatches));
                if (gclass != null)
                {
                    exfiltrationPoint.LoadSettings(gclass, giveAuthority);
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

}
