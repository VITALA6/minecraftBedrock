import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { settleFacing } from "../scripts/posters/poster-logic";
import { ghostsFor, nearestPots, NO_GHOSTS } from "../scripts/stations/ghost-logic";
import {
  closestRecipe,
  finishJob,
  parseSaved,
  routeUse,
  stationPresence,
  type StationState,
} from "../scripts/stations/station-logic";

// Branches of the station, ghost and poster logic that the main tests don't reach: saved values
// with the wrong shape, contents nothing can be made from (an old pot's raw items), equal
// distances, and posters with too few parts.

const pot = stationById("pot") as ContainerStation;
const SOUP = "wm_kitchen:tomato_soup";
const SOUP_MIX = "wm_kitchen:tomato_soup_mix";

describe("saved form: wrong shapes", () => {
  it("items that aren't an object read as an empty pot", () => {
    for (const items of [[1, 2], "tomato", 5, null, true]) {
      const saved = parseSaved(JSON.stringify({ items }));
      assert.deepEqual(saved?.state, { items: {} }, JSON.stringify(items));
    }
  });

  it("a job or output that isn't an object is dropped", () => {
    const raw = JSON.stringify({ items: { [SOUP_MIX]: 1 }, job: [SOUP, 5, 10], out: SOUP });
    assert.deepEqual(parseSaved(raw)?.state, { items: { [SOUP_MIX]: 1 } });
  });

  it("a position with a non-number is dropped, the rest kept", () => {
    const saved = parseSaved(JSON.stringify({ st: "pot", dim: 3, pos: [1, "2", 3], items: {} }));
    assert.deepEqual(saved, {
      state: { items: {} },
      station: "pot",
      dim: undefined,
      pos: undefined,
    });
  });
});

describe("contents nothing can be made from (an old pot's raw items)", () => {
  // Pots saved before the mixes (D16) may still hold raw ingredients; the pot can't take them now.
  const stale: StationState = { items: { "wm_kitchen:tomato": 2, "minecraft:bowl": 1 } };

  it("has no closest recipe, no ghosts, and an empty hand gets the hint", () => {
    assert.equal(closestRecipe(pot, stale), undefined);
    assert.deepEqual(ghostsFor(pot, stale), NO_GHOSTS);
    assert.deepEqual(routeUse(pot, stale, undefined, false), { kind: "hint" });
    assert.deepEqual(routeUse(pot, stale, undefined, true), { kind: "take_all" });
  });

  it("a job whose ingredients went missing cancels and keeps what's there", () => {
    const state: StationState = {
      items: stale.items,
      job: { recipe: SOUP, ticks: 0, total: 100, servings: 1 },
    };
    const result = finishJob(state, () => true);
    assert.deepEqual(result, {
      kind: "cancelled",
      state: { items: stale.items },
      problem: `ingredients missing for ${SOUP}`,
    });
  });

  it("a job for a recipe removed in an update cancels", () => {
    const state: StationState = {
      items: { [SOUP_MIX]: 1 },
      job: { recipe: "wm_kitchen:removed", ticks: 0, total: 1, servings: 1 },
    };
    assert.equal(finishJob(state, () => true)?.kind, "cancelled");
    assert.equal(
      finishJob({ items: {} }, () => true),
      undefined,
      "no job, nothing to finish",
    );
  });

  it("the sweep tells a missing block from an unreadable one", () => {
    assert.equal(stationPresence(pot.block, pot.block), "here");
    assert.equal(stationPresence("minecraft:air", pot.block), "gone");
    assert.equal(stationPresence(undefined, pot.block), "unknown");
  });
});

describe("ghosts: equal distances", () => {
  it("pots at the same distance are ordered by key, so the choice is stable", () => {
    const at = (key: string, x: number, z: number) => ({
      key,
      dimension: "minecraft:overworld",
      location: { x, y: 64, z },
    });
    const viewer = { x: 0.5, y: 64.5, z: 0.5 };
    const pots = [at("c", 2, 0), at("a", -2, 0), at("b", 0, 2)];
    assert.deepEqual(
      nearestPots(viewer, "minecraft:overworld", pots, 6, 3).map((p) => p.key),
      ["a", "b", "c"],
    );
  });
});

describe("posters: too few parts", () => {
  it("no parts settle nothing; one part without a hint settles nothing", () => {
    assert.equal(
      settleFacing([], "north", () => true),
      undefined,
    );
    assert.equal(
      settleFacing([{ x: 0, y: 0, z: 0 }], undefined, () => true),
      undefined,
    );
    assert.equal(
      settleFacing([{ x: 0, y: 0, z: 0 }], "east", () => true),
      "east",
    );
    assert.equal(
      settleFacing([{ x: 0, y: 0, z: 0 }], "east", () => false),
      undefined,
    );
  });
});

describe("saved form: a damaged job", () => {
  const job = (ticks: unknown) =>
    parseSaved(
      `{"items":{"${SOUP_MIX}":1},"job":{"recipe":"${SOUP}","ticks":${String(ticks)},"total":100}}`,
    )?.state.job;

  it("more ticks left than the whole job are clamped to the job's length", () => {
    assert.equal(job(5000)?.ticks, 100);
    assert.equal(job(100)?.ticks, 100);
    assert.equal(job(-3)?.ticks, 0);
  });

  it("a ticks value that isn't finite drops the job (the ingredients stay)", () => {
    assert.equal(job("1e999"), undefined); // JSON reads 1e999 as Infinity
    assert.equal(job('"10"'), undefined);
  });
});
