using EFT.Interactive;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Linq;
using System.Collections.Generic;
using PTT.Data;

namespace PTT.Services;

public class ExfilPromptService(
    InteractableExfilsService ieService,
    ExfilsTargetsService exfilsTargetsService
)
{
    public void InitPromptHandlers()
    {
        // requires manual activation (no auto-extract)
        ieService.OnActionsAppliedEvent += RequiresManualActivation;

        // replace default ie api prompt logic
        ieService.OnActionsAppliedEvent -= ieService.ApplyExtractToggleAction;
        ieService.OnActionsAppliedEvent += ExfilPromptHandler;
    }

    private CustomExfilAction CreateCustomExfilAction(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        string customActionName = exfilTarget.GetCustomActionName();

        switch (exfilTarget.isTransit)
        {
            case true:
                return new CustomExfilAction(customActionName, false, () =>
                {
                    CustomExfilService.TransitTo(exfil, exfilTarget);
                });
            case false:
                return new CustomExfilAction(customActionName, false, () =>
                {
                    CustomExfilService.ExtractTo(exfil, exfilTarget);
                });
        }
    }

    private OnActionsAppliedResult ExfilPromptHandler(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        List<ExfilTarget> exfilTargets = exfilsTargetsService.ExfilsTargets.data[exfil.Settings.Name];

        if (exfilTargets == null || !exfilTargets.Any())
        {
            // no exfilTargets means the exfil is not available for the player (this is not an error)
            return null;
        }

        List<CustomExfilAction> actions = exfilTargets.Select(exfilTarget =>
        {
            return CreateCustomExfilAction(exfil, exfilTarget);
        }).ToList();

        return new OnActionsAppliedResult(actions);
    }

    private OnActionsAppliedResult RequiresManualActivation(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        // TODO: find out why it doesn't work as intended (in some cases) ?
        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }
}