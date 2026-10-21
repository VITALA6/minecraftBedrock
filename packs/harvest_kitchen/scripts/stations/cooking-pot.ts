import type { BlockComponentRegistry, BlockCustomComponent } from "@minecraft/server";
import { FormRejectError, FormRejectReason } from "@minecraft/server-ui";
import { BLOCK_COOKING_POT, COMPONENT_COOKING_STATION } from "../config";
import { findCookingRecipe } from "../data/recipes";
import { getHeldItem } from "../lib/inventory";
import { itemName, t } from "../lib/text";
import { openPotMenu } from "../ui/pot-menu";
import { addIngredient, finishIfReady, potAt, secondsLeft, spillPot } from "./cooking";
import { clearPot, readPot } from "./pot-store";

// Interaction routing only; the rules are in cooking.ts.
//   cooking            -> action bar countdown (or finish now, if the sweep missed it)
//   holding an item    -> add one to the pot
//   empty hand         -> menu: contents, recipes, take out

const cookingStation: BlockCustomComponent = {
  onPlayerInteract({ block, dimension, player }) {
    if (!player) return;
    const pot = potAt(block);
    const state = readPot(pot);

    if (state.job) {
      if (secondsLeft(state) === 0 && finishIfReady(pot)) return;
      const recipe = findCookingRecipe(state.job.recipe);
      const dish = recipe ? itemName(recipe.result) : { text: "?" };
      player.onScreenDisplay.setActionBar(t("hk.ui.pot.cooking", dish, secondsLeft(state)));
      return;
    }

    const held = getHeldItem(player);
    if (held) {
      const result = addIngredient(player, pot, held.typeId);
      dimension.playSound(
        result.ok ? "block.decorated_pot.insert" : "block.decorated_pot.insert_fail",
        block.center(),
      );
      player.onScreenDisplay.setActionBar(result.message);
      return;
    }

    openPotMenu(player, pot).catch((error: unknown) => {
      if (error instanceof FormRejectError && error.reason === FormRejectReason.PlayerQuit) return;
      console.error(`[harvest_kitchen] pot menu failed: ${String(error)}`);
    });
  },

  // A pot placed where old data survived (the previous pot was removed by /setblock or /fill,
  // which fire no break event) starts empty instead of inheriting it. Permutation changes
  // (the cooking state) keep the same block type and are skipped.
  onPlace({ block, previousBlock }) {
    if (previousBlock.type.id === BLOCK_COOKING_POT) return;
    clearPot(potAt(block));
  },

  // Both hooks spill; spillPot clears the data first, so whichever runs second finds nothing.
  onPlayerBreak({ block }) {
    spillPot(potAt(block));
  },
  onBreak({ block }) {
    spillPot(potAt(block));
  },
};

export function registerCookingPot(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_COOKING_STATION, cookingStation);
}
