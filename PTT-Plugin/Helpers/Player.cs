using Comfort.Common;
using EFT;

namespace PTT.Helpers;

internal static class PlayerProfile
{
    internal static int GetLevel()
    {
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        return player.Profile.Info.Level;
    }
}