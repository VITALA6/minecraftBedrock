// Writes the cooking pot's animated (flipbook) textures into the resource pack:
//   textures/hk/blocks/cooking_pot_liquid_<colour>_boil.png   bubbling liquid, one per colour
//   textures/hk/blocks/cooking_pot_top_boil.png               the hot rim, flickering
//
//   node tools/gen-pot-flipbook.mjs           write the PNGs
//   node tools/gen-pot-flipbook.mjs --check   exit 1 if a PNG differs from what it would write, or
//                                             if terrain_texture.json / flipbook_textures.json lack
//                                             an entry (npm test runs this; tests/fx-pot.test.ts)
//
// A flipbook texture is a vertical strip of 16×16 frames; flipbook_textures.json names it by its
// terrain_texture.json shortname (atlas_tile) and sets the speed. Custom blocks pick it up through
// minecraft:material_instances like any other shortname. Only the cooking + hot pot uses these
// (tools/gen-pot-block.mjs); every other look keeps the still texture.
//
// Sources are the pack's own still textures (cooking_pot_liquid_<colour>.png from
// tools/gen-textures.mjs, cooking_pot_top_hot.png), so a repaint of those flows through: frame 0
// of every strip is the still texture plus the frame-0 bubbles. Colours come only from each
// source's own ramp (no new hues), so every colour of liquid bubbles in its own shades.
//
// The registry entries aren't written here (shared files, edited by hand); --check prints the
// exact lines to add when one is missing.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readPng, writePng } from "../art/harvest_kitchen/models/_tools/png.mjs";
import { ROOT } from "./paths.mjs";

const RP = path.join(ROOT, "packs/harvest_kitchen/resource");
const BLOCKS = path.join(RP, "textures/hk/blocks");
const S = 16;

/** Liquid colours: the values of the pot's hk:liquid state (scripts/data/liquids.ts). */
const LIQUIDS_TS = path.join(ROOT, "packs/harvest_kitchen/scripts/data/liquids.ts");
function liquids() {
  const src = readFileSync(LIQUIDS_TS, "utf8");
  const list = src.match(/export const LIQUIDS = \[([^\]]*)\]/);
  if (!list) throw new Error("LIQUIDS not found in data/liquids.ts");
  return [...list[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

// --- timing (one place; the check compares flipbook_textures.json against it) -----------------

export const LIQUID_FRAMES = 8;
export const LIQUID_TICKS_PER_FRAME = 4; // 8 × 4 = 32 ticks: the four bubbles cycle every 1.6 s
export const RIM_FRAMES = 4;
export const RIM_TICKS_PER_FRAME = 4;

// --- helpers --------------------------------------------------------------------------------------

const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
const key = (p) => p.slice(0, 4).join(",");

/** Distinct opaque colours of an image, dark → light. */
function ramp(px) {
  const seen = new Map();
  for (const p of px) if (p[3] === 255) seen.set(key(p), p);
  return [...seen.values()].sort((a, b) => lum(a) - lum(b));
}

function load(name) {
  const file = path.join(BLOCKS, `${name}.png`);
  const img = readPng(file);
  if (img.w !== S || img.h !== S) throw new Error(`${name}.png is ${img.w}×${img.h}, not 16×16`);
  return img.px;
}

// --- bubbling liquid ------------------------------------------------------------------------------

// The liquid face shows u 3..12, v 3..12 of the texture (geometry.hk.cooking_pot, uv [13,13] size
// [-10,-10]); row 3 is the back-wall shadow band. Bubbles stay inside u 4..11, v 5..11.
//
// One bubble's life, frame by frame (digits = ramp shade, 0 darkest .. 3 lightest; '.' = leave
// the liquid as it is). It rises as a speck, swells into a lit dome, pops into a dark hole with a
// ring of droplets, and leaves two specks that fade.
const LIFE = [
  ["...", ".2.", "..."],
  ["...", ".32", ".21"],
  [".3.", "332", ".21"],
  ["3.3", ".0.", "3.3"],
  ["...", "2.2", "..."],
];

// Where bubbles rise (top-left of the 3×3) and when (start frame): one per quarter of the
// surface, at least a pixel apart, so two or three are on the go at any time.
const BUBBLES = [
  { u: 4, v: 5, start: 0 },
  { u: 9, v: 5, start: 2 },
  { u: 5, v: 9, start: 4 },
  { u: 9, v: 9, start: 6 },
];

function bubblingStrip(liquid) {
  const still = load(`cooking_pot_liquid_${liquid}`);
  const shades = ramp(still);
  if (shades.length < 4) throw new Error(`${liquid}: ${shades.length} shades, need 4`);
  // 0 = darkest, 3 = lightest; the middle shades are the second and second-to-last
  const pick = [shades[0], shades[1], shades[shades.length - 2], shades[shades.length - 1]];
  const out = [];
  for (let f = 0; f < LIQUID_FRAMES; f++) {
    const frame = still.map((p) => [...p]);
    for (const b of BUBBLES) {
      const age = (f - b.start + LIQUID_FRAMES) % LIQUID_FRAMES;
      const rows = LIFE[age];
      if (!rows) continue;
      rows.forEach((row, dy) =>
        [...row].forEach((ch, dx) => {
          if (ch === ".") return;
          frame[(b.v + dy) * S + b.u + dx] = [...pick[+ch]];
        }),
      );
    }
    out.push(...frame);
  }
  return out;
}

// --- flickering hot rim ---------------------------------------------------------------------------

// The rim's top faces show ring 1 (row 1, row 14, column 1, column 14) and the wall tops ring 2 of
// cooking_pot_top_hot (see the geo's "top" UVs). Art review: those stay exactly as in
// cooking_pot_top_hot in every frame (blinking flecks there read as glitter / z-fighting). The
// heat cue is on the handle tops only (the "handles" bone's up faces: column 0 and column 15,
// rows 6-9): one ember steps a pixel per frame along each handle, in opposite directions, on the
// handle's own glow colour.
const HANDLE_ROWS = [6, 7, 8, 9];
function rimStrip() {
  const hot = load("cooking_pot_top_hot");
  const border = [];
  for (let i = 0; i < S; i++)
    border.push(hot[i], hot[(S - 1) * S + i], hot[i * S], hot[i * S + S - 1]);
  const fire = ramp(border); // dark → light fire glow
  if (fire.length < 2) throw new Error("cooking_pot_top_hot.png: no fire colours on its border");
  const ember = fire[fire.length - 1];
  /** The most common colour of a handle top: the glow the ember steps along. */
  const glow = (x) => {
    const counts = new Map();
    for (const y of HANDLE_ROWS) {
      const k = key(hot[y * S + x]);
      counts.set(k, { p: hot[y * S + x], n: (counts.get(k)?.n ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.n - a.n)[0].p;
  };
  const handles = [
    { x: 0, glow: glow(0), row: (f) => HANDLE_ROWS[f % HANDLE_ROWS.length] },
    {
      x: S - 1,
      glow: glow(S - 1),
      row: (f) => HANDLE_ROWS[HANDLE_ROWS.length - 1 - (f % HANDLE_ROWS.length)],
    },
  ];
  const out = [];
  for (let f = 0; f < RIM_FRAMES; f++) {
    const frame = hot.map((p) => [...p]);
    for (const h of handles) {
      for (const y of HANDLE_ROWS) frame[y * S + h.x] = [...h.glow];
      frame[h.row(f) * S + h.x] = [...ember];
    }
    // the art-review rule: nothing but the handle tops may differ from the still hot rim
    frame.forEach((p, i) => {
      const onHandle = (i % S === 0 || i % S === S - 1) && HANDLE_ROWS.includes(Math.floor(i / S));
      if (!onHandle && key(p) !== key(hot[i])) throw new Error(`rim frame ${f} changes pixel ${i}`);
    });
    out.push(...frame);
  }
  return out;
}

// --- registries -----------------------------------------------------------------------------------

export function flipbooks() {
  return [
    ...liquids().map((liquid) => ({
      name: `cooking_pot_liquid_${liquid}_boil`,
      draw: () => bubblingStrip(liquid),
      frames: LIQUID_FRAMES,
      ticks: LIQUID_TICKS_PER_FRAME,
    })),
    {
      name: "cooking_pot_top_boil",
      draw: rimStrip,
      frames: RIM_FRAMES,
      ticks: RIM_TICKS_PER_FRAME,
    },
  ];
}

const shortname = (name) => `hk_${name}`;
const texturePath = (name) => `textures/hk/blocks/${name}`;

/** The flipbook_textures.json entry for one strip. */
export const flipbookEntry = ({ name, ticks }) => ({
  flipbook_texture: texturePath(name),
  atlas_tile: shortname(name),
  ticks_per_frame: ticks,
  blend_frames: false,
});

function registryProblems(books) {
  const problems = [];
  const terrain = JSON.parse(readFileSync(path.join(RP, "textures/terrain_texture.json"), "utf8"));
  const flipFile = path.join(RP, "textures/flipbook_textures.json");
  const flip = existsSync(flipFile) ? JSON.parse(readFileSync(flipFile, "utf8")) : [];
  for (const book of books) {
    const id = shortname(book.name);
    if (terrain.texture_data?.[id]?.textures !== texturePath(book.name)) {
      problems.push(
        `terrain_texture.json lacks "${id}": { "textures": "${texturePath(book.name)}" }`,
      );
    }
    const want = flipbookEntry(book);
    const have = flip.filter((e) => e.atlas_tile === id);
    if (have.length !== 1 || JSON.stringify(have[0]) !== JSON.stringify(want)) {
      problems.push(`flipbook_textures.json needs exactly one ${JSON.stringify(want)}`);
    }
  }
  return problems;
}

// --- main -----------------------------------------------------------------------------------------

function encode(file, px) {
  writePng(file, S, px.length / S, px);
}

function main() {
  const check = process.argv.includes("--check");
  const books = flipbooks();
  const problems = [];
  for (const book of books) {
    const file = path.join(BLOCKS, `${book.name}.png`);
    const px = book.draw();
    if (px.length !== S * S * book.frames) throw new Error(`${book.name}: wrong frame count`);
    if (!check) {
      encode(file, px);
      continue;
    }
    const tmp = path.join(mkdtempSync(path.join(os.tmpdir(), "hk-flipbook-")), "check.png");
    encode(tmp, px);
    const same = existsSync(file) && readFileSync(file).equals(readFileSync(tmp));
    rmSync(path.dirname(tmp), { recursive: true });
    if (!same) problems.push(`${path.relative(ROOT, file)} is out of date`);
  }
  problems.push(...registryProblems(books));
  if (problems.length > 0) {
    for (const p of problems) console.error(`[gen-pot-flipbook] ${p}`);
    if (!check) console.error("[gen-pot-flipbook] wrote the PNGs; add the registry entries above");
    process.exitCode = 1;
    return;
  }
  console.log(`[gen-pot-flipbook] ${books.length} flipbooks ${check ? "up to date" : "written"}`);
}

main();
