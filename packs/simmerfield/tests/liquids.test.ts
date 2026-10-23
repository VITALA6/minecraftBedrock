import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DISHES } from "../scripts/data/dishes";
import {
  DEFAULT_LIQUID,
  LIQUIDS,
  LIQUID_STRENGTH,
  dominantLiquid,
  type Liquid,
} from "../scripts/data/liquids";
import { STATION_RECIPES } from "../scripts/data/recipes";

describe("liquid data", () => {
  it("water is the default and the first state value", () => {
    assert.equal(LIQUIDS[0], DEFAULT_LIQUID);
    assert.equal(DEFAULT_LIQUID, "water");
  });

  it("stays a small palette that fits 4 state bits", () => {
    assert.ok(LIQUIDS.length <= 16, `${LIQUIDS.length} colours`);
    assert.equal(new Set(LIQUIDS).size, LIQUIDS.length, "no duplicates");
  });

  it("the tie order lists every colour but water exactly once", () => {
    assert.deepEqual(
      [...LIQUID_STRENGTH].sort(),
      LIQUIDS.filter((l) => l !== DEFAULT_LIQUID).sort(),
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
  // A colour lookup like the pot's (each mix colours it as its dish).
  const colours: Record<string, Liquid> = {
    "wm_kitchen:a": "cream",
    "wm_kitchen:b": "cream",
    "wm_kitchen:t": "tomato",
    "wm_kitchen:s": "stew",
    "wm_kitchen:j": "jam",
  };
  const colourOf = (id: string) => colours[id];

  it("is water when nothing colours it", () => {
    assert.equal(dominantLiquid({}, colourOf), "water");
    assert.equal(dominantLiquid({ "minecraft:bowl": 3 }, colourOf), "water");
  });

  it("ignores zero and negative counts", () => {
    assert.equal(dominantLiquid({ "wm_kitchen:t": 0, "wm_kitchen:s": -1 }, colourOf), "water");
  });

  it("sums per colour, then the stronger colour wins a tie", () => {
    assert.equal(
      dominantLiquid({ "wm_kitchen:a": 1, "wm_kitchen:b": 1, "wm_kitchen:t": 1 }, colourOf),
      "cream",
    );
    assert.equal(dominantLiquid({ "wm_kitchen:s": 1, "wm_kitchen:j": 1 }, colourOf), "jam");
    assert.equal(dominantLiquid({ "wm_kitchen:s": 2, "wm_kitchen:j": 1 }, colourOf), "stew");
  });
});
