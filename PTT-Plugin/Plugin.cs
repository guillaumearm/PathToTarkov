using System;
using BepInEx;
using Comfort.Common;
using InteractableExfilsAPI.Singletons;

namespace PTT;

[BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
public class Plugin : BaseUnityPlugin
{
    protected void Awake()
    {
        Settings.Config.Init(Config);

        new Patches.HideLockedTraderCardPatch().Enable();
        new Patches.HideLockedTraderPanelPatch().Enable();
        new Patches.InitAllExfiltrationPointsPatch().Enable();
        new Patches.ScavExfiltrationPointPatch().Enable();

        Logger.LogInfo($"[PTT] Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
    }

    protected void Start()
    {
        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            interactableExfilsService.OnActionsAppliedEvent += Examples.SimpleExample;
            interactableExfilsService.OnActionsAppliedEvent += Examples.RequiresManualActivation;
            interactableExfilsService.OnActionsAppliedEvent -= interactableExfilsService.ApplyExtractToggleAction;

            Logger.LogInfo($"[PTT] Interactable Exfils API: added custom actions");
        }
        else
        {
            Logger.LogError($"[PTT] Interactable exfils API not found");
        }

    }
}
