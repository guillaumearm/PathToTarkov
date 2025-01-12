using System;
using System.Collections.Generic;
using Comfort.Common;

using EFT.Communications;
using InteractableExfilsAPI.Singletons;

using LiteNetLib;
using Fika.Core.Coop.Components;
using Fika.Core.Coop.Players;
using Fika.Core.Networking;
using Fika.Core.Modding;
using Fika.Core.Modding.Events;
using Fika.Core.Coop.Utils;

using PTT.Data;
using PTT.Helpers;
using PTT.Packets;

namespace PTT.Services;

public static class TransitVoteServiceFika
{
    private static Dictionary<int, ExfilTarget> Votes = [];
    private static Action ExfilAction = null;
    private static bool Enabled = true;

    public static void Init()
    {
        FikaEventDispatcher.SubscribeEvent<FikaNetworkManagerCreatedEvent>(OnFikaNetworkManagerCreated);
        Logger.Info("Initialized Transit Vote service");
    }

    public static void InitRaid()
    {
        Votes = [];
        ExfilAction = null;
        Enabled = true;
    }

    public static void VoteForExfil(ExfilTarget exfilTarget, Action exfilAction)
    {
        CoopHandler coopHandler = Helpers.Fika.GetCoopHandler();
        if (coopHandler == null)
        {
            Logger.Error("(FIKA) Cannot vote for exfil because no CoopHandler found");
            return;
        }

        Logger.Info($"(FIKA) Vote for exfil {exfilTarget.GetCustomExitName()} with current player {coopHandler.MyPlayer.NetId}");
        NotificationManagerClass.DisplayMessageNotification($"Voted for exfil {exfilTarget.GetCustomActionName()}", ENotificationDurationType.Long);

        ExfilAction = exfilAction;
        Votes.ForceAddValue(coopHandler.MyPlayer.NetId, exfilTarget);
        InteractableExfilsService.RefreshPrompt();

        if (Helpers.Fika.IsHost() && IsVoteSuccess())
        {
            PerformAllExfil();
            return;
        }

        var packet = CreateVotePacket(exfilTarget);
        if (Helpers.Fika.IsClient())
        {
            Singleton<FikaClient>.Instance.SendData(ref packet, DeliveryMethod.ReliableSequenced);
        }
        else if (Helpers.Fika.IsHost())
        {
            Singleton<FikaServer>.Instance.SendDataToAll(ref packet, DeliveryMethod.ReliableSequenced);
        }
    }

    public static void CancelVoteForExfil(string cancelMessage)
    {
        CoopHandler coopHandler = Helpers.Fika.GetCoopHandler();
        if (coopHandler == null)
        {
            Logger.Error("(FIKA) Cannot vote for exfil because no CoopHandler found");
            return;
        }

        if (ExfilAction == null && !Votes.ContainsKey(coopHandler.MyPlayer.NetId))
        {
            Logger.Warning($"(FIKA) No vote to cancel with current player {coopHandler.MyPlayer.NetId}");
            return;
        }

        Logger.Info($"(FIKA) Cancel vote with current player {coopHandler.MyPlayer.NetId}");

        if (cancelMessage != null && cancelMessage != "")
        {
            NotificationManagerClass.DisplayMessageNotification(cancelMessage, ENotificationDurationType.Long);
        }

        ExfilAction = null;
        Votes.Remove(coopHandler.MyPlayer.NetId);
        InteractableExfilsService.RefreshPrompt();

        PlayerVotedForExfilTargetPacket packet = CreateCancelVotePacket();
        if (Helpers.Fika.IsClient())
        {
            Singleton<FikaClient>.Instance.SendData(ref packet, DeliveryMethod.ReliableSequenced);
        }
        else if (Helpers.Fika.IsHost())
        {
            Singleton<FikaServer>.Instance.SendDataToAll(ref packet, DeliveryMethod.ReliableSequenced);
        }
    }

    public static bool IsTransitDisabledByVote(ExfilTarget exfilTarget)
    {
        if (!Enabled)
        {
            return true;
        }

        if (Votes.Count == 0)
        {
            return false;
        }

        foreach (ExfilTarget votedExfilTarget in Votes.Values)
        {
            if (votedExfilTarget.GetCustomExitName() != exfilTarget.GetCustomExitName())
            {
                return true;
            }
        }

        return false;
    }

    public static void SendDisableTransitVotePacket(string reason)
    {
        if (!Singleton<FikaServer>.Instantiated)
        {
            Logger.Error("(FIKA) Only the server can call SendDisableTransitVotePacket");
            return;
        }

        var fikaServer = Singleton<FikaServer>.Instance;
        var packet = new DisableTransitVotePacket { Reason = reason };
        fikaServer.SendDataToAll(ref packet, DeliveryMethod.ReliableOrdered);
    }

    private static void HandlePlayerVotedForExfil(PlayerVotedForExfilTargetPacket packet, NetPeer peer)
    {
        CoopHandler coopHandler = Helpers.Fika.GetCoopHandler();
        if (coopHandler == null)
        {
            Logger.Error("(FIKA) HandlePlayerVotedForExfil: cannot retrieve coopHandler");
            return;
        }

        int playerNetId = packet.NetId;

        if (packet.IsVoteCancelled())
        {
            Logger.Info($"(FIKA) Cancel vote packet received by peer {playerNetId}");
            NotificationManagerClass.DisplayMessageNotification($"Vote cancelled for player {playerNetId}", ENotificationDurationType.Long);
            Votes.Remove(playerNetId);
            InteractableExfilsService.RefreshPrompt();

            if (Helpers.Fika.IsHost())
            {
                // propagate change (for UI)
                Singleton<FikaServer>.Instance.SendDataToAll(ref packet, DeliveryMethod.ReliableSequenced, peer);
            }
        }
        else
        {
            ExfilTarget exfilTarget = FromVotePacket(packet);

            Logger.Info($"(FIKA) Vote packet received by peer {playerNetId} for exfil {exfilTarget.GetCustomExitName()}");
            NotificationManagerClass.DisplayMessageNotification($"Player {playerNetId} voted for exfil {exfilTarget.GetCustomActionName()}", ENotificationDurationType.Long);
            Votes.ForceAddValue(playerNetId, exfilTarget);
            InteractableExfilsService.RefreshPrompt();

            if (Helpers.Fika.IsHost())
            {
                // propagate change (for UI)
                Singleton<FikaServer>.Instance.SendDataToAll(ref packet, DeliveryMethod.ReliableSequenced, peer);
            }
        }

        if (Helpers.Fika.IsHost() && IsVoteSuccess())
        {
            PerformAllExfil();
        }
    }

    private static void OnFikaNetworkManagerCreated(FikaNetworkManagerCreatedEvent createdEvent)
    {
        IFikaNetworkManager networkManager = createdEvent.Manager;
        if (networkManager == null)
        {
            Logger.Error("(FIKA) Cannot register packets because networkManager is not found");
            return;
        }

        Helpers.Fika.FikaNetworkManager = networkManager;

        networkManager.RegisterPacket<PlayerVotedForExfilTargetPacket, NetPeer>(HandlePlayerVotedForExfil);
        Logger.Info("(FIKA) Registered PlayerVotedForExfilTargetPacket");

        if (Helpers.Fika.IsClient())
        {
            networkManager.RegisterPacket<PerformExfilPacket, NetPeer>(HandlePerformExfil);
            Logger.Info("(FIKA) Registered PerformExfilPacket");
            networkManager.RegisterPacket<DisableTransitVotePacket, NetPeer>(HandleDisableTransitVote);
            Logger.Info("(FIKA) Registered DisableTransitVotePacket");
        }
    }

    private static void PerformAllExfil()
    {
        if (!Singleton<FikaServer>.Instantiated)
        {
            Logger.Error("(FIKA) Only the server can call PerformAllExfil");
            return;
        }

        var fikaServer = Singleton<FikaServer>.Instance;
        var packet = new PerformExfilPacket();
        fikaServer.SendDataToAll(ref packet, DeliveryMethod.ReliableOrdered);
        PerformLocalExfil();
    }

    private static void HandlePerformExfil(PerformExfilPacket packet, NetPeer peer)
    {
        PerformLocalExfil();
    }

    private static void HandleDisableTransitVote(DisableTransitVotePacket packet, NetPeer peer)
    {
        Enabled = false;
        NotificationManagerClass.DisplayMessageNotification($"Transits disabled because {packet.Reason}", ENotificationDurationType.Long);
        InteractableExfilsService.RefreshPrompt();
    }

    private static ExfilTarget RetrieveFirstVote()
    {
        foreach (var kvp in Votes)
        {
            return kvp.Value;
        }

        return null;
    }

    private static void PerformLocalExfil()
    {
        if (FikaBackendUtils.IsDedicated)
        {
            ExfilTarget exfilTarget = RetrieveFirstVote();
            if (exfilTarget == null)
            {
                Logger.Error("(FIKA dedi) Cannot perform exfil because no exil found in Votes dictionary");
            }
            else
            {
                CustomExfilServiceFika.TransitTo(exfilTarget);
            }
        }
        else
        {
            if (ExfilAction == null)
            {
                Logger.Error("(FIKA) Cannot perform exfil because no action has been set");
                return;
            }

            ExfilAction();
            ExfilAction = null;
        }
    }

    private static bool IsVoteSuccess()
    {
        ExfilTarget votedExfilTarget = null;
        List<CoopPlayer> humans = Helpers.Fika.GetHumanPlayers();

        if (humans == null || humans.Count == 0)
        {
            Logger.Error("(FIKA) No human players found");
            return false;
        }

        foreach (CoopPlayer human in humans)
        {
            if (!Votes.TryGetValue(human.NetId, out ExfilTarget exfilTarget))
            {
                return false;
            }

            if (votedExfilTarget == null)
            {
                votedExfilTarget = exfilTarget;
            }
            else if (exfilTarget.GetCustomExitName() != votedExfilTarget.GetCustomExitName())
            {
                return false;
            }
        }

        return votedExfilTarget != null;
    }

    private static ExfilTarget FromVotePacket(PlayerVotedForExfilTargetPacket packet)
    {
        RawExfilTarget rawExfilTarget = packet.RawExfilTarget;

        return new ExfilTarget
        {
            exitName = rawExfilTarget.ExitName,
            isTransit = rawExfilTarget.IsTransit,
            transitMapId = rawExfilTarget.TransitMapId,
            transitSpawnPointId = rawExfilTarget.TransitSpawnPointId,
            offraidPosition = rawExfilTarget.OffraidPosition,
        };
    }

    private static PlayerVotedForExfilTargetPacket CreateCancelVotePacket()
    {
        return new PlayerVotedForExfilTargetPacket
        {
            NetId = Helpers.Fika.GetMyPlayerNetId(),
            RawExfilTarget = new RawExfilTarget()
        };
    }

    private static PlayerVotedForExfilTargetPacket CreateVotePacket(ExfilTarget exfilTarget)
    {
        return new PlayerVotedForExfilTargetPacket
        {
            NetId = Helpers.Fika.GetMyPlayerNetId(),
            RawExfilTarget = new RawExfilTarget
            {
                ExitName = exfilTarget.exitName,
                IsTransit = exfilTarget.isTransit,
                TransitMapId = exfilTarget.transitMapId,
                TransitSpawnPointId = exfilTarget.transitSpawnPointId,
                OffraidPosition = exfilTarget.offraidPosition,
            }
        };
    }
}