import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import type { StationState } from "../scripts/stations/station-logic";
import { potChoices } from "../scripts/ui/pot-status";

// The pot's choice form (D15): only when two or more dishes are possible, one button per dish.

const RP = "packs/harvest_kitchen/resource";
const pot = stationById("pot") as ContainerStation;
const state = (items: Record<string, number>, extra: Partial<StationState> = {}): StationState => ({
  items,
  ...extra,
});
const soupAndOnionSoup = { "hk:tomato": 2, "hk:onion": 2, "minecraft:bread": 1, "minecraft:bowl": 1 }; // prettier-ignore

describe("pot choice form", () => {
  it("no form when empty, idle with items, or one dish possible", () => {
    assert.deepEqual(potChoices(pot, state({})), []);
    assert.deepEqual(potChoices(pot, state({ "hk:onion": 1 })), []);
    assert.deepEqual(potChoices(pot, state({ "hk:tomato": 2, "minecraft:bowl": 1 })), []);
  });

  it("no form while cooking or done, whatever is inside", () => {
    const job = { recipe: "hk:tomato_soup", ticks: 10, total: 100 };
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup, { job })), []);
    const out = { item: "hk:tomato_soup", count: 1 };
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup, { out })), []);
  });

  it("several possible: one button per dish, in recipe order, with the dish icon", () => {
    assert.deepEqual(potChoices(pot, state(soupAndOnionSoup)), [
      { recipe: "hk:tomato_soup", result: "hk:tomato_soup", icon: "textures/hk/items/tomato_soup" },
      { recipe: "hk:onion_soup", result: "hk:onion_soup", icon: "textures/hk/items/onion_soup" },
    ]);
  });

  // A pot holds 8 items, so few dishes fit at once. 4 is the most (vegetable stew, tomato soup,
  // chicken soup and fish chowder share a bowl, an onion, a carrot and a potato). Pinned so a new
  // recipe that makes the form longer shows up here (blockers.md: 4 buttons must fit unscrolled).
  it("a full pot (8 items) offers at most 4 dishes", () => {
    const ids = [
      ...new Set(
        ["hk:tomato", "hk:onion", "minecraft:carrot", "minecraft:potato", "minecraft:bowl"].concat(
          ["minecraft:bread", "minecraft:chicken", "minecraft:beef", "hk:chili_pepper"],
          ["minecraft:cod", "hk:strawberry", "minecraft:sugar", "minecraft:glass_bottle"],
        ),
      ),
    ];
    let most = 0;
    const walk = (start: number, items: Record<string, number>, left: number) => {
      most = Math.max(most, potChoices(pot, state(items)).length);
      if (left === 0) return;
      for (let i = start; i < ids.length; i++) {
        const id = ids[i] as string;
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
