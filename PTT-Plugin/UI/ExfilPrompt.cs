using EFT.Interactive;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Linq;
using System.Collections.Generic;
using PTT.Data;
using PTT.Helpers;
using System;
using PTT.Services;

namespace PTT.UI;

public class ExfilPrompt(ExfiltrationPoint Exfil)
{
    private Action _actionToExecuteOnConfirm = null;

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
                        CustomExfilService.ExtractTo(exfil, exfilTarget);
                        Sound.PlayExtractConfirm();
                    };
                    Sound.PlayMenuEnter();
                    SelectFirstPromptItem();
                });
        }
    }

    public OnActionsAppliedResult Render()
    {
        if (InteractableExfilsService.IsFirstRender())
        {
            InitPromptState();
        }

        string exitName = Exfil.Settings.Name;
        if (!Plugin.ExfilsTargetsService.ExfilsTargets.data.TryGetValue(exitName, out List<ExfilTarget> exfilTargets))
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
                .Select(exfilTarget => CreateCustomExfilAction(Exfil, exfilTarget))
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

    private static void SelectFirstPromptItem()
    {
        var interactionState = InteractableExfilsService.GetAvailableInteractionState();

        if (interactionState.Value != null && interactionState.Value.Actions.Any())
        {
            ActionsTypesClass firstAction = interactionState.Value.Actions[0];
            interactionState.Value.SelectAction(firstAction);
        }
    }
}