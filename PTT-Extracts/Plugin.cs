using BepInEx;
using EFT.Quests;
using SPT.Reflection.Patching;
using System.Reflection;
using System;
using PTTExtracts.Core;
using PTTExtracts.Patches;
using PTTExtracts.Utils;


namespace PTTExtracts
{
    [BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
    public class Plugin : BaseUnityPlugin
    {
        private void Awake()
        {
            new InitAllExfiltrationPointsPatch().Enable();
            new ScavExfiltrationPointPatch().Enable();
            Logger.LogInfo($"Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
        }

    }


}
