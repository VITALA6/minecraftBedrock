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
  id: "hk:test",
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
      'crops: duplicate block "hk:tomato_crop"',
      'crops: duplicate seed "hk:tomato_seeds"',
    );
  });

  it("a crop's lang key without the hk.crop.where. prefix", () => {
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
          recipe({ ingredients: [ing(8, "hk:tomato"), ing(1, "minecraft:bowl")] }),
        ],
      }),
      "station recipe hk:test: needs 9 > capacity 8",
    );
  });

  it("a recipe exactly at capacity is fine", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({ ingredients: [ing(7, "hk:tomato"), ing(1, "minecraft:bowl")] }),
        ],
      }),
    );
  });

  it("an HK ingredient nothing produces", () => {
    reports(
      check({
        stationRecipes: [...STATION_RECIPES, recipe({ ingredients: [ing(1, "hk:mystery")] })],
      }),
      'recipe hk:test: "hk:mystery" can\'t be obtained',
    );
  });

  it("a vanilla ingredient without an icon", () => {
    reports(
      check({
        stationRecipes: [...STATION_RECIPES, recipe({ ingredients: [ing(1, "minecraft:apple")] })],
      }),
      'station recipe hk:test: no icon for "minecraft:apple" (add it to data/icons.ts)',
    );
  });

  it("an item in two ingredient slots, a bad count and an empty slot", () => {
    reports(
      check({
        stationRecipes: [
          ...STATION_RECIPES,
          recipe({ ingredients: [ing(1, "hk:tomato"), ing(0, "hk:tomato", "hk:onion"), ing(1)] }),
        ],
      }),
      'station recipe hk:test: "hk:tomato" is in two ingredient slots',
      "station recipe hk:test: bad count 0",
      "station recipe hk:test: ingredient with no items",
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
      'station recipe hk:test: unknown station "oven"',
      "station recipe hk:test: bad cook time",
      "station recipe hk:test: bad result count 0",
    );
  });

  it("duplicate recipe ids, across the pot and the crafting table", () => {
    reports(
      check({ craftingRecipes: [...CRAFTING_RECIPES, { ...soup }] }),
      'recipes: duplicate id "hk:tomato_soup"',
    );
  });

  it("a station without recipes, a bad capacity and an odd lang key", () => {
    reports(
      check({
        stationRecipes: [],
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
      'stations: duplicate block "hk:cooking_pot"',
    );
  });

  it("a dish no recipe makes, a duplicate dish and an effect without a family", () => {
    const orphan: Dish = { id: "hk:orphan", nutrition: 1, canAlwaysEat: false };
    reports(check({ dishes: [...DISHES, orphan] }), "dish hk:orphan: no recipe makes it");
    reports(
      check({ dishes: [...DISHES, { ...(DISHES[0] as Dish) }] }),
      'dishes: duplicate id "hk:tomato_soup"',
    );
    const strong: Dish = {
      ...(DISHES[0] as Dish),
      effect: { effect: "minecraft:strength", seconds: 10, amplifier: 0 },
    };
    reports(
      check({ dishes: DISHES.map((d, i) => (i === 0 ? strong : d)) }),
      "dish hk:tomato_soup: effect has no family",
    );
  });

  it("a pot dish without a liquid colour", () => {
    const plain = DISHES.map((d) => (d.id === "hk:onion_soup" ? { ...d, liquid: undefined } : d));
    reports(
      check({ dishes: plain }),
      "station recipe hk:onion_soup: dish hk:onion_soup has no liquid colour (data/dishes.ts)",
    );
    // a station without a liquid state doesn't need one
    const noLiquid = { ...pot, states: { ...pot.states, liquid: undefined } };
    reports(check({ dishes: plain, stations: [noLiquid] }));
  });

  it("family lang keys need the hk.family. prefix", () => {
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
          { input: "hk:potato", output: "hk:diced_potato", count: 2 },
        ],
      }),
      "cutting hk:potato: input can't be obtained",
    );
    reports(
      check({
        cuttingRecipes: [
          ...CUTTING_RECIPES,
          { ...(CUTTING_RECIPES[0] as (typeof CUTTING_RECIPES)[number]) },
        ],
      }),
      'cutting: duplicate input "hk:tomato"',
    );
    reports(
      check({ icon: (id) => (id === "hk:sliced_tomato" ? undefined : CONTENT.icon(id)) }),
      'cutting hk:tomato: no icon for "hk:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe hk:garden_salad: no icon for "hk:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe hk:salsa: no icon for "hk:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe hk:veggie_sandwich: no icon for "hk:sliced_tomato" (add it to data/icons.ts)',
      'crafting recipe hk:hearty_sandwich: no icon for "hk:sliced_tomato" (add it to data/icons.ts)',
    );
  });

  it("a station item without an icon", () => {
    reports(
      check({ icon: (id) => (id === "hk:recipe_book" ? undefined : CONTENT.icon(id)) }),
      'station items: no icon for "hk:recipe_book" (add it to data/icons.ts)',
    );
  });

  it("removing the cutting board makes its outputs unobtainable", () => {
    const problems = check({ cuttingRecipes: [] });
    assert.ok(
      problems.includes('recipe hk:salsa: "hk:chopped_onion" can\'t be obtained'),
      problems.join("\n"),
    );
    assert.ok(problems.includes('recipe hk:garden_salad: "hk:sliced_tomato" can\'t be obtained'));
  });
});

describe("references for the in-game half", () => {
  it("lists every item with where it's used", () => {
    const refs = referencedItems();
    const where = (id: string) => refs.filter((r) => r.id === id).map((r) => r.where);
    assert.deepEqual(where("minecraft:salmon"), ["station recipe hk:fish_chowder"]);
    assert.ok(where("hk:tomato").includes("crop tomato"));
    assert.ok(where("hk:tomato").includes("cutting hk:tomato"));
    assert.deepEqual(where("hk:recipe_book"), ["station items"]);
    assert.ok(refs.every((r) => r.id.includes(":")));
  });

  it("lists every block with the states the scripts drive", () => {
    const refs = referencedBlocks();
    const states = (id: string) => refs.find((r) => r.id === id)?.states;
    assert.deepEqual(states("hk:cooking_pot"), ["hk:fill", "hk:phase", "hk:hot", "hk:liquid"]);
    assert.deepEqual(states("hk:chili_bush"), ["hk:growth"]);
    assert.deepEqual(states("hk:strawberry_cake"), ["hk:slices"]);
    assert.deepEqual(states("minecraft:campfire"), []);
    assert.ok(refs.some((r) => r.id === "minecraft:short_grass"));
  });
});
