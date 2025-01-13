

using UnityEngine;

namespace PTT.Helpers;

public class ColorUtils
{
    public static Color FromSystemColor(System.Drawing.Color systemColor)
    {
        return new Color
        {
            r = systemColor.R / 255f,
            g = systemColor.G / 255f,
            b = systemColor.B / 255f,
            a = systemColor.A / 255f
        };
    }
}