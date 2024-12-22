using EFT.Interactive;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Linq;
using BepInEx.Logging;
using System.Collections.Generic;

namespace PTT.Services;

public class ExfilPromptService(
    ManualLogSource Logger,
    InteractableExfilsService ieService,
    ExfilsTargetsService exfilsTargetsService
)
{
    public void InitPromptHandlers()
    {
        // requires manual activation (no auto-extract)
        ieService.OnActionsAppliedEvent += RequiresManualActivation;

        // replace prompt logic
        ieService.OnActionsAppliedEvent -= ieService.ApplyExtractToggleAction;
        ieService.OnActionsAppliedEvent += ExfilPromptHandler;
    }

    private OnActionsAppliedResult ExfilPromptHandler(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        var exfilTargets = exfilsTargetsService.ExfilsTargets.data[exfil.Settings.Name];

        if (exfilTargets == null || !exfilTargets.Any())
        {
            return null;
        }


        Logger.LogInfo($"[PTT] exfil.Settings.Name = {exfil.Settings.Name}");

        List<CustomExfilAction> actions = [];

        exfilTargets.ForEach(exfilTarget =>
        {
            // TODO: refactor createPromptActionForExfilTarget
            if (exfilTarget.isTransit)
            {
                // TODO: i18n support with custom transit displayName
                string actionName = $"Transit to {exfilTarget.transitMapId}";
                string customExfilName = $"{exfil.Settings.Name}.{exfilTarget.transitMapId}.{exfilTarget.transitSpawnPointId}";

                var transitAction = new CustomExfilAction(actionName, false, () =>
                {
                    bool successfullyTransited = CustomExfilService.TransitTo(exfilTarget.transitMapId, exfil.Settings.Name, customExfilName);

                    if (successfullyTransited)
                    {
                        Logger.LogInfo("[PTT] successfully transited");
                    }
                    else
                    {
                        Logger.LogError("[PTT] cannot transit");
                    }
                });

                actions.Add(transitAction);
            }
            else
            {
                // TODO: i18n support (use the offraid position displayName)
                string actionName = $"Extract to {exfilTarget.offraidPosition}";
                string customExfilName = $"{exfil.Settings.Name}.{exfilTarget.offraidPosition}";

                var escapeAction = new CustomExfilAction(actionName, false, () =>
                {
                    Logger.LogInfo("[PTT] escape action triggered!");

                    // TODO: uncomment this
                    // exfil.Settings.Name = customExfilName;

                    bool successfullyExtracted = CustomExfilService.ExtractTo(exfil, customExfilName);

                    if (successfullyExtracted)
                    {
                        Logger.LogInfo("[PTT] successfully extracted");
                    }
                    else
                    {
                        Logger.LogError("[PTT] cannot extract");
                    }
                });

                actions.Add(escapeAction);
            }

        });
        return new OnActionsAppliedResult(actions);
    }

    private OnActionsAppliedResult RequiresManualActivation(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        // TODO: find out why it doesn't work as intended (in some cases) ?
        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }
}