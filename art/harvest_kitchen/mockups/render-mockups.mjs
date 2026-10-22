// Harvest Kitchen: mockups of the JSON UI recipe book and pot screen (decision D13).
//
//   node art/harvest_kitchen/mockups/render-mockups.mjs
//
// Plain Node, no dependencies. Draws the reusable UI parts (9-slice panels, tabs, buttons) into
// parts/, then composes each mockup from those parts at UI resolution (426×240 UI px) and scales
// it 3× with nearest-neighbour, like a screenshot at GUI scale 3 (1278×720).
// Our icons come from art/harvest_kitchen/generated/; vanilla icons are read from the installed
// game through vanillaTextures() and only end up inside the rendered PNGs.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng, encodePng, vanillaTextures } from "../../../tools/gen-textures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const GEN = path.join(ROOT, "art/harvest_kitchen/generated");
const PARTS_DIR = path.join(HERE, "parts");
const PALETTE = JSON.parse(readFileSync(path.join(ROOT, "art/harvest_kitchen/palette.json"))).ramps;

const W = 426;
const H = 240;
const SCALE = 3;

// ---------------------------------------------------------------------------------------------
// Image basics. An image is {w, h, px: Uint8Array RGBA}. Colours are [r, g, b, a].
// ---------------------------------------------------------------------------------------------

const hex = (h, a = 255) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(a);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function img(w, h, fill) {
  const im = { w, h, px: new Uint8Array(w * h * 4) };
  if (fill) for (let i = 0; i < w * h; i++) im.px.set(fill, i * 4);
  return im;
}

function get(im, x, y) {
  const i = (y * im.w + x) * 4;
  return [im.px[i], im.px[i + 1], im.px[i + 2], im.px[i + 3]];
}

function put(im, x, y, c) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h || !c || c[3] === 0) return;
  const i = (y * im.w + x) * 4;
  if (c[3] === 255) im.px.set(c, i);
  else {
    const a = c[3] / 255;
    for (let k = 0; k < 3; k++) im.px[i + k] = Math.round(c[k] * a + im.px[i + k] * (1 - a));
    im.px[i + 3] = Math.max(im.px[i + 3], c[3]);
  }
}

function erase(im, x, y) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h) return;
  im.px.fill(0, (y * im.w + x) * 4, (y * im.w + x) * 4 + 4);
}

function rect(im, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(im, i, j, c);
}

/** Draws `src` at (x, y), scaled by an integer factor. Options: tint (multiply), solid (one
 *  colour for every opaque pixel: silhouettes), alpha (0–1 ghosting), gray (desaturate). */
function blit(dst, src, x, y, { scale = 1, tint, solid, alpha = 1, gray = false } = {}) {
  for (let sy = 0; sy < src.h; sy++)
    for (let sx = 0; sx < src.w; sx++) {
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

/** Copies a source rectangle into a destination rectangle with nearest-neighbour stretching. */
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

/** 9-slice draw, the same way JSON UI does it: corners fixed, edges and centre stretched.
 *  inset = [left, top, right, bottom] in source pixels. */
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

/** Tiles `src` over a rectangle (JSON UI image with "tiled": true). */
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

function upscale(src, s) {
  const out = img(src.w * s, src.h * s);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++) {
      const i = (Math.floor(y / s) * src.w + Math.floor(x / s)) * 4;
      out.px.set(src.px.subarray(i, i + 4), (y * out.w + x) * 4);
    }
  return out;
}

/** Pixel art from rows of characters; `legend` maps a character to a colour ("." = clear). */
function sprite(rows, legend) {
  const im = img(Math.max(...rows.map((r) => r.length)), rows.length);
  rows.forEach((row, y) => [...row].forEach((ch, x) => put(im, x, y, legend[ch])));
  return im;
}

// ---------------------------------------------------------------------------------------------
// Pixel font: Minecraft-like, 7 px cap height + 1 px descender, variable width, 1 px spacing.
// ---------------------------------------------------------------------------------------------

const UPPER = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "####.", "#...#", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "###..", "#....", "#....", "#....", "#####"],
  F: ["#####", "#....", "###..", "#....", "#....", "#....", "#...."],
  G: [".####", "#....", "#..##", "#...#", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#####", "#...#", "#...#", "#...#", "#...#"],
  I: ["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"],
  J: ["....#", "....#", "....#", "....#", "....#", "#...#", ".###."],
  K: ["#...#", "#..#.", "###..", "#..#.", "#...#", "#...#", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "####.", "#....", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#...#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "####.", "#...#", "#...#", "#...#", "#...#"],
  S: [".####", "#....", ".###.", "....#", "....#", "#...#", ".###."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#...#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#", "#...#"],
  Y: ["#...#", ".#.#.", "..#..", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
};

// Lowercase: 8 rows (row 7 is the descender).
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
  ".": [".", ".", ".", ".", ".", ".", "#"],
  ",": [".", ".", ".", ".", ".", ".", "#", "#"],
  ":": [".", ".", "#", ".", ".", ".", "#"],
  "'": ["#", "#", ".", ".", ".", ".", "."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "×": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  "(": ["..#", ".#.", "#..", "#..", "#..", ".#.", "..#"],
  ")": ["#..", ".#.", "..#", "..#", "..#", ".#.", "#.."],
  "◀": ["...#", "..##", ".###", "####", ".###", "..##", "...#"],
  "▶": ["#...", "##..", "###.", "####", "###.", "##..", "#..."],
  "❤": [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."],
  "♨": ["..#.#.#", ".#.#.#.", "..#.#.#", ".......", "#.....#", "#.....#", ".#####."],
  "→": [".......", "....#..", ".....#.", "#######", ".....#.", "....#..", "......."],
  "✔": ["......#", ".....##", "#...##.", "##.##..", ".###...", "..#....", "......."],
  "✘": ["#....#", "##..##", ".####.", "..##..", ".####.", "##..##", "#....#"],
  "★": ["...#...", "...#...", "#######", ".#####.", "..###..", ".##.##.", "##...##"],
  "⌂": ["...#...", "..###..", ".#####.", "#######", ".##.##.", ".##.##.", ".##.##."],
  "↶": ["..#....", ".##....", "#######", ".##...#", "..#...#", "......#", ".#####."],
};

const GLYPHS = { ...UPPER, ...LOWER, ...DIGITS, ...SYMBOLS };

function glyph(ch) {
  const g = GLYPHS[ch];
  if (!g) throw new Error(`No glyph for ${JSON.stringify(ch)}`);
  return g;
}

function textWidth(s, scale = 1) {
  let w = 0;
  for (const ch of s) w += (glyph(ch)[0].length + 1) * scale;
  return Math.max(0, w - scale);
}

/** Draws text with its cap line at y. shadow: colour of a 1-font-px down-right drop shadow;
 *  outline: colour of a 1-font-px ring around every glyph. */
function text(im, s, x, y, colour, { scale = 1, shadow, outline } = {}) {
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
      pass(ox * scale, oy * scale, outline);
  if (shadow) pass(scale, scale, shadow);
  pass(0, 0, colour);
  return textWidth(s, scale);
}

function textCentered(im, s, cx, y, colour, opts = {}) {
  const w = textWidth(s, opts.scale ?? 1);
  text(im, s, Math.round(cx - w / 2), y, colour, opts);
}

const shadowOf = (c) => [c[0] >> 2, c[1] >> 2, c[2] >> 2, 255];

// ---------------------------------------------------------------------------------------------
// Icons: ours from generated/, vanilla from the game.
// ---------------------------------------------------------------------------------------------

const ours = (p) => decodePng(readFileSync(path.join(GEN, `${p}.png`)));
const loadVanilla = vanillaTextures();
const vanilla = (p) => loadVanilla(p).img;

/** Grass in the inventory is tinted; the texture itself is grey. */
function tinted(im, colour) {
  const out = img(im.w, im.h);
  blit(out, im, 0, 0, { tint: colour });
  return out;
}

/** First 16×16 frame of a flipbook texture (fire_0 is 16×512). */
function firstFrame(im) {
  const out = img(im.w, im.w);
  stretch(out, im, 0, 0, im.w, im.w, 0, 0, im.w, im.w);
  return out;
}

const ICON = {
  tomato: ours("items/tomato"),
  onion: ours("items/onion"),
  cucumber: ours("items/cucumber"),
  chili: ours("items/chili_pepper"),
  strawberry: ours("items/strawberry"),
  tomato_seeds: ours("items/tomato_seeds"),
  sliced_tomato: ours("items/sliced_tomato"),
  tomato_soup: ours("items/tomato_soup"),
  onion_soup: ours("items/onion_soup"),
  vegetable_stew: ours("items/vegetable_stew"),
  chili_stew: ours("items/chili_stew"),
  fish_chowder: ours("items/fish_chowder"),
  chicken_soup: ours("items/chicken_soup"),
  strawberry_jam: ours("items/strawberry_jam"),
  garden_salad: ours("items/garden_salad"),
  salsa: ours("items/salsa"),
  veggie_sandwich: ours("items/veggie_sandwich"),
  hearty_sandwich: ours("items/hearty_sandwich"),
  strawberry_cup: ours("items/strawberry_cup"),
  strawberry_cake: ours("items/strawberry_cake"),
  pot: ours("items/cooking_pot"),
  board: ours("items/cutting_board"),
  book: ours("items/recipe_poster"), // the book icon is gone (D15); keeps this D13 script running
  heal: ours("ui/family_heal"),
  move: ours("ui/family_move"),
  work: ours("ui/family_work"),
  explore: ours("ui/family_explore"),
  locked: ours("ui/locked"),
  crops: ours("ui/chapter_crops"),
  what: ours("ui/chapter_what_can_i_make"),
  fire: ours("ui/needs_heat"),
  // vanilla
  bowl: vanilla("items/bowl"),
  bread: vanilla("items/bread"),
  carrot: vanilla("items/carrot"),
  potato: vanilla("items/potato"),
  beef: vanilla("items/beef_raw"),
  sugar: vanilla("items/sugar"),
  table: vanilla("blocks/crafting_table_front"),
  grass: tinted(vanilla("blocks/tallgrass"), hex("#79c05a")),
  jungle: vanilla("blocks/sapling_jungle"),
  regen: vanilla("ui/regeneration_effect"),
  speed: vanilla("ui/speed_effect"),
  night: vanilla("ui/night_vision_effect"),
  hunger: vanilla("ui/hunger_full"),
  hungerBg: vanilla("ui/hunger_background"),
  planks: vanilla("blocks/planks_oak"),
  bricks: vanilla("blocks/brick"),
  campfire: vanilla("items/campfire"),
  fireFrame: firstFrame(vanilla("blocks/fire_0")),
};

// ---------------------------------------------------------------------------------------------
// Colours.
// ---------------------------------------------------------------------------------------------

const ramp = (name) => PALETTE[name].shades.map((h) => hex(h));

const C = {
  // parchment
  pOutline: hex("#5a3d1c"),
  pStack1: hex("#b8965f"),
  pStack2: hex("#d4b985"),
  pBase: hex("#eedcb0"),
  pLight: hex("#f7ebc9"),
  pBand1: hex("#c9ab74"),
  pBand2: hex("#d9c08e"),
  pBand3: hex("#e5cfa0"),
  pGrain1: hex("#e3cd9c"),
  pGrain2: hex("#f4e5bf"),
  pDark: hex("#e0c896"),
  ink: hex("#3b2714"),
  inkSoft: hex("#866340"),
  // leather
  lOutline: hex("#1a0d05"),
  lDark: hex("#3a1d0d"),
  lBase: hex("#5b2f18"),
  lMid: hex("#6c3a1f"),
  lLight: hex("#86502b"),
  // brass
  gDark: hex("#5a3c0c"),
  gMid: hex("#a7781f"),
  gLight: hex("#ddb143"),
  gShine: hex("#f7e08a"),
  // ribbon cloth (plum: not one of the four family colours)
  rOutline: hex("#2a0f33"),
  rDark: hex("#4b1f5c"),
  rBase: hex("#6a307f"),
  rLight: hex("#8b4ea3"),
  rShine: hex("#a96ec0"),
  // vanilla inventory
  slot: hex("#8b8b8b"),
  slotDark: hex("#373737"),
  slotLight: hex("#ffffff"),
  panel: hex("#c6c6c6"),
  panelDark: hex("#555555"),
  label: hex("#404040"),
  white: hex("#ffffff"),
  black: hex("#000000"),
};

const FAMILY = Object.fromEntries(
  ["heal", "move", "work", "explore"].map((f) => {
    const r = ramp(`family_${f}`);
    return [
      f,
      {
        dark: r[0],
        mid: r[1],
        base: r[2],
        // badge fill: a pale tint of the family colour on parchment
        fill: mix(mix(r[2], hex("#ffffff"), 0.62), C.pBase, 0.25),
        fillLight: mix(mix(r[2], hex("#ffffff"), 0.78), C.pBase, 0.2),
        icon: ICON[f],
      },
    ];
  }),
);

const COPPER = ramp("copper");

// ---------------------------------------------------------------------------------------------
// Parts: each one is a texture that can ship as-is (9-slice insets noted in README.md).
// ---------------------------------------------------------------------------------------------

const PARTS = {};
const INSETS = {};

function part(name, im, inset) {
  PARTS[name] = im;
  if (inset !== undefined) INSETS[name] = inset;
  return im;
}

/** Bevelled box: outline, light top/left, dark bottom/right, flat face. */
function bevelBox(w, h, { outline, light, dark, face, lip = 1, round = true }) {
  const im = img(w, h);
  rect(im, 0, 0, w, h, outline);
  rect(im, 1, 1, w - 2, h - 2, dark);
  rect(im, 1, 1, w - 2 - lip, h - 2 - lip, light);
  rect(im, 1 + lip, 1 + lip, w - 2 - 2 * lip, h - 2 - 2 * lip, face);
  if (round) for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) erase(im, x, y); // prettier-ignore
  return im;
}

function buildParts() {
  // Leather cover: dark outline, bevel, an embossed groove 4 px in, brass corner caps.
  {
    const s = 32;
    const im = img(s, s);
    rect(im, 0, 0, s, s, C.lOutline);
    rect(im, 1, 1, s - 2, s - 2, C.lDark);
    rect(im, 1, 1, s - 3, s - 3, C.lLight);
    rect(im, 2, 2, s - 4, s - 4, C.lBase);
    // groove: dark line with a light line under/right of it
    rect(im, 4, 4, s - 8, 1, C.lDark);
    rect(im, 4, 4, 1, s - 8, C.lDark);
    rect(im, 5, s - 5, s - 9, 1, C.lMid);
    rect(im, s - 5, 5, 1, s - 9, C.lMid);
    rect(im, 5, 5, s - 10, 1, C.lMid);
    rect(im, 5, 5, 1, s - 10, C.lMid);
    rect(im, 4, s - 4, s - 7, 1, C.lLight);
    rect(im, s - 4, 4, 1, s - 7, C.lLight);
    const cap = sprite(
      [
        "oooooooo",
        "osshhgdo",
        "oshhgdo.",
        "ohhgdo..",
        "ohgdo...",
        "ogdo....",
        "odo.....",
        "oo......",
      ],
      { o: C.gDark, s: C.gShine, h: C.gLight, g: C.gMid, d: C.gDark },
    );
    blit(im, cap, 0, 0);
    // other corners: mirror the cap shape, darker toward the bottom right
    const capR = flipX(cap);
    blit(im, capR, s - 8, 0);
    const capB = img(8, 8);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) put(capB, x, 7 - y, get(cap, x, y));
    blit(im, capB, 0, s - 8);
    blit(im, flipX(capB), s - 8, s - 8);
    for (const [x, y] of [[0, 0], [s - 1, 0], [0, s - 1], [s - 1, s - 1]]) erase(im, x, y); // prettier-ignore
    part("book_cover", im, 10);
  }

  // Parchment page (left). Outer edge on the left shows the page stack; the gutter side on the
  // right darkens in three hard bands. The right page is the mirror image.
  {
    const w = 24;
    const h = 24;
    const im = img(w, h, C.pBase);
    rect(im, 0, 0, w, 1, C.pOutline);
    rect(im, 0, 0, 1, h, C.pOutline);
    rect(im, 0, h - 1, w, 1, C.pOutline);
    // page stack along the outer (left) and bottom edges
    rect(im, 1, 1, 1, h - 2, C.pStack1);
    rect(im, 2, 1, 1, h - 3, C.pStack2);
    rect(im, 1, h - 2, w - 1, 1, C.pStack1);
    rect(im, 2, h - 3, w - 2, 1, C.pStack2);
    // light top edge
    rect(im, 3, 1, w - 3, 1, C.pLight);
    // gutter shading (right side)
    rect(im, w - 6, 1, 2, h - 3, C.pBand3);
    rect(im, w - 4, 1, 2, h - 3, C.pBand2);
    rect(im, w - 2, 1, 2, h - 3, C.pBand1);
    part("page_left", im, [6, 3, 7, 4]);
    part("page_right", flipX(im), [7, 3, 6, 4]);
  }

  // Parchment grain: a 16×16 tile laid over the flat page centre ("tiled": true).
  {
    const im = img(16, 16);
    const specks = [
      [2, 1, 1], [9, 2, 2], [13, 5, 1], [5, 6, 2], [1, 9, 1], [11, 10, 1], [7, 12, 2],
      [14, 13, 1], [3, 14, 1], [10, 15, 2], [6, 3, 1], [15, 8, 2],
    ]; // prettier-ignore
    for (const [x, y, k] of specks) {
      put(im, x, y, k === 1 ? C.pGrain1 : C.pGrain2);
      if (k === 2) put(im, x + 1, y, C.pGrain2);
    }
    part("parchment_grain", im);
  }

  // Binding stitched down the gutter (stretched vertically).
  {
    const im = sprite(["oddmmddo", "oddmmddo", "odllmddo", "oddmmddo"], {
      o: C.lOutline,
      d: C.lDark,
      m: C.lBase,
      l: C.lLight,
    });
    part("book_gutter", im, [0, 1, 0, 1]);
  }

  // Ribbon bookmark tabs: cloth with a swallowtail end; the icon sits on the cloth.
  for (const [name, w, active] of [
    ["ribbon_tab", 26, false],
    ["ribbon_tab_active", 33, true],
  ]) {
    const h = 24;
    const im = img(w, h);
    const base = active ? C.rLight : C.rBase;
    const light = active ? C.rShine : C.rLight;
    for (let y = 0; y < h; y++) {
      // notch: the end is cut into a V
      const notch = Math.abs(y - (h - 1) / 2);
      const end = w - 1 - Math.max(0, 6 - Math.round(notch * 0.55));
      for (let x = 0; x <= end; x++) {
        let c = base;
        if (y === 0 || y === h - 1 || x === end) c = C.rOutline;
        else if (y === 1) c = light;
        else if (y === h - 2) c = C.rDark;
        else if (y === 3 || y === h - 4) c = active ? C.rBase : C.rDark; // woven stripe
        put(im, x, y, c);
      }
    }
    part(name, im);
  }

  // Vanilla inventory slot and the bigger result slot.
  for (const [name, s] of [
    ["slot", 18],
    ["slot_large", 26],
  ]) {
    const im = img(s, s, C.slot);
    rect(im, 0, 0, s - 1, 1, C.slotDark);
    rect(im, 0, 0, 1, s - 1, C.slotDark);
    rect(im, 1, s - 1, s - 1, 1, C.slotLight);
    rect(im, s - 1, 1, 1, s - 1, C.slotLight);
    part(name, im, 1);
  }

  // Locked slot: darker well, same bevel.
  {
    const im = img(18, 18, hex("#5a5a5a"));
    rect(im, 0, 0, 17, 1, hex("#262626"));
    rect(im, 0, 0, 1, 17, hex("#262626"));
    rect(im, 1, 17, 17, 1, hex("#9a9a9a"));
    rect(im, 17, 1, 1, 17, hex("#9a9a9a"));
    part("slot_locked", im, 1);
  }

  // Selection frame drawn over a slot (hover/selected).
  {
    const im = img(20, 20);
    rect(im, 0, 0, 20, 20, C.white);
    for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) erase(im, x, y);
    for (const [x, y] of [[0, 0], [19, 0], [0, 19], [19, 19]]) erase(im, x, y); // prettier-ignore
    part("slot_select", im, 3);
  }

  // Effect family badges.
  for (const [f, fam] of Object.entries(FAMILY)) {
    part(
      `badge_${f}`,
      bevelBox(16, 16, { outline: fam.dark, light: fam.fillLight, dark: fam.mid, face: fam.fill }),
      3,
    );
  }
  part(
    "badge_locked",
    bevelBox(16, 16, {
      outline: hex("#3d3d3d"),
      light: hex("#d0d0d0"),
      dark: hex("#7a7a7a"),
      face: hex("#b5b5b5"),
    }),
    3,
  );

  part(
    "count_bubble",
    bevelBox(12, 12, { outline: C.rOutline, light: C.rShine, dark: C.rDark, face: C.rLight }),
    4,
  );

  // A parchment "chip" for stat rows (food, station) and hint boxes.
  part(
    "chip",
    bevelBox(16, 16, { outline: C.pStack1, light: C.pLight, dark: C.pBand2, face: C.pDark }),
    3,
  );

  // Buttons: book buttons (parchment on leather), the Cook button, and its disabled state.
  const button = (outline, light, face, lip) => {
    const im = img(16, 18);
    rect(im, 0, 0, 16, 18, outline);
    rect(im, 1, 1, 14, 16, lip);
    rect(im, 1, 1, 14, 13, face);
    rect(im, 1, 1, 14, 1, light);
    rect(im, 1, 1, 1, 13, light);
    for (const [x, y] of [[0, 0], [15, 0], [0, 17], [15, 17]]) erase(im, x, y); // prettier-ignore
    return im;
  };
  part(
    "button_book",
    button(hex("#24140a"), C.pLight, hex("#e6d0a0"), hex("#a07a48")),
    [3, 3, 3, 5],
  );
  part("button_book_hover", button(hex("#24140a"), hex("#fff6dc"), hex("#f4e4bb"), hex("#b38b55")), [3, 3, 3, 5]); // prettier-ignore
  part("button_cook", button(hex("#2a120a"), COPPER[4], COPPER[3], COPPER[0]), [3, 3, 3, 5]);
  part("button_cook_disabled", button(hex("#2b2b2b"), hex("#a8a8a8"), hex("#8b8b8b"), hex("#555555")), [3, 3, 3, 5]); // prettier-ignore
  part("button_gray", button(hex("#1e1e1e"), hex("#ffffff"), hex("#d0d0d0"), hex("#6b6b6b")), [3, 3, 3, 5]); // prettier-ignore

  // Recipe arrow (parchment ink) and the pot screen arrow (vanilla grey).
  for (const [name, fill, edge] of [
    ["arrow_ink", hex("#a07a48"), hex("#5a3d1c")],
    ["arrow_pot", hex("#8b8b8b"), hex("#555555")],
    ["arrow_pot_ready", hex("#ffffff"), hex("#8b8b8b")],
  ]) {
    part(
      name,
      sprite(
        [
          "........e.....",
          "........ee....",
          "........efe...",
          "eeeeeeeeeffe..",
          "efffffffffffe.",
          "efffffffffffe.",
          "eeeeeeeeeffe..",
          "........efe...",
          "........ee....",
          "........e.....",
        ],
        { e: edge, f: fill },
      ),
    );
  }

  // Heat indicator: lit flame (ours) and unlit (grey outline of the same shape).
  {
    const lit = img(16, 16);
    blit(lit, ICON.fire, 0, 0);
    part("flame_on", lit);
    const off = img(16, 16);
    blit(off, ICON.fire, 0, 0, { gray: true, tint: hex("#7a7a7a") });
    part("flame_off", off);
  }

  // Dish halo: hard-edged sunburst behind the big dish icon.
  {
    const s = 64;
    const im = img(s, s);
    const c = (s - 1) / 2;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < s; x++) {
        const dx = x - c;
        const dy = y - c;
        const r = Math.hypot(dx, dy);
        if (r > 31) continue;
        const a = Math.atan2(dy, dx) + Math.PI;
        const ray = Math.floor((a / (2 * Math.PI)) * 24) % 2;
        let col = ray ? hex("#f6e7bd") : hex("#ecd49e");
        if (r > 29.6) col = hex("#d7b97f");
        else if (r < 20) col = ray ? hex("#fbf0d0") : hex("#f3e0b0");
        put(im, x, y, col);
      }
    part("dish_halo", im);
  }

  // Divider under titles: a stretchable ink rule with dot ends, plus a fixed brass diamond on top.
  part("divider", sprite(["d.dddddddd.d"], { d: C.inkSoft }), [2, 0, 2, 0]);
  part(
    "divider_gem",
    sprite([".....o.....", "....ohd....", "dd.ohgdd.dd", "....odd....", ".....o....."], {
      o: C.gDark,
      h: C.gShine,
      g: C.gLight,
      d: C.gMid,
    }),
  );

  // Tooltip (Minecraft-style dark box with a violet rim).
  {
    const im = img(12, 12, hex("#100010"));
    rect(im, 1, 1, 10, 10, hex("#2a0b5e"));
    rect(im, 2, 2, 8, 8, hex("#100010"));
    for (const [x, y] of [[0, 0], [11, 0], [0, 11], [11, 11]]) erase(im, x, y); // prettier-ignore
    part("tooltip", im, 3);
  }

  // Pot screen panel: vanilla grey container with a copper rim band on top (the title bar) and
  // copper rivets. Insets keep the rim and the rivets out of the stretched area.
  {
    const w = 32;
    const h = 40;
    const im = img(w, h);
    rect(im, 0, 0, w, h, C.black);
    rect(im, 1, 1, w - 2, h - 2, C.panelDark);
    rect(im, 1, 1, w - 3, h - 3, C.white);
    rect(im, 3, 3, w - 6, h - 6, C.panel);
    rect(im, w - 3, 3, 2, h - 4, C.panelDark);
    rect(im, 3, h - 3, w - 4, 2, C.panelDark);
    // copper rim band
    rect(im, 1, 1, w - 2, 18, COPPER[2]);
    rect(im, 1, 1, w - 2, 1, COPPER[4]);
    rect(im, 1, 2, w - 2, 1, COPPER[3]);
    rect(im, 1, 16, w - 2, 1, COPPER[1]);
    rect(im, 1, 17, w - 2, 1, COPPER[0]);
    rect(im, 1, 18, w - 2, 1, C.black);
    for (const x of [5, w - 7]) {
      rect(im, x, 8, 2, 2, COPPER[0]);
      put(im, x, 8, COPPER[4]);
    }
    for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) erase(im, x, y); // prettier-ignore
    part("pot_panel", im, [9, 20, 9, 5]);
  }

  // The pot well holding the 8 slots: an iron rim lip on top, a copper belly with rounded
  // bottom corners. Handles are a separate part placed on both sides.
  {
    const w = 24;
    const h = 28;
    const im = img(w, h);
    const ol = hex("#1e100a");
    // rim (full width)
    rect(im, 0, 0, w, 5, ol);
    rect(im, 1, 1, w - 2, 1, hex("#8a8a8a"));
    rect(im, 1, 2, w - 2, 1, hex("#5e5e5e"));
    rect(im, 1, 3, w - 2, 1, hex("#3a3a3a"));
    // belly (2 px narrower on each side), rounded bottom
    const r = 4;
    for (let y = 5; y < h; y++)
      for (let x = 2; x < w - 2; x++) {
        const fromBottom = h - 1 - y;
        const inset = fromBottom < r ? r - fromBottom - (fromBottom === 0 ? 0 : 1) : 0;
        if (x < 2 + inset || x > w - 3 - inset) continue;
        const edge = x === 2 + inset || x === w - 3 - inset || fromBottom === 0;
        let c = COPPER[2];
        if (edge) c = ol;
        else if (x === 3 + inset) c = COPPER[3];
        else if (x === w - 4 - inset || fromBottom === 1) c = COPPER[1];
        else if (y === 5) c = COPPER[0];
        put(im, x, y, c);
      }
    part("pot_well", im, [7, 7, 7, 7]);
    part(
      "pot_handle",
      sprite(
        [
          "..oooo",
          ".ohhhh",
          "ohhooo",
          "oho...",
          "oho...",
          "oho...",
          "oho...",
          "oho...",
          "ohhooo",
          ".ohhhh",
          "..oooo",
        ],
        { o: hex("#1e1e1e"), h: hex("#6b6b6b") },
      ),
    );
  }

  // Small family colour gem for dish tiles in a chapter index.
  for (const [f, fam] of Object.entries(FAMILY))
    part(
      `gem_${f}`,
      sprite([".ooooo.", "ohhbbbo", "ohbbbmo", "obbbbmo", "obbbmmo", "obmmmmo", ".ooooo."], {
        o: fam.dark,
        h: fam.fillLight,
        b: fam.base,
        m: fam.mid,
      }),
    );
}

// ---------------------------------------------------------------------------------------------
// Composition helpers.
// ---------------------------------------------------------------------------------------------

/** Darkened world behind the screen (like the game's dim overlay). */
function backdrop() {
  const im = img(W, H, hex("#000000"));
  const wall = ICON.bricks;
  const floor = ICON.planks;
  for (let y = 0; y < H; y += 32)
    for (let x = 0; x < W; x += 32) {
      const src = y < 150 ? wall : floor;
      blit(im, src, x, y, { scale: 2, tint: hex("#5a5a5a") });
    }
  rect(im, 0, 0, W, H, [16, 10, 6, 140]);
  return im;
}

function slot(im, x, y, size = 18, kind = "slot") {
  nine(im, PARTS[kind], x, y, size, size, 1);
}

/** An item in a slot of `size`, icon scaled by `scale`, with an optional count. */
function item(im, icon, x, y, { size = 18, scale = 1, count, locked = false, ghost = false } = {}) {
  slot(im, x, y, size, locked ? "slot_locked" : "slot");
  const s = 16 * scale;
  const ox = x + Math.floor((size - s) / 2);
  const oy = y + Math.floor((size - s) / 2);
  if (!icon) return;
  if (locked) {
    blit(im, icon, ox, oy, { scale, solid: hex("#262626") });
    const qs = scale >= 2 ? 2 : 1;
    textCentered(im, "?", x + size / 2 + 0.5, y + Math.floor((size - 7 * qs) / 2), C.white, {
      scale: qs,
      shadow: hex("#000000"),
    });
    return;
  }
  blit(im, icon, ox, oy, { scale, alpha: ghost ? 0.4 : 1 });
  if (typeof count === "string" || count > 1) {
    const cs = scale >= 2 ? 2 : 1;
    const w = textWidth(String(count), cs);
    text(im, String(count), x + size - 1 - w - cs, y + size - 1 - 8 * cs, C.white, {
      scale: cs,
      shadow: hex("#3f3f3f"),
    });
  }
}

function button(im, kind, x, y, w, h) {
  nine(im, PARTS[kind], x, y, w, h, INSETS[kind]);
}

/** The book: cover, pages, gutter, ribbons, nav bar. Returns the page content rectangles. */
const BOOK = {
  cover: { x: 12, y: 4, w: 368, h: 232 },
  left: { x: 22, y: 12, w: 176, h: 194 },
  right: { x: 196, y: 12, w: 176, h: 194 },
  tabs: ["pot", "board", "table", "crops", "what"],
};

function book(im, { activeTab, page }) {
  const { cover, left, right } = BOOK;
  // ribbons first, so the cover edge sits on top of their roots
  BOOK.tabs.forEach((t, i) => {
    const active = t === activeTab;
    const tab = PARTS[active ? "ribbon_tab_active" : "ribbon_tab"];
    const y = 22 + i * 30;
    blit(im, tab, cover.x + cover.w - 6, y);
    const icon = t === "table" ? ICON.table : ICON[t];
    blit(im, icon, cover.x + cover.w - 6 + (active ? 12 : 7), y + 4);
  });
  nine(im, PARTS.book_cover, cover.x, cover.y, cover.w, cover.h, 10);
  nine(im, PARTS.page_left, left.x, left.y, left.w, left.h, INSETS.page_left);
  nine(im, PARTS.page_right, right.x, right.y, right.w, right.h, INSETS.page_right);
  tile(im, PARTS.parchment_grain, left.x + 6, left.y + 3, left.w - 13, left.h - 7);
  tile(im, PARTS.parchment_grain, right.x + 7, right.y + 3, right.w - 13, right.h - 7);
  nine(im, PARTS.book_gutter, right.x - 4, left.y - 1, 8, left.h + 2, [0, 1, 0, 1]);

  // nav bar on the leather
  const ny = 210;
  button(im, "button_book", 24, ny, 30, 20);
  textCentered(im, "◀", 39, ny + 5, C.ink);
  button(im, "button_book", cover.x + cover.w - 42, ny, 30, 20);
  textCentered(im, "▶", cover.x + cover.w - 27, ny + 5, C.ink);
  const mid = right.x;
  button(im, "button_book", mid - 54, ny, 50, 20);
  text(im, "↶", mid - 48, ny + 5, C.ink);
  text(im, "Back", mid - 37, ny + 5, C.ink);
  button(im, "button_book", mid + 4, ny, 50, 20);
  text(im, "⌂", mid + 10, ny + 5, C.ink);
  text(im, "Home", mid + 21, ny + 5, C.ink);
  if (page) textCentered(im, page, (mid + 54 + cover.x + cover.w - 42) / 2, ny + 6, hex("#d9b98a"));
  return {
    L: { x: left.x + 8, y: left.y + 6, w: left.w - 16, h: left.h - 12 },
    R: { x: right.x + 8, y: right.y + 6, w: right.w - 16, h: right.h - 12 },
  };
}

function title(im, s, area, y = area.y + 2) {
  textCentered(im, s, area.x + area.w / 2, y, C.ink, { scale: 2 });
  nine(im, PARTS.divider, area.x + 14, y + 20, area.w - 28, 1, INSETS.divider);
  blit(im, PARTS.divider_gem, Math.round(area.x + area.w / 2 - 5.5), y + 18);
}

/** Effect badge: family icon, vanilla effect icon, duration. Returns its width. */
function effectBadge(im, x, y, { family, effect, label }) {
  const fam = FAMILY[family];
  const w = 4 + 16 + 3 + 18 + 4 + textWidth(label, 2) + 6;
  nine(im, PARTS[`badge_${family}`], x, y, w, 24, 3);
  blit(im, fam.icon, x + 4, y + 4);
  blit(im, effect, x + 23, y + 3);
  text(im, label, x + 45, y + 5, fam.dark, { scale: 2 });
  return w;
}

function chip(im, x, y, w, h) {
  nine(im, PARTS.chip, x, y, w, h, 3);
}

function tooltip(im, s, x, y) {
  const w = textWidth(s) + 8;
  nine(im, PARTS.tooltip, x, y, w, 15, 3);
  text(im, s, x + 4, y + 4, C.white, { shadow: hex("#3f3f3f") });
}

// ---------------------------------------------------------------------------------------------
// Mockups.
// ---------------------------------------------------------------------------------------------

/** Left page of a dish: title, big icon on the halo, effect badge, food, station. */
function dishLeftPage(im, L, d) {
  title(im, d.locked ? "???" : d.name, L);
  const hx = L.x + Math.floor((L.w - 64) / 2);
  const hy = L.y + 31;
  blit(im, PARTS.dish_halo, hx, hy);
  if (d.locked) {
    blit(im, d.icon, hx + 8, hy + 8, { scale: 3, solid: hex("#4a3826") });
    textCentered(im, "?", hx + 32.5, hy + 22, C.pLight, { scale: 3, outline: hex("#2a1c10") });
  } else blit(im, d.icon, hx + 8, hy + 8, { scale: 3 });

  // row 1: effect badge + station chip; row 2: food chip
  const rowY = hy + 76;
  const stW = d.heat ? 48 : 26;
  let badgeW;
  if (d.locked) badgeW = 4 + 16 + 4 + textWidth("???", 2) + 6;
  else badgeW = 4 + 16 + 3 + 18 + 4 + textWidth(d.effectLabel, 2) + 6;
  const bx = L.x + Math.floor((L.w - (badgeW + 8 + stW)) / 2);
  if (d.locked) {
    nine(im, PARTS.badge_locked, bx, rowY, badgeW, 24, 3);
    blit(im, ICON.locked, bx + 4, rowY + 4);
    text(im, "???", bx + 24, rowY + 5, hex("#3d3d3d"), { scale: 2 });
  } else effectBadge(im, bx, rowY, { family: d.family, effect: d.effect, label: d.effectLabel });
  const sx = bx + badgeW + 8;
  chip(im, sx, rowY, stW, 24);
  blit(im, d.station, sx + 5, rowY + 4);
  if (d.heat) {
    textCentered(im, "+", sx + 26, rowY + 8, C.ink);
    blit(im, ICON.fire, sx + 29, rowY + 4);
  }
  const fy = rowY + 34;
  const foodW = 10 + d.food * 20 - 2;
  const fx = L.x + Math.floor((L.w - foodW) / 2);
  chip(im, fx, fy, foodW, 28);
  for (let i = 0; i < d.food; i++) {
    const opts = { scale: 2, ...(d.locked ? { solid: hex("#a08b68") } : {}) };
    blit(im, ICON.hungerBg, fx + 5 + i * 20, fy + 5, opts);
    blit(im, ICON.hunger, fx + 5 + i * 20, fy + 5, opts);
  }
}

/** Right page of a dish: 3×3 grid → result, and a hint. */
function dishRightPage(im, R, d) {
  textCentered(im, "You need", R.x + R.w / 2, R.y + 4, C.inkSoft);
  const gx = R.x + 2;
  const gy = R.y + 18;
  for (let i = 0; i < 9; i++) {
    const ing = d.ingredients[i];
    const x = gx + (i % 3) * 34;
    const y = gy + Math.floor(i / 3) * 34;
    if (!ing) slot(im, x, y, 34);
    else item(im, ing.icon, x, y, { size: 34, scale: 2, count: ing.count, locked: ing.locked });
  }
  if (d.selected !== undefined) {
    const x = gx + (d.selected % 3) * 34;
    const y = gy + Math.floor(d.selected / 3) * 34;
    nine(im, PARTS.slot_select, x - 2, y - 2, 38, 38, 3);
  }
  const ax = gx + 102 + 3;
  blit(im, PARTS.arrow_ink, ax, gy + 51 - 5);
  const rx = ax + 14 + 3;
  const ry = gy + 51 - 20;
  nine(im, PARTS.slot_large, rx, ry, 40, 40, 1);
  if (d.locked) {
    blit(im, d.icon, rx + 4, ry + 4, { scale: 2, solid: hex("#262626") });
    textCentered(im, "?", rx + 20.5, ry + 13, C.white, { scale: 2, shadow: C.black });
  } else blit(im, d.icon, rx + 4, ry + 4, { scale: 2 });
}

const TOMATO_SOUP = {
  name: "Tomato Soup",
  icon: ICON.tomato_soup,
  family: "heal",
  effect: ICON.regen,
  effectLabel: "8 s",
  food: 3,
  station: ICON.pot,
  heat: true,
  ingredients: [
    { icon: ICON.tomato, count: 2 },
    { icon: ICON.bowl, count: 1 },
  ],
};

function bookDishPage() {
  const im = backdrop();
  const { L, R } = book(im, { activeTab: "pot", page: "1/7" });
  dishLeftPage(im, L, TOMATO_SOUP);
  dishRightPage(im, R, { ...TOMATO_SOUP, selected: 0 });
  // what the selected ingredient is: name + where it comes from
  const hy = R.y + 128;
  chip(im, R.x + 2, hy, R.w - 4, 46);
  text(im, "Tomato", R.x + 8, hy + 5, C.ink);
  text(im, "Tap to find", R.x + R.w - 8 - textWidth("Tap to find"), hy + 5, C.inkSoft);
  // chain: grass → seeds → crop → tomato
  const chain = [ICON.grass, ICON.tomato_seeds, ICON.tomato];
  let x = R.x + 12;
  chain.forEach((ic, i) => {
    item(im, ic, x, hy + 20, { size: 20 });
    x += 20;
    if (i < chain.length - 1) {
      text(im, "→", x + 4, hy + 26, C.inkSoft);
      x += 15;
    }
  });
  text(im, "Plains", x + 6, hy + 26, C.ink);
  return im;
}

function bookDishPageLocked() {
  const im = backdrop();
  const { L, R } = book(im, { activeTab: "pot", page: "3/7" });
  const d = {
    name: "Chili Stew",
    icon: ICON.chili_stew,
    family: "explore",
    food: 5,
    station: ICON.pot,
    heat: true,
    locked: true,
    ingredients: [
      { icon: ICON.chili, count: 1, locked: true },
      { icon: ICON.beef, count: 1 },
      { icon: ICON.tomato, count: 1 },
      { icon: ICON.onion, count: 1 },
      { icon: ICON.bowl, count: 1 },
    ],
  };
  dishLeftPage(im, L, d);
  dishRightPage(im, R, { ...d, selected: 0 });
  // hint: find the missing crop in jungle grass
  const hy = R.y + 128;
  chip(im, R.x + 2, hy, R.w - 4, 46);
  text(im, "Find it!", R.x + 8, hy + 5, C.ink);
  item(im, ICON.chili, R.x + 12, hy + 20, { size: 20, locked: true });
  text(im, "→", R.x + 36, hy + 26, C.inkSoft);
  item(im, ICON.grass, R.x + 49, hy + 20, { size: 20 });
  item(im, ICON.jungle, R.x + 71, hy + 20, { size: 20 });
  text(im, "Jungle", R.x + 97, hy + 21, C.ink);
  text(im, "grass", R.x + 97, hy + 31, C.ink);
  return im;
}

const POT_DISHES = [
  { name: "Tomato Soup", icon: ICON.tomato_soup, family: "heal" },
  { name: "Vegetable Stew", icon: ICON.vegetable_stew, family: "heal" },
  { name: "Chili Stew", icon: ICON.chili_stew, family: "explore", locked: true },
  { name: "Fish Chowder", icon: ICON.fish_chowder, family: "explore" },
  { name: "Chicken Soup", icon: ICON.chicken_soup, family: "heal" },
  { name: "Onion Soup", icon: ICON.onion_soup, family: "explore" },
  { name: "Strawberry Jam", icon: ICON.strawberry_jam, family: "move", locked: true },
];

function bookChapterIndex() {
  const im = backdrop();
  const { L, R } = book(im, { activeTab: "pot" });
  title(im, "Cooking Pot", L);
  // the station: pot over a fire, big
  const px = L.x + Math.floor((L.w - 64) / 2);
  const py = L.y + 28;
  blit(im, PARTS.dish_halo, px, py);
  blit(im, ICON.pot, px + 8, py + 4, { scale: 3 });
  blit(im, ICON.fire, px + 24, py + 46);
  textCentered(im, "Needs fire", L.x + L.w / 2, py + 68, C.inkSoft);
  // colour legend: the four families
  const ly = py + 82;
  const fams = [
    ["heal", "Heal"],
    ["move", "Move"],
    ["work", "Work"],
    ["explore", "Explore"],
  ];
  fams.forEach(([f, label], i) => {
    const x = L.x + 4 + (i % 2) * 78;
    const y = ly + Math.floor(i / 2) * 26;
    nine(im, PARTS[`badge_${f}`], x, y, 74, 22, 3);
    blit(im, FAMILY[f].icon, x + 4, y + 3);
    text(im, label, x + 24, y + 8, FAMILY[f].dark);
  });

  // right page: dish tiles, found count
  const found = POT_DISHES.filter((d) => !d.locked).length;
  textCentered(im, `${found}/${POT_DISHES.length} found ★`, R.x + R.w / 2, R.y + 4, C.inkSoft);
  const tile = 46;
  const gap = 6;
  const gx = R.x + Math.floor((R.w - (3 * tile + 2 * gap)) / 2);
  const gy = R.y + 18;
  POT_DISHES.forEach((d, i) => {
    const x = gx + (i % 3) * (tile + gap);
    const y = gy + Math.floor(i / 3) * (tile + gap);
    nine(im, PARTS[d.locked ? "slot_locked" : "slot"], x, y, tile, tile, 1);
    if (d.locked) {
      blit(im, d.icon, x + 7, y + 7, { scale: 2, solid: hex("#262626") });
      textCentered(im, "?", x + tile / 2 + 0.5, y + 16, C.white, { scale: 2, shadow: C.black });
    } else {
      blit(im, d.icon, x + 7, y + 7, { scale: 2 });
      blit(im, PARTS[`gem_${d.family}`], x + tile - 10, y + 3);
    }
  });
  textCentered(im, "Tap a dish", R.x + R.w / 2, R.y + R.h - 10, C.inkSoft);
  // hover on Tomato Soup: selection frame + tooltip
  nine(im, PARTS.slot_select, gx - 2, gy - 2, tile + 4, tile + 4, 3);
  tooltip(im, "Tomato Soup", gx + 20, gy + tile - 4);
  return im;
}

function bookHome() {
  const im = backdrop();
  const { L, R } = book(im, {});
  title(im, "Recipes", L);
  // cover illustration: three dishes on the halo
  const hx = L.x + Math.floor((L.w - 64) / 2);
  const hy = L.y + 28;
  blit(im, PARTS.dish_halo, hx, hy);
  blit(im, ICON.tomato_soup, hx + 16, hy + 4, { scale: 2 });
  blit(im, ICON.strawberry_cake, hx + 1, hy + 30, { scale: 2 });
  blit(im, ICON.hearty_sandwich, hx + 31, hy + 30, { scale: 2 });
  // the big "what can I make" button
  const by = hy + 72;
  const bw = L.w - 4;
  button(im, "button_cook", L.x + 2, by, bw, 50);
  blit(im, ICON.what, L.x + 8, by + 7, { scale: 2 });
  text(im, "What to", L.x + 46, by + 8, C.white, { scale: 2, shadow: hex("#3f1a0e") });
  text(im, "make?", L.x + 46, by + 26, C.white, { scale: 2, shadow: hex("#3f1a0e") });
  // count badge: dishes you can make right now
  const cx = L.x + bw - 18;
  nine(im, PARTS.count_bubble, cx, by - 6, 22, 22, 4);
  textCentered(im, "3", cx + 11.5, by - 1, C.white, { scale: 2, shadow: C.rOutline });

  // right page: four chapter buttons
  const chapters = [
    [ICON.pot, "Pot", "5/7"],
    [ICON.board, "Board", "3/3"],
    [ICON.table, "Crafting", "4/6"],
    [ICON.crops, "Crops", "2/5"],
  ];
  chapters.forEach(([icon, label, progress], i) => {
    const y = R.y + 2 + i * 45;
    button(im, i === 0 ? "button_book_hover" : "button_book", R.x, y, R.w, 40);
    slot(im, R.x + 5, y + 3, 34);
    blit(im, icon, R.x + 6, y + 4, { scale: 2 });
    text(im, label, R.x + 46, y + 9, C.ink, { scale: 2 });
    const pw = textWidth(`${progress} ★`);
    text(im, `${progress} ★`, R.x + R.w - 8 - pw, y + 27, C.inkSoft);
  });
  return im;
}

function bookWhatCanIMake() {
  const im = backdrop();
  const { L, R } = book(im, { activeTab: "what" });
  title(im, "What to make?", L);
  textCentered(im, "From your bag", L.x + L.w / 2, L.y + 28, C.inkSoft);
  const ready = [
    { name: "Tomato Soup", icon: ICON.tomato_soup, family: "heal", station: ICON.pot },
    { name: "Veggie Sandwich", icon: ICON.veggie_sandwich, family: null, station: ICON.table },
    { name: "Onion Soup", icon: ICON.onion_soup, family: "explore", station: ICON.pot },
  ];
  ready.forEach((d, i) => {
    const y = L.y + 42 + i * 48;
    const x = L.x + 6;
    nine(im, PARTS.slot, x, y, 44, 44, 1);
    blit(im, d.icon, x + 6, y + 6, { scale: 2 });
    if (d.family) blit(im, PARTS[`gem_${d.family}`], x + 34, y + 3);
    text(im, d.name, x + 52, y + 5, C.ink);
    const heat = d.station === ICON.pot;
    chip(im, x + 52, y + 17, heat ? 48 : 26, 24);
    blit(im, d.station, x + 57, y + 21);
    if (heat) {
      textCentered(im, "+", x + 78, y + 25, C.ink);
      blit(im, ICON.fire, x + 81, y + 21);
    }
  });

  textCentered(im, "Almost!", R.x + R.w / 2, R.y + 2, C.ink, { scale: 2 });
  const almost = [
    { icon: ICON.vegetable_stew, need: ICON.potato },
    { icon: ICON.chicken_soup, need: ICON.carrot },
  ];
  almost.forEach((d, i) => {
    const y = R.y + 28 + i * 52;
    const x = R.x + 4;
    item(im, d.need, x + 4, y + 5, { size: 34, scale: 2, count: "+1" });
    blit(im, PARTS.arrow_ink, x + 46, y + 17);
    nine(im, PARTS.slot, x + 66, y, 44, 44, 1);
    blit(im, d.icon, x + 72, y + 6, { scale: 2, alpha: 0.45 });
  });
  textCentered(im, "Tap to see", R.x + R.w / 2, R.y + 140, C.inkSoft);
  return im;
}

/** Pot screen. A dish matches (`result` without `almost`), or nothing matches yet (`almost`). */
function potScreen({ contents, result, almost, lit = true }) {
  const im = backdrop();
  const pw = 310;
  const ph = 214;
  const px = Math.floor((W - pw) / 2);
  const py = 13;
  nine(im, PARTS.pot_panel, px, py, pw, ph, INSETS.pot_panel);
  blit(im, ICON.pot, px + 7, py + 2);
  text(im, "Cooking Pot", px + 27, py + 6, C.white, { shadow: shadowOf(COPPER[0]) });

  // In the pot: 2×4 slots inside the pot-shaped well
  text(im, "In the pot", px + 18, py + 25, C.label);
  const wx = px + 14;
  const wy = py + 36;
  const ww = 4 * 34 + 16;
  const wh = 2 * 34 + 14;
  blit(im, PARTS.pot_handle, wx - 4, wy + 20);
  blit(im, flipX(PARTS.pot_handle), wx + ww - 2, wy + 20);
  nine(im, PARTS.pot_well, wx, wy, ww, wh, INSETS.pot_well);
  for (let i = 0; i < 8; i++) {
    const x = wx + 8 + (i % 4) * 34;
    const y = wy + 7 + Math.floor(i / 4) * 34;
    const c = contents[i];
    if (c) item(im, c.icon, x, y, { size: 34, scale: 2, count: c.count });
    else slot(im, x, y, 34);
  }

  // arrow, with the heat indicator under it
  const ax = wx + ww + 10;
  const ay = wy + 16;
  blit(im, PARTS[almost || !lit ? "arrow_pot" : "arrow_pot_ready"], ax, ay, { scale: 2 });
  blit(im, PARTS[lit ? "flame_on" : "flame_off"], ax - 2, ay + 24, { scale: 2 });

  // result + Cook button
  const bw = 80;
  const bx = ax + 36;
  const rx = bx + bw / 2 - 22;
  const ry = wy + 2;
  nine(im, PARTS.slot_large, rx, ry, 44, 44, 1);
  const canCook = !almost && lit;
  blit(im, result.icon, rx + 6, ry + 6, { scale: 2, alpha: canCook ? 1 : 0.35 });
  const by = ry + 52;
  button(im, canCook ? "button_cook" : "button_cook_disabled", bx, by, bw, 28);
  if (!canCook) textCentered(im, "Cook!", bx + bw / 2, by + 7, hex("#b4b4b4"), { scale: 2 });
  else
    textCentered(im, "Cook!", bx + bw / 2, by + 7, C.white, {
      scale: 2,
      shadow: shadowOf(COPPER[0]),
    });

  // info box: what you get (a dish matches) or what's missing (Almost!)
  const ix = px + 12;
  const iy = py + 124;
  const iw = pw - 24;
  const ih = 54;
  nine(im, PARTS.slot, ix, iy, iw, ih, 1);
  rect(im, ix + 1, iy + 1, iw - 2, ih - 2, hex("#b3b3b3"));
  if (almost) {
    text(im, "Almost!", ix + 10, iy + 20, C.white, { scale: 2, shadow: hex("#3f3f3f") });
    let x = ix + 100;
    for (const a of almost) {
      item(im, a.icon, x, iy + 10, { size: 34, scale: 2, count: "+1" });
      x += 38;
    }
    blit(im, PARTS.arrow_ink, x + 4, iy + 22);
    item(im, result.icon, x + 22, iy + 10, { size: 34, scale: 2 });
    blit(im, ICON.book, ix + iw - 22, iy + 4);
  } else if (!lit) {
    item(im, ICON.campfire, ix + 10, iy + 10, { size: 34, scale: 2 });
    text(im, "Needs fire below", ix + 54, iy + 20, C.white, { scale: 2, shadow: hex("#3f3f3f") });
  } else {
    text(im, result.name, ix + 8, iy + 5, C.label, { scale: 2 });
    const bw2 = effectBadge(im, ix + 8, iy + 25, {
      family: result.family,
      effect: result.effect,
      label: result.effectLabel,
    });
    const fx = ix + 8 + bw2 + 10;
    for (let i = 0; i < result.food; i++) {
      blit(im, ICON.hungerBg, fx + i * 20, iy + 28, { scale: 2 });
      blit(im, ICON.hunger, fx + i * 20, iy + 28, { scale: 2 });
    }
  }

  // Recipe Book button
  const rbw = 120;
  const rbx = px + pw - 12 - rbw;
  const rby = py + ph - 30;
  button(im, "button_gray", rbx, rby, rbw, 22);
  blit(im, ICON.book, rbx + 6, rby + 2);
  text(im, "Recipe Book", rbx + 28, rby + 7, C.label);
  return im;
}

// ---------------------------------------------------------------------------------------------

function save(name, im, scale = SCALE) {
  writeFileSync(path.join(HERE, name), encodePng(upscale(im, scale)));
  console.log(`wrote ${path.relative(ROOT, path.join(HERE, name))}`);
}

function main() {
  buildParts();
  mkdirSync(PARTS_DIR, { recursive: true });
  for (const [name, im] of Object.entries(PARTS)) {
    writeFileSync(path.join(PARTS_DIR, `${name}.png`), encodePng(im));
    // Bedrock's texture sidecar for 9-slice images: [left, top, right, bottom] in source px.
    const inset = INSETS[name];
    if (inset === undefined) continue;
    const size = typeof inset === "number" ? [inset, inset, inset, inset] : inset;
    // Same layout prettier gives it, so a re-render leaves no formatting diff.
    const line = `{ "nineslice_size": [${size.join(", ")}], "base_size": [${im.w}, ${im.h}] }`;
    writeFileSync(path.join(PARTS_DIR, `${name}.json`), line + "\n");
  }
  console.log(`wrote ${Object.keys(PARTS).length} parts to ${path.relative(ROOT, PARTS_DIR)}/`);

  save("book_dish_page.png", bookDishPage());
  save("book_dish_page_locked.png", bookDishPageLocked());
  save("book_chapter_index.png", bookChapterIndex());
  save("book_home.png", bookHome());
  save("book_what_can_i_make.png", bookWhatCanIMake());
  save(
    "pot_screen.png",
    potScreen({
      contents: [
        { icon: ICON.tomato, count: 2 },
        { icon: ICON.bowl, count: 1 },
      ],
      result: TOMATO_SOUP,
    }),
  );
  save(
    "pot_screen_cold.png",
    potScreen({
      contents: [
        { icon: ICON.tomato, count: 2 },
        { icon: ICON.bowl, count: 1 },
      ],
      result: TOMATO_SOUP,
      lit: false,
    }),
  );
  save(
    "pot_screen_almost.png",
    potScreen({
      contents: [
        { icon: ICON.onion, count: 1 },
        { icon: ICON.bread, count: 1 },
      ],
      result: { icon: ICON.onion_soup },
      almost: [{ icon: ICON.onion }, { icon: ICON.bowl }],
    }),
  );
}

main();
