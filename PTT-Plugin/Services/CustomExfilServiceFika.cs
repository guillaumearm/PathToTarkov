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

        if (coopGame == null)
        {
            // TODO: log error
            return;
        }

        if (coopPlayer == null)
        {
            // TODO: log error
            return;
        }

        coopGame.ExitLocation = customExtractName; // not sure if it's needed
        coopGame.Extract(coopPlayer, exfil, null);

        // TODO: log -> fika extraction done
    }
}
