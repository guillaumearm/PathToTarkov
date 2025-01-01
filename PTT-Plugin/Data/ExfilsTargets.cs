using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using SPT.Common.Http;
using Newtonsoft.Json;
using EFT.Interactive;
using PTT.Settings;
using EFT;

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
            string result = string.Format(transitTemplate, transitMapId.Localized());

            if (Config.DebugMode.Value && transitMapId.ToLower() == "sandbox_high")
            {
                return $"{result}*";
            }

            return result;
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

    public bool IsAvailable()
    {
        if (transitMapId == null)
        {
            return true;
        }

        bool playerIsHighLevel = Helpers.PlayerProfile.GetLevel() >= 20;
        bool playerIsLowLevel = !playerIsHighLevel;
        bool isSandboxLow = transitMapId.ToLower() == "sandbox";
        bool isSandboxHigh = transitMapId.ToLower() == "sandbox_high";

        if (playerIsHighLevel && isSandboxLow)
        {
            return false;
        }

        if (playerIsLowLevel && isSandboxHigh)
        {
            return false;
        }

        return true;
    }
}