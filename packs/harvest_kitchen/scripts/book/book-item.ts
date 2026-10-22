import {
  Player,
  system,
  type ItemComponentRegistry,
  type ItemCustomComponent,
} from "@minecraft/server";
import { BOOK_OPEN_GAP_TICKS, COMPONENT_RECIPE_BOOK } from "../config";
import { TickGate } from "../lib/tick-gate";
import { openBook } from "../ui/recipe-book";

// hk:recipe_book: using the item opens the book on its Home page (plan §3).
//
// onUse is "used by a player"; onUseOn is "used on a block", which is how a child holds it
// (looking at the ground). Both open the book. If one click fires both, the gate opens it once
// (a second show() while the first form is up would only say "Close chat"). Interactable blocks
// (pot, board, crops, chests) still take the click before the item does.

const opened = new TickGate(BOOK_OPEN_GAP_TICKS);

function open(player: Player): void {
  if (!opened.pass(player.id, system.currentTick)) return;
  // Forms can't open in restricted execution; deferring a tick is safe either way.
  system.run(() => {
    if (player.isValid) openBook(player);
  });
}

const recipeBook: ItemCustomComponent = {
  onUse({ source }) {
    open(source);
  },
  onUseOn({ source }) {
    if (source instanceof Player) open(source);
  },
};

export function registerRecipeBook(registry: ItemComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_RECIPE_BOOK, recipeBook);
}
