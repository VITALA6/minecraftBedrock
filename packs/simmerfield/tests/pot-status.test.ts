import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { recipesFor } from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import type { StationState } from "../scripts/stations/station-logic";
import { potChoices } from "../scripts/ui/pot-status";

// The pot's choice form (D15): only when two or more dishes are possible, one button per dish.

const RP = "packs/simmerfield/resource";
const pot = stationById("pot") as ContainerStation;
const state = (items: Record<string, number>, extra: Partial<StationState> = {}): StationState => ({
  items,
  ...extra,
});
const soupAndOnionSoup = { "wm_kitchen:tomato_soup_mix": 1, "wm_kitchen:onion_soup_mix": 2 };

describe("pot choice form", () => {
  it("no form when empty, idle with items, or one dish possible", () => {
    assert.deepEqual(potChoices(pot, state({})), []);
    assert.deepEqual(potChoices(pot, state({ "wm_kitchen:onion": 1 })), []);
    assert.deepEqual(potChoices(pot, state({ "wm_kitchen:tomato_soup_mix": 3 })), []);
  });

  it("no form while cooking or done, whatever is inside", () => {
    const job = { recipe: "wm_kitchen:tomato_soup", ticks: 10, total: 100, servings: 1 };
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup, { job })), []);
    const out = { item: "wm_kitchen:tomato_soup", count: 1 };
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup, { out })), []);
  });

  it("several possible: one button per dish, in recipe order, with the dish icon", () => {
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup)), [
      {
        recipe: "wm_kitchen:tomato_soup",
        result: "wm_kitchen:tomato_soup",
        icon: "textures/wm_kitchen/items/tomato_soup",
      },
      {
        recipe: "wm_kitchen:onion_soup",
        result: "wm_kitchen:onion_soup",
        icon: "textures/wm_kitchen/items/onion_soup",
      },
    ]);
  });

  // A pot holds 4 mixes (D16), so at most 4 different dishes. Pinned so a capacity change that
  // makes the form longer shows up here (blockers.md B23: 4 buttons must fit unscrolled).
  it("a full pot (4 mixes) offers at most 4 dishes", () => {
    const mixes = [...new Set(recipesFor("pot").flatMap((r) => r.ingredients.flatMap((i) => i.items)))]; // prettier-ignore
    let most = 0;
    const walk = (start: number, items: Record<string, number>, left: number) => {
      most = Math.max(most, potChoices(pot, state(items)).length);
      if (left === 0) return;
      for (let i = start; i < mixes.length; i++) {
        const id = mixes[i] as string;
        walk(i, { ...items, [id]: (items[id] ?? 0) + 1 }, left - 1);
      }
    };
    walk(0, {}, pot.capacity);
    assert.equal(most, 4);
  });

  it("every dish button icon exists as a PNG in the resource pack", () => {
    const icons = potChoices(pot, state(soupAndOnionSoup)).map((c) => c.icon);
    for (const icon of icons) assert.ok(icon && existsSync(`${RP}/${icon}.png`), icon);
  });
});
