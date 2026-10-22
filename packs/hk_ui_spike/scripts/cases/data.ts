import type { Player } from "@minecraft/server";
import { MARKER, TEX } from "../config";
import { tapLoop } from "../show";
import { SlotForm } from "../slot-form";

// `data`: the data-passing tricks on a plain 6×3 `grid` (indexes assigned by the grid, not
// pinned). 14 buttons for 18 cells, so the last 4 cells show what "past the end" looks like.
// The title carries the AB-AB probe for string subtraction; the layout also probes '%.Ns'.

const BUTTONS = 14;

export async function openData(player: Player): Promise<void> {
  await tapLoop(player, "data", () => {
    const form = new SlotForm(MARKER.data, "Data AB-AB", BUTTONS).body(
      "1 tomato: no count. 2 onion: 2. 3 carrot: 64. 4 potato: 99 (sent 150). 5: +1. " +
        "6: empty, not clickable. 7: locked silhouette + ?. 8: no icon. 9: long name. " +
        "10: translated name. 11: flame badge. 12: role a. 13: colour codes. 14: icon path with .png",
    );
    form
      .set(0, "s", 1, "Tomato (count 1 shows nothing)", TEX.tomato)
      .set(1, "s", 2, "Onion", TEX.onion)
      .set(2, "s", 64, { translate: "item.carrot.name" }, TEX.carrot)
      .set(3, "s", 150, { translate: "item.potato.name" }, TEX.potato)
      .set(4, "s", "+1", "Chopped Onion +1", TEX.choppedOnion)
      // index 5 stays empty
      .set(6, "l", "", "Locked: Tomato Soup", TEX.tomatoSoup)
      .set(7, "s", 3, "No icon at all")
      .set(
        8,
        "s",
        "",
        "A really long ingredient name that would never fit inside one small slot",
        TEX.cucumber,
      )
      .set(9, "s", "", { translate: "item.bowl.name" }, TEX.bowl)
      .set(10, "h", "", "Pot, needs fire", TEX.cookingPot)
      .set(11, "a", "", "Role a (active) in a plain slot", TEX.recipeBook)
      .set(12, "s", 5, "§cRed§r and §aGreen§r name", TEX.strawberry)
      .set(13, "s", "", "Icon path ends in .png", `${TEX.strawberryCake}.png`);
    return { form };
  });
}
