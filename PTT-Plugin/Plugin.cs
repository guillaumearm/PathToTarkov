using BepInEx;
using BepInEx.Logging;
using BepInEx.Bootstrap;
using Comfort.Common;
using InteractableExfilsAPI.Singletons;

using PTT.Services;

namespace PTT;

[BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
public class Plugin : BaseUnityPlugin
{
    public static bool FikaIsInstalled { get; private set; }
    public static ManualLogSource LogSource { get; private set; }
    public static ExfilsTargetsService ExfilsTargetsService;

    protected void Awake()
    {
        Logger.LogInfo($"[PTT] Plugin {PluginInfo.PLUGIN_GUID} is loading...");

        LogSource = Logger;
        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey("com.fika.core");
        ExfilsTargetsService = new ExfilsTargetsService();

        if (FikaIsInstalled)
        {
            Logger.LogInfo($"[PTT] Fika.Core detected");
        }

        Settings.Config.Init(Config);
        new Patches.HideLockedTraderCardPatch().Enable();
        new Patches.HideLockedTraderPanelPatch().Enable();
        new Patches.InitAllExfiltrationPointsPatch().Enable();
        new Patches.ScavExfiltrationPointPatch().Enable();
        new Patches.OnGameStartedPatch().Enable();
        new Patches.LocalRaidStartedPatch().Enable();

        Logger.LogInfo($"[PTT] Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
    }

    protected void Start()
    {

        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            var exfilPromptService = new ExfilPromptService(interactableExfilsService, ExfilsTargetsService);
            exfilPromptService.InitPromptHandlers();
            Logger.LogInfo($"[PTT] Jehree's Interactable Exfils API: initialized exfils prompt service");
        }
        else
        {
            Logger.LogError($"[PTT] Jehree's Interactable Exfils API: not found");
        }
    }
}
