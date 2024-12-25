using EFT;
using EFT.Interactive;
using Comfort.Common;
using System;
using System.Collections.Generic;

using PTT.Helpers;
using PTT.Data;

namespace PTT.Services;

public static class CustomExfilService
{
    public static void ExtractTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        if (Plugin.FikaIsInstalled)
        {
            CustomExfilServiceFika.ExtractTo(exfil, exfilTarget);
            return;
        }

        LocalGame localGame = Singleton<AbstractGame>.Instance as LocalGame;
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        string customExtractName = exfilTarget.GetCustomExitName(exfil);

        // TODO: log -> started extraction on customExtractName

        if (localGame == null)
        {
            // TODO: log error
            return;
        }

        if (player == null)
        {
            // TODO: log error
            return;
        }

        float delay = 0f;
        localGame.Stop(player.ProfileId, ExitStatus.Survived, customExtractName, delay);
        // TODO: log -> local game stopped
    }

    public static void TransitTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        if (Plugin.FikaIsInstalled)
        {
            CustomExfilServiceFika.TransitTo(exfil, exfilTarget);
            return;
        }

        TransitPoint transit = Transit.Create(exfil, exfilTarget);
        string customTransitName = transit.parameters.name;
        // TODO: log -> started transit on customTransitName

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            // TODO: log error
            return;
        }

        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (player == null)
        {
            // TODO: log error
            return;
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

        vanillaTransitController.Transit(transit, playersCount, transitHash, profiles, player);
        // TODO: log -> transit done
    }
}
