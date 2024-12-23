using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SPT.Common.Http;
using Newtonsoft.Json;
using EFT.Interactive;

namespace PTT.Data;

/**
* Request
**/
public class ExfilsTargetsRequest
{
    public string locationId;
}

/**
* Response
**/
public class ExfilsTargetsResponse
{
    // indexed by exit name
    public Dictionary<string, List<ExfilTarget>> data;
}

public class ExfilTarget
{
    public bool isTransit;
    public string transitMapId; // transit only
    public string transitSpawnPointId; // transit only
    public string offraidPosition; // empty on transit

    // TODO: i18n support (use the offraid position displayName)
    public string GetCustomActionName()
    {
        if (isTransit)
        {
            return $"Transit to {transitMapId}";
        }

        return $"Extract to {offraidPosition}";
    }

    public string GetCustomExitName(ExfiltrationPoint exfil)
    {
        if (isTransit)
        {
            return $"{exfil.Settings.Name}.{transitMapId}.{transitSpawnPointId}";
        }

        return $"{exfil.Settings.Name}.{offraidPosition}";
    }
}