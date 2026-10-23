import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAST_COOK_TICKS, GHOST_MAX_ICONS, STATION_SWEEP_TICKS } from "../scripts/config";
import { LIQUIDS } from "../scripts/data/liquids";
import {
  CRAFTING_RECIPES,
  STATION_RECIPES,
  findStationRecipe,
  servingsOf,
} from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { ghostsFor } from "../scripts/stations/ghost-logic";
import {
  EMPTY,
  addItems,
  choiceOf,
  collectOutput,
  fillLevel,
  finishJob,
  isEmpty,
  isIngredient,
  liquidOf,
  parseSaved,
  phaseOf,
  progressCells,
  routeUse,
  serializeSaved,
  spillContents,
  startJob,
  sweepStep,
  takeAllItems,
  totalItems,
  type Phase,
  type StationState,
} from "../scripts/stations/station-logic";
import { property, type Rng } from "./fuzz";

// The pot as a state machine, driven by random event sequences the way stations/station-engine.ts
// drives it: uses (any hand, sneaking or not; routed by routeUse), the choice form (also with a
// stale or bogus choice), heat on/off, debug fast mode, sweeps (sweepStep, then finishJob when
// due; sometimes the result item "isn't loaded"), breaking the pot (spillContents) and a world
// reload (serializeSaved -> parseSaved). After every event the invariants below must hold, and a
// ledger checks that no item is created or lost: everything put in either is still inside, came
// back out, or was cooked (mixes in, dishes out, per the recipe).

const pot = stationById("pot") as ContainerStation;
const TPS = 20;
const LEVELS = pot.states.fill?.levels ?? 3;
const MIXES = [...new Set(STATION_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)))];
const RAW = [...new Set(CRAFTING_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)))];
const DISH_IDS = STATION_RECIPES.map((r) => r.result);
const JUNK = ["minecraft:dirt", "minecraft:diamond_sword", "wm_kitchen:nope", ""];
const POS = { x: 10, y: 64, z: -3 };
const DIM = "minecraft:overworld";

/** Which phase may follow which (the pot's lifecycle). Breaking always goes back to idle. */
const EDGES: Readonly<Record<Phase, readonly Phase[]>> = {
  idle: ["idle", "ready"],
  ready: ["ready", "idle", "cooking"],
  cooking: ["cooking", "done", "ready"], // ready: a cancelled job keeps its (still enough) items
  done: ["done", "idle", "ready"], // collecting leaves what was left over
};

interface World {
  state: StationState;
  hot: boolean;
  fast: boolean;
  /** item -> put in - taken out - cooked away + cooked into (must equal what's inside). */
  ledger: Record<string, number>;
  log: string[];
}

function ledgerAdd(world: World, id: string, n: number) {
  world.ledger[id] = (world.ledger[id] ?? 0) + n;
  if (world.ledger[id] === 0) delete world.ledger[id];
}

/** Everything the pot holds, its finished dish included. */
function contents(state: StationState): Record<string, number> {
  const all: Record<string, number> = { ...state.items };
  if (state.out) all[state.out.item] = (all[state.out.item] ?? 0) + state.out.count;
  return all;
}

function heldItem(rng: Rng): { typeId: string; amount: number } | undefined {
  const kind = rng.weighted([
    ["none", 4],
    ["mix", 5],
    ["raw", 2],
    ["dish", 1],
    ["junk", 1],
  ] as const);
  if (kind === "none") return undefined;
  const list = { mix: MIXES, raw: RAW, dish: DISH_IDS, junk: JUNK }[kind];
  return {
    typeId: rng.pick(list),
    amount: rng.weighted([
      [1, 3],
      [rng.int(2, 64), 2],
    ] as const),
  };
}

function takeOut(world: World, items: readonly (readonly [string, number])[]) {
  for (const [id, n] of items) {
    assert.ok(Number.isInteger(n) && n > 0, `took out ${n}× ${id}`);
    ledgerAdd(world, id, -n);
  }
}

/** startJob as the engine calls it, with what it must answer. */
function start(world: World, recipeId: string) {
  const before = world.state;
  const result = startJob(pot, before, recipeId, {
    hot: world.hot,
    fast: world.fast,
    ticksPerSecond: TPS,
  });
  const recipe = findStationRecipe(recipeId);
  if (before.job || before.out) assert.equal(result.kind, "changed");
  else if (!recipe || recipe.station !== pot.id) assert.equal(result.kind, "unknown");
  else if (servingsOf(before.items, recipe.ingredients) === 0) assert.equal(result.kind, "missing");
  else if (!world.hot) assert.equal(result.kind, "no_heat");
  else {
    assert.equal(result.kind, "started");
    if (result.kind !== "started") return;
    const job = result.state.job;
    assert.ok(job);
    assert.deepEqual(result.state.items, before.items, "starting takes nothing out");
    assert.equal(job.servings, servingsOf(before.items, recipe.ingredients), "every serving cooks");
    assert.equal(job.ticks, job.total);
    world.state = result.state;
  }
}

/** One use of the pot, routed like container-station.ts does. */
function use(world: World, rng: Rng) {
  const held = heldItem(rng);
  const sneaking = rng.bool(0.3);
  const before = world.state;
  const phase = phaseOf(pot, before);
  const action = routeUse(pot, before, held, sneaking);
  world.log.push(`use ${JSON.stringify(held)}${sneaking ? " sneaking" : ""} -> ${action.kind}`);
  switch (action.kind) {
    case "progress":
      assert.equal(phase, "cooking");
      return;
    case "collect": {
      assert.equal(phase, "done", "collect only when done");
      const result = collectOutput(before);
      assert.ok(result, "a done pot has something to collect");
      takeOut(world, [[result.out.item, result.out.count]]);
      assert.equal(result.state.out, undefined);
      assert.equal(result.state.job, undefined);
      world.state = result.state;
      return;
    }
    case "add": {
      assert.ok(held, "add needs a held item");
      assert.equal(action.typeId, held.typeId);
      assert.ok(action.count >= 1 && action.count <= held.amount);
      const result = addItems(pot, before, action.typeId, action.count);
      if (result.kind === "added") {
        assert.ok(isIngredient(pot, held.typeId), "only ingredients go in");
        assert.ok(result.amount >= 1 && result.amount <= action.count);
        assert.equal(totalItems(result.state), totalItems(before) + result.amount);
        ledgerAdd(world, held.typeId, result.amount);
        world.state = result.state;
      } else if (result.kind === "refused") {
        assert.equal(isIngredient(pot, held.typeId), false);
      } else if (result.kind === "full") {
        assert.equal(totalItems(before), pot.capacity);
      } else assert.fail(`add while ${phase}: ${result.kind}`);
      return;
    }
    case "hint":
    case "next":
      assert.ok(phase === "idle", `${action.kind} while ${phase}`);
      return;
    case "cook":
      assert.equal(phase, "ready");
      start(world, action.recipe);
      return;
    case "choose": {
      assert.equal(phase, "ready");
      assert.ok(action.recipes.length >= 2, "a form only for a real choice");
      assert.deepEqual(
        action.recipes,
        choiceOf(pot, before).map((r) => r.id),
      );
      // the player taps one; sometimes the form is stale (another player changed the pot)
      start(world, rng.bool(0.85) ? rng.pick(action.recipes) : rng.pick([...DISH_IDS, "x:y"]));
      return;
    }
    case "take_all": {
      assert.ok(phase === "idle" || phase === "ready");
      const result = takeAllItems(before);
      assert.ok(result, "take all with items inside");
      takeOut(world, result.items);
      world.state = result.state;
      return;
    }
  }
}

/** One sweep of the engine (sweepOne) over this pot. */
function sweep(world: World, rng: Rng) {
  const before = world.state;
  const job = before.job;
  world.log.push(`sweep hot=${world.hot} fast=${world.fast}`);
  if (!job) return;
  const step = sweepStep(job, world.hot, world.fast);
  if (step.kind === "paused") {
    assert.equal(world.hot, false, "only a cold pot pauses");
    return;
  }
  if (step.kind === "cooking") {
    assert.ok(step.job.ticks > 0 && step.job.ticks < job.ticks, "the countdown moves down");
    assert.equal(
      step.job.ticks,
      (world.fast ? Math.min(job.ticks, FAST_COOK_TICKS) : job.ticks) - STATION_SWEEP_TICKS,
    );
    world.state = { ...before, job: step.job };
    return;
  }
  const loaded = rng.bool(0.95);
  const result = finishJob(before, () => loaded);
  assert.ok(result);
  world.log.push(`  finish loaded=${loaded} -> ${result.kind}`);
  if (result.kind === "cancelled") {
    assert.equal(loaded, false, "a valid job only cancels when its result isn't loaded");
    assert.deepEqual(result.state, { items: before.items }, "cancelling keeps the ingredients");
    world.state = result.state;
    return;
  }
  const recipe = result.recipe;
  const out = result.state.out;
  assert.ok(out);
  assert.equal(out.item, recipe.result);
  assert.equal(out.count, recipe.count * job.servings, "every serving that started comes out");
  // the ledger: the ingredients of every serving go, the dishes come
  for (const { items, count } of recipe.ingredients) {
    const had: number = items.reduce((sum, id) => sum + (before.items[id] ?? 0), 0);
    const has: number = items.reduce((sum, id) => sum + (result.state.items[id] ?? 0), 0);
    assert.equal(had - has, count * job.servings);
    for (const id of items)
      ledgerAdd(world, id, (result.state.items[id] ?? 0) - (before.items[id] ?? 0));
  }
  ledgerAdd(world, out.item, out.count);
  world.state = result.state;
}

function breakPot(world: World) {
  world.log.push("break");
  const before = world.state;
  const drops = spillContents(before);
  assert.deepEqual(
    Object.fromEntries(
      drops.reduce((m, [id, n]) => m.set(id, (m.get(id) ?? 0) + n), new Map<string, number>()),
    ),
    contents(before),
    "a break drops everything, a running job's ingredients and the dish included",
  );
  takeOut(world, drops);
  world.state = EMPTY;
}

function reload(world: World) {
  world.log.push("reload");
  const saved = parseSaved(serializeSaved(pot.id, DIM, POS, world.state));
  assert.ok(saved);
  assert.deepEqual(saved.state, world.state, "the saved form round-trips");
  assert.equal(saved.station, pot.id);
  assert.equal(saved.dim, DIM);
  assert.deepEqual(saved.pos, POS);
  world.state = saved.state;
}

function checkInvariants(world: World, previous: Phase) {
  const { state } = world;
  const phase = phaseOf(pot, state);
  assert.ok(EDGES[previous].includes(phase), `phase ${previous} -> ${phase}`);
  for (const [id, n] of Object.entries(state.items)) {
    assert.ok(Number.isInteger(n) && n > 0, `${id}: count ${n}`);
    assert.ok(isIngredient(pot, id), `${id} isn't a pot ingredient`);
  }
  assert.ok(totalItems(state) <= pot.capacity, `over capacity: ${totalItems(state)}`);
  assert.ok(!(state.job && state.out), "never cooking and done at once");
  if (state.job) {
    const { ticks, total, servings, recipe } = state.job;
    assert.ok(Number.isInteger(ticks) && ticks > 0 && ticks <= total, `ticks ${ticks}/${total}`);
    const r = findStationRecipe(recipe);
    assert.ok(r, `job for unknown recipe ${recipe}`);
    assert.ok(servings >= 1 && servings <= servingsOf(state.items, r.ingredients), "servings held");
    const cells = progressCells(state.job);
    assert.ok(Number.isInteger(cells) && cells >= 0 && cells <= 5);
  }
  if (state.out) assert.ok(Number.isInteger(state.out.count) && state.out.count > 0);
  assert.equal(collectOutput(state) !== undefined, phase === "done", "collect iff done");
  assert.deepEqual(contents(state), world.ledger, "no item created or lost");

  const fill = fillLevel(pot, state, LEVELS);
  assert.ok(fill >= 0 && fill <= LEVELS);
  assert.equal(fill > 0, Object.keys(contents(state)).length > 0, "any contents show");
  assert.equal(isEmpty(state), Object.keys(contents(state)).length === 0 && !state.job);
  assert.ok((LIQUIDS as readonly string[]).includes(liquidOf(pot, state)));
  assert.notEqual(choiceOf(pot, state).length, 1, "the form never offers a single dish");
  const ghosts = ghostsFor(pot, state);
  assert.ok(ghosts.icons.length <= GHOST_MAX_ICONS);
  const mode = { cooking: "none", done: "done", ready: "ready" }[phase as string];
  if (mode) assert.equal(ghosts.mode, mode, `ghosts while ${phase}`);
}

function newWorld(hot: boolean, fast: boolean): World {
  return { state: EMPTY, hot, fast, ledger: {}, log: [] };
}

function runSequence(world: World, rng: Rng, steps: number): void {
  for (let i = 0; i < steps; i++) {
    const previous = phaseOf(pot, world.state);
    const event = rng.weighted([
      ["use", 10],
      ["sweep", 8],
      ["heat", 2],
      ["fast", 1],
      ["break", 1],
      ["reload", 1],
    ] as const);
    if (event === "use") use(world, rng);
    else if (event === "sweep") sweep(world, rng);
    else if (event === "heat") {
      world.hot = !world.hot;
      world.log.push(`heat ${world.hot ? "on" : "off"}`);
    } else if (event === "fast") {
      world.fast = !world.fast;
      world.log.push(`fast ${world.fast ? "on" : "off"}`);
    } else if (event === "break") breakPot(world);
    else reload(world);
    checkInvariants(world, event === "break" ? "idle" : previous);
  }
}

describe("the pot as a state machine (property)", () => {
  it("random event sequences keep every invariant and lose no item", () => {
    property("pot event sequences", 300, (rng, note) => {
      const world = newWorld(rng.bool(0.7), rng.bool(0.2));
      try {
        runSequence(world, rng, rng.int(1, 120));
      } catch (error) {
        // the trail of events is the useful part of a failure
        note("last events", world.log.slice(-20));
        note("state", world.state);
        throw error;
      }
    });
  });

  it("the sequences reach every phase (the property above isn't vacuous)", () => {
    const kinds = new Set<string>();
    property("pot sequences reach every phase", 50, (rng) => {
      const world = newWorld(true, false);
      for (let i = 0; i < 80; i++) {
        kinds.add(phaseOf(pot, world.state));
        if (rng.bool(0.5)) use(world, rng);
        else sweep(world, rng);
      }
    });
    assert.deepEqual([...kinds].sort(), ["cooking", "done", "idle", "ready"]);
  });

  it("with heat, every job finishes within its cook time in sweeps; without heat it never moves", () => {
    property("jobs finish", 200, (rng, note) => {
      const recipe = rng.pick(STATION_RECIPES);
      const mix = recipe.ingredients[0]?.items[0] as string;
      const servings = rng.int(1, pot.capacity);
      const fast = rng.bool(0.3);
      const started = startJob(pot, { items: { [mix]: servings } }, recipe.id, {
        hot: true,
        fast,
        ticksPerSecond: TPS,
      });
      note("recipe", recipe.id);
      note("servings", servings);
      assert.equal(started.kind, "started");
      if (started.kind !== "started" || !started.state.job) return;
      let job = started.state.job;
      assert.equal(sweepStep(job, false, fast).kind, "paused");
      const limit = Math.ceil(job.total / STATION_SWEEP_TICKS);
      let sweeps = 0;
      for (;;) {
        sweeps++;
        assert.ok(sweeps <= limit, `still cooking after ${sweeps} sweeps (limit ${limit})`);
        const step = sweepStep(job, true, fast);
        if (step.kind === "due") break;
        assert.equal(step.kind, "cooking");
        if (step.kind === "cooking") job = step.job;
      }
      const done = finishJob({ items: { [mix]: servings }, job }, () => true);
      assert.equal(done?.kind, "finished");
      const out = { item: recipe.result, count: recipe.count * servings };
      assert.deepEqual(done?.state, { items: {}, out });
    });
  });
});
