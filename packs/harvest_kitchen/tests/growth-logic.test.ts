import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cropByKey, type Crop } from "../scripts/data/crops";
import {
  BONE_MEAL,
  grownStage,
  hasEnoughLight,
  isDryFarmland,
  pickResult,
  randomTickStage,
  readParams,
  useAction,
  type GrowthParams,
} from "../scripts/crops/growth-logic";

// The params in the block JSON (behavior/blocks/tomato_crop.json, chili_bush.json).
const CROP = readParams(
  { type: "crop", max_stage: 3, growth_chance: 0.5, dry_multiplier: 0.5, min_light: 9 },
  "test:crop",
);
const BUSH = readParams(
  { type: "bush", max_stage: 3, growth_chance: 0.3, dry_multiplier: 1, min_light: 9 },
  "test:bush",
);
const LIT = { blockLight: 0, skyLight: 15, dryFarmland: false };
const crop = (key: string) => cropByKey(key) as Crop;

describe("block params", () => {
  it("reads the JSON params", () => {
    assert.deepEqual(CROP, {
      type: "crop",
      maxStage: 3,
      growthChance: 0.5,
      dryMultiplier: 0.5,
      minLight: 9,
    });
    assert.equal(BUSH.type, "bush");
  });

  it("falls back to defaults for missing or out-of-range values", () => {
    const empty: GrowthParams = readParams(undefined, "test:none");
    assert.deepEqual(empty, {
      type: "crop",
      maxStage: 3,
      growthChance: 0.5,
      dryMultiplier: 0.5,
      minLight: 9,
    });
    const odd = readParams(
      { max_stage: 99, growth_chance: 2, min_light: -1, dry_multiplier: "x" },
      "test:odd",
    );
    assert.deepEqual(odd, empty);
    assert.equal(
      readParams({ type: "bush" }, "test:bush2").dryMultiplier,
      1,
      "bushes ignore hydration",
    );
    assert.equal(readParams({ max_stage: 2.7 }, "test:frac").maxStage, 2);
  });

  it("treats an unknown type as a crop and warns once per block", () => {
    const warnings: unknown[] = [];
    const warn = console.warn;
    console.warn = (...data: unknown[]) => warnings.push(data);
    try {
      assert.equal(readParams({ type: "tall" }, "test:tall").type, "crop");
      readParams({ type: "tall" }, "test:tall");
    } finally {
      console.warn = warn;
    }
    assert.equal(warnings.length, 1);
  });
});

describe("random tick growth", () => {
  it("advances one stage when the roll is under the chance", () => {
    assert.equal(randomTickStage(CROP, 0, LIT, 0.49), 1);
    assert.equal(randomTickStage(CROP, 2, LIT, 0), 3);
    assert.equal(randomTickStage(CROP, 0, LIT, 0.5), undefined);
  });

  it("stops at the last stage", () => {
    assert.equal(randomTickStage(CROP, 3, LIT, 0), undefined);
  });

  it("needs block light or sky light of at least min_light", () => {
    const dark = { blockLight: 8, skyLight: 8, dryFarmland: false };
    assert.equal(randomTickStage(CROP, 0, dark, 0), undefined);
    assert.equal(randomTickStage(CROP, 0, { ...dark, blockLight: 9 }, 0), 1, "torch light");
    assert.equal(randomTickStage(CROP, 0, { ...dark, skyLight: 9 }, 0), 1, "sky light");
    assert.equal(hasEnoughLight(15, 0, 9), true);
    assert.equal(hasEnoughLight(0, 0, 0), true);
  });

  it("crops grow at half speed on dry farmland", () => {
    const dry = { ...LIT, dryFarmland: true };
    assert.equal(randomTickStage(CROP, 0, dry, 0.24), 1);
    assert.equal(randomTickStage(CROP, 0, dry, 0.26), undefined);
  });

  it("bushes ignore hydration", () => {
    const dry = { ...LIT, dryFarmland: true };
    assert.equal(randomTickStage(BUSH, 0, dry, 0.29), 1);
    assert.equal(randomTickStage(BUSH, 0, dry, 0.3), undefined);
  });

  it("dry farmland: farmland with moisturized_amount 0 or missing", () => {
    assert.equal(isDryFarmland("minecraft:farmland", 0), true);
    assert.equal(isDryFarmland("minecraft:farmland", undefined), true);
    assert.equal(isDryFarmland("minecraft:farmland", 7), false);
    assert.equal(isDryFarmland("minecraft:farmland", 1), false);
    assert.equal(isDryFarmland("minecraft:grass_block", 0), false, "not farmland: not dry");
    assert.equal(isDryFarmland(undefined, undefined), false);
  });
});

describe("bone meal and picking", () => {
  it("bone meal advances one stage until mature", () => {
    assert.equal(grownStage(0, 3), 1);
    assert.equal(grownStage(2, 3), 3);
    assert.equal(grownStage(3, 3), undefined);
    assert.equal(grownStage(1, 3, 5), 3, "never past the last stage");
  });

  it("use: bone meal on a young crop or bush, nothing on a mature crop", () => {
    assert.equal(useAction(CROP, 0, BONE_MEAL), "bone_meal");
    assert.equal(useAction(BUSH, 2, BONE_MEAL), "bone_meal");
    assert.equal(useAction(CROP, 3, BONE_MEAL), "none");
    assert.equal(useAction(CROP, 1, undefined), "none");
    assert.equal(useAction(CROP, 1, "minecraft:wheat_seeds"), "none");
  });

  it("use: a mature bush is picked with anything in hand, bone meal included", () => {
    for (const held of [undefined, BONE_MEAL, "minecraft:stick"]) {
      assert.equal(useAction(BUSH, 3, held), "pick", String(held));
    }
    assert.equal(useAction(BUSH, 2, undefined), "none");
  });

  it("chili gives 1-3, strawberry 2-3, and both fall back to stage 2", () => {
    const counts = (key: string) =>
      [0, 0.34, 0.5, 0.67, 0.999].map((roll) => pickResult(crop(key), roll)?.count);
    assert.deepEqual(counts("chili"), [1, 2, 2, 3, 3]);
    assert.deepEqual(counts("strawberry"), [2, 2, 3, 3, 3]);
    assert.equal(pickResult(crop("chili"), 0)?.stage, 2);
    assert.equal(pickResult(crop("strawberry"), 0)?.stage, 2);
  });

  it("every roll gives a count inside the pick range", () => {
    for (const key of ["chili", "strawberry"]) {
      const { min, max } = crop(key).pick as { min: number; max: number };
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) seen.add(pickResult(crop(key), i / 1000)?.count ?? -1);
      assert.deepEqual(
        [...seen].sort(),
        Array.from({ length: max - min + 1 }, (_, i) => min + i),
      );
    }
  });

  it("crops that aren't bushes have no pick", () => {
    assert.equal(pickResult(crop("tomato"), 0), undefined);
  });
});
