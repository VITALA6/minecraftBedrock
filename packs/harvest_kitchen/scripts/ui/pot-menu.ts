import type { Player } from "@minecraft/server";
import { ActionFormData, FormCancelationReason } from "@minecraft/server-ui";
import { POT_CAPACITY } from "../config";
import { COOKING_RECIPES } from "../data/recipes";
import { itemCount, itemName, list, t } from "../lib/text";
import {
  canCook,
  missingFor,
  startCooking,
  takeOutIngredients,
  totalItems,
  type PotResult,
} from "../stations/cooking";
import { readPot, type PotRef } from "../stations/pot-store";

// Display only. The form is built from a snapshot; whatever the player picks is re-validated by
// cooking.ts after the await, because the pot may have changed (or be gone) by then.

// Icons follow the texture layout: hk:<name> -> textures/hk/items/<name>.
function iconFor(typeId: string): string | undefined {
  const [namespace, name] = typeId.split(":");
  return namespace === "hk" && name ? `textures/hk/items/${name}` : undefined;
}

export async function openPotMenu(player: Player, pot: PotRef): Promise<void> {
  const state = readPot(pot);
  const total = totalItems(state);
  const contents = Object.entries(state.items).map(([id, n]) => itemCount(id, n));

  const form = new ActionFormData()
    .title(t("hk.ui.pot.title"))
    .body(
      total === 0
        ? t("hk.ui.pot.empty_hint")
        : t("hk.ui.pot.contents", total, POT_CAPACITY, list(contents)),
    );

  // One action per button, in the order the buttons are added (labels don't count).
  const actions: (() => PotResult)[] = [];
  const ready = COOKING_RECIPES.filter((recipe) => canCook(state, recipe));
  const others = COOKING_RECIPES.filter((recipe) => !canCook(state, recipe));

  if (ready.length > 0) {
    form.header(t("hk.ui.pot.can_cook"));
    for (const recipe of ready) {
      form.button(
        t("hk.ui.pot.cook_button", itemCount(recipe.result, recipe.count), recipe.seconds),
        iconFor(recipe.result),
      );
      actions.push(() => startCooking(player, pot, recipe.id));
    }
  }
  if (others.length > 0) {
    form.divider().header(t("hk.ui.pot.other_recipes"));
    for (const recipe of others) {
      const missing = missingFor(state, recipe).map(([id, n]) => itemCount(id, n));
      form.label(t("hk.ui.pot.needs", itemName(recipe.result), list(missing)));
    }
  }
  if (total > 0) {
    form.divider().button(t("hk.ui.pot.take_out"));
    actions.push(() => takeOutIngredients(player, pot));
  }

  const response = await form.show(player);
  if (!player.isValid) return;
  if (response.canceled) {
    if (response.cancelationReason === FormCancelationReason.UserBusy) {
      player.sendMessage(t("hk.ui.busy"));
    }
    return;
  }

  const action = response.selection === undefined ? undefined : actions[response.selection];
  if (action) player.onScreenDisplay.setActionBar(action().message);
}
