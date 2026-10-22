// Renders the Harvest Kitchen recipe posters (D15): one 2×1 wall poster per dish plus the "How to
// Start" guide (the whole loop, seeds to dish), each written as two 64×64 block textures (left and
// right half).
//
//   node tools/gen-posters.mjs          render every poster, delete stale ones, write the preview
//
// Which posters exist and what each half is called comes from the pack's own pure module
// (scripts/posters/poster-logic.ts: posterIndices, halfStem), bundled here with esbuild like
// tools/gen-pot-block.mjs does, so the renderer draws exactly the textures the block can show.
// tools/lint-posters.mjs checks the result (`npm run posters` runs both). This file grew out of the
// recipe book page renderer (D14); its drawing code is shared with the art mockups.
//
// Resolution (slice.md "Recipe posters"): 64 texels per block, so the whole poster is a
// 128×64 canvas drawn 1:1 ("art px" = texels). A 16 px icon is a quarter of a block (4 world
// pixels), the 7 px font about 1.75 world pixels tall. The game's terrain atlas keeps a 64 px
// block texture at 64 px (vanilla 1.26.50 ships the 64×64 straw_bed in atlas.terrain); its mip
// levels only blur what the screen can't resolve anyway. Lint rules: art-style.md "Recipe posters".
//
// Art: only our own textures, from art/harvest_kitchen/generated/{items,ui,ingredients,blocks}
// and the mockup parts (art/harvest_kitchen/mockups/parts/, drawn by render-mockups.mjs from our
// palette). No vanilla textures. A missing texture is drawn as a neutral "?" placeholder with a
// warning. Text is limited to numbers and symbols (? → + × s), because baked text can't be
// localized; the dish name comes from a lang key (plain use on the poster).

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { build } from "esbuild";
import { decodePng, encodePng } from "./gen-textures.mjs";
import { ROOT } from "./paths.mjs";

/** Texels per block; the poster is 2 blocks wide, 1 tall. */
export const TEXELS_PER_BLOCK = 64;
export const POSTER_SIZE = { w: 2 * TEXELS_PER_BLOCK, h: TEXELS_PER_BLOCK };
export const HALF_SIZE = TEXELS_PER_BLOCK;
const RP = path.join(ROOT, "packs/harvest_kitchen/resource");
export const PREVIEW_DIR = path.join(ROOT, "art/harvest_kitchen/poster_preview");
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
        `export { posterIndices, posterDish, posterStem, halfStem, halfTexture, HALVES, POSTER_TEXTURE_DIR } from "${s}/posters/poster-logic";`,
        `export { stationById } from "${s}/data/stations";`,
        `export { CROPS } from "${s}/data/crops";`,
        `export { EFFECTS, findDish } from "${s}/data/dishes";`,
        `export { recipeMaking } from "${s}/data/recipes";`,
        `export { ITEM_CUTTING_BOARD } from "${s}/config";`,
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
// Readability records: what lint-posters.mjs measures (icons and text, with their colours).
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
  slot: 1,
  slot_large: 1,
  slot_locked: 1,
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

// ---------------------------------------------------------------------------------------------
// The poster: a wooden frame, a paper sheet with two pins, and the recipe:
//
//   [ingredient grid 3×2]  →  [result 2×]          left half: x 0..63, right half: x 64..127
//   [station (+ flame)]       [family icon + "8 s"] (or the food shank + nutrition)
//
// A pot dish (D16) shows the raw ingredients of its mix, and its station row is the two steps:
// [crafting table] → [pot] + [flame]. The mix itself isn't drawn: what the player gathers and
// where they go is what the poster is for.
// ---------------------------------------------------------------------------------------------

const { w: W, h: H } = POSTER_SIZE;
const WOOD = ramp("wood");
const BARK = ramp("bark");
const PIN = ramp("tomato");

/** Paper area (inclusive of its 1 px shadow on the right and bottom). */
export const PAPER = { x: 3, y: 3, w: W - 6, h: H - 6 };

const PIN_SPRITE = sprite([".h.", "hrr", ".rd"], { h: PIN[4], r: PIN[2], d: PIN[0] });

function board() {
  const im = img(W, H);
  rect(im, 0, 0, W, H, BARK[1]);
  rect(im, 1, 1, W - 2, H - 2, WOOD[2]);
  rect(im, 1, 1, W - 2, 1, WOOD[4]); // light from the top left
  rect(im, 1, 1, 1, H - 2, WOOD[4]);
  rect(im, 1, H - 2, W - 2, 1, WOOD[0]);
  rect(im, W - 2, 1, 1, H - 2, WOOD[0]);
  // grain: short darker streaks along the frame
  for (let x = 6; x < W - 6; x += 11) {
    rect(im, x, 1, 3, 1, WOOD[1]);
    rect(im, x + 5, H - 3, 3, 1, WOOD[1]);
  }
  for (let y = 7; y < H - 6; y += 13) {
    rect(im, 2, y, 1, 3, WOOD[1]);
    rect(im, W - 3, y + 5, 1, 3, WOOD[1]);
  }
  const p = PAPER;
  rect(im, p.x, p.y, p.w, p.h, C.pDark); // shadow on the right and bottom
  rect(im, p.x, p.y, p.w - 1, p.h - 1, C.pBase);
  blit(im, PIN_SPRITE, p.x + 2, p.y + 1);
  blit(im, PIN_SPRITE, p.x + p.w - 6, p.y + 1);
  return im;
}

/** "Cod or salmon": one slot, the left half of one icon and the right half of the other. */
function splitItem(im, ids, x, y) {
  slot(im, x, y, 18);
  const [a, b] = ids.map(itemArt);
  blit(im, a, x + 1, y + 1, { clip: [0, 8] });
  blit(im, b, x + 1, y + 1, { clip: [8, 16] });
  rect(im, x + 9, y + 2, 1, 14, C.slotLocked); // the seam between the two
  note({ kind: "icon", x: x + 1, y: y + 1, w: 16, h: 16, scale: 1, bg: C.slot.slice(0, 3) });
}

/** Up to 6 ingredients: one centred row of up to 3, else a 3×2 grid like a crafting grid. */
function ingredientGrid(im, ingredients) {
  const n = ingredients.length;
  if (n > 6) throw new Error(`${n} ingredients don't fit the poster grid`);
  const rows = n > 3 ? 2 : 1;
  const cells = rows === 1 ? n : 6;
  const gx = 6 + (rows === 1 ? (3 - n) * 9 : 0);
  const gy = rows === 1 ? 15 : 6;
  for (let i = 0; i < cells; i++) {
    const x = gx + (i % 3) * 18;
    const y = gy + Math.floor(i / 3) * 18;
    const ing = ingredients[i];
    if (!ing) slot(im, x, y, 18);
    else if (ing.items.length > 1) splitItem(im, ing.items, x, y);
    else item(im, itemArt(ing.items[0]), x, y, { size: 18, count: ing.count });
  }
}

const ARROW = { x: 61, y: 19 };
const RESULT = { x: 76, y: 6, size: 36 };
const FOOTER_Y = 43;

/** What a poster lists for a dish: a station dish made from one mix lists the mix's recipe. */
function posterRecipe(data, made) {
  if (made.kind !== "station") return { ingredients: made.recipe.ingredients, viaTable: false };
  const [only] = made.recipe.ingredients;
  const mix =
    made.recipe.ingredients.length === 1 && only ? data.recipeMaking(only.items[0]) : undefined;
  if (mix?.kind === "crafting") {
    return { ingredients: mix.recipe.ingredients, viaTable: true };
  }
  return { ingredients: made.recipe.ingredients, viaTable: false };
}

function stationRow(im, data, made, viaTable) {
  const station = made?.kind === "station" ? data.stationById(made.recipe.station) : undefined;
  const table = art("ingredients/crafting_table");
  let x = 6;
  if (viaTable) {
    icon(im, table, x, FOOTER_Y, { bg: C.pBase });
    x += 18;
    x += text(im, "→", x, FOOTER_Y + 5, C.ink, { bg: C.pBase }) + 2;
  }
  icon(im, station ? itemArt(station.icon) : table, x, FOOTER_Y, { bg: C.pBase });
  x += 18;
  if (!station?.needsHeat) return;
  x += text(im, "+", x, FOOTER_Y + 5, C.ink, { bg: C.pBase }) + 2;
  icon(im, part("flame_on"), x, FOOTER_Y, { bg: C.pBase });
}

/** The effect: family icon + duration; a dish without one shows its food (shank + value). */
function effectRow(im, data, dish) {
  const x = RESULT.x - 3;
  const info = dish.effect && data.EFFECTS[dish.effect.effect];
  if (info) {
    const r = ramp(`family_${info.family}`);
    icon(im, art(`ui/family_${info.family}`), x, FOOTER_Y, { bg: C.pBase });
    text(im, `${dish.effect.seconds} s`, x + 19, FOOTER_Y + 5, readableOn(r[0], C.pBase), {
      bg: C.pBase,
    });
    return;
  }
  icon(im, SHANK, x, FOOTER_Y - 1, { scale: 2, bg: C.pBase });
  text(im, String(dish.nutrition), x + 21, FOOTER_Y + 5, C.ink, { bg: C.pBase });
}

function dishPoster(data, dishId) {
  const im = board();
  const dish = data.findDish(dishId);
  const made = data.recipeMaking(dishId);
  if (!dish || !made) throw new Error(`no dish or recipe for ${dishId}`);
  const { ingredients, viaTable } = posterRecipe(data, made);
  ingredientGrid(im, ingredients);
  blit(im, part("arrow_ink"), ARROW.x, ARROW.y);
  nine(im, part("slot_large"), RESULT.x, RESULT.y, RESULT.size, RESULT.size, INSET.slot_large);
  icon(im, itemArt(dishId), RESULT.x + 2, RESULT.y + 2, { scale: 2, bg: C.slot });
  if (made.recipe.count > 1) {
    const n = String(made.recipe.count);
    text(im, n, RESULT.x + RESULT.size - 3 - textWidth(n), RESULT.y + RESULT.size - 10, C.white, {
      shadow: C.countShadow,
    });
  }
  stationRow(im, data, made, viaTable);
  effectRow(im, data, dish);
  return im;
}

const GUIDE_ROWS = [
  { x: 18, y: 12 }, // grass → seeds → farmland → cutting board
  { x: 16, y: 40 }, // crafting table → mix → pot over a fire → dish
];

/**
 * How to Start (index 0; a player's first poster): the whole loop in two rows, with the first crop
 * and the first pot dish (tomato → tomato soup):
 *
 *   grass → seeds → farmland (crop growing) → cutting board
 *   crafting table → mix → pot over a fire → [dish]
 */
function guidePoster(data) {
  const im = board();
  const crop = data.CROPS[0];
  const dishId = data.posterDish(1);
  const mixId = data.recipeMaking(dishId)?.recipe.ingredients[0]?.items[0];
  if (!mixId) throw new Error(`no mix for ${dishId}`);
  const bg = C.pBase;
  const arrow = (x, y) => x + 2 + text(im, "→", x + 2, y + 5, C.ink, { bg }) + 1;

  let { x, y } = GUIDE_ROWS[0];
  icon(im, art("ingredients/short_grass"), x, y, { bg });
  x = arrow(x + 16, y);
  icon(im, itemArt(crop.seed), x, y, { bg });
  x = arrow(x + 16, y);
  // planted: the crop's last stage standing on farmland
  icon(im, art("ingredients/farmland"), x, y + 3, { bg });
  icon(im, art(`blocks/${crop.block.split(":")[1]}_stage_3`), x, y - 7, { bg });
  x = arrow(x + 16, y);
  icon(im, itemArt(data.ITEM_CUTTING_BOARD), x, y, { bg });

  ({ x, y } = GUIDE_ROWS[1]);
  icon(im, art("ingredients/crafting_table"), x, y, { bg });
  x = arrow(x + 16, y);
  icon(im, itemArt(mixId), x, y, { bg });
  x = arrow(x + 16, y);
  // on the fire: the pot over a campfire
  icon(im, art("ingredients/campfire"), x, y + 5, { bg });
  icon(im, itemArt(data.stationById("pot").icon), x, y - 4, { bg });
  x = arrow(x + 16, y);
  item(im, itemArt(dishId), x, y - 2);
  return im;
}

function renderPoster(data, index) {
  const dishId = data.posterDish(index);
  return dishId ? dishPoster(data, dishId) : guidePoster(data);
}

function crop(src, x0, y0, w, h) {
  const out = img(w, h);
  for (let y = 0; y < h; y++)
    out.px.set(src.px.subarray(((y0 + y) * src.w + x0) * 4, ((y0 + y) * src.w + x0 + w) * 4), y * w * 4); // prettier-ignore
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rendering everything
// ---------------------------------------------------------------------------------------------

/**
 * Renders every poster in memory: [{ index, stem, image (128×64), elements, halves }], each half
 * { half, stem, image (64×64), texture: { path, shortname } }. lint-posters.mjs calls this too,
 * to check the files on disk are what the renderer draws now.
 */
export async function renderAll() {
  const data = await loadPackData();
  const posters = [];
  for (const index of data.posterIndices()) {
    elements = [];
    const image = renderPoster(data, index);
    const halves = data.HALVES.map((half, i) => ({
      half,
      stem: data.halfStem(index, half),
      image: crop(image, i * HALF_SIZE, 0, HALF_SIZE, HALF_SIZE),
      texture: data.halfTexture(index, half),
    }));
    posters.push({ index, stem: data.posterStem(index), image, elements, halves });
  }
  elements = [];
  return { data, posters };
}

/** Contact sheet: every poster at `scale` with its stem under it. */
function contactSheet(posters, cols, scale) {
  const cw = W * scale;
  const ch = H * scale + 12;
  const rows = Math.ceil(posters.length / cols);
  const sheet = img(cols * (cw + 4) + 4, rows * (ch + 4) + 4, hex("#2b2b2b"));
  posters.forEach((p, i) => {
    const x = 4 + (i % cols) * (cw + 4);
    const y = 4 + Math.floor(i / cols) * (ch + 4);
    blit(sheet, p.image, x, y, { scale });
    text(sheet, p.stem, x + 1, y + H * scale + 3, hex("#e0e0e0"), { bg: hex("#2b2b2b") });
  });
  return sheet;
}

/** terrain_texture.json with exactly the poster halves' hk_poster_* entries (others untouched). */
async function updateTerrain(posters) {
  const file = path.join(RP, "textures/terrain_texture.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  const data = Object.fromEntries(
    Object.entries(json.texture_data).filter(([key]) => !key.startsWith("hk_poster_")),
  );
  for (const p of posters)
    for (const h of p.halves) data[h.texture.shortname] = { textures: h.texture.path };
  json.texture_data = data;
  const prettier = await import("prettier");
  const options = { ...(await prettier.resolveConfig(file)), filepath: file };
  writeFileSync(file, await prettier.format(JSON.stringify(json), options));
}

async function main() {
  const { data, posters } = await renderAll();
  const dir = path.join(RP, data.POSTER_TEXTURE_DIR);
  mkdirSync(dir, { recursive: true });
  const keep = new Set();
  let bytes = 0;
  for (const p of posters) {
    for (const h of p.halves) {
      const buf = encodeIndexedPng(h.image);
      writeFileSync(path.join(dir, `${h.stem}.png`), buf);
      keep.add(`${h.stem}.png`);
      bytes += buf.length;
    }
  }
  for (const file of readdirSync(dir)) {
    if (!keep.has(file)) {
      rmSync(path.join(dir, file));
      console.log(`[posters] removed stale ${path.relative(ROOT, path.join(dir, file))}`);
    }
  }
  await updateTerrain(posters);
  mkdirSync(PREVIEW_DIR, { recursive: true });
  // Truecolour: all posters together can use more than the 256 colours an indexed page holds.
  writeFileSync(path.join(PREVIEW_DIR, "posters.png"), encodePng(contactSheet(posters, 2, 3)));
  console.log(
    `[posters] ${posters.length} posters, ${keep.size} textures (${HALF_SIZE}×${HALF_SIZE}), ` +
      `${(bytes / 1024).toFixed(0)} KiB; preview in ${path.relative(ROOT, PREVIEW_DIR)}/`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
