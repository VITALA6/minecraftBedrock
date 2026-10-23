import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_COOK_TICKS, STATION_SWEEP_TICKS } from "../scripts/config";
import { stationById, type ContainerStation, type StationId } from "../scripts/data/stations";
import {
  EMPTY,
  addItems,
  choiceOf,
  collectOutput,
  cookTicks,
  fillLevel,
  finishJob,
  isEmpty,
  itemLiquid,
  liquidOf,
  parseSaved,
  phaseOf,
  progressCells,
  routeUse,
  serializeSaved,
  sneakHandles,
  spillContents,
  startJob,
  stationPresence,
  sweepStep,
  takeAllItems,
  type StationJob,
  type StationState,
} from "../scripts/stations/station-logic";

// The pot cooks mixes (D16): each recipe is one mix in, one dish out, and every serving in the
// pot cooks at once. The raw ingredients go into the mix on the crafting table, not into the pot.

const pot = stationById("pot") as ContainerStation;
const TPS = 20;
const TOMATO = "hk:tomato";
const SOUP_MIX = "hk:tomato_soup_mix";
const STEW_MIX = "hk:vegetable_stew_mix";
const CHILI_MIX = "hk:chili_stew_mix";
const ONION_MIX = "hk:onion_soup_mix";
const SOUP = "hk:tomato_soup";
const soupReady: StationState = { items: { [SOUP_MIX]: 1 } };
const job = (ticks: number, total = 100, servings = 1): StationJob => ({
  recipe: SOUP,
  ticks,
  total,
  servings,
});
const cooking = (ticks: number, total = 100): StationState => ({
  items: soupReady.items,
  job: job(ticks, total),
});
const done: StationState = { items: {}, out: { item: SOUP, count: 1 } };
const hand = (typeId: string, amount = 1) => ({ typeId, amount });
const start = (state: StationState, id = SOUP, hot = true, fast = false) =>
  startJob(pot, state, id, { hot, fast, ticksPerSecond: TPS });

describe("phase", () => {
  it("idle, ready, cooking, done", () => {
    assert.equal(phaseOf(pot, EMPTY), "idle");
    assert.equal(phaseOf(pot, { items: { [TOMATO]: 1 } }), "idle", "a stale raw item");
    assert.equal(phaseOf(pot, soupReady), "ready");
    assert.equal(phaseOf(pot, cooking(50)), "cooking");
    assert.equal(phaseOf(pot, done), "done");
    // a finished dish wins over leftovers that could make another one
    assert.equal(phaseOf(pot, { ...soupReady, out: done.out }), "done");
  });

  it("isEmpty only when there are no items, no job and no output", () => {
    assert.equal(isEmpty(EMPTY), true);
    assert.equal(isEmpty(soupReady), false);
    assert.equal(isEmpty(done), false);
    assert.equal(isEmpty({ items: {}, job: job(1, 1) }), false);
  });
});

describe("fill level 0..3 from the item count (capacity 4)", () => {
  const level = (n: number, out = 0) =>
    fillLevel(
      pot,
      {
        items: n > 0 ? { [SOUP_MIX]: n } : {},
        ...(out ? { out: { item: SOUP, count: out } } : {}),
      },
      3,
    );

  it("holds 4 mixes", () => {
    assert.equal(pot.capacity, 4);
  });

  it("rises with each mix, any contents showing at least 1", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4].map((n) => level(n)),
      [0, 1, 2, 3, 3],
    );
  });

  it("counts finished dishes", () => {
    assert.equal(level(0, 1), 1);
    assert.equal(level(0, 4), 3);
  });

  it("never goes past the top level", () => {
    assert.equal(level(20), 3);
  });
});

describe("add", () => {
  it("puts a mix in and chimes: the dish is possible at once", () => {
    const first = addItems(pot, EMPTY, SOUP_MIX, 1);
    assert.ok(first.kind === "added");
    assert.deepEqual(first.state.items, { [SOUP_MIX]: 1 });
    assert.deepEqual(
      first.ready.map((r) => r.id),
      [SOUP],
    );
  });

  it("doesn't chime again for a dish that was already possible", () => {
    const more = addItems(pot, soupReady, SOUP_MIX, 1);
    assert.equal(more.kind === "added" && more.ready.length, 0);
  });

  it("lists every possible dish when a new one appears", () => {
    const result = addItems(pot, soupReady, STEW_MIX, 1);
    assert.ok(result.kind === "added");
    assert.deepEqual(
      result.ready.map((r) => r.id),
      [SOUP, "hk:vegetable_stew"],
    );
  });

  it("refuses a raw ingredient, naming the mixes it goes into", () => {
    const tomato = addItems(pot, EMPTY, TOMATO, 1);
    assert.ok(tomato.kind === "refused");
    assert.ok(tomato.madeInto.includes(SOUP_MIX));
    assert.ok(tomato.madeInto.every((id) => id.endsWith("_mix")));
    const bowl = addItems(pot, EMPTY, "minecraft:bowl", 1);
    assert.ok(bowl.kind === "refused" && bowl.madeInto.length >= 8);
  });

  it("refuses non-ingredients with nothing to suggest", () => {
    for (const id of ["minecraft:dirt", SOUP, "hk:sliced_tomato"]) {
      const result = addItems(pot, EMPTY, id, 1);
      assert.ok(result.kind === "refused", id);
      assert.deepEqual(result.madeInto, [], id);
    }
  });

  it("caps a stack at the room left and refuses a full pot", () => {
    const three: StationState = { items: { [SOUP_MIX]: 3 } };
    const result = addItems(pot, three, SOUP_MIX, 16);
    assert.ok(result.kind === "added");
    assert.equal(result.amount, 1);
    assert.deepEqual(result.state.items, { [SOUP_MIX]: 4 });
    assert.equal(addItems(pot, result.state, STEW_MIX, 1).kind, "full");
  });

  it("does nothing for a count of 0", () => {
    assert.equal(addItems(pot, EMPTY, SOUP_MIX, 0).kind, "none");
  });

  it("won't add while cooking or while a dish waits", () => {
    assert.equal(addItems(pot, cooking(50), SOUP_MIX, 1).kind, "cooking");
    assert.equal(addItems(pot, done, SOUP_MIX, 1).kind, "done");
  });
});

describe("take all", () => {
  it("takes everything out, leaving it empty", () => {
    const result = takeAllItems({ items: { [SOUP_MIX]: 2, [TOMATO]: 1 } });
    assert.deepEqual(result?.items, [
      [SOUP_MIX, 2],
      [TOMATO, 1],
    ]);
    assert.equal(result && isEmpty(result.state), true);
  });

  it("take-all does nothing when empty, cooking or done", () => {
    assert.equal(takeAllItems(EMPTY), undefined);
    assert.equal(takeAllItems(cooking(50)), undefined);
    assert.equal(takeAllItems(done), undefined);
  });
});

describe("use routing (plan §2.3)", () => {
  const both: StationState = { items: { [SOUP_MIX]: 1, [STEW_MIX]: 1 } };
  const stale: StationState = { items: { [TOMATO]: 2 } }; // saved before mixes (D9: no migration)

  it("empty hand: one possible dish starts cooking, no form", () => {
    assert.deepEqual(routeUse(pot, soupReady, undefined, false), { kind: "cook", recipe: SOUP });
    assert.deepEqual(routeUse(pot, { items: { [SOUP_MIX]: 3 } }, undefined, false), {
      kind: "cook",
      recipe: SOUP,
    });
  });

  it("empty hand: several possible dishes open the choice form, listing them", () => {
    assert.deepEqual(routeUse(pot, both, undefined, false), {
      kind: "choose",
      recipes: [SOUP, "hk:vegetable_stew"],
    });
  });

  it("empty hand on items that make nothing (an old pot's raw items): the hint, no form", () => {
    assert.deepEqual(routeUse(pot, stale, undefined, false), { kind: "hint" });
  });

  it("empty hand on an empty pot: the hint, sneaking or not", () => {
    assert.deepEqual(routeUse(pot, EMPTY, undefined, false), { kind: "hint" });
    assert.deepEqual(routeUse(pot, EMPTY, undefined, true), { kind: "hint" });
  });

  it("holding an item adds one; sneaking with a mix adds the stack", () => {
    assert.deepEqual(routeUse(pot, EMPTY, hand(SOUP_MIX, 5), false), {
      kind: "add",
      typeId: SOUP_MIX,
      count: 1,
    });
    assert.deepEqual(routeUse(pot, EMPTY, hand(SOUP_MIX, 5), true), {
      kind: "add",
      typeId: SOUP_MIX,
      count: 5,
    });
  });

  it("sneaking with a raw ingredient adds one (and gets the mix hint), like a plain use", () => {
    assert.equal(sneakHandles(pot, TOMATO), false);
    assert.equal(sneakHandles(pot, SOUP_MIX), true);
    assert.deepEqual(routeUse(pot, EMPTY, hand(TOMATO, 64), true), {
      kind: "add",
      typeId: TOMATO,
      count: 1,
    });
  });

  it("sneak + empty hand takes everything out", () => {
    assert.equal(sneakHandles(pot, undefined), true);
    assert.deepEqual(routeUse(pot, soupReady, undefined, true), { kind: "take_all" });
    assert.deepEqual(routeUse(pot, stale, undefined, true), { kind: "take_all" });
  });

  it("cooking shows progress and done collects, whatever the hand", () => {
    for (const held of [undefined, hand(SOUP_MIX), hand("minecraft:dirt")]) {
      for (const sneaking of [false, true]) {
        assert.deepEqual(routeUse(pot, cooking(50), held, sneaking), { kind: "progress" });
        assert.deepEqual(routeUse(pot, done, held, sneaking), { kind: "collect" });
      }
    }
  });
});

describe("the choice form (D15: only when there's a real choice)", () => {
  const both: StationState = { items: { [SOUP_MIX]: 1, [ONION_MIX]: 2 } };

  it("offers dishes only while two or more are possible", () => {
    assert.deepEqual(
      choiceOf(pot, both).map((r) => r.id),
      [SOUP, "hk:onion_soup"],
    );
    assert.deepEqual(choiceOf(pot, soupReady), []);
    assert.deepEqual(choiceOf(pot, { items: { [SOUP_MIX]: 4 } }), [], "one dish, 4 servings");
    assert.deepEqual(choiceOf(pot, EMPTY), []);
  });

  it("offers nothing once someone else started cooking or the dish is done", () => {
    assert.deepEqual(choiceOf(pot, { ...both, job: job(5, 10) }), []);
    assert.deepEqual(choiceOf(pot, { ...both, out: { item: SOUP, count: 1 } }), []);
  });

  it("routing opens the form exactly when there's a choice", () => {
    const states: StationState[] = [EMPTY, soupReady, both, cooking(50), done];
    for (const state of states) {
      for (const sneaking of [false, true]) {
        const action = routeUse(pot, state, undefined, sneaking);
        assert.equal(action.kind === "choose", choiceOf(pot, state).length > 0 && !sneaking);
      }
    }
  });
});

describe("start cooking", () => {
  it("starts with the recipe's cook time in ticks, one serving per mix", () => {
    const result = start(soupReady);
    assert.ok(result.kind === "started");
    assert.deepEqual(result.state.job, { recipe: SOUP, ticks: 100, total: 100, servings: 1 });
    assert.deepEqual(result.state.items, soupReady.items, "the mix stays in, locked");
  });

  it("cooks every serving of the chosen dish at once, in the same time", () => {
    const result = start({ items: { [SOUP_MIX]: 3, [STEW_MIX]: 1 } });
    assert.ok(result.kind === "started");
    assert.deepEqual(result.state.job, { recipe: SOUP, ticks: 100, total: 100, servings: 3 });
  });

  it("debug fast mode starts every job at FAST_COOK_TICKS", () => {
    const result = start(soupReady, SOUP, true, true);
    assert.ok(result.kind === "started");
    assert.equal(result.state.job?.ticks, FAST_COOK_TICKS);
  });

  it("refuses without heat", () => {
    assert.equal(start(soupReady, SOUP, false).kind, "no_heat");
  });

  it("names the missing mix", () => {
    const result = start({ items: { [STEW_MIX]: 1 } });
    assert.ok(result.kind === "missing");
    assert.deepEqual(result.first.ingredient.items, [SOUP_MIX]);
    assert.equal(result.first.missing, 1);
  });

  it("a missing mix is reported before missing heat", () => {
    assert.equal(start({ items: { [STEW_MIX]: 1 } }, SOUP, false).kind, "missing");
  });

  it("refuses when the pot changed under a form (busy or done)", () => {
    assert.equal(start(cooking(50)).kind, "changed");
    assert.equal(start({ ...soupReady, out: done.out }).kind, "changed");
  });

  it("ignores unknown recipes and other stations' recipes", () => {
    assert.equal(start(soupReady, "hk:nope").kind, "unknown");
    const oven = { ...pot, id: "oven" as StationId };
    assert.equal(
      startJob(oven, soupReady, SOUP, { hot: true, fast: false, ticksPerSecond: 20 }).kind,
      "unknown",
    );
  });

  it("cook time rounds to whole ticks and is at least 1", () => {
    const soup = { id: "x", station: "pot" as const, result: SOUP, count: 1, ingredients: [] };
    assert.equal(cookTicks({ ...soup, seconds: 5 }, false, TPS), 100);
    assert.equal(cookTicks({ ...soup, seconds: 0.01 }, false, TPS), 1);
    assert.equal(cookTicks({ ...soup, seconds: 1.26 }, false, TPS), 25);
  });
});

describe("the countdown", () => {
  const run = (start: StationJob, sweeps: number, hot = true, fast = false) => {
    let current: StationJob = start;
    for (let i = 0; i < sweeps; i++) {
      const step = sweepStep(current, hot, fast);
      if (step.kind === "due") return { due: true, after: i + 1, job: current };
      if (step.kind === "cooking") current = step.job;
    }
    return { due: false, after: sweeps, job: current };
  };

  it("counts down STATION_SWEEP_TICKS per sweep and is due when it reaches 0", () => {
    const full = job(100);
    assert.deepEqual(sweepStep(full, true, false), {
      kind: "cooking",
      job: { ...full, ticks: 100 - STATION_SWEEP_TICKS },
    });
    const result = run(full, 50);
    assert.equal(result.due, true);
    assert.equal(result.after, 100 / STATION_SWEEP_TICKS);
  });

  it("keeps the servings while it counts down", () => {
    const step = sweepStep(job(100, 100, 3), true, false);
    assert.ok(step.kind === "cooking");
    assert.equal(step.job.servings, 3);
  });

  it("pauses without heat: the ticks left stay as they are", () => {
    const paused = job(60);
    assert.deepEqual(sweepStep(paused, false, false), { kind: "paused" });
    assert.deepEqual(run(paused, 1000, false), { due: false, after: 1000, job: paused });
  });

  it("resumes where it paused once the heat is back", () => {
    const paused = run(job(100), 4).job;
    assert.equal(paused.ticks, 60);
    assert.equal(run(paused, 10, false).job.ticks, 60);
    assert.equal(run(paused, 10).after, 6);
  });

  it("fast mode finishes a running job within FAST_COOK_TICKS", () => {
    const result = run(job(200, 200), 50, true, true);
    assert.equal(result.due, true);
    assert.equal(result.after, FAST_COOK_TICKS / STATION_SWEEP_TICKS);
  });

  it("fast mode doesn't slow down a job that's nearly done", () => {
    assert.equal(run(job(5), 5, true, true).after, 1);
  });

  it("a saved job with 0 ticks left is due on the next sweep", () => {
    assert.deepEqual(sweepStep(job(0), true, false), { kind: "due" });
  });

  it("progress cells fill from 0 to 5", () => {
    const cells = (ticks: number) => progressCells(job(ticks));
    assert.deepEqual([100, 81, 80, 50, 10, 0].map(cells), [0, 0, 1, 2, 4, 5]);
    assert.equal(cells(150), 0, "clamped");
  });
});

describe("finish and collect", () => {
  const loaded = () => true;

  it("consumes the mix and leaves the dish as output", () => {
    const result = finishJob(cooking(0), loaded);
    assert.ok(result?.kind === "finished");
    assert.deepEqual(result.state, { items: {}, out: { item: SOUP, count: 1 } });
    assert.equal(phaseOf(pot, result.state), "done");
  });

  it("a batch makes one dish per serving and keeps the other mixes", () => {
    const state: StationState = {
      items: { [SOUP_MIX]: 3, [STEW_MIX]: 1 },
      job: job(0, 100, 3),
    };
    const result = finishJob(state, loaded);
    assert.ok(result?.kind === "finished");
    assert.deepEqual(result.state, { items: { [STEW_MIX]: 1 }, out: { item: SOUP, count: 3 } });
  });

  it("never makes more servings than are still inside", () => {
    const result = finishJob({ items: { [SOUP_MIX]: 2 }, job: job(0, 100, 4) }, loaded);
    assert.ok(result?.kind === "finished");
    assert.deepEqual(result.state.out, { item: SOUP, count: 2 });
  });

  it("cancels, keeping the ingredients, for an unknown recipe", () => {
    const result = finishJob(
      { items: { [SOUP_MIX]: 2 }, job: { ...job(0, 1), recipe: "hk:gone" } },
      loaded,
    );
    assert.ok(result?.kind === "cancelled");
    assert.deepEqual(result.state, { items: { [SOUP_MIX]: 2 } });
    assert.match(result.problem, /unknown recipe/);
  });

  it("cancels when the mix is no longer there", () => {
    const result = finishJob({ items: { [STEW_MIX]: 1 }, job: job(0, 1) }, loaded);
    assert.ok(result?.kind === "cancelled");
    assert.deepEqual(result.state.items, { [STEW_MIX]: 1 });
  });

  it("cancels when the result item didn't load", () => {
    const result = finishJob(cooking(0), () => false);
    assert.ok(result?.kind === "cancelled");
    assert.deepEqual(result.state, soupReady);
    assert.match(result.problem, /isn't loaded/);
  });

  it("does nothing without a job", () => {
    assert.equal(finishJob(soupReady, loaded), undefined);
  });

  it("collect hands out the dishes and keeps leftovers", () => {
    const result = collectOutput({ items: { [STEW_MIX]: 1 }, out: { item: SOUP, count: 2 } });
    assert.deepEqual(result, {
      out: { item: SOUP, count: 2 },
      state: { items: { [STEW_MIX]: 1 } },
    });
    assert.equal(phaseOf(pot, result.state), "ready");
    assert.equal(collectOutput(soupReady), undefined);
  });

  it("a full cycle: idle -> ready -> cooking -> done -> idle, 2 soups from 2 mixes", () => {
    let state: StationState = EMPTY;
    const added = addItems(pot, state, SOUP_MIX, 2);
    assert.ok(added.kind === "added");
    state = added.state;
    assert.equal(phaseOf(pot, state), "ready");
    const started = start(state);
    assert.ok(started.kind === "started");
    state = started.state;
    assert.equal(phaseOf(pot, state), "cooking");
    for (let step = sweepStep(state.job as StationJob, true, false); step.kind !== "due";) {
      assert.ok(step.kind === "cooking");
      state = { ...state, job: step.job };
      step = sweepStep(step.job, true, false);
    }
    const finished = finishJob(state, loaded);
    assert.ok(finished?.kind === "finished");
    assert.equal(phaseOf(pot, finished.state), "done");
    assert.equal(finished.state.out?.count, 2);
    const collected = collectOutput(finished.state);
    assert.ok(collected);
    assert.equal(isEmpty(collected.state), true);
  });
});

describe("spill on break", () => {
  it("drops the mixes of a running job", () => {
    assert.deepEqual(spillContents(cooking(40)), [[SOUP_MIX, 1]]);
  });

  it("drops finished dishes and any leftovers", () => {
    assert.deepEqual(spillContents({ items: { [STEW_MIX]: 1 }, out: { item: SOUP, count: 2 } }), [
      [STEW_MIX, 1],
      [SOUP, 2],
    ]);
  });

  it("drops nothing when empty", () => {
    assert.deepEqual(spillContents(EMPTY), []);
  });
});

describe("the sweep finds the station gone (audit 2026-10-23)", () => {
  it("sweeps a station that is still there", () => {
    assert.equal(stationPresence(pot.block, pot.block), "here");
  });

  it("spills only where a different block really stands (/setblock, /fill)", () => {
    assert.equal(stationPresence("minecraft:air", pot.block), "gone");
    assert.equal(stationPresence("minecraft:stone", pot.block), "gone");
  });

  it("leaves a station alone when no block could be read (unloaded or non-ticking chunk)", () => {
    // isChunkLoaded can be true while getBlock returns undefined: spilling then would drop the
    // contents next to a pot that is still there.
    assert.equal(stationPresence(undefined, pot.block), "unknown");
  });
});

describe("saved form", () => {
  const pos = { x: 10, y: 64, z: -3 };

  it("round-trips a station with items, a job and an output", () => {
    const state: StationState = {
      items: { [SOUP_MIX]: 3 },
      job: job(60, 100, 3),
      out: { item: SOUP, count: 1 },
    };
    const parsed = parseSaved(serializeSaved("pot", "minecraft:overworld", pos, state));
    assert.deepEqual(parsed, { state, station: "pot", dim: "minecraft:overworld", pos });
  });

  it("leaves out an absent job and output", () => {
    const raw = serializeSaved("pot", "minecraft:overworld", pos, soupReady);
    assert.equal(raw.includes("job"), false);
    assert.deepEqual(parseSaved(raw)?.state, soupReady);
  });

  it("reads a job saved before batch cooking as one serving", () => {
    const raw = JSON.stringify({ items: {}, job: { recipe: SOUP, ticks: 5, total: 100 } });
    assert.deepEqual(parseSaved(raw)?.state.job, job(5));
    const bad = JSON.stringify({ items: {}, job: { ...job(5), servings: 0 } });
    assert.equal(parseSaved(bad)?.state.job?.servings, 1);
  });

  it("rejects anything that isn't a JSON object", () => {
    for (const raw of ["", "{", "[]", "null", "42", '"pot"'])
      assert.equal(parseSaved(raw), undefined, raw);
  });

  it("drops malformed parts and keeps the rest", () => {
    const raw = JSON.stringify({
      st: 5,
      dim: "minecraft:nether",
      pos: [1, 2],
      items: { [SOUP_MIX]: 2, a: 0, b: -1, c: 1.5, d: "3" },
      job: { recipe: SOUP, ticks: 10, total: 0 },
      out: { item: SOUP, count: 0 },
    });
    assert.deepEqual(parseSaved(raw), {
      state: { items: { [SOUP_MIX]: 2 } },
      station: undefined,
      dim: "minecraft:nether",
      pos: undefined,
    });
  });

  it("clamps job ticks to whole, non-negative numbers", () => {
    const ticks = (n: number) =>
      parseSaved(JSON.stringify({ items: {}, job: { recipe: SOUP, ticks: n, total: 100 } }))?.state
        .job?.ticks;
    assert.equal(ticks(-5), 0);
    assert.equal(ticks(12.7), 12);
  });
});

describe("liquid colour (what the pot shows)", () => {
  it("each mix colours it as its dish; a raw item or a bowl doesn't", () => {
    assert.equal(itemLiquid(pot, SOUP_MIX), "tomato");
    assert.equal(itemLiquid(pot, CHILI_MIX), "chili");
    assert.equal(itemLiquid(pot, "hk:stuffed_eggplant_mix"), "eggplant");
    assert.equal(itemLiquid(pot, "hk:eggplant_curry_mix"), "curry");
    assert.equal(itemLiquid(pot, TOMATO), undefined);
    assert.equal(itemLiquid(pot, "minecraft:bowl"), undefined);
  });

  it("an empty pot, or one with only stale raw items, is clear water", () => {
    assert.equal(liquidOf(pot, EMPTY), "water");
    assert.equal(liquidOf(pot, { items: { [TOMATO]: 2 } }), "water");
  });

  it("one kind of mix: that dish's colour", () => {
    assert.equal(liquidOf(pot, soupReady), "tomato");
    assert.equal(liquidOf(pot, { items: { [ONION_MIX]: 3 } }), "broth");
    assert.equal(liquidOf(pot, { items: { "hk:strawberry_jam_mix": 1 } }), "jam");
  });

  it("several kinds: the colour there's most of, ties to the stronger colour", () => {
    assert.equal(liquidOf(pot, { items: { [SOUP_MIX]: 1, [ONION_MIX]: 2 } }), "broth");
    assert.equal(liquidOf(pot, { items: { [ONION_MIX]: 1, [CHILI_MIX]: 1 } }), "chili");
    assert.equal(liquidOf(pot, { items: { [CHILI_MIX]: 1, [ONION_MIX]: 1 } }), "chili");
    assert.equal(liquidOf(pot, { items: { "hk:fish_chowder_mix": 1, [SOUP_MIX]: 1 } }), "tomato");
  });

  it("cooking: the job's dish, whatever else is waiting", () => {
    assert.equal(liquidOf(pot, cooking(50)), "tomato");
    const stew: StationState = {
      items: { [CHILI_MIX]: 1, [ONION_MIX]: 3 },
      job: { ...job(10, 200), recipe: "hk:chili_stew" },
    };
    assert.equal(liquidOf(pot, stew), "chili");
  });

  it("done: the finished dish, also with leftovers of another colour", () => {
    assert.equal(liquidOf(pot, done), "tomato");
    const chowder: StationState = {
      items: { [CHILI_MIX]: 2 },
      out: { item: "hk:fish_chowder", count: 1 },
    };
    assert.equal(liquidOf(pot, chowder), "cream");
  });

  it("an unknown job or output falls back to the contents", () => {
    assert.equal(
      liquidOf(pot, { items: { [ONION_MIX]: 1 }, job: { ...job(1, 1), recipe: "hk:gone" } }),
      "broth",
    );
    assert.equal(liquidOf(pot, { items: {}, out: { item: "hk:gone", count: 1 } }), "water");
  });

  it("follows the pot through add, cook, finish, collect and take out", () => {
    let state: StationState = EMPTY;
    const add = (id: string, n = 1) => {
      const result = addItems(pot, state, id, n);
      assert.ok(result.kind === "added");
      state = result.state;
    };
    add(ONION_MIX);
    assert.equal(liquidOf(pot, state), "broth");
    add(SOUP_MIX, 2);
    assert.equal(liquidOf(pot, state), "tomato"); // 2 tomato soup mixes outweigh 1 onion
    const started = start(state);
    assert.ok(started.kind === "started");
    state = started.state;
    assert.equal(liquidOf(pot, state), "tomato");
    const finished = finishJob({ ...state, job: { ...state.job!, ticks: 0 } }, () => true);
    assert.ok(finished?.kind === "finished");
    state = finished.state;
    assert.equal(liquidOf(pot, state), "tomato");
    const collected = collectOutput(state);
    assert.ok(collected);
    state = collected.state; // the onion soup mix is left
    assert.equal(liquidOf(pot, state), "broth");
    const all = takeAllItems(state);
    assert.ok(all);
    assert.equal(liquidOf(pot, all.state), "water");
  });
});
