// Recipe poster mockups (D15), for the user and the plan:
//
//   node art/harvest_kitchen/mockups/poster_mockups.mjs
//
// - poster_tomato_soup.png: the Tomato Soup poster exactly as the block textures carry it (both
//   64×64 halves side by side), scaled ×6 with hard pixels;
// - poster_on_wall.png: a front view, screenshot-like: the poster on a stone brick wall next to a
//   copper pot over a campfire, everything at the poster's 64 texels per block, so the 16 px world
//   textures show how much finer the poster is. The pot is our S8 model (cooking_pot.geo.json),
//   projected from the front; the wall, floor and campfire are drawn here from our palette.
//
// The poster comes from tools/gen-posters.mjs (renderAll), the same render the game textures come
// from, so the mockup can't drift from what ships.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodePng } from "../../../tools/gen-textures.mjs";
import { TEXELS_PER_BLOCK, encodeIndexedPng, renderAll, upscale } from "../../../tools/gen-posters.mjs"; // prettier-ignore

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ART = path.join(HERE, "..");
const ROOT = path.join(ART, "../..");
const PALETTE = JSON.parse(readFileSync(path.join(ART, "palette.json"))).ramps;
const B = TEXELS_PER_BLOCK; // screen px per block in the scene
const PX = B / 16; // screen px per world pixel (16 px textures)

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(255);
const ramp = (name) => PALETTE[name].shades.map(hex);

function img(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

function put(im, x, y, c) {
  if (x < 0 || y < 0 || x >= im.w || y >= im.h || !c || c[3] === 0) return;
  im.px.set(c, (y * im.w + x) * 4);
}

function rect(im, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) put(im, i, j, c);
}

function get(im, x, y) {
  const i = (y * im.w + x) * 4;
  return [...im.px.subarray(i, i + 4)];
}

const shade = (c, f) => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f), c[3]];

/** A 16×16 texture drawn per world pixel by `fn(x, y)`. */
function texture(fn) {
  const t = img(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(t, x, y, fn(x, y));
  return t;
}

/** Draws a 16 px texture as one block at block coordinates (bx, by), with a light factor. */
function block(im, tex, bx, by, light = 1) {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) rect(im, bx * B + x * PX, by * B + y * PX, PX, PX, shade(get(tex, x, y), light)); // prettier-ignore
}

// --- world textures (our palette, no vanilla files) ----------------------------------------------

const IRON = ramp("iron");
const stoneBricks = texture((x, y) => {
  const row = Math.floor(y / 8);
  const seamX = row === 0 ? 0 : 8;
  if (y % 8 === 7 || (x + 16 - seamX) % 16 === 15) return IRON[0];
  if (y % 8 === 0 || (x + 16 - seamX) % 16 === 0) return IRON[2];
  return (x * 7 + y * 13) % 11 === 0 ? IRON[0] : IRON[1];
});

const WOOD = ramp("wood");
const planks = texture((x, y) => {
  if (y % 4 === 3) return WOOD[0];
  if ((x + (Math.floor(y / 4) % 2) * 8) % 16 === 0) return WOOD[1];
  return (x * 5 + y * 3) % 9 === 0 ? WOOD[2] : WOOD[3];
});

const BARK = ramp("bark");
const FIRE = ramp("fire");
const campfire = texture((x, y) => {
  // two crossed logs, 7 px tall like the vanilla campfire, flames out of the middle
  if (y >= 11) return y === 11 || x % 8 === 0 || x === 15 ? BARK[0] : y === 12 ? BARK[3] : BARK[2];
  if (y >= 9 && (x < 2 || x > 13)) return BARK[1];
  const mid = Math.abs(x - 7.5);
  const top = 1 + mid * 1.3 + (x % 3);
  if (y < top || mid > 5.5) return undefined;
  if (mid < 2 && y > 6) return FIRE[4];
  return y > 6 ? FIRE[3] : y > 3 ? FIRE[2] : FIRE[1];
});

/** The S8 pot from the front (its south faces), one block at (bx, by). */
function pot(im, bx, by) {
  const geo = JSON.parse(readFileSync(path.join(ART, "models/cooking_pot/cooking_pot.geo.json")))[
    "minecraft:geometry"
  ][0];
  const side = decodePng(readFileSync(path.join(ART, "models/cooking_pot/textures/cooking_pot_side.png"))); // prettier-ignore
  const cubes = geo.bones
    .filter((b) => b.name === "body" || b.name === "handles")
    .flatMap((b) => b.cubes)
    .filter((c) => c.uv.south)
    .sort((a, b) => a.origin[2] + a.size[2] - (b.origin[2] + b.size[2])); // far ones first
  for (const c of cubes) {
    const { uv, uv_size: size } = c.uv.south;
    for (let j = 0; j < c.size[1]; j++)
      for (let i = 0; i < c.size[0]; i++) {
        const u = uv[0] + Math.floor((i * size[0]) / c.size[0]);
        const v = uv[1] + Math.floor((j * size[1]) / c.size[1]);
        const wx = c.origin[0] + 8 + i; // model x -8..8 -> 0..16
        const wy = 16 - (c.origin[1] + c.size[1]) + j; // model y up -> screen down
        rect(im, bx * B + wx * PX, by * B + wy * PX, PX, PX, shade(get(side, u, v), 0.9));
      }
  }
}

// --- the scene -----------------------------------------------------------------------------------

function wallScene(poster) {
  const cols = 6;
  const rows = 4;
  const im = img(cols * B, rows * B);
  for (let by = 0; by < rows - 1; by++)
    for (let bx = 0; bx < cols; bx++) block(im, stoneBricks, bx, by, by === 0 ? 0.85 : 0.95);
  for (let bx = 0; bx < cols; bx++) block(im, planks, bx, rows - 1, 0.8);
  // the poster: blocks 1-2 of row 1, 1 px proud of the wall (a shadow line under and right of it)
  const ox = 1 * B;
  const oy = 1 * B;
  rect(im, ox + PX, oy + B, 2 * B, PX, shade(IRON[0], 0.7));
  rect(im, ox + 2 * B, oy + PX, PX, B, shade(IRON[0], 0.7));
  for (let y = 0; y < poster.h; y++)
    for (let x = 0; x < poster.w; x++) put(im, ox + x, oy + y, get(poster, x, y));
  // the pot over a campfire, in front of the wall
  block(im, campfire, 4, 2);
  pot(im, 4, 1);
  // a crosshair, so it reads as a screenshot (white with a dark edge, like the game's)
  const cx = ox + B; // looking at the middle of the poster
  const cy = oy + 36; // just under the arrow
  rect(im, cx - 7, cy - 2, 15, 4, [40, 40, 40, 255]);
  rect(im, cx - 2, cy - 7, 4, 15, [40, 40, 40, 255]);
  rect(im, cx - 6, cy - 1, 13, 2, [235, 235, 235, 255]);
  rect(im, cx - 1, cy - 6, 2, 13, [235, 235, 235, 255]);
  return im;
}

async function main() {
  const { posters } = await renderAll();
  const soup = posters.find((p) => p.stem === "tomato_soup");
  if (!soup) throw new Error("no tomato_soup poster");
  const out = (name, im, scale) => {
    writeFileSync(path.join(HERE, name), encodeIndexedPng(upscale(im, scale)));
    console.log(`[poster_mockups] wrote ${path.relative(ROOT, path.join(HERE, name))}`);
  };
  out("poster_tomato_soup.png", soup.image, 6);
  out("poster_on_wall.png", wallScene(soup.image), 2);
}

await main();
