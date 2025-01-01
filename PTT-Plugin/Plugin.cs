using BepInEx;
using BepInEx.Logging;
using BepInEx.Bootstrap;

using PTT.Services;
using System;
using EFT.Communications;

namespace PTT;

[BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
public class Plugin : BaseUnityPlugin
{
    public static bool FikaIsInstalled { get; private set; }
    private static bool InteractableExfilsApiIsInstalled { get; set; }
    private static bool InteractableExfilsApiIsOutdated { get; set; } = false;
    private static bool KaenoTraderScrollingIsInstalled { get; set; }
    public static ExfilsTargetsService ExfilsTargetsService;
    private const string IE_API_PLUGIN_NAME = "Jehree.InteractableExfilsAPI";

    protected void Awake()
    {
        Helpers.Logger.Init(Logger);
        Helpers.Logger.Info($"Plugin {PluginInfo.PLUGIN_GUID} is loading...");

        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey("com.fika.core");
        InteractableExfilsApiIsInstalled = Chainloader.PluginInfos.ContainsKey(IE_API_PLUGIN_NAME);
        KaenoTraderScrollingIsInstalled = Chainloader.PluginInfos.ContainsKey("com.kaeno.TraderScrolling");

        Settings.Config.Init(Config);

        ExfilsTargetsService = new ExfilsTargetsService();

        if (FikaIsInstalled)
        {
            Helpers.Logger.Info($"Fika.Core plugin detected");
        }

        if (KaenoTraderScrollingIsInstalled)
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

        Helpers.Logger.Info($"Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
    }

    protected void Start()
    {
        if (InteractableExfilsApiIsInstalled)
        {
            Version apiVersion = Chainloader.PluginInfos[IE_API_PLUGIN_NAME].Metadata.Version;

            if (apiVersion < new Version("1.4.0"))
            {
                Helpers.Logger.Warning($"Jehree.InteractableExfilsAPI >= 1.4.0 is required");
                InteractableExfilsApiIsOutdated = true;
            }

            Helpers.Logger.Info($"Jehree.InteractableExfilsAPI plugin detected");
            IEApiWrapper.Init(ExfilsTargetsService);
        }
        else
        {
            Helpers.Logger.Error($"Jehree.InteractableExfilsAPI plugin is missing");
        }
    }

    public static void DisplayInteractableExfilsAPIWarning()
    {
        if (!InteractableExfilsApiIsInstalled)
        {
            NotificationManagerClass.DisplayWarningNotification("Path To Tarkov: Interactable Exfils API mod is not installed", ENotificationDurationType.Long);
        }
        else if (InteractableExfilsApiIsOutdated)
        {
            NotificationManagerClass.DisplayWarningNotification("Path To Tarkov: Your Interactable Exfils API mod is outdated. v1.4.0 or higher is required", ENotificationDurationType.Long);
        }
    }
}
