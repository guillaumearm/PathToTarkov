using LiteNetLib.Utils;

namespace PTT.Packets;

public struct PlayerChangedExitZonePacket : INetSerializable
{
    public string PlayerId;
    public string ExitName; // will be null when player exit a zone

    public void Deserialize(NetDataReader reader)
    {
        PlayerId = reader.GetString();
        ExitName = reader.GetString();
    }

    public void Serialize(NetDataWriter writer)
    {
        writer.Put(PlayerId);
        writer.Put(ExitName);
    }
}