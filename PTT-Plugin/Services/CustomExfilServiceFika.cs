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

    public static void TransitTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        string customExtractName = exfilTarget.GetCustomExitName(exfil);
        // TODO: log -> started fika transit on customExtractName

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

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            // TODO: log errors
            return;
        }

        TransitPoint transit = Transit.Create(exfil, exfilTarget);
        var localRaidSettings = LocalRaidSettingsRetriever.Settings;

        // 1. set the transition status
        string location = transit.parameters.location;
        ERaidMode eraidMode = ERaidMode.Local;
        if (TarkovApplication.Exist(out TarkovApplication tarkovApplication))
        {
            tarkovApplication.transitionStatus = new GStruct136(location, false, localRaidSettings.playerSide, eraidMode, localRaidSettings.timeVariant);
        }
        else
        {
            // TODO: log errors
            return;
        }


        // 2. prepare profiles
        Dictionary<string, ProfileKey> profiles = new() {
            {coopPlayer.ProfileId, new()
                {
                    isSolo = true,
                    keyId = coopPlayer.GroupId,
                    _id = coopPlayer.ProfileId,
                }
            }
        };

        // 3. prepare transitPayload (TODO: refactor)
        GClass1926 transitPayload = new()
        {
            hash = Guid.NewGuid().ToString(),
            playersCount = 1,
            ip = "",
            location = location,
            profiles = profiles,
            transitionRaidId = vanillaTransitController.summonedTransits[coopPlayer.ProfileId].raidId,
            raidMode = eraidMode,
            side = coopPlayer.Side is EPlayerSide.Savage ? ESideType.Savage : ESideType.Pmc,
            dayTime = localRaidSettings.timeVariant
        };

        // 4. add transitPayload
        vanillaTransitController.alreadyTransits.Add(coopPlayer.ProfileId, transitPayload);

        // 5. trigger extract
        coopGame.ExitLocation = customExtractName; // not sure if it's needed
        coopGame.Extract(coopPlayer, null, transit);
    }
}
