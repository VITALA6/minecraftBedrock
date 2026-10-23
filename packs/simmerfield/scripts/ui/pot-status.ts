import { itemIcon } from "../data/icons";
import type { ContainerStation } from "../data/stations";
import { choiceOf, type StationState } from "../stations/station-logic";

// What the pot's choice form shows (D15), as pure functions. The pot has a form only when two or
// more dishes are possible right now: one button per dish, with the dish's icon. Everything else
// is in the world: the ghosts above the pot show what's missing, one dish cooks without a form,
// and sneak + empty hand takes everything out. No @minecraft import; ui/pot-screen.ts shows it.

export interface PotChoice {
  /** Station recipe id, passed to startCooking (which re-validates). */
  readonly recipe: string;
  /** The dish item: the button label is its name. */
  readonly result: string;
  /** ActionFormData button icon (texture path without extension); undefined if none is known. */
  readonly icon?: string;
}

/** The buttons, in recipe order; empty when the form shouldn't open (or should not apply any more). */
export function potChoices(station: ContainerStation, state: StationState): PotChoice[] {
  return choiceOf(station, state).map((recipe) => ({
    recipe: recipe.id,
    result: recipe.result,
    icon: itemIcon(recipe.result),
  }));
}
