using System.Collections.Generic;
using System.Linq;
using Comfort.Common;
using Fika.Core.Coop.Components;
using Fika.Core.Coop.Players;
using Fika.Core.Coop.Utils;
using Fika.Core.Networking;

namespace PTT.Helpers;

public static class Fika
{
    public static IFikaNetworkManager FikaNetworkManager { get; set; } = null;
    public static IFikaNetworkManager GetNetworkManager()
    {
        if (FikaNetworkManager != null)
        {
            return FikaNetworkManager;
        }

        Logger.Warning("FikaNetworkManager not set, trying to fallback on singleton");

        // fallback on the old way of doing it
        return Singleton<IFikaNetworkManager>.Instance;
    }

    public static CoopHandler GetCoopHandler()
    {
        return GetNetworkManager()?.CoopHandler;
    }

    public static List<CoopPlayer> GetHumanPlayers()
    {
        var coopHandler = GetCoopHandler();

        if (coopHandler == null)
        {
            Logger.Error("GetHumanPlayers cannot retrieve the CoopHandler");
            return [];
        }


        List<CoopPlayer> humanPlayers = [];

        // HumanPlayers is a field in Fika version <= 1.1.4.0
        var humanPlayersField = coopHandler.GetType().GetField("HumanPlayers");
        var humanPlayersProperty = coopHandler.GetType().GetProperty("HumanPlayers");
        if (humanPlayersField != null)
        {
            Logger.Info("HumanPlayers: field detected");
            humanPlayers = (List<CoopPlayer>)humanPlayersField.GetValue(coopHandler) ?? [];
        }
        else if (humanPlayersProperty != null)
        {
            Logger.Info("HumanPlayers: property detected");
            humanPlayers = (List<CoopPlayer>)humanPlayersProperty.GetValue(coopHandler) ?? [];
        }
        else
        {
            Logger.Error("HumanPlayers: no property or field detected on CoopHandler");
            // for Fika Version >= 1.1.5.0
            humanPlayers = [];
        }

        var filteredHumanPlayers = humanPlayers.Where(player =>
        {
            if (FikaBackendUtils.IsDedicated)
            {
                return player.Profile.ProfileId != FikaBackendUtils.Profile.ProfileId;
            }

            // 2nd check is used in case GetHumanPlayers is also used by non-dedicated clients
            if (player.Profile.Info.GroupId == "DEDICATED")
            {
                return false;
            }

            return true;
        });

        return [.. filteredHumanPlayers];
    }

    private static CoopPlayer GetMyPlayer()
    {
        return GetCoopHandler()?.MyPlayer;
    }

    public static int GetMyPlayerNetId()
    {
        CoopPlayer myPlayer = GetMyPlayer();

        if (myPlayer == null)
        {
            Logger.Error("(FIKA) GetPlayerNetId: no CoopHandler.MyPlayer, fallback to 0");
            return 0;
        }

        return myPlayer.NetId;
    }

    public static bool IsHost()
    {
        return Singleton<FikaServer>.Instantiated;
    }

    public static bool IsHostPlayer()
    {
        return IsHost() && !IsDedicated();
    }

    public static bool IsClient()
    {
        return Singleton<FikaClient>.Instantiated;
    }

    public static bool IsDedicated()
    {
        return FikaBackendUtils.IsDedicated;
    }
}