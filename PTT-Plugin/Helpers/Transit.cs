using EFT.Interactive;
using PTT.Data;

namespace PTT.Helpers;

internal static class Transit
{
    static public TransitPoint Create(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        string locationId = exfilTarget.transitMapId;
        string customTransitName = exfilTarget.GetCustomExitName(exfil);

        return new TransitPoint
        {
            Enabled = true,
            IsActive = true,
            // Controller = vanillaTransitController, // not needed
            parameters = new LocationSettingsClass.Location.TransitParameters
            {
                active = true,
                id = 1,
                name = customTransitName,
                description = customTransitName,
                conditions = string.Empty,
                target = "", // should be "_Id" of the corresponding location base but not needed here
                location = locationId,
            }
        };
    }
}