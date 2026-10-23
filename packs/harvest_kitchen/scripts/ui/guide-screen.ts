import type { Player } from "@minecraft/server";
import { SOUND } from "../config";
import { foundCrops } from "../discovery/discovery";
import { HOME, buildPage, navigate, type GuideContext, type GuidePage } from "../guide/guide-model";
import { actionBar } from "../lib/feedback";
import { countInventory, isCreative } from "../lib/inventory";
import { itemName } from "../lib/text";
import { runForm, showBookPage } from "./book-form";

// The Kitchen Guide (D19): a book of pages drawn by our JSON UI (resource/ui/hk_guide/guide.json),
// opened by the hk:guide_book item (guide/guide-book.ts). The pages themselves are pure data
// (guide/guide-model.ts); this module reads the player's state for them, shows each page and
// follows the tapped slot: open a page, turn one (◀ ▶), Back, Home, a ribbon, or an action-bar
// hint that leaves the page open.

/** Read again for every page: discovery and the inventory change while the guide is open. */
function contextOf(player: Player): GuideContext {
  return {
    found: foundCrops(player),
    creative: isCreative(player),
    counts: countInventory(player),
    itemName,
  };
}

/** Shows the guide from Home. Each page is a new form; X or Esc closes the guide. */
async function showGuide(player: Player): Promise<void> {
  let stack: GuidePage[] = [HOME];
  player.playSound(SOUND.pageTurn);
  for (let guard = 0; guard < 200; guard++) {
    const page = stack[stack.length - 1] ?? HOME;
    const action = await showBookPage(player, buildPage(page, contextOf(player)));
    if (!player.isValid || action === undefined) return;
    if (typeof action === "object" && "hint" in action) {
      actionBar(player, action.hint);
      continue;
    }
    stack = navigate(stack, action);
    player.playSound(SOUND.pageTurn);
  }
}

export function openGuide(player: Player): void {
  runForm(showGuide(player), "kitchen guide");
}
