import { system, type Player } from "@minecraft/server";
import {
  ActionFormData,
  FormCancelationReason,
  FormRejectError,
  FormRejectReason,
} from "@minecraft/server-ui";
import { POT_FORM_PRESS_GAP_TICKS } from "../config";
import { itemName, t } from "../lib/text";
import { PressGate } from "../lib/tick-gate";
import { noHeat, startCooking, stationHot } from "../stations/station-engine";
import { readStation, type StationRef } from "../stations/station-store";
import { potChoices } from "./pot-status";

// The pot's only form (D15): when two or more dishes are possible, empty hand + use asks which one.
// An ActionFormData titled with the station's name, one button per dish (its icon + "Cook <dish>"),
// no body and no Close button (the form's own X closes it). Up to ~3 dishes fit without scrolling;
// a pot of 8 items rarely allows more.
//
// The form is a snapshot: a tap goes through startCooking, which re-validates against the pot as it
// is now and says why if it can't ("It changed", "Needs fire below").
//
// One form per press: if the game repeats the interaction while use is held (B13), the repeats
// that arrive before the form is up would each ask for another form, which the game refuses with
// "busy" (and a chat line). The press gate drops them.

const presses = new PressGate(POT_FORM_PRESS_GAP_TICKS);

async function choose(player: Player, ref: StationRef): Promise<void> {
  const choices = potChoices(ref.station, readStation(ref));
  if (choices.length === 0) return; // someone changed the pot since the use
  if (!stationHot(ref)) return noHeat(player, ref); // nothing to choose for: it can't cook anyway

  const form = new ActionFormData().title(t(ref.station.nameKey));
  for (const choice of choices) form.button(t("hk.pot.cook", itemName(choice.result)), choice.icon);
  const response = await form.show(player);
  if (!player.isValid) return;
  if (response.canceled) {
    if (response.cancelationReason === FormCancelationReason.UserBusy) {
      player.sendMessage(t("hk.ui.busy"));
    }
    return;
  }
  const picked = response.selection === undefined ? undefined : choices[response.selection];
  if (picked) startCooking(player, ref, picked.recipe);
}

/** Opens the choice form next tick (forms can't be shown in restricted execution). */
export function openPotScreen(player: Player, ref: StationRef): void {
  if (!presses.press(player.id, system.currentTick)) return;
  system.run(() => {
    if (!player.isValid) return;
    choose(player, ref).catch((error: unknown) => {
      if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
      console.error(`[harvest_kitchen] pot screen failed: ${String(error)}`);
    });
  });
}
