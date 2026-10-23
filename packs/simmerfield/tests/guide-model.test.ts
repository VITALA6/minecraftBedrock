import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { RawMessage } from "@minecraft/server";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import { BOOK, SPREADS, TABS, TAPPABLE, USES, type Spread } from "../scripts/guide/book-layout";
import {
  HOME,
  TAB_LOOK,
  TAB_PAGE,
  buildPage,
  chapterOf,
  cropUses,
  dishSteps,
  dishesIn,
  makeable,
  navigate,
  paged,
  stageIcons,
  tabOf,
  type GuideContext,
  type GuidePage,
  type PageModel,
} from "../scripts/guide/guide-model";
import { GUIDE_TOPICS } from "../scripts/guide/guide-pages";

// The Kitchen Guide's pages as data (guide/guide-model.ts): what each page shows, which ribbon
// is open, navigation and What can I make?. The JSON UI side is in guide-ui.test.ts.

const RP = "packs/simmerfield/resource";
const guide = JSON.parse(readFileSync(`${RP}/ui/wm_kitchen_guide/guide.json`, "utf8")) as {
  book: { controls: Record<string, unknown>[] };
};

const name = (id: string): RawMessage => ({ translate: `item.${id}.name` });
const ctx = (over: Partial<GuideContext> = {}): GuideContext => ({
  found: new Set(),
  creative: false,
  counts: {},
  itemName: name,
  ...over,
});
const everything = ctx({ creative: true });
const nothing = ctx();
const allFound = ctx({ found: new Set(CROPS.map((c) => c.key)) });

/** Every page the guide can reach. */
function allPages(): GuidePage[] {
  return [
    HOME,
    ...GUIDE_TOPICS.map((_, index): GuidePage => ({ kind: "topic", index })),
    { kind: "topics", page: 0 },
    { kind: "topics", page: 1 },
    { kind: "dishes", chapter: "hot", page: 0 },
    { kind: "dishes", chapter: "hot", page: 1 },
    { kind: "dishes", chapter: "cold", page: 0 },
    { kind: "dishes", chapter: "cold", page: 1 },
    ...DISHES.map((d): GuidePage => ({ kind: "dish", id: d.id })),
    { kind: "board" },
    { kind: "crops" },
    ...CROPS.map((c): GuidePage => ({ kind: "crop", key: c.key })),
    { kind: "what", page: 0 },
  ];
}

const text = (message: unknown) => JSON.stringify(message ?? {});
const slot = (page: PageModel, index: number) => page.slots[index];

/** The indexes the JSON UI draws for a spread (its cells, the cover and the ribbons). */
function drawnBy(spread: Spread): Set<number> {
  const ofEntry = (key: string) =>
    [
      ...JSON.stringify(guide.book.controls.find((c) => key in c)).matchAll(
        /"collection_index":(\d+)/g,
      ),
    ].map((m) => Number(m[1]));
  return new Set([...ofEntry("ribbons"), ...ofEntry("chrome"), ...ofEntry(spread)]);
}

describe("every page", () => {
  for (const [label, context] of [
    ["creative", everything],
    ["new player", nothing],
  ] as const) {
    it(`builds, fills only slots its spread draws, and acts only on tappable ones (${label})`, () => {
      for (const at of allPages()) {
        const page = buildPage(at, context);
        assert.equal(page.slots.length, BOOK.size, JSON.stringify(at));
        assert.ok(SPREADS[page.spread]);
        const drawn = drawnBy(page.spread);
        page.slots.forEach((s, index) => {
          if (!s || s.role === "e") return;
          assert.ok(drawn.has(index), `${JSON.stringify(at)}: slot ${index} isn't drawn`);
          if (s.action) assert.ok(TAPPABLE.has(s.role), `${JSON.stringify(at)}: slot ${index}`);
        });
      }
    });
  }

  it("has Back, Home and every ribbon; Home's Back and Home are dead", () => {
    for (const at of allPages()) {
      const page = buildPage(at, everything);
      const root = at.kind === "home";
      for (const index of [BOOK.back, BOOK.home]) {
        assert.equal(slot(page, index)?.role, root ? "e" : "s", JSON.stringify(at));
      }
      TABS.forEach((tab, i) => {
        const ribbon = slot(page, BOOK.tabs[i] ?? -1);
        assert.deepEqual(ribbon?.action, { tab: TAB_PAGE[tab] });
        assert.ok(ribbon?.icon);
      });
    }
  });

  it("opens exactly the ribbon of its chapter, on subpages too (none on Home)", () => {
    for (const at of allPages()) {
      const page = buildPage(at, everything);
      const open = TABS.filter((_, i) => slot(page, BOOK.tabs[i] ?? -1)?.role === "a");
      const want = tabOf(at);
      assert.deepEqual(open, want ? [want] : [], JSON.stringify(at));
    }
    assert.equal(tabOf({ kind: "dish", id: "wm_kitchen:tomato_soup" }), "hot");
    assert.equal(tabOf({ kind: "dish", id: "wm_kitchen:garden_salad" }), "cold");
    assert.equal(tabOf({ kind: "crop", key: "tomato" }), "crops");
    assert.equal(tabOf({ kind: "topic", index: 3 }), "topics");
    assert.equal(tabOf(HOME), undefined);
  });

  it("every ribbon has its own icon and name", () => {
    const page = buildPage(HOME, everything);
    const ribbons = BOOK.tabs.map((index) => slot(page, index));
    assert.equal(new Set(ribbons.map((r) => r?.icon)).size, TABS.length);
    assert.equal(new Set(ribbons.map((r) => text(r?.text))).size, TABS.length);
  });

  it("◀ ▶ stay in the chapter: dish to dish, crop to crop, topic to topic", () => {
    const hot = dishesIn("hot");
    const first = buildPage({ kind: "dish", id: hot[0]?.id ?? "" }, everything);
    assert.equal(slot(first, BOOK.prev)?.role, "e");
    assert.deepEqual(slot(first, BOOK.next)?.action, { turn: { kind: "dish", id: hot[1]?.id } });
    const crop = buildPage({ kind: "crop", key: CROPS[1]?.key ?? "" }, everything);
    assert.deepEqual(slot(crop, BOOK.prev)?.action, { turn: { kind: "crop", key: CROPS[0]?.key } });
    const lastTopic = buildPage({ kind: "topic", index: GUIDE_TOPICS.length - 1 }, everything);
    assert.equal(slot(lastTopic, BOOK.next)?.role, "e");
  });
});

describe("Home", () => {
  it("lists the chapters in ribbon order, by name, with their icons", () => {
    const page = buildPage(HOME, everything);
    TABS.forEach((tab, i) => {
      const row = slot(page, BOOK.rows[i] ?? -1);
      const ribbon = slot(page, BOOK.tabs[i] ?? -1);
      assert.equal(row?.icon, ribbon?.icon, tab);
      assert.ok(text(row?.text).includes(`"${TAB_LOOK[tab].nameKey}"`), tab);
      assert.ok(text(ribbon?.text).includes(`"${TAB_LOOK[tab].nameKey}"`), tab);
      assert.deepEqual(row?.action, { go: TAB_PAGE[tab] });
    });
  });
});

describe("dish pages", () => {
  it("a pot dish: grid → its mix, then pot → the dish, with the cook time", () => {
    const page = buildPage({ kind: "dish", id: "wm_kitchen:tomato_soup" }, everything);
    assert.equal(page.spread, "recipe");
    assert.equal(slot(page, BOOK.result)?.icon, "textures/wm_kitchen/items/tomato_soup_mix");
    assert.equal(slot(page, BOOK.cooked)?.icon, "textures/wm_kitchen/items/tomato_soup");
    assert.equal(slot(page, BOOK.cook)?.role, "h");
    assert.match(text(slot(page, BOOK.cook)?.text), /"5"/);
    assert.equal(slot(page, BOOK.grid[0] ?? -1)?.count, 2); // 2 tomatoes
    assert.deepEqual(slot(page, BOOK.grid[0] ?? -1)?.action, {
      go: { kind: "crop", key: "tomato" },
    });
    assert.match(text(slot(page, BOOK.grid[1] ?? -1)?.action), /wm_kitchen\.guide\.vanilla_item/);
  });

  it("the effect: family glyph and name, the effect and its duration", () => {
    const page = buildPage({ kind: "dish", id: "wm_kitchen:tomato_soup" }, everything);
    const body = text(page.body);
    for (const part of [
      "wm_kitchen.guide.effect_line",
      "❤",
      "wm_kitchen.family.heal",
      "potion.regeneration",
    ]) {
      assert.ok(body.includes(part), part);
    }
    assert.match(text(slot(page, BOOK.effect)?.text), /"8"/);
    assert.equal(slot(page, BOOK.effect)?.icon, "textures/ui/regeneration_effect");
  });

  it("a crafted dish: grid → the dish, no cook row, the crafting table as station", () => {
    const page = buildPage({ kind: "dish", id: "wm_kitchen:garden_salad" }, everything);
    assert.equal(slot(page, BOOK.result)?.icon, "textures/wm_kitchen/items/garden_salad");
    assert.equal(slot(page, BOOK.cook), undefined);
    assert.equal(slot(page, BOOK.cooked), undefined);
    assert.equal(slot(page, BOOK.station)?.icon, "textures/blocks/crafting_table_front");
    // a sliced tomato leads to the board
    assert.deepEqual(slot(page, BOOK.grid[0] ?? -1)?.action, { go: { kind: "board" } });
  });

  it("locked: silhouettes for the dish and its unfound crops, and where to find them", () => {
    const page = buildPage({ kind: "dish", id: "wm_kitchen:chili_stew" }, nothing);
    assert.equal(slot(page, BOOK.icon)?.role, "l");
    assert.equal(slot(page, BOOK.result)?.role, "l");
    const grid = BOOK.grid.map((index) => slot(page, index)).filter((s) => s !== undefined);
    assert.equal(grid.find((s) => s.icon === "textures/wm_kitchen/items/chili_pepper")?.role, "l");
    assert.equal(grid.find((s) => s.icon === "textures/items/beef_raw")?.role, "s");
    const footer = text(slot(page, BOOK.footer)?.text);
    for (const key of [
      "wm_kitchen.guide.find",
      "wm_kitchen.crop.where.chili",
      "wm_kitchen.crop.where.tomato",
    ]) {
      assert.ok(footer.includes(key), key);
    }
    assert.ok(text(page.title).includes("wm_kitchen.guide.locked"));
  });

  it("unlocked by finding its crops; the footer then names every ingredient", () => {
    const page = buildPage({ kind: "dish", id: "wm_kitchen:chili_stew" }, allFound);
    assert.equal(slot(page, BOOK.icon)?.role, "s");
    assert.match(text(slot(page, BOOK.footer)?.text), /item\.minecraft:beef\.name/);
  });

  it("every dish has steps that fit the 3×3 grid", () => {
    for (const d of DISHES) {
      const steps = dishSteps(d.id);
      assert.ok(steps, d.id);
      assert.ok(steps.grid.length <= BOOK.grid.length, d.id);
      assert.equal(Boolean(steps.cook), chapterOf(d.id) === "hot", d.id);
    }
  });
});

describe("crop pages", () => {
  it("seed → growth stages → produce, the seed biomes, and what it's used in", () => {
    const page = buildPage({ kind: "crop", key: "tomato" }, everything);
    assert.equal(page.spread, "crop");
    assert.equal(slot(page, BOOK.stages[0] ?? -1)?.icon, "textures/wm_kitchen/items/tomato_seeds");
    assert.equal(
      slot(page, BOOK.stages[1] ?? -1)?.icon,
      "textures/wm_kitchen/blocks/tomato_crop_stage_0",
    );
    assert.equal(slot(page, BOOK.result)?.icon, "textures/wm_kitchen/items/tomato");
    assert.ok(text(page.body).includes("wm_kitchen.crop.where.tomato"));
    const uses = BOOK.uses.map((index) => slot(page, index)).filter((s) => s !== undefined);
    assert.equal(uses[0]?.icon, "textures/wm_kitchen/items/sliced_tomato");
    assert.ok(uses.some((s) => s.icon === "textures/wm_kitchen/items/tomato_soup"));
    assert.ok(uses.some((s) => s.icon === "textures/wm_kitchen/items/garden_salad"));
  });

  it("unknown crops are silhouettes that still say where to look", () => {
    const page = buildPage({ kind: "crop", key: "chili" }, nothing);
    assert.equal(slot(page, BOOK.icon)?.role, "l");
    for (const index of BOOK.stages) assert.equal(slot(page, index)?.role, "l");
    assert.ok(text(page.body).includes("wm_kitchen.crop.where.chili"));
  });

  it("every crop's stage textures exist, and its uses fit the page", () => {
    for (const crop of CROPS) {
      for (const icon of stageIcons(crop)) assert.ok(existsSync(`${RP}/${icon}.png`), icon);
      assert.ok(cropUses(crop.key).length <= USES, crop.key);
      assert.ok(
        cropUses(crop.key).some((u) => u.kind === "dish"),
        crop.key,
      );
    }
  });
});

describe("What can I make?", () => {
  it("nothing from an empty inventory", () => {
    assert.deepEqual(makeable({}), []);
    const page = buildPage({ kind: "what", page: 0 }, nothing);
    assert.ok(text(page.body).includes("wm_kitchen.guide.nothing"));
  });

  it("counts mixes carried plus mixes the raw ingredients make", () => {
    const servings = (counts: Record<string, number>, id: string) =>
      makeable(counts).find((m) => m.dish.id === id)?.servings;
    assert.equal(
      servings({ "wm_kitchen:tomato": 2, "minecraft:bowl": 1 }, "wm_kitchen:tomato_soup"),
      1,
    );
    assert.equal(
      servings({ "wm_kitchen:tomato": 5, "minecraft:bowl": 9 }, "wm_kitchen:tomato_soup"),
      2,
    );
    assert.equal(servings({ "wm_kitchen:tomato_soup_mix": 3 }, "wm_kitchen:tomato_soup"), 3);
    assert.equal(
      servings(
        { "wm_kitchen:tomato_soup_mix": 1, "wm_kitchen:tomato": 2, "minecraft:bowl": 1 },
        "wm_kitchen:tomato_soup",
      ),
      2,
    );
    assert.equal(
      servings({ "wm_kitchen:tomato": 1, "minecraft:bowl": 1 }, "wm_kitchen:tomato_soup"),
      undefined,
    );
    assert.equal(
      servings({ "minecraft:cake": 2, "wm_kitchen:strawberry": 4 }, "wm_kitchen:strawberry_cake"),
      2,
    );
  });

  it("lists them with their servings as the count", () => {
    const counts = {
      "wm_kitchen:tomato_soup_mix": 3,
      "minecraft:cake": 1,
      "wm_kitchen:strawberry": 2,
    };
    const page = buildPage({ kind: "what", page: 0 }, ctx({ counts }));
    const rows = BOOK.rows.map((index) => slot(page, index)).filter((s) => s !== undefined);
    assert.deepEqual(
      rows.map((r) => [r.icon, r.count]),
      [
        ["textures/wm_kitchen/items/tomato_soup", 3],
        ["textures/wm_kitchen/items/strawberry_cake", 1],
      ],
    );
    assert.deepEqual(rows[0]?.action, { go: { kind: "dish", id: "wm_kitchen:tomato_soup" } });
  });
});

describe("navigation", () => {
  const dish: GuidePage = { kind: "dish", id: "wm_kitchen:tomato_soup" };
  const crop: GuidePage = { kind: "crop", key: "tomato" };

  it("go pushes, Back pops (never past Home), Home resets, ◀ ▶ replace", () => {
    let stack = navigate([HOME], { go: dish });
    stack = navigate(stack, { go: crop });
    assert.deepEqual(stack, [HOME, dish, crop]);
    assert.deepEqual(navigate(stack, "back"), [HOME, dish]);
    assert.deepEqual(navigate([HOME], "back"), [HOME]);
    assert.deepEqual(navigate(stack, "home"), [HOME]);
    const turned = navigate(stack, { turn: { kind: "crop", key: "onion" } });
    assert.deepEqual(turned, [HOME, dish, { kind: "crop", key: "onion" }]);
  });

  it("a ribbon opens its chapter right above Home; hints don't move", () => {
    assert.deepEqual(navigate([HOME, dish, crop], { tab: TAB_PAGE.crops }), [HOME, TAB_PAGE.crops]);
    assert.deepEqual(navigate([HOME, dish], { hint: { text: "x" } }), [HOME, dish]);
  });

  it("deep trails keep Home at the bottom", () => {
    let stack: GuidePage[] = [HOME];
    for (let i = 0; i < 40; i++) stack = navigate(stack, { go: i % 2 ? dish : crop });
    assert.equal(stack[0], HOME);
    assert.ok(stack.length <= 24);
  });

  it("pages of a list clamp to what exists", () => {
    const at = (page: number): GuidePage => ({ kind: "what", page });
    const items = Array.from({ length: 10 }, (_, i) => i);
    assert.deepEqual(paged(items, 0, 7, at).shown, [0, 1, 2, 3, 4, 5, 6]);
    const last = paged(items, 5, 7, at);
    assert.deepEqual([last.current, last.pages, last.shown], [1, 2, [7, 8, 9]]);
    assert.deepEqual(last.prev, at(0));
    assert.equal(last.next, undefined);
    assert.equal(paged([], 3, 7, at).pages, 1);
  });
});
