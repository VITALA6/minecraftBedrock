import {
  Player,
  system,
  type ItemComponentRegistry,
  type ItemCustomComponent,
} from "@minecraft/server";
import {
  COMPONENT_GUIDE_BOOK,
  GUIDE_OPEN_GAP_TICKS,
  ITEM_GUIDE_BOOK,
  PLAYER_GUIDE_BOOK_GIVEN,
} from "../config";
import { giveOrDrop } from "../lib/inventory";
import { TickGate } from "../lib/tick-gate";
import { openGuide } from "../ui/guide-screen";

// hk:guide_book, the Kitchen Guide (D19): using the item opens the guide (ui/guide-screen.ts).
// One is handed out on a player's first join, next to the starter poster; a lost one is crafted
// from a book + a carrot.
//
// onUse is "used by a player"; onUseOn is "used on a block", which is how a child holds it
// (looking at the ground). Both open the guide. If one click fires both, the gate opens it once
// (a second show() while the first form is up would only say "Close chat"). Interactable blocks
// (pot, board, crops, chests) still take the click before the item does.

const opened = new TickGate(GUIDE_OPEN_GAP_TICKS);

function open(player: Player): void {
  if (!opened.pass(player.id, system.currentTick)) return;
  // Forms can't open in restricted execution; deferring a tick is safe either way.
  system.run(() => {
    if (player.isValid) openGuide(player);
  });
}

const guideBook: ItemCustomComponent = {
  onUse({ source }) {
    open(source);
  },
  onUseOn({ source }) {
    if (source instanceof Player) open(source);
  },
};

export function registerGuideBook(registry: ItemComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_GUIDE_BOOK, guideBook);
}

/** The Kitchen Guide, once per player (players from before the guide get one too). Initial spawn. */
export function giveGuideBookOnce(player: Player): void {
  try {
    if (player.getDynamicProperty(PLAYER_GUIDE_BOOK_GIVEN) === true) return;
    player.setDynamicProperty(PLAYER_GUIDE_BOOK_GIVEN, true);
    giveOrDrop(player, ITEM_GUIDE_BOOK, 1, player.dimension, player.location);
  } catch (error) {
    console.warn(`[harvest_kitchen] Kitchen Guide for ${player.name}: ${String(error)}`);
  }
}
