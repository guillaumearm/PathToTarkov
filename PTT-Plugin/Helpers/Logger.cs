using BepInEx.Logging;

namespace PTT.Helpers;

internal static class Logger
{
    private static ManualLogSource _logger;

    internal static void Init(ManualLogSource logger)
    {
        _logger = logger;
    }

    internal static void Info(string content)
    {
        _logger.LogInfo($"[PTT] {content}");
    }

    internal static void Warning(string content)
    {
        _logger.LogWarning($"[PTT] Warning: {content}");
    }

    internal static void Error(string content)
    {
        _logger.LogError($"[PTT] Error: {content}");
    }
}