using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT;
using EFT.Interactive;

namespace PTT.Patches;

internal class InitAllExfiltrationPointsPatch : ModulePatch
{
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

    [PatchPostfix]
    protected static void PatchPostfix(ref ExfiltrationControllerClass __instance, MongoID locationId, LocationExitClass[] settings, bool justLoadSettings = false, string disabledScavExits = "", bool giveAuthority = true)
    {
        ExfiltrationPoint[] allExfils = GetAllExfilsForPmc();
        __instance.ExfiltrationPoints = allExfils;
        LoadExfilSettings(allExfils, locationId, settings, giveAuthority);
    }

    private static ExfiltrationPoint[] GetAllExfilsForPmc()
    {
        ExfiltrationPoint[] allOriginalExfils = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray();
        IEnumerable<ExfiltrationPoint> scavExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil));
        IEnumerable<ExfiltrationPoint> pmcExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsNotScavExfil));

        List<ExfiltrationPoint> accExfils = pmcExfils.ToList();

        foreach (ExfiltrationPoint scavExfil in scavExfils)
        {
            if (!pmcExfils.Any(k => k.Settings.Name == scavExfil.Settings.Name))
            {
                Helpers.Logger.Info($"Added scav exfil '{scavExfil.Settings.Name}' for pmc");
                accExfils.Add(scavExfil);
            }
        }

        IEnumerable<ExfiltrationPoint> filteredExfils = accExfils.Where(Plugin.CurrentLocationDataService.IsExfiltrationPointEnabled);
        return [.. filteredExfils];
    }

    private static void LoadExfilSettings(ExfiltrationPoint[] allExfils, MongoID locationId, LocationExitClass[] settings, bool giveAuthority)
    {
        foreach (ExfiltrationPoint exfiltrationPoint in allExfils)
        {
            LocationExitClass locationExit = settings.FirstOrDefault(exitClass => exitClass.Name == exfiltrationPoint.Settings.Name);

            if (locationExit != null)
            {
                int num = Array.IndexOf(allExfils, exfiltrationPoint) + 1;
                MongoID mongoID = locationId.Add(num + 1);
                exfiltrationPoint.LoadSettings(mongoID, locationExit, giveAuthority);
            }
        }
    }
}

