using EFT;
using EFT.Interactive;
using Comfort.Common;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;
using System;
using System.Collections.Generic;
using PTT.Helpers;
using PTT.Data;
using Fika.Core.Coop.HostClasses;
using Fika.Core.Coop.ClientClasses;
using Fika.Core.Coop.Utils;

namespace PTT.Services;

public static class CustomExfilServiceFika
{
    public static void ExtractTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;
        Logger.Info($"(FIKA) started extraction on '{exfilTarget.GetCustomExitName(exfil)}'");
        Plugin.ExfilsTargetsService.SaveExfil(exfil, exfilTarget);

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
        Plugin.ExfilsTargetsService.SaveExfil(exfil, exfilTarget);

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

        GameWorld gameWorld = Singleton<GameWorld>.Instance;
        if (gameWorld == null)
        {
            Logger.Error($"(FIKA) cannot transit because no GameWorld found");
            return;
        }

        // TransitControllerAbstractClass transitController = Singleton<GameWorld>.Instance.TransitController;

        // if (gameWorld.TransitController == null)
        // {
        //     Logger.Error("================> The gameWorld.TransitController is null and this is very weird");
        // }






        // if (gameWorld.TransitController is not FikaHostTransitController hostController)
        // {
        //     Logger.Error("(FIKA) FikaHostTransitController not found :'(");
        // }


        // if (transitController == null)
        // {
        //     Logger.Error("(FIKA) no transit controller found in TransitController");
        //     return;
        // }

        // TransitControllerAbstractClass transitController = gameWorld.TransitController;
        // if (transitController == null)
        // {
        //     Logger.Error($"(FIKA) cannot transit because no TransitControllerAbstractClass found! damn!");
        //     return;
        // }

        // if (!TransitControllerAbstractClass.Exist(out GClass1642 transitController))
        // {
        //     Logger.Error($"(FIKA) cannot transit because no TransitControllerAbstractClass found");
        //     return;
        // }

        TransitPoint transit = Transit.Create(exfil, exfilTarget);
        var localRaidSettings = LocalRaidSettingsRetriever.RaidSettings;

        if (localRaidSettings == null)
        {
            Logger.Error($"(FIKA) cannot transit because no LocalRaidSettings found");
            return;
        }

        Profile profile = gameWorld.MainPlayer.Profile;

        // 0. setup the transit controller if needed (TODO: move in a dedicated method)
        if (gameWorld.TransitController == null)
        {
            BackendConfigSettingsClass backendConfigSettings = Singleton<BackendConfigSettingsClass>.Instance;
            if (backendConfigSettings == null)
            {
                Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no backendConfigSettings found");
                return;
            }

            if (backendConfigSettings.transitSettings == null)
            {
                Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no BackendConfigSettingsClass.transitSettings found");
                return;
            }

            var localSettings = LocalRaidSettingsRetriever.LocalSettings;

            if (localSettings == null)
            {
                Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no LocalSettings found");
                return;
            }

            if (localSettings.locationLoot == null)
            {
                Logger.Warning($"(FIKA) LocalSettings.locationLoot is null");
            }

            LocationSettingsClass.Location.TransitParameters[] transitParameters = localSettings.locationLoot?.transitParameters ?? [];

            TransitControllerAbstractClass transitController = FikaBackendUtils.IsServer
                ? new FikaHostTransitController(backendConfigSettings.transitSettings, transitParameters, profile, localRaidSettings)
                : new FikaClientTransitController(backendConfigSettings.transitSettings, transitParameters, profile, localRaidSettings);

            gameWorld.TransitController = transitController;
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
        var transitPayload = CreateTransitPayload(location, gameWorld.TransitController, coopPlayer);
        gameWorld.TransitController.alreadyTransits.Add(coopPlayer.ProfileId, transitPayload);

        // 3. trigger extract
        coopGame.ExitLocation = exfil.Settings.Name;
        coopGame.Extract(coopPlayer, null, transit);
        Logger.Info($"(FIKA) transit done for profile '${coopPlayer.ProfileId}'");
    }

    private static GClass1926 CreateTransitPayload(string locationName, TransitControllerAbstractClass transitController, CoopPlayer coopPlayer)
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
            dayTime = LocalRaidSettingsRetriever.RaidSettings.timeVariant
        };

        return transitPayload;
    }
}
