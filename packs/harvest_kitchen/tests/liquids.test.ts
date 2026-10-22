import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISHES } from "../scripts/data/dishes";
import {
  DEFAULT_LIQUID,
  INGREDIENT_LIQUIDS,
  LIQUIDS,
  LIQUID_STRENGTH,
  dominantLiquid,
} from "../scripts/data/liquids";
import { STATION_RECIPES, ingredientsOf } from "../scripts/data/recipes";

describe("liquid data", () => {
  it("water is the default and the first state value", () => {
    assert.equal(LIQUIDS[0], DEFAULT_LIQUID);
    assert.equal(DEFAULT_LIQUID, "water");
  });

  it("stays a small palette that fits 3 state bits", () => {
    assert.ok(LIQUIDS.length <= 8, `${LIQUIDS.length} colours`);
    assert.equal(new Set(LIQUIDS).size, LIQUIDS.length, "no duplicates");
  });

  it("the tie order lists every colour but water exactly once", () => {
    assert.deepEqual(
      [...LIQUID_STRENGTH].sort(),
      LIQUIDS.filter((l) => l !== DEFAULT_LIQUID).sort(),
    );
  });

  it("every coloured ingredient is something the pot accepts", () => {
    const accepted = ingredientsOf("pot");
    assert.deepEqual(
      Object.keys(INGREDIENT_LIQUIDS).filter((id) => !accepted.has(id)),
      [],
    );
  });

  it("every pot dish has a colour, and every colour but water is some dish's", () => {
    const potDishes = STATION_RECIPES.map((r) => DISHES.find((d) => d.id === r.result));
    assert.ok(potDishes.every((d) => d?.liquid !== undefined));
    const used = new Set(potDishes.map((d) => d?.liquid));
    assert.deepEqual(
      LIQUIDS.filter((l) => l !== DEFAULT_LIQUID && !used.has(l)),
      [],
    );
  });
});

describe("dominantLiquid", () => {
  it("is water when nothing colours it", () => {
    assert.equal(dominantLiquid({}), "water");
    assert.equal(dominantLiquid({ "minecraft:bowl": 3, "minecraft:sugar": 2 }), "water");
  });

  it("ignores zero and negative counts", () => {
    assert.equal(dominantLiquid({ "hk:tomato": 0, "hk:onion": -1 }), "water");
  });

  it("sums per colour, then the stronger colour wins a tie", () => {
    assert.equal(
      dominantLiquid({ "minecraft:cod": 1, "minecraft:salmon": 1, "hk:tomato": 1 }),
      "cream",
    );
    assert.equal(dominantLiquid({ "minecraft:beef": 1, "hk:strawberry": 1 }), "jam");
    assert.equal(dominantLiquid({ "minecraft:beef": 2, "hk:strawberry": 1 }), "stew");
  });
});
