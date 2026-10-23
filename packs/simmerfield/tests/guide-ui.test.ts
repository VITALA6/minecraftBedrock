import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  BOOK,
  BOOK_MARKER,
  LIST_ROWS,
  MARKER_BYTES,
  SPREADS,
  STAGE_SLOTS,
  TABS,
  USES,
  countField,
  header,
  slotLabel,
} from "../scripts/guide/book-layout";

// The Kitchen Guide's JSON UI book (D19): the label code, the index map and the generated files
// (tools/gen-guide-ui.mjs). What only the game can show is in blockers.md B28.

const RP = "packs/simmerfield/resource";
const read = (path: string) => readFileSync(path, "utf8");
/** UTF-8 byte length (JSON UI's %.Ns cuts bytes): every non-ASCII byte becomes one %XX escape. */
const utf8Bytes = (s: string) => encodeURIComponent(s).replace(/%[0-9A-F]{2}/g, "x").length;

describe("book label code", () => {
  it("every header is exactly 3 ASCII bytes", () => {
    for (const count of [undefined, 0, 1, 2, 9, 10, 64, 99, 150, "", "+1", "8s"]) {
      const text = header("s", count);
      assert.equal(utf8Bytes(text), 3, JSON.stringify(count));
      assert.match(text, /^[\x20-\x7e]{3}$/);
    }
  });

  it("counts follow vanilla stacks: 1 shows nothing, more than 99 is capped", () => {
    assert.equal(countField(1), "  ");
    assert.equal(countField(2), " 2");
    assert.equal(countField(64), "64");
    assert.equal(countField(150), "99");
  });

  it("refuses counts the layout's byte cut would break", () => {
    assert.throws(() => countField("123"));
    assert.throws(() => countField("§a"));
  });

  it("a label is the header, then the display text", () => {
    assert.deepEqual(slotLabel("l", 2, { translate: "item.bowl.name" }), {
      rawtext: [{ text: "l 2" }, { translate: "item.bowl.name" }],
    });
    assert.deepEqual(slotLabel("e", ""), { rawtext: [{ text: "e  " }] });
  });
});

describe("book index map", () => {
  const all = [
    BOOK.icon,
    ...BOOK.grid,
    BOOK.result,
    BOOK.cook,
    BOOK.cooked,
    BOOK.heading,
    BOOK.footer,
    BOOK.effect,
    BOOK.station,
    BOOK.prev,
    BOOK.next,
    BOOK.back,
    BOOK.home,
    ...BOOK.tabs,
    BOOK.subheading,
    ...BOOK.uses,
  ];

  it("covers 0..size-1 exactly once", () => {
    assert.deepEqual(
      [...all].sort((a, b) => a - b),
      Array.from({ length: BOOK.size }, (_, i) => i),
    );
  });

  it("list rows and crop stages reuse the grid's indexes; a ribbon per tab", () => {
    assert.ok(BOOK.rows.length >= LIST_ROWS);
    assert.equal(BOOK.stages.length, STAGE_SLOTS);
    assert.equal(BOOK.uses.length, USES);
    const grid = new Set<number>(BOOK.grid);
    for (const index of [...BOOK.rows, ...BOOK.stages]) assert.ok(grid.has(index), `${index}`);
    assert.equal(BOOK.tabs.length, TABS.length);
  });

  it("every spread marker starts with the book marker and is MARKER_BYTES long", () => {
    const markers = Object.values(SPREADS);
    assert.equal(new Set(markers).size, markers.length);
    for (const marker of markers) {
      assert.ok(marker.startsWith(BOOK_MARKER), marker);
      assert.equal(utf8Bytes(marker), MARKER_BYTES, marker);
      assert.ok(marker.endsWith("§r"), "codes end with a reset, so a vanilla title stays readable");
    }
  });
});

describe("generated JSON UI (tools/gen-guide-ui.mjs)", () => {
  it("the files are what the generator writes", () => {
    const run = spawnSync("node", ["tools/gen-guide-ui.mjs", "--check"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr + run.stdout);
  });

  const guide = JSON.parse(read(`${RP}/ui/wm_kitchen_guide/guide.json`)) as Record<string, unknown>;
  const serverForm = read(`${RP}/ui/server_form.json`);
  const text = read(`${RP}/ui/wm_kitchen_guide/guide.json`);

  it("is registered in _ui_defs.json and scoped by the marker in server_form.json", () => {
    const defs = JSON.parse(read(`${RP}/ui/_ui_defs.json`)) as { ui_defs: string[] };
    assert.deepEqual(defs.ui_defs, ["ui/wm_kitchen_guide/guide.json"]);
    assert.ok(serverForm.includes(`((#title_text - '${BOOK_MARKER}') = #title_text)`));
    assert.ok(serverForm.includes("@wm_kitchen_guide.book"));
  });

  it("every @wm_kitchen_guide reference names an element of guide.json", () => {
    const defined = new Set(Object.keys(guide).map((key) => key.split("@")[0]));
    const refs = [...(text + serverForm).matchAll(/@wm_kitchen_guide\.([a-z_]+)/g)].map(
      (m) => m[1],
    );
    assert.ok(refs.length > 20);
    assert.deepEqual(
      [...new Set(refs)].filter((name) => !defined.has(name)),
      [],
    );
  });

  it("uses only the vanilla templates checked against 1.26.52", () => {
    const vanilla = [
      ...(text + serverForm).matchAll(/@((?!wm_kitchen_guide)[a-z_]+\.[a-z_]+)/g),
    ].map((m) => m[1]);
    assert.deepEqual([...new Set(vanilla)].sort(), [
      "common.button",
      "common.close_button",
      "common.hover_text",
      "common_dialogs.main_panel_no_buttons",
    ]);
  });

  it("every texture it names exists in the resource pack", () => {
    const textures = [...text.matchAll(/"(textures\/[a-z0-9_/]+)"/g)].map((m) => m[1]);
    assert.ok(textures.length > 10);
    assert.deepEqual(
      [...new Set(textures)].filter((path) => !existsSync(`${RP}/${path}.png`)),
      [],
    );
  });

  it("every book index is drawn somewhere", () => {
    const drawn = new Set(
      [...text.matchAll(/"collection_index": (\d+)/g)].map((m) => Number(m[1])),
    );
    const missing = Array.from({ length: BOOK.size }, (_, i) => i).filter((i) => !drawn.has(i));
    assert.deepEqual(missing, []);
  });

  // The in-game bug of 2026-10-23: cells under a plain panel all read item 0 (every slot showed
  // the book icon, no text, no open ribbon). Vanilla only nests explicit collection_index children
  // in a stack_panel, grid or collection_panel.
  it("every fixed-index cell sits directly in a form_buttons collection_panel, and only cells do", () => {
    let checked = 0;
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      const element = node as Record<string, unknown>;
      const controls = element.controls;
      if (Array.isArray(controls)) {
        for (const entry of controls as Record<string, Record<string, unknown>>[]) {
          const [name, child] = Object.entries(entry)[0] ?? [];
          if (!name || !child) continue;
          const indexed = child.collection_index !== undefined;
          const inCollection = element.type === "collection_panel";
          if (indexed) {
            checked++;
            assert.ok(inCollection, `${name} has a collection_index outside a collection_panel`);
            assert.equal(element.collection_name, "form_buttons", name);
          } else {
            assert.ok(!inCollection, `${name} sits in a collection_panel without an index`);
          }
        }
      }
      Object.values(element).forEach(walk);
    };
    walk(guide);
    assert.ok(checked >= BOOK.size);
  });

  it("each spread draws an index at most once, and never one the cover or ribbons draw", () => {
    const book = guide.book as { controls: Record<string, Record<string, unknown>>[] };
    const indexesOf = (node: unknown): number[] =>
      [...JSON.stringify(node).matchAll(/"collection_index":(\d+)/g)].map((m) => Number(m[1]));
    const frame = book.controls
      .filter((entry) => "ribbons" in entry || "chrome" in entry)
      .flatMap(indexesOf);
    assert.equal(new Set(frame).size, frame.length);
    for (const spread of Object.keys(SPREADS)) {
      const entry = book.controls.find((c) => spread in c);
      assert.ok(entry, `spread ${spread}`);
      const own = indexesOf(entry);
      assert.equal(new Set(own).size, own.length, spread);
      assert.deepEqual(
        own.filter((i) => frame.includes(i)),
        [],
        spread,
      );
    }
  });

  it("every label is bounded (max_size), so no text spills off the page", () => {
    const unbounded: string[] = [];
    const walk = (node: unknown, name: string): void => {
      if (Array.isArray(node)) return node.forEach((child) => walk(child, name));
      if (!node || typeof node !== "object") return;
      const element = node as Record<string, unknown>;
      // Labels are either typed here or derive from ink (name, headings); name's instances
      // inherit its max_size. light's derivatives are "?" and the 2-character count.
      const label = element.type === "label" || name.endsWith("@wm_kitchen_guide.ink");
      if (label && element.max_size === undefined) unbounded.push(name);
      for (const [key, child] of Object.entries(element)) walk(child, key);
    };
    walk(guide, "guide");
    assert.deepEqual(unbounded.sort(), ["ink", "light"]); // the bases
    assert.ok(text.includes('"name@wm_kitchen_guide.ink"'));
  });
});
