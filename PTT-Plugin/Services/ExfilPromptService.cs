using System.Collections.Generic;
using EFT.Interactive;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using PTT.Helpers;
using PTT.UI;

namespace PTT.Services;

internal class ExfilPromptService(InteractableExfilsService ieService)
{

    private Dictionary<string, ExfilPrompt> IndexedExfilPrompts = [];

    public void Init()
    {
        ieService.DisableVanillaActions = true;
        InitPromptHandlers();
    }

    private void InitPromptHandlers()
    {
        // requires manual activation (no auto-extract even if the player enabled the IEAPI option in BepInEx)
        ieService.OnActionsAppliedEvent += RequiresManualActivation;

        // replace default ie api prompt logic
        ieService.OnActionsAppliedEvent -= ieService.ApplyExtractToggleAction;
        ieService.OnActionsAppliedEvent += ExfilPromptHandler;
    }

    private OnActionsAppliedResult RequiresManualActivation(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        // avoid crash with older version of Interactable Exfils API (< 1.4.0)
        if (customExfilTrigger == null)
        {
            return null;
        }

        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }

    private OnActionsAppliedResult ExfilPromptHandler(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        if (exfil == null)
        {
            Logger.Error("ExfilPromptHandler: ExfiltrationPoint is null");
            return null;
        }

        if (exfil.Settings == null)
        {
            Logger.Error("ExfilPromptHandler: ExfiltrationPoint.Settings is null");
            return null;
        }

        if (exfil.Settings.Name == null)
        {
            Logger.Error("ExfilPromptHandler: ExfiltrationPoint.Settings.Name is null");
            return null;
        }

        string exitName = exfil.Settings.Name;
        if (IndexedExfilPrompts.TryGetValue(exitName, out ExfilPrompt existingExfilPrompt))
        {
            return existingExfilPrompt.Render();
        }

        var exfilPrompt = new ExfilPrompt(exfil);
        IndexedExfilPrompts[exitName] = exfilPrompt;

        return exfilPrompt.Render();
    }
}