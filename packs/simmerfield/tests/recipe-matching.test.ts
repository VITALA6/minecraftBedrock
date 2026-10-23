import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CRAFTING_RECIPES,
  canMake,
  consume,
  consumeServings,
  craftingJsonIds,
  findStationRecipe,
  ingredientsOf,
  missingFor,
  recipeMaking,
  recipesFor,
  servingsOf,
  stationInputsMadeFrom,
  type CraftingRecipe,
  type StationRecipe,
} from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import { closestRecipe, phaseOf, possibleRecipes } from "../scripts/stations/station-logic";

const pot = stationById("pot") as ContainerStation;
const recipe = (id: string) => findStationRecipe(id) as StationRecipe;
const crafting = (id: string) => CRAFTING_RECIPES.find((r) => r.id === id) as CraftingRecipe;
const possibleIds = (items: Record<string, number>) =>
  possibleRecipes(pot, { items }).map((r) => r.id);

const TOMATO = "wm_kitchen:tomato";
const ONION = "wm_kitchen:onion";
const BOWL = "minecraft:bowl";
const SOUP_MIX = "wm_kitchen:tomato_soup_mix";
const STEW_MIX = "wm_kitchen:vegetable_stew_mix";

// The matching helpers are generic: the mix recipes (several slots, counts,
// "cod or salmon") exercise them; the pot's own recipes are one mix each (D16).

describe("canMake / missingFor (a mix recipe)", () => {
  const soup = crafting(SOUP_MIX).ingredients;

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

describe("fish chowder mix: raw cod OR salmon", () => {
  const base = { "minecraft:potato": 1, [ONION]: 1, [BOWL]: 1 };
  const chowder = crafting("wm_kitchen:fish_chowder_mix").ingredients;

  it("matches with cod or with salmon, not without either", () => {
    assert.equal(canMake({ ...base, "minecraft:cod": 1 }, chowder), true);
    assert.equal(canMake({ ...base, "minecraft:salmon": 1 }, chowder), true);
    assert.equal(canMake(base, chowder), false);
    const [first] = missingFor(base, chowder);
    assert.deepEqual(first?.ingredient.items, ["minecraft:cod", "minecraft:salmon"]);
  });

  it("with both, it takes the cod (list order) and leaves the salmon", () => {
    const left = consume({ ...base, "minecraft:cod": 1, "minecraft:salmon": 1 }, chowder);
    assert.deepEqual(left, { "minecraft:salmon": 1 });
  });

  it("a slot of 2 can be filled by a mix of alternatives", () => {
    const slot = [{ items: ["minecraft:cod", "minecraft:salmon"], count: 2 }];
    assert.equal(canMake({ "minecraft:cod": 1, "minecraft:salmon": 1 }, slot), true);
    assert.deepEqual(consume({ "minecraft:cod": 1, "minecraft:salmon": 3 }, slot), {
      "minecraft:salmon": 2,
    });
  });

  it("is two JSON recipes: the cod one keeps the id, the salmon one gets a suffix", () => {
    assert.deepEqual(
      craftingJsonIds(crafting("wm_kitchen:fish_chowder_mix")).map((j) => [j.id, j.items[0]]),
      [
        ["wm_kitchen:fish_chowder_mix", "minecraft:cod"],
        ["wm_kitchen:fish_chowder_mix_salmon", "minecraft:salmon"],
      ],
    );
    assert.deepEqual(craftingJsonIds(crafting(SOUP_MIX)), [
      { id: SOUP_MIX, items: [TOMATO, TOMATO, BOWL] },
    ]);
  });
});

describe("consume / servings", () => {
  const soup = crafting(SOUP_MIX).ingredients;

  it("removes one serving and drops ids that reach zero", () => {
    assert.deepEqual(consume({ [TOMATO]: 3, [BOWL]: 1 }, soup), { [TOMATO]: 1 });
  });

  it("doesn't change its input", () => {
    const items = { [TOMATO]: 2, [BOWL]: 1 };
    consume(items, soup);
    assert.deepEqual(items, { [TOMATO]: 2, [BOWL]: 1 });
  });

  it("counts whole servings: the shortest slot decides", () => {
    assert.equal(servingsOf({ [TOMATO]: 5, [BOWL]: 3 }, soup), 2);
    assert.equal(servingsOf({ [TOMATO]: 1, [BOWL]: 3 }, soup), 0);
    assert.equal(servingsOf({ [SOUP_MIX]: 3 }, recipe("wm_kitchen:tomato_soup").ingredients), 3);
    assert.equal(servingsOf({}, []), 0);
  });

  it("consumes several servings at once", () => {
    assert.deepEqual(consumeServings({ [TOMATO]: 5, [BOWL]: 3 }, soup, 2), {
      [TOMATO]: 1,
      [BOWL]: 1,
    });
    assert.deepEqual(consumeServings({ [TOMATO]: 2, [BOWL]: 1 }, soup, 0), {
      [TOMATO]: 2,
      [BOWL]: 1,
    });
  });
});

describe("the pot cooks mixes (D16)", () => {
  it("every pot recipe is exactly one mix, made on the crafting table", () => {
    for (const r of recipesFor("pot")) {
      assert.equal(r.ingredients.length, 1, r.id);
      const [only] = r.ingredients;
      assert.deepEqual(only?.items.length, 1, r.id);
      assert.equal(only?.count, 1, r.id);
      const made = recipeMaking(only?.items[0] ?? "");
      assert.equal(made?.kind, "crafting", r.id);
    }
  });

  it("a mix is ready with its one dish; raw ingredients aren't taken", () => {
    assert.deepEqual(possibleIds({ [SOUP_MIX]: 1 }), ["wm_kitchen:tomato_soup"]);
    assert.equal(phaseOf(pot, { items: { [SOUP_MIX]: 1 } }), "ready");
    assert.equal(ingredientsOf("pot").has(TOMATO), false);
    assert.equal(ingredientsOf("pot").has(BOWL), false);
  });

  it("two different mixes make two dishes possible, in recipe order", () => {
    assert.deepEqual(possibleIds({ [STEW_MIX]: 1, [SOUP_MIX]: 2 }), [
      "wm_kitchen:tomato_soup",
      "wm_kitchen:vegetable_stew",
    ]);
  });

  it("with one-mix recipes there's never a closest recipe still missing something", () => {
    assert.equal(closestRecipe(pot, { items: {} }), undefined);
    assert.equal(closestRecipe(pot, { items: { [SOUP_MIX]: 1 } }), undefined);
  });

  it("a raw ingredient names the mixes it goes into", () => {
    assert.deepEqual(stationInputsMadeFrom("pot", "wm_kitchen:strawberry"), [
      "wm_kitchen:strawberry_jam_mix",
    ]);
    assert.deepEqual(stationInputsMadeFrom("pot", "minecraft:salmon"), [
      "wm_kitchen:fish_chowder_mix",
    ]);
    assert.ok(stationInputsMadeFrom("pot", TOMATO).includes(SOUP_MIX));
    assert.ok(stationInputsMadeFrom("pot", "wm_kitchen:eggplant").length >= 3);
    assert.deepEqual(stationInputsMadeFrom("pot", "minecraft:dirt"), []);
    assert.deepEqual(stationInputsMadeFrom("pot", "wm_kitchen:sliced_tomato"), []);
  });
});

describe("recipeMaking", () => {
  it("finds pot and crafting recipes by result", () => {
    assert.equal(recipeMaking("wm_kitchen:tomato_soup")?.kind, "station");
    assert.equal(recipeMaking(SOUP_MIX)?.kind, "crafting");
    assert.equal(recipeMaking("wm_kitchen:salsa")?.kind, "crafting");
    assert.equal(recipeMaking("minecraft:cake"), undefined);
  });
});
