import assert from "node:assert/strict";
import type { RawMessage } from "@minecraft/server";
import { describe, it } from "node:test";
import { CROPS } from "../scripts/data/crops";
import { BOOK } from "../scripts/guide/book-layout";
import {
  buildPage,
  chapterOf,
  cropUses,
  dishSteps,
  joined,
  makeable,
  navigate,
  tr,
  HOME,
  type GuideContext,
  type GuidePage,
} from "../scripts/guide/guide-model";

// The Kitchen Guide's fallbacks: a page id the book no longer has (saved in a stack from an
// older version, or a typo in a chip) opens the list it belongs to instead of failing.

const ctx: GuideContext = {
  found: new Set(CROPS.map((c) => c.key)),
  creative: false,
  counts: {},
  itemName: (id): RawMessage => ({ translate: `item.${id}.name` }),
};
const titleOf = (page: GuidePage) => JSON.stringify(buildPage(page, ctx).title);

describe("pages that no longer exist", () => {
  it("a topic past the end opens the topic list", () => {
    assert.equal(titleOf({ kind: "topic", index: 999 }), titleOf({ kind: "topics", page: 0 }));
    assert.equal(titleOf({ kind: "topic", index: -1 }), titleOf({ kind: "topics", page: 0 }));
  });

  it("an unknown dish opens the hot dishes", () => {
    assert.equal(
      titleOf({ kind: "dish", id: "wm_kitchen:removed" }),
      titleOf({ kind: "dishes", chapter: "hot", page: 0 }),
    );
    assert.equal(dishSteps("wm_kitchen:removed"), undefined);
    assert.equal(chapterOf("wm_kitchen:removed"), "cold", "no pot recipe: not hot");
  });

  it("an unknown crop opens the crop list, and is used in nothing", () => {
    assert.equal(titleOf({ kind: "crop", key: "corn" }), titleOf({ kind: "crops" }));
    assert.deepEqual(cropUses("corn"), []);
  });

  it("list pages out of range clamp to the first or last page", () => {
    const rows = (page: GuidePage) =>
      JSON.stringify(BOOK.rows.map((i) => buildPage(page, ctx).slots[i]));
    assert.equal(rows({ kind: "topics", page: -5 }), rows({ kind: "topics", page: 0 }));
    assert.equal(rows({ kind: "what", page: 99 }), rows({ kind: "what", page: 0 }));
  });
});

describe("text helpers and the stack", () => {
  it("tr wraps arguments as text; joined puts the separator only between parts", () => {
    assert.deepEqual(tr("k"), { rawtext: [{ translate: "k" }] });
    assert.deepEqual(tr("k", 2, "x"), {
      rawtext: [{ translate: "k", with: { rawtext: [{ text: "2" }, { text: "x" }] } }],
    });
    assert.deepEqual(joined([]), { rawtext: [] });
    assert.deepEqual(joined([{ text: "a" }, { text: "b" }], "|"), {
      rawtext: [{ text: "a" }, { text: "|" }, { text: "b" }],
    });
  });

  it("Back on Home alone stays on Home", () => {
    assert.deepEqual(navigate([HOME], "back"), [HOME]);
  });

  it("makeable ignores what makes nothing", () => {
    assert.deepEqual(makeable({ "minecraft:dirt": 64, "wm_kitchen:tomato": 1 }), []);
  });
});
