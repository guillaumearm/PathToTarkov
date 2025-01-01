using Comfort.Common;
using InteractableExfilsAPI.Singletons;
using PTT.Helpers;
using PTT.Services;

static public class IEApiWrapper
{
    public static void Init()
    {
        InteractableExfilsService interactableExfilsService = Singleton<InteractableExfilsService>.Instance;

        if (interactableExfilsService != null)
        {
            new ExfilPromptService(interactableExfilsService).Init();
            Logger.Info($"Jehree's Interactable Exfils API: initialized exfils prompt service");
        }
        else
        {
            Logger.Error($"Jehree's Interactable Exfils API: not found");
        }
    }
}