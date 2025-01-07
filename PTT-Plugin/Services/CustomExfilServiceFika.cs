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
using JsonType;
using System.Reflection;

namespace PTT.Services;

public static class CustomExfilServiceFika
{
    public static void ExtractTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        Logger.Info($"(FIKA) started extraction on '{exfilTarget.GetCustomExitName()}'");

        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

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

        // 1. Save the exfil target
        Plugin.ExfilsTargetsService.SaveExfil(exfilTarget);

        // 2. Set the ExitLocation (needed to validate extract quests like `Burning Rubber`)
        coopGame.ExitLocation = exfilTarget.exitName;

        // 3. Trigger extract
        coopGame.Extract(coopPlayer, exfil, null);

        // 4. Disable transit vote if host has extracted
        if (Helpers.Fika.IsHost())
        {
            TransitVoteServiceFika.SendDisableTransitVotePacket("Host has extracted");
        }

        Logger.Info($"(FIKA) extraction done for profile {coopPlayer.ProfileId}");
    }

    public static void TransitTo(ExfilTarget exfilTarget)
    {
        if (FikaBackendUtils.IsDedicated)
        {
            DedicatedTransitTo(exfilTarget);
            return;
        }
        Logger.Info($"started transit on '{exfilTarget.GetCustomExitName()}'");

        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

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

        // 1. Create the transit point
        TransitPoint transit = Transit.Create(exfilTarget);

        // 2. Register the transit point
        if (!RegisterTransitPoint(transit))
        {
            Logger.Error($"(FIKA) cannot register the transit point");
            return;
        }

        // 3. Save the exfil target
        Plugin.ExfilsTargetsService.SaveExfil(exfilTarget);

        // 4. Set the ExitLocation
        coopGame.ExitLocation = exfilTarget.exitName;

        // 5. Trigger extract with transit
        coopGame.Extract(coopPlayer, null, transit);

        Logger.Info($"(FIKA) transit done for profile '${coopPlayer.ProfileId}'");
    }

    private static void DedicatedTransitTo(ExfilTarget exfilTarget)
    {
        Logger.Info($"started dedicated transit on '{exfilTarget.GetCustomExitName()}'");

        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null)
        {
            Logger.Error($"(FIKA dedi) cannot transit because no CoopGame found");
            return;
        }

        if (coopPlayer == null)
        {
            Logger.Error($"(FIKA dedi) cannot transit because no CoopPlayer found");
            return;
        }

        // 1. Create the transit point
        TransitPoint transit = Transit.Create(exfilTarget);

        // 2. Register the transit point
        if (!RegisterTransitPoint(transit))
        {
            Logger.Error($"(FIKA dedi) cannot register the transit point");
            return;
        }

        // 3. set some needed properties
        coopGame.ExitStatus = ExitStatus.Transit;
        coopGame.ExitLocation = exfilTarget.exitName;
        coopGame.ExtractedPlayers.Add(coopPlayer.NetId);

        if (SetFikaBackendUtilsIsTransit(true))
        {
            Logger.Warning($"(FIKA dedi) cannot set FikaBackendUtils.IsTransit to true");
        }

        // 4. Save the exfil target
        Plugin.ExfilsTargetsService.SaveExfil(exfilTarget);

        // 5. Stop the game
        coopGame.Stop(coopPlayer.ProfileId, coopGame.ExitStatus, coopGame.ExitLocation, 0);

        Logger.Info($"(FIKA) transit done for dedicated client");
    }

    public static bool SetFikaBackendUtilsIsTransit(bool isTransit)
    {
        Type targetType = typeof(FikaBackendUtils);
        PropertyInfo property = targetType.GetProperty("IsTransit", BindingFlags.Public | BindingFlags.Static);

        if (property != null && property.CanWrite)
        {
            property.SetValue(null, isTransit); // 'null' because it's a static property
            return true;
        }
        else
        {
            return false;
        }
    }

    private static bool RegisterTransitPoint(TransitPoint transit)
    {
        string location = transit.parameters.location;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;
        GameWorld gameWorld = Singleton<GameWorld>.Instance;
        LocalRaidSettings localRaidSettings = LocalRaidSettingsRetriever.RaidSettings;
        TransitControllerAbstractClass transitController = GetTransitController();

        if (gameWorld == null)
        {
            Logger.Error($"(FIKA) cannot register transit point because no GameWorld found");
            return false;
        }

        if (localRaidSettings == null)
        {
            Logger.Error($"(FIKA) cannot register transit point because no LocalRaidSettings found");
            return false;
        }

        if (coopPlayer == null)
        {
            Logger.Error($"(FIKA) cannot register transit point because no CoopPlayer found");
            return false;
        }

        if (transitController == null)
        {
            Logger.Error($"(FIKA) cannot register transit point because no transitController found");
            return false;
        }

        // 1. Set the transition status
        if (TarkovApplication.Exist(out TarkovApplication tarkovApplication))
        {
            ERaidMode eraidMode = ERaidMode.Local;
            tarkovApplication.transitionStatus = new GStruct136(location, false, localRaidSettings.playerSide, eraidMode, localRaidSettings.timeVariant);
        }
        else
        {
            Logger.Error($"(FIKA) cannot register transit point because no TarkovApplication found");
            return false;
        }

        // 2. Create and register the transitPayload
        var transitPayload = CreateTransitPayload(location, transitController, coopPlayer);
        transitController.alreadyTransits.Add(coopPlayer.ProfileId, transitPayload);

        return true;
    }

    private static TransitControllerAbstractClass GetTransitController()
    {
        GameWorld gameWorld = Singleton<GameWorld>.Instance;
        if (gameWorld == null)
        {
            Logger.Error($"(FIKA) no GameWorld found");
            return null;
        }

        AddMissingFikaTransitController(gameWorld);

        return gameWorld.TransitController;
    }

    // This is because Fika removed transit support in Fika-Plugin version 1.1.2.0
    private static void AddMissingFikaTransitController(GameWorld gameWorld)
    {
        if (gameWorld.TransitController == null)
        {
            Profile profile = gameWorld.MainPlayer.Profile;
            gameWorld.TransitController = CreateTransitController(profile);
        }
    }

    private static TransitControllerAbstractClass CreateTransitController(Profile profile)
    {
        LocalRaidSettings localRaidSettings = LocalRaidSettingsRetriever.RaidSettings;
        LocalSettings localSettings = LocalRaidSettingsRetriever.LocalSettings;
        BackendConfigSettingsClass backendConfigSettings = Singleton<BackendConfigSettingsClass>.Instance;

        if (localRaidSettings == null)
        {
            Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no LocalRaidSettings found");
            return null;
        }

        if (localSettings == null)
        {
            Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no LocalSettings found");
            return null;
        }

        if (localSettings.locationLoot == null)
        {
            Logger.Warning($"(FIKA) LocalSettings.locationLoot is null");
        }

        if (backendConfigSettings?.transitSettings == null)
        {
            Logger.Error($"(FIKA) cannot retrieve the fika transit controller because no BackendConfigSettingsClass.transitSettings found");
            return null;
        }

        LocationSettingsClass.Location.TransitParameters[] transitParameters = localSettings.locationLoot?.transitParameters ?? [];

        TransitControllerAbstractClass transitController = FikaBackendUtils.IsServer
            ? new FikaHostTransitController(backendConfigSettings.transitSettings, transitParameters, profile, localRaidSettings)
            : new FikaClientTransitController(backendConfigSettings.transitSettings, transitParameters, profile, localRaidSettings);

        return transitController;
    }

    private static GClass1926 CreateTransitPayload(string locationName, TransitControllerAbstractClass transitController, CoopPlayer coopPlayer)
    {
        // 1. Create player profile
        Dictionary<string, ProfileKey> profiles = new() {
            {coopPlayer.ProfileId, new()
                {
                    isSolo = true,
                    keyId = coopPlayer.GroupId,
                    _id = coopPlayer.ProfileId,
                }
            }
        };

        // 2. Create the transit payload
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
