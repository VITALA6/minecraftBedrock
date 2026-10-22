import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMake,
  consume,
  findStationRecipe,
  ingredientsOf,
  missingFor,
  recipeMaking,
  recipesFor,
  type StationRecipe,
} from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { closestRecipe, phaseOf, possibleRecipes } from "../scripts/stations/station-logic";

const pot = stationById("pot") as ContainerStation;
const recipe = (id: string) => findStationRecipe(id) as StationRecipe;
const possibleIds = (items: Record<string, number>) =>
  possibleRecipes(pot, { items }).map((r) => r.id);

const TOMATO = "hk:tomato";
const ONION = "hk:onion";
const BOWL = "minecraft:bowl";

describe("canMake / missingFor", () => {
  const soup = recipe("hk:tomato_soup").ingredients;

  it("an exact match can be made and misses nothing", () => {
    assert.equal(canMake({ [TOMATO]: 2, [BOWL]: 1 }, soup), true);
    assert.deepEqual(missingFor({ [TOMATO]: 2, [BOWL]: 1 }, soup), []);
  });

  it("extra items don't stop a match", () => {
    assert.equal(canMake({ [TOMATO]: 3, [BOWL]: 2, "minecraft:carrot": 1 }, soup), true);
  });

  it("a missing item is reported per slot with how many are short", () => {
    assert.equal(canMake({ [TOMATO]: 1 }, soup), false);
    const missing = missingFor({ [TOMATO]: 1 }, soup);
    assert.deepEqual(
      missing.map((m) => [m.ingredient.items, m.missing]),
      [
        [[TOMATO], 1],
        [[BOWL], 1],
      ],
    );
  });

  it("nothing at all misses every slot", () => {
    assert.equal(missingFor({}, soup).length, soup.length);
  });
});

describe("fish chowder: raw cod OR salmon", () => {
  const base = { "minecraft:potato": 1, [ONION]: 1, [BOWL]: 1 };
  const chowder = recipe("hk:fish_chowder");

  it("matches with cod", () => {
    assert.deepEqual(possibleIds({ ...base, "minecraft:cod": 1 }), ["hk:fish_chowder"]);
  });

  it("matches with salmon", () => {
    assert.deepEqual(possibleIds({ ...base, "minecraft:salmon": 1 }), ["hk:fish_chowder"]);
  });

  it("doesn't match without either fish", () => {
    assert.deepEqual(possibleIds(base), []);
    const [first] = missingFor(base, chowder.ingredients);
    assert.deepEqual(first?.ingredient.items, ["minecraft:cod", "minecraft:salmon"]);
  });

  it("with both, cooking takes the cod (list order) and leaves the salmon", () => {
    const left = consume(
      { ...base, "minecraft:cod": 1, "minecraft:salmon": 1 },
      chowder.ingredients,
    );
    assert.deepEqual(left, { "minecraft:salmon": 1 });
  });

  it("a slot of 2 can be filled by a mix of alternatives", () => {
    const slot = [{ items: ["minecraft:cod", "minecraft:salmon"], count: 2 }];
    assert.equal(canMake({ "minecraft:cod": 1, "minecraft:salmon": 1 }, slot), true);
    assert.deepEqual(consume({ "minecraft:cod": 1, "minecraft:salmon": 3 }, slot), {
      "minecraft:salmon": 2,
    });
  });
});

describe("consume", () => {
  it("removes one serving and drops ids that reach zero", () => {
    const left = consume({ [TOMATO]: 3, [BOWL]: 1 }, recipe("hk:tomato_soup").ingredients);
    assert.deepEqual(left, { [TOMATO]: 1 });
  });

  it("doesn't change its input", () => {
    const items = { [TOMATO]: 2, [BOWL]: 1 };
    consume(items, recipe("hk:tomato_soup").ingredients);
    assert.deepEqual(items, { [TOMATO]: 2, [BOWL]: 1 });
  });
});

describe("possibleRecipes / phase", () => {
  it("an exact match is ready with that one dish", () => {
    assert.deepEqual(possibleIds({ [TOMATO]: 2, [BOWL]: 1 }), ["hk:tomato_soup"]);
    assert.equal(phaseOf(pot, { items: { [TOMATO]: 2, [BOWL]: 1 } }), "ready");
  });

  it("a missing item leaves it idle", () => {
    assert.deepEqual(possibleIds({ [TOMATO]: 1, [BOWL]: 1 }), []);
    assert.equal(phaseOf(pot, { items: { [TOMATO]: 1, [BOWL]: 1 } }), "idle");
  });

  it("several dishes can match at once, in recipe order", () => {
    const items = {
      [TOMATO]: 2,
      [ONION]: 1,
      "minecraft:carrot": 1,
      "minecraft:potato": 1,
      [BOWL]: 1,
    };
    assert.deepEqual(possibleIds(items), ["hk:tomato_soup", "hk:vegetable_stew"]);
  });

  it("every pot recipe matches its own ingredients exactly", () => {
    assert.deepEqual(possibleIds({}), []);
    for (const r of recipesFor("pot")) {
      const items: Record<string, number> = {};
      for (const i of r.ingredients) items[i.items[0] as string] = i.count;
      assert.ok(possibleIds(items).includes(r.id), r.id);
      assert.ok(
        Object.keys(items).every((id) => ingredientsOf("pot").has(id)),
        r.id,
      );
    }
  });
});

describe("closestRecipe (the Almost! button)", () => {
  it("is undefined for an empty pot", () => {
    assert.equal(closestRecipe(pot, { items: {} }), undefined);
  });

  it("picks the recipe with the fewest missing items", () => {
    const closest = closestRecipe(pot, { items: { [TOMATO]: 1, [BOWL]: 1 } });
    assert.equal(closest?.recipe.id, "hk:tomato_soup");
    assert.deepEqual(
      closest?.missing.map((m) => [m.ingredient.items, m.missing]),
      [[[TOMATO], 1]],
    );
  });

  it("counts missing items, not slots", () => {
    // Bowl only: tomato soup misses 2 items in 1 slot; every other bowl recipe misses 3 or more.
    const closest = closestRecipe(pot, { items: { [BOWL]: 1 } });
    assert.equal(closest?.recipe.id, "hk:tomato_soup");
    assert.equal(closest?.missing[0]?.missing, 2);
  });

  it("breaks ties by recipe order, and the first missing item is the first short slot", () => {
    // Onion only: chowder, chicken soup and onion soup each miss 3; chowder comes first.
    const closest = closestRecipe(pot, { items: { [ONION]: 1 } });
    assert.equal(closest?.recipe.id, "hk:fish_chowder");
    assert.deepEqual(closest?.missing[0]?.ingredient.items, ["minecraft:cod", "minecraft:salmon"]);
  });

  it("only considers recipes that use something already inside", () => {
    const closest = closestRecipe(pot, { items: { "minecraft:sugar": 1 } });
    assert.equal(closest?.recipe.id, "hk:strawberry_jam");
    assert.deepEqual(closest?.missing[0]?.ingredient.items, ["hk:strawberry"]);
    assert.equal(closest?.missing[0]?.missing, 3);
  });
});

describe("recipeMaking", () => {
  it("finds pot and crafting recipes by result", () => {
    assert.equal(recipeMaking("hk:tomato_soup")?.kind, "station");
    assert.equal(recipeMaking("hk:salsa")?.kind, "crafting");
    assert.equal(recipeMaking("minecraft:cake"), undefined);
  });
});
