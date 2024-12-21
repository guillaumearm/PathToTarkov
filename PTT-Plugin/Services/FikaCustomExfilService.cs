using System;
using EFT;
using EFT.Interactive;
using Comfort.Common;
using BepInEx.Logging;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;
using System.Reflection;
using Fika.Core.Coop.Components;

namespace PTT.Services;

public static class FikaCustomExfilService
{
    public static bool ExtractTo(ExfiltrationPoint exfiltrationPoint, string customExfilName)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null || coopPlayer == null)
        {
            return false;
        }

        coopGame.ExitLocation = customExfilName;
        coopGame.Extract(coopPlayer, exfiltrationPoint, null);
        return true;
    }

    public static bool TransitTo(string locationId, string customExfilName)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null || coopPlayer == null)
        {
            return false;
        }

        bool preparedTransit = Helpers.Transit.PrepareTransits(locationId);

        if (!preparedTransit)
        {
            return false;
        }


        var tp = new TransitPoint
        {
            parameters = new LocationSettingsClass.Location.TransitParameters
            {
                id = 1,
                name = customExfilName,
                target = locationId,
                location = locationId,
            }
        };

        // TODO: check if it's needed
        // coopGame.ExitLocation = customExfilName;
        coopGame.Extract(coopPlayer, null, tp);
        return true;
    }
}
