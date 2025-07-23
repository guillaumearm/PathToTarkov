using EFT;
using SPT.Reflection.Patching;
using System.Reflection;
using PTT.Services;
using JsonType;
using System.Threading.Tasks;
using System;

namespace PTT.Patches;

internal class LocalRaidStartedPatch() : ModulePatch
{
    protected override MethodBase GetTargetMethod()
    {
        // Try to find the LocalRaidStarted method
        var method = typeof(Class303).GetMethod("LocalRaidStarted", BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance | BindingFlags.Static);

        return method;
    }

    [PatchPostfix]
    public static void PatchPostfix(ref Task<LocalSettings> __result, Class303 __instance, LocalRaidSettings settings)
    {
        // store the local raid settings
        LocalRaidSettingsRetriever.RaidSettings = settings;

        if (__result != null)
        {
            __result = HandleLocalSettingsTask(__result);
        }

        Plugin.RaidStarted();
    }

    private static async Task<LocalSettings> HandleLocalSettingsTask(Task<LocalSettings> originalTask)
    {
        try
        {
            var result = await originalTask;

            // store the local settings
            LocalRaidSettingsRetriever.LocalSettings = result;

            Helpers.Logger.Info($"Captured LocalSettings");

            return result;
        }
        catch (Exception ex)
        {
            Helpers.Logger.Error($"Failed to retrieve LocalSettings {ex}");
            throw ex;
        }
    }
}
