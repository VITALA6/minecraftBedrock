import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import type { RawMessage } from "@minecraft/server";
import { CROPS } from "../scripts/data/crops";
import { DISHES } from "../scripts/data/dishes";
import { CRAFTING_RECIPES } from "../scripts/data/recipes";
import { BOOK, type Spread } from "../scripts/guide/book-layout";
import { HOME, buildPage, type GuideContext, type GuidePage } from "../scripts/guide/guide-model";
import { GUIDE_TOPICS } from "../scripts/guide/guide-pages";

// The pack's translations (texts/<code>.lang, listed in texts/languages.json): every language
// carries exactly en_US's keys, in en_US's order, with the same placeholders, § codes and glyphs,
// and the Kitchen Guide's text still fits the book in every language.

const PACK = "packs/simmerfield";
const TEXTS = { behavior: `${PACK}/behavior/texts`, resource: `${PACK}/resource/texts` };

interface Lang {
  readonly code: string;
  readonly raw: string;
  /** key=value lines in file order (values with a trailing tab comment cut off, as the game does). */
  readonly entries: readonly (readonly [string, string])[];
  /** Lines that are neither key=value, a ## comment, nor blank. */
  readonly malformed: readonly string[];
}

function readLang(dir: string, code: string): Lang {
  const raw = readFileSync(`${dir}/${code}.lang`, "utf8");
  const entries: [string, string][] = [];
  const malformed: string[] = [];
  for (const line of raw.split("\n")) {
    if (line === "" || line.startsWith("##")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0 || /\s/.test(line.slice(0, eq))) malformed.push(line);
    else entries.push([line.slice(0, eq), line.slice(eq + 1).replace(/\t+#.*$/, "")]);
  }
  return { code, raw, entries, malformed };
}

function packLangs(dir: string): { listed: string[]; files: string[]; langs: Lang[] } {
  const listed = JSON.parse(readFileSync(`${dir}/languages.json`, "utf8")) as string[];
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".lang"))
    .map((file) => file.slice(0, -".lang".length));
  return { listed, files, langs: files.map((code) => readLang(dir, code)) };
}

/** %1$s, %s, %d, %%: what the game fills in. */
const placeholders = (value: string) => value.match(/%(?:\d+\$)?[sd]|%%/g) ?? [];
/** § format codes: colours and resets. */
const formatCodes = (value: string) => value.match(/§[0-9a-z]/gi) ?? [];
/** The glyphs the scripts and players read as icons. */
const glyphs = (value: string) => value.match(/[✔✘♨★❤▶■●]/g) ?? [];
const sorted = (items: readonly string[]) => [...items].sort();

for (const [pack, dir] of Object.entries(TEXTS)) {
  describe(`${pack} pack texts/`, () => {
    const { listed, files, langs } = packLangs(dir);
    const en = langs.find((lang) => lang.code === "en_US");

    it("languages.json lists exactly the .lang files, en_US first", () => {
      assert.equal(listed[0], "en_US");
      assert.equal(new Set(listed).size, listed.length, "a language is listed twice");
      assert.deepEqual(sorted(listed), sorted(files));
    });

    it("every file is UTF-8 without a BOM, LF line ends, key=value and ## lines only", () => {
      for (const lang of langs) {
        assert.ok(!lang.raw.startsWith("﻿"), `${lang.code} starts with a BOM`);
        assert.ok(!lang.raw.includes("\r"), `${lang.code} has CR line ends`);
        assert.ok(!lang.raw.includes("�"), `${lang.code} is not valid UTF-8`);
        assert.deepEqual(lang.malformed, [], lang.code);
      }
    });

    it("no key is defined twice, and no value is empty", () => {
      for (const lang of langs) {
        const keys = lang.entries.map(([key]) => key);
        assert.deepEqual(
          keys.filter((key, i) => keys.indexOf(key) !== i),
          [],
          `${lang.code}: duplicate keys`,
        );
        assert.deepEqual(
          lang.entries.filter(([, value]) => value.trim() === "").map(([key]) => key),
          [],
          `${lang.code}: empty values`,
        );
      }
    });

    it("every language has exactly en_US's keys, in en_US's order", () => {
      assert.ok(en, "en_US.lang");
      const keys = en.entries.map(([key]) => key);
      for (const lang of langs) {
        const own = lang.entries.map(([key]) => key);
        assert.deepEqual(
          keys.filter((key) => !own.includes(key)),
          [],
          `${lang.code}: missing keys`,
        );
        assert.deepEqual(
          own.filter((key) => !keys.includes(key)),
          [],
          `${lang.code}: keys en_US doesn't have`,
        );
        assert.deepEqual(own, keys, `${lang.code}: key order differs from en_US`);
      }
    });

    it("each value keeps en_US's placeholders, § codes and glyphs", () => {
      assert.ok(en);
      const english = new Map(en.entries);
      const problems: string[] = [];
      for (const lang of langs) {
        for (const [key, value] of lang.entries) {
          const source = english.get(key);
          if (source === undefined) continue; // reported by the key test
          const want = placeholders(source);
          const got = placeholders(value);
          // Positional %n$s may move with the grammar; plain %s/%d fill in order, so they can't.
          const positional = want.every((p) => /^%\d+\$/.test(p));
          const same = positional
            ? sorted(got).join() === sorted(want).join()
            : got.join() === want.join();
          if (!same)
            problems.push(`${lang.code} ${key}: placeholders ${got.join()} ≠ ${want.join()}`);
          if (sorted(formatCodes(value)).join() !== sorted(formatCodes(source)).join()) {
            problems.push(`${lang.code} ${key}: § codes ${formatCodes(value).join()}`);
          }
          if (sorted(glyphs(value)).join() !== sorted(glyphs(source)).join()) {
            problems.push(`${lang.code} ${key}: glyphs ${glyphs(value).join()}`);
          }
        }
      }
      assert.deepEqual(problems, []);
    });
  });
}

// --- the Kitchen Guide in every language ---------------------------------------------------------
//
// Text is measured the way art/simmerfield/mockups/render-book.mjs draws it: glyph advances of
// the game's font (font/default8.png for ASCII, the glyph_XX pages for the rest; measured from
// 1.26.52 and listed below), wrapped at spaces, "..." past the box. Boxes are the cells of
// tools/gen-guide-ui.mjs layout(), minus the name's insets (ROW, CHIP, nav text).

/**
 * Advance in UI px per character, from the game font. ASCII not listed is 6; any other character
 * not listed is 5, like every Latin-1, Latin Extended-A and Cyrillic letter of the glyph pages.
 */
const ADVANCE: Readonly<Record<number, string>> = {
  2: "!,.:;i|",
  3: "'`l",
  4: " I[]t¡·’‘•ŀţťŧſј",
  5: '"()*<>fk{}',
  7: "@~",
  8: "✘",
  9: "✔❤",
};
const advance = new Map(
  Object.entries(ADVANCE).flatMap(([px, chars]) => [...chars].map((c) => [c, Number(px)] as const)),
);

/** Width in UI px, § codes skipped. */
function widthOf(text: string): number {
  let px = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] ?? "";
    if (ch === "§") i++;
    else px += advance.get(ch) ?? (ch.charCodeAt(0) < 0x80 ? 6 : 5);
  }
  return px;
}

/** Lines as JSON UI (and the mockups) wrap them: at spaces, a word's trailing space counted. */
function wrap(text: string, w: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.match(/[^ ]* */g)?.filter(Boolean) ?? []) {
      if (line && widthOf(line + word) > w) {
        lines.push(line.trimEnd());
        line = "";
      }
      line += word;
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

const LINE = 10;
interface Box {
  readonly w: number;
  readonly h: number;
  /** A `name` label: one line, cut with "..." at the box. */
  readonly oneLine?: boolean;
}
const name = (w: number): Box => ({ w, h: LINE, oneLine: true });
const heading: Box = { w: 150, h: LINE };

/** The title, top of the left page (LEFT.w - 12). */
const TITLE = name(146);
/** Back and Home: a 54 px button, the name from x 15 to the right edge - 4. */
const NAV: Readonly<Record<number, Box>> = { [BOOK.back]: name(35), [BOOK.home]: name(35) };
const SPREADS: Readonly<Record<Spread, { body: Box; cells: Readonly<Record<number, Box>> }>> = {
  recipe: {
    body: { w: 142, h: 40 },
    cells: {
      [BOOK.effect]: name(49), // 72 px chip: CHIP.nameX 20, nameRight 3
      [BOOK.station]: name(49),
      [BOOK.cook]: name(55), // 78 px chip
      [BOOK.heading]: heading,
      [BOOK.footer]: { w: 142, h: 36 },
    },
  },
  list: {
    body: { w: 142, h: 66 },
    cells: {
      [BOOK.heading]: heading,
      [BOOK.footer]: heading,
      ...Object.fromEntries(BOOK.rows.map((index) => [index, name(112)])), // 140 px row
    },
  },
  text: { body: { w: 140, h: 136 }, cells: { [BOOK.heading]: heading } },
  crop: {
    body: { w: 142, h: 66 },
    cells: {
      [BOOK.heading]: heading,
      [BOOK.subheading]: heading,
      [BOOK.footer]: { w: 142, h: 44 },
    },
  },
};

/** Stand-ins for vanilla names (the game's own lang files aren't in the repo): a long-ish name. */
const VANILLA_ITEM = "x".repeat(10);
const VANILLA_EFFECT = "x".repeat(16);

/** A RawMessage as the client shows it in `lang`; `vanilla` when a vanilla name went into it. */
function resolve(
  message: RawMessage | undefined,
  lang: ReadonlyMap<string, string>,
): { text: string; vanilla: boolean } {
  if (!message) return { text: "", vanilla: false };
  if (message.rawtext) {
    const parts = message.rawtext.map((part) => resolve(part, lang));
    return { text: parts.map((p) => p.text).join(""), vanilla: parts.some((p) => p.vanilla) };
  }
  if (message.text !== undefined) return { text: message.text, vanilla: false };
  const key = message.translate;
  if (key === undefined) return { text: "", vanilla: false };
  const template = lang.get(key);
  if (template === undefined) {
    return { text: key.startsWith("potion.") ? VANILLA_EFFECT : VANILLA_ITEM, vanilla: true };
  }
  const withArgs = message.with;
  const args = (Array.isArray(withArgs) ? [] : (withArgs?.rawtext ?? [])).map((arg) =>
    resolve(arg, lang),
  );
  let next = 0;
  const text = template
    .replace(/%(\d+)\$s/g, (_, n: string) => args[Number(n) - 1]?.text ?? "")
    .replace(/%[sd]/g, () => args[next++]?.text ?? "");
  return { text, vanilla: args.some((a) => a.vanilla) };
}

/** Every page the guide can reach (What can I make? with a full inventory spans pages). */
function allPages(): GuidePage[] {
  return [
    HOME,
    { kind: "topics", page: 0 },
    { kind: "topics", page: 1 },
    ...GUIDE_TOPICS.map((_, index): GuidePage => ({ kind: "topic", index })),
    { kind: "dishes", chapter: "hot", page: 0 },
    { kind: "dishes", chapter: "hot", page: 1 },
    { kind: "dishes", chapter: "cold", page: 0 },
    { kind: "dishes", chapter: "cold", page: 1 },
    ...DISHES.map((dish): GuidePage => ({ kind: "dish", id: dish.id })),
    { kind: "board" },
    { kind: "crops" },
    ...CROPS.map((crop): GuidePage => ({ kind: "crop", key: crop.key })),
    { kind: "what", page: 0 },
    { kind: "what", page: 1 },
    { kind: "what", page: 2 },
  ];
}

const itemName = (id: string): RawMessage => ({ translate: `item.${id}.name` });
const everything = Object.fromEntries(
  CRAFTING_RECIPES.flatMap((recipe) => recipe.ingredients.flatMap((i) => i.items)).map((id) => [
    id,
    64,
  ]),
);
/** A new player (all locked) and one who found every crop and carries every ingredient. */
const CONTEXTS: readonly GuideContext[] = [
  { found: new Set(), creative: false, counts: {}, itemName },
  { found: new Set(CROPS.map((crop) => crop.key)), creative: false, counts: everything, itemName },
];

/** What doesn't fit `box`, or undefined. */
function overflow(text: string, box: Box): string | undefined {
  if (box.oneLine) {
    const px = widthOf(text);
    return px > box.w ? `${px}/${box.w} px` : undefined;
  }
  const lines = wrap(text, box.w);
  const maxLines = Math.max(1, Math.floor(box.h / LINE));
  const widest = Math.max(...lines.map(widthOf));
  if (widest > box.w) return `a word is ${widest}/${box.w} px`;
  return lines.length > maxLines ? `${lines.length}/${maxLines} lines` : undefined;
}

describe("Kitchen Guide text fits the book in every language", () => {
  const { langs } = packLangs(TEXTS.resource);

  it("the width table measures what the guide shows", () => {
    assert.equal(widthOf("Pot + fire"), 49); // en's tightest chip, exactly its box
    assert.equal(widthOf("§c❤§r 180 s"), 41);
  });

  for (const lang of langs) {
    it(`${lang.code}: titles, rows, chips, headings, bodies and footers fit their boxes`, () => {
      const map = new Map(lang.entries);
      const problems = new Set<string>();
      const check = (where: string, message: RawMessage | undefined, box?: Box, guess = true) => {
        if (!box) return;
        const { text, vanilla } = resolve(message, map);
        if (!text || (vanilla && !guess)) return;
        const over = overflow(text, box);
        if (over) problems.add(`${where} (${over}): ${JSON.stringify(text)}`);
      };
      for (const ctx of CONTEXTS) {
        for (const at of allPages()) {
          const page = buildPage(at, ctx);
          const boxes = SPREADS[page.spread];
          check(`${page.spread} title`, page.title, TITLE);
          check(`${page.spread} body`, page.body, boxes.body);
          page.slots.forEach((slot, index) =>
            check(
              `${page.spread} slot ${index}`,
              slot?.text,
              boxes.cells[index] ?? NAV[index],
              // A recipe footer lists the ingredients, vanilla ones included, whose names this
              // test can only guess at: it's left to the mockups, which use the real ones.
              index !== BOOK.footer,
            ),
          );
        }
      }
      assert.deepEqual([...problems], []);
    });
  }
});
