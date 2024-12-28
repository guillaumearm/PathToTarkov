using Comfort.Common;
using EFT.UI;

namespace PTT.Helpers;

internal static class Sound
{
    static public void PlayMenuEnter()
    {

        Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuCheckBox);
        // alternative sound
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuCheckBox);
    }

    static public void PlayMenuCancel()
    {
        Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuDropdownSelect);

        // alternative sound
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuContextMenu);
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuEscape);
    }

    static public void PlayExtractConfirm()
    {
        Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.ChatSelect);

        // alternative sound
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuInspectorWindowOpen);
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.ButtonClick);
    }

    static public void PlayTransitConfirm()
    {
        Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.ChatSelect);

        // alternative sound
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.MenuInspectorWindowOpen);
        // Singleton<GUISounds>.Instance.PlayUISound(EUISoundType.ButtonClick);
    }
}