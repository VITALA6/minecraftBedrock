import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { UNLOCK_TOAST_COOLDOWN_TICKS } from "../scripts/config";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import {
  HK_ITEM_IDS,
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
    assert.equal(cropOfItem("hk:tomato_seeds"), "tomato");
    assert.equal(cropOfItem("hk:tomato"), "tomato");
    assert.equal(cropOfItem("hk:sliced_tomato"), "tomato");
    assert.equal(cropOfItem("hk:onion"), "onion", "the onion is its own seed");
    assert.equal(cropOfItem("hk:chopped_onion"), "onion");
    assert.equal(cropOfItem("hk:sliced_cucumber"), "cucumber");
    assert.equal(cropOfItem("hk:chili_pepper_seeds"), "chili");
    assert.equal(cropOfItem("hk:strawberry"), "strawberry");
  });

  it("not dishes, stations or vanilla items", () => {
    for (const id of ["hk:tomato_soup", "hk:recipe_poster", "hk:cooking_pot", "minecraft:carrot"]) {
      assert.equal(cropOfItem(id), undefined, id);
    }
  });
});

describe("crops a dish needs", () => {
  const needs: Record<string, string[]> = {
    "hk:tomato_soup": ["tomato"],
    "hk:vegetable_stew": ["onion", "tomato"],
    "hk:chili_stew": ["chili", "onion", "tomato"],
    "hk:fish_chowder": ["onion"],
    "hk:chicken_soup": ["onion"],
    "hk:onion_soup": ["onion"],
    "hk:strawberry_jam": ["strawberry"],
    "hk:garden_salad": ["cucumber", "tomato"],
    "hk:salsa": ["chili", "onion", "tomato"],
    "hk:veggie_sandwich": ["cucumber", "tomato"],
    "hk:hearty_sandwich": ["cucumber", "tomato"],
    "hk:strawberry_cup": ["strawberry"],
    "hk:strawberry_cake": ["strawberry"],
  };

  it("follows prepared ingredients back to their crop", () => {
    for (const dish of DISHES)
      assert.deepEqual(sorted(cropsOfDish(dish.id)), needs[dish.id], dish.id);
  });

  it("an unknown id needs nothing", () => {
    assert.equal(cropsOfDish("hk:nope").size, 0);
  });
});

describe("unlocking", () => {
  it("a dish unlocks once all its crops are found", () => {
    assert.equal(isUnlocked("hk:salsa", new Set(), false), false);
    assert.equal(isUnlocked("hk:salsa", new Set(["tomato", "onion"]), false), false);
    assert.equal(isUnlocked("hk:salsa", new Set(["tomato", "onion", "chili"]), false), true);
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
    assert.deepEqual(tomato?.unlocked, ["hk:tomato_soup"]);
    const onion = addFound(tomato?.found ?? new Set(), ["onion"], false);
    assert.deepEqual(onion?.unlocked, [
      "hk:vegetable_stew",
      "hk:fish_chowder",
      "hk:chicken_soup",
      "hk:onion_soup",
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

describe("the hk:found property", () => {
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
      "hk:tomato",
      "hk:tomato_seeds",
      "hk:sliced_cucumber",
      "minecraft:dirt",
    ]);
    assert.deepEqual(seen.crops.sort(), ["cucumber", "tomato"]);
    assert.equal(seen.anyHk, true);
    assert.equal(seen.hasPoster, false);
  });

  it("an HK item that isn't a crop still makes the starter poster due, but finds nothing", () => {
    const seen = inventoryDiscovery(["hk:tomato_soup", "hk:cooking_pot"]);
    assert.deepEqual(seen.crops, []);
    assert.equal(seen.anyHk, true);
  });

  it("notices a poster itself, so it isn't handed out twice", () => {
    assert.equal(inventoryDiscovery(["hk:recipe_poster"]).hasPoster, true);
  });

  it("a vanilla-only or empty inventory changes nothing", () => {
    assert.deepEqual(inventoryDiscovery(["minecraft:bread", "minecraft:bowl"]), {
      crops: [],
      anyHk: false,
      hasPoster: false,
    });
    assert.deepEqual(inventoryDiscovery([]), { crops: [], anyHk: false, hasPoster: false });
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

describe("HK item ids (the debug kit)", () => {
  it("lists every crop item, prepared ingredient, dish and station item once", () => {
    assert.equal(new Set(HK_ITEM_IDS).size, HK_ITEM_IDS.length);
    assert.equal(HK_ITEM_IDS.length, 5 + 4 + 3 + 13 + 3);
    assert.ok(HK_ITEM_IDS.every((id) => id.startsWith("hk:")));
  });
});
