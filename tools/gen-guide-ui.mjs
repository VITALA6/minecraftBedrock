// Writes the Kitchen Guide's JSON UI book (D19/D20, the D13 look): resource/ui/server_form.json,
// resource/ui/_ui_defs.json and resource/ui/hk_guide/guide.json.
//
//   node tools/gen-guide-ui.mjs           write the files
//   node tools/gen-guide-ui.mjs --check   exit 1 if a file differs from what it would write
//                                         (npm test runs this; see tests/guide-ui.test.ts)
//
// How it works (docs/harvest-kitchen/spikes/s9-json-ui.md has the research):
// - server_form.json redefines server_form.long_form as a panel holding the vanilla dialog (its 8
//   properties copied from vanilla 1.26.52; re-check them on every game update) and our book.
//   The vanilla dialog hides when the form title contains BOOK_MARKER; the book shows instead.
// - The book reads the form's title, body and buttons. Every button sits at a fixed index
//   (collection_index, BOOK in scripts/guide/book-layout.ts); its label starts with a 3-byte ASCII
//   header (role + count) that the bindings cut with '%.1s' / '%.3s'.
// - Fixed indexes only work under a container that hands out collection items. Vanilla 1.26.52
//   only puts explicit collection_index children under a stack_panel, grid or collection_panel
//   (choose_realm slots_grid, store_common screenshots_grid); under a plain panel every binding
//   read item 0, so every slot showed the book icon and no text (fixed 2026-10-23). So every cell
//   lives in a collection_panel, and nothing else does: decorations sit in plain panels beside it.
// - Text never spills: every label is one of `name` (one line, cut with "..." at its box), the
//   body (max_size of its page area) or a heading; each sits in a clips_children box.
// - layout() is the single source of every position and size: the JSON below and the mockups
//   (art/harvest_kitchen/mockups/render-book.mjs) are both drawn from it.
//
// The index map, the markers and the roles come from book-layout.ts, bundled with esbuild, so the
// layout can't drift from what the scripts send.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import * as prettier from "prettier";
import { ROOT } from "./paths.mjs";

const UI_DIR = path.join(ROOT, "packs/harvest_kitchen/resource/ui");
export const T = "textures/hk/ui/book";
export const FLAME = "textures/hk/ui/needs_heat";

export async function loadLayout() {
  const result = await build({
    stdin: {
      contents: 'export * from "./packs/harvest_kitchen/scripts/guide/book-layout";',
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "neutral",
    write: false,
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}

// --- geometry (UI px), relative to the book's top-left corner -------------------------------------

export const COVER = { x: 0, y: 0, w: 330, h: 200 };
export const LEFT = { x: 8, y: 7, w: 158, h: 164 };
export const RIGHT = { x: 164, y: 7, w: 158, h: 164 };
export const GUTTER = { x: 160, y: 6, w: 8, h: 166 };
export const NAV_Y = 176;
export const RIBBON = { x: COVER.w - 6, y: 14, step: 27, w: 33, h: 24 };
export const SIZE = [RIBBON.x + RIBBON.w, COVER.h];

/** Inside a list row: icon box at x 3, the name from x 24 to the row's right edge - 4. */
export const ROW = { iconX: 3, iconW: 18, nameX: 24, nameRight: 4 };
/** Inside a chip: icon box at x 2, the name from x 20 to the chip's right edge - 3. */
export const CHIP = { iconX: 2, iconW: 18, nameX: 20, nameRight: 3 };
/** One line of text. */
export const LINE = 10;

const CHROME_LAYER = 10;
const SPREAD_LAYER = 20;

export const INK = [0.23, 0.15, 0.08];
export const INK_SOFT = [0.52, 0.39, 0.25];

const L = (dx) => LEFT.x + dx;
const R = (dx) => RIGHT.x + dx;
const Ly = (dy) => LEFT.y + dy;
const Ry = (dy) => RIGHT.y + dy;

/**
 * Where everything goes. Cells are form buttons at a fixed index (template + box + variables);
 * images and the body are decoration. All coordinates are book-relative UI px.
 */
export function layout(d) {
  const { BOOK, LIST_ROWS, TABS } = d;
  const cell = (template, index, x, y, w, h, vars = {}) => ({ template, index, x, y, w, h, vars });
  const image = (texture, x, y, w, h) => ({ texture, x, y, w, h });
  const body = (x, y, w, h, align = "center") => ({ x, y, w, h, align });
  const heading = (index, x, y, w, ink = INK) =>
    cell("text_cell", index, x, y, w, LINE, { $ink: ink, $align: "center" });

  const chrome = {
    title: { x: L(6), y: Ly(7), w: LEFT.w - 12, h: LINE },
    images: [
      { ...image(`${T}/book_cover`, COVER.x, COVER.y, COVER.w, COVER.h), layer: 1 },
      { ...image(`${T}/page_left`, LEFT.x, LEFT.y, LEFT.w, LEFT.h), layer: 2 },
      { ...image(`${T}/page_right`, RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h), layer: 2 },
      {
        ...image(`${T}/parchment_grain`, LEFT.x + 6, LEFT.y + 3, LEFT.w - 13, LEFT.h - 7),
        layer: 3,
        tiled: true,
      },
      {
        ...image(`${T}/parchment_grain`, RIGHT.x + 7, RIGHT.y + 3, RIGHT.w - 13, RIGHT.h - 7),
        layer: 3,
        tiled: true,
      },
      { ...image(`${T}/book_gutter`, GUTTER.x, GUTTER.y, GUTTER.w, GUTTER.h), layer: 4 },
      { ...image(`${T}/divider`, L(29), Ly(19), 100, 1), layer: 5 },
      { ...image(`${T}/divider_gem`, L(73), Ly(17), 11, 5), layer: 6 },
      { ...image(`${T}/dish_halo`, L(47), Ly(24), 64, 64), layer: 5 },
    ],
    cells: [
      cell("picture", BOOK.icon, L(55), Ly(32), 48, 48),
      cell("nav_glyph_cell", BOOK.prev, 12, NAV_Y, 26, 18, {
        $glyph: `${T}/nav_prev`,
        $glyph_size: [4, 7],
      }),
      cell("nav_text_cell", BOOK.back, 108, NAV_Y, 54, 18, { $glyph: `${T}/nav_back` }),
      cell("nav_text_cell", BOOK.home, 166, NAV_Y, 54, 18, { $glyph: `${T}/nav_home` }),
      cell("nav_glyph_cell", BOOK.next, COVER.w - 38, NAV_Y, 26, 18, {
        $glyph: `${T}/nav_next`,
        $glyph_size: [4, 7],
      }),
    ],
  };

  const ribbons = BOOK.tabs.map((index, i) =>
    cell("ribbon_cell", index, RIBBON.x, RIBBON.y + i * RIBBON.step, RIBBON.w, RIBBON.h),
  );
  if (ribbons.length !== TABS.length) throw new Error("BOOK.tabs and TABS differ in length");

  const large = { $frame: `${T}/slot_large` };

  // Recipe: left body + chips; right grid → result, the cook row and the footer.
  const recipe = {
    body: body(L(8), Ly(92), 142, 40),
    images: [image(`${T}/arrow_ink`, R(80), Ry(47), 14, 10)],
    cells: [
      cell("chip_cell", BOOK.effect, L(6), Ly(136), 72, 20),
      cell("chip_cell", BOOK.station, L(80), Ly(136), 72, 20),
      heading(BOOK.heading, R(4), Ry(8), 150),
      ...BOOK.grid.map((index, i) =>
        cell("slot_cell", index, R(14 + (i % 3) * 20), Ry(22 + Math.floor(i / 3) * 20), 20, 20),
      ),
      cell("slot_cell", BOOK.result, R(100), Ry(39), 26, 26, large),
      cell("chip_cell", BOOK.cook, R(8), Ry(92), 78, 20),
      cell("cooked", BOOK.cooked, R(88), Ry(89), 40, 26),
      cell("text_cell", BOOK.footer, R(8), Ry(122), 142, 36, { $ink: INK_SOFT, $align: "center" }),
    ],
  };

  // List: left body; right heading, rows and footer.
  const list = {
    body: body(L(8), Ly(92), 142, 66),
    images: [],
    cells: [
      heading(BOOK.heading, R(4), Ry(8), 150),
      ...BOOK.rows
        .slice(0, LIST_ROWS)
        .map((index, i) => cell("row_cell", index, R(9), Ry(20 + i * 19), 140, 18)),
      heading(BOOK.footer, R(4), Ry(154), 150, INK_SOFT),
    ],
  };

  // Text: the body fills the right page.
  const text = {
    body: body(R(9), Ry(22), 140, 136, "left"),
    images: [],
    cells: [heading(BOOK.heading, R(4), Ry(8), 150, INK_SOFT)],
  };

  // Crop: left body; right seed → stages → produce, then "Used in" (2 × 6 slots) and a footer.
  const crop = {
    body: body(L(8), Ly(92), 142, 66),
    images: [image(`${T}/arrow_ink`, R(108), Ry(27), 14, 10)],
    cells: [
      heading(BOOK.heading, R(4), Ry(8), 150),
      ...BOOK.stages.map((index, i) => cell("slot_cell", index, R(6 + i * 20), Ry(22), 20, 20)),
      cell("slot_cell", BOOK.result, R(124), Ry(19), 26, 26, large),
      heading(BOOK.subheading, R(4), Ry(52), 150),
      ...BOOK.uses.map((index, i) =>
        cell("slot_cell", index, R(19 + (i % 6) * 20), Ry(64 + Math.floor(i / 6) * 20), 20, 20),
      ),
      cell("text_cell", BOOK.footer, R(8), Ry(110), 142, 44, { $ink: INK_SOFT, $align: "center" }),
    ],
  };

  return { chrome, ribbons, spreads: { recipe, list, text, crop } };
}

// --- bindings -------------------------------------------------------------------------------------

const TEXT = "#form_button_text";
const coll = (name, override) => ({
  binding_name: name,
  ...(override ? { binding_name_override: override } : {}),
  binding_type: "collection",
  binding_collection_name: "form_buttons",
});
const details = { binding_type: "collection_details", binding_collection_name: "form_buttons" };
const view = (source, target) => ({
  binding_type: "view",
  source_property_name: source,
  target_property_name: target,
});
const role = `('%.1s' * ${TEXT})`;
const is = (r) => `(${role} = '${r}')`;
const empty = `((${TEXT} = '') or ${is("e")})`;
const display = `(${TEXT} - ('%.3s' * ${TEXT}))`;
const count = `('§r' + (('%.3s' * ${TEXT}) - ${role}))`;
const texture = [
  coll("#form_button_texture", "#texture"),
  coll("#form_button_texture_file_system", "#texture_file_system"),
  coll(TEXT),
];
const hasTexture = "(not ((#texture = '') or (#texture = 'loading')))";
const at = (x, y) => ({ anchor_from: "top_left", anchor_to: "top_left", offset: [x, y] });

// --- the JSON UI ----------------------------------------------------------------------------------

function guideUi(d) {
  const { SPREADS, BOOK_MARKER, MARKER_BYTES } = d;
  const placed = layout(d);
  const ui = { namespace: "hk_guide" };

  // Text. `name` is one line of the button's display text: as wide as its text up to its box,
  // then cut with "..." (the vanilla button label rule); the box clips whatever still spills.
  ui.ink = { type: "label", color: INK, shadow: false, layer: 6 };
  ui.light = { type: "label", color: [1, 1, 1], shadow: true, layer: 9 };
  ui["name@hk_guide.ink"] = {
    text: "#hk_name",
    size: ["default", "default"],
    max_size: ["100%", LINE],
    bindings: [coll(TEXT), view(display, "#hk_name")],
  };
  ui.name_box = {
    type: "panel",
    clips_children: true,
    "$name_anchor|default": "left_middle",
    controls: [
      { "label@hk_guide.name": { anchor_from: "$name_anchor", anchor_to: "$name_anchor" } },
    ],
  };

  // What a slot shows: the icon, or a silhouette and "?" when locked; count; flame for heat.
  ui.icon = {
    type: "image",
    "$icon|default": [16, 16],
    size: "$icon",
    layer: 6,
    bindings: [...texture, view(`(${hasTexture} and (not ${is("l")}))`, "#visible")],
  };
  ui["silhouette@hk_guide.icon"] = {
    color: [0.1, 0.07, 0.05],
    bindings: [...texture, view(`(${hasTexture} and ${is("l")})`, "#visible")],
  };
  ui["question@hk_guide.light"] = {
    text: "?",
    bindings: [coll(TEXT), view(is("l"), "#visible")],
  };
  ui["count@hk_guide.light"] = {
    text: "#hk_count",
    anchor_from: "bottom_right",
    anchor_to: "bottom_right",
    offset: [1, 1],
    bindings: [coll(TEXT), view(count, "#hk_count")],
  };
  ui.flame = {
    type: "image",
    texture: FLAME,
    "$flame|default": [9, 9],
    size: "$flame",
    anchor_from: "bottom_left",
    anchor_to: "bottom_left",
    offset: [-2, 2],
    layer: 9,
    bindings: [coll(TEXT), view(is("h"), "#visible")],
  };
  ui.slot_content = {
    type: "panel",
    size: ["100%", "100%"],
    controls: [
      { "icon@hk_guide.icon": {} },
      { "silhouette@hk_guide.silhouette": {} },
      { "question@hk_guide.question": {} },
      { "count@hk_guide.count": {} },
      { "flame@hk_guide.flame": {} },
    ],
  };

  // Hover: a white frame around the control, and the display text as a tooltip (mouse only;
  // touch has no hover, so nothing important lives only here).
  ui.highlight = {
    type: "image",
    texture: `${T}/slot_select`,
    size: ["100% + 4px", "100% + 4px"],
    layer: 8,
  };
  ui["tooltip@common.hover_text"] = {
    layer: 30,
    bindings: [details, coll(TEXT), view(display, "#hover_text")],
  };

  /** A form button (common.button) drawing `content` over `bg` in its three states. */
  const button = (bg, content, { tooltip = true } = {}) => ({
    $pressed_button_name: "button.form_button_click",
    size: ["100%", "100%"],
    bindings: [details, coll(TEXT), view(`(not ${empty})`, "#visible")],
    controls: [
      { default: { type: "panel", controls: [...bg(false), { [`content@${content}`]: {} }] } },
      {
        hover: {
          type: "panel",
          controls: [
            ...bg(true),
            { "highlight@hk_guide.highlight": {} },
            { [`content@${content}`]: {} },
            ...(tooltip ? [{ "tooltip@hk_guide.tooltip": {} }] : []),
          ],
        },
      },
      {
        pressed: {
          type: "panel",
          controls: [...bg(true), { [`content@${content}`]: { offset: [0, 1] } }],
        },
      },
    ],
  });
  const fill = (tex, extra = {}) => ({
    type: "image",
    texture: tex,
    size: ["100%", "100%"],
    layer: 3,
    ...extra,
  });

  // Slots: an item frame (empty frame when unused, darker when locked) and the button.
  ui["slot_button@common.button"] = button(() => [], "hk_guide.slot_content");
  ui.slot_cell = {
    type: "panel",
    "$frame|default": `${T}/slot`,
    controls: [
      { bg: fill("$frame", { bindings: [coll(TEXT), view(`(not ${is("l")})`, "#visible")] }) },
      {
        bg_locked: fill(`${T}/slot_locked`, { bindings: [coll(TEXT), view(is("l"), "#visible")] }),
      },
      { "button@hk_guide.slot_button": {} },
    ],
  };

  // A small icon box (chips and rows): icon, silhouette, "?", count, flame.
  const iconBox = (x, w) => ({
    icon_box: {
      type: "panel",
      size: [w, 16],
      anchor_from: "left_middle",
      anchor_to: "left_middle",
      offset: [x, 0],
      controls: [{ "slot@hk_guide.slot_content": {} }],
    },
  });
  /** The name, from `x` to the right edge minus `right`, one line. */
  const nameBox = (x, right) => ({
    "name@hk_guide.name_box": {
      size: [`100% - ${x + right}px`, LINE],
      anchor_from: "left_middle",
      anchor_to: "left_middle",
      offset: [x, 0],
    },
  });

  // Chips: a parchment box with an icon and a short text (effect, station, cook).
  ui.chip_content = {
    type: "panel",
    size: ["100%", "100%"],
    layer: 6,
    controls: [iconBox(CHIP.iconX, CHIP.iconW), nameBox(CHIP.nameX, CHIP.nameRight)],
  };
  ui["chip_button@common.button"] = button(
    () => [{ bg: fill(`${T}/chip`) }],
    "hk_guide.chip_content",
  );
  ui.chip_cell = { type: "panel", controls: [{ "button@hk_guide.chip_button": {} }] };

  // List rows: a parchment button with the icon (and its count) and the name.
  ui.row_content = {
    type: "panel",
    size: ["100%", "100%"],
    layer: 6,
    controls: [iconBox(ROW.iconX, ROW.iconW), nameBox(ROW.nameX, ROW.nameRight)],
  };
  ui["row_button@common.button"] = button(
    (hover) => [{ bg: fill(`${T}/${hover ? "button_book_hover" : "button_book"}`) }],
    "hk_guide.row_content",
    { tooltip: false },
  );
  ui.row_cell = { type: "panel", controls: [{ "button@hk_guide.row_button": {} }] };

  // Text cells (headings, footers): the display text, wrapped to the box, "..." past its height.
  ui.text_cell = {
    type: "panel",
    clips_children: true,
    "$align|default": "center",
    "$ink|default": INK,
    controls: [
      {
        "label@hk_guide.ink": {
          text: "#hk_name",
          size: ["100%", "default"],
          max_size: ["100%", "100%"],
          text_alignment: "$align",
          color: "$ink",
          ...at(0, 0),
          bindings: [coll(TEXT), view(display, "#hk_name"), view(`(not ${empty})`, "#visible")],
        },
      },
    ],
  };

  // The big picture on the left page (index 0, not tappable).
  ui.picture = {
    type: "panel",
    $icon: [48, 48],
    $flame: [16, 16],
    controls: [
      { "icon@hk_guide.icon": {} },
      { "silhouette@hk_guide.silhouette": {} },
      { "question@hk_guide.question": { font_scale_factor: 2 } },
      { "flame@hk_guide.flame": {} },
    ],
  };

  // A hot dish's cook row result: an arrow and a large slot.
  ui.cooked = {
    type: "panel",
    bindings: [coll(TEXT), view(`(not ${empty})`, "#visible")],
    controls: [
      {
        arrow: { type: "image", texture: `${T}/arrow_ink`, size: [14, 10], ...at(0, 8), layer: 6 },
      },
      { "slot@hk_guide.slot_cell": { size: [26, 26], ...at(14, 0), $frame: `${T}/slot_large` } },
    ],
  };

  // Cover buttons: a glyph (◀ ▶) or a glyph and a word (↶ Back, ⌂ Home). A dead one (role e,
  // e.g. ◀ on the first page) is drawn faded and can't be pressed.
  ui.nav_glyph_content = {
    type: "image",
    texture: "$glyph",
    size: "$glyph_size",
    anchor_from: "center",
    anchor_to: "center",
    layer: 6,
  };
  ui.nav_text_content = {
    type: "panel",
    size: ["100%", "100%"],
    layer: 6,
    controls: [
      { glyph: { type: "image", texture: "$glyph", size: [7, 7], ...at(6, 6) } },
      {
        "name@hk_guide.name_box": {
          size: ["100% - 19px", LINE],
          $name_anchor: "center",
          ...at(15, 4),
        },
      },
    ],
  };
  const navBg = (hover) => [{ bg: fill(`${T}/${hover ? "button_book_hover" : "button_book"}`) }];
  ui["nav_glyph_button@common.button"] = button(navBg, "hk_guide.nav_glyph_content");
  ui["nav_text_button@common.button"] = button(navBg, "hk_guide.nav_text_content", {
    tooltip: false,
  });
  const navCell = (content, buttonName) => ({
    type: "panel",
    controls: [
      {
        dead: {
          type: "panel",
          alpha: 0.45,
          bindings: [coll(TEXT), view(empty, "#visible")],
          controls: [...navBg(false), { [`content@${content}`]: {} }],
        },
      },
      { [`button@hk_guide.${buttonName}`]: {} },
    ],
  });
  ui.nav_glyph_cell = navCell("hk_guide.nav_glyph_content", "nav_glyph_button");
  ui.nav_text_cell = navCell("hk_guide.nav_text_content", "nav_text_button");

  // Ribbons: plum bookmarks with the chapter's icon; the open chapter's (role a) sticks out
  // further. The name is the tooltip; Home lists every chapter by name.
  const ribbonLook = (active) => ({
    type: "panel",
    size: ["100%", "100%"],
    bindings: [coll(TEXT), view(active ? is("a") : `(not ${is("a")})`, "#visible")],
    controls: [
      {
        tab: {
          type: "image",
          texture: `${T}/${active ? "ribbon_tab_active" : "ribbon_tab"}`,
          size: [active ? 33 : 26, 24],
          ...at(0, 0),
          layer: 3,
        },
      },
      { "icon@hk_guide.icon": { $icon: [12, 12], ...at(active ? 14 : 9, 6) } },
    ],
  });
  ui.ribbon_content = {
    type: "panel",
    size: ["100%", "100%"],
    controls: [{ inactive: ribbonLook(false) }, { active: ribbonLook(true) }],
  };
  ui["ribbon_button@common.button"] = button(() => [], "hk_guide.ribbon_content");
  ui.ribbon_cell = { type: "panel", controls: [{ "button@hk_guide.ribbon_button": {} }] };

  // --- placing ------------------------------------------------------------------------------------

  const full = { size: [COVER.w, COVER.h], ...at(0, 0) };
  const cellJson = (c) => ({
    [`b${c.index}_${c.template}@hk_guide.${c.template}`]: {
      collection_index: c.index,
      size: [c.w, c.h],
      ...at(c.x, c.y),
      ...c.vars,
    },
  });
  /** The cells: a collection_panel whose children are all fixed-index form buttons. */
  const cells = (list, extra = {}) => ({
    type: "collection_panel",
    ...full,
    collection_name: "form_buttons",
    ...extra,
    controls: list.map(cellJson),
  });
  const imageJson = (im, i) => ({
    [`image_${i}`]: {
      type: "image",
      texture: im.texture,
      size: [im.w, im.h],
      ...at(im.x, im.y),
      layer: im.layer ?? 6,
      ...(im.tiled ? { tiled: true } : {}),
    },
  });
  const bodyJson = (b) => ({
    body_box: {
      type: "panel",
      size: [b.w, b.h],
      ...at(b.x, b.y),
      clips_children: true,
      controls: [
        {
          body: {
            type: "label",
            color: INK,
            shadow: false,
            layer: 6,
            text: "#form_text",
            size: ["100%", "default"],
            max_size: ["100%", "100%"],
            text_alignment: b.align,
            ...at(0, 0),
            bindings: [{ binding_name: "#form_text", binding_type: "global" }],
          },
        },
      ],
    },
  });
  const showsSpread = (marker) => [
    { binding_name: "#title_text", binding_type: "global" },
    view(`(not ((#title_text - '${marker}') = #title_text))`, "#visible"),
  ];
  // Layers add up from parent to child: ribbons (0) < cover art (CHROME_LAYER) < spreads.
  const spreads = Object.entries(placed.spreads).map(([name, s]) => ({
    [name]: {
      type: "panel",
      ...full,
      layer: SPREAD_LAYER,
      bindings: showsSpread(SPREADS[name]),
      controls: [
        {
          art: {
            type: "panel",
            ...full,
            controls: [bodyJson(s.body), ...s.images.map(imageJson)],
          },
        },
        { cells: cells(s.cells) },
      ],
    },
  }));

  const { title } = placed.chrome;
  const chrome = {
    chrome: {
      type: "panel",
      ...full,
      layer: CHROME_LAYER,
      controls: [
        ...placed.chrome.images.map(imageJson),
        {
          title_box: {
            type: "panel",
            size: [title.w, title.h],
            ...at(title.x, title.y),
            clips_children: true,
            controls: [
              {
                title: {
                  type: "label",
                  color: INK,
                  shadow: false,
                  layer: 6,
                  text: "#hk_title",
                  size: ["default", "default"],
                  max_size: ["100%", LINE],
                  anchor_from: "center",
                  anchor_to: "center",
                  bindings: [
                    { binding_name: "#title_text", binding_type: "global" },
                    view(`(#title_text - ('%.${MARKER_BYTES}s' * #title_text))`, "#hk_title"),
                  ],
                },
              },
            ],
          },
        },
        { cells: cells(placed.chrome.cells) },
        { "close@common.close_button": { layer: 40, $close_button_offset: [-3, 3] } },
      ],
    },
  };

  ui.book = {
    type: "panel",
    size: SIZE,
    anchor_from: "center",
    anchor_to: "center",
    layer: 2,
    bindings: [
      { binding_name: "#title_text", binding_type: "global" },
      view(`(not ((#title_text - '${BOOK_MARKER}') = #title_text))`, "#visible"),
    ],
    controls: [{ ribbons: cells(placed.ribbons, { size: SIZE, layer: 0 }) }, chrome, ...spreads],
  };
  return ui;
}

/** server_form.long_form: the vanilla dialog (hidden for our marker) and the book. */
function serverForm(d) {
  return {
    namespace: "server_form",
    long_form: {
      type: "panel",
      controls: [
        {
          // The 8 properties of vanilla 1.26.52's long_form, unchanged; re-check on game updates.
          "long_form@common_dialogs.main_panel_no_buttons": {
            $title_panel: "common_dialogs.standard_title_label",
            $title_size: ["100% - 15px", 10],
            $title_max_size: ["100% - 15px", 10],
            size: [225, 200],
            $text_name: "#title_text",
            $title_text_binding_type: "none",
            $child_control: "server_form.long_form_panel",
            layer: 2,
            bindings: [
              { binding_name: "#title_text", binding_type: "global" },
              view(`((#title_text - '${d.BOOK_MARKER}') = #title_text)`, "#visible"),
            ],
          },
        },
        { "hk_guide_book@hk_guide.book": {} },
      ],
    },
  };
}

const OUTPUTS = (d) => [
  { file: path.join(UI_DIR, "server_form.json"), json: serverForm(d) },
  { file: path.join(UI_DIR, "_ui_defs.json"), json: { ui_defs: ["ui/hk_guide/guide.json"] } },
  { file: path.join(UI_DIR, "hk_guide/guide.json"), json: guideUi(d) },
];

async function main() {
  const d = await loadLayout();
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const { file, json } of OUTPUTS(d)) {
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    const text = await prettier.format(JSON.stringify(json), options);
    const rel = path.relative(ROOT, file);
    if (check) {
      let current = "";
      try {
        current = readFileSync(file, "utf8");
      } catch {
        // missing counts as different
      }
      if (current !== text) {
        console.error(`[gen-guide-ui] ${rel} is out of date: run node tools/gen-guide-ui.mjs`);
        stale++;
      }
      continue;
    }
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
    console.log(`[gen-guide-ui] wrote ${rel}`);
  }
  if (check) {
    if (stale > 0) process.exitCode = 1;
    else console.log("[gen-guide-ui] the guide UI is up to date");
  }
}

if (import.meta.main) await main();
