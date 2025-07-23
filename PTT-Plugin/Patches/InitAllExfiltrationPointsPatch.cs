using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT;
using EFT.Interactive;
using UnityEngine;

namespace PTT.Patches;

internal class InitAllExfiltrationPointsPatch : ModulePatch
{
    private static ExfiltrationControllerClass _cachedController;
    private static MongoID _cachedLocationId;
    private static LocationExitClass[] _cachedSettings;
    private static bool _cachedGiveAuthority;

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
        Helpers.Logger.Info($"InitAllExfiltrationPointsPatch.PatchPostfix called! LocationId: {locationId}");
        
        // Store references for later filtering
        _cachedController = __instance;
        _cachedLocationId = locationId;
        _cachedSettings = settings;
        _cachedGiveAuthority = giveAuthority;

        // For now, just get all exfils without filtering - we'll filter them later when CurrentLocationDataService is initialized
        ExfiltrationPoint[] allExfils = GetAllExfilsForPmc();
        Helpers.Logger.Info($"Got {allExfils.Length} exfils from GetAllExfilsForPmc");
        
        __instance.ExfiltrationPoints = allExfils;
        LoadExfilSettings(allExfils, locationId, settings, giveAuthority);

        TryApplyExfilFiltering();
    }

    public static void ApplyExfilFiltering()
    {
        Helpers.Logger.Info("ApplyExfilFiltering called!");
        
        if (_cachedController == null || Plugin.CurrentLocationDataService == null)
        {
            Helpers.Logger.Warning("Cannot apply exfil filtering - controller or service not available");
            return;
        }
        
        Helpers.Logger.Info("ApplyExfilFiltering - proceeding with filtering...");

        // First, clear any cached prompts in ExfilPromptService
        if (IEApiWrapper.ExfilPromptService != null)
        {
            IEApiWrapper.ExfilPromptService.ClearCachedPrompts();
        }

        // First get the filtered list for the controller (only enabled exfils)
        ExfiltrationPoint[] allExfils = GetAllExfilsForPmcFiltered();
        _cachedController.ExfiltrationPoints = allExfils;
        LoadExfilSettings(allExfils, _cachedLocationId, _cachedSettings, _cachedGiveAuthority);
        
        // Now disable only the exfils that are NOT in our final filtered list
        ExfiltrationPoint[] allOriginalExfils = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray();
        
        foreach (ExfiltrationPoint exfil in allOriginalExfils)
        {
            // Check if this exfil is in our final list
            bool isInFinalList = allExfils.Any(e => e.Settings.Name == exfil.Settings.Name);
            
            if (!isInFinalList)
            {
                // This exfil is not in our final list, so disable it
                exfil.enabled = false;
                
                // Set the exfil status to NotPresent
                exfil.Status = EExfiltrationStatus.NotPresent;
                
                // Disable all colliders to prevent trigger activation
                Collider[] colliders = exfil.GetComponentsInChildren<Collider>();
                foreach (Collider col in colliders)
                {
                    if (col != null)
                    {
                        col.enabled = false;
                    }
                }
                
                // Disable the GameObject to ensure no interaction is possible
                if (exfil.gameObject != null)
                {
                    exfil.gameObject.SetActive(false);
                }
                
                Helpers.Logger.Info($"Disabled exfil '{exfil.Settings.Name}' - not in final filtered list");
            }
            else
            {
                Helpers.Logger.Info($"Kept exfil '{exfil.Settings.Name}' - in final filtered list");
            }
        }
        
        // Call the new patch to disable any InteractableExfilsAPI triggers
        ExfiltrationPointAwakePatch.DisableInvalidExfils();
        
        Helpers.Logger.Info($"Applied exfil filtering - {allExfils.Length} exfils available");
    }

    private static ExfiltrationPoint[] GetAllExfilsForPmc()
    {
        Helpers.Logger.Info("GetAllExfilsForPmc called!");
        
        ExfiltrationPoint[] allOriginalExfils = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray();
        Helpers.Logger.Info($"Found {allOriginalExfils.Length} total exfils in scene");
        
        IEnumerable<ExfiltrationPoint> scavExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil));
        IEnumerable<ExfiltrationPoint> pmcExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsNotScavExfil));
        
        Helpers.Logger.Info($"Separated into {scavExfils.Count()} scav exfils and {pmcExfils.Count()} pmc exfils");

        List<ExfiltrationPoint> accExfils = pmcExfils.ToList();

        foreach (ExfiltrationPoint scavExfil in scavExfils)
        {
            if (!pmcExfils.Any(k => k.Settings.Name == scavExfil.Settings.Name))
            {
                Helpers.Logger.Info($"Added scav exfil '{scavExfil.Settings.Name}' (type: {scavExfil.GetType().Name}) for pmc");
                accExfils.Add(scavExfil);
            }
            else
            {
                Helpers.Logger.Info($"Skipped scav exfil '{scavExfil.Settings.Name}' - already exists as PMC exfil");
            }
        }

        Helpers.Logger.Info($"GetAllExfilsForPmc returning {accExfils.Count} total exfils");
        // TODO: Fix filtering - need to filter after CurrentLocationDataService is initialized
        // For now, return all exfils to fix the issue where no exfils are shown
        return [.. accExfils];
    }

    private static ExfiltrationPoint[] GetAllExfilsForPmcFiltered()
    {
        ExfiltrationPoint[] allOriginalExfils = LocationScene.GetAllObjects<ExfiltrationPoint>(false).ToArray();
        Helpers.Logger.Info($"GetAllExfilsForPmcFiltered: Found {allOriginalExfils.Length} total exfils");
        
        IEnumerable<ExfiltrationPoint> scavExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsScavExfil));
        IEnumerable<ExfiltrationPoint> pmcExfils = allOriginalExfils.Where(new Func<ExfiltrationPoint, bool>(IsNotScavExfil));
        
        Helpers.Logger.Info($"GetAllExfilsForPmcFiltered: {scavExfils.Count()} scav exfils, {pmcExfils.Count()} pmc exfils");

        List<ExfiltrationPoint> accExfils = new();

        // First, add all PMC exfils that are enabled in PTT config
        foreach (ExfiltrationPoint pmcExfil in pmcExfils)
        {
            if (Plugin.CurrentLocationDataService.IsExfiltrationPointEnabled(pmcExfil))
            {
                accExfils.Add(pmcExfil);
                Helpers.Logger.Info($"Added PMC exfil '{pmcExfil.Settings.Name}' (type: {pmcExfil.GetType().Name})");
            }
        }

        // Then add Scav exfils that are explicitly enabled in PTT config and not already in the list
        foreach (ExfiltrationPoint scavExfil in scavExfils)
        {
            Helpers.Logger.Info($"Processing scav exfil '{scavExfil.Settings.Name}' (type: {scavExfil.GetType().Name})");
            
            if (!accExfils.Any(k => k.Settings.Name == scavExfil.Settings.Name))
            {
                // Check if this Scav exfil is enabled before adding it
                if (Plugin.CurrentLocationDataService.IsExfiltrationPointEnabled(scavExfil))
                {
                    Helpers.Logger.Info($"Added enabled scav exfil '{scavExfil.Settings.Name}' for pmc");
                    accExfils.Add(scavExfil);
                }
                else
                {
                    Helpers.Logger.Info($"Skipped disabled scav exfil '{scavExfil.Settings.Name}'");
                }
            }
            else
            {
                Helpers.Logger.Info($"Scav exfil '{scavExfil.Settings.Name}' already in list");
            }
        }

        Helpers.Logger.Info($"GetAllExfilsForPmcFiltered: Returning {accExfils.Count} total exfils");
        return [.. accExfils];
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

    /// <summary>
    /// Safe entry‑point: runs filtering only after both the controller
    /// and CurrentLocationDataService are ready.
    /// </summary>
    public static void TryApplyExfilFiltering()
    {
        if (_cachedController == null) return;
        if (Plugin.CurrentLocationDataService == null) return;
        if (!Plugin.CurrentLocationDataService.IsInitialized()) return;

        ApplyExfilFiltering();   // existing heavy‑lifting method
    }

}

