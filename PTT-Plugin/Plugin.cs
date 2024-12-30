using BepInEx;
using BepInEx.Logging;
using BepInEx.Bootstrap;

using PTT.Services;
using System;

namespace PTT;

[BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
public class Plugin : BaseUnityPlugin
{
    public static bool FikaIsInstalled { get; private set; }
    private static bool InteractableExfilsApiIsInstalled { get; set; }
    private static bool KaenoTraderScrollingIsInstalled { get; set; }
    public static ManualLogSource LogSource { get; private set; }
    public static ExfilsTargetsService ExfilsTargetsService;


    protected void Awake()
    {
        Helpers.Logger.Init(Logger);
        Helpers.Logger.Info($"Plugin {PluginInfo.PLUGIN_GUID} is loading...");

        LogSource = Logger;
        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey("com.fika.core");
        InteractableExfilsApiIsInstalled = Chainloader.PluginInfos.ContainsKey("Jehree.InteractableExfilsAPI");
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

        Helpers.Logger.Info($"Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
    }

    protected void Start()
    {
        if (InteractableExfilsApiIsInstalled)
        {
            Version apiVersion = Chainloader.PluginInfos["Jehree.InteractableExfilsAPI"].Metadata.Version;

            if (apiVersion < new Version("1.4.0"))
            {
                Helpers.Logger.Warning($"Jehree.InteractableExfilsAPI >= 1.4.0 is required");
                // TODO: warn the user on game start (+ add BepInEx advanced option to silent those warnings)
                // NotificationManagerClass.DisplayWarningNotification("Path To Tarkov: Your Interactable Exfils API mod is outdated. at least v1.4.0 is required");
            }

            Helpers.Logger.Info($"Jehree.InteractableExfilsAPI plugin detected");
            IEApiWrapper.Init(ExfilsTargetsService);
        }
        else
        {
            Helpers.Logger.Error($"Jehree.InteractableExfilsAPI plugin is missing");
            // TODO: warn the user on game start (+ add BepInEx advanced option to silent those warnings)
            // NotificationManagerClass.DisplayWarningNotification("Path To Tarkov: Interactable Exfils API mod is not installed");
        }
    }
}
