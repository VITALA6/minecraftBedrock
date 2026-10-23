import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickResult } from "../scripts/crops/growth-logic";
import { CONTENT, checkContent, type Content } from "../scripts/data/checks";
import { CROPS, cropByBlock, cropByKey, type Crop } from "../scripts/data/crops";
import {
  DISHES,
  FAMILIES,
  dishBySliceBlock,
  familyOf,
  findDish,
  type Dish,
} from "../scripts/data/dishes";
import {
  CRAFTING_RECIPES,
  CUTTING_RECIPES,
  consume,
  craftingJsonIds,
  findCuttingRecipe,
  ing,
  stationInputsMadeFrom,
  type CraftingRecipe,
} from "../scripts/data/recipes";
import { STATIONS, stationByBlock, type ContainerStation } from "../scripts/data/stations";

// The lookups and the less travelled branches of the data modules (data/*.ts): what the block
// components, the cutting board and the sliced cake look things up by, and the data checks that
// the shipped data never trips.

describe("lookups by block and input", () => {
  it("every crop is found by its block, and only by its block", () => {
    for (const crop of CROPS) assert.equal(cropByBlock(crop.block), crop);
    assert.equal(cropByBlock(CROPS[0]?.produce ?? ""), undefined, "the produce isn't the block");
    assert.equal(cropByBlock("minecraft:wheat"), undefined);
    assert.equal(cropByKey("not_a_crop"), undefined);
  });

  it("the pot is found by its block; other blocks aren't stations", () => {
    for (const station of STATIONS) assert.equal(stationByBlock(station.block), station);
    assert.equal(stationByBlock("minecraft:cauldron"), undefined);
    assert.equal(
      stationByBlock("wm_kitchen:cutting_board"),
      undefined,
      "the board isn't a container",
    );
  });

  it("the cutting board finds a recipe for each input it cuts, nothing for anything else", () => {
    for (const recipe of CUTTING_RECIPES) assert.equal(findCuttingRecipe(recipe.input), recipe);
    for (const recipe of CUTTING_RECIPES) {
      assert.equal(findCuttingRecipe(recipe.output), undefined, `${recipe.output} is already cut`);
    }
    assert.equal(findCuttingRecipe("minecraft:carrot"), undefined);
  });

  it("the sliced dish is found by its slice block; whole-item dishes have none", () => {
    const sliced = DISHES.filter((d) => d.slices);
    assert.ok(sliced.length > 0);
    for (const dish of sliced) assert.equal(dishBySliceBlock(dish.slices?.block ?? ""), dish);
    assert.equal(dishBySliceBlock("minecraft:cake"), undefined);
  });

  it("a dish's family comes from its effect; no effect, no family", () => {
    for (const dish of DISHES) {
      const family = familyOf(dish);
      if (dish.effect) assert.ok(family && Object.values(FAMILIES).includes(family), dish.id);
      else assert.equal(family, undefined, dish.id);
    }
    const plain: Dish = { ...(findDish(DISHES[0]?.id ?? "") as Dish), effect: undefined };
    assert.equal(familyOf(plain), undefined);
    const unknown: Dish = { ...plain, effect: { effect: "levitation", seconds: 5, amplifier: 0 } };
    assert.equal(familyOf(unknown), undefined, "an effect without a family");
  });
});

describe("recipe helpers: edge cases", () => {
  it("a recipe without alternatives is one JSON recipe with one item per count", () => {
    const recipe = CRAFTING_RECIPES.find((r) => r.ingredients.every((i) => i.items.length === 1));
    assert.ok(recipe);
    const [only, ...rest] = craftingJsonIds(recipe);
    assert.deepEqual(rest, []);
    assert.equal(only?.id, recipe.id);
    assert.equal(
      only?.items.length,
      recipe.ingredients.reduce((n, i) => n + i.count, 0),
    );
  });

  it("an alternative slot with an empty item list makes empty item names, not a crash", () => {
    const odd: CraftingRecipe = {
      id: "t:odd",
      result: "t:odd",
      count: 1,
      ingredients: [ing(1, "t:a", "t:b"), { items: [], count: 1 }],
    };
    assert.deepEqual(craftingJsonIds(odd), [
      { id: "t:odd", items: ["t:a", ""] },
      { id: "t:odd_b", items: ["t:b", ""] },
    ]);
  });

  it("consume skips alternatives that are absent and takes the rest from the next", () => {
    const slot = [ing(3, "t:cod", "t:salmon", "t:tuna")];
    assert.deepEqual(consume({ "t:salmon": 1, "t:tuna": 5 }, slot), { "t:tuna": 3 });
    assert.deepEqual(consume({ "t:cod": 3, "t:x": 1 }, slot), { "t:x": 1 });
  });

  it("a raw ingredient names only the mixes it goes into; a mix or junk names none", () => {
    assert.ok(stationInputsMadeFrom("pot", "wm_kitchen:tomato").length > 0);
    assert.deepEqual(stationInputsMadeFrom("pot", "minecraft:dirt"), []);
    assert.deepEqual(stationInputsMadeFrom("pot", "wm_kitchen:tomato_soup_mix"), []);
  });
});

describe("bush picking without a reset stage", () => {
  it("falls back to stage 0", () => {
    const bush = CROPS.find((c) => c.pick) as Crop;
    const plain: Crop = { ...bush, pickResetStage: undefined };
    assert.equal(pickResult(plain, 0)?.stage, 0);
    assert.equal(pickResult(plain, 0)?.count, bush.pick?.min);
  });
});

describe("data check: the remaining kinds of broken data", () => {
  const check = (patch: Partial<Content>) => checkContent({ ...CONTENT, ...patch });
  const pot = STATIONS[0] as ContainerStation;
  const cake = DISHES.find((d) => d.slices) as Dish;
  const soup = DISHES.find((d) => d.effect) as Dish;

  it("a cutting recipe with a bad count", () => {
    const [first, ...rest] = CUTTING_RECIPES;
    assert.ok(first);
    assert.deepEqual(check({ cuttingRecipes: [{ ...first, count: 0 }, ...rest] }), [
      `cutting ${first.input}: bad count 0`,
    ]);
  });

  it("a station whose fill state has bad levels", () => {
    const fill = { name: pot.states.fill?.name ?? "fill", levels: 1.5 };
    const bad: ContainerStation = { ...pot, states: { ...pot.states, fill } };
    assert.deepEqual(check({ stations: [bad] }), ["station pot: bad fill levels 1.5"]);
  });

  it("a crafting recipe with a bad result count", () => {
    const [first, ...rest] = CRAFTING_RECIPES;
    assert.ok(first);
    assert.deepEqual(check({ craftingRecipes: [{ ...first, count: -1 }, ...rest] }), [
      `crafting recipe ${first.id}: bad result count -1`,
    ]);
  });

  it("a dish with a bad effect duration or a bad slice count", () => {
    const swap = (dish: Dish, by: Dish) =>
      check({ dishes: DISHES.map((d) => (d === dish ? by : d)) });
    const effect = soup.effect;
    assert.ok(effect);
    assert.deepEqual(swap(soup, { ...soup, effect: { ...effect, seconds: 0 } }), [
      `dish ${soup.id}: bad effect duration`,
    ]);
    const slices = cake.slices;
    assert.ok(slices);
    assert.deepEqual(swap(cake, { ...cake, slices: { ...slices, count: 0 } }), [
      `dish ${cake.id}: bad slice count`,
    ]);
  });
});
