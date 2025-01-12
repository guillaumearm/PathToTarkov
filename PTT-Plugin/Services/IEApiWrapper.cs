using Comfort.Common;
using InteractableExfilsAPI.Singletons;
using PTT.Helpers;
using PTT.Services;

static internal class IEApiWrapper
{
    public static ExfilPromptService ExfilPromptService;

    public static void Init()
    {
        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            ExfilPromptService = new ExfilPromptService(interactableExfilsService);
            ExfilPromptService.Init();
            Logger.Info($"Jehree's Interactable Exfils API: initialized exfils prompt service");
        }
        else
        {
            Logger.Error($"Jehree's Interactable Exfils API: not found");
        }
    }
}