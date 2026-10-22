import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import {
  BOOK_ORDER,
  MAX_CONTEXT_BUTTONS,
  bookImagePath,
  bookImageSpecs,
  bookPage,
  contextButtons,
  dishChapter,
  missingCrops,
  nextPage,
  pageImage,
  pageKey,
  pageNumber,
  prevPage,
  whatCanIMake,
  type BookPage,
  type Discovery,
} from "../scripts/ui/book-pages";

// The book's page model (D14): order, Prev/Next, which image a player sees, the context buttons,
// and that every image the script can ask for exists in the resource pack.

const RP = "packs/harvest_kitchen/resource";
const nobody: Discovery = { found: new Set(), creative: false };
const everything: Discovery = { found: new Set(CROPS.map((c) => c.key)), creative: false };
const creative: Discovery = { found: new Set(), creative: true };
const keys = (pages: readonly (BookPage | undefined)[]) => pages.map((p) => p && pageKey(p));

describe("page order", () => {
  it("home, what, then each chapter followed by its dishes or crops", () => {
    assert.deepEqual(keys(BOOK_ORDER.slice(0, 4)), [
      "home",
      "what",
      "chapter:pot",
      "dish:hk:tomato_soup",
    ]);
    const chapters = BOOK_ORDER.filter((p) => p.kind === "chapter").map(pageKey);
    assert.deepEqual(chapters, ["chapter:pot", "chapter:board", "chapter:crafting", "chapter:crops"]); // prettier-ignore
    assert.equal(pageKey(BOOK_ORDER[BOOK_ORDER.length - 1] as BookPage), "crop:strawberry");
  });

  it("lists every dish once, in its own chapter, and every crop once", () => {
    const dishes = BOOK_ORDER.filter((p) => p.kind === "dish").map((p) => pageKey(p));
    assert.deepEqual(dishes.sort(), DISHES.map((d) => `dish:${d.id}`).sort());
    let chapter = "";
    for (const page of BOOK_ORDER) {
      if (page.kind === "chapter") chapter = page.chapter;
      if (page.kind === "dish") assert.equal(dishChapter(page.id), chapter, page.id);
    }
    assert.equal(BOOK_ORDER.filter((p) => p.kind === "crop").length, CROPS.length);
    assert.equal(new Set(BOOK_ORDER.map(pageKey)).size, BOOK_ORDER.length, "no duplicates");
  });

  it("pot dishes in the pot chapter, table dishes in crafting", () => {
    assert.equal(dishChapter("hk:strawberry_jam"), "pot");
    assert.equal(dishChapter("hk:salsa"), "crafting");
    assert.equal(dishChapter("hk:strawberry_cake"), "crafting");
  });
});

describe("prev and next", () => {
  it("walk the order and stop at both ends", () => {
    assert.equal(prevPage(bookPage.home()), undefined);
    assert.equal(nextPage(BOOK_ORDER[BOOK_ORDER.length - 1] as BookPage), undefined);
    assert.equal(pageKey(nextPage(bookPage.home()) as BookPage), "what");
    assert.equal(
      pageKey(prevPage(bookPage.chapter("board")) as BookPage),
      "dish:hk:strawberry_jam",
    );
    for (let i = 1; i < BOOK_ORDER.length; i++) {
      const page = BOOK_ORDER[i] as BookPage;
      assert.equal(pageKey(nextPage(prevPage(page) as BookPage) as BookPage), pageKey(page));
    }
  });

  it("page numbers are 1-based positions", () => {
    assert.equal(pageNumber(bookPage.home()), 1);
    assert.equal(pageNumber(bookPage.dish("hk:tomato_soup")), 4);
    assert.equal(pageNumber(bookPage.crop("strawberry")), BOOK_ORDER.length);
    assert.equal(pageNumber(bookPage.dish("hk:nope")), 0);
  });
});

describe("locked or unlocked image", () => {
  it("a dish is locked until all its crops are found; the image names what's missing", () => {
    const chili = bookPage.dish("hk:chili_stew");
    assert.equal(pageImage(chili, nobody), "dish_chili_stew_locked_tomato_onion_chili");
    const some: Discovery = { found: new Set(["tomato", "onion"]), creative: false };
    assert.deepEqual(missingCrops("hk:chili_stew", some), ["chili"]);
    assert.equal(pageImage(chili, some), "dish_chili_stew_locked_chili");
    assert.equal(pageImage(chili, everything), "dish_chili_stew");
  });

  it("crops by discovery; creative unlocks everything", () => {
    assert.equal(pageImage(bookPage.crop("onion"), nobody), "crop_onion_locked");
    assert.equal(pageImage(bookPage.crop("onion"), everything), "crop_onion");
    for (const page of BOOK_ORDER) assert.ok(!pageImage(page, creative).includes("locked"));
  });

  it("chapters, home and what are the same for everyone", () => {
    for (const page of BOOK_ORDER.filter((p) => p.kind !== "dish" && p.kind !== "crop")) {
      assert.equal(pageImage(page, nobody), pageImage(page, everything));
    }
  });
});

describe("images the script can show", () => {
  const specs = bookImageSpecs();
  const stems = new Set(specs.map((s) => s.stem));

  it("every page × every discovery state has an image spec", () => {
    const keyList = CROPS.map((c) => c.key);
    for (let mask = 0; mask < 1 << keyList.length; mask++) {
      const found = new Set(keyList.filter((_, i) => (mask & (1 << i)) !== 0));
      for (const page of BOOK_ORDER) {
        const stem = pageImage(page, { found, creative: false });
        assert.ok(stems.has(stem), `${stem} (found: ${[...found].join(",")})`);
      }
    }
  });

  it("every spec exists as a PNG, and every PNG is a spec", () => {
    assert.equal(stems.size, specs.length, "stems are unique");
    assert.deepEqual(
      [...stems].filter((stem) => !existsSync(`${RP}/${bookImagePath(stem)}`)),
      [],
    );
    const files = readdirSync(`${RP}/textures/hk/book`).filter((f) => f.endsWith(".png"));
    assert.deepEqual(
      files.filter((f) => !stems.has(f.slice(0, -4))),
      [],
    );
  });

  it("paths are what CustomForm.image() needs: RP-relative with .png (S1a)", () => {
    assert.equal(bookImagePath("home"), "textures/hk/book/home.png");
  });
});

describe("context buttons", () => {
  it("home: What can I make? and the four chapters", () => {
    assert.deepEqual(
      contextButtons(bookPage.home(), nobody).map((b) =>
        b.kind === "chapter" ? b.chapter : b.kind,
      ),
      ["what", "pot", "board", "crafting", "crops"],
    );
  });

  it("a chapter lists its dishes, locked per player (the image stays neutral)", () => {
    const pot = contextButtons(bookPage.chapter("pot"), { found: new Set(["tomato"]), creative: false }); // prettier-ignore
    assert.equal(pot.length, 7);
    assert.deepEqual(pot[0], { kind: "dish", id: "hk:tomato_soup", locked: false });
    assert.deepEqual(pot[1], { kind: "dish", id: "hk:vegetable_stew", locked: true });
    const crops = contextButtons(bookPage.chapter("crops"), nobody);
    assert.ok(crops.every((b) => b.kind === "crop" && !b.known));
  });

  it("a dish page leads to its crops (and the board for prepared ingredients)", () => {
    assert.deepEqual(contextButtons(bookPage.dish("hk:tomato_soup"), nobody), [
      { kind: "crop", key: "tomato", known: false },
    ]);
    const salsa = contextButtons(bookPage.dish("hk:salsa"), everything);
    assert.deepEqual(
      salsa.map((b) => (b.kind === "crop" ? b.key : b.kind === "chapter" ? b.chapter : "?")),
      ["tomato", "onion", "chili", "board"],
    );
  });

  it("a crop page lists its dishes only once the crop is found", () => {
    assert.deepEqual(contextButtons(bookPage.crop("strawberry"), nobody), []);
    const dishes = contextButtons(bookPage.crop("strawberry"), everything);
    assert.deepEqual(
      dishes.map((b) => (b.kind === "dish" ? b.id : "?")),
      ["hk:strawberry_jam", "hk:strawberry_cup", "hk:strawberry_cake"],
    );
  });

  it("the button pool fits every page", () => {
    for (const page of [...BOOK_ORDER, bookPage.what()]) {
      const all: Record<string, number> = {};
      const most = contextButtons(page, creative, all).length;
      assert.ok(most <= MAX_CONTEXT_BUTTONS, pageKey(page));
    }
    assert.equal(MAX_CONTEXT_BUTTONS, DISHES.length);
  });
});

describe("What can I make?", () => {
  it("dishes whose ingredients are all in the bag, in recipe order", () => {
    assert.deepEqual(whatCanIMake({}), []);
    assert.deepEqual(whatCanIMake({ "hk:tomato": 2, "minecraft:bowl": 1 }), ["hk:tomato_soup"]);
    assert.deepEqual(
      whatCanIMake({
        "hk:tomato": 2,
        "minecraft:bowl": 1,
        "minecraft:bread": 1,
        "hk:sliced_tomato": 1,
        "hk:sliced_cucumber": 1,
      }),
      ["hk:tomato_soup", "hk:veggie_sandwich"],
    );
  });

  it("alternatives count (cod or salmon)", () => {
    const bag = {
      "minecraft:salmon": 1,
      "minecraft:potato": 1,
      "hk:onion": 1,
      "minecraft:bowl": 1,
    };
    assert.deepEqual(whatCanIMake(bag), ["hk:fish_chowder"]);
  });

  it("the What page's buttons are those dishes", () => {
    const buttons = contextButtons(bookPage.what(), everything, {
      "hk:tomato": 2,
      "minecraft:bowl": 1,
    });
    assert.deepEqual(buttons, [{ kind: "dish", id: "hk:tomato_soup", locked: false }]);
  });
});
