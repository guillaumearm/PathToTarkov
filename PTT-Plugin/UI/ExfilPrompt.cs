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
    private bool _exfiltrated = false; // when player extracted or transited
    private bool _voted = false; // when vote is confirmed
    private ExfilTarget _selectedExfilTarget = null; // used to check is auto-cancel vote is needed
    private Action _actionToExecuteOnConfirm = null;

    private void InitPromptState()
    {
        _exfiltrated = false;
        _voted = false;
        _selectedExfilTarget = null;
        _actionToExecuteOnConfirm = null;
    }

    private Action CreateRunConfirm()
    {
        return () =>
        {
            if (_actionToExecuteOnConfirm != null)
            {
                _actionToExecuteOnConfirm();
                _actionToExecuteOnConfirm = null;
                _voted = true;
            }
        };
    }

    private Action CreateRunCancel()
    {
        return () =>
        {
            CancelVote("Vote cancelled");
            InitPromptState();
            Sound.PlayMenuCancel();
            SelectFirstPromptItem();
        };
    }

    private CustomExfilAction CreateCustomExfilAction(ExfiltrationPoint exfil, ExfilTarget exfilTarget)
    {
        switch (exfilTarget.isTransit)
        {
            case true:
                bool isTransitDisabled = CustomExfilService.IsTransitDisabled(exfilTarget);
                string customTransitActionName = exfilTarget.GetCustomActionName(isTransitDisabled);

                return new CustomExfilAction(
                    customTransitActionName,
                    isTransitDisabled,
                    () =>
                    {
                        _actionToExecuteOnConfirm = () =>
                        {
                            CustomExfilService.TransitTo(exfilTarget, () =>
                            {
                                _exfiltrated = true;
                            });
                            Sound.PlayTransitConfirm();
                        };
                        Sound.PlayMenuEnter();
                        SelectFirstPromptItem();
                    });
            case false:
                bool isExtractDisabled = false;
                string customExtractActionName = exfilTarget.GetCustomActionName(isExtractDisabled);

                return new CustomExfilAction(
                    customExtractActionName,
                    isExtractDisabled,
                    () =>
                    {
                        _actionToExecuteOnConfirm = () =>
                        {
                            CustomExfilService.ExtractTo(exfil, exfilTarget);
                            _exfiltrated = true;
                            Sound.PlayExtractConfirm();
                        };
                        Sound.PlayMenuEnter();
                        SelectFirstPromptItem();
                    });
        }
    }

    private void CancelVote(string cancelMessage)
    {
        _voted = false;
        _selectedExfilTarget = null;
        CustomExfilService.CancelTransitVote(cancelMessage);
    }

    private void OnExitZone()
    {
        if (!_exfiltrated) // we need to check if the player is not exfiltrated because OnExitZone will be call on exfil
        {
            InitPromptState();

            if (_voted)
            {
                CancelVote("Vote cancelled (zone exited)");
            }
        }
    }

    public OnActionsAppliedResult Render()
    {
        if (_exfiltrated)
        {
            return null;
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

        // 1. action selection step
        if (!_voted && _actionToExecuteOnConfirm == null)
        {
            List<CustomExfilAction> actions = exfilTargets
                .Where(exfilTarget => exfilTarget.IsAvailable())
                .Select(exfilTarget => CreateCustomExfilAction(Exfil, exfilTarget))
                .ToList();

            return new OnActionsAppliedResult(actions, OnExitZone);
        }

        var cancelAction = new CustomExfilAction("Cancel".Localized(), false, CreateRunCancel());

        // auto-cancel the vote when needed
        if (_voted && _selectedExfilTarget != null && CustomExfilService.IsTransitDisabled(_selectedExfilTarget))
        {
            CancelVote("Vote cancelled because selected exfil transit don't match with the others");
            InitPromptState();
        }

        // 3. confirmation step
        if (!_voted)
        {
            var confirmAction = new CustomExfilAction("confirm".Localized(), false, CreateRunConfirm());

            List<CustomExfilAction> actions = Settings.Config.ExfilAutoselectCancel.Value
                ? [cancelAction, confirmAction]
                : [confirmAction, cancelAction];

            return new OnActionsAppliedResult(actions, OnExitZone);
        }

        // 3. cancellation step
        return new OnActionsAppliedResult([cancelAction], OnExitZone);
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