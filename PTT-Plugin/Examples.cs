using Comfort.Common;
using BepInEx;
using EFT.Interactive;
using EFT;
using InteractableExfilsAPI.Components;
using InteractableExfilsAPI.Singletons;
using InteractableExfilsAPI.Common;
using System.Collections.Generic;
using System;
using System.Linq;

namespace PTT;

public class Examples
{
    public static OnActionsAppliedResult SimpleExample(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        if (!exfilIsAvailableToPlayer)
        {
            return null;
        }

        return new OnActionsAppliedResult(new CustomExfilAction(
            "Escape!",
            false,
            () =>
            {
                customExfilTrigger.ToggleExfilZoneEnabled();
            }
        ));
    }

    public static OnActionsAppliedResult RequiresManualActivation(ExfiltrationPoint exfil, CustomExfilTrigger customExfilTrigger, bool exfilIsAvailableToPlayer)
    {
        customExfilTrigger.RequiresManualActivation = true;
        return null;
    }
}