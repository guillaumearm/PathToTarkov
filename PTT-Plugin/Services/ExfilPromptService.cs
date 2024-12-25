using EFT.Interactive;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Linq;
using System.Collections.Generic;
using PTT.Data;
using PTT.Helpers;

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
        var indexedExfilsTargets = exfilsTargetsService.ExfilsTargets.data;

        if (!indexedExfilsTargets.TryGetValue(exitName, out List<ExfilTarget> exfilTargets))
        {
            Logger.Warning($"cannot retrieve exfil targets for exfil '{exitName}'");
            return null;
        }

        if (exfilTargets == null || !exfilTargets.Any())
        {
            // no exfilTargets means the exfil is not available for the player (this is not supposed to be an error)
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
        // TODO: find out why it doesn't work as intended? (in some cases, when player enable/disable the bepinex setting manually)
        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }
}