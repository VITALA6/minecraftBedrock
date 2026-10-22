import type { Player } from "@minecraft/server";
import { MARKER, POT, TEX } from "../config";
import { tapLoop } from "../show";
import { SlotForm } from "../slot-form";

// `pot`: the pot screen. Taps change the state, and the form is re-sent, to show that the layout
// redraws from fresh data each time: the heat slot toggles fire on and off, a contents slot takes
// that stack out, and Cook is empty (not clickable) without fire or ingredients.

interface Stack {
  text: string;
  icon: string;
  count: number;
}

export async function openPot(player: Player, startCold: boolean): Promise<void> {
  let hot = !startCold;
  const contents: (Stack | undefined)[] = [
    { text: "Tomato", icon: TEX.tomato, count: 2 },
    { text: "Bowl", icon: TEX.bowl, count: 1 },
    { text: "Onion", icon: TEX.onion, count: 1 },
    { text: "Strawberry", icon: TEX.strawberry, count: 12 },
  ];

  await tapLoop(player, "pot", () => {
    const form = new SlotForm(MARKER.pot, "Cooking Pot", POT.size).body("");
    contents.forEach((stack, i) => {
      const slot = POT.contents[i];
      if (stack && slot !== undefined) form.set(slot, "s", stack.count, stack.text, stack.icon);
    });
    form.set(
      POT.heat,
      "s",
      "",
      hot ? "Fire is lit (tap: put it out)" : "Needs fire below (tap: light it)",
      hot ? TEX.flameLit : TEX.flameUnlit,
    );
    const hasFood = contents.some((stack) => stack !== undefined);
    if (hasFood) form.set(POT.result, "s", "", "Tomato Soup", TEX.tomatoSoup);
    if (hasFood && hot) form.set(POT.cook, "s", "", "Cook!", TEX.tomatoSoup);
    form.set(POT.almost, "s", "+1", "Add 1 Chopped Onion for Onion Soup", TEX.choppedOnion);
    form.set(POT.book, "s", "", "Recipe Book", TEX.recipeBook);

    return {
      form,
      onTap: (index) => {
        if (index === POT.heat) hot = !hot;
        const content = POT.contents.indexOf(index as (typeof POT.contents)[number]);
        if (content >= 0) contents[content] = undefined;
      },
    };
  });
}
