using PTT.Settings;

namespace PTT.Data;


// Warning: The fields here are shared with the server
public class ExfilTarget
{
    public string exitName;
    public bool isTransit;
    public string transitMapId; // transit only
    public string transitSpawnPointId; // transit only
    public string offraidPosition; // empty on transit

    // used for tooltips rendering
    public string[] nextMaps;
    public string[] nextTraders;

    public string GetCustomActionName(bool isDisabled = false)
    {
        string disabledPrefix = isDisabled ? $"[{"Disabled".Localized()}] " : "";

        if (isTransit)
        {
            string transitTemplate = "PTT_TRANSITS_PROMPT_TEMPLATE".Localized();
            string result = string.Format(transitTemplate, transitMapId.Localized());


            if (Config.DebugMode.Value && transitMapId.ToLower() == "sandbox_high")
            {
                return $"{disabledPrefix}{result}*";
            }

            return $"{disabledPrefix}{result}";
        }

        string extractTemplate = "PTT_EXTRACTS_PROMPT_TEMPLATE".Localized();
        string offraidPositionDisplayNameKey = $"PTT_OFFRAIDPOS_DISPLAY_NAME_{offraidPosition}";
        string offraidPositionDisplayName = offraidPositionDisplayNameKey.Localized();

        // when the offraid position display name cannot be resolved
        if (offraidPositionDisplayName == offraidPositionDisplayNameKey)
        {
            return $"{disabledPrefix}{string.Format(extractTemplate, offraidPosition)}";
        }

        return $"{disabledPrefix}{string.Format(extractTemplate, offraidPositionDisplayName)}";
    }

    public string GetCustomExitName()
    {
        if (isTransit)
        {
            return $"{exitName}.{transitMapId}.{transitSpawnPointId}";
        }

        return $"{exitName}.{offraidPosition}";
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