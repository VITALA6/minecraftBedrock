import type { Player } from "@minecraft/server";
import { BOOK, MARKER, TEX } from "../config";
import { tapLoop } from "../show";
import { SlotForm } from "../slot-form";
import type { Role } from "../slot-label";

// `book`: the two-page spread. Three pages so ◀ ▶ can be tested, including the "no page here"
// (empty) state on the first and last page. Page 3 is a locked dish.

interface Ingredient {
  role: Role;
  count: number;
  text: string | { translate: string };
  icon: string;
}

interface Page {
  title: string;
  body: string;
  dish: { role: Role; icon: string; text: string };
  station: { role: Role; icon: string; text: string };
  grid: (Ingredient | undefined)[];
}

const PAGES: Page[] = [
  {
    title: "Tomato Soup",
    body: "Warm and red. Heals a little.",
    dish: { role: "s", icon: TEX.tomatoSoup, text: "Tomato Soup" },
    station: { role: "h", icon: TEX.cookingPot, text: "Pot, needs fire below" },
    grid: [
      { role: "s", count: 2, text: "Tomato", icon: TEX.tomato },
      { role: "s", count: 1, text: { translate: "item.bowl.name" }, icon: TEX.bowl },
    ],
  },
  {
    title: "Vegetable Stew",
    body: "Big and filling.",
    dish: { role: "s", icon: TEX.vegetableStew, text: "Vegetable Stew" },
    station: { role: "h", icon: TEX.cookingPot, text: "Pot, needs fire below" },
    grid: [
      { role: "s", count: 1, text: "Tomato", icon: TEX.tomato },
      { role: "s", count: 1, text: "Onion", icon: TEX.onion },
      { role: "s", count: 1, text: { translate: "item.carrot.name" }, icon: TEX.carrot },
      undefined,
      { role: "s", count: 1, text: { translate: "item.potato.name" }, icon: TEX.potato },
      undefined,
      undefined,
      { role: "s", count: 1, text: { translate: "item.bowl.name" }, icon: TEX.bowl },
    ],
  },
  {
    title: "???",
    body: "Find strawberries to unlock.",
    dish: { role: "l", icon: TEX.strawberryCake, text: "Locked dish" },
    station: { role: "s", icon: TEX.craftingTable, text: "Crafting Table" },
    grid: [
      { role: "l", count: 3, text: "??? (grows near flowers)", icon: TEX.strawberry },
      { role: "s", count: 1, text: "Milk", icon: TEX.milk },
      { role: "l", count: 3, text: "??? (grows near flowers)", icon: TEX.strawberry },
      { role: "s", count: 1, text: "Sugar", icon: TEX.sugar },
      { role: "s", count: 1, text: "Egg", icon: TEX.egg },
      { role: "s", count: 1, text: "Sugar", icon: TEX.sugar },
      { role: "s", count: 3, text: "Wheat", icon: TEX.wheat },
    ],
  },
];

const TABS: [string, string][] = [
  ["Pot", TEX.cookingPot],
  ["Board", TEX.cuttingBoard],
  ["Crafting", TEX.craftingTable],
  ["Crops", TEX.chapterCrops],
  ["What can I make?", TEX.chapterMake],
];

function bookPage(index: number): SlotForm {
  const page = PAGES[index] ?? PAGES[0]!;
  const form = new SlotForm(MARKER.book, page.title, BOOK.size).body(page.body);
  page.grid.forEach((ing, i) => {
    const slot = BOOK.grid[i];
    if (ing && slot !== undefined) form.set(slot, ing.role, ing.count, ing.text, ing.icon);
  });
  form.set(BOOK.result, page.dish.role, "", page.dish.text, page.dish.icon);
  if (index > 0) form.set(BOOK.prev, "s", "", "Previous page");
  if (index < PAGES.length - 1) form.set(BOOK.next, "s", "", "Next page");
  form.set(BOOK.home, "s", "", "Back");
  form.set(BOOK.station, page.station.role, "", page.station.text, page.station.icon);
  form.set(BOOK.family, "s", "", "Heal family", TEX.familyHeal);
  form.set(BOOK.effect, "s", "8s", { translate: "potion.regeneration" }, TEX.regeneration);
  TABS.forEach(([text, icon], i) => {
    const slot = BOOK.tabs[i];
    if (slot !== undefined) form.set(slot, i === 0 ? "a" : "s", "", text, icon);
  });
  return form;
}

export async function openBook(player: Player): Promise<void> {
  let page = 0;
  await tapLoop(player, "book", () => ({
    form: bookPage(page),
    onTap: (index) => {
      if (index === BOOK.prev) page = Math.max(0, page - 1);
      else if (index === BOOK.next) page = Math.min(PAGES.length - 1, page + 1);
      else if (index === BOOK.home) page = 0;
    },
  }));
}
