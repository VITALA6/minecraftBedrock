import type { Player } from "@minecraft/server";
import { UI_ICONS, itemIcon } from "../data/icons";
import { ingredientName, itemName, t } from "../lib/text";
import {
  closestRecipe,
  phaseOf,
  possibleRecipes,
  startCooking,
  takeOut,
} from "../stations/station-engine";
import { readStation, type StationRef } from "../stations/station-store";
import { Menu, runForm } from "./menu";
import { bookPage, showBook } from "./recipe-book";

// The pot screen (plan §2.4), only when there's a choice. Titled with the station name, no body.
// Sections appear only when they have something, top to bottom, so the next step is always the
// first button:
//   Cook        one button per dish possible right now         -> starts cooking (re-validated)
//   Almost!     only when nothing is possible: the closest
//               recipe's first missing item, "+1 Onion"         -> the book on that dish
//   In the pot  one button per ingredient type, "×2 Tomato"     -> takes it out; screen reopens
//   Recipe Book                                                 -> the book on this station
// "Take all out" isn't a button: it's sneak + empty hand on the pot (§2.3).

type Next = "reopen" | "done" | (() => Promise<void>);

async function show(player: Player, ref: StationRef): Promise<void> {
  for (let i = 0; i < 32; i++) {
    const state = readStation(ref);
    const phase = phaseOf(ref.station, state);
    if (phase === "cooking" || phase === "done") return; // someone else moved on

    const menu = new Menu<Next>(t(ref.station.nameKey));
    const possible = possibleRecipes(ref.station, state);
    if (possible.length > 0) {
      menu.header(t("hk.pot.cook"));
      for (const recipe of possible) {
        menu.button(t("hk.ui.text", itemName(recipe.result)), itemIcon(recipe.result), () => {
          startCooking(player, ref, recipe.id);
          return "done";
        });
      }
    } else {
      const closest = closestRecipe(ref.station, state);
      const first = closest?.missing[0];
      if (closest && first) {
        menu.header(t("hk.pot.almost"));
        menu.button(
          t("hk.pot.almost_button", first.missing, ingredientName(first.ingredient)),
          itemIcon(first.ingredient.items[0] ?? ""),
          () => () => showBook(player, bookPage.dish(closest.recipe.result)),
        );
      }
    }

    const contents = Object.entries(state.items);
    if (contents.length > 0) {
      menu.header(t("hk.pot.in_pot"));
      for (const [id, count] of contents) {
        menu.button(t("hk.pot.in_pot_button", count, itemName(id)), itemIcon(id), () =>
          takeOut(player, ref, id) ? "reopen" : "done",
        );
      }
    }

    menu
      .divider()
      .button(
        t("hk.book.title"),
        UI_ICONS.book,
        () => () => showBook(player, bookPage.station(ref.station.id)),
      );

    const next = await menu.show(player);
    if (next === undefined || next === "done") return;
    if (next !== "reopen") return next();
  }
}

export function openPotScreen(player: Player, ref: StationRef): void {
  runForm(show(player, ref), "pot screen");
}
