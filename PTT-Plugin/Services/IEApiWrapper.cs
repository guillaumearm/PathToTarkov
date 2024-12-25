using Comfort.Common;
using InteractableExfilsAPI;
using InteractableExfilsAPI.Singletons;
using PTT.Services;

static public class IEApiWrapper
{
    public static void Init(ExfilsTargetsService exfilsTargetsService)
    {
        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            var exfilPromptService = new ExfilPromptService(interactableExfilsService, exfilsTargetsService);
            exfilPromptService.InitPromptHandlers();
            Plugin.LogSource.LogInfo($"[PTT] Jehree's Interactable Exfils API: initialized exfils prompt service");
        }
        else
        {
            Plugin.LogSource.LogError($"[PTT] Jehree's Interactable Exfils API: not found");
        }
    }
}