import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFTING_RECIPES,
  STATION_RECIPES,
  canMake,
  consume,
  consumeServings,
  craftingJsonIds,
  ing,
  missingFor,
  servingsOf,
  type Counts,
  type Ingredient,
} from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import {
  choiceOf,
  phaseOf,
  possibleRecipes,
  routeUse,
  type StationState,
} from "../scripts/stations/station-logic";
import { property, type Rng } from "./fuzz";

// Property tests of recipe matching (data/recipes.ts) on the shipped recipes and on random ones.
// A recipe is a list of slots; a slot takes `count` items, any mix of its alternatives. The
// contract (validate.ts / checks.ts enforce it on real data): an item is in at most one slot of a
// recipe, counts are positive integers, and the counts being matched are positive integers.

const pot = stationById("pot") as ContainerStation;

const REAL: readonly (readonly Ingredient[])[] = [
  ...STATION_RECIPES.map((r) => r.ingredients),
  ...CRAFTING_RECIPES.map((r) => r.ingredients),
];

/** Ids that look like items but no recipe uses, and keys that are special on plain objects. */
const JUNK = [
  "minecraft:dirt",
  "wm_kitchen:not_an_item",
  "",
  ":",
  "wm_kitchen:",
  "WM_KITCHEN:TOMATO",
  "wm_kitchen:tomato ",
  "constructor",
  "toString",
  "hasOwnProperty",
  "__proto__x",
  "🍅",
];

/** A random recipe within the contract: 1..5 slots, 1..3 alternatives each, counts 1..3. */
function randomRecipe(rng: Rng): Ingredient[] {
  let next = 0;
  return Array.from({ length: rng.int(1, 5) }, () => {
    const items = Array.from({ length: rng.int(1, 3) }, () => `fuzz:item_${next++}`);
    return ing(rng.int(1, 3), ...items);
  });
}

function recipeOf(rng: Rng): readonly Ingredient[] {
  return rng.bool(0.5) ? rng.pick(REAL) : randomRecipe(rng);
}

/** Own entries only: JUNK has keys like "toString" that a plain object inherits. */
const own = (counts: Counts, id: string): number =>
  Object.hasOwn(counts, id) ? (counts[id] ?? 0) : 0;

function addTo(counts: Record<string, number>, id: string, n: number) {
  if (n > 0) counts[id] = own(counts, id) + n;
}

/** Exactly `servings` servings, each slot's items split at random over its alternatives. */
function servingsCounts(rng: Rng, recipe: readonly Ingredient[], servings: number) {
  const counts: Record<string, number> = {};
  for (const { items, count } of recipe) {
    for (let i = 0; i < count * servings; i++) addTo(counts, rng.pick(items), 1);
  }
  return counts;
}

/** The same counts with the keys inserted in a random order. */
function reorder(rng: Rng, counts: Counts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, n] of rng.shuffle(Object.entries(counts))) out[id] = n;
  return out;
}

/** The same recipe with its slots and each slot's alternatives in a random order. */
function shuffleRecipe(rng: Rng, recipe: readonly Ingredient[]): Ingredient[] {
  return rng.shuffle(recipe).map((slot) => ing(slot.count, ...rng.shuffle(slot.items)));
}

const total = (counts: Counts) => Object.values(counts).reduce((sum, n) => sum + n, 0);
const perServing = (recipe: readonly Ingredient[]) => recipe.reduce((sum, i) => sum + i.count, 0);
const slotKey = (slot: Ingredient) => [...slot.items].sort().join("|");

/** missingFor as a slot -> missing map, so slot order doesn't matter. */
const missingMap = (counts: Counts, recipe: readonly Ingredient[]) =>
  new Map(missingFor(counts, recipe).map((m) => [slotKey(m.ingredient), m.missing]));

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

describe("recipe matching: exact servings (property)", () => {
  it("k exact servings match, in any key order and any slot or alternative order", () => {
    property("exact servings match", 400, (rng, note) => {
      const recipe = recipeOf(rng);
      const k = rng.int(1, 4);
      const counts = servingsCounts(rng, recipe, k);
      note("recipe", recipe);
      note("counts", counts);
      for (let variant = 0; variant < 3; variant++) {
        const c = reorder(rng, counts);
        const r = shuffleRecipe(rng, recipe);
        assert.equal(canMake(c, r), true);
        assert.deepEqual(missingFor(c, r), []);
        assert.equal(servingsOf(c, r), k);
      }
      assert.deepEqual(consumeServings(counts, recipe, k), {}, "k servings use up exactly k");
      if (k === 1) assert.deepEqual(consume(counts, recipe), {});
    });
  });

  it("taking one item away breaks exactly that slot, short by one", () => {
    property("one item fewer", 400, (rng, note) => {
      const recipe = recipeOf(rng);
      const k = rng.int(1, 3);
      const counts = servingsCounts(rng, recipe, k);
      const id = rng.pick(Object.keys(counts));
      const fewer = { ...counts, [id]: (counts[id] as number) - 1 };
      if (fewer[id] === 0) delete fewer[id];
      note("recipe", recipe);
      note("removed", id);
      const slot = recipe.find((i) => i.items.includes(id)) as Ingredient;
      assert.equal(servingsOf(fewer, recipe), k - 1);
      assert.equal(canMake(fewer, recipe), k > 1);
      const expected = k === 1 ? new Map([[slotKey(slot), 1]]) : new Map<string, number>();
      assert.deepEqual(missingMap(fewer, recipe), expected);
    });
  });

  it("adding items never breaks a match; junk changes nothing, a recipe item adds at most one serving", () => {
    property("more items", 400, (rng, note) => {
      const recipe = recipeOf(rng);
      const k = rng.int(1, 3);
      const counts = servingsCounts(rng, recipe, k);
      const recipeItems = recipe.flatMap((i) => i.items);
      const id = rng.bool(0.5) ? rng.pick(recipeItems) : rng.pick(JUNK);
      const more = { ...counts };
      addTo(more, id, 1);
      note("recipe", recipe);
      note("added", id);
      assert.equal(canMake(more, recipe), true);
      assert.deepEqual(missingFor(more, recipe), []);
      const s = servingsOf(more, recipe);
      if (recipeItems.includes(id)) assert.ok(s === k || s === k + 1, `servings ${s}`);
      else assert.equal(s, k);
    });
  });
});

describe("recipe matching: junk and arbitrary counts (property)", () => {
  it("counts of items no slot takes never match, and every slot reports its full count", () => {
    property("junk never matches", 300, (rng, note) => {
      const recipe = recipeOf(rng);
      const counts: Record<string, number> = {};
      for (let i = rng.int(0, 6); i > 0; i--) addTo(counts, rng.pick(JUNK), rng.int(1, 64));
      note("recipe", recipe);
      note("counts", counts);
      assert.equal(canMake(counts, recipe), false);
      assert.equal(servingsOf(counts, recipe), 0);
      assert.deepEqual(
        missingFor(counts, recipe).map((m) => m.missing),
        recipe.map((i) => i.count),
      );
    });
  });

  it("canMake, missingFor and servingsOf agree on any counts, and never change their input", () => {
    property("functions agree", 500, (rng, note) => {
      const recipe = deepFreeze(recipeOf(rng));
      const pool = [...recipe.flatMap((i) => i.items), ...JUNK];
      const counts: Record<string, number> = {};
      for (let i = rng.int(0, 10); i > 0; i--) addTo(counts, rng.pick(pool), rng.int(1, 9));
      deepFreeze(counts);
      note("recipe", recipe);
      note("counts", counts);
      const can = canMake(counts, recipe);
      const missing = missingFor(counts, recipe);
      const servings = servingsOf(counts, recipe);
      assert.equal(can, missing.length === 0);
      assert.equal(can, servings > 0);
      assert.ok(Number.isInteger(servings) && servings >= 0);
      for (const m of missing) assert.ok(m.missing > 0 && m.missing <= m.ingredient.count);
      // deterministic: the same answers again
      assert.equal(canMake(counts, recipe), can);
      assert.deepEqual(missingFor(counts, recipe), missing);
      assert.equal(servingsOf(counts, recipe), servings);
    });
  });

  it("consuming s servings removes exactly s × the recipe, never goes negative, and leaves the rest", () => {
    property("consume conserves items", 500, (rng, note) => {
      const recipe = recipeOf(rng);
      const counts = servingsCounts(rng, recipe, rng.int(0, 4));
      for (let i = rng.int(0, 4); i > 0; i--) {
        addTo(counts, rng.pick([...recipe.flatMap((r) => r.items), ...JUNK]), rng.int(1, 5));
      }
      const before = servingsOf(counts, recipe);
      const s = rng.int(0, before);
      note("recipe", recipe);
      note("counts", counts);
      note("servings", s);
      const left = consumeServings(deepFreeze({ ...counts }), recipe, s);
      assert.equal(total(counts) - total(left), s * perServing(recipe), "items removed");
      assert.equal(servingsOf(left, recipe), before - s, "servings left");
      for (const [id, n] of Object.entries(left)) {
        assert.ok(Number.isInteger(n) && n > 0, `${id}: ${n} (no zero or negative entries)`);
        assert.ok(n <= own(counts, id), `${id} grew`);
      }
      const recipeItems = new Set(recipe.flatMap((i) => i.items));
      for (const [id, n] of Object.entries(counts)) {
        if (!recipeItems.has(id)) assert.equal(left[id], n, `${id} isn't in the recipe`);
      }
      // each slot loses exactly s × its count, spread over its alternatives
      for (const slot of recipe) {
        const had = slot.items.reduce((sum, id) => sum + own(counts, id), 0);
        const has = slot.items.reduce((sum, id) => sum + own(left, id), 0);
        assert.equal(had - has, s * slot.count, slotKey(slot));
      }
    });
  });
});

describe("recipe matching: the shipped recipes", () => {
  it("every JSON variant of a crafting recipe is exactly one serving of it", () => {
    for (const recipe of CRAFTING_RECIPES) {
      for (const variant of craftingJsonIds(recipe)) {
        const counts: Record<string, number> = {};
        for (const id of variant.items) addTo(counts, id, 1);
        assert.equal(variant.items.length, perServing(recipe.ingredients), variant.id);
        assert.equal(servingsOf(counts, recipe.ingredients), 1, variant.id);
        assert.deepEqual(consume(counts, recipe.ingredients), {}, variant.id);
      }
    }
  });
});

describe("recipe matching in the pot (property)", () => {
  const mixes = [...new Set(STATION_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)))];

  it("possible dishes are exactly the recipes whose mix is inside; use routing follows them", () => {
    property("pot matching", 400, (rng, note) => {
      const items: Record<string, number> = {};
      for (let n = rng.int(0, pot.capacity); n > 0; n--) {
        addTo(items, rng.pick(rng.bool(0.8) ? mixes : JUNK), 1);
      }
      const state: StationState = { items: reorder(rng, items) };
      note("items", items);
      const possible = possibleRecipes(pot, state).map((r) => r.id);
      const expected = STATION_RECIPES.filter((r) =>
        r.ingredients.every((i) => i.items.some((id) => own(items, id) >= i.count)),
      ).map((r) => r.id);
      assert.deepEqual(possible, expected, "in recipe order");
      assert.equal(phaseOf(pot, state), possible.length > 0 ? "ready" : "idle");
      const action = routeUse(pot, state, undefined, false);
      const choice = choiceOf(pot, state).map((r) => r.id);
      if (possible.length === 1) assert.deepEqual(action, { kind: "cook", recipe: possible[0] });
      else if (possible.length > 1) {
        assert.deepEqual(action, { kind: "choose", recipes: possible });
        assert.deepEqual(choice, possible);
      } else assert.equal(action.kind, "hint");
      if (possible.length <= 1) assert.deepEqual(choice, []);
    });
  });
});
