// Writes the Kitchen Guide's JSON UI book (D19, the D13 look): resource/ui/server_form.json,
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
// - Geometry follows art/harvest_kitchen/mockups (book_dish_page.png and friends), scaled to fit
//   200 UI px tall like vanilla forms; the textures are the mockups' parts, copied to
//   resource/textures/hk/ui/book/.
//
// The index map, the markers and the roles come from book-layout.ts, bundled with esbuild, so the
// layout can't drift from what the scripts send.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import * as prettier from "prettier";
import { ROOT } from "./paths.mjs";

const UI_DIR = path.join(ROOT, "packs/harvest_kitchen/resource/ui");
const T = "textures/hk/ui/book";
const FLAME = "textures/hk/ui/needs_heat";

async function loadLayout() {
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

const COVER = { x: 0, y: 0, w: 330, h: 200 };
const LEFT = { x: 8, y: 7, w: 158, h: 164 };
const RIGHT = { x: 164, y: 7, w: 158, h: 164 };
const GUTTER = { x: 160, y: 6, w: 8, h: 166 };
const NAV_Y = 176;
const RIBBON = { x: COVER.w - 6, y: 14, step: 27, w: 33, h: 24 };
const SIZE = [RIBBON.x + RIBBON.w, COVER.h];

const CHROME_LAYER = 10;
const SPREAD_LAYER = 20;

const INK = [0.23, 0.15, 0.08];
const INK_SOFT = [0.52, 0.39, 0.25];

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

// --- the layout -----------------------------------------------------------------------------------

function guideUi(d) {
  const { BOOK, SPREADS, BOOK_MARKER, MARKER_BYTES, LIST_ROWS, TABS } = d;
  const ui = { namespace: "hk_guide" };

  // Text
  ui.ink = { type: "label", color: INK, shadow: false, layer: 6 };
  ui.light = { type: "label", color: [1, 1, 1], shadow: true, layer: 9 };
  ui["name@hk_guide.ink"] = {
    text: "#hk_name",
    bindings: [coll(TEXT), view(display, "#hk_name")],
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
  const image = (tex, extra = {}) => ({
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
      { bg: image("$frame", { bindings: [coll(TEXT), view(`(not ${is("l")})`, "#visible")] }) },
      {
        bg_locked: image(`${T}/slot_locked`, { bindings: [coll(TEXT), view(is("l"), "#visible")] }),
      },
      { "button@hk_guide.slot_button": {} },
    ],
  };

  // Chips: a parchment box with an icon and a short text (effect, station, cook).
  ui.chip_content = {
    type: "stack_panel",
    orientation: "horizontal",
    size: ["100%c", 16],
    anchor_from: "center",
    anchor_to: "center",
    layer: 6,
    controls: [
      {
        icon_panel: {
          type: "panel",
          size: [18, 16],
          controls: [
            { "icon@hk_guide.icon": {} },
            { "silhouette@hk_guide.silhouette": {} },
            { "question@hk_guide.question": {} },
            { "flame@hk_guide.flame": {} },
          ],
        },
      },
      {
        "label@hk_guide.name": {
          size: ["default", 10],
          anchor_from: "left_middle",
          anchor_to: "left_middle",
        },
      },
    ],
  };
  ui["chip_button@common.button"] = button(
    () => [{ bg: image(`${T}/chip`) }],
    "hk_guide.chip_content",
  );
  ui.chip_cell = { type: "panel", controls: [{ "button@hk_guide.chip_button": {} }] };

  // List rows: a parchment button with the icon (and its count) and the name.
  ui.row_content = {
    type: "stack_panel",
    orientation: "horizontal",
    size: ["100% - 6px", 16],
    anchor_from: "left_middle",
    anchor_to: "left_middle",
    offset: [3, 0],
    layer: 6,
    controls: [
      {
        icon_panel: {
          type: "panel",
          size: [18, 16],
          controls: [{ "slot@hk_guide.slot_content": {} }],
        },
      },
      { gap: { type: "panel", size: [3, 1] } },
      {
        "label@hk_guide.name": {
          size: ["fill", 10],
          anchor_from: "left_middle",
          anchor_to: "left_middle",
        },
      },
    ],
  };
  ui["row_button@common.button"] = button(
    (hover) => [{ bg: image(`${T}/${hover ? "button_book_hover" : "button_book"}`) }],
    "hk_guide.row_content",
    { tooltip: false },
  );
  ui.row_cell = { type: "panel", controls: [{ "button@hk_guide.row_button": {} }] };

  // Text cells (headings, footers): the display text, not tappable.
  ui.text_cell = {
    type: "panel",
    "$align|default": "center",
    "$ink|default": INK,
    controls: [
      {
        "label@hk_guide.name": {
          size: ["100%", "default"],
          max_size: ["100%", "100%"],
          text_alignment: "$align",
          color: "$ink",
          anchor_from: "top_left",
          anchor_to: "top_left",
          bindings: [coll(TEXT), view(display, "#hk_name"), view(`(not ${empty})`, "#visible")],
        },
      },
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
    type: "stack_panel",
    orientation: "horizontal",
    size: ["100%c", 10],
    anchor_from: "center",
    anchor_to: "center",
    layer: 6,
    controls: [
      { glyph: { type: "image", texture: "$glyph", size: [7, 7], offset: [0, 1] } },
      { gap: { type: "panel", size: [4, 1] } },
      { "label@hk_guide.name": { size: ["default", 10] } },
    ],
  };
  const navBg = (hover) => [{ bg: image(`${T}/${hover ? "button_book_hover" : "button_book"}`) }];
  ui["nav_glyph_button@common.button"] = button(navBg, "hk_guide.nav_glyph_content");
  ui["nav_text_button@common.button"] = button(navBg, "hk_guide.nav_text_content", {
    tooltip: false,
  });
  const navCell = (content) => ({
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
      {
        [`button@hk_guide.${content.endsWith("glyph_content") ? "nav_glyph_button" : "nav_text_button"}`]:
          {},
      },
    ],
  });
  ui.nav_glyph_cell = navCell("hk_guide.nav_glyph_content");
  ui.nav_text_cell = navCell("hk_guide.nav_text_content");

  // Ribbons: plum bookmarks with an icon; the open chapter's (role a) sticks out further.
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

  // --- placing cells ----------------------------------------------------------------------------

  const cell = (template, index, x, y, w, h, vars = {}) => ({
    [`b${index}_${template}@hk_guide.${template}`]: {
      collection_index: index,
      size: [w, h],
      ...at(x, y),
      ...vars,
    },
  });
  const body = (x, y, w, h, align = "center") => ({
    body: {
      type: "label",
      color: INK,
      shadow: false,
      layer: 6,
      text: "#form_text",
      size: [w, "default"],
      max_size: [w, h],
      text_alignment: align,
      ...at(x, y),
      bindings: [{ binding_name: "#form_text", binding_type: "global" }],
    },
  });
  const showsSpread = (marker) => [
    { binding_name: "#title_text", binding_type: "global" },
    view(`(not ((#title_text - '${marker}') = #title_text))`, "#visible"),
  ];
  // Layers add up from parent to child: ribbons (0) < cover art (CHROME_LAYER) < spreads.
  const spread = (name, controls) => ({
    [name]: {
      type: "panel",
      size: [COVER.w, COVER.h],
      ...at(0, 0),
      layer: SPREAD_LAYER,
      collection_name: "form_buttons",
      bindings: showsSpread(SPREADS[name]),
      controls,
    },
  });

  const L = (dx) => LEFT.x + dx;
  const R = (dx) => RIGHT.x + dx;
  const Ly = (dy) => LEFT.y + dy;
  const Ry = (dy) => RIGHT.y + dy;

  // Recipe: left body + chips; right grid → result, the cook row and the footer.
  const grid = BOOK.grid.map((index, i) =>
    cell("slot_cell", index, R(14 + (i % 3) * 20), Ry(22 + Math.floor(i / 3) * 20), 20, 20),
  );
  const recipe = [
    body(L(8), Ly(92), 142, 40),
    cell("chip_cell", BOOK.effect, L(8), Ly(136), 68, 20),
    cell("chip_cell", BOOK.station, L(82), Ly(136), 68, 20),
    cell("text_cell", BOOK.heading, R(4), Ry(8), 150, 10),
    ...grid,
    {
      arrow: {
        type: "image",
        texture: `${T}/arrow_ink`,
        size: [14, 10],
        ...at(R(80), Ry(47)),
        layer: 6,
      },
    },
    cell("slot_cell", BOOK.result, R(100), Ry(39), 26, 26, { $frame: `${T}/slot_large` }),
    cell("chip_cell", BOOK.cook, R(14), Ry(92), 70, 20),
    {
      cooked: {
        type: "panel",
        size: [40, 26],
        ...at(R(88), Ry(89)),
        collection_index: BOOK.cooked,
        bindings: [coll(TEXT), view(`(not ${empty})`, "#visible")],
        controls: [
          {
            arrow: {
              type: "image",
              texture: `${T}/arrow_ink`,
              size: [14, 10],
              ...at(0, 8),
              layer: 6,
            },
          },
          {
            "slot@hk_guide.slot_cell": {
              size: [26, 26],
              ...at(14, 0),
              $frame: `${T}/slot_large`,
            },
          },
        ],
      },
    },
    cell("text_cell", BOOK.footer, R(8), Ry(122), 142, 36, { $ink: INK_SOFT }),
  ];

  // List: left body; right heading, rows and footer.
  const list = [
    body(L(8), Ly(92), 142, 66),
    cell("text_cell", BOOK.heading, R(4), Ry(8), 150, 10),
    ...BOOK.rows
      .slice(0, LIST_ROWS)
      .map((index, i) => cell("row_cell", index, R(9), Ry(20 + i * 19), 140, 18)),
    cell("text_cell", BOOK.footer, R(4), Ry(154), 150, 10, { $ink: INK_SOFT }),
  ];

  // Text: the body fills the right page.
  const text = [
    cell("text_cell", BOOK.heading, R(4), Ry(8), 150, 10, { $ink: INK_SOFT }),
    body(R(9), Ry(22), 140, 136, "left"),
  ];

  // The book: ribbons under the cover, cover, pages, gutter, title, picture, nav, close, spreads.
  const ribbons = BOOK.tabs.map((index, i) =>
    cell("ribbon_cell", index, RIBBON.x, RIBBON.y + i * RIBBON.step, RIBBON.w, RIBBON.h, {
      layer: 0,
    }),
  );
  if (ribbons.length !== TABS.length) throw new Error("BOOK.tabs and TABS differ in length");

  const chrome = {
    chrome: {
      type: "panel",
      size: [COVER.w, COVER.h],
      ...at(0, 0),
      layer: CHROME_LAYER,
      collection_name: "form_buttons",
      controls: [
        {
          cover: {
            type: "image",
            texture: `${T}/book_cover`,
            size: [COVER.w, COVER.h],
            ...at(0, 0),
            layer: 1,
          },
        },
        {
          left_page: {
            type: "image",
            texture: `${T}/page_left`,
            size: [LEFT.w, LEFT.h],
            ...at(LEFT.x, LEFT.y),
            layer: 2,
          },
        },
        {
          right_page: {
            type: "image",
            texture: `${T}/page_right`,
            size: [RIGHT.w, RIGHT.h],
            ...at(RIGHT.x, RIGHT.y),
            layer: 2,
          },
        },
        {
          left_grain: {
            type: "image",
            texture: `${T}/parchment_grain`,
            tiled: true,
            size: [LEFT.w - 13, LEFT.h - 7],
            ...at(LEFT.x + 6, LEFT.y + 3),
            layer: 3,
          },
        },
        {
          right_grain: {
            type: "image",
            texture: `${T}/parchment_grain`,
            tiled: true,
            size: [RIGHT.w - 13, RIGHT.h - 7],
            ...at(RIGHT.x + 7, RIGHT.y + 3),
            layer: 3,
          },
        },
        {
          gutter: {
            type: "image",
            texture: `${T}/book_gutter`,
            size: [GUTTER.w, GUTTER.h],
            ...at(GUTTER.x, GUTTER.y),
            layer: 4,
          },
        },
        {
          title: {
            type: "label",
            color: INK,
            shadow: false,
            layer: 6,
            text: "#hk_title",
            size: [LEFT.w - 12, 10],
            text_alignment: "center",
            ...at(L(6), Ly(7)),
            bindings: [
              { binding_name: "#title_text", binding_type: "global" },
              view(`(#title_text - ('%.${MARKER_BYTES}s' * #title_text))`, "#hk_title"),
            ],
          },
        },
        {
          divider: {
            type: "image",
            texture: `${T}/divider`,
            size: [100, 1],
            ...at(L(29), Ly(19)),
            layer: 5,
          },
        },
        {
          divider_gem: {
            type: "image",
            texture: `${T}/divider_gem`,
            size: [11, 5],
            ...at(L(73), Ly(17)),
            layer: 6,
          },
        },
        {
          halo: {
            type: "image",
            texture: `${T}/dish_halo`,
            size: [64, 64],
            ...at(L(47), Ly(24)),
            layer: 5,
          },
        },
        {
          picture: {
            type: "panel",
            size: [48, 48],
            ...at(L(55), Ly(32)),
            collection_index: BOOK.icon,
            $icon: [48, 48],
            $flame: [16, 16],
            layer: 1,
            controls: [
              { "icon@hk_guide.icon": {} },
              { "silhouette@hk_guide.silhouette": {} },
              { "question@hk_guide.question": { font_scale_factor: 2 } },
              { "flame@hk_guide.flame": {} },
            ],
          },
        },
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
    collection_name: "form_buttons",
    bindings: [
      { binding_name: "#title_text", binding_type: "global" },
      view(`(not ((#title_text - '${BOOK_MARKER}') = #title_text))`, "#visible"),
    ],
    controls: [
      ...ribbons,
      chrome,
      spread("recipe", recipe),
      spread("list", list),
      spread("text", text),
    ],
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

/** Every texture path the layout names (for the test: each must exist in the RP). */
export async function guideTextures() {
  const d = await loadLayout();
  const found = new Set();
  JSON.stringify(guideUi(d), (key, value) => {
    if ((key === "texture" || key === "$glyph" || key === "$frame") && typeof value === "string") {
      if (!value.startsWith("$")) found.add(value);
    }
    return value;
  });
  return [...found].sort();
}

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
