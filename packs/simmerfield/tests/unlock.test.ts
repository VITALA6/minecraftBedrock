import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UNLOCK_TOAST_COOLDOWN_TICKS } from "../scripts/config";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import {
  MOD_ITEM_IDS,
  addFound,
  cropOfItem,
  cropsOfDish,
  inventoryDiscovery,
  isUnlocked,
  parseFound,
  serializeFound,
  toastDue,
} from "../scripts/discovery/unlock";

const sorted = (set: ReadonlySet<string>) => [...set].sort();

describe("what counts as finding a crop", () => {
  it("its seed, its produce or its prepared ingredient", () => {
    assert.equal(cropOfItem("wm_kitchen:tomato_seeds"), "tomato");
    assert.equal(cropOfItem("wm_kitchen:tomato"), "tomato");
    assert.equal(cropOfItem("wm_kitchen:sliced_tomato"), "tomato");
    assert.equal(cropOfItem("wm_kitchen:onion"), "onion", "the onion is its own seed");
    assert.equal(cropOfItem("wm_kitchen:chopped_onion"), "onion");
    assert.equal(cropOfItem("wm_kitchen:sliced_cucumber"), "cucumber");
    assert.equal(cropOfItem("wm_kitchen:chili_pepper_seeds"), "chili");
    assert.equal(cropOfItem("wm_kitchen:strawberry"), "strawberry");
    assert.equal(cropOfItem("wm_kitchen:eggplant_seeds"), "eggplant");
    assert.equal(cropOfItem("wm_kitchen:sliced_eggplant"), "eggplant");
  });

  it("not dishes, stations or vanilla items", () => {
    for (const id of [
      "wm_kitchen:tomato_soup",
      "wm_kitchen:tomato_soup_mix",
      "wm_kitchen:recipe_poster",
      "wm_kitchen:cooking_pot",
      "wm_kitchen:guide_book",
      "minecraft:carrot",
    ]) {
      assert.equal(cropOfItem(id), undefined, id);
    }
  });
});

describe("crops a dish needs", () => {
  const needs: Record<string, string[]> = {
    "wm_kitchen:tomato_soup": ["tomato"],
    "wm_kitchen:vegetable_stew": ["onion", "tomato"],
    "wm_kitchen:chili_stew": ["chili", "onion", "tomato"],
    "wm_kitchen:fish_chowder": ["onion"],
    "wm_kitchen:chicken_soup": ["onion"],
    "wm_kitchen:onion_soup": ["onion"],
    "wm_kitchen:strawberry_jam": ["strawberry"],
    "wm_kitchen:garden_salad": ["cucumber", "tomato"],
    "wm_kitchen:salsa": ["chili", "onion", "tomato"],
    "wm_kitchen:veggie_sandwich": ["cucumber", "tomato"],
    "wm_kitchen:hearty_sandwich": ["cucumber", "tomato"],
    "wm_kitchen:strawberry_cup": ["strawberry"],
    "wm_kitchen:strawberry_cake": ["strawberry"],
    "wm_kitchen:stuffed_eggplant": ["eggplant", "onion", "tomato"],
    "wm_kitchen:ratatouille": ["cucumber", "eggplant", "tomato"],
    "wm_kitchen:eggplant_curry": ["chili", "eggplant", "onion"],
    "wm_kitchen:eggplant_salad": ["cucumber", "eggplant", "onion"],
    "wm_kitchen:veggie_skewer": ["eggplant", "onion", "tomato"],
  };

  it("follows mixes and prepared ingredients back to their crops", () => {
    for (const dish of DISHES)
      assert.deepEqual(sorted(cropsOfDish(dish.id)), needs[dish.id], dish.id);
  });

  it("an unknown id needs nothing", () => {
    assert.equal(cropsOfDish("wm_kitchen:nope").size, 0);
  });
});

describe("unlocking", () => {
  it("a dish unlocks once all its crops are found", () => {
    assert.equal(isUnlocked("wm_kitchen:salsa", new Set(), false), false);
    assert.equal(isUnlocked("wm_kitchen:salsa", new Set(["tomato", "onion"]), false), false);
    assert.equal(
      isUnlocked("wm_kitchen:salsa", new Set(["tomato", "onion", "chili"]), false),
      true,
    );
  });

  it("creative unlocks everything", () => {
    for (const dish of DISHES) assert.equal(isUnlocked(dish.id, new Set(), true), true, dish.id);
  });

  it("finding everything unlocks every dish", () => {
    const all = new Set(CROPS.map((c) => c.key));
    for (const dish of DISHES) assert.equal(isUnlocked(dish.id, all, false), true, dish.id);
  });

  it("reports the dishes a new crop unlocks, in book order", () => {
    const tomato = addFound(new Set(), ["tomato"], false);
    assert.deepEqual(tomato?.unlocked, ["wm_kitchen:tomato_soup"]);
    const onion = addFound(tomato?.found ?? new Set(), ["onion"], false);
    assert.deepEqual(onion?.unlocked, [
      "wm_kitchen:vegetable_stew",
      "wm_kitchen:fish_chowder",
      "wm_kitchen:chicken_soup",
      "wm_kitchen:onion_soup",
    ]);
    assert.deepEqual(sorted(onion?.found ?? new Set()), ["onion", "tomato"]);
  });

  it("nothing new means nothing to save", () => {
    assert.equal(addFound(new Set(["tomato"]), ["tomato"], false), undefined);
    assert.equal(addFound(new Set(), [], false), undefined);
  });

  it("a crop that unlocks nothing yet is still saved", () => {
    const result = addFound(new Set(), ["chili"], false);
    assert.deepEqual(result?.unlocked, []);
    assert.deepEqual(sorted(result?.found ?? new Set()), ["chili"]);
  });

  it("in creative, crops are saved but nothing counts as newly unlocked (no toast)", () => {
    const result = addFound(new Set(), ["tomato"], true);
    assert.deepEqual(result?.unlocked, []);
    assert.deepEqual(sorted(result?.found ?? new Set()), ["tomato"]);
  });

  it("doesn't change the set it was given", () => {
    const found = new Set(["tomato"]);
    addFound(found, ["onion"], false);
    assert.deepEqual(sorted(found), ["tomato"]);
  });
});

describe("the wm_kitchen:found property", () => {
  it("parses the comma-separated keys", () => {
    assert.deepEqual(sorted(parseFound("tomato,onion")), ["onion", "tomato"]);
  });

  it("treats a missing, empty or non-string value as nothing found", () => {
    for (const raw of [undefined, "", 5, true, { x: 1 }]) assert.equal(parseFound(raw).size, 0);
  });

  it("round-trips", () => {
    const found = new Set(["tomato", "chili", "strawberry"]);
    assert.equal(serializeFound(found), "tomato,chili,strawberry");
    assert.deepEqual(parseFound(serializeFound(found)), found);
    assert.equal(serializeFound(new Set()), "");
    assert.equal(parseFound(serializeFound(new Set())).size, 0);
  });

  it("crop keys can't contain the separator", () => {
    for (const crop of CROPS) assert.equal(crop.key.includes(","), false, crop.key);
  });
});

describe("catching up on items already carried (CR4)", () => {
  it("finds every crop the inventory holds, once each", () => {
    const seen = inventoryDiscovery([
      "wm_kitchen:tomato",
      "wm_kitchen:tomato_seeds",
      "wm_kitchen:sliced_cucumber",
      "minecraft:dirt",
    ]);
    assert.deepEqual(seen.crops.sort(), ["cucumber", "tomato"]);
    assert.equal(seen.anyMod, true);
    assert.equal(seen.hasPoster, false);
  });

  it("a Simmerfield item that isn't a crop still makes the starter poster due, but finds nothing", () => {
    const seen = inventoryDiscovery(["wm_kitchen:tomato_soup", "wm_kitchen:cooking_pot"]);
    assert.deepEqual(seen.crops, []);
    assert.equal(seen.anyMod, true);
  });

  it("notices a poster itself, so it isn't handed out twice", () => {
    assert.equal(inventoryDiscovery(["wm_kitchen:recipe_poster"]).hasPoster, true);
  });

  it("a vanilla-only or empty inventory changes nothing", () => {
    assert.deepEqual(inventoryDiscovery(["minecraft:bread", "minecraft:bowl"]), {
      crops: [],
      anyMod: false,
      hasPoster: false,
    });
    assert.deepEqual(inventoryDiscovery([]), { crops: [], anyMod: false, hasPoster: false });
  });

  it("each crop's seed, produce and prepared ingredient count", () => {
    for (const crop of CROPS) {
      assert.deepEqual(inventoryDiscovery([crop.seed]).crops, [crop.key]);
      assert.deepEqual(inventoryDiscovery([crop.produce]).crops, [crop.key]);
    }
  });
});

describe("the New recipe toast", () => {
  it("shows the first time, then at most once per cooldown", () => {
    const cooldown = UNLOCK_TOAST_COOLDOWN_TICKS;
    assert.equal(toastDue(undefined, 0, cooldown), true);
    assert.equal(toastDue(100, 100, cooldown), false);
    assert.equal(toastDue(100, 100 + cooldown - 1, cooldown), false);
    assert.equal(toastDue(100, 100 + cooldown, cooldown), true);
    assert.equal(cooldown, 60, "3 s");
  });
});

describe("Simmerfield item ids (the debug kit)", () => {
  it("lists every crop item, prepared ingredient, mix, dish, station item and the guide once", () => {
    assert.equal(new Set(MOD_ITEM_IDS).size, MOD_ITEM_IDS.length);
    // 6 produce, 5 seeds (the onion is its own), 4 prepared, 10 mixes, 18 dishes, 3 station
    // items (pot, board, poster), the guide book
    assert.equal(MOD_ITEM_IDS.length, 6 + 5 + 4 + 10 + 18 + 3 + 1);
    assert.ok(MOD_ITEM_IDS.every((id) => id.startsWith("wm_kitchen:")));
  });
});
