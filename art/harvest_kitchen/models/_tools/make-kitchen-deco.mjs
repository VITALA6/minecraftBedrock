// Generates the eight decorative kitchen blocks: models, 16×16 face textures, .bbmodel sources and
// a group scene for the renders.
//
//   node art/harvest_kitchen/models/_tools/make-kitchen-deco.mjs            textures + .bbmodel files
//   node art/harvest_kitchen/models/_tools/make-kitchen-deco.mjs --install  also copy textures and the
//        exported geo into packs/harvest_kitchen/resource (textures/hk/blocks/deco/, models/blocks/hk/)
//   node art/harvest_kitchen/models/_tools/make-kitchen-deco.mjs --check    exit 1 when a texture in
//        art/ or in the pack differs from what this script draws
//
// Then export the geometry and render (Blockbench must be running; it's shared, so take the lock):
//   flock <lock> node art/harvest_kitchen/models/_tools/bb-export.mjs \
//     art/harvest_kitchen/models/<id>/<id>.bbmodel --geo art/harvest_kitchen/models/<id>/<id>.geo.json \
//     --render art/harvest_kitchen/models/<id>/renders/<id>
// and run --install again. `--export` here does all of that for every block plus the group render.
//
// Conventions (same as the cutting board):
// - Block space: x, z in -8..8, y 0..16, 16 texels per block (vanilla density). The model FRONT
//   faces north (-z); the block's placement_direction trait has y_rotation_offset 180, so the front
//   faces the player who places it.
// - Faces use block-projected UVs (model-lib projectUv): every texture is painted like a block
//   face seen from that side, so a feature sits in the texture where it sits on the model:
//   north u = 8 - x, south u = x + 8, west u = z + 8, east u = 8 - z, v = 16 - y;
//   up u = x + 8, v = z + 8 (front edge at the top rows).
// - Small parts that stick out of a front get "extruded" UVs: their sides reuse the edge texels of
//   their own front (a lit top edge stays lit). Tiny hardware uses 1-texel swatches.
// - Light from the top left everywhere; hue-shifted ramps (cool shadows, warm highlights). Wood is
//   the cutting board's oak ramp; iron and copper are the cooking pot's ramps.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { canvas, finalizeFaces, projectUv, rng, savePng, writeBbmodel } from "./model-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const MODELS = path.resolve(import.meta.dirname, "..");
const SHARED = path.join(MODELS, "kitchen_deco");
const PACK_RP = path.join(ROOT, "packs/harvest_kitchen/resource");
const PACK_TEX = path.join(PACK_RP, "textures/hk/blocks/deco");
const PACK_GEO = path.join(PACK_RP, "models/blocks/hk");
const PALETTE = JSON.parse(
  fs.readFileSync(path.join(ROOT, "art/harvest_kitchen/palette.json"), "utf8"),
).ramps;
const ramp = (name) => PALETTE[name].shades;

// ------------------------------------------------------------------------------------ palette
// Oak: the cutting board's ramp (vanilla planks_oak + a warm highlight and a cool deep shadow).
const OAK = {
  hi: "#d6b57c",
  l1: "#c9a56b",
  l2: "#c29d62",
  m: "#b8945f",
  m2: "#af8f55",
  d1: "#9f844d",
  d2: "#967441",
  d3: "#7e6237",
  d4: "#67502c",
  d5: "#4a3a2a",
};
// Polished counter stone: vanilla smooth stone greys, shadows toward blue, highlights toward cream.
const STONE = {
  hi: "#e3dfd2",
  l1: "#d2cfc4",
  l2: "#c1bfb8",
  m: "#adacaa",
  d1: "#97979c",
  d2: "#7e7f8a",
  d3: "#656776",
};
// The cooking pot's iron (#33333a #4e4e57 #71717c from its textures) extended both ways.
const IRON = {
  k: "#25252c",
  dd: "#33333a",
  d: "#4e4e57",
  m: "#71717c",
  l: "#9a9aa5",
  hl: "#c4c4cc",
  hi: "#e6e6ea",
};
// The cooking pot's copper.
const COPPER = { d: "#5e3120", m2: "#8a4a2b", m: "#b8693f", l: "#d98c5b", hi: "#f2b583" };
const WATER = { d: "#2c4f96", m: "#3d6cc0", l: "#5d8fd8", hi: "#a9cdf0" };
const GLASS = { d: "#6f8fa6", m: "#a9c3d6", l: "#d4e5f0", hi: "#f4f9fb" };
const FIRE = { k: "#2a1712", d: "#5a2614", m: "#b13f00", l: "#db7a12", hi: "#f2c44a" };
const WICKER = {
  dd: "#3e2a12",
  d: "#5f421b",
  m2: "#82602a",
  m: "#a07a36",
  l: "#c09a4c",
  hi: "#dcbd70",
};
const CLOTH = { r: "#b8343a", rd: "#8a2230", w: "#efe2c4", wd: "#cdbb98" };
const CREAM = { l: "#f0e6c6", d: "#c9b88e" };
const TOMATO = ramp("tomato");
// The tomato icon's warm ramp (pixels/tomato.txt), for the basket's tomatoes.
const TOMATO_WARM = ["#b41331", "#e01e2c", "#f42e30", "#ff6c58", "#ffd2a8"];
const ONION = ramp("onion");
const CUKE = ramp("cucumber");
const EGG = ramp("eggplant");
const LEAF = ramp("leaf");
const CHILI = ramp("chili");
const CARROT = ramp("carrot");
const SUGAR = ramp("sugar");
const YELLOW = ramp("flower_yellow");

// ---------------------------------------------------------------------------- paint helpers
/** Fills u1 <= u < u2, v1 <= v < v2. */
function fill(cv, [u1, v1, u2, v2], c) {
  for (let v = v1; v < v2; v++) for (let u = u1; u < u2; u++) cv.set(u, v, c);
}
/** A raised panel: lit top row and left column, shadowed bottom row and right column. */
function raised(cv, r, { fillC, hi, lo }) {
  const [u1, v1, u2, v2] = r;
  fill(cv, r, fillC);
  for (let u = u1; u < u2; u++) {
    cv.set(u, v1, hi);
    cv.set(u, v2 - 1, lo);
  }
  for (let v = v1; v < v2; v++) {
    cv.set(u1, v, hi);
    cv.set(u2 - 1, v, lo);
  }
  cv.set(u2 - 1, v1, fillC); // the two mixed corners stay mid
  cv.set(u1, v2 - 1, fillC);
}
/** A sunk groove: shadow on the top row and left column, light on the bottom and right. */
function sunk(cv, [u1, v1, u2, v2], { fillC, hi, lo }) {
  raised(cv, [u1, v1, u2, v2], { fillC, hi: lo, lo: hi });
}
/** Sparse noise inside a rect. */
function speckle(cv, [u1, v1, u2, v2], r, picks) {
  for (let v = v1; v < v2; v++)
    for (let u = u1; u < u2; u++) {
      const n = r();
      let acc = 0;
      for (const [p, c] of picks) {
        acc += p;
        if (n < acc) {
          cv.set(u, v, c);
          break;
        }
      }
    }
}
/** Horizontal wood grain: short darker runs on random rows. */
function grainH(cv, [u1, v1, u2, v2], r, dark, light, runs) {
  for (let i = 0; i < runs; i++) {
    const v = v1 + Math.floor(r() * (v2 - v1));
    const len = 2 + Math.floor(r() * 3);
    const u0 = u1 + Math.floor(r() * Math.max(1, u2 - u1 - len));
    for (let k = 0; k < len && u0 + k < u2; k++) cv.set(u0 + k, v, k === 0 ? light : dark);
  }
}
function grainV(cv, [u1, v1, u2, v2], r, dark, light, runs) {
  for (let i = 0; i < runs; i++) {
    const u = u1 + Math.floor(r() * (u2 - u1));
    const len = 2 + Math.floor(r() * 3);
    const v0 = v1 + Math.floor(r() * Math.max(1, v2 - v1 - len));
    for (let k = 0; k < len && v0 + k < v2; k++) cv.set(u, v0 + k, k === 0 ? light : dark);
  }
}
/** The texel rect a cube's north face covers (u = 8 - x, v = 16 - y). */
const frontRect = (c) => [8 - c.to[0], 16 - c.to[1], 8 - c.from[0], 16 - c.from[1]];
/** x1..x2 (block x) and y1..y2 as a north-face texel rect. */
const fr = (x1, x2, y1, y2) => [8 - x2, 16 - y2, 8 - x1, 16 - y1];

// ------------------------------------------------------------------------------ cube helpers
/** mats: material per face, `default` for the rest. */
const cube = (name, from, to, mats = {}, extra = {}) => ({ name, from, to, mats, ...extra });

/** Side faces of a part on a front reuse its own front's edge texels. */
function extrude(c, mat) {
  const [u1, v1, u2, v2] = frontRect(c);
  c.mats = { default: mat };
  c.uvs = {
    north: [u1, v1, u2, v2],
    south: [u1, v1, u2, v2],
    up: [u2, v1, u1, v1 + 1],
    down: [u2, v2 - 1, u1, v2],
    east: [u1, v1, u1 + 1, v2],
    west: [u2 - 1, v1, u2, v2],
  };
  return c;
}
/** Every face samples one texel: top, sides, bottom. */
function swatch(c, mat, { up, side, down = side }) {
  const t = ([u, v]) => [u, v, u + 1, v + 1];
  c.mats = { default: mat };
  c.uvs = {
    up: t(up),
    down: t(down),
    north: t(side),
    south: t(side),
    east: t(side),
    west: t(side),
  };
  return c;
}
/** Explicit regions: { up, down, north, south, east, west } (missing -> side). */
function regions(c, mat, map) {
  c.mats = { default: mat };
  c.uvs = {};
  for (const f of ["north", "south", "east", "west", "up", "down"])
    c.uvs[f] = map[f] ?? map.side ?? map.north;
  return c;
}

// =================================================================================== textures
// Shared by every wooden piece: horizontal oak planks like vanilla planks, in our oak ramp.
function deco_oak() {
  const r = rng(101);
  const cv = canvas(OAK.m);
  for (let b = 0; b < 4; b++) {
    const v1 = b * 4;
    const tone = [OAK.m, OAK.l2, OAK.m2, OAK.m][b];
    fill(cv, [0, v1, 16, v1 + 4], tone);
    for (let u = 0; u < 16; u++) cv.set(u, v1, b === 0 ? OAK.l1 : OAK.l2);
    for (let u = 0; u < 16; u++) cv.set(u, v1 + 3, OAK.d2);
    const joint = [5, 12, 2, 9][b];
    for (let v = v1; v < v1 + 3; v++) cv.set(joint, v, OAK.d3);
    grainH(cv, [0, v1 + 1, 16, v1 + 3], r, OAK.d1, OAK.m2, 3);
  }
  return cv;
}

/** Counter and sink fronts: stone edge, recessed oak carcass, drawer (or false front) and doors. */
function cabinetFront({ drawer, towel, seed }) {
  const r = rng(seed);
  const cv = canvas(OAK.d2);
  // countertop edge (y 14..16)
  fill(cv, [0, 0, 16, 1], STONE.hi);
  fill(cv, [0, 1, 16, 2], STONE.l2);
  for (const u of [3, 10]) cv.set(u, 1, STONE.m);
  cv.set(15, 1, STONE.d1);
  // shadow under the countertop, carcass stiles
  fill(cv, [0, 2, 16, 3], OAK.d4);
  for (let v = 3; v < 15; v++) {
    cv.set(0, v, OAK.l2);
    cv.set(15, v, OAK.d3);
  }
  fill(cv, [1, 6, 15, 7], OAK.d3); // gap between drawer and doors
  if (drawer) {
    raised(cv, fr(-7, 7, 10, 13), { fillC: OAK.m, hi: OAK.hi, lo: OAK.d2 });
    grainH(cv, [2, 4, 14, 5], r, OAK.m2, OAK.m, 2);
    // iron pull bar (cube x -2..2, y 11..12)
    cv.set(6, 4, IRON.hl);
    cv.set(7, 4, IRON.l);
    cv.set(8, 4, IRON.l);
    cv.set(9, 4, IRON.m);
  } else {
    fill(cv, [1, 3, 15, 4], OAK.d2); // rail under the basin
    raised(cv, fr(-7, 7, 10, 12), { fillC: OAK.m, hi: OAK.hi, lo: OAK.d2 });
    grainH(cv, [2, 4, 14, 6], r, OAK.m2, OAK.m, 2);
  }
  // two doors: viewer-left door u 1..8, viewer-right door u 8..15, rows 7..14 (y 2..9)
  for (const [u1, u2] of [
    [1, 8],
    [8, 15],
  ]) {
    raised(cv, [u1, 7, u2, 14], { fillC: OAK.m, hi: OAK.l1, lo: OAK.d2 });
    sunk(cv, [u1 + 1, 8, u2 - 1, 13], { fillC: OAK.m2, hi: OAK.l1, lo: OAK.d1 });
    raised(cv, [u1 + 2, 9, u2 - 2, 12], { fillC: OAK.l2, hi: OAK.hi, lo: OAK.m2 });
  }
  // copper knobs (cubes at x 1..2 and -2..-1, y 5..6)
  cv.set(6, 10, COPPER.l);
  cv.set(9, 10, COPPER.l);
  if (towel) {
    // a red-and-cream checked tea towel tucked over the viewer-left door (cube x 3..6, y 5..9)
    for (let v = 7; v < 11; v++)
      for (let u = 2; u < 5; u++) {
        const check = (u + v) % 2 === 0;
        const shade = u === 4 || v === 10;
        cv.set(u, v, check ? (shade ? CLOTH.rd : CLOTH.r) : shade ? CLOTH.wd : CLOTH.w);
      }
  }
  fill(cv, [1, 14, 15, 15], OAK.d3);
  fill(cv, [0, 15, 16, 16], OAK.d5); // toe kick
  return cv;
}
const kitchen_counter_front = () => cabinetFront({ drawer: true, seed: 201 });
const kitchen_sink_front = () => cabinetFront({ drawer: false, towel: true, seed: 202 });

/** Counter/sink carcass side (also the back): stone edge, framed oak panel, dark baseboard. */
function kitchen_counter_side() {
  const r = rng(203);
  const cv = canvas(OAK.m2);
  fill(cv, [0, 0, 16, 1], STONE.hi);
  fill(cv, [0, 1, 16, 2], STONE.l2);
  for (const u of [5, 12]) cv.set(u, 1, STONE.m);
  fill(cv, [0, 2, 16, 3], OAK.l2); // top rail, lit
  fill(cv, [0, 3, 16, 14], OAK.m2);
  for (let v = 3; v < 14; v++) {
    cv.set(2, v, OAK.l2);
    cv.set(13, v, OAK.d1);
  }
  sunk(cv, [3, 4, 13, 13], { fillC: OAK.m, hi: OAK.l1, lo: OAK.d2 });
  grainV(cv, [4, 5, 12, 12], r, OAK.m2, OAK.l2, 5);
  fill(cv, [0, 13, 16, 14], OAK.d1);
  fill(cv, [0, 14, 16, 15], OAK.d3);
  fill(cv, [0, 15, 16, 16], OAK.d5);
  return cv;
}

/** Polished stone counter top: lit front and left edges, faint veins, a seam to the next counter. */
function stoneTop(seed) {
  const r = rng(seed);
  const cv = canvas(STONE.l2);
  speckle(cv, [0, 0, 16, 16], r, [
    [0.07, STONE.l1],
    [0.06, STONE.m],
  ]);
  for (const [u, v] of [
    [3, 5],
    [4, 6],
    [5, 6],
    [10, 11],
    [11, 12],
    [12, 12],
    [13, 4],
  ])
    cv.set(u, v, STONE.m);
  fill(cv, [0, 0, 16, 1], STONE.hi);
  for (let v = 1; v < 16; v++) cv.set(0, v, STONE.l1);
  for (let v = 1; v < 16; v++) cv.set(15, v, STONE.m);
  fill(cv, [1, 15, 16, 16], STONE.m);
  return cv;
}
const kitchen_counter_top = () => stoneTop(204);

/** Sink top: the counter stone with the basin (u 3..13, v 4..12) full of water, a steel lip. */
function kitchen_sink_top() {
  const cv = stoneTop(205);
  const r = rng(206);
  // steel lip around the hole
  for (let u = 2; u < 14; u++) {
    cv.set(u, 3, IRON.hl);
    cv.set(u, 12, IRON.l);
  }
  for (let v = 3; v < 13; v++) {
    cv.set(2, v, IRON.hl);
    cv.set(13, v, IRON.l);
  }
  // water: darker under the back wall, light ripples top left
  fill(cv, [3, 4, 13, 12], WATER.m);
  for (let u = 3; u < 13; u++) cv.set(u, 11, WATER.d);
  for (let v = 4; v < 12; v++) cv.set(12, v, WATER.d);
  speckle(cv, [4, 5, 12, 11], r, [[0.06, WATER.l]]);
  for (const [u, v] of [
    [4, 5],
    [5, 5],
    [4, 6],
    [8, 9],
    [9, 9],
  ])
    cv.set(u, v, WATER.l);
  cv.set(5, 6, WATER.hi);
  // drain
  cv.set(7, 7, IRON.d);
  cv.set(8, 7, IRON.dd);
  cv.set(7, 8, IRON.dd);
  cv.set(8, 8, IRON.k);
  return cv;
}

/** Steel liner of the basin (inner walls, rows 0..3) + swatches for the faucet (row 8). */
function kitchen_sink_basin() {
  const cv = canvas(IRON.l);
  fill(cv, [0, 0, 16, 1], IRON.hi);
  fill(cv, [0, 1, 16, 2], IRON.hl);
  fill(cv, [0, 2, 16, 3], IRON.l);
  fill(cv, [0, 3, 16, 4], IRON.m);
  // faucet swatches: 0 light, 1 mid, 2 dark; tap handles 3 copper light, 4 copper mid
  const sw = [IRON.hi, IRON.l, IRON.m, COPPER.hi, COPPER.l, COPPER.m2];
  sw.forEach((c, i) => cv.set(i, 8, c));
  return cv;
}

/** Stove front: control panel with copper knobs and a dial, copper bar, oven door with a glow. */
function kitchen_stove_front() {
  const r = rng(301);
  const cv = canvas(IRON.d);
  fill(cv, [0, 0, 16, 1], IRON.k); // burner edges (y 15..16)
  fill(cv, [0, 1, 16, 2], IRON.m); // lit top edge of the body
  speckle(cv, [1, 2, 15, 15], r, [
    [0.05, IRON.dd],
    [0.03, IRON.m],
  ]);
  for (let v = 1; v < 15; v++) {
    cv.set(0, v, IRON.m);
    cv.set(15, v, IRON.dd);
  }
  // knobs (row 3) on dark sockets, a cream dial in the middle
  for (const u of [2, 4, 11, 13]) {
    cv.set(u, 3, COPPER.l);
    cv.set(u, 2, IRON.dd);
  }
  cv.set(7, 2, CREAM.l);
  cv.set(8, 2, CREAM.l);
  cv.set(7, 3, CREAM.l);
  cv.set(8, 3, CREAM.d);
  cv.set(8, 2, IRON.k); // the dial's hand
  fill(cv, [1, 4, 15, 5], COPPER.m); // copper trim band
  cv.set(1, 4, COPPER.l);
  // handle bar (cube x -6..6, y 10..11 -> u 2..14, row 5)
  fill(cv, [2, 5, 14, 6], COPPER.l);
  cv.set(2, 5, COPPER.hi);
  cv.set(13, 5, COPPER.m);
  // oven door (x -7..7, y 2..10 -> u 1..15, rows 6..13)
  raised(cv, [1, 6, 15, 14], { fillC: IRON.d, hi: IRON.l, lo: IRON.dd });
  // window rows 8..12, u 4..12: frame groove, then glass with fire light at the bottom
  sunk(cv, [3, 8, 13, 13], { fillC: FIRE.k, hi: IRON.m, lo: IRON.k });
  fill(cv, [4, 9, 12, 10], FIRE.d);
  fill(cv, [4, 10, 12, 11], FIRE.m);
  fill(cv, [4, 11, 12, 12], FIRE.l);
  for (const u of [5, 8, 10]) cv.set(u, 10, FIRE.l);
  for (const u of [5, 6, 8, 10]) cv.set(u, 11, FIRE.hi);
  cv.set(4, 9, IRON.l); // glass glint, top left
  fill(cv, [1, 14, 15, 15], IRON.dd);
  fill(cv, [0, 15, 16, 16], IRON.k); // feet
  return cv;
}

function kitchen_stove_side() {
  const r = rng(302);
  const cv = canvas(IRON.d);
  fill(cv, [0, 0, 16, 1], IRON.k);
  fill(cv, [0, 1, 16, 2], IRON.m);
  speckle(cv, [0, 2, 16, 14], r, [
    [0.05, IRON.dd],
    [0.03, IRON.m],
  ]);
  fill(cv, [0, 4, 16, 5], COPPER.m); // the trim band runs around
  // a sunk side panel with three vent slots
  sunk(cv, [3, 6, 13, 13], { fillC: IRON.d, hi: IRON.m, lo: IRON.dd });
  for (const v of [8, 10]) for (let u = 5; u < 11; u++) cv.set(u, v, IRON.k);
  for (const v of [8, 10]) cv.set(11, v, IRON.m);
  fill(cv, [0, 14, 16, 15], IRON.dd);
  fill(cv, [0, 15, 16, 16], IRON.k);
  return cv;
}

/** Cooktop: dark plate, lit front and left edges, two grates (u 2..7 v 4..9 and u 9..14 v 9..14). */
function kitchen_stove_top() {
  const r = rng(303);
  const cv = canvas(IRON.dd);
  speckle(cv, [0, 0, 16, 16], r, [
    [0.05, IRON.d],
    [0.03, IRON.k],
  ]);
  fill(cv, [0, 2, 16, 3], IRON.m); // front edge (body starts at z -6)
  for (let v = 2; v < 16; v++) cv.set(0, v, IRON.d);
  for (let v = 2; v < 16; v++) cv.set(15, v, IRON.k);
  fill(cv, [0, 15, 16, 16], IRON.k);
  for (const [u, v] of [
    [2, 4],
    [9, 9],
  ]) {
    raised(cv, [u, v, u + 5, v + 5], { fillC: IRON.k, hi: IRON.l, lo: IRON.d });
    // the grate: a cross over the dark burner, a copper flame ring hint
    for (let k = 1; k < 4; k++) {
      cv.set(u + 2, v + k, IRON.m);
      cv.set(u + k, v + 2, IRON.m);
    }
    cv.set(u + 1, v + 1, COPPER.m2);
    cv.set(u + 3, v + 3, COPPER.d);
  }
  return cv;
}

/** Upper cabinet front: crown, two glazed doors (a plate and a jar behind the glass). */
function kitchen_cabinet_front() {
  const r = rng(401);
  const cv = canvas(OAK.m);
  fill(cv, [0, 0, 16, 1], OAK.hi); // crown front
  cv.set(15, 0, OAK.l2);
  fill(cv, [0, 1, 16, 2], OAK.d4); // shadow under the crown
  for (let v = 2; v < 14; v++) {
    cv.set(0, v, OAK.l2);
    cv.set(15, v, OAK.d3);
  }
  for (const [u1, u2, item] of [
    [1, 8, "plate"],
    [8, 15, "jar"],
  ]) {
    raised(cv, [u1, 2, u2, 14], { fillC: OAK.m, hi: OAK.l1, lo: OAK.d2 });
    // glass pane rows 3..8
    sunk(cv, [u1 + 1, 3, u2 - 1, 8], { fillC: GLASS.m, hi: GLASS.l, lo: OAK.d3 });
    fill(cv, [u1 + 2, 4, u2 - 2, 7], GLASS.m);
    cv.set(u1 + 2, 4, GLASS.hi);
    if (item === "plate") {
      // a cream plate standing on its rim
      cv.set(u1 + 3, 4, CREAM.l);
      cv.set(u1 + 2, 5, CREAM.l);
      cv.set(u1 + 3, 5, CREAM.d);
      cv.set(u1 + 4, 5, CREAM.l);
      cv.set(u1 + 3, 6, CREAM.l);
    } else {
      // a little copper-lidded jar of jam
      cv.set(u1 + 3, 4, COPPER.l);
      cv.set(u1 + 2, 5, TOMATO[3]);
      cv.set(u1 + 3, 5, TOMATO[2]);
      cv.set(u1 + 2, 6, TOMATO[2]);
      cv.set(u1 + 3, 6, TOMATO[1]);
    }
    // lower raised panel rows 9..13
    raised(cv, [u1 + 1, 9, u2 - 1, 13], { fillC: OAK.l2, hi: OAK.hi, lo: OAK.m2 });
    grainV(cv, [u1 + 2, 10, u2 - 2, 12], r, OAK.m, OAK.l2, 1);
  }
  // copper knobs on the middle rail (cubes x 1..2 and -2..-1, y 7..8 -> row 8)
  cv.set(6, 8, COPPER.l);
  cv.set(9, 8, COPPER.l);
  fill(cv, [1, 14, 15, 15], OAK.d3);
  fill(cv, [0, 15, 16, 16], OAK.l2); // bottom rail front
  cv.set(15, 15, OAK.m2);
  return cv;
}

/** Cabinet side: vertical boards (works for any depth of the projected side faces). */
function kitchen_cabinet_side() {
  const r = rng(402);
  const cv = canvas(OAK.m);
  for (let b = 0; b < 4; b++) {
    const u1 = b * 4;
    fill(cv, [u1, 0, u1 + 4, 16], [OAK.m, OAK.l2, OAK.m2, OAK.m][b]);
    for (let v = 0; v < 16; v++) {
      cv.set(u1, v, OAK.l1);
      cv.set(u1 + 3, v, OAK.d2);
    }
    grainV(cv, [u1 + 1, 1, u1 + 3, 15], r, OAK.d1, OAK.m2, 2);
  }
  fill(cv, [0, 0, 16, 1], OAK.hi); // crown edge
  fill(cv, [0, 1, 16, 2], OAK.d3);
  fill(cv, [0, 14, 16, 15], OAK.d3);
  fill(cv, [0, 15, 16, 16], OAK.l2); // bottom rail
  return cv;
}

/** Spice jars: six 2×3 jar faces in a row (glass shoulder + contents), lid sides and lid tops. */
const SPICES = [
  [CHILI[3], CHILI[1]], // chili flakes
  [YELLOW[2], YELLOW[1]], // turmeric
  [LEAF[3], LEAF[1]], // dried herbs
  [SUGAR[3], SUGAR[1]], // salt
  [CARROT[3], CARROT[2]], // paprika
  ["#5a4a3c", "#3a2e26"], // pepper
];
function spice_shelf_jars() {
  const cv = deco_oak();
  SPICES.forEach(([light, dark], i) => {
    const u = 2 * i;
    cv.set(u, 0, GLASS.hi);
    cv.set(u + 1, 0, GLASS.m);
    cv.set(u, 1, light);
    cv.set(u + 1, 1, light);
    cv.set(u, 2, light);
    cv.set(u + 1, 2, dark);
    cv.set(u, 1, i === 3 ? GLASS.l : GLASS.hi); // glint on the glass, top left
    // lid side (row 4), lid top (rows 5..6)
    cv.set(u, 4, COPPER.l);
    cv.set(u + 1, 4, COPPER.m);
    cv.set(u, 5, COPPER.hi);
    cv.set(u + 1, 5, COPPER.l);
    cv.set(u, 6, COPPER.l);
    cv.set(u + 1, 6, COPPER.m);
  });
  return cv;
}

// Hanging pan geometry (front view): a round pan from three centred cubes (8×4, 6×6, 4×8, so
// 2-px chamfers), cells x -4..3, y 1..8. The back is 2 deep (z 0..2); a 1-px copper lip ring stands
// 1 px proud of it (z -1..0), so the dark iron face sits recessed inside the rim.
const PAN_ROWS = { 1: 2, 2: 3, 3: 4, 4: 4, 5: 4, 6: 4, 7: 3, 8: 2 }; // y -> half width
const inPanCell = (x, y) => PAN_ROWS[y] !== undefined && x >= -PAN_ROWS[y] && x < PAN_ROWS[y];
// a 1-px ring: cells with an outside 4-neighbour (diagonal steps meet at corners, pixel-art style)
const isRimCell = (x, y) =>
  inPanCell(x, y) &&
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ].some(([dx, dy]) => !inPanCell(x + dx, y + dy));
/** Rim cells as cubes: runs per row, merged down while a run repeats. */
function panRimCubes() {
  const runs = [];
  for (let y = 1; y <= 8; y++) {
    let x = -4;
    while (x < 4) {
      if (!isRimCell(x, y)) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < 4 && isRimCell(x, y)) x++;
      const prev = runs.find((r) => r.x0 === x0 && r.x1 === x && r.y1 === y);
      if (prev) prev.y1 = y + 1;
      else runs.push({ x0, x1: x, y0: y, y1: y + 1 });
    }
  }
  return runs.map((r, i) => [`rim_${i + 1}`, [r.x0, r.y0, -1], [r.x1, r.y1, 0]]);
}
// copper swatches in hanging_pan_side.png (row 0): 3 lit, 4 mid, 5 shadow; iron hook 0..2
const PAN_SWATCH = { lit: [3, 0, 4, 1], mid: [4, 0, 5, 1], dark: [5, 0, 6, 1] };

/** Hanging pan, front: copper lip (lit top-left, shadowed bottom-right), recessed dark iron
 *  cooking face with a soft sheen top left, the copper handle with the hook's hole. */
function hanging_pan_front() {
  const cv = canvas(COPPER.m);
  for (let y = 1; y <= 8; y++)
    for (let x = -4; x < 4; x++) {
      if (!inPanCell(x, y)) continue;
      const u = 7 - x;
      const v = 15 - y;
      const side = u - 7.5 + (v - 10.5); // < 0: top-left half
      if (isRimCell(x, y)) cv.set(u, v, side < -1 ? COPPER.l : side > 1 ? COPPER.m2 : COPPER.m);
      else cv.set(u, v, side < -1 ? IRON.m : side > 1 ? IRON.dd : IRON.d);
    }
  cv.set(6, 9, IRON.l); // sheen glint
  // handle (x -1..1, y 9..12 -> u 7..9, rows 4..6): lit left, the hook's hole at the top
  for (let v = 4; v < 7; v++) {
    cv.set(7, v, COPPER.l);
    cv.set(8, v, COPPER.m);
  }
  cv.set(7, 4, COPPER.d); // the hole the hook's stem goes through
  return cv;
}
/** Hanging pan, back: clean copper (lit top and left edge, shadow bottom and right), one ring;
 *  swatches in row 0 for the hook (iron) and the pan's edges (copper). */
function hanging_pan_side() {
  const cv = canvas(COPPER.m);
  for (let y = 1; y <= 8; y++)
    for (let x = -4; x < 4; x++) {
      if (!inPanCell(x, y)) continue;
      const u = x + 8; // south faces: u = x + 8
      const v = 15 - y;
      const up = !inPanCell(x, y + 1);
      const left = !inPanCell(x - 1, y);
      const down = !inPanCell(x, y - 1);
      const right = !inPanCell(x + 1, y);
      let c = COPPER.m;
      if (down || right) c = COPPER.m2;
      if ((up || left) && !(down || right)) c = COPPER.l;
      cv.set(u, v, c);
    }
  // one ring on the bottom of the pan, 2 px inside the edge
  for (let y = 3; y <= 6; y++)
    for (let x = -2; x < 2; x++)
      if (y === 3 || y === 6 || x === -2 || x === 1) cv.set(x + 8, 15 - y, COPPER.m2);
  // handle back (u 7..8, rows 4..6)
  for (let v = 4; v < 7; v++) {
    cv.set(7, v, COPPER.l);
    cv.set(8, v, COPPER.m2);
  }
  cv.set(0, 0, IRON.hl);
  cv.set(1, 0, IRON.m);
  cv.set(2, 0, IRON.d);
  cv.set(3, 0, COPPER.l);
  cv.set(4, 0, COPPER.m);
  cv.set(5, 0, COPPER.m2);
  return cv;
}

/** Pickle jar sides: glass, brine and two pickles, copper lid band above. */
function pickle_jar_side() {
  const cv = canvas(GLASS.m);
  // lid rows 7..8, u 6..10
  fill(cv, [6, 7, 10, 8], COPPER.l);
  fill(cv, [6, 8, 10, 9], COPPER.m);
  cv.set(6, 7, COPPER.hi);
  cv.set(9, 8, COPPER.m2);
  // shoulder row 9, u 6..10
  fill(cv, [6, 9, 10, 10], GLASS.l);
  cv.set(6, 9, GLASS.hi);
  // body rows 10..16, u 5..11: air gap, brine with two pickles and a dill sprig, thick glass base
  const BRINE = { m: "#dcd890", d: "#b2ad66" };
  const k = {
    g: GLASS.hi,
    l: GLASS.l,
    m: GLASS.m,
    d: GLASS.d,
    b: BRINE.m,
    s: BRINE.d,
    L: LEAF[3],
    4: CUKE[3],
    3: CUKE[2],
    2: CUKE[1],
    1: CUKE[0],
  };
  [
    "gllllm", // row 10
    "g3bL3s",
    "g42b2s",
    "g21b41",
    "g21b21",
    "mddddd", // row 15
  ].forEach((row, i) => [...row].forEach((ch, j) => cv.set(5 + j, 10 + i, k[ch])));
  return cv;
}
function pickle_jar_top() {
  const cv = canvas(GLASS.l);
  // the jar's shoulder ring (u 5..11, v 5..11) and the lid (u 6..10, v 6..10)
  fill(cv, [5, 5, 11, 11], GLASS.l);
  for (let u = 5; u < 11; u++) cv.set(u, 5, GLASS.hi);
  for (let v = 5; v < 11; v++) cv.set(5, v, GLASS.hi);
  raised(cv, [6, 6, 10, 10], { fillC: COPPER.m, hi: COPPER.l, lo: COPPER.m2 });
  cv.set(6, 6, COPPER.hi);
  return cv;
}

/** Basket wicker: handle twist (rows 5..10), rolled rim (row 11), weave (12..14), base (15). */
function vegetable_basket_side() {
  const cv = canvas(WICKER.m);
  for (let v = 0; v < 11; v++)
    for (let u = 0; u < 16; u++)
      cv.set(u, v, (u + v) % 3 === 0 ? WICKER.m2 : (u + v) % 3 === 1 ? WICKER.l : WICKER.m);
  for (let u = 0; u < 16; u++) cv.set(u, 11, u % 2 === 0 ? WICKER.hi : WICKER.l);
  for (let v = 12; v < 15; v++)
    for (let u = 0; u < 16; u++) {
      const brick = Math.floor((u + (v % 2) * 2) / 2) % 2 === 0;
      cv.set(u, v, brick ? (v === 12 ? WICKER.l : WICKER.m) : WICKER.m2);
    }
  for (let u = 0; u < 16; u++) cv.set(u, 15, u % 2 === 0 ? WICKER.d : WICKER.m2);
  return cv;
}
function vegetable_basket_top() {
  const r = rng(601);
  const cv = canvas(WICKER.dd);
  // inside: dark with lettuce leaves peeking between the vegetables
  speckle(cv, [3, 4, 13, 12], r, [
    [0.25, LEAF[2]],
    [0.1, LEAF[1]],
    [0.12, WICKER.d],
  ]);
  // rolled rim around the body footprint (u 2..14, v 3..13)
  for (let u = 2; u < 14; u++) {
    cv.set(u, 3, WICKER.hi);
    cv.set(u, 12, WICKER.m2);
  }
  for (let v = 3; v < 13; v++) {
    cv.set(2, v, WICKER.l);
    cv.set(13, v, WICKER.m2);
  }
  return cv;
}
/** Produce atlas: tomato, onion (+sprout), eggplant and cucumber faces. Regions in VEG_UV. */
const VEG_UV = {
  tomato: { side: [0, 0, 3, 3], up: [3, 0, 6, 3], down: [0, 0, 3, 3] },
  onion: { side: [6, 0, 9, 3], up: [9, 0, 12, 3], down: [6, 0, 9, 3] },
  green: { side: [12, 0, 13, 1], up: [12, 0, 13, 1] },
  // eggplant lies along z with its cap toward the front (north)
  eggplant: {
    west: [0, 4, 4, 7],
    east: [4, 4, 0, 7],
    north: [4, 4, 7, 7],
    south: [10, 4, 13, 7],
    up: [7, 4, 10, 8],
    down: [7, 4, 10, 8],
  },
  // cucumber lies along x
  cucumber: {
    north: [0, 8, 5, 10],
    south: [0, 8, 5, 10],
    east: [5, 8, 7, 10],
    west: [5, 8, 7, 10],
    up: [7, 8, 12, 10],
    down: [0, 8, 5, 10],
  },
};
function vegetable_basket_produce() {
  const cv = canvas(WICKER.dd);
  // tomato side: lit top-left, darker bottom-right
  const tomatoSide = [
    [TOMATO_WARM[3], TOMATO_WARM[2], TOMATO_WARM[2]],
    [TOMATO_WARM[2], TOMATO_WARM[2], TOMATO_WARM[1]],
    [TOMATO_WARM[2], TOMATO_WARM[1], TOMATO_WARM[0]],
  ];
  const tomatoTop = [
    [TOMATO_WARM[3], LEAF[2], TOMATO_WARM[2]],
    [LEAF[2], LEAF[4], LEAF[2]],
    [TOMATO_WARM[2], LEAF[2], TOMATO_WARM[1]],
  ];
  const onionSide = [
    [ONION[4], ONION[3], ONION[2]],
    [ONION[3], ONION[2], ONION[1]],
    [ONION[2], ONION[1], ONION[1]],
  ];
  const onionTop = [
    [ONION[4], ONION[3], ONION[2]],
    [ONION[3], ONION[1], ONION[2]],
    [ONION[2], ONION[2], ONION[1]],
  ];
  const put = (u0, v0, grid) =>
    grid.forEach((row, v) => row.forEach((c, u) => cv.set(u0 + u, v0 + v, c)));
  put(0, 0, tomatoSide);
  put(3, 0, tomatoTop);
  put(6, 0, onionSide);
  put(9, 0, onionTop);
  cv.set(12, 0, LEAF[3]);
  // eggplant long side (cap at u 0), front end with cap, back end, top (cap row first)
  put(0, 4, [
    [LEAF[3], EGG[4], EGG[3], EGG[3]],
    [LEAF[2], EGG[3], EGG[2], EGG[2]],
    [LEAF[2], EGG[2], EGG[1], EGG[1]],
  ]);
  put(4, 4, [
    [EGG[3], LEAF[3], EGG[2]],
    [LEAF[3], LEAF[2], LEAF[2]],
    [EGG[2], LEAF[2], EGG[1]],
  ]);
  put(10, 4, [
    [EGG[4], EGG[3], EGG[2]],
    [EGG[3], EGG[2], EGG[1]],
    [EGG[2], EGG[1], EGG[1]],
  ]);
  put(7, 4, [
    [LEAF[3], LEAF[2], LEAF[2]],
    [EGG[4], EGG[3], EGG[2]],
    [EGG[3], EGG[3], EGG[2]],
    [EGG[3], EGG[2], EGG[2]],
  ]);
  // cucumber long side, ends, top
  put(0, 8, [
    [CUKE[3], CUKE[4], CUKE[3], CUKE[4], CUKE[3]],
    [CUKE[1], CUKE[2], CUKE[1], CUKE[1], CUKE[0]],
  ]);
  put(5, 8, [
    [CUKE[3], CUKE[2]],
    [CUKE[2], CUKE[1]],
  ]);
  put(7, 8, [
    [CUKE[4], CUKE[3], CUKE[4], CUKE[3], CUKE[3]],
    [CUKE[3], CUKE[2], CUKE[2], CUKE[2], CUKE[1]],
  ]);
  return cv;
}

// ===================================================================================== models
// Each block: cubes, a classify default, textures by material, collision/selection box (block JSON
// mirrors these; see tests/deco-blocks.test.ts).
const SHARED_TEX = { deco_oak };

const BLOCKS = {
  kitchen_counter: () => {
    const top = { up: "top", down: "top", north: "front", default: "*" };
    const body = { north: "front", default: "*" };
    return {
      cubes: [
        cube("countertop", [-8, 14, -8], [8, 16, 8], top),
        cube("carcass", [-8, 0, -6], [8, 14, 8], body),
        extrude(cube("drawer", [-7, 10, -7], [7, 13, -6]), "front"),
        extrude(cube("door_left", [0, 2, -7], [7, 9, -6]), "front"),
        extrude(cube("door_right", [-7, 2, -7], [0, 9, -6]), "front"),
        extrude(cube("pull", [-2, 11, -8], [2, 12, -7]), "front"),
        extrude(cube("knob_left", [1, 5, -8], [2, 6, -7]), "front"),
        extrude(cube("knob_right", [-2, 5, -8], [-1, 6, -7]), "front"),
      ],
      textures: {
        "*": "kitchen_counter_side",
        front: "kitchen_counter_front",
        top: "kitchen_counter_top",
      },
    };
  },

  kitchen_sink: () => {
    const stone = (n, from, to) =>
      cube(n, from, to, { up: "top", down: "top", north: "front", default: "*" });
    const wall = (n, from, to) => cube(n, from, to, { north: "front", default: "*" });
    const cubes = [
      cube("carcass", [-8, 0, -6], [8, 12, 8], { north: "front", default: "*" }),
      wall("wall_front", [-8, 12, -6], [8, 14, -4]),
      wall("wall_back", [-8, 12, 4], [8, 14, 8]),
      wall("wall_left", [5, 12, -4], [8, 14, 4]),
      wall("wall_right", [-8, 12, -4], [-5, 14, 4]),
      stone("top_front", [-8, 14, -8], [8, 16, -4]),
      stone("top_back", [-8, 14, 4], [8, 16, 8]),
      stone("top_left", [5, 14, -4], [8, 16, 4]),
      stone("top_right", [-8, 14, -4], [-5, 16, 4]),
      cube("water", [-5, 12, -4], [5, 13, 4], { up: "top", default: "basin" }),
      extrude(cube("false_front", [-7, 10, -7], [7, 12, -6]), "front"),
      extrude(cube("door_left", [0, 2, -7], [7, 9, -6]), "front"),
      extrude(cube("door_right", [-7, 2, -7], [0, 9, -6]), "front"),
      extrude(cube("knob_left", [1, 5, -8], [2, 6, -7]), "front"),
      extrude(cube("knob_right", [-2, 5, -8], [-1, 6, -7]), "front"),
      extrude(cube("towel", [3, 5, -8], [6, 9, -7]), "front"),
      // faucet on the back of the counter, spout over the basin; two copper taps
      swatch(cube("faucet_base", [-1, 16, 5], [1, 17, 7]), "basin", {
        up: [0, 8],
        side: [1, 8],
        down: [2, 8],
      }),
      swatch(cube("faucet_riser", [-1, 17, 5], [1, 20, 6]), "basin", {
        up: [0, 8],
        side: [1, 8],
        down: [2, 8],
      }),
      swatch(cube("faucet_spout", [-1, 19, 1], [1, 20, 5]), "basin", {
        up: [0, 8],
        side: [1, 8],
        down: [2, 8],
      }),
      swatch(cube("faucet_tip", [-1, 18, 1], [1, 19, 2]), "basin", {
        up: [0, 8],
        side: [2, 8],
        down: [2, 8],
      }),
      swatch(cube("tap_left", [3, 16, 5], [4, 17, 6]), "basin", {
        up: [3, 8],
        side: [4, 8],
        down: [5, 8],
      }),
      swatch(cube("tap_right", [-4, 16, 5], [-3, 17, 6]), "basin", {
        up: [3, 8],
        side: [4, 8],
        down: [5, 8],
      }),
    ];
    // the basin's inner faces (pointing into the hole) are the steel liner
    const inner = {
      wall_front: "south",
      top_front: "south",
      wall_back: "north",
      top_back: "north",
      wall_left: "west",
      top_left: "west",
      wall_right: "east",
      top_right: "east",
    };
    for (const c of cubes) if (inner[c.name]) c.mats[inner[c.name]] = "basin";
    return {
      cubes,
      textures: {
        "*": "kitchen_counter_side",
        front: "kitchen_sink_front",
        top: "kitchen_sink_top",
        basin: "kitchen_sink_basin",
      },
    };
  },

  kitchen_stove: () => {
    const body = { north: "front", up: "top", default: "*" };
    const grate = { north: "front", up: "top", default: "*" };
    return {
      cubes: [
        cube("body", [-8, 1, -6], [8, 15, 8], body),
        cube("foot_fl", [6, 0, -6], [8, 1, -4], body),
        cube("foot_fr", [-8, 0, -6], [-6, 1, -4], body),
        cube("foot_bl", [6, 0, 6], [8, 1, 8], body),
        cube("foot_br", [-8, 0, 6], [-6, 1, 8], body),
        cube("grate_front", [-6, 15, -4], [-1, 16, 1], grate),
        cube("grate_back", [1, 15, 1], [6, 16, 6], grate),
        extrude(cube("door", [-7, 2, -7], [7, 10, -6]), "front"),
        extrude(cube("bar", [-6, 10, -8], [6, 11, -7]), "front"),
        extrude(cube("bar_post_left", [5, 10, -7], [6, 11, -6]), "front"),
        extrude(cube("bar_post_right", [-6, 10, -7], [-5, 11, -6]), "front"),
        ...[6, 4, -3, -5].map((x, i) =>
          extrude(cube(`knob_${i + 1}`, [x - 1, 12, -7], [x, 13, -6]), "front"),
        ),
      ],
      textures: {
        "*": "kitchen_stove_side",
        front: "kitchen_stove_front",
        top: "kitchen_stove_top",
      },
    };
  },

  kitchen_cabinet: () => {
    const trim = { up: "oak", down: "oak", north: "front", default: "*" };
    return {
      cubes: [
        cube("crown", [-8, 15, -3], [8, 16, 8], trim),
        cube("carcass", [-8, 1, -2], [8, 15, 8], { north: "front", default: "*" }),
        cube("bottom", [-8, 0, -3], [8, 1, 8], trim),
        extrude(cube("door_left", [0, 2, -3], [7, 14, -2]), "front"),
        extrude(cube("door_right", [-7, 2, -3], [0, 14, -2]), "front"),
        extrude(cube("knob_left", [1, 7, -4], [2, 8, -3]), "front"),
        extrude(cube("knob_right", [-2, 7, -4], [-1, 8, -3]), "front"),
      ],
      textures: {
        "*": "kitchen_cabinet_side",
        front: "kitchen_cabinet_front",
        oak: "deco_oak",
      },
    };
  },

  spice_shelf: () => {
    const wood = (n, from, to) => cube(n, from, to, { default: "*" });
    const jars = [];
    const xs = [4, 0, -4]; // jar centres, viewer-left to right (x is mirrored on the front)
    [1, 7].forEach((y, row) =>
      xs.forEach((x, k) => {
        const i = row * 3 + k;
        const u = 2 * i;
        jars.push(
          regions(cube(`jar_${i + 1}`, [x - 1, y, 4], [x + 1, y + 3, 6]), "jars", {
            side: [u, 0, u + 2, 3],
            up: [u, 5, u + 2, 7],
            down: [u, 5, u + 2, 7],
          }),
          regions(cube(`lid_${i + 1}`, [x - 1, y + 3, 4], [x + 1, y + 4, 6]), "jars", {
            side: [u, 4, u + 2, 5],
            up: [u, 5, u + 2, 7],
            down: [u, 5, u + 2, 7],
          }),
        );
      }),
    );
    return {
      cubes: [
        wood("side_left", [6, 0, 3], [7, 12, 8]),
        wood("side_right", [-7, 0, 3], [-6, 12, 8]),
        wood("top", [-7, 12, 2], [7, 13, 8]),
        wood("shelf_middle", [-6, 6, 3], [6, 7, 8]),
        wood("shelf_bottom", [-6, 0, 3], [6, 1, 8]),
        wood("back", [-6, 1, 7], [6, 12, 8]),
        ...jars,
      ],
      textures: { "*": "deco_oak", jars: "spice_shelf_jars" },
    };
  },

  hanging_pan: () => {
    const hook = { up: [0, 0], side: [1, 0], down: [2, 0] };
    // copper parts: front projected (hanging_pan_front), back projected (the side texture's
    // back view), every edge face a clean swatch
    const copper = (name, from, to) => {
      const c = cube(name, from, to);
      c.mats = { north: "front", default: "*" };
      c.uvs = {
        north: frontRect(c),
        south: projectUv("south", from, to),
        up: PAN_SWATCH.lit,
        east: PAN_SWATCH.lit,
        west: PAN_SWATCH.mid,
        down: PAN_SWATCH.dark,
      };
      return c;
    };
    return {
      cubes: [
        // inverted-J hook: a stub into the ceiling, down the stem into the handle's hole,
        // over 1 and down 1 for the open tip
        swatch(cube("hook_stub", [0, 15, 0], [1, 16, 1]), "*", hook),
        swatch(cube("hook_stem", [0, 12, 0], [1, 15, 1]), "*", hook),
        swatch(cube("hook_bend", [1, 14, 0], [3, 15, 1]), "*", hook),
        swatch(cube("hook_tip", [2, 13, 0], [3, 14, 1]), "*", hook),
        copper("handle", [-1, 9, 0], [1, 12, 1]),
        copper("pan_wide", [-4, 3, 0], [4, 7, 2]),
        copper("pan_mid", [-3, 2, 0], [3, 8, 2]),
        copper("pan_tall", [-2, 1, 0], [2, 9, 2]),
        ...panRimCubes().map(([n, from, to]) => copper(n, from, to)),
      ],
      textures: { "*": "hanging_pan_side", front: "hanging_pan_front" },
    };
  },

  pickle_jar: () => {
    const m = { up: "top", down: "top", default: "*" };
    return {
      cubes: [
        cube("jar", [-3, 0, -3], [3, 6, 3], m),
        cube("shoulder", [-2, 6, -2], [2, 7, 2], m),
        cube("lid", [-2, 7, -2], [2, 9, 2], m),
      ],
      textures: { "*": "pickle_jar_side", top: "pickle_jar_top" },
    };
  },

  vegetable_basket: () => {
    const basket = { up: "top", default: "*" };
    const veg = (n, kind, from, to) => regions(cube(n, from, to), "produce", VEG_UV[kind]);
    return {
      cubes: [
        cube("basket", [-6, 0, -5], [6, 5, 5], basket),
        cube("handle_post_left", [5, 5, -1], [6, 10, 1], { default: "*" }),
        cube("handle_post_right", [-6, 5, -1], [-5, 10, 1], { default: "*" }),
        cube("handle_bar", [-6, 10, -1], [6, 11, 1], { default: "*" }),
        veg("tomato_1", "tomato", [-5, 4, -4], [-2, 7, -1]),
        veg("onion", "onion", [-2, 4, -4], [1, 7, -1]),
        veg("onion_sprout", "green", [-1, 7, -3], [0, 9, -2]),
        veg("tomato_2", "tomato", [1, 4, -4], [4, 7, -1]),
        veg("cucumber", "cucumber", [-5, 4, 1], [0, 6, 3]),
        veg("eggplant", "eggplant", [1, 4, 0], [4, 7, 4]),
        veg("eggplant_cap", "green", [2, 5, -1], [3, 6, 0]),
      ],
      textures: {
        "*": "vegetable_basket_side",
        top: "vegetable_basket_top",
        produce: "vegetable_basket_produce",
      },
    };
  },
};

const DRAW = {
  deco_oak,
  kitchen_counter_front,
  kitchen_counter_side,
  kitchen_counter_top,
  kitchen_sink_front,
  kitchen_sink_top,
  kitchen_sink_basin,
  kitchen_stove_front,
  kitchen_stove_side,
  kitchen_stove_top,
  kitchen_cabinet_front,
  kitchen_cabinet_side,
  spice_shelf_jars,
  hanging_pan_front,
  hanging_pan_side,
  pickle_jar_side,
  pickle_jar_top,
  vegetable_basket_side,
  vegetable_basket_top,
  vegetable_basket_produce,
};

/** Where a texture lives in art/: block-specific ones in the block's folder, shared in kitchen_deco/. */
function texFile(name) {
  const owner = SHARED_TEX[name]
    ? "kitchen_deco"
    : Object.keys(BLOCKS).find((b) => name.startsWith(b));
  if (!owner) throw new Error(`no owner for texture ${name}`);
  return path.join(MODELS, owner, "textures", `${name}.png`);
}

/** Builds a block: classified faces, hidden faces dropped. */
export function buildBlock(id) {
  const spec = BLOCKS[id]();
  const bones = [{ name: id, color: 1, cubes: spec.cubes }];
  finalizeFaces(
    bones,
    (face, c) => c.mats[face] ?? c.mats.default ?? "*",
    () => spec.cubes,
  );
  return { id, bones, textures: spec.textures };
}

export const DECO_IDS = Object.keys(BLOCKS);
export const TEXTURE_NAMES = Object.keys(DRAW);
/** For tests and the block JSON: the material -> texture name map of each block. */
export function materialsOf(id) {
  return BLOCKS[id]().textures;
}

function pngBytes(cv) {
  const tmp = path.join(SHARED, ".tmp.png");
  savePng(tmp, cv);
  const b = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  return b;
}

function writeTextures() {
  const out = {};
  for (const [name, draw] of Object.entries(DRAW)) {
    const file = texFile(name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    savePng(file, draw());
    out[name] = file;
  }
  return out;
}

function writeModels(texFiles) {
  for (const id of DECO_IDS) {
    const { bones, textures } = buildBlock(id);
    const mats = Object.keys(textures);
    const dir = path.join(MODELS, id);
    fs.mkdirSync(path.join(dir, "renders"), { recursive: true });
    writeBbmodel(path.join(dir, `${id}.bbmodel`), {
      name: `hk_${id}`,
      identifier: `hk.${id}`,
      bones,
      textures: mats.map((m) => ({ name: textures[m], file: texFiles[textures[m]] })),
      matToTex: Object.fromEntries(mats.map((m, i) => [m, i])),
    });
  }
}

// --------------------------------------------------------------------------------- group scene
/** Offsets a .bbmodel's elements and appends them (with their textures) to a combined model. */
function appendBbmodel(target, file, [ox, oy, oz], label) {
  const src = JSON.parse(fs.readFileSync(file, "utf8"));
  const texBase = target.textures.length;
  for (const t of src.textures)
    target.textures.push({ ...t, id: String(target.textures.length), uuid: crypto.randomUUID() });
  const children = [];
  for (const e of src.elements) {
    const el = structuredClone(e);
    el.uuid = crypto.randomUUID();
    el.from = [e.from[0] + ox, e.from[1] + oy, e.from[2] + oz];
    el.to = [e.to[0] + ox, e.to[1] + oy, e.to[2] + oz];
    el.origin = [(e.origin?.[0] ?? 0) + ox, (e.origin?.[1] ?? 0) + oy, (e.origin?.[2] ?? 0) + oz];
    for (const f of Object.values(el.faces))
      if (f.texture !== null && f.texture !== undefined) f.texture = f.texture + texBase;
    target.elements.push(el);
    children.push(el.uuid);
  }
  const gid = crypto.randomUUID();
  target.groups.push({
    name: label,
    uuid: gid,
    export: true,
    origin: [ox, oy, oz],
    rotation: [0, 0, 0],
    children: [],
    visibility: true,
  });
  target.outliner.push({ uuid: gid, isOpen: false, children });
}

/** A little kitchen: counters, sink and stove in a row, cabinets above, the pot and board placed. */
function writeGroupScene() {
  const scene = JSON.parse(
    fs.readFileSync(path.join(MODELS, "kitchen_counter/kitchen_counter.bbmodel"), "utf8"),
  );
  Object.assign(scene, {
    name: "hk_kitchen_group",
    model_identifier: "hk.kitchen_group",
    elements: [],
    groups: [],
    outliner: [],
    textures: [],
  });
  const B = 16;
  const at = (x, y, z) => [x * B, y * B, z * B];
  const place = [
    ["kitchen_counter", at(-2, 0, 0)],
    ["spice_shelf", at(-2, 1, 0)],
    ["kitchen_cabinet", at(-2, 2, 0)],
    ["kitchen_sink", at(-1, 0, 0)],
    ["kitchen_cabinet", at(-1, 2, 0)],
    ["kitchen_stove", at(0, 0, 0)],
    ["cooking_pot", at(0, 1, 0)],
    ["kitchen_counter", at(1, 0, 0)],
    ["hanging_pan", at(1, 1, 0)],
    ["kitchen_cabinet", at(1, 2, 0)],
    ["kitchen_counter", at(2, 0, 0)],
    ["pickle_jar", at(2, 1, 0)],
    ["kitchen_counter", at(3, 0, 0)],
    ["cutting_board", at(3, 1, 0)],
    ["vegetable_basket", at(2, 0, -1)],
  ];
  // x runs the other way on the front (u = 8 - x), so negate to read left-to-right from the front
  for (const [id, [x, y, z]] of place)
    appendBbmodel(scene, path.join(MODELS, id, `${id}.bbmodel`), [-x, y, z], id);
  fs.mkdirSync(path.join(SHARED, "renders"), { recursive: true });
  const file = path.join(SHARED, "kitchen_group.bbmodel");
  fs.writeFileSync(file, JSON.stringify(scene, null, 2));
  return file;
}

// ------------------------------------------------------------------------------- install/check
function install() {
  fs.mkdirSync(PACK_TEX, { recursive: true });
  for (const name of TEXTURE_NAMES)
    fs.copyFileSync(texFile(name), path.join(PACK_TEX, `${name}.png`));
  for (const id of DECO_IDS) {
    const geo = path.join(MODELS, id, `${id}.geo.json`);
    if (fs.existsSync(geo)) fs.copyFileSync(geo, path.join(PACK_GEO, `${id}.geo.json`));
    else console.warn(`no ${path.relative(ROOT, geo)} yet (run --export)`);
  }
}

function check() {
  const bad = [];
  for (const [name, draw] of Object.entries(DRAW)) {
    const want = pngBytes(draw());
    for (const file of [texFile(name), path.join(PACK_TEX, `${name}.png`)])
      if (!fs.existsSync(file) || !fs.readFileSync(file).equals(want))
        bad.push(path.relative(ROOT, file));
  }
  for (const id of DECO_IDS) {
    const a = path.join(MODELS, id, `${id}.geo.json`);
    const b = path.join(PACK_GEO, `${id}.geo.json`);
    if (!fs.existsSync(a) || !fs.existsSync(b) || !fs.readFileSync(a).equals(fs.readFileSync(b)))
      bad.push(path.relative(ROOT, b));
  }
  if (bad.length) {
    console.error(
      `out of date (run make-kitchen-deco.mjs --export, or --install):\n  ${bad.join("\n  ")}`,
    );
    process.exit(1);
  }
  console.log(`${TEXTURE_NAMES.length} deco textures and ${DECO_IDS.length} geos up to date`);
}

function exportAll() {
  const tool = path.join(import.meta.dirname, "bb-export.mjs");
  const run = (args) =>
    console.log(execFileSync(process.execPath, [tool, ...args], { encoding: "utf8" }).trim());
  for (const id of DECO_IDS) {
    const dir = path.join(MODELS, id);
    run([
      path.join(dir, `${id}.bbmodel`),
      "--geo",
      path.join(dir, `${id}.geo.json`),
      "--render",
      path.join(dir, "renders", id),
      "--views",
      "3q_nw,3q_ne,3q_sw",
    ]);
  }
  // the repo keeps geo files in prettier style (install copies these byte for byte)
  execFileSync(
    path.join(ROOT, "node_modules/.bin/prettier"),
    ["--write", ...DECO_IDS.map((id) => path.join(MODELS, id, `${id}.geo.json`))],
    { stdio: "ignore" },
  );
  const group = writeGroupScene();
  run([
    group,
    "--render",
    path.join(SHARED, "renders/kitchen_group"),
    "--views",
    "3q_nw,3q_ne,front",
    "--size",
    "1400",
  ]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--check")) check();
  else {
    const tex = writeTextures();
    writeModels(tex);
    if (process.argv.includes("--export")) exportAll();
    if (process.argv.includes("--install") || process.argv.includes("--export")) install();
    console.log(`wrote ${TEXTURE_NAMES.length} textures and ${DECO_IDS.length} models`);
  }
}
