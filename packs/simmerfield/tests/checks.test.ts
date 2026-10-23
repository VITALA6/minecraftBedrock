import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT,
  checkContent,
  referencedBlocks,
  referencedItems,
  type Content,
} from "../scripts/data/checks";
import { CROPS, type Crop } from "../scripts/data/crops";
import { DISHES, FAMILIES, type Dish } from "../scripts/data/dishes";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  STATION_RECIPES,
  ing,
  type StationRecipe,
} from "../scripts/data/recipes";
import { STATIONS, type ContainerStation } from "../scripts/data/stations";

const check = (patch: Partial<Content>) => checkContent({ ...CONTENT, ...patch });
const tomato = CROPS[0] as Crop;
const chili = CROPS.find((c) => c.key === "chili") as Crop;
const pot = STATIONS[0] as ContainerStation;
const soup = STATION_RECIPES[0] as StationRecipe;
const recipe = (patch: Partial<StationRecipe>): StationRecipe => ({
  ...soup,
  id: "wm_kitchen:test",
  ...patch,
});

/** The check reports exactly `expected` (order-free). */
function reports(problems: string[], ...expected: string[]) {
  assert.deepEqual([...problems].sort(), [...expected].sort());
}

describe("data check on the shipped data", () => {
  it("finds no problems", () => {
    reports(checkContent());
  });
});

describe("data check on broken data", () => {
  it("duplicate crop key, block and seed", () => {
    reports(
      check({ crops: [...CROPS, { ...tomato }] }),
      'crops: duplicate key "tomato"',
      'crops: duplicate block "wm_kitchen:tomato_crop"',
      'crops: duplicate seed "wm_kitchen:tomato_seeds"',
    );
  });

  it("a crop's lang key without the wm_kitchen.crop.where. prefix", () => {
    reports(
      check({
        crops: CROPS.map((c) => (c === tomato ? { ...c, whereKey: "crop.where.tomato" } : c)),
      }),
      "crop tomato: odd lang key crop.where.tomato",
    );
  });

  it("a bush without pick counts, or with bad ones", () => {
    const noPick: Crop = { ...chili, pick: undefined };
    const swap = (c: Crop) => check({ crops: CROPS.map((x) => (x === chili ? c : x)) });
    reports(swap(noPick), "crop chili: bush without pick counts");
    reports(swap({ ...chili, pick: { min: 3, max: 1 } }), "crop chili: bad pick counts 3..1");
    reports(swap({ ...chili, pick: { min: 0, max: 2 } }), "crop chili: bad pick counts 0..2");
    reports(swap({ ...chili, pickResetStage: -1 }), "crop chili: bad pickResetStage -1");
  });

  it("a crop with no biomes", () => {
    reports(
      check({ crops: CROPS.map((c) => (c === tomato ? { ...c, biomes: [] } : c)) }),
      "crop tomato: no biomes",
    );
  });

  it("a pot recipe that doesn't fit the pot", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({
            ingredients: [
              ing(4, "wm_kitchen:tomato_soup_mix"),
              ing(1, "wm_kitchen:onion_soup_mix"),
            ],
          }),
        ],
      }),
      "station recipe wm_kitchen:test: needs 5 > capacity 4",
    );
  });

  it("a recipe exactly at capacity is fine", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({
            ingredients: [
              ing(3, "wm_kitchen:tomato_soup_mix"),
              ing(1, "wm_kitchen:onion_soup_mix"),
            ],
          }),
        ],
      }),
    );
  });

  it("a Simmerfield ingredient nothing produces", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({ ingredients: [ing(1, "wm_kitchen:mystery")] }),
        ],
      }),
      'recipe wm_kitchen:test: "wm_kitchen:mystery" can\'t be obtained',
    );
  });

  it("a vanilla ingredient without an icon", () => {
    reports(
      check({
        stationRecipes: [...STATION_RECIPES, recipe({ ingredients: [ing(1, "minecraft:apple")] })],
      }),
      'station recipe wm_kitchen:test: no icon for "minecraft:apple" (add it to data/icons.ts)',
    );
  });

  it("an item in two ingredient slots, a bad count and an empty slot", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({
            ingredients: [
              ing(1, "wm_kitchen:tomato"),
              ing(0, "wm_kitchen:tomato", "wm_kitchen:onion"),
              ing(1),
            ],
          }),
        ],
      }),
      'station recipe wm_kitchen:test: "wm_kitchen:tomato" is in two ingredient slots',
      "station recipe wm_kitchen:test: bad count 0",
      "station recipe wm_kitchen:test: ingredient with no items",
    );
  });

  it("an unknown station, a bad cook time and a bad result count", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({ station: "oven" as never, seconds: 0, count: 0 }),
        ],
      }),
      'station recipe wm_kitchen:test: unknown station "oven"',
      "station recipe wm_kitchen:test: bad cook time",
      "station recipe wm_kitchen:test: bad result count 0",
    );
  });

  it("duplicate recipe ids, across the pot and the crafting table", () => {
    reports(
      check({
        craftingRecipes: [
          ...CRAFTING_RECIPES,
          { id: soup.id, result: soup.result, count: 1, ingredients: [] },
        ],
      }),
      'recipes: duplicate id "wm_kitchen:tomato_soup"',
    );
  });

  it("a station without recipes, a bad capacity and an odd lang key", () => {
    reports(
      check({
        stationRecipes: [],
        craftingRecipes: CRAFTING_RECIPES.filter((r) => !r.result.endsWith("_mix")),
        dishes: DISHES.filter((d) => !STATION_RECIPES.some((r) => r.result === d.id)),
      }),
      "station pot: no recipes",
    );
    reports(
      check({ stations: [{ ...pot, capacity: 0, nameKey: "station.pot" }] }),
      "station pot: bad capacity 0",
      "station pot: odd lang key station.pot",
      ...STATION_RECIPES.map(
        (r) =>
          `station recipe ${r.id}: needs ${r.ingredients.reduce((s, i) => s + i.count, 0)} > capacity 0`,
      ),
    );
  });

  it("duplicate stations", () => {
    reports(
      check({ stations: [pot, { ...pot }] }),
      'stations: duplicate id "pot"',
      'stations: duplicate block "wm_kitchen:cooking_pot"',
    );
  });

  it("a dish no recipe makes, a duplicate dish and an effect without a family", () => {
    const orphan: Dish = { id: "wm_kitchen:orphan", nutrition: 1, canAlwaysEat: false };
    reports(check({ dishes: [...DISHES, orphan] }), "dish wm_kitchen:orphan: no recipe makes it");
    reports(
      check({ dishes: [...DISHES, { ...(DISHES[0] as Dish) }] }),
      'dishes: duplicate id "wm_kitchen:tomato_soup"',
    );
    const strong: Dish = {
      ...(DISHES[0] as Dish),
      effect: { effect: "minecraft:strength", seconds: 10, amplifier: 0 },
    };
    reports(
      check({ dishes: DISHES.map((d, i) => (i === 0 ? strong : d)) }),
      "dish wm_kitchen:tomato_soup: effect has no family",
    );
  });

  it("a pot dish without a liquid colour", () => {
    const plain = DISHES.map((d) =>
      d.id === "wm_kitchen:onion_soup" ? { ...d, liquid: undefined } : d,
    );
    reports(
      check({ dishes: plain }),
      "station recipe wm_kitchen:onion_soup: dish wm_kitchen:onion_soup has no liquid colour (data/dishes.ts)",
    );
    // a station without a liquid state doesn't need one
    const noLiquid = { ...pot, states: { ...pot.states, liquid: undefined } };
    reports(check({ dishes: plain, stations: [noLiquid] }));
  });

  it("family lang keys need the wm_kitchen.family. prefix", () => {
    reports(
      check({
        families: { ...CONTENT.families, heal: { ...FAMILIES.heal, hintKey: "heal.hint" } },
      }),
      "family heal: odd lang key heal.hint",
    );
  });

  it("cutting: an input nothing produces, a duplicate input, a missing icon", () => {
    reports(
      check({
        cuttingRecipes: [
          ...CUTTING_RECIPES,
          { input: "wm_kitchen:potato", output: "wm_kitchen:diced_potato", count: 2 },
        ],
      }),
      "cutting wm_kitchen:potato: input can't be obtained",
    );
    reports(
      check({
        cuttingRecipes: [
          ...CUTTING_RECIPES,
          { ...(CUTTING_RECIPES[0] as (typeof CUTTING_RECIPES)[number]) },
        ],
      }),
      'cutting: duplicate input "wm_kitchen:tomato"',
    );
    reports(
      check({ icon: (id) => (id === "wm_kitchen:sliced_tomato" ? undefined : CONTENT.icon(id)) }),
      'cutting wm_kitchen:tomato: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe wm_kitchen:garden_salad: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe wm_kitchen:salsa: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe wm_kitchen:veggie_sandwich: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe wm_kitchen:hearty_sandwich: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe wm_kitchen:veggie_skewer: no icon for "wm_kitchen:sliced_tomato" (add it to data/icons.ts)',
    );
  });

  it("a crafting recipe with two alternative slots", () => {
    const base = CRAFTING_RECIPES.find((r) => r.id === "wm_kitchen:tomato_soup_mix");
    assert.ok(base);
    reports(
      check({
        craftingRecipes: [
          ...CRAFTING_RECIPES,
          {
            ...base,
            id: "wm_kitchen:two_alts",
            ingredients: [
              ing(1, "minecraft:cod", "minecraft:salmon"),
              ing(1, "wm_kitchen:tomato", "wm_kitchen:onion"),
            ],
          },
        ],
      }),
      "crafting recipe wm_kitchen:two_alts: two slots with alternatives (one JSON recipe per alternative of one slot)",
    );
  });

  it("a mix without its crafting recipe can't be obtained", () => {
    const problems = check({
      craftingRecipes: CRAFTING_RECIPES.filter((r) => r.id !== "wm_kitchen:ratatouille_mix"),
    });
    assert.ok(
      problems.includes(
        'recipe wm_kitchen:ratatouille: "wm_kitchen:ratatouille_mix" can\'t be obtained',
      ),
    );
  });

  it("a station item without an icon", () => {
    reports(
      check({ icon: (id) => (id === "wm_kitchen:recipe_poster" ? undefined : CONTENT.icon(id)) }),
      'station items: no icon for "wm_kitchen:recipe_poster" (add it to data/icons.ts)',
    );
  });

  it("removing the cutting board makes its outputs unobtainable", () => {
    const problems = check({ cuttingRecipes: [] });
    assert.ok(
      problems.includes('recipe wm_kitchen:salsa: "wm_kitchen:chopped_onion" can\'t be obtained'),
      problems.join("\n"),
    );
    assert.ok(
      problems.includes(
        'recipe wm_kitchen:garden_salad: "wm_kitchen:sliced_tomato" can\'t be obtained',
      ),
    );
  });
});

describe("references for the in-game half", () => {
  it("lists every item with where it's used", () => {
    const refs = referencedItems();
    const where = (id: string) => refs.filter((r) => r.id === id).map((r) => r.where);
    assert.deepEqual(where("minecraft:salmon"), ["crafting recipe wm_kitchen:fish_chowder_mix"]);
    assert.deepEqual(where("wm_kitchen:tomato_soup_mix"), [
      "station recipe wm_kitchen:tomato_soup",
      "crafting recipe wm_kitchen:tomato_soup_mix",
    ]);
    assert.ok(where("wm_kitchen:tomato").includes("crop tomato"));
    assert.ok(where("wm_kitchen:tomato").includes("cutting wm_kitchen:tomato"));
    assert.deepEqual(where("wm_kitchen:recipe_poster"), ["station items"]);
    assert.ok(refs.every((r) => r.id.includes(":")));
  });

  it("lists every block with the states the scripts drive", () => {
    const refs = referencedBlocks();
    const states = (id: string) => refs.find((r) => r.id === id)?.states;
    assert.deepEqual(states("wm_kitchen:cooking_pot"), [
      "wm_kitchen:fill",
      "wm_kitchen:phase",
      "wm_kitchen:hot",
      "wm_kitchen:liquid",
    ]);
    assert.deepEqual(states("wm_kitchen:chili_bush"), ["wm_kitchen:growth"]);
    assert.deepEqual(states("wm_kitchen:strawberry_cake"), ["wm_kitchen:slices"]);
    assert.deepEqual(states("minecraft:campfire"), []);
    assert.deepEqual(states("wm_kitchen:recipe_poster"), [
      "wm_kitchen:poster",
      "wm_kitchen:poster_page",
      "wm_kitchen:facing",
    ]);
    assert.ok(refs.some((r) => r.id === "minecraft:short_grass"));
  });
});
