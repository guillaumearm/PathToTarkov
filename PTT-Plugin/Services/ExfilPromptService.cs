using EFT.Interactive;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Linq;
using System.Collections.Generic;
using PTT.Data;
using PTT.Helpers;
using Comfort.Common;
using EFT.UI;
using System;
using System.Runtime.CompilerServices;

namespace PTT.Services;

public class ExfilPromptService(
    InteractableExfilsService ieService,
    ExfilsTargetsService exfilsTargetsService
)
{
    public void InitPromptHandlers()
    {
        // requires manual activation (no auto-extract even if the player enabled the IEAPI option in BepInEx)
        ieService.OnActionsAppliedEvent += RequiresManualActivation;

        // replace default ie api prompt logic
        ieService.OnActionsAppliedEvent -= ieService.ApplyExtractToggleAction;
        ieService.OnActionsAppliedEvent += ExfilPromptHandler;
    }

    private static void SelectFirstPromptItem()
    {
        var interactionState = InteractableExfilsService.GetAvailableInteractionState();

        if (interactionState.Value != null && interactionState.Value.Actions.Any())
        {
            ActionsTypesClass firstAction = interactionState.Value.Actions[0];
            interactionState.Value.SelectAction(firstAction);
        }
    }

    private Action _actionToExecuteOnConfirm;

    private void InitPromptState()
    {
        _actionToExecuteOnConfirm = null;
    }

    private void RunConfirm()
    {
        if (_actionToExecuteOnConfirm != null)
        {
            _actionToExecuteOnConfirm();
            _actionToExecuteOnConfirm = null;
        }
    }

    private void RunCancel()
    {
        InitPromptState();
        Sound.PlayMenuCancel();
        SelectFirstPromptItem();
    }

    private CustomExfilAction CreateCustomExfilAction(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        string customActionName = exfilTarget.GetCustomActionName();

        switch (exfilTarget.isTransit)
        {
            case true:
                return new CustomExfilAction(customActionName, false, () =>
                {
                    _actionToExecuteOnConfirm = () =>
                    {
                        Plugin.ExfilsTargetsService.SaveExfil(exfil, exfilTarget);
                        CustomExfilService.TransitTo(exfil, exfilTarget);
                        Sound.PlayTransitConfirm();
                    };
                    Sound.PlayMenuEnter();
                    SelectFirstPromptItem();
                });
            case false:
                return new CustomExfilAction(customActionName, false, () =>
                {
                    _actionToExecuteOnConfirm = () =>
                    {
                        Plugin.ExfilsTargetsService.SaveExfil(exfil, exfilTarget);
                        CustomExfilService.ExtractTo(exfil, exfilTarget);
                        Sound.PlayExtractConfirm();
                    };
                    Sound.PlayMenuEnter();
                    SelectFirstPromptItem();
                });
        }
    }

    private OnActionsAppliedResult ExfilPromptHandler(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        if (InteractableExfilsService.IsFirstRender())
        {
            InitPromptState();
        }

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

        // action selection step
        if (_actionToExecuteOnConfirm == null)
        {
            List<CustomExfilAction> actions = exfilTargets
                .Where(exfilTarget => exfilTarget.IsAvailable())
                .Select(exfilTarget => CreateCustomExfilAction(exfil, exfilTarget))
                .ToList();

            return new OnActionsAppliedResult(actions);
        }

        // confirmation step
        var confirmAction = new CustomExfilAction("confirm".Localized(), false, RunConfirm);
        var cancelAction = new CustomExfilAction("Cancel".Localized(), false, RunCancel);

        if (Settings.Config.ExfilAutoselectCancel.Value)
        {
            return new OnActionsAppliedResult([cancelAction, confirmAction]);
        }

        return new OnActionsAppliedResult([confirmAction, cancelAction]);
    }

    private OnActionsAppliedResult RequiresManualActivation(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        // compat with older version of Interactable Exfils API (< 1.4.0)
        if (customExfilTrigger == null)
        {
            return null;
        }

        // TODO: find out why it doesn't work as intended? (in some cases, when player enable/disable the bepinex setting manually)
        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }
}