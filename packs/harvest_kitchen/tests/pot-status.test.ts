import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { findStationRecipe, type StationRecipe } from "../scripts/data/recipes";
import type { StationState } from "../scripts/stations/station-logic";
import { potImagePath, potImageSpecs, potScreenView, slotMissing } from "../scripts/ui/pot-status";

// Which status image and buttons the pot screen shows (D14), and that every image it can ask
// for exists in the resource pack.

const RP = "packs/harvest_kitchen/resource";
const pot = stationById("pot") as ContainerStation;
const state = (items: Record<string, number>, extra: Partial<StationState> = {}): StationState => ({
  items,
  ...extra,
});
const recipe = (id: string) => findStationRecipe(id) as StationRecipe;

describe("pot status image", () => {
  it("no screen when empty, cooking or done", () => {
    assert.equal(potScreenView(pot, state({}), true), undefined);
    const job = { recipe: "hk:tomato_soup", ticks: 10, total: 100 };
    assert.equal(potScreenView(pot, state({ "hk:tomato": 2, "minecraft:bowl": 1 }, { job }), true), undefined); // prettier-ignore
    const out = { item: "hk:tomato_soup", count: 1 };
    assert.equal(potScreenView(pot, state({ "hk:onion": 1 }, { out }), true), undefined);
  });

  it("one dish possible: that recipe, nothing missing, by heat", () => {
    const s = state({ "hk:tomato": 2, "minecraft:bowl": 1 });
    assert.equal(potScreenView(pot, s, true)?.image, "pot_tomato_soup_00_lit");
    assert.equal(potScreenView(pot, s, false)?.image, "pot_tomato_soup_00_cold");
    // extras don't change the image; they show as Take-out buttons
    const extra = potScreenView(pot, state({ "hk:tomato": 3, "minecraft:bowl": 1, "minecraft:sugar": 1 }), true); // prettier-ignore
    assert.equal(extra?.image, "pot_tomato_soup_00_lit");
    assert.deepEqual(extra?.contents.map(([id]) => id), ["hk:tomato", "minecraft:bowl", "minecraft:sugar"]); // prettier-ignore
  });

  it("several possible: the generic choose image and one Cook button each", () => {
    const s = state({ "hk:tomato": 2, "hk:onion": 2, "minecraft:bread": 1, "minecraft:bowl": 1 });
    const view = potScreenView(pot, s, true);
    assert.equal(view?.image, "pot_choose_lit");
    assert.deepEqual(
      view?.cook.map((r) => r.id),
      ["hk:tomato_soup", "hk:onion_soup"],
    );
    assert.equal(view?.almost, undefined);
  });

  it("almost: the closest recipe with how many are missing per slot", () => {
    const s = state({ "hk:onion": 1, "minecraft:bread": 1 });
    assert.deepEqual(slotMissing(recipe("hk:onion_soup"), s.items), [1, 0, 1]);
    const view = potScreenView(pot, s, true);
    assert.equal(view?.image, "pot_onion_soup_101_lit");
    assert.equal(view?.almost?.id, "hk:onion_soup");
    assert.deepEqual(view?.cook, []);
  });

  it("cod or salmon fill the same slot", () => {
    const s = state({ "minecraft:salmon": 1, "hk:onion": 1 });
    assert.deepEqual(slotMissing(recipe("hk:fish_chowder"), s.items), [0, 1, 0, 1]);
  });

  it("the layout changes with the buttons and the heat, not with counts", () => {
    const a = potScreenView(pot, state({ "hk:strawberry": 1 }), true);
    const b = potScreenView(pot, state({ "hk:strawberry": 2 }), true);
    const c = potScreenView(pot, state({ "hk:strawberry": 2 }), false);
    const d = potScreenView(pot, state({ "hk:strawberry": 2, "minecraft:sugar": 1 }), true);
    assert.equal(a?.layout, b?.layout);
    assert.notEqual(a?.image, b?.image, "the image still follows the counts");
    assert.notEqual(b?.layout, c?.layout);
    assert.notEqual(b?.layout, d?.layout);
  });
});

describe("pot images the script can show", () => {
  const specs = potImageSpecs(pot);
  const stems = new Set(specs.map((s) => s.stem));

  it("every reachable state picks an image that has a spec", () => {
    // every multiset of up to 4 items over the pot's ingredients, plus a few full pots
    const ids = [...new Set(specs.flatMap((s) => s.recipe?.ingredients.flatMap((i) => i.items) ?? []))]; // prettier-ignore
    const seen = new Set<string>();
    const walk = (start: number, items: Record<string, number>, left: number) => {
      for (const hot of [true, false]) {
        const view = potScreenView(pot, state(items), hot);
        if (view) {
          assert.ok(stems.has(view.image), `${view.image} for ${JSON.stringify(items)}`);
          seen.add(view.image);
        }
      }
      if (left === 0) return;
      for (let i = start; i < ids.length; i++) {
        const id = ids[i] as string;
        walk(i, { ...items, [id]: (items[id] ?? 0) + 1 }, left - 1);
      }
    };
    walk(0, {}, 4);
    assert.ok(seen.size > 100, `${seen.size} images reached`);
  });

  it("every spec exists as a PNG, and every PNG is a spec", () => {
    assert.equal(stems.size, specs.length);
    assert.deepEqual(
      [...stems].filter((stem) => !existsSync(`${RP}/${potImagePath(stem)}`)),
      [],
    );
    const files = readdirSync(`${RP}/textures/hk/pot`).filter((f) => f.endsWith(".png"));
    assert.deepEqual(
      files.filter((f) => !stems.has(f.slice(0, -4))),
      [],
    );
  });
});
