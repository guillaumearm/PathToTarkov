namespace PTT.Helpers;

public class StringUtils
{
    public static string Capitalize(string input)
    {
        if (string.IsNullOrEmpty(input))
        {

            return input;
        }

        return char.ToUpper(input[0]) + input.Substring(1);
    }

    public static string Titleize(string input)
    {
        if (string.IsNullOrEmpty(input))
        {

            return input;
        }

        return Capitalize(input.ToLower());
    }
}