import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_COOK_TICKS, STATION_SWEEP_TICKS } from "../scripts/config";
import { stationById, type ContainerStation, type StationId } from "../scripts/data/stations";
import {
  EMPTY,
  addItems,
  collectOutput,
  cookTicks,
  fillLevel,
  finishJob,
  isEmpty,
  parseSaved,
  phaseOf,
  progressCells,
  routeUse,
  serializeSaved,
  showsScreen,
  sneakHandles,
  spillContents,
  startJob,
  sweepStep,
  takeAllItems,
  takeOutItems,
  type StationJob,
  type StationState,
} from "../scripts/stations/station-logic";

const pot = stationById("pot") as ContainerStation;
const TPS = 20;
const TOMATO = "hk:tomato";
const BOWL = "minecraft:bowl";
const SOUP = "hk:tomato_soup";
const soupReady: StationState = { items: { [TOMATO]: 2, [BOWL]: 1 } };
const cooking = (ticks: number, total = 100): StationState => ({
  items: soupReady.items,
  job: { recipe: SOUP, ticks, total },
});
const done: StationState = { items: {}, out: { item: SOUP, count: 1 } };
const hand = (typeId: string, amount = 1) => ({ typeId, amount });
const start = (state: StationState, id = SOUP, hot = true, fast = false) =>
  startJob(pot, state, id, { hot, fast, ticksPerSecond: TPS });

describe("phase", () => {
  it("idle, ready, cooking, done", () => {
    assert.equal(phaseOf(pot, EMPTY), "idle");
    assert.equal(phaseOf(pot, { items: { [TOMATO]: 1 } }), "idle");
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
    assert.equal(isEmpty({ items: {}, job: { recipe: SOUP, ticks: 1, total: 1 } }), false);
  });
});

describe("fill level 0..3 from the item count (capacity 8)", () => {
  const level = (n: number, out = 0) =>
    fillLevel(
      pot,
      { items: n > 0 ? { [TOMATO]: n } : {}, ...(out ? { out: { item: SOUP, count: out } } : {}) },
      3,
    );

  it("rises in thirds of the capacity, any contents showing at least 1", () => {
    assert.deepEqual(
      [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => level(n)),
      [0, 1, 1, 2, 2, 2, 3, 3, 3],
    );
  });

  it("counts a finished dish", () => {
    assert.equal(level(0, 1), 1);
  });

  it("never goes past the top level", () => {
    assert.equal(level(20), 3);
  });
});

describe("add", () => {
  it("puts an ingredient in and chimes when a dish becomes possible", () => {
    const first = addItems(pot, EMPTY, TOMATO, 1);
    assert.equal(first.kind, "added");
    if (first.kind !== "added") return;
    assert.deepEqual(first.state.items, { [TOMATO]: 1 });
    assert.deepEqual(first.ready, []);

    const second = addItems(pot, { items: { [TOMATO]: 1, [BOWL]: 1 } }, TOMATO, 1);
    assert.equal(second.kind, "added");
    if (second.kind !== "added") return;
    assert.deepEqual(
      second.ready.map((r) => r.id),
      [SOUP],
    );
  });

  it("doesn't chime again for a dish that was already possible", () => {
    const more = addItems(pot, soupReady, TOMATO, 1);
    assert.equal(more.kind === "added" && more.ready.length, 0);
  });

  it("lists every possible dish when a new one appears", () => {
    const items = { [TOMATO]: 2, "hk:onion": 1, "minecraft:carrot": 1, [BOWL]: 1 };
    const result = addItems(pot, { items }, "minecraft:potato", 1);
    assert.ok(result.kind === "added");
    assert.deepEqual(
      result.ready.map((r) => r.id),
      [SOUP, "hk:vegetable_stew"],
    );
  });

  it("refuses non-ingredients", () => {
    assert.equal(addItems(pot, EMPTY, "minecraft:dirt", 1).kind, "refused");
    assert.equal(addItems(pot, EMPTY, "hk:tomato_soup", 1).kind, "refused");
  });

  it("caps a stack at the room left and refuses a full pot", () => {
    const seven: StationState = { items: { [TOMATO]: 7 } };
    const result = addItems(pot, seven, TOMATO, 16);
    assert.ok(result.kind === "added");
    assert.equal(result.amount, 1);
    assert.deepEqual(result.state.items, { [TOMATO]: 8 });
    assert.equal(addItems(pot, result.state, BOWL, 1).kind, "full");
  });

  it("does nothing for a count of 0", () => {
    assert.equal(addItems(pot, EMPTY, TOMATO, 0).kind, "none");
  });

  it("won't add while cooking or while a dish waits", () => {
    assert.equal(addItems(pot, cooking(50), TOMATO, 1).kind, "cooking");
    assert.equal(addItems(pot, done, TOMATO, 1).kind, "done");
  });
});

describe("take out / take all", () => {
  it("takes out every item of one type", () => {
    const result = takeOutItems({ items: { [TOMATO]: 2, [BOWL]: 1 } }, TOMATO);
    assert.deepEqual(result, { count: 2, state: { items: { [BOWL]: 1 } } });
  });

  it("refuses an item that isn't there, or while cooking", () => {
    assert.equal(takeOutItems(soupReady, "hk:onion"), undefined);
    assert.equal(takeOutItems(cooking(50), TOMATO), undefined);
  });

  it("takes everything out, leaving it empty", () => {
    const result = takeAllItems(soupReady);
    assert.deepEqual(result?.items, [
      [TOMATO, 2],
      [BOWL, 1],
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
  const onion = { items: { "hk:onion": 1 } };
  const both = {
    items: { [TOMATO]: 2, "hk:onion": 1, "minecraft:carrot": 1, "minecraft:potato": 1, [BOWL]: 1 },
  };

  it("empty hand: one possible dish starts cooking, no form", () => {
    assert.deepEqual(routeUse(pot, soupReady, undefined, false), { kind: "cook", recipe: SOUP });
  });

  it("empty hand: several possible dishes open the pot screen", () => {
    assert.deepEqual(routeUse(pot, both, undefined, false), { kind: "screen" });
  });

  it("empty hand: idle with items opens the pot screen (Almost!)", () => {
    assert.deepEqual(routeUse(pot, onion, undefined, false), { kind: "screen" });
  });

  it("empty hand on an empty pot: the hint, sneaking or not", () => {
    assert.deepEqual(routeUse(pot, EMPTY, undefined, false), { kind: "hint" });
    assert.deepEqual(routeUse(pot, EMPTY, undefined, true), { kind: "hint" });
  });

  it("holding an item adds one; sneaking adds the stack", () => {
    assert.deepEqual(routeUse(pot, EMPTY, hand(TOMATO, 5), false), {
      kind: "add",
      typeId: TOMATO,
      count: 1,
    });
    assert.deepEqual(routeUse(pot, EMPTY, hand(TOMATO, 5), true), {
      kind: "add",
      typeId: TOMATO,
      count: 5,
    });
  });

  it("sneaking with a non-ingredient adds one (and gets refused), like a plain use", () => {
    assert.equal(sneakHandles(pot, "minecraft:dirt"), false);
    assert.deepEqual(routeUse(pot, EMPTY, hand("minecraft:dirt", 64), true), {
      kind: "add",
      typeId: "minecraft:dirt",
      count: 1,
    });
  });

  it("sneak + empty hand takes everything out", () => {
    assert.equal(sneakHandles(pot, undefined), true);
    assert.deepEqual(routeUse(pot, soupReady, undefined, true), { kind: "take_all" });
  });

  it("cooking shows progress and done collects, whatever the hand", () => {
    for (const held of [undefined, hand(TOMATO), hand("minecraft:dirt")]) {
      for (const sneaking of [false, true]) {
        assert.deepEqual(routeUse(pot, cooking(50), held, sneaking), { kind: "progress" });
        assert.deepEqual(routeUse(pot, done, held, sneaking), { kind: "collect" });
      }
    }
  });
});

describe("the pot screen (CR3)", () => {
  const onion = { items: { "hk:onion": 1 } };

  it("shows while idle or ready with something inside", () => {
    assert.equal(showsScreen(pot, onion), true);
    assert.equal(showsScreen(pot, soupReady), true);
  });

  it("doesn't reopen once the last ingredient is out: an empty pot gets the hint", () => {
    const last = takeOutItems(onion, "hk:onion");
    assert.ok(last);
    assert.equal(showsScreen(pot, last.state), false);
    assert.equal(showsScreen(pot, EMPTY), false);
  });

  it("closes when someone else started cooking or the dish is done", () => {
    assert.equal(showsScreen(pot, cooking(50)), false);
    assert.equal(showsScreen(pot, done), false);
  });

  it("whenever routing opens the screen, it has something to show", () => {
    const states: StationState[] = [EMPTY, onion, soupReady, cooking(50), done];
    for (const state of states) {
      for (const sneaking of [false, true]) {
        if (routeUse(pot, state, undefined, sneaking).kind === "screen") {
          assert.equal(showsScreen(pot, state), true);
        }
      }
    }
  });
});

describe("start cooking", () => {
  it("starts with the recipe's cook time in ticks", () => {
    const result = start(soupReady);
    assert.ok(result.kind === "started");
    assert.deepEqual(result.state.job, { recipe: SOUP, ticks: 100, total: 100 });
    assert.deepEqual(result.state.items, soupReady.items, "ingredients stay in, locked");
  });

  it("debug fast mode starts every job at FAST_COOK_TICKS", () => {
    const result = start(soupReady, SOUP, true, true);
    assert.ok(result.kind === "started");
    assert.equal(result.state.job?.ticks, FAST_COOK_TICKS);
  });

  it("refuses without heat", () => {
    assert.equal(start(soupReady, SOUP, false).kind, "no_heat");
  });

  it("names the first missing item", () => {
    const result = start({ items: { [TOMATO]: 1 } });
    assert.ok(result.kind === "missing");
    assert.deepEqual(result.first.ingredient.items, [TOMATO]);
    assert.equal(result.first.missing, 1);
  });

  it("missing items are reported before missing heat", () => {
    assert.equal(start({ items: { [TOMATO]: 1 } }, SOUP, false).kind, "missing");
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
  const run = (job: StationJob, sweeps: number, hot = true, fast = false) => {
    let current: StationJob = job;
    for (let i = 0; i < sweeps; i++) {
      const step = sweepStep(current, hot, fast);
      if (step.kind === "due") return { due: true, after: i + 1, job: current };
      if (step.kind === "cooking") current = step.job;
    }
    return { due: false, after: sweeps, job: current };
  };

  it("counts down STATION_SWEEP_TICKS per sweep and is due when it reaches 0", () => {
    const job = { recipe: SOUP, ticks: 100, total: 100 };
    assert.deepEqual(sweepStep(job, true, false), {
      kind: "cooking",
      job: { ...job, ticks: 100 - STATION_SWEEP_TICKS },
    });
    const result = run(job, 50);
    assert.equal(result.due, true);
    assert.equal(result.after, 100 / STATION_SWEEP_TICKS);
  });

  it("pauses without heat: the ticks left stay as they are", () => {
    const job = { recipe: SOUP, ticks: 60, total: 100 };
    assert.deepEqual(sweepStep(job, false, false), { kind: "paused" });
    assert.deepEqual(run(job, 1000, false), { due: false, after: 1000, job });
  });

  it("resumes where it paused once the heat is back", () => {
    const paused = run({ recipe: SOUP, ticks: 100, total: 100 }, 4).job;
    assert.equal(paused.ticks, 60);
    assert.equal(run(paused, 10, false).job.ticks, 60);
    assert.equal(run(paused, 10).after, 6);
  });

  it("fast mode finishes a running job within FAST_COOK_TICKS", () => {
    const result = run({ recipe: SOUP, ticks: 200, total: 200 }, 50, true, true);
    assert.equal(result.due, true);
    assert.equal(result.after, FAST_COOK_TICKS / STATION_SWEEP_TICKS);
  });

  it("fast mode doesn't slow down a job that's nearly done", () => {
    assert.equal(run({ recipe: SOUP, ticks: 5, total: 100 }, 5, true, true).after, 1);
  });

  it("a saved job with 0 ticks left is due on the next sweep", () => {
    assert.deepEqual(sweepStep({ recipe: SOUP, ticks: 0, total: 100 }, true, false), {
      kind: "due",
    });
  });

  it("progress cells fill from 0 to 5", () => {
    const cells = (ticks: number) => progressCells({ recipe: SOUP, ticks, total: 100 });
    assert.deepEqual([100, 81, 80, 50, 10, 0].map(cells), [0, 0, 1, 2, 4, 5]);
    assert.equal(cells(150), 0, "clamped");
  });
});

describe("finish and collect", () => {
  const loaded = () => true;

  it("consumes the ingredients and leaves the dish as output", () => {
    const result = finishJob(cooking(0), loaded);
    assert.ok(result?.kind === "finished");
    assert.deepEqual(result.state, { items: {}, out: { item: SOUP, count: 1 } });
    assert.equal(phaseOf(pot, result.state), "done");
  });

  it("keeps leftovers that weren't part of the recipe", () => {
    const state: StationState = {
      items: { [TOMATO]: 3, [BOWL]: 1, "minecraft:carrot": 1 },
      job: { recipe: SOUP, ticks: 0, total: 100 },
    };
    const result = finishJob(state, loaded);
    assert.ok(result?.kind === "finished");
    assert.deepEqual(result.state.items, { [TOMATO]: 1, "minecraft:carrot": 1 });
  });

  it("cancels, keeping the ingredients, for an unknown recipe", () => {
    const result = finishJob(
      { items: { [TOMATO]: 2 }, job: { recipe: "hk:gone", ticks: 0, total: 1 } },
      loaded,
    );
    assert.ok(result?.kind === "cancelled");
    assert.deepEqual(result.state, { items: { [TOMATO]: 2 } });
    assert.match(result.problem, /unknown recipe/);
  });

  it("cancels when the ingredients are no longer there", () => {
    const result = finishJob(
      { items: { [TOMATO]: 1 }, job: { recipe: SOUP, ticks: 0, total: 1 } },
      loaded,
    );
    assert.ok(result?.kind === "cancelled");
    assert.deepEqual(result.state.items, { [TOMATO]: 1 });
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

  it("collect hands out the dish and keeps leftovers", () => {
    const result = collectOutput({ items: { [TOMATO]: 1 }, out: { item: SOUP, count: 1 } });
    assert.deepEqual(result, { out: { item: SOUP, count: 1 }, state: { items: { [TOMATO]: 1 } } });
    assert.equal(phaseOf(pot, result.state), "idle");
    assert.equal(collectOutput(soupReady), undefined);
  });

  it("a full cycle: idle -> ready -> cooking -> done -> idle", () => {
    let state: StationState = EMPTY;
    for (const id of [TOMATO, TOMATO, BOWL]) {
      const added = addItems(pot, state, id, 1);
      assert.ok(added.kind === "added");
      state = added.state;
    }
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
    const collected = collectOutput(finished.state);
    assert.ok(collected);
    assert.equal(isEmpty(collected.state), true);
  });
});

describe("spill on break", () => {
  it("drops the ingredients of a running job", () => {
    assert.deepEqual(spillContents(cooking(40)), [
      [TOMATO, 2],
      [BOWL, 1],
    ]);
  });

  it("drops a finished dish and any leftovers", () => {
    assert.deepEqual(spillContents({ items: { [TOMATO]: 1 }, out: { item: SOUP, count: 1 } }), [
      [TOMATO, 1],
      [SOUP, 1],
    ]);
  });

  it("drops nothing when empty", () => {
    assert.deepEqual(spillContents(EMPTY), []);
  });
});

describe("saved form", () => {
  const pos = { x: 10, y: 64, z: -3 };

  it("round-trips a station with items, a job and an output", () => {
    const state: StationState = { ...cooking(60), out: { item: SOUP, count: 1 } };
    const parsed = parseSaved(serializeSaved("pot", "minecraft:overworld", pos, state));
    assert.deepEqual(parsed, { state, station: "pot", dim: "minecraft:overworld", pos });
  });

  it("leaves out an absent job and output", () => {
    const raw = serializeSaved("pot", "minecraft:overworld", pos, soupReady);
    assert.equal(raw.includes("job"), false);
    assert.deepEqual(parseSaved(raw)?.state, soupReady);
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
      items: { [TOMATO]: 2, a: 0, b: -1, c: 1.5, d: "3" },
      job: { recipe: SOUP, ticks: 10, total: 0 },
      out: { item: SOUP, count: 0 },
    });
    assert.deepEqual(parseSaved(raw), {
      state: { items: { [TOMATO]: 2 } },
      station: undefined,
      dim: "minecraft:nether",
      pos: undefined,
    });
  });

  it("clamps job ticks to whole, non-negative numbers", () => {
    const job = (ticks: number) =>
      parseSaved(JSON.stringify({ items: {}, job: { recipe: SOUP, ticks, total: 100 } }))?.state.job
        ?.ticks;
    assert.equal(job(-5), 0);
    assert.equal(job(12.7), 12);
  });
});
