using System;
using System.Collections.Generic;
using Comfort.Common;
using EFT;
using EFT.Interactive;
using PTT.Services;

namespace PTT.Helpers;

static class Transit
{
    static public TransitPoint Create(string locationId, string customExfilName)
    {
        return new TransitPoint
        {
            Enabled = true,
            IsActive = true,
            // Controller = vanillaTransitController, // not needed
            parameters = new LocationSettingsClass.Location.TransitParameters
            {
                active = true,
                id = 1,
                name = customExfilName,
                description = customExfilName,
                conditions = string.Empty,
                target = locationId, // should be "_Id" of the corresponding location base but not needed here
                location = locationId,
            }
        };
    }

    // TODO: cleanup
    // static public bool PrepareTransits(string locationId)
    // {
    //     Player player = Singleton<GameWorld>.Instance.MainPlayer;
    //     if (player == null) return false;
    //     if (!TarkovApplication.Exist(out TarkovApplication tarkovApplication)) return false;
    //     if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController)) return false;

    //     var raidSettings = LocalRaidSettingsRetriever.Settings;
    //     if (raidSettings == null) return false;

    //     // 1. set transitionStatus
    //     ERaidMode raidMode = ERaidMode.Local;
    //     var transitionStatus = new GStruct136(locationId, raidSettings.mode == ELocalMode.TRAINING, raidSettings.playerSide, raidMode, raidSettings.timeVariant);
    //     tarkovApplication.transitionStatus = transitionStatus;

    //     // 2. add the transitPayload in alreadyTransits
    //     // this will avoid an error when calling the `LocalRaidEnded` task

    //     // if (!vanillaTransitController.profileKeys.TryGetValue(player.ProfileId, out string profileKey))
    //     // {
    //     //     // TODO: try to find out why profileKey is not found here ?
    //     //     // TODO 2: maybe the bots spawning issue is not related to this part so better to investigate how bot spawn work
    //     //     return false;
    //     // }

    //     Dictionary<string, ProfileKey> profiles = [];
    //     profiles.Add(player.ProfileId, new()
    //     {
    //         isSolo = true,
    //         // keyId = profileKey,
    //         keyId = "",
    //         _id = player.ProfileId,
    //     });

    //     GClass1926 transitPayload = new GClass1926
    //     {
    //         hash = Guid.NewGuid().ToString(),
    //         playersCount = 1,
    //         ip = "",
    //         location = locationId,
    //         profiles = profiles,
    //         transitionRaidId = vanillaTransitController.summonedTransits[player.ProfileId].raidId,
    //         raidMode = raidMode,
    //         side = (player.Side == EPlayerSide.Savage) ? ESideType.Savage : ESideType.Pmc,
    //         dayTime = raidSettings.timeVariant
    //     };

    //     vanillaTransitController.alreadyTransits.Add(player.ProfileId, transitPayload);

    //     return true;
    // }
}