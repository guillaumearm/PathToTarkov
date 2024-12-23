using System;
using BepInEx.Logging;
using EFT;
using PTT.Data;
using PTT.Helpers;
using Comfort.Common;

namespace PTT.Services;

public class ExfilsTargetsService
{
    public ExfilsTargetsResponse ExfilsTargets { get; private set; } = new() { data = { } };

    public void Init()
    {
        FetchExfilsTargetsForCurrentLocation();
    }

    private void FetchExfilsTargetsForCurrentLocation()
    {
        string locationId = Singleton<GameWorld>.Instance?.LocationId;

        if (locationId == null || locationId == "")
        {
            Plugin.LogSource.LogError($"[PTT] Fatal Error: no LocationId found in GameWorld");
            return;
        }

        try
        {
            Plugin.LogSource.LogInfo($"[PTT] calling FetchExfilsTargets for locationId {locationId}");
            ExfilsTargets = HttpRequest.FetchExfilsTargets(locationId);
            Plugin.LogSource.LogInfo($"[PTT] FetchExfilsTargets successfully called");
        }
        catch (Exception ex)
        {
            Plugin.LogSource.LogError($"[PTT] Error occurred during request: {ex.Message}");
        }
    }
}