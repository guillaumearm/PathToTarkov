using BepInEx;

namespace PTTExtracts
{
    [BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
    public class Plugin : BaseUnityPlugin
    {
        public void Awake()
        {
            new PTT.Extracts.InitAllExfiltrationPointsPatch().Enable();
            new PTT.Extracts.ScavExfiltrationPointPatch().Enable();

            Logger.LogInfo($"Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
        }
    }
}
