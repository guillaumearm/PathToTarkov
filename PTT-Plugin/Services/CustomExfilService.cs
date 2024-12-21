using System;
using EFT;
using EFT.Interactive;
using Comfort.Common;
using BepInEx.Logging;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;
using System.Reflection;
using Fika.Core.Coop.Components;
using PTT;

namespace PTT.Services;

public static class CustomExfilService
{
    public static bool ExtractTo(ExfiltrationPoint exfiltrationPoint, string customExfilName)
    {
        LocalGame localGame = Singleton<AbstractGame>.Instance as LocalGame;
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (localGame == null || player == null) return false;

        localGame.Stop(player.ProfileId, ExitStatus.Survived, customExfilName, 0f);
        return true;
    }

    public static bool TransitTo(string locationId, string customExfilName)
    {
        LocalGame localGame = Singleton<AbstractGame>.Instance as LocalGame;
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (localGame == null || player == null) return false;

        bool preparedTransit = Helpers.Transit.PrepareTransits(locationId);

        if (!preparedTransit)
        {
            return false;
        }

        localGame.Stop(player.ProfileId, ExitStatus.Transit, customExfilName, 0f);
        return true;
    }
}
