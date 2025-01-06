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
    public static IFikaNetworkManager GetNetworkManager()
    {
        return Singleton<IFikaNetworkManager>.Instance;
    }

    public static CoopHandler GetCoopHandler()
    {
        return GetNetworkManager()?.CoopHandler;
    }

    public static List<CoopPlayer> GetHumanPlayers()
    {
        return GetCoopHandler()?.HumanPlayers?.Where(player =>
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
        }).ToList();
    }

    public static CoopPlayer GetMyPlayer()
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

    public static bool IsClient()
    {
        return Singleton<FikaClient>.Instantiated;
    }
}