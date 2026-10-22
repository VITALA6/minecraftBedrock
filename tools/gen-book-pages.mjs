// Renders the Harvest Kitchen recipe book pages and pot screen status images (decision D14).
//
//   node tools/gen-book-pages.mjs          render every image, delete stale ones, write previews
//
// The book and the pot screen are CustomForms that show one pre-rendered image each
// (`image(src, <RP header UUID>)`). Which images exist is decided by the pack's own pure modules
// (scripts/ui/book-pages.ts: bookImageSpecs, scripts/ui/pot-status.ts: potImageSpecs), bundled
// here with esbuild like tools/gen-pot-block.mjs does, so the renderer draws exactly the images
// the script can ask for. tools/lint-pages.mjs checks the result (`npm run book` runs both).
//
// Resolution: everything is drawn on a small pixel-art canvas (book 256×160, pot 256×96 "art px")
// and scaled ×4 with nearest-neighbour (1024×640 and 1024×384 PNGs). A 16 px icon at 1× is 64 PNG
// px; at width 1 in a ~280 UI px wide form that is ~17 UI px, a little more than an inventory icon.
// The 7 px font is ~7.7 UI px, about the game font. ×4 keeps edges hard even when the game
// resamples the image a bit. Details and the lint rules: docs/harvest-kitchen/art-style.md.
//
// Art: only our own textures, from art/harvest_kitchen/generated/{items,ui,ingredients,blocks}
// and the mockup parts (art/harvest_kitchen/mockups/parts/, drawn by render-mockups.mjs from our
// palette). No vanilla textures. A missing texture is drawn as a neutral "?" placeholder with a
// warning. Text in the images is limited to numbers and symbols (◀ ▶ ? → + × !), because baked
// text can't be localized; names come from lang keys in the form's title, label and buttons.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { build } from "esbuild";
import { decodePng } from "./gen-textures.mjs";
import { ROOT } from "./paths.mjs";

export const SCALE = 4;
export const BOOK_SIZE = { w: 256, h: 160 };
export const POT_SIZE = { w: 256, h: 96 };
const RP = path.join(ROOT, "packs/harvest_kitchen/resource");
export const PREVIEW_DIR = path.join(ROOT, "art/harvest_kitchen/book_preview");
const GEN = path.join(ROOT, "art/harvest_kitchen/generated");
const PARTS_DIR = path.join(ROOT, "art/harvest_kitchen/mockups/parts");
const PALETTE = JSON.parse(readFileSync(path.join(ROOT, "art/harvest_kitchen/palette.json"))).ramps;

// ---------------------------------------------------------------------------------------------
// Pack data (the same modules the game runs)
// ---------------------------------------------------------------------------------------------

export async function loadPackData() {
  const s = "./packs/harvest_kitchen/scripts";
  const result = await build({
    stdin: {
      contents: [
        `export { bookImageSpecs, BOOK_ORDER, BOOK_TEXTURE_DIR, pageNumber, dishCrops, dishesInChapter, CHAPTERS } from "${s}/ui/book-pages";`,
        `export { potImageSpecs, POT_TEXTURE_DIR } from "${s}/ui/pot-status";`,
        `export { STATIONS, stationById } from "${s}/data/stations";`,
        `export { CROPS, cropByKey } from "${s}/data/crops";`,
        `export { DISHES, EFFECTS, findDish } from "${s}/data/dishes";`,
        `export { CUTTING_RECIPES, recipeMaking } from "${s}/data/recipes";`,
        `export { cropOfItem } from "${s}/book/unlock";`,
      ].join("\n"),
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

// ---------------------------------------------------------------------------------------------
// Image basics (as in render-mockups.mjs). An image is {w, h, px: Uint8Array RGBA}.
// ---------------------------------------------------------------------------------------------

const hex = (h, a = 255) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(a);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function img(w, h, fill) {
  const im = { w, h, px: new Uint8Array(w * h * 4) };
  if (fill) {
    const px = new Uint32Array(im.px.buffer);
    px.fill(new Uint32Array(new Uint8Array(fill).buffer)[0]);
  }
  return im;
}

function get(im, x, y) {
  const i = (y * im.w + x) * 4;
  return [im.px[i], im.px[i + 1], im.px[i + 2], im.px[i + 3]];
}

/** Opaque colours overwrite; a colour with alpha < 255 is mixed into what's below and the
 *  pixel keeps the alpha below, so drawing on an opaque page never makes a translucent pixel. */
function put(im, x, y, c) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h || !c || c[3] === 0) return;
  const i = (y * im.w + x) * 4;
  const px = im.px;
  if (c[3] === 255) {
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = 255;
  } else {
    const a = c[3] / 255;
    for (let k = 0; k < 3; k++) im.px[i + k] = Math.round(c[k] * a + im.px[i + k] * (1 - a));
    if (im.px[i + 3] === 0) im.px[i + 3] = 255;
  }
}

function rect(im, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(im, i, j, c);
}

/** Draws `src` at (x, y), integer `scale`. tint: multiply; solid: one colour (silhouette);
 *  alpha: ghost (mixed into the opaque background); clip: [x0, x1) columns of src to draw. */
function blit(dst, src, x, y, { scale = 1, tint, solid, alpha = 1, gray = false, clip } = {}) {
  for (let sy = 0; sy < src.h; sy++)
    for (let sx = 0; sx < src.w; sx++) {
      if (clip && (sx < clip[0] || sx >= clip[1])) continue;
      let c = get(src, sx, sy);
      if (c[3] === 0) continue;
      if (gray) {
        const l = Math.round(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
        c = [l, l, l, c[3]];
      }
      if (tint) c = [0, 1, 2].map((k) => Math.round((c[k] * tint[k]) / 255)).concat(c[3]);
      if (solid) c = [...solid.slice(0, 3), c[3]];
      if (alpha < 1) c = [c[0], c[1], c[2], Math.round(c[3] * alpha)];
      rect(dst, x + sx * scale, y + sy * scale, scale, scale, c);
    }
}

function stretch(dst, src, sx, sy, sw, sh, dx, dy, dw, dh) {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;
  for (let j = 0; j < dh; j++)
    for (let i = 0; i < dw; i++)
      put(
        dst,
        dx + i,
        dy + j,
        get(src, sx + Math.floor((i * sw) / dw), sy + Math.floor((j * sh) / dh)),
      );
}

/** 9-slice: corners fixed, edges and centre stretched. inset = [left, top, right, bottom]. */
function nine(dst, src, x, y, w, h, inset) {
  const [l, t, r, b] = typeof inset === "number" ? [inset, inset, inset, inset] : inset;
  const sxs = [0, l, src.w - r, src.w];
  const sys = [0, t, src.h - b, src.h];
  const dxs = [x, x + l, x + w - r, x + w];
  const dys = [y, y + t, y + h - b, y + h];
  for (let j = 0; j < 3; j++)
    for (let i = 0; i < 3; i++)
      stretch(
        dst,
        src,
        sxs[i],
        sys[j],
        sxs[i + 1] - sxs[i],
        sys[j + 1] - sys[j],
        dxs[i],
        dys[j],
        dxs[i + 1] - dxs[i],
        dys[j + 1] - dys[j],
      );
}

function tile(dst, src, x, y, w, h) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) put(dst, x + i, y + j, get(src, i % src.w, j % src.h));
}

function flipX(src) {
  const out = img(src.w, src.h);
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) put(out, src.w - 1 - x, y, get(src, x, y));
  return out;
}

export function upscale(src, s) {
  const out = img(src.w * s, src.h * s);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const i = (Math.floor(y / s) * src.w + Math.floor(x / s)) * 4;
      out.px.set(src.px.subarray(i, i + 4), (y * out.w + x) * 4);
    }
  return out;
}

function sprite(rows, legend) {
  const im = img(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => put(im, x, y, legend[ch])));
  return im;
}

// ---------------------------------------------------------------------------------------------
// PNG output: indexed colour (a page uses well under 256 colours); the repeated rows of the ×4
// scale use the "Up" filter, so they compress to almost nothing. Deterministic.
// ---------------------------------------------------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG of `im` scaled ×`scale` (nearest-neighbour). Colours are indexed at art size, then each
 *  row is widened and repeated, so a 1024 px page costs about as much as its 256 px source. */
export function encodeIndexedPng(im, scale = 1) {
  const index = new Map();
  const colours = [];
  const idx = new Uint16Array(im.w * im.h);
  for (let i = 0; i < im.w * im.h; i++) {
    const a = im.px[i * 4 + 3];
    const key =
      a === 0
        ? -1
        : im.px[i * 4] * 16777216 + im.px[i * 4 + 1] * 65536 + im.px[i * 4 + 2] * 256 + a;
    let k = index.get(key);
    if (k === undefined) {
      k = colours.length;
      index.set(key, k);
      colours.push(a === 0 ? [0, 0, 0, 0] : [...im.px.subarray(i * 4, i * 4 + 4)]);
    }
    idx[i] = k;
  }
  if (colours.length > 256) throw new Error(`${colours.length} colours: too many for a page`);
  const w = im.w * scale;
  const h = im.h * scale;
  const rows = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    const o = y * (w + 1);
    if (y % scale !== 0) {
      rows[o] = 2; // Up: identical to the row above, all zeros
      continue;
    }
    rows[o] = 0;
    const sy = y / scale;
    for (let x = 0; x < w; x++) rows[o + 1 + x] = idx[sy * im.w + Math.floor(x / scale)];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 3; // indexed colour
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr)];
  parts.push(chunk("PLTE", Buffer.from(colours.flatMap((c) => c.slice(0, 3)))));
  if (colours.some((c) => c[3] !== 255)) {
    parts.push(chunk("tRNS", Buffer.from(colours.map((c) => c[3]))));
  }
  parts.push(chunk("IDAT", zlib.deflateSync(rows, { level: 9 })));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

// ---------------------------------------------------------------------------------------------
// Pixel font (from render-mockups.mjs): 7 px cap height, 1 px spacing. In the pages only digits
// and symbols are used; letters are for the preview sheets.
// ---------------------------------------------------------------------------------------------

const LOWER = {
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".###.", "#...#", "#....", "#...#", ".###."],
  d: ["....#", "....#", ".##.#", "#..##", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".####"],
  f: ["..##", ".#..", "####", ".#..", ".#..", ".#..", ".#.."],
  g: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "####."],
  h: ["#....", "#....", "#.##.", "##..#", "#...#", "#...#", "#...#"],
  i: ["#", ".", "#", "#", "#", "#", "#"],
  j: ["...#", "....", "...#", "...#", "...#", "...#", "#..#", ".##."],
  k: ["#...", "#...", "#..#", "#.#.", "##..", "#.#.", "#..#"],
  l: ["#.", "#.", "#.", "#.", "#.", "#.", ".#"],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#...#", "#...#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "#.##.", "##..#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".....", ".##.#", "#..##", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#.", ".#.", "###", ".#.", ".#.", ".#.", "..#"],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".####"],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".####"],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#...#", ".####", "....#", "####."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
};

const DIGITS = {
  0: [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  1: ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", "#####"],
  2: [".###.", "#...#", "....#", "..##.", ".#...", "#...#", "#####"],
  3: [".###.", "#...#", "....#", "..##.", "....#", "#...#", ".###."],
  4: ["...##", "..#.#", ".#..#", "#...#", "#####", "....#", "....#"],
  5: ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  6: ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  7: ["#####", "#...#", "....#", "...#.", "..#..", "..#..", "..#.."],
  8: [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  9: [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
};

const SYMBOLS = {
  " ": ["...", "...", "...", "...", "...", "...", "..."],
  "!": ["#", "#", "#", "#", "#", ".", "#"],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "-": ["....", "....", "....", "####", "....", "....", "...."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "#####"],
  "×": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "→": [".......", "....#..", ".....#.", "#######", ".....#.", "....#..", "......."],
};

const GLYPHS = { ...LOWER, ...DIGITS, ...SYMBOLS };

function glyph(ch) {
  const g = GLYPHS[ch];
  if (!g) throw new Error(`No glyph for ${JSON.stringify(ch)}`);
  return g;
}

export const GLYPH_HEIGHT = 7;

function textWidth(s, scale = 1) {
  let w = 0;
  for (const ch of s) w += (glyph(ch)[0].length + 1) * scale;
  return Math.max(0, w - scale);
}

// ---------------------------------------------------------------------------------------------
// Readability records: what lint-pages.mjs measures (icons and text, with their colours).
// ---------------------------------------------------------------------------------------------

let elements = [];

function note(el) {
  elements.push(el);
}

/** Text with its cap line at y. `bg` is the colour behind it (for the contrast check). */
function text(im, s, x, y, colour, { scale = 1, shadow, outline, bg } = {}) {
  const pass = (ox, oy, c) => {
    let cx = x + ox;
    for (const ch of s) {
      const g = glyph(ch);
      g.forEach((row, gy) =>
        [...row].forEach((p, gx) => {
          if (p === "#") rect(im, cx + gx * scale, y + oy + gy * scale, scale, scale, c);
        }),
      );
      cx += (g[0].length + 1) * scale;
    }
  };
  if (outline)
    for (const [ox, oy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ])
      // prettier-ignore
      pass(ox * scale, oy * scale, outline);
  if (shadow) pass(scale, scale, shadow);
  pass(0, 0, colour);
  const w = textWidth(s, scale);
  note({
    kind: "text",
    text: s,
    x,
    y,
    w,
    h: GLYPH_HEIGHT * scale,
    scale,
    fg: colour.slice(0, 3),
    bg: (outline ?? shadow ?? bg).slice(0, 3),
  });
  return w;
}

function textCentered(im, s, cx, y, colour, opts = {}) {
  const w = textWidth(s, opts.scale ?? 1);
  text(im, s, Math.round(cx - w / 2), y, colour, opts);
}

// ---------------------------------------------------------------------------------------------
// Art: our icons and the mockup parts
// ---------------------------------------------------------------------------------------------

const warned = new Set();

/** Neutral stand-in for a texture that isn't drawn yet: parchment tile with a "?". */
function placeholder() {
  const im = img(16, 16);
  rect(im, 1, 1, 14, 14, hex("#5e564c"));
  rect(im, 2, 2, 12, 12, hex("#9a8f80"));
  const q = glyph("?");
  q.forEach((row, gy) =>
    [...row].forEach((p, gx) => {
      if (p === "#") put(im, 5 + gx, 4 + gy, hex("#f4ead6"));
    }),
  );
  return im;
}

const cache = new Map();

function art(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const file = path.join(GEN, `${rel}.png`);
  let im;
  if (existsSync(file)) im = decodePng(readFileSync(file));
  if (!im) {
    if (!warned.has(rel)) console.warn(`[book] warning: ${rel}.png missing, drawing a placeholder`);
    warned.add(rel);
    im = placeholder();
  }
  cache.set(rel, im);
  return im;
}

/** Our icon for an item id: hk:<name> -> items/<name>, minecraft:<name> -> ingredients/<name>. */
function itemArt(id) {
  const [ns, name] = id.split(":");
  return art(ns === "hk" ? `items/${name}` : `ingredients/${name}`);
}

function part(name) {
  const key = `part:${name}`;
  if (!cache.has(key)) {
    const file = path.join(PARTS_DIR, `${name}.png`);
    if (!existsSync(file)) throw new Error(`missing mockup part ${file}`);
    cache.set(key, decodePng(readFileSync(file)));
  }
  return cache.get(key);
}

const INSET = {
  book_cover: 10,
  page_left: [6, 3, 7, 4],
  page_right: [7, 3, 6, 4],
  book_gutter: [0, 1, 0, 1],
  slot: 1,
  slot_large: 1,
  slot_locked: 1,
  chip: 3,
  badge: 3,
  pot_well: 7,
  button_book: [3, 3, 3, 5],
};

const ramp = (name) => PALETTE[name].shades.map((h) => hex(h));

const C = {
  pBase: hex("#eedcb0"),
  pDark: hex("#e0c896"),
  ink: hex("#3b2714"),
  inkSoft: hex("#866340"),
  silhouette: hex("#4a3826"),
  silhouetteSlot: hex("#262626"),
  emptyFood: hex("#9c8562"),
  slot: hex("#8b8b8b"),
  slotLocked: hex("#5a5a5a"),
  panel: hex("#c6c6c6"),
  panelDark: hex("#555555"),
  white: hex("#ffffff"),
  black: hex("#000000"),
  countShadow: hex("#3f3f3f"),
  need: hex("#ffff55"), // vanilla §e, for "+1" on missing pot ingredients
  warn: hex("#ff5555"), // vanilla §c
};

const luminance = ([r, g, b]) => {
  const ch = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** `colour` darkened toward black until it reaches text contrast (4.5:1, with margin) on `bg`. */
function readableOn(colour, bg) {
  let c = colour;
  for (let t = 0.1; contrast(c, bg) < 4.7 && t <= 1; t += 0.1) c = mix(colour, C.black, t);
  return c;
}

const FAMILY = Object.fromEntries(
  ["heal", "move", "work", "explore"].map((f) => {
    const r = ramp(`family_${f}`);
    const fill = mix(mix(r[2], hex("#ffffff"), 0.62), C.pBase, 0.25);
    return [
      f,
      {
        dark: readableOn(r[0], fill),
        fill,
        icon: () => art(`ui/family_${f}`),
      },
    ];
  }),
);

/** The food shank, our own 9×9 drawing (the vanilla HUD icon isn't used). */
const SHANK = sprite(
  [
    "....oooo.",
    "...ohhrro",
    "..ohrrrdo",
    "..orrrrdo",
    "..orrrddo",
    ".owoddoo.",
    "owwoo....",
    "oowo.....",
    ".oo......",
  ],
  {
    o: hex("#3b1d0f"),
    h: hex("#e08a5a"),
    r: hex("#b5552d"),
    d: hex("#7a3018"),
    w: hex("#efe6d2"),
  },
);

// ---------------------------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------------------------

function slot(im, x, y, size = 20, kind = "slot") {
  nine(im, part(kind), x, y, size, size, INSET[kind]);
}

/** An icon with a readability record. */
function icon(im, src, x, y, { scale = 1, bg, ghost = false, solid, label } = {}) {
  blit(im, src, x, y, { scale, solid, alpha: ghost ? 0.35 : 1 });
  note({
    kind: ghost ? "ghost" : solid ? "silhouette" : "icon",
    label,
    x,
    y,
    w: src.w * scale,
    h: src.h * scale,
    scale,
    bg: bg.slice(0, 3),
  });
}

/** An item in a slot: normal, locked (silhouette + "?"), or ghost; count bottom-right. */
function item(im, src, x, y, { size = 20, scale = 1, count, locked = false, ghost = false } = {}) {
  slot(im, x, y, size, locked ? "slot_locked" : "slot");
  if (!src) return;
  const s = 16 * scale;
  const ox = x + Math.floor((size - s) / 2);
  const oy = y + Math.floor((size - s) / 2);
  if (locked) {
    icon(im, src, ox, oy, { scale, solid: C.silhouetteSlot, bg: C.slotLocked });
    const qs = scale >= 2 ? 2 : 1;
    textCentered(im, "?", x + size / 2 + 0.5, y + Math.floor((size - 7 * qs) / 2), C.white, {
      scale: qs,
      shadow: C.black,
    });
    return;
  }
  icon(im, src, ox, oy, { scale, ghost, bg: C.slot });
  if (count !== undefined && (typeof count === "string" || count > 1)) {
    const cs = scale >= 2 ? 2 : 1;
    const s2 = String(count);
    const w = textWidth(s2, cs);
    const colour = typeof count === "string" && count.startsWith("+") ? C.need : C.white;
    text(im, s2, x + size - 1 - w - cs, y + size - 1 - 8 * cs, colour, {
      scale: cs,
      shadow: C.countShadow,
    });
  }
}

/** "cod or salmon": both fish in one slot. */
function itemsInSlot(im, ids, x, y, opts = {}) {
  if (ids.length < 2) return item(im, itemArt(ids[0]), x, y, opts);
  item(im, undefined, x, y, opts);
  const size = opts.size ?? 20;
  const [a, b] = ids;
  const silhouette = opts.locked ? C.silhouetteSlot : undefined;
  const bg = opts.locked ? C.slotLocked : C.slot;
  icon(im, itemArt(b), x + size - 17, y + 1, { bg, solid: silhouette, ghost: opts.ghost });
  icon(im, itemArt(a), x + 1, y + size - 17, { bg, solid: silhouette, ghost: opts.ghost });
  if (typeof opts.count === "string") {
    const w = textWidth(opts.count);
    text(im, opts.count, x + size - 2 - w, y + size - 9, C.need, { shadow: C.countShadow });
  }
}

function chip(im, x, y, w, h) {
  nine(im, part("chip"), x, y, w, h, INSET.chip);
}

function halo(im, x, y) {
  blit(im, part("dish_halo"), x, y);
}

/** Big icon on the sunburst; locked: a silhouette with a big "?". */
function heroIcon(im, area, src, { locked = false } = {}) {
  const hx = area.x + Math.floor((area.w - 64) / 2);
  const hy = area.y + 1;
  halo(im, hx, hy);
  if (locked) {
    icon(im, src, hx + 8, hy + 8, { scale: 3, solid: C.silhouette, bg: C.pBase });
    textCentered(im, "?", hx + 32.5, hy + 22, hex("#f7ebc9"), {
      scale: 3,
      outline: hex("#2a1c10"),
    });
  } else icon(im, src, hx + 8, hy + 8, { scale: 3, bg: hex("#f3e0b0") });
  return { x: hx, y: hy };
}

/** Effect badge: family icon + duration ("8 s"). Returns its width. */
function badgeWidth(seconds) {
  return 4 + 16 + 3 + textWidth(`${seconds} s`) + 5;
}

function effectBadge(im, x, y, family, seconds) {
  const fam = FAMILY[family];
  const w = badgeWidth(seconds);
  nine(im, part(`badge_${family}`), x, y, w, 22, INSET.badge);
  icon(im, fam.icon(), x + 4, y + 3, { bg: fam.fill });
  text(im, `${seconds} s`, x + 23, y + 8, fam.dark, { bg: fam.fill });
  return w;
}

function lockedBadge(im, x, y) {
  const w = 4 + 16 + 3 + textWidth("?") + 5;
  nine(im, part("badge_locked"), x, y, w, 22, INSET.badge);
  icon(im, art("ui/locked"), x + 4, y + 3, { bg: hex("#b5b5b5") });
  text(im, "?", x + 23, y + 8, hex("#3d3d3d"), { bg: hex("#b5b5b5") });
  return w;
}

/** Station chip: the station's icon (+ flame if it needs heat). Returns its width. */
function stationWidth(chapter, needsHeat) {
  return chapter === "crafting" || !needsHeat ? 24 : 4 + 16 + 2 + 5 + 2 + 16 + 4;
}

function stationChip(im, x, y, chapter, stationIcon, needsHeat) {
  const w = stationWidth(chapter, needsHeat);
  chip(im, x, y, w, 22);
  icon(im, stationIcon, x + 4, y + 3, { bg: C.pDark });
  if (w > 24) {
    text(im, "+", x + 22, y + 8, C.ink, { bg: C.pDark });
    icon(im, art("ui/needs_heat"), x + 29, y + 3, { bg: C.pDark });
  }
  return w;
}

/** Food as shanks at 2× (2 nutrition per shank, half shanks for odd values). */
function foodRow(im, cx, y, nutrition, { locked = false, prefix } = {}) {
  const full = Math.floor(nutrition / 2);
  const half = nutrition % 2;
  const n = full + half;
  const pw = prefix ? textWidth(prefix) + 4 : 0;
  const w = 6 + pw + n * 20 - 2;
  const x = Math.round(cx - w / 2);
  chip(im, x, y, w, 24);
  if (prefix) text(im, prefix, x + 4, y + 9, C.ink, { bg: C.pDark });
  for (let i = 0; i < n; i++) {
    const sx = x + 3 + pw + i * 20;
    const isHalf = i === full;
    if (locked) {
      icon(im, SHANK, sx, y + 3, { scale: 2, solid: C.emptyFood, bg: C.pDark });
      continue;
    }
    if (isHalf) {
      blit(im, SHANK, sx, y + 3, { scale: 2, solid: C.emptyFood });
      icon(im, SHANK, sx, y + 3, { scale: 2, bg: C.pDark });
      // re-cover the right half: a half shank
      blit(im, SHANK, sx, y + 3, { scale: 2, solid: C.emptyFood, clip: [5, 9] });
    } else icon(im, SHANK, sx, y + 3, { scale: 2, bg: C.pDark });
  }
}

// ---------------------------------------------------------------------------------------------
// The book
// ---------------------------------------------------------------------------------------------

function bookFrame(pageNo, total) {
  const { w, h } = BOOK_SIZE;
  const im = img(w, h);
  nine(im, part("book_cover"), 0, 0, w, h, INSET.book_cover);
  const left = { x: 6, y: 5, w: 123, h: h - 10 };
  const right = { x: 127, y: 5, w: 123, h: h - 10 };
  nine(im, part("page_left"), left.x, left.y, left.w, left.h, INSET.page_left);
  nine(im, part("page_right"), right.x, right.y, right.w, right.h, INSET.page_right);
  tile(im, part("parchment_grain"), left.x + 6, left.y + 3, left.w - 13, left.h - 7);
  tile(im, part("parchment_grain"), right.x + 7, right.y + 3, right.w - 13, right.h - 7);
  nine(im, part("book_gutter"), 124, 4, 8, h - 8, INSET.book_gutter);
  const L = { x: 13, y: 9, w: 108, h: 142 };
  const R = { x: 135, y: 9, w: 108, h: 142 };
  if (pageNo) textCentered(im, `${pageNo}/${total}`, L.x + L.w / 2, L.y + L.h - 8, C.ink, { bg: C.pBase }); // prettier-ignore
  return { im, L, R };
}

/** Grid of up to 9 ingredient slots (20 px), arrow, result slot. */
function recipeGrid(im, R, ingredients, result, { lockedCrops = [], cropOf, resultLocked }) {
  const gx = R.x;
  const gy = R.y + 1;
  for (let i = 0; i < 9; i++) {
    const x = gx + (i % 3) * 20;
    const y = gy + Math.floor(i / 3) * 20;
    const ing = ingredients[i];
    if (!ing) {
      slot(im, x, y);
      continue;
    }
    const locked = ing.items.some((id) => lockedCrops.includes(cropOf(id)));
    itemsInSlot(im, ing.items, x, y, { count: ing.count, locked });
  }
  blit(im, part("arrow_ink"), gx + 64, gy + 25);
  const rx = gx + 82;
  const ry = gy + 17;
  nine(im, part("slot_large"), rx, ry, 26, 26, INSET.slot_large);
  if (resultLocked) {
    icon(im, itemArt(result), rx + 5, ry + 5, { solid: C.silhouetteSlot, bg: C.slot });
    textCentered(im, "?", rx + 13.5, ry + 10, C.white, { shadow: C.black });
  } else icon(im, itemArt(result), rx + 5, ry + 5, { bg: C.slot });
  return gy + 60;
}

const BIOME_OF = [
  [/^minecraft:(sunflower_)?plains$/, "plains"],
  [/^minecraft:(birch_|flower_)?forest(_hills)?$|^minecraft:birch_forest_hills$/, "forest"],
  [/^minecraft:river$/, "river"],
  [/^minecraft:(mega_)?taiga(_hills)?$/, "taiga"],
  [/^minecraft:savanna(_plateau)?$/, "savanna"],
  [/^minecraft:(bamboo_)?jungle(_hills|_edge)?$/, "jungle"],
  [/^minecraft:mesa(_plateau(_stone)?)?$/, "badlands"],
  [/^minecraft:swampland$/, "swamp"],
  [/^minecraft:meadow$/, "meadow"],
  [/^minecraft:cherry_grove$/, "cherry_grove"],
];

/** The biome icons for a crop's biome list, deduplicated, in list order. */
function biomeIcons(crop) {
  const out = [];
  for (const id of crop.biomes) {
    const hit = BIOME_OF.find(([re]) => re.test(id));
    if (!hit) throw new Error(`no biome icon for ${id} (crop ${crop.key}): extend BIOME_OF`);
    if (!out.includes(hit[1])) out.push(hit[1]);
  }
  return out;
}

/** "Where to find" rows: [grass] [biome…] → [seed]; locked seeds are silhouettes. */
function findStrip(im, x, y, w, crops, lockedKeys, maxBiomes = 3) {
  const h = 5 + crops.length * 19;
  chip(im, x, y, w, h);
  crops.forEach((crop, i) => {
    const ry = y + 3 + i * 19;
    icon(im, art("ingredients/short_grass"), x + 4, ry + 1, { bg: C.pDark });
    biomeIcons(crop)
      .slice(0, maxBiomes)
      .forEach((b, j) => icon(im, art(`ui/biome_${b}`), x + 22 + j * 17, ry + 1, { bg: C.pDark }));
    text(im, "→", x + w - 34, ry + 6, C.ink, { bg: C.pDark });
    item(im, itemArt(crop.seed), x + w - 23, ry, {
      size: 18,
      locked: lockedKeys.includes(crop.key),
    });
  });
  return y + h;
}

function familyLegend(im, area, y) {
  ["heal", "move", "work", "explore"].forEach((f, i) => {
    const x = area.x + i * 28;
    nine(im, part(`badge_${f}`), x, y, 24, 22, INSET.badge);
    icon(im, FAMILY[f].icon(), x + 4, y + 3, { bg: FAMILY[f].fill });
  });
}

function familyKey(data, dish) {
  return dish.effect ? data.EFFECTS[dish.effect.effect]?.family : undefined;
}

function chapterIcon(chapter) {
  if (chapter === "board") return art("items/cutting_board");
  if (chapter === "crafting") return art("ingredients/crafting_table");
  if (chapter === "crops") return art("ui/chapter_crops");
  return art("items/cooking_pot"); // stations: the pot (an oven would add its icon here)
}

function dishTiles(im, data, R, dishes) {
  dishes.forEach((dish, i) => {
    const x = R.x + (i % 4) * 28;
    const y = R.y + 1 + Math.floor(i / 4) * 28;
    nine(im, part("slot"), x, y, 24, 24, INSET.slot);
    icon(im, itemArt(dish.id), x + 4, y + 4, { solid: C.silhouetteSlot, bg: C.slot });
    const f = familyKey(data, dish);
    if (f) blit(im, part(`gem_${f}`), x + 16, y + 1);
  });
}

function pageHome(data, frame) {
  const { im, L, R } = frame;
  const h = heroIcon(im, L, art("items/recipe_book"));
  // three dishes peeking around the book
  icon(im, art("items/tomato_soup"), h.x - 2, h.y + 46, { bg: C.pBase });
  icon(im, art("items/strawberry_cake"), h.x + 50, h.y + 46, { bg: C.pBase });
  familyLegend(im, L, L.y + 74);
  const rows = [
    [art("ui/chapter_what_can_i_make"), "?"],
    ...data.CHAPTERS.map((c) => [
      chapterIcon(c),
      String(
        c === "crops"
          ? data.CROPS.length
          : c === "board"
            ? data.CUTTING_RECIPES.length
            : data.dishesInChapter(c).length,
      ),
    ]),
  ];
  rows.forEach(([src, n], i) => {
    const y = R.y + 1 + i * 26;
    nine(im, part("button_book"), R.x, y, R.w, 24, INSET.button_book);
    item(im, src, R.x + 3, y + 2);
    text(im, n, R.x + R.w - 8 - textWidth(n, 2), y + 4, C.ink, { scale: 2, bg: hex("#e6d0a0") });
  });
}

function pageWhat(data, frame) {
  const { im, L, R } = frame;
  heroIcon(im, L, art("ui/chapter_what_can_i_make"));
  // "your bag": a 3×3 inventory with ingredients -> a dish you can make
  const bag = [
    ["hk:tomato", 2],
    ["minecraft:bowl", 1],
    ["hk:onion", 1],
    ["minecraft:carrot", 1],
  ];
  for (let i = 0; i < 9; i++) {
    const [id, n] = bag[i] ?? [];
    const x = R.x + (i % 3) * 20;
    const y = R.y + 21 + Math.floor(i / 3) * 20;
    if (id) item(im, itemArt(id), x, y, { count: n });
    else slot(im, x, y);
  }
  blit(im, part("arrow_ink"), R.x + 64, R.y + 46);
  nine(im, part("slot_large"), R.x + 82, R.y + 38, 26, 26, INSET.slot_large);
  icon(im, itemArt("hk:tomato_soup"), R.x + 87, R.y + 43, { bg: C.slot });
  textCentered(im, "?", L.x + L.w / 2, L.y + 76, C.ink, { scale: 3, bg: C.pBase });
}

function pageChapter(data, frame, chapter) {
  const { im, L, R } = frame;
  if (chapter === "crops") {
    heroIcon(im, L, chapterIcon("crops"));
    // break grass -> seeds -> plant on farmland
    const y = L.y + 76;
    item(im, art("ingredients/short_grass"), L.x + 10, y);
    text(im, "→", L.x + 34, y + 6, C.ink, { bg: C.pBase });
    item(im, art("items/tomato_seeds"), L.x + 44, y, { locked: true });
    text(im, "→", L.x + 68, y + 6, C.ink, { bg: C.pBase });
    item(im, art("ingredients/farmland"), L.x + 78, y);
    // every biome icon: seeds depend on where the grass grows
    const all = [...new Set(data.CROPS.flatMap((crop) => biomeIcons(crop)))];
    chip(im, R.x, R.y + 1, R.w, 8 + Math.ceil(all.length / 5) * 20);
    all.forEach((b, i) =>
      icon(im, art(`ui/biome_${b}`), R.x + 7 + (i % 5) * 20, R.y + 5 + Math.floor(i / 5) * 20, {
        bg: C.pDark,
      }),
    );
    return;
  }
  if (chapter === "board") {
    heroIcon(im, L, chapterIcon("board"));
    data.CUTTING_RECIPES.forEach((recipe, i) => {
      const y = R.y + 1 + i * 26;
      chip(im, R.x, y, R.w, 24);
      item(im, itemArt(recipe.input), R.x + 4, y + 2);
      text(im, "→", R.x + 28, y + 8, C.ink, { bg: C.pDark });
      icon(im, art("items/cutting_board"), R.x + 39, y + 4, { bg: C.pDark });
      text(im, "→", R.x + 59, y + 8, C.ink, { bg: C.pDark });
      item(im, itemArt(recipe.output), R.x + 70, y + 2, { count: recipe.count });
    });
    return;
  }
  const station = data.stationById(chapter);
  const h = heroIcon(im, L, chapterIcon(chapter));
  if (station?.needsHeat) icon(im, art("ui/needs_heat"), h.x + 24, h.y + 47, { bg: C.pBase });
  familyLegend(im, L, L.y + 74);
  dishTiles(im, data, R, data.dishesInChapter(chapter));
}

function pageDish(data, frame, dishId, missing) {
  const { im, L, R } = frame;
  const dish = data.findDish(dishId);
  const made = data.recipeMaking(dishId);
  const locked = missing.length > 0;
  const chapter = made?.kind === "station" ? made.recipe.station : "crafting";
  const station = made?.kind === "station" ? data.stationById(chapter) : undefined;
  const needsHeat = station?.needsHeat ?? false;

  heroIcon(im, L, itemArt(dishId), { locked });
  // effect badge + station chip
  const rowY = L.y + 68;
  const family = familyKey(data, dish);
  const bw = locked
    ? 4 + 16 + 3 + textWidth("?") + 5
    : family
      ? badgeWidth(dish.effect.seconds)
      : 0;
  const sw = stationWidth(chapter, needsHeat);
  const gap = bw > 0 ? 4 : 0;
  let x = L.x + Math.floor((L.w - (bw + gap + sw)) / 2);
  if (locked) x += lockedBadge(im, x, rowY) + gap;
  else if (family) x += effectBadge(im, x, rowY, family, dish.effect.seconds) + gap;
  stationChip(im, x, rowY, chapter, chapterIcon(chapter), needsHeat);
  // food (a sliced dish: slices × food per slice)
  foodRow(im, L.x + L.w / 2, rowY + 26, dish.slices ? dish.slices.nutrition : dish.nutrition, {
    locked,
    prefix: dish.slices ? `${dish.slices.count}×` : undefined,
  });

  const cropOf = (id) => data.cropOfItem(id);
  const end = recipeGrid(im, R, made?.recipe.ingredients ?? [], dishId, {
    lockedCrops: missing,
    cropOf,
    resultLocked: locked,
  });
  const keys = locked ? missing : data.dishCrops(dishId);
  const crops = keys.map((k) => data.cropByKey(k));
  if (crops.length > 0) findStrip(im, R.x, end + 6, R.w, crops, missing);
}

function pageCrop(data, frame, key, locked) {
  const { im, L, R } = frame;
  const crop = data.cropByKey(key);
  heroIcon(im, L, itemArt(crop.produce), { locked });
  // growth stages
  const name = crop.block.split(":")[1];
  const sy = L.y + 72;
  for (let s = 0; s < 4; s++) {
    const x = L.x + 1 + s * 27;
    nine(im, part(locked ? "slot_locked" : "slot"), x, sy, 20, 20, INSET.slot);
    const stage = art(`blocks/${name}_stage_${s}`);
    if (locked) icon(im, stage, x + 2, sy + 2, { solid: C.silhouetteSlot, bg: C.slotLocked });
    else icon(im, stage, x + 2, sy + 2, { bg: C.slot });
    if (s < 3) text(im, "→", x + 20, sy + 6, C.ink, { bg: C.pBase });
  }
  // plant: seed -> farmland
  const py = sy + 28;
  item(im, itemArt(crop.seed), L.x + 24, py, { locked });
  text(im, "→", L.x + 48, py + 6, C.ink, { bg: C.pBase });
  item(im, art("ingredients/farmland"), L.x + 60, py);

  // right: where to find (all biomes), then the board or the bush pick
  let y = findStrip(im, R.x, R.y + 1, R.w, [crop], locked ? [key] : [], 4) + 4;
  const cut = data.CUTTING_RECIPES.find((r) => r.input === crop.produce);
  if (cut) {
    chip(im, R.x, y, R.w, 24);
    item(im, itemArt(cut.input), R.x + 4, y + 2, { locked });
    text(im, "→", R.x + 28, y + 8, C.ink, { bg: C.pDark });
    icon(im, art("items/cutting_board"), R.x + 39, y + 4, { bg: C.pDark });
    text(im, "→", R.x + 59, y + 8, C.ink, { bg: C.pDark });
    item(im, itemArt(cut.output), R.x + 70, y + 2, { count: cut.count, locked });
    y += 28;
  }
  if (crop.type === "bush" && crop.pick) {
    chip(im, R.x, y, R.w, 24);
    nine(im, part(locked ? "slot_locked" : "slot"), R.x + 4, y + 2, 20, 20, INSET.slot);
    const ripe = art(`blocks/${name}_stage_3`);
    icon(im, ripe, R.x + 6, y + 4, locked ? { solid: C.silhouetteSlot, bg: C.slotLocked } : { bg: C.slot }); // prettier-ignore
    text(im, "→", R.x + 28, y + 8, C.ink, { bg: C.pDark });
    item(im, itemArt(crop.produce), R.x + 39, y + 2, { locked });
    text(im, `${crop.pick.min}-${crop.pick.max}`, R.x + 63, y + 8, C.ink, { bg: C.pDark });
  }
}

function renderBookPage(data, spec, total) {
  const frame = bookFrame(data.pageNumber(spec.page), total);
  const p = spec.page;
  if (p.kind === "home") pageHome(data, frame);
  else if (p.kind === "what") pageWhat(data, frame);
  else if (p.kind === "chapter") pageChapter(data, frame, p.chapter);
  else if (p.kind === "dish") pageDish(data, frame, p.id, spec.missing ?? []);
  else if (p.kind === "crop") pageCrop(data, frame, p.key, spec.locked === true);
  return frame.im;
}

// ---------------------------------------------------------------------------------------------
// Pot screen status images
// ---------------------------------------------------------------------------------------------

function potPanel() {
  const { w, h } = POT_SIZE;
  const im = img(w, h);
  rect(im, 0, 0, w, h, C.black);
  rect(im, 1, 1, w - 2, h - 2, C.panelDark);
  rect(im, 1, 1, w - 3, h - 3, C.white);
  rect(im, 3, 3, w - 6, h - 6, C.panel);
  rect(im, w - 3, 3, 2, h - 4, C.panelDark);
  rect(im, 3, h - 3, w - 4, 2, C.panelDark);
  return im;
}

function renderPotImage(data, spec) {
  const im = potPanel();
  const lit = spec.heat === "lit";
  const recipe = spec.recipe;
  const missing = spec.missing ?? [];
  const ready = recipe !== undefined && missing.every((m) => m === 0);

  // the pot: copper belly with the recipe's slots
  const well = { x: 18, y: 8, w: 114, h: 36 };
  blit(im, part("pot_handle"), well.x - 4, well.y + 12);
  blit(im, flipX(part("pot_handle")), well.x + well.w - 2, well.y + 12);
  nine(im, part("pot_well"), well.x, well.y, well.w, well.h, INSET.pot_well);
  const ings = recipe?.ingredients ?? [];
  const n = recipe ? ings.length : 5;
  const sx = well.x + 7 + (5 - n) * 10;
  for (let i = 0; i < n; i++) {
    const x = sx + i * 20;
    const y = well.y + 9;
    const ing = ings[i];
    if (!ing) {
      slot(im, x, y);
      continue;
    }
    // complete: solid with the count; partly there: solid with "+N"; none yet: ghost with "+N"
    const m = missing[i] ?? 0;
    const opts = m === 0 ? { count: ing.count } : { ghost: m === ing.count, count: `+${m}` };
    itemsInSlot(im, ing.items, x, y, opts);
  }

  // arrow, with the heat under it
  const arrow = part((ready || !recipe) && lit ? "arrow_pot_ready" : "arrow_pot"); // choose: cookable
  blit(im, arrow, 142, 12, { scale: 2 });
  icon(im, part(lit ? "flame_on" : "flame_off"), 140, 36, { scale: 2, bg: C.panel });
  if (!lit) text(im, "!", 176, 50, C.warn, { scale: 2, outline: C.black });

  // result
  const rx = 188;
  const ry = 6;
  nine(im, part("slot_large"), rx, ry, 36, 36, INSET.slot_large);
  if (recipe) {
    const src = itemArt(recipe.result);
    icon(im, src, rx + 2, ry + 2, { scale: 2, ghost: !(ready && lit), bg: C.slot });
  } else textCentered(im, "?", rx + 18.5, ry + 11, C.white, { scale: 2, shadow: C.countShadow });

  // what the dish does: its effect badge, centred under the pot (food is on the book page)
  const dish = recipe && data.findDish(recipe.result);
  const family = dish && familyKey(data, dish);
  if (family) effectBadge(im, well.x + Math.floor((well.w - badgeWidth(dish.effect.seconds)) / 2), 56, family, dish.effect.seconds); // prettier-ignore
  return im;
}

// ---------------------------------------------------------------------------------------------
// Rendering everything
// ---------------------------------------------------------------------------------------------

/**
 * Renders every image in memory: [{ kind: "book"|"pot", stem, dir, image (art px), elements }].
 * lint-pages.mjs calls this too, to check the files on disk are what the renderer draws now.
 */
export async function renderAll() {
  const data = await loadPackData();
  const out = [];
  const total = data.BOOK_ORDER.length;
  for (const spec of data.bookImageSpecs()) {
    elements = [];
    const image = renderBookPage(data, spec, total);
    out.push({ kind: "book", stem: spec.stem, dir: data.BOOK_TEXTURE_DIR, image, elements });
  }
  for (const station of data.STATIONS) {
    for (const spec of data.potImageSpecs(station)) {
      elements = [];
      const image = renderPotImage(data, spec);
      out.push({ kind: "pot", stem: spec.stem, dir: data.POT_TEXTURE_DIR, image, elements });
    }
  }
  elements = [];
  return { data, pages: out };
}

/** Contact sheet: every image at art size (1×) with its stem under it. */
function contactSheet(pages, cols) {
  const cw = pages[0].image.w;
  const ch = pages[0].image.h + 12;
  const rows = Math.ceil(pages.length / cols);
  const sheet = img(cols * (cw + 4) + 4, rows * (ch + 4) + 4, hex("#2b2b2b"));
  pages.forEach((p, i) => {
    const x = 4 + (i % cols) * (cw + 4);
    const y = 4 + Math.floor(i / cols) * (ch + 4);
    blit(sheet, p.image, x, y);
    text(sheet, p.stem, x + 1, y + p.image.h + 3, hex("#e0e0e0"), { bg: hex("#2b2b2b") });
  });
  return sheet;
}

async function main() {
  const { pages } = await renderAll();
  const written = new Map();
  let bytes = 0;
  for (const p of pages) {
    const dir = path.join(RP, p.dir);
    mkdirSync(dir, { recursive: true });
    const buf = encodeIndexedPng(p.image, SCALE);
    writeFileSync(path.join(dir, `${p.stem}.png`), buf);
    bytes += buf.length;
    if (!written.has(dir)) written.set(dir, new Set());
    written.get(dir).add(`${p.stem}.png`);
  }
  // stale images from an earlier render (a renamed dish, a removed recipe)
  for (const [dir, keep] of written) {
    for (const file of readdirSync(dir)) {
      if (file.endsWith(".png") && !keep.has(file)) {
        rmSync(path.join(dir, file));
        console.log(`[book] removed stale ${path.relative(ROOT, path.join(dir, file))}`);
      }
    }
  }
  mkdirSync(PREVIEW_DIR, { recursive: true });
  const book = pages.filter((p) => p.kind === "book");
  const pot = pages.filter((p) => p.kind === "pot");
  writeFileSync(path.join(PREVIEW_DIR, "book_pages.png"), encodeIndexedPng(contactSheet(book, 4), 2)); // prettier-ignore
  writeFileSync(path.join(PREVIEW_DIR, "pot_status.png"), encodeIndexedPng(contactSheet(pot, 6)));
  console.log(
    `[book] ${book.length} book pages (${BOOK_SIZE.w * SCALE}×${BOOK_SIZE.h * SCALE}), ` +
      `${pot.length} pot images (${POT_SIZE.w * SCALE}×${POT_SIZE.h * SCALE}), ` +
      `${(bytes / 1024).toFixed(0)} KiB; previews in ${path.relative(ROOT, PREVIEW_DIR)}/`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
