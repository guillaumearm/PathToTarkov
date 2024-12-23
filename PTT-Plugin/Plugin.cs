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

    protected void Awake()
    {
        LogSource = Logger;
        Logger.LogInfo($"[PTT] Plugin {PluginInfo.PLUGIN_GUID} is loading...");

        FikaIsInstalled = Chainloader.PluginInfos.ContainsKey("com.fika.core");

        Settings.Config.Init(Config);
        Singleton<ExfilsTargetsService>.Create(new ExfilsTargetsService());

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
        var exfilsTargetsService = Singleton<ExfilsTargetsService>.Instance;
        if (interactableExfilsService != null)
        {
            var exfilPromptService = new ExfilPromptService(interactableExfilsService, exfilsTargetsService);
            exfilPromptService.InitPromptHandlers();
            Logger.LogInfo($"[PTT] Interactable Exfils API: initialized exfils prompt handlers");
        }
        else
        {
            Logger.LogError($"[PTT] Interactable exfils API: not found");
        }
    }
}
