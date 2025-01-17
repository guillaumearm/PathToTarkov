using BepInEx;
using BepInEx.Bootstrap;

using PTT.Services;
using System;
using EFT.Communications;
using PTT;
using BepInEx.Logging;

namespace PTT;

[BepInPlugin("Trap.PathToTarkov", "Path To Tarkov", PluginVersion.VERSION)]
public class Plugin : BaseUnityPlugin
{
    public static bool FikaIsInstalled { get; private set; }
    public static bool FikaIsOutdated { get; private set; }

    private static string PathToTarkovServerFullVersion { get; set; } = null;
    private static bool PathToTarkovIsDisabled { get; set; } = false;
    private static bool InteractableExfilsApiIsInstalled { get; set; }
    private static bool InteractableExfilsApiIsOutdated { get; set; } = false;
    public static CurrentLocationDataService CurrentLocationDataService;
    private const string IE_API_PLUGIN_NAME = "Jehree.InteractableExfilsAPI";
    private const string IE_API_MIN_VERSION = "2.0.0";
    private const string FIKA_PLUGIN_NAME = "com.fika.core";
    private const string FIKA_MIN_VERSION = "1.1.5";

    protected void Awake()
    {
        Helpers.Logger.Init(Logger);

        FetchPathToTarkovServerVersion();
        if (PathToTarkovIsDisabled)
        {
            Helpers.Logger.Warning($"Plugin Trap-PathToTarkov v{PluginVersion.FULL_VERSION} is disabled!");
            return;
        }

        Helpers.Logger.Info($"Plugin Trap-PathToTarkov v{PluginVersion.FULL_VERSION} is loading...");
        Settings.Config.Init(Config);

        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey(FIKA_PLUGIN_NAME);
        InteractableExfilsApiIsInstalled = Chainloader.PluginInfos.ContainsKey(IE_API_PLUGIN_NAME);

        CurrentLocationDataService = new CurrentLocationDataService();

        if (Chainloader.PluginInfos.ContainsKey("com.kaeno.TraderScrolling"))
        {
            Helpers.Logger.Info($"Kaeno-TraderScrolling detected");
            new Patches.KaenoTraderScrollingCompatPatch().Enable();
        }

        new Patches.HideLockedTraderCardPatch().Enable();
        new Patches.HideLockedTraderPanelPatch().Enable();
        new Patches.InitAllExfiltrationPointsPatch().Enable();
        new Patches.ScavExfiltrationPointPatch().Enable();
        new Patches.OnGameStartedPatch().Enable();
        new Patches.LocalRaidStartedPatch().Enable();
        new Patches.LocalRaidEndedPatch().Enable();
        new Patches.MenuScreenAwakePatch().Enable();
        new Patches.ExitTimerPanelSetTimerTextActivePatch().Enable();
        new Patches.ExitTimerPanelUpdateVisitedStatusPatch().Enable();
        new Patches.ExtractionTimersPanelSwitchTimersPatch().Enable();

        Helpers.Logger.Info($"Plugin Trap-PathToTarkov v{PluginVersion.FULL_VERSION} is loaded!");
    }

    protected void Start()
    {
        if (PathToTarkovIsDisabled) return;

        if (FikaIsInstalled)
        {
            Version fikaVersion = Chainloader.PluginInfos[FIKA_PLUGIN_NAME].Metadata.Version;

            if (fikaVersion < new Version(FIKA_MIN_VERSION))
            {
                Helpers.Logger.Warning($"Fika >= {IE_API_MIN_VERSION} is required");
                FikaIsOutdated = true;
            }

            Helpers.Logger.Info($"Fika.Core plugin detected");
            TransitVoteServiceFika.Init();
        }

        if (InteractableExfilsApiIsInstalled)
        {
            Version apiVersion = Chainloader.PluginInfos[IE_API_PLUGIN_NAME].Metadata.Version;

            if (apiVersion < new Version(IE_API_MIN_VERSION))
            {
                Helpers.Logger.Warning($"Jehree.InteractableExfilsAPI >= {IE_API_MIN_VERSION} is required");
                InteractableExfilsApiIsOutdated = true;
            }

            Helpers.Logger.Info($"Jehree.InteractableExfilsAPI plugin detected");
            IEApiWrapper.Init();
        }
        else
        {
            Helpers.Logger.Error($"Jehree.InteractableExfilsAPI plugin is missing");
        }
    }

    // Warning: use GameStarted to get a coopPlayer
    public static void RaidStarted()
    {
        if (FikaIsInstalled)
        {
            TransitVoteServiceFika.OnRaidStarted();
        }

        if (CurrentLocationDataService != null)
        {
            CurrentLocationDataService.Init();
            Helpers.Logger.Info("Initialized CurrentLocationDataService");
        }
        else
        {
            Helpers.Logger.Error("CurrentLocationDataService instance not found");
        }

        CurrentExfilTargetService.Init();

        if (InteractableExfilsApiIsInstalled)
        {
            IEApiWrapper.ExfilPromptService.ClearExfilPromptsCache();
        }

        DisplayOutdatedVersionsWarnings();
        Helpers.Logger.Info("Raid started!");
    }

    public static void GameStarted()
    {
        if (FikaIsInstalled)
        {
            TransitVoteServiceFika.OnGameStarted();
        }

        DisplayOutdatedVersionsWarnings();
        Helpers.Logger.Info("Game started!");
    }

    public static void RaidEnded()
    {
        Helpers.Logger.Info("Raid ended!");
    }

    public static void DisplayOutdatedVersionsWarnings()
    {
        if (PluginVersion.FULL_VERSION != PathToTarkovServerFullVersion)
        {
            Helpers.Logger.Warning($"Mismatch version between server ({PathToTarkovServerFullVersion}) and plugin ({PluginVersion.FULL_VERSION})");
            NotificationManagerClass.DisplayMessageNotification("Path To Tarkov: mismatch version between server and plugin, please reinstall the mod correctly", ENotificationDurationType.Long);
        }

        if (!InteractableExfilsApiIsInstalled)
        {
            NotificationManagerClass.DisplayWarningNotification("Path To Tarkov: Interactable Exfils API mod is not installed", ENotificationDurationType.Long);
        }
        else if (InteractableExfilsApiIsOutdated)
        {
            NotificationManagerClass.DisplayWarningNotification($"Path To Tarkov: Your Interactable Exfils API mod is outdated. v{IE_API_MIN_VERSION} or higher is required", ENotificationDurationType.Long);
        }

        if (FikaIsInstalled && FikaIsOutdated)
        {
            NotificationManagerClass.DisplayWarningNotification($"Path To Tarkov: Fika.Core is outdated. v{FIKA_MIN_VERSION} or higher is required", ENotificationDurationType.Long);
        }
    }

    private static void FetchPathToTarkovServerVersion()
    {
        var data = Helpers.HttpRequest.FetchVersionData();

        // ptt server is missing
        if (data == null)
        {
            PathToTarkovIsDisabled = true;
            return;
        }

        // ptt server is uninstalled
        if (data.uninstalled)
        {
            PathToTarkovIsDisabled = true;
        }

        PathToTarkovServerFullVersion = data.fullVersion;
    }
}
