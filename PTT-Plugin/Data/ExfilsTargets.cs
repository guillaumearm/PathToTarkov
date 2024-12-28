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

    public string GetCustomActionName()
    {
        if (isTransit)
        {
            string transitTemplate = "PTT_TRANSITS_PROMPT_TEMPLATE".Localized();
            return string.Format(transitTemplate, transitMapId.Localized());
        }

        string extractTemplate = "PTT_EXTRACTS_PROMPT_TEMPLATE".Localized();
        string offraidPositionDisplayNameKey = $"PTT_OFFRAIDPOS_DISPLAY_NAME_{offraidPosition}";
        string offraidPositionDisplayName = offraidPositionDisplayNameKey.Localized();

        // when the offraid position display name cannot be resolved
        if (offraidPositionDisplayName == offraidPositionDisplayNameKey)
        {
            return string.Format(extractTemplate, offraidPosition);
        }

        return string.Format(extractTemplate, offraidPositionDisplayName);
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