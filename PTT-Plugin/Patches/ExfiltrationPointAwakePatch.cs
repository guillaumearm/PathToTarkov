using System;
using System.Collections.Generic;
using System.Reflection;
using SPT.Reflection.Patching;
using EFT.Interactive;
using UnityEngine;

namespace PTT.Patches;

internal class ExfiltrationPointAwakePatch : ModulePatch
{
    private static readonly List<ExfiltrationPoint> TrackedExfils = new();

    protected override MethodBase GetTargetMethod()
    {
        try
        {
            var method = typeof(ExfiltrationPoint).GetMethod("Awake", BindingFlags.NonPublic | BindingFlags.Instance);
            if (method == null)
            {
                // Helpers.Logger.Error("ExfiltrationPointAwakePatch: Could not find Awake method on ExfiltrationPoint!");
                // Try different binding flags
                method = typeof(ExfiltrationPoint).GetMethod("Awake", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);
                if (method != null)
                {
                    Helpers.Logger.Info($"ExfiltrationPointAwakePatch: Found Awake method with different flags: {method}");
                }
            }
            else
            {
                Helpers.Logger.Info($"ExfiltrationPointAwakePatch: Successfully found target method: {method}");
            }
            return method;
        }
        catch (Exception ex)
        {
            Helpers.Logger.Error($"ExfiltrationPointAwakePatch: Exception in GetTargetMethod: {ex.Message}");
            Helpers.Logger.Error($"Stack trace: {ex.StackTrace}");
            throw;
        }
    }

    [PatchPostfix]
    protected static void PatchPostfix(ref ExfiltrationPoint __instance)
    {
        // Track all exfiltration points as they awake
        if (!TrackedExfils.Contains(__instance))
        {
            TrackedExfils.Add(__instance);
        }
    }

    public static void DisableInvalidExfils()
    {
        if (Plugin.CurrentLocationDataService == null || !Plugin.CurrentLocationDataService.IsInitialized())
        {
            return;
        }

        foreach (var exfil in TrackedExfils)
        {
            if (exfil == null) continue;

            if (!Plugin.CurrentLocationDataService.IsExfiltrationPointEnabled(exfil))
            {
                // Destroy any CustomExfilTrigger components that InteractableExfilsAPI might have added
                var customTriggers = exfil.GetComponentsInChildren<Component>();
                foreach (var component in customTriggers)
                {
                    if (component.GetType().Name == "CustomExfilTrigger")
                    {
                        UnityEngine.Object.Destroy(component);
                        Helpers.Logger.Info($"Destroyed CustomExfilTrigger on disabled exfil '{exfil.Settings.Name}'");
                    }
                }

                // Multiple approaches to ensure the exfil is completely disabled
                exfil.enabled = false;
                
                // Disable all colliders
                var colliders = exfil.GetComponentsInChildren<Collider>(true);
                foreach (var collider in colliders)
                {
                    collider.enabled = false;
                }

                // Set status to NotPresent
                exfil.Status = EExfiltrationStatus.NotPresent;
                
                // Finally disable the GameObject
                if (exfil.gameObject != null)
                {
                    exfil.gameObject.SetActive(false);
                }

                Helpers.Logger.Info($"Completely disabled exfil '{exfil.Settings.Name}'");
            }
        }
    }

    public static void ClearTrackedExfils()
    {
        TrackedExfils.Clear();
    }
}