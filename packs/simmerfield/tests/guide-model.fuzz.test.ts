import assert from "node:assert/strict";
import type { RawMessage } from "@minecraft/server";
import { describe, it } from "node:test";
import { CROPS } from "../scripts/data/crops";
import { BOOK, TAPPABLE } from "../scripts/guide/book-layout";
import {
  HOME,
  buildPage,
  navigate,
  tabOf,
  type GuideAction,
  type GuideContext,
  type GuidePage,
} from "../scripts/guide/guide-model";
import { MOD_ITEM_IDS } from "../scripts/discovery/unlock";
import { property, type Rng } from "./fuzz";

// The Kitchen Guide as a player sees it: random taps through the book (guide/guide-model.ts) for
// random players (crops found, creative, inventory), with a few bogus pages thrown in (a stale
// page id from an older version, out-of-range page numbers). Every page must build, every tap
// must lead to a page that builds, ◀ ▶ must be each other's inverse, and the page stack must keep
// Home at the bottom and stay bounded.

const MAX_DEPTH = 24;

function randomContext(rng: Rng): GuideContext {
  const counts: Record<string, number> = {};
  for (let n = rng.int(0, 10); n > 0; n--) counts[rng.pick(MOD_ITEM_IDS)] = rng.int(1, 64);
  return {
    found: new Set(CROPS.map((c) => c.key).filter(() => rng.bool(0.4))),
    creative: rng.bool(0.15),
    counts,
    itemName: (id): RawMessage => ({ translate: `item.${id}.name` }),
  };
}

function bogusPage(rng: Rng): GuidePage {
  return rng.pick<GuidePage>([
    { kind: "topic", index: rng.int(-3, 99) },
    { kind: "topics", page: rng.pick([-1, 0.5, 7, 1e9]) },
    { kind: "dishes", chapter: rng.pick(["hot", "cold"] as const), page: rng.int(-2, 9) },
    { kind: "dish", id: rng.pick(["wm_kitchen:removed_dish", "minecraft:bread", ""]) },
    { kind: "crop", key: rng.pick(["corn", "", "tomato "]) },
    { kind: "what", page: rng.int(-1, 50) },
  ]);
}

/** The ◀ ▶ targets of a built page (undefined: the button is dead). */
function turns(page: GuidePage, ctx: GuideContext) {
  const model = buildPage(page, ctx);
  const target = (index: number) => {
    const action = model.slots[index]?.action;
    return action && typeof action === "object" && "turn" in action ? action.turn : undefined;
  };
  return { prev: target(BOOK.prev), next: target(BOOK.next) };
}

describe("the Kitchen Guide, tapped at random (property)", () => {
  it("every page builds, every tap leads somewhere that builds, and the stack stays sane", () => {
    property("guide random walk", 150, (rng, note) => {
      const ctx = randomContext(rng);
      let stack: GuidePage[] = [HOME];
      const taps: string[] = [];
      note("found", [...ctx.found]);
      note("creative", ctx.creative);
      try {
        for (let step = rng.int(1, 80); step > 0; step--) {
          const at = stack[stack.length - 1] as GuidePage;
          const model = buildPage(at, ctx);
          assert.equal(model.slots.length, BOOK.size);
          const actions: GuideAction[] = [];
          model.slots.forEach((slot, i) => {
            if (!slot?.action) return;
            assert.ok(TAPPABLE.has(slot.role), `slot ${i} acts but is role ${slot.role}`);
            actions.push(slot.action);
          });
          assert.ok(actions.length > 0, "every page has somewhere to go");
          if (at.kind !== "home") assert.ok(tabOf(at) !== undefined);
          // mostly go deeper, so long trails (past the stack's depth limit) happen too
          const gos = actions.filter((a) => typeof a === "object" && "go" in a);
          const action: GuideAction = rng.bool(0.05)
            ? { go: bogusPage(rng) }
            : rng.pick(gos.length > 0 && rng.bool(0.6) ? gos : actions);
          taps.push(JSON.stringify(action));
          stack = navigate(stack, action);
          assert.ok(stack.length >= 1 && stack.length <= MAX_DEPTH, `depth ${stack.length}`);
          assert.deepEqual(stack[0], HOME, "Home stays at the bottom");
        }
      } catch (error) {
        note("last taps", taps.slice(-10));
        throw error;
      }
    });
  });

  it("always tapping deeper keeps Home at the bottom and the stack at its depth limit", () => {
    /** The taps on a page that open a dish or a crop page. */
    const deeper = (page: GuidePage, ctx: GuideContext) =>
      buildPage(page, ctx)
        .slots.map((s) => s?.action)
        .filter((a): a is { go: GuidePage } => typeof a === "object" && "go" in a)
        .filter((a) => a.go.kind === "dish" || a.go.kind === "crop");
    property("guide deep trail", 50, (rng, note) => {
      const ctx = randomContext(rng);
      // crop -> a dish it's used in -> one of that dish's crops -> ...: never runs out of pages
      let stack: GuidePage[] = [HOME, { kind: "crop", key: rng.pick(CROPS).key }];
      for (let step = 0; step < MAX_DEPTH + 10; step++) {
        const at = stack[stack.length - 1] as GuidePage;
        // only taps whose page goes deeper again (a salad's sliced items lead to the board)
        const taps = deeper(at, ctx).filter((a) => deeper(a.go, ctx).length > 0);
        note("at", at);
        assert.ok(taps.length > 0, "a crop or dish page links to another one");
        stack = navigate(stack, rng.pick(taps));
        assert.equal(stack.length, Math.min(step + 3, MAX_DEPTH), `after ${step + 1} taps`);
        assert.deepEqual(stack[0], HOME);
      }
    });
  });

  it("◀ and ▶ are each other's inverse on every page reached through the book", () => {
    property("guide turns invert", 100, (rng, note) => {
      const ctx = randomContext(rng);
      let page: GuidePage = HOME;
      for (let step = rng.int(1, 30); step > 0; step--) {
        const model = buildPage(page, ctx);
        const gos = model.slots
          .map((s) => s?.action)
          .filter(
            (a): a is { go: GuidePage } | { tab: GuidePage } =>
              typeof a === "object" && ("go" in a || "tab" in a),
          );
        if (gos.length === 0) break;
        const action = rng.pick(gos);
        page = "go" in action ? action.go : action.tab;
        note("page", page);
        const { prev, next } = turns(page, ctx);
        if (next) assert.deepEqual(turns(next, ctx).prev, page, "▶ then ◀ comes back");
        if (prev) assert.deepEqual(turns(prev, ctx).next, page, "◀ then ▶ comes back");
      }
    });
  });
});
