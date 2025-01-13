using LiteNetLib.Utils;

namespace PTT.Packets;

public struct DisableTransitVotePacket : INetSerializable
{
    public string Reason;
    public void Deserialize(NetDataReader reader)
    {
        Reason = reader.GetString();
    }

    public void Serialize(NetDataWriter writer)
    {
        writer.Put(Reason);
    }
}