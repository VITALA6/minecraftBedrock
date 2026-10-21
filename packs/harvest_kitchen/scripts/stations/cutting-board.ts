import type { BlockComponentRegistry, BlockCustomComponent } from "@minecraft/server";
import { COMPONENT_CUTTING_STATION } from "../config";
import { CUTTING_RECIPES, findCuttingRecipe } from "../data/recipes";
import { consumeHeldItem, getHeldItem, giveOrDrop } from "../lib/inventory";
import { itemName, list, t } from "../lib/text";

// Use the board while holding a cuttable item: one is consumed, the output goes to the
// inventory (or drops on the board if the inventory is full). Station inputs are consumed in
// creative too, like a crafting table.

const cuttingStation: BlockCustomComponent = {
  onPlayerInteract({ block, dimension, player }) {
    if (!player) return;
    const held = getHeldItem(player);
    const recipe = held && findCuttingRecipe(held.typeId);
    if (!recipe) {
      const inputs = CUTTING_RECIPES.map((r) => itemName(r.input));
      player.onScreenDisplay.setActionBar(t("hk.ui.board.hint", list(inputs)));
      return;
    }
    if (!consumeHeldItem(player, recipe.input)) return;

    const top = { ...block.center(), y: block.location.y + 0.25 };
    giveOrDrop(player, recipe.output, recipe.count, dimension, top);
    dimension.playSound("hit.wood", top, { pitch: 1.2 });
    dimension.playSound("mob.slime.squish", top, { volume: 0.4, pitch: 1.6 });
    dimension.spawnParticle("minecraft:villager_happy", top);
  },
};

export function registerCuttingBoard(registry: BlockComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_CUTTING_STATION, cuttingStation);
}
