using Comfort.Common;
using InteractableExfilsAPI;
using InteractableExfilsAPI.Singletons;
using PTT.Helpers;
using PTT.Services;

static public class IEApiWrapper
{
    public static void Init(ExfilsTargetsService exfilsTargetsService)
    {
        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            interactableExfilsService.DisableVanillaActions = true;
            var exfilPromptService = new ExfilPromptService(interactableExfilsService, exfilsTargetsService);
            exfilPromptService.InitPromptHandlers();
            Logger.Info($"Jehree's Interactable Exfils API: initialized exfils prompt service");
        }
        else
        {
            Logger.Error($"Jehree's Interactable Exfils API: not found");
        }
    }
}