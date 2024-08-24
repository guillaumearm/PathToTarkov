using BepInEx;
using PTT;
using PTT.Extracts;



namespace PTTExtracts
{
    [BepInPlugin(PluginInfo.PLUGIN_GUID, PluginInfo.PLUGIN_NAME, PluginInfo.PLUGIN_VERSION)]
    public class Plugin : BaseUnityPlugin
    {
        private void Awake()
        {
            new InitAllExfiltrationPointsPatch().Enable();
            new ScavExfiltrationPointPatch().Enable();
            new TraderLockPatch.LockOldTraderCards().Enable();
            new TraderLockPatch.LockNewTraderCards().Enable();
            Logger.LogInfo($"Plugin {PluginInfo.PLUGIN_GUID} is loaded!");
        }

    }


}
