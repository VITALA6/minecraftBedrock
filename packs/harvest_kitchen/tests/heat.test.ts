import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEAT_BLOCK_IDS,
  hasHeatBelow,
  isHeat,
  isHeatSource,
  type HeatBlock,
} from "../scripts/stations/heat";

type States = Record<string, boolean | number | string>;

function block(typeId: string, states: States = {}, below?: HeatBlock): HeatBlock {
  return { typeId, permutation: { getAllStates: () => states }, below: () => below };
}

/** A station block with `typeId` directly below it. */
const over = (typeId: string, states: States = {}) =>
  block("hk:cooking_pot", {}, block(typeId, states));

describe("heat rule (D5)", () => {
  it("lists exactly the heat blocks", () => {
    assert.deepEqual([...HEAT_BLOCK_IDS].sort(), [
      "minecraft:campfire",
      "minecraft:fire",
      "minecraft:flowing_lava",
      "minecraft:lava",
      "minecraft:magma",
      "minecraft:soul_campfire",
      "minecraft:soul_fire",
    ]);
  });

  it("every heat block counts when it has no extinguished state", () => {
    for (const id of HEAT_BLOCK_IDS) assert.equal(isHeat(id, {}), true, id);
  });

  it("a lit campfire counts, an extinguished one doesn't", () => {
    for (const id of ["minecraft:campfire", "minecraft:soul_campfire"]) {
      assert.equal(isHeat(id, { extinguished: false, direction: 2 }), true, id);
      assert.equal(isHeat(id, { extinguished: true, direction: 2 }), false, id);
    }
  });

  it("other blocks don't count, whatever their states", () => {
    for (const id of [
      "minecraft:stone",
      "minecraft:furnace",
      "minecraft:lit_furnace",
      "minecraft:torch",
    ]) {
      assert.equal(isHeat(id, {}), false, id);
      assert.equal(isHeat(id, { extinguished: false }), false, id);
    }
  });

  it("checks the block directly below", () => {
    assert.equal(hasHeatBelow(over("minecraft:campfire", { extinguished: false })), true);
    assert.equal(hasHeatBelow(over("minecraft:campfire", { extinguished: true })), false);
    assert.equal(hasHeatBelow(over("minecraft:lava", { liquid_depth: 0 })), true);
    assert.equal(hasHeatBelow(over("minecraft:air")), false);
  });

  it("no block below (bottom of the world) or a throwing lookup means no heat", () => {
    assert.equal(hasHeatBelow(block("hk:cooking_pot")), false);
    const unloaded: HeatBlock = {
      ...block("hk:cooking_pot"),
      below: () => {
        throw new Error("LocationInUnloadedChunkError");
      },
    };
    assert.equal(hasHeatBelow(unloaded), false);
    assert.equal(isHeatSource(undefined), false);
  });
});
