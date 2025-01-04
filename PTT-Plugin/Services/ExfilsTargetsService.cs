using System;
using EFT;
using PTT.Data;
using PTT.Helpers;
using Comfort.Common;
using EFT.Interactive;

namespace PTT.Services;

public class ExfilsTargetsService
{
    public ExfilsTargetsResponse ExfilsTargets { get; private set; } = new() { data = { } };
    private string UsedCustomExtractName { get; set; } = null;

    public void Init()
    {
        UsedCustomExtractName = null;
        FetchExfilsTargetsForCurrentLocation();
    }

    public void SaveExfil(ExfilTarget exfilTarget)
    {
        UsedCustomExtractName = exfilTarget.GetCustomExitName();
    }

    public string ConsumeExtractName()
    {
        string extractName = UsedCustomExtractName;
        UsedCustomExtractName = null;
        return extractName;
    }

    private void FetchExfilsTargetsForCurrentLocation()
    {
        string locationId = Singleton<GameWorld>.Instance?.LocationId;

        if (locationId == null || locationId == "")
        {
            Logger.Error($"Fatal Error: no LocationId found in GameWorld");
            return;
        }

        try
        {
            Logger.Info($"calling FetchExfilsTargets for locationId {locationId}");
            ExfilsTargets = HttpRequest.FetchExfilsTargets(locationId);
            Logger.Info($"FetchExfilsTargets successfully called");
        }
        catch (Exception ex)
        {
            Logger.Error($"Error occurred during request: {ex.Message}");
        }
    }
}