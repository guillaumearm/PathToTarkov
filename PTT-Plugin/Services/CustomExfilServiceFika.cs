using EFT;
using EFT.Interactive;
using Comfort.Common;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;
using System;
using System.Collections.Generic;
using PTT.Helpers;
using PTT.Data;

namespace PTT.Services;

public static class CustomExfilServiceFika
{
    public static void ExtractTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        string customExtractName = exfilTarget.GetCustomExitName(exfil);
        // TODO: log -> started fika extraction on customExtractName

        if (coopGame == null || coopPlayer == null)
        {
            // TODO: log error
            return;
        }

        coopGame.ExitLocation = customExtractName; // not sure if it's needed
        coopGame.Extract(coopPlayer, exfil, null);

        // TODO: log -> fika extraction done
    }

    public static void TransitTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        TransitPoint transit = Transit.Create(exfil, exfilTarget);
        string customTransitName = transit.parameters.name;
        // TODO: log -> started fika transit on customTransitName

        if (coopPlayer == null)
        {
            // TODO: log error
            return;
        }

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            // TODO: log error
            return;
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

        vanillaTransitController.Transit(transit, playersCount, transitHash, profiles, coopPlayer);

        // TODO: log -> fika transit done
    }
}
