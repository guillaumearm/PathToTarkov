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
        Logger.Info($"(FIKA) started extraction on '{exfilTarget.GetCustomExitName(exfil)}'");

        if (coopGame == null)
        {
            Logger.Error($"(FIKA) cannot extract because no CoopGame found");
            return;
        }

        if (coopPlayer == null)
        {
            Logger.Error($"(FIKA) cannot extract because no CoopPlayer found");
            return;
        }

        coopGame.ExitLocation = exfil.Settings.Name;
        coopGame.Extract(coopPlayer, exfil, null);
        Logger.Info($"(FIKA) extraction done for profile {coopPlayer.ProfileId}");
    }

    public static void TransitTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;
        Logger.Info($"started transit on '{exfilTarget.GetCustomExitName(exfil)}'");

        if (coopGame == null)
        {
            Logger.Error($"(FIKA) cannot transit because no CoopGame found");
            return;
        }

        if (coopPlayer == null)
        {
            Logger.Error($"(FIKA) cannot transit because no CoopPlayer found");
            return;
        }

        if (!TransitControllerAbstractClass.Exist(out GClass1642 transitController))
        {
            Logger.Error($"(FIKA) cannot transit because no TransitControllerAbstractClass found");
            return;
        }

        TransitPoint transit = Transit.Create(exfil, exfilTarget);
        var localRaidSettings = LocalRaidSettingsRetriever.Settings;

        if (localRaidSettings == null)
        {
            Logger.Error($"(FIKA) cannot transit because no LocalRaidSettings found");
            return;
        }

        // 1. set the transition status
        string location = transit.parameters.location;
        ERaidMode eraidMode = ERaidMode.Local;
        if (TarkovApplication.Exist(out TarkovApplication tarkovApplication))
        {
            tarkovApplication.transitionStatus = new GStruct136(location, false, localRaidSettings.playerSide, eraidMode, localRaidSettings.timeVariant);
        }
        else
        {
            Logger.Error($"(FIKA) cannot transit because no TarkovApplication found");
            return;
        }


        // 2. add the transitPayload
        var transitPayload = CreateTransitPayload(location, transitController, coopPlayer);
        transitController.alreadyTransits.Add(coopPlayer.ProfileId, transitPayload);

        // 3. trigger extract
        coopGame.ExitLocation = exfil.Settings.Name;
        coopGame.Extract(coopPlayer, null, transit);
        Logger.Info($"(FIKA) transit done for profile '${coopPlayer.ProfileId}'");
    }

    private static GClass1926 CreateTransitPayload(string locationName, GClass1642 transitController, CoopPlayer coopPlayer)
    {
        // 1. create player profiles
        Dictionary<string, ProfileKey> profiles = new() {
            {coopPlayer.ProfileId, new()
                {
                    isSolo = true,
                    keyId = coopPlayer.GroupId,
                    _id = coopPlayer.ProfileId,
                }
            }
        };

        // 2. create the transit payload
        GClass1926 transitPayload = new()
        {
            hash = Guid.NewGuid().ToString(),
            playersCount = 1,
            ip = "",
            location = locationName,
            profiles = profiles,
            transitionRaidId = transitController?.summonedTransits?[coopPlayer.ProfileId]?.raidId,
            raidMode = ERaidMode.Local,
            side = coopPlayer.Side is EPlayerSide.Savage ? ESideType.Savage : ESideType.Pmc,
            dayTime = LocalRaidSettingsRetriever.Settings.timeVariant
        };

        return transitPayload;
    }
}
