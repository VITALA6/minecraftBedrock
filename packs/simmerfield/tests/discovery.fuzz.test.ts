import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import {
  MOD_ITEM_IDS,
  addFound,
  cropOfItem,
  cropsOfDish,
  inventoryDiscovery,
  isUnlocked,
} from "../scripts/discovery/unlock";
import {
  POSTER_GUIDE,
  discoveredPosters,
  firstPoster,
  nextPoster,
  posterDish,
} from "../scripts/posters/poster-logic";
import { property, type Rng } from "./fuzz";

// Discovery (discovery/unlock.ts) and the recipe poster cycle (posters/poster-logic.ts) on random
// sets of found crops: finding more never locks anything, the order crops are found in doesn't
// matter, and sneak + use on a poster walks the guide and every discovered dish exactly once.

const KEYS = CROPS.map((c) => c.key);

function randomFound(rng: Rng): Set<string> {
  return new Set(KEYS.filter(() => rng.bool(0.4)));
}

const unlockedBy = (found: ReadonlySet<string>) =>
  DISHES.filter((d) => isUnlocked(d.id, found, false)).map((d) => d.id);

describe("unlocking (property)", () => {
  it("a dish is unlocked exactly when all its crops are found; finding more never locks one", () => {
    property("unlock is monotone", 300, (rng, note) => {
      const found = randomFound(rng);
      const more = new Set([...found, ...randomFound(rng)]);
      note("found", [...found]);
      note("more", [...more]);
      for (const dish of DISHES) {
        const needs = [...cropsOfDish(dish.id)];
        assert.equal(
          isUnlocked(dish.id, found, false),
          needs.every((k) => found.has(k)),
          dish.id,
        );
        assert.equal(isUnlocked(dish.id, found, true), true, "creative unlocks everything");
      }
      const before = new Set(unlockedBy(found));
      for (const id of before) assert.ok(isUnlocked(id, more, false), `${id} locked again`);
    });
  });

  it("finding crops one at a time, in any order, reports every newly unlocked dish once", () => {
    property("unlock order", 300, (rng, note) => {
      const start = randomFound(rng);
      const keys = rng.shuffle(KEYS.filter(() => rng.bool(0.6)));
      note("start", [...start]);
      note("keys", keys);
      let found: ReadonlySet<string> = start;
      const reported: string[] = [];
      for (const key of keys) {
        const result = addFound(found, [key], false);
        if (found.has(key)) {
          assert.equal(result, undefined, "nothing new: nothing to save");
          continue;
        }
        assert.ok(result);
        assert.ok(result.found.has(key) && [...found].every((k) => result.found.has(k)));
        reported.push(...result.unlocked);
        found = result.found;
      }
      // all at once gives the same set and the same dishes
      const all = addFound(start, keys, false);
      if (all) {
        assert.deepEqual([...all.found].sort(), [...found].sort());
        assert.deepEqual([...all.unlocked].sort(), [...reported].sort());
      } else assert.deepEqual(reported, []);
      assert.equal(new Set(reported).size, reported.length, "each dish reported once");
      const expected = unlockedBy(found).filter((id) => !unlockedBy(start).includes(id));
      assert.deepEqual([...reported].sort(), [...expected].sort());
    });
  });

  it("what an inventory finds doesn't depend on item order or repeats", () => {
    const pool = [...MOD_ITEM_IDS, "minecraft:dirt", "minecraft:bowl", "wm_kitchen:unknown"];
    property("inventory discovery", 300, (rng, note) => {
      const items = Array.from({ length: rng.int(0, 20) }, () => rng.pick(pool));
      note("items", items);
      const a = inventoryDiscovery(items);
      const b = inventoryDiscovery(rng.shuffle([...items, ...items]));
      assert.deepEqual([...a.crops].sort(), [...b.crops].sort());
      assert.equal(a.anyMod, b.anyMod);
      assert.equal(a.hasPoster, b.hasPoster);
      assert.equal(
        a.anyMod,
        items.some((id) => id.startsWith("wm_kitchen:")),
      );
      const crops = new Set(items.map(cropOfItem).filter((k) => k !== undefined));
      assert.deepEqual([...a.crops].sort(), [...crops].sort());
    });
  });
});

describe("the poster cycle (property)", () => {
  it("from the guide, sneak + use visits every discovered dish once, in order, then the guide", () => {
    property("poster cycle", 300, (rng, note) => {
      const discovery = { found: randomFound(rng), creative: rng.bool(0.1) };
      note("found", [...discovery.found]);
      const shown = discoveredPosters(discovery);
      for (const index of shown) {
        const dish = posterDish(index);
        assert.ok(dish && isUnlocked(dish, discovery.found, discovery.creative), `poster ${index}`);
      }
      if (shown.length === 0) {
        assert.equal(nextPoster(POSTER_GUIDE, discovery), undefined);
        assert.equal(firstPoster(discovery), POSTER_GUIDE);
        return;
      }
      const visited: number[] = [];
      let current = POSTER_GUIDE;
      for (;;) {
        const next = nextPoster(current, discovery);
        assert.ok(next !== undefined);
        if (next === POSTER_GUIDE) break;
        assert.ok(next > current, "the cycle moves forward");
        visited.push(next);
        current = next;
        assert.ok(visited.length <= shown.length, "the cycle ends");
      }
      assert.deepEqual(visited, shown);
      assert.equal(firstPoster(discovery), shown[0]);
      assert.equal(firstPoster(discovery, false), POSTER_GUIDE);
      // from any poster, even an undiscovered one, the next is discovered (or the guide)
      const from = rng.int(0, 40);
      const next = nextPoster(from, discovery);
      assert.ok(next === POSTER_GUIDE || shown.includes(next as number), `after ${from}`);
    });
  });
});
