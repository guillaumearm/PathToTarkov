using EFT;
using EFT.Interactive;
using Comfort.Common;
using System;
using System.Collections.Generic;

using PTT.Helpers;
using PTT.Data;
using PTT.Patches;

namespace PTT.Services;

public static class CustomExfilService
{
    public static void ExtractTo(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        if (Plugin.FikaIsInstalled)
        {
            CustomExfilServiceFika.ExtractTo(exfil, exfilTarget);
            return;
        }

        LocalGame localGame = Singleton<AbstractGame>.Instance as LocalGame;
        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        Logger.Info($"started extraction on '{exfilTarget.GetCustomExitName()}'");


        if (localGame == null)
        {
            Logger.Error($"cannot extract because no LocalGame found");
            return;
        }

        if (player == null)
        {
            Logger.Error($"cannot extract because no Player found");
            return;
        }

        CurrentExfilTargetService.SaveExfil(exfilTarget);

        // This is needed to validate extract quests like `Burning Rubber`
        // The ptt custom ptt exfil target name will be used to override the exitName in the LocalRaidEndedPatch
        string exitName = exfilTarget.exitName;

        float delay = 0f;
        localGame.Stop(player.ProfileId, ExitStatus.Survived, exitName, delay);
        Logger.Info($"local game stopped for profile '{player.ProfileId}'");
    }

    public static void TransitTo(ExfilTarget exfilTarget, Action onTransitDone)
    {
        if (Plugin.FikaIsInstalled)
        {
            TransitVoteServiceFika.VoteForExfil(exfilTarget, () =>
            {
                CustomExfilServiceFika.TransitTo(exfilTarget);
                onTransitDone();
            });
            return;
        }

        TransitPoint transit = Transit.Create(exfilTarget);
        Logger.Info($"started transit on '{transit.parameters.name}'");
        CurrentExfilTargetService.SaveExfil(exfilTarget);

        if (!TransitControllerAbstractClass.Exist(out GClass1642 vanillaTransitController))
        {
            Logger.Error($"cannot transit because no TransitControllerAbstractClass found");
            return;
        }

        Player player = Singleton<GameWorld>.Instance.MainPlayer;
        if (player == null)
        {
            Logger.Error($"cannot transit because no player found");
            return;
        }

        Dictionary<string, ProfileKey> profiles = [];
        profiles.Add(player.ProfileId, new()
        {
            isSolo = true,
            keyId = player.GroupId,
            _id = player.ProfileId,
        });

        string transitHash = Guid.NewGuid().ToString();
        int playersCount = 1;

        vanillaTransitController.Transit(transit, playersCount, transitHash, profiles, player);
        onTransitDone();
        Logger.Info($"transit done for profile '{player.ProfileId}'");
    }

    public static void CancelTransitVote(string cancelMessage)
    {
        if (Plugin.FikaIsInstalled)
        {
            TransitVoteServiceFika.CancelVoteForExfil(cancelMessage);
        }
    }

    public static bool IsTransitDisabled(ExfilTarget exfilTarget)
    {
        if (Plugin.FikaIsInstalled && exfilTarget.isTransit)
        {
            return TransitVoteServiceFika.IsTransitDisabledByVote(exfilTarget);
        }
        return false;
    }
}
