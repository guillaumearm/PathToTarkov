using PTT.Data;

namespace PTT.Services;

internal static class CurrentExfilTargetService
{
    private static ExfilTarget CurrentExfilTarget { get; set; } = null;

    public static void Init()
    {
        CurrentExfilTarget = null;
    }

    public static void SaveExfil(ExfilTarget exfilTarget)
    {
        CurrentExfilTarget = exfilTarget;
    }

    public static string ConsumeExitName()
    {
        string customExitName = CurrentExfilTarget?.GetCustomExitName() ?? null;
        CurrentExfilTarget = null;
        return customExitName;
    }
}
