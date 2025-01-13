using LiteNetLib.Utils;

namespace PTT.Packets;

public struct PlayerVotedForExfilTargetPacket : INetSerializable
{
    public int NetId;
    public RawExfilTarget RawExfilTarget;

    public void Deserialize(NetDataReader reader)
    {
        NetId = reader.GetInt();
        RawExfilTarget = reader.Get<RawExfilTarget>();
    }

    public void Serialize(NetDataWriter writer)
    {
        writer.Put(NetId);
        writer.Put(RawExfilTarget);
    }

    public readonly bool IsVoteCancelled()
    {
        return RawExfilTarget.ExitName == null || RawExfilTarget.ExitName == "";
    }
}