using LiteNetLib.Utils;

namespace PTT.Packets;


public struct RawExfilTarget : INetSerializable
{
    public string ExitName; // will be empty when player exit a zone
    public bool IsTransit;
    public string TransitMapId; // transit only
    public string TransitSpawnPointId; // transit only
    public string OffraidPosition; // empty on transit

    public void Deserialize(NetDataReader reader)
    {
        ExitName = EnsureNull(reader.GetString());
        IsTransit = reader.GetBool();
        TransitMapId = EnsureNull(reader.GetString());
        TransitSpawnPointId = EnsureNull(reader.GetString());
        OffraidPosition = EnsureNull(reader.GetString());
    }

    public void Serialize(NetDataWriter writer)
    {
        writer.Put(ExitName ?? "");
        writer.Put(IsTransit);
        writer.Put(TransitMapId ?? "");
        writer.Put(TransitSpawnPointId ?? "");
        writer.Put(OffraidPosition ?? "");
    }

    private readonly string EnsureNull(string val)
    {
        if (val == "")
        {
            return null;
        }
        return val;
    }
}