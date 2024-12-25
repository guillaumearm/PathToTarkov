using BepInEx;
using BepInEx.Logging;
using BepInEx.Bootstrap;

using PTT.Services;

namespace PTT;

[BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
public class Plugin : BaseUnityPlugin
{
    public static bool FikaIsInstalled { get; private set; }
    public static ManualLogSource LogSource { get; private set; }
    public static ExfilsTargetsService ExfilsTargetsService;

    private static bool InteractableExfilsApiIsInstalled { get; set; }

    protected void Awake()
    {
        Helpers.Logger.Init(Logger);
        Helpers.Logger.Info($"Plugin {PluginInfo.PLUGIN_GUID} is loading...");

        LogSource = Logger;
        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey("com.fika.core");
        InteractableExfilsApiIsInstalled = Chainloader.PluginInfos.ContainsKey("Jehree.InteractableExfilsAPI");

        ExfilsTargetsService = new ExfilsTargetsService();

        if (FikaIsInstalled)
        {
            Helpers.Logger.Info($"Fika.Core plugin detected");
        }

        Settings.Config.Init(Config);
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
            Helpers.Logger.Info($"Jehree.InteractableExfilsAPI plugin detected");
            IEApiWrapper.Init(ExfilsTargetsService);
        }
    }
}
