using System;
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