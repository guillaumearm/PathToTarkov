using EFT;

namespace PTT.Utils;

internal class Trader
{
    internal static bool IsHidden(ref Profile.TraderInfo trader)
    {
        bool traderIsLocked = !trader.Unlocked;
        bool shouldHideLockedTrader = !Settings.Config.ShowLockedTraders.Value;

        return shouldHideLockedTrader && traderIsLocked;
    }
}