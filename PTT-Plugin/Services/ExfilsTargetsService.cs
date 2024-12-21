using System;
using BepInEx.Logging;
using EFT;
using PTT.Data;
using PTT.Helpers;
using Comfort.Common;

namespace PTT.Services;

public class ExfilsTargetsService(ManualLogSource Logger)
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
            Logger.LogError($"[PTT] Fatal Error: no LocationId found in GameWorld");
            return;
        }

        try
        {
            Logger.LogInfo($"[PTT] calling FetchExfilsTargets for locationId {locationId}");
            ExfilsTargets = HttpRequest.FetchExfilsTargets(locationId);
            Logger.LogInfo($"[PTT] FetchExfilsTargets successfully called");
        }
        catch (Exception ex)
        {
            Logger.LogError($"[PTT] Error occurred during request: {ex.Message}");
        }
    }
}