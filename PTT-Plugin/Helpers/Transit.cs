using System;
using System.Collections.Generic;
using Comfort.Common;
using EFT;

namespace PTT.Helpers;

static class Transit
{
    static public bool PrepareTransits(string locationId)
    {
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (player == null) return false;
        if (!TarkovApplication.Exist(out TarkovApplication tarkovApplication)) return false;
        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController)) return false;

        // 1. set transitionStatus
        var raidSettings = tarkovApplication.CurrentRaidSettings;

        // TODO: try to retreive localRaidSettings on game start

        var transitionStatus = new GStruct136(locationId, false, raidSettings.Side, raidSettings.RaidMode, raidSettings.SelectedDateTime);
        tarkovApplication.transitionStatus = transitionStatus;

        // 2. add  the transitPayload in alreadyTransits
        // this will avoid an error when calling the `LocalRaidEnded` task
        string transitHash = Guid.NewGuid().ToString();

        Dictionary<string, ProfileKey> profiles = [];
        profiles.Add(player.ProfileId, new()
        {
            isSolo = true,
            keyId = "",
            _id = player.ProfileId,
        });

        GClass1926 transitPayload = new GClass1926
        {
            hash = transitHash,
            playersCount = 1,
            ip = "",
            location = locationId,
            profiles = profiles,
            transitionRaidId = vanillaTransitController.summonedTransits[player.ProfileId].raidId,
            raidMode = raidSettings.RaidMode,
            side = (player.Side == EPlayerSide.Savage) ? ESideType.Savage : ESideType.Pmc,
            dayTime = raidSettings.SelectedDateTime
        };

        vanillaTransitController.alreadyTransits.Add(player.ProfileId, transitPayload);

        return true;
    }
}