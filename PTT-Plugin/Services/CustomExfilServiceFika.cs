using EFT;
using EFT.Interactive;
using Comfort.Common;
using Fika.Core.Coop.GameMode;
using Fika.Core.Coop.Players;

namespace PTT.Services;

public static class CustomExfilServiceFika
{
    public static bool ExtractTo(ExfiltrationPoint exfiltrationPoint, string customExfilName)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null || coopPlayer == null)
        {
            return false;
        }

        coopGame.ExitLocation = customExfilName;
        coopGame.Extract(coopPlayer, exfiltrationPoint, null);
        return true;
    }

    public static bool TransitTo(string locationId, string originalExitName, string customExfilName)
    {
        CoopGame coopGame = (CoopGame)Singleton<IFikaGame>.Instance;
        CoopPlayer coopPlayer = (CoopPlayer)Singleton<GameWorld>.Instance.MainPlayer;

        if (coopGame == null || coopPlayer == null)
        {
            return false;
        }

        bool preparedTransit = Helpers.Transit.PrepareTransits(locationId);

        if (!preparedTransit)
        {
            return false;
        }


        var tp = new TransitPoint
        {
            parameters = new LocationSettingsClass.Location.TransitParameters
            {
                id = 1,
                name = customExfilName,
                target = locationId,
                location = locationId,
            }
        };

        // TODO: remove this because it look like it's not used
        // coopGame.ExitLocation = customExfilName;
        coopGame.ExitLocation = originalExitName;
        coopGame.Extract(coopPlayer, null, tp);
        return true;
    }
}
