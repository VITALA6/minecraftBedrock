import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CROPS,
  SEED_CHANCE_ANY_BIOME,
  SEED_CHANCE_IN_BIOME,
  cropByKey,
  type Crop,
} from "../scripts/data/crops";
import { rollSeed, seedChances } from "../scripts/crops/seed-roll";

const chances = (biome: string | undefined) =>
  Object.fromEntries(seedChances(biome).map(({ crop, chance }) => [crop.key, chance]));
const key = (biome: string | undefined, roll: number) => rollSeed(biome, roll)?.key;

describe("seed chances by biome", () => {
  it("5 % for crops of the biome, 1 % for the rest", () => {
    assert.deepEqual(chances("minecraft:plains"), {
      tomato: SEED_CHANCE_IN_BIOME,
      onion: SEED_CHANCE_IN_BIOME,
      cucumber: SEED_CHANCE_IN_BIOME,
      chili: SEED_CHANCE_ANY_BIOME,
      strawberry: SEED_CHANCE_ANY_BIOME,
      eggplant: SEED_CHANCE_IN_BIOME,
    });
    assert.equal(chances("minecraft:jungle").chili, SEED_CHANCE_IN_BIOME);
    assert.equal(chances("minecraft:savanna").eggplant, SEED_CHANCE_IN_BIOME);
    assert.equal(chances("minecraft:cherry_grove").strawberry, SEED_CHANCE_IN_BIOME);
  });

  it("any other biome, or an unknown one, gets the any-biome chance for every crop", () => {
    for (const biome of ["minecraft:desert", undefined, ""]) {
      for (const chance of Object.values(chances(biome)))
        assert.equal(chance, SEED_CHANCE_ANY_BIOME);
    }
  });

  it("the chances add up to less than 1 in every biome", () => {
    for (const biome of new Set(CROPS.flatMap((c) => c.biomes))) {
      const total = seedChances(biome).reduce((sum, { chance }) => sum + chance, 0);
      assert.ok(total < 1, `${biome}: ${total}`);
    }
  });
});

describe("one roll per break", () => {
  it("the roll picks one crop from consecutive ranges, in crop order", () => {
    // plains: tomato [0, .05), onion [.05, .10), cucumber [.10, .15), chili [.15, .16),
    // strawberry [.16, .17), eggplant [.17, .22), nothing above
    assert.deepEqual(
      [0, 0.025, 0.075, 0.125, 0.155, 0.165, 0.2, 0.25, 0.999].map((roll) =>
        key("minecraft:plains", roll),
      ),
      [
        "tomato",
        "tomato",
        "onion",
        "cucumber",
        "chili",
        "strawberry",
        "eggplant",
        undefined,
        undefined,
      ],
    );
  });

  it("falls back to the any-biome chances", () => {
    assert.deepEqual(
      [0.005, 0.015, 0.045, 0.055, 0.07].map((roll) => key("minecraft:desert", roll)),
      ["tomato", "onion", "strawberry", "eggplant", undefined],
    );
    assert.equal(key(undefined, 0.005), "tomato");
  });

  it("over every roll, each seed drops at its chance and at most one drops", () => {
    const steps = 100_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < steps; i++) {
      const crop = rollSeed("minecraft:savanna", i / steps);
      if (crop) counts.set(crop.key, (counts.get(crop.key) ?? 0) + 1);
    }
    // savanna: onion, chili and eggplant are local
    const expected: Record<string, number> = {
      tomato: 0.01,
      onion: 0.05,
      cucumber: 0.01,
      chili: 0.05,
      strawberry: 0.01,
      eggplant: 0.05,
    };
    for (const [k, chance] of Object.entries(expected)) {
      assert.ok(Math.abs((counts.get(k) ?? 0) - chance * steps) <= 1, `${k}: ${counts.get(k)}`);
    }
  });

  it("works on any crop list (the roll uses only the given crops)", () => {
    const onion = cropByKey("onion") as Crop;
    assert.equal(rollSeed("minecraft:plains", 0.04, [onion])?.key, "onion");
    assert.equal(rollSeed("minecraft:plains", 0.06, [onion]), undefined);
  });
});
