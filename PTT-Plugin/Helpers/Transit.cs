using EFT.Interactive;

namespace PTT.Helpers;

static class Transit
{
    static public TransitPoint Create(string locationId, string customExfilName)
    {
        return new TransitPoint
        {
            Enabled = true,
            IsActive = true,
            // Controller = vanillaTransitController, // not needed
            parameters = new LocationSettingsClass.Location.TransitParameters
            {
                active = true,
                id = 1,
                name = customExfilName,
                description = customExfilName,
                conditions = string.Empty,
                target = locationId, // should be "_Id" of the corresponding location base but not needed here
                location = locationId,
            }
        };
    }
}