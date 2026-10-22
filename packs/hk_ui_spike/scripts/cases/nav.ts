import type { Player } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { BOOK, MARKER, TEX } from "../config";
import { report, showWhenFree, tapLoop } from "../show";
import { SlotForm } from "../slot-form";
import { emptyLabel, slotLabel } from "../slot-label";

// `nav`: the book layout with every slot alive and labelled by its index. Tap each slot; chat
// must say the same number as the slot's tooltip (PC) and as the map in config.ts BOOK.
//
// `shift`: the same 21 buttons, but with a label() before button 0 and a divider() after
// button 4. Those take places in the `form_buttons` collection too, so the layout is expected to
// draw everything shifted; chat shows what `selection` really returns.

const ICONS = [
  TEX.tomato,
  TEX.onion,
  TEX.cucumber,
  TEX.strawberry,
  TEX.carrot,
  TEX.potato,
  TEX.bowl,
  TEX.choppedOnion,
  TEX.slicedTomato,
  TEX.tomatoSoup,
];

function slotName(index: number): string {
  for (const [name, value] of Object.entries(BOOK)) {
    if (value === index) return name;
    if (Array.isArray(value) && value.includes(index)) return `${name}[${value.indexOf(index)}]`;
  }
  return "?";
}

export async function openNav(player: Player): Promise<void> {
  await tapLoop(player, "nav", () => {
    const form = new SlotForm(MARKER.book, "Index map", BOOK.size).body(
      "Every slot is button #N. Tap them all.",
    );
    for (let i = 0; i < BOOK.size; i++) {
      form.set(i, "s", String(i), `#${i} ${slotName(i)}`, ICONS[i % ICONS.length]);
    }
    return { form };
  });
}

export async function openShift(player: Player): Promise<void> {
  const form = new ActionFormData()
    .title({ rawtext: [{ text: MARKER.book }, { text: "Shift test" }] })
    .body("A label before #0 and a divider after #4.")
    .label("s  this is a label()");
  for (let i = 0; i < BOOK.size; i++) {
    if (i === 5) form.divider();
    if (i === BOOK.prev || i === BOOK.next || i === BOOK.home) {
      form.button(slotLabel("s", "", `#${i} ${slotName(i)}`));
    } else if (i === BOOK.grid[8]) {
      form.button(emptyLabel());
    } else {
      form.button(slotLabel("s", String(i), `#${i} ${slotName(i)}`), ICONS[i % ICONS.length]);
    }
  }
  const response = await showWhenFree(player, () => form.show(player));
  if (!response) return;
  if (response.canceled || response.selection === undefined) {
    report(player, "shift", `closed (${response.cancelationReason ?? "no selection"})`);
    return;
  }
  report(
    player,
    "shift",
    `selection §e#${response.selection}§r (button #${response.selection} = ${slotName(response.selection)})`,
  );
}
