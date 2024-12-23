using EFT;
using EFT.Interactive;
using Comfort.Common;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;
using System;
using System.Collections.Generic;
using PTT.Helpers;

namespace PTT.Services;

public static class CustomExfilServiceFika
{
    public static bool ExtractTo(ExfiltrationPoint exfiltrationPoint, string customExtractName)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null || coopPlayer == null)
        {
            return false;
        }

        coopGame.ExitLocation = customExtractName;
        coopGame.Extract(coopPlayer, exfiltrationPoint, null);
        return true;
    }

    // TODO: fix this code smell (the 2 string params)
    public static bool TransitTo(string locationId, string customTransitName)
    {
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;
        if (coopPlayer == null)
        {
            // TODO: log error
            return false;
        }

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            // TODO: log error
            return false;
        }

        Dictionary<string, ProfileKey> profiles = [];
        profiles.Add(coopPlayer.ProfileId, new()
        {
            isSolo = true,
            keyId = coopPlayer.GroupId,
            _id = coopPlayer.ProfileId,
        });

        string transitHash = Guid.NewGuid().ToString();
        int playersCount = 1;

        TransitPoint transit = Transit.Create(locationId, customTransitName);
        vanillaTransitController.Transit(transit, playersCount, transitHash, profiles, coopPlayer);
        return true;
    }
}
