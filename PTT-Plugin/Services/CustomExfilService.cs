using EFT;
using EFT.Interactive;
using Comfort.Common;
using System;
using System.Collections.Generic;

using PTT.Helpers;

namespace PTT.Services;

public static class CustomExfilService
{
    public static bool ExtractTo(ExfiltrationPoint exfiltrationPoint, string customExtractName)
    {
        if (Plugin.FikaIsInstalled)
        {
            return CustomExfilServiceFika.ExtractTo(exfiltrationPoint, customExtractName);
        }

        LocalGame localGame = Singleton<AbstractGame>.Instance as LocalGame;
        Player player = Singleton<GameWorld>.Instance.MainPlayer;

        if (localGame == null)
        {
            // TODO: log error
            return false;
        }

        if (player == null)
        {
            // TODO: log error
            return false;
        }

        localGame.Stop(player.ProfileId, ExitStatus.Survived, customExtractName, 0f);
        return true;
    }

    // TODO: fix this code smell (the 2 string params)
    public static bool TransitTo(string locationId, string customTransitName)
    {
        if (Plugin.FikaIsInstalled)
        {
            return CustomExfilServiceFika.TransitTo(locationId, customTransitName);
        }

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            // TODO: log error
            return false;
        }

        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (player == null)
        {
            // TODO: log error
            return false;
        }


        Dictionary<string, ProfileKey> profiles = [];
        profiles.Add(player.ProfileId, new()
        {
            isSolo = true,
            keyId = player.GroupId,
            _id = player.ProfileId,
        });

        string transitHash = Guid.NewGuid().ToString();
        int playersCount = 1;

        TransitPoint transit = Transit.Create(locationId, customTransitName);
        vanillaTransitController.Transit(transit, playersCount, transitHash, profiles, player);
        return true;
    }
}
