import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFTING_RECIPES,
  STATION_RECIPES,
  recipeMaking,
  servingsOf,
} from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { makeable } from "../scripts/guide/guide-model";
import {
  addItems,
  finishJob,
  routeUse,
  spillContents,
  startJob,
  takeAllItems,
  totalItems,
  type StationState,
} from "../scripts/stations/station-logic";
import { property, type Rng } from "./fuzz";

// Item counts moving between a player's hand, the pot and the player again, as property tests.
// The stack-splitting hand-out itself (lib/inventory.ts: giveOrDrop, dropItems) needs ItemStack
// and a Container from @minecraft/server, so it can't run in Node; these cover the pure math on
// both sides of it: how much leaves the hand, what the pot keeps, and what it hands back.

const pot = stationById("pot") as ContainerStation;
const MAX_STACK = 64;
const MIXES = [...new Set(STATION_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)))];
const RAW = [...new Set(CRAFTING_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)))];

/** Random pot contents that the pot itself could have reached: up to capacity, mixes only. */
function potItems(rng: Rng): Record<string, number> {
  const items: Record<string, number> = {};
  for (let n = rng.int(0, pot.capacity); n > 0; n--) {
    const id = rng.pick(MIXES);
    items[id] = (items[id] ?? 0) + 1;
  }
  return items;
}

const sum = (entries: readonly (readonly [string, number])[]) =>
  entries.reduce((total, [, n]) => total + n, 0);

describe("hand -> pot (property)", () => {
  it("what leaves the hand is what the pot gains: 1 per use, the stack on sneak, capped by room", () => {
    property("hand to pot", 600, (rng, note) => {
      const state: StationState = { items: potItems(rng) };
      const held = { typeId: rng.pick(rng.bool(0.8) ? MIXES : RAW), amount: rng.int(1, MAX_STACK) };
      const sneaking = rng.bool(0.5);
      note("items", state.items);
      note("held", held);
      note("sneaking", sneaking);
      const action = routeUse(pot, state, held, sneaking);
      assert.equal(action.kind, "add");
      if (action.kind !== "add") return;
      // sneak + use goes through the before-event only for an ingredient (sneakHandles)
      assert.equal(action.count, sneaking && MIXES.includes(held.typeId) ? held.amount : 1);
      const result = addItems(pot, state, action.typeId, action.count);
      const room = pot.capacity - totalItems(state);
      const moved = result.kind === "added" ? result.amount : 0;
      const left = held.amount - moved;
      assert.ok(left >= 0 && left <= held.amount, `hand keeps ${left}`);
      assert.ok(Number.isInteger(left), "a stack never ends up fractional");
      if (!MIXES.includes(held.typeId)) assert.equal(result.kind, "refused");
      else if (room === 0) assert.equal(result.kind, "full");
      else {
        assert.equal(result.kind, "added");
        assert.equal(moved, Math.min(room, action.count));
        if (result.kind !== "added") return;
        assert.equal(
          totalItems(result.state),
          totalItems(state) + moved,
          "no item created or lost",
        );
        assert.ok(totalItems(result.state) <= pot.capacity);
        if (moved < action.count) assert.equal(totalItems(result.state), pot.capacity, "full");
        for (const [id, n] of Object.entries(result.state.items)) {
          const expected = (state.items[id] ?? 0) + (id === held.typeId ? moved : 0);
          assert.equal(n, expected, id);
        }
      }
    });
  });

  it("emptying a whole stack into pots fills ceil(stack / capacity) pots, all full but the last", () => {
    property("stack into pots", 200, (rng, note) => {
      const typeId = rng.pick(MIXES);
      let hand = rng.int(1, MAX_STACK);
      const start = hand;
      note("stack", { typeId, hand });
      const pots: StationState[] = [];
      while (hand > 0) {
        const result = addItems(pot, { items: {} }, typeId, hand);
        assert.equal(result.kind, "added");
        if (result.kind !== "added") return;
        hand -= result.amount;
        pots.push(result.state);
        assert.ok(pots.length <= MAX_STACK, "always progresses");
      }
      assert.equal(pots.length, Math.ceil(start / pot.capacity));
      assert.equal(
        pots.reduce((total, p) => total + totalItems(p), 0),
        start,
      );
      pots.slice(0, -1).forEach((p) => assert.equal(totalItems(p), pot.capacity));
    });
  });
});

describe("pot -> player (property)", () => {
  it("take all hands back each item once, as positive counts that add up to the contents", () => {
    property("take all", 400, (rng, note) => {
      const state: StationState = { items: potItems(rng) };
      note("items", state.items);
      const result = takeAllItems(state);
      if (totalItems(state) === 0) {
        assert.equal(result, undefined);
        return;
      }
      assert.ok(result);
      const ids = result.items.map(([id]) => id);
      assert.equal(new Set(ids).size, ids.length, "each item once");
      for (const [id, n] of result.items) {
        assert.ok(Number.isInteger(n) && n >= 1 && n <= MAX_STACK, `${id}: ${n}`);
        assert.equal(n, state.items[id]);
      }
      assert.equal(sum(result.items), totalItems(state));
      assert.equal(totalItems(result.state), 0);
    });
  });

  it("a batch cooks into exactly servings × count dishes, and breaking the pot at any point drops everything", () => {
    property("cook and spill", 400, (rng, note) => {
      const items = potItems(rng);
      const state: StationState = { items };
      note("items", items);
      const [recipe] = STATION_RECIPES.filter((r) => servingsOf(items, r.ingredients) > 0);
      const before = totalItems(state);
      assert.equal(sum(spillContents(state)), before, "spill before cooking");
      if (!recipe) return;
      const started = startJob(pot, state, recipe.id, {
        hot: true,
        fast: false,
        ticksPerSecond: 20,
      });
      assert.equal(started.kind, "started");
      if (started.kind !== "started" || !started.state.job) return;
      assert.equal(sum(spillContents(started.state)), before, "spill while cooking");
      const done = finishJob(
        { ...started.state, job: { ...started.state.job, ticks: 0 } },
        () => true,
      );
      assert.equal(done?.kind, "finished");
      if (done?.kind !== "finished" || !done.state.out) return;
      const servings = started.state.job.servings;
      const perServing = recipe.ingredients.reduce((total, i) => total + i.count, 0);
      assert.equal(done.state.out.count, servings * recipe.count);
      assert.equal(totalItems(done.state), before - servings * perServing, "mixes used up");
      assert.equal(
        sum(spillContents(done.state)),
        before - servings * perServing + servings * recipe.count,
        "spill when done: the leftovers and the dishes",
      );
      assert.ok(done.state.out.count <= pot.capacity * recipe.count, "a batch fits one stack");
    });
  });
});

describe("What can I make? from an inventory (property)", () => {
  it("servings match the recipes, and more items never mean fewer servings", () => {
    const pool = [...MIXES, ...RAW];
    property("makeable", 300, (rng, note) => {
      const counts: Record<string, number> = {};
      for (let i = rng.int(0, 12); i > 0; i--) {
        const id = rng.pick(pool);
        counts[id] = (counts[id] ?? 0) + rng.int(1, 8);
      }
      note("counts", counts);
      const list = makeable(counts);
      for (const { dish, servings } of list) {
        assert.ok(Number.isInteger(servings) && servings > 0, dish.id);
        const made = recipeMaking(dish.id);
        assert.ok(made, dish.id);
        const direct = servingsOf(counts, made.recipe.ingredients) * made.recipe.count;
        if (made.kind === "crafting") assert.equal(servings, direct, dish.id);
        else assert.ok(servings >= direct, dish.id);
      }
      const extra = rng.pick(pool);
      const more = { ...counts, [extra]: (counts[extra] ?? 0) + rng.int(1, 8) };
      const after = new Map(makeable(more).map((m) => [m.dish.id, m.servings]));
      for (const { dish, servings } of list) {
        assert.ok((after.get(dish.id) ?? 0) >= servings, `${dish.id} after adding ${extra}`);
      }
    });
  });
});
