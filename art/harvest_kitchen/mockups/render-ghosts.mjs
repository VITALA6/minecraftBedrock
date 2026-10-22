// Harvest Kitchen: mockups of the ghost ingredients above the pot (decision D15).
//
//   node art/harvest_kitchen/mockups/render-ghosts.mjs
//
// Writes, next to this script:
//   ghost_ingredients.png  the copper pot over a lit campfire holding 1 onion + bread: Onion Soup
//                          still needs 1 more onion and a bowl, so those two float above it as
//                          semi-transparent bobbing ghosts (one ghost per missing item)
//   ghost_ready.png        the same pot with 2 onions, bread and a bowl: ready to cook, so the
//                          Onion Soup icon floats above it with gold sparkles
//
// A tiny software renderer, plain Node: the S8 pot model (cooking_pot.geo.json) with its own
// textures (models/cooking_pot/textures + the generated liquid colours) in an orthographic 3/4
// view with Minecraft-style face shading, over a simple campfire and a plank floor drawn from
// palette.json. Each world texel is K screen pixels; the result is scaled ×UP nearest-neighbour,
// like a screenshot. The ghosts are drawn from the real particle atlas
// (packs/harvest_kitchen/resource/textures/hk/particle/ghost_atlas.png) at the particle's size,
// alpha and bob, so the mockup shows what tools/gen-ghost-atlas.mjs ships. Deterministic.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { decodePng, encodePng } from "../../../tools/gen-textures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const ART = path.join(ROOT, "art/harvest_kitchen");
const POT_DIR = path.join(ART, "models/cooking_pot");
const PALETTE = JSON.parse(readFileSync(path.join(ART, "palette.json"))).ramps;

const W = 200;
const H = 224;
const K = 5; // screen px per world texel (1/16 block)
const UP = 3; // final upscale
const YAW = (35 * Math.PI) / 180; // camera south-east of the pot, looking north-west
const PITCH = (30 * Math.PI) / 180;

// The pack's own numbers (ghost size, height, spacing, alpha, bob) and atlas layout.
async function loadData() {
  const s = "./packs/harvest_kitchen/scripts";
  const result = await build({
    stdin: {
      contents: [
        `export * from "${s}/config";`,
        `export { GHOST_ATLAS, ghostIconIndex, GHOST_STAR } from "${s}/data/ghost-atlas";`,
        `export { ghostsFor } from "${s}/stations/ghost-logic";`,
        `export { stationById } from "${s}/data/stations";`,
        `export { fillLevel } from "${s}/stations/station-logic";`,
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
// Images
// ---------------------------------------------------------------------------------------------

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ramp = (name) => PALETTE[name].shades.map(hex);
const load = (file) => decodePng(readFileSync(file));

function img(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}

/** Deterministic noise in [0, 1) for procedural textures. */
function noise(x, y, seed) {
  let n = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function texture(w, h, fn) {
  const im = img(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      if (c) im.px.set([...c.slice(0, 3), c[3] ?? 255], (y * w + x) * 4);
    }
  }
  return im;
}

const pick = (shades, t) => shades[Math.max(0, Math.min(shades.length - 1, Math.floor(t)))];

// Procedural world textures from the palette (our colours, no vanilla files).
const BARK = ramp("bark");
const WOOD = ramp("wood");
const FIRE = ramp("fire");

// a plank floor (a kitchen), calmer than grass behind the ghosts
const planks = texture(16, 16, (x, y) => {
  const seam = y % 4 === 3 || (x === ((y >> 2) * 5 + 3) % 16 && y % 4 !== 3);
  return seam ? WOOD[0] : pick(WOOD, 1.6 + noise(x >> 1, y, 1) * 2.6);
});
const logSide = texture(16, 16, (x, y) => pick(BARK, (x % 4 === 0 ? 0.5 : 1.6) + noise(x, y, 5) * 2.4)); // prettier-ignore
const logEnd = texture(16, 16, (x, y) => {
  const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
  return r > 6 ? pick(BARK, 1 + noise(x, y, 6) * 2) : pick(WOOD, 1 + (Math.round(r) % 2) * 2);
});
const flame = texture(16, 16, (x, y) => {
  // a soft tongue of fire, wider at the bottom, with a bright core
  const cx = 7.5 + Math.sin(y * 0.9) * 1.2;
  const half = 1 + (y / 15) * 5.5;
  const d = Math.abs(x - cx) / half;
  if (d > 1 || noise(x, y, 7) > 0.35 + (y / 15) * 0.9) return null;
  return pick(FIRE, 4.6 - d * 2.2 - (1 - y / 15) * 2.2);
});

// ---------------------------------------------------------------------------------------------
// The renderer: orthographic, z-buffered, textured axis-aligned quads
// ---------------------------------------------------------------------------------------------

const DIR = [-Math.sin(YAW) * Math.cos(PITCH), -Math.sin(PITCH), -Math.cos(YAW) * Math.cos(PITCH)];
const RIGHT = [Math.cos(YAW), 0, -Math.sin(YAW)];
const UPV = [
  RIGHT[1] * DIR[2] - RIGHT[2] * DIR[1],
  RIGHT[2] * DIR[0] - RIGHT[0] * DIR[2],
  RIGHT[0] * DIR[1] - RIGHT[1] * DIR[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function makeScene(cx, cy) {
  return { color: img(W, H), depth: new Float64Array(W * H).fill(Infinity), cx, cy };
}

function project(scene, p) {
  return [scene.cx + K * dot(p, RIGHT), scene.cy - K * dot(p, UPV), dot(p, DIR)];
}

/**
 * One textured parallelogram: corner o, edges a (texture u) and b (texture v), uv rect
 * [u0, v0, uw, vh] in texels (negative sizes flip). `shade` darkens; `twoSided` skips culling.
 */
function quad(scene, tex, o, a, b, uv, shade, normal, twoSided = false) {
  if (!twoSided && dot(normal, DIR) >= 0) return;
  const p0 = project(scene, o);
  const pa = project(scene, [o[0] + a[0], o[1] + a[1], o[2] + a[2]]);
  const pb = project(scene, [o[0] + b[0], o[1] + b[1], o[2] + b[2]]);
  const ax = pa[0] - p0[0];
  const ay = pa[1] - p0[1];
  const bx = pb[0] - p0[0];
  const by = pb[1] - p0[1];
  const det = ax * by - ay * bx;
  if (Math.abs(det) < 1e-9) return;
  const xs = [p0[0], pa[0], pb[0], pa[0] + bx];
  const ys = [p0[1], pa[1], pb[1], pa[1] + by];
  const [u0, v0, uw, vh] = uv;
  for (
    let y = Math.max(0, Math.floor(Math.min(...ys)));
    y <= Math.min(H - 1, Math.ceil(Math.max(...ys)));
    y++
  ) {
    for (
      let x = Math.max(0, Math.floor(Math.min(...xs)));
      x <= Math.min(W - 1, Math.ceil(Math.max(...xs)));
      x++
    ) {
      const dx = x + 0.5 - p0[0];
      const dy = y + 0.5 - p0[1];
      const s = (dx * by - dy * bx) / det;
      const t = (ax * dy - ay * dx) / det;
      if (s < 0 || s >= 1 || t < 0 || t >= 1) continue;
      const depth = p0[2] + s * (pa[2] - p0[2]) + t * (pb[2] - p0[2]);
      const i = y * W + x;
      if (depth >= scene.depth[i]) continue;
      const tu = Math.floor(Math.min(u0, u0 + uw) + (uw < 0 ? 1 - s : s) * Math.abs(uw));
      const tv = Math.floor(Math.min(v0, v0 + vh) + (vh < 0 ? 1 - t : t) * Math.abs(vh));
      const k = ((((tv % tex.h) + tex.h) % tex.h) * tex.w + (((tu % tex.w) + tex.w) % tex.w)) * 4;
      if (tex.px[k + 3] < 128) continue;
      scene.depth[i] = depth;
      for (let c = 0; c < 3; c++) scene.color.px[i * 4 + c] = Math.round(tex.px[k + c] * shade);
      scene.color.px[i * 4 + 3] = 255;
    }
  }
}

const SHADE = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.62, west: 0.62 };

/** An axis-aligned cube, Bedrock geometry style: origin, size, per-face {tex, uv}. */
function cube(scene, origin, size, faces) {
  const [x0, y0, z0] = origin;
  const [w, h, d] = size;
  const [x1, y1, z1] = [x0 + w, y0 + h, z0 + d];
  const geo = {
    north: { o: [x1, y1, z0], a: [-w, 0, 0], b: [0, -h, 0], n: [0, 0, -1] },
    south: { o: [x0, y1, z1], a: [w, 0, 0], b: [0, -h, 0], n: [0, 0, 1] },
    east: { o: [x1, y1, z1], a: [0, 0, -d], b: [0, -h, 0], n: [1, 0, 0] },
    west: { o: [x0, y1, z0], a: [0, 0, d], b: [0, -h, 0], n: [-1, 0, 0] },
    up: { o: [x0, y1, z0], a: [w, 0, 0], b: [0, 0, d], n: [0, 1, 0] },
    down: { o: [x0, y0, z1], a: [w, 0, 0], b: [0, 0, -d], n: [0, -1, 0] },
  };
  for (const [name, face] of Object.entries(faces)) {
    const g = geo[name];
    if (!face || !g) continue;
    quad(scene, face.tex, g.o, g.a, g.b, face.uv, SHADE[name], g.n);
  }
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

function sky(scene) {
  const top = [120, 167, 255];
  const bottom = [192, 216, 255];
  for (let y = 0; y < H; y++) {
    const c = top.map((v, i) => Math.round(v + ((bottom[i] - v) * y) / H));
    for (let x = 0; x < W; x++) scene.color.px.set([...c, 255], (y * W + x) * 4);
  }
}

function ground(scene) {
  const all = (tex) => ({ tex, uv: [0, 0, 16, 16] });
  for (let bx = -3; bx <= 3; bx++) {
    for (let bz = -3; bz <= 3; bz++) {
      if (bx === 0 && bz === 0) continue; // the campfire's block
      cube(scene, [bx * 16 - 8, -16, bz * 16 - 8], [16, 16, 16], {
        up: all(planks),
        north: all(planks),
        south: all(planks),
        east: all(planks),
        west: all(planks),
      });
    }
  }
  // the block under the campfire
  cube(scene, [-8, -16, -8], [16, 16, 16], { up: all(planks), south: all(planks), east: all(planks) }); // prettier-ignore
}

function campfire(scene) {
  const side = (u = 16, v = 4) => ({ tex: logSide, uv: [0, 0, u, v] });
  const end = { tex: logEnd, uv: [4, 4, 4, 4] };
  for (const z of [-7, 3]) {
    cube(scene, [-8, 0, z], [16, 4, 4], { up: side(), north: side(), south: side(), east: end, west: end }); // prettier-ignore
  }
  for (const x of [-7, 3]) {
    cube(scene, [x, 3, -8], [4, 4, 16], { up: side(), east: side(), west: side(), north: end, south: end }); // prettier-ignore
  }
  // two crossed flame quads in the middle, like the vanilla campfire
  const uv = [0, 15.99, 16, -16];
  quad(scene, flame, [0, 1, -6], [0, 0, 12], [0, 15, 0], uv, 1, [1, 0, 0], true);
  quad(scene, flame, [-6, 1, 0], [12, 0, 0], [0, 15, 0], uv, 1, [0, 0, 1], true);
}

/** The S8 pot from its exported geometry, sitting one block up (on the campfire's block). */
function pot(scene, liquidTexture, level) {
  const geo = JSON.parse(readFileSync(path.join(POT_DIR, "cooking_pot.geo.json")))[
    "minecraft:geometry"
  ][0];
  const tex = {
    "*": load(path.join(POT_DIR, "textures/cooking_pot_side.png")),
    top: load(path.join(ART, "generated/blocks/cooking_pot_top_hot.png")), // lit fire below
    lid: load(path.join(POT_DIR, "textures/cooking_pot_lid.png")),
    liquid: load(path.join(ART, `generated/blocks/${liquidTexture}.png`)),
  };
  for (const bone of geo.bones) {
    if (bone.name === "lid") continue; // only while cooking
    const m = /^liquid_(\d)$/.exec(bone.name);
    if (m && Number(m[1]) !== level) continue;
    for (const c of bone.cubes ?? []) {
      const faces = {};
      for (const [name, f] of Object.entries(c.uv)) {
        faces[name] = { tex: tex[f.material_instance ?? "*"], uv: [...f.uv, ...f.uv_size] };
      }
      cube(scene, [c.origin[0], c.origin[1] + 16, c.origin[2]], c.size, faces);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Ghosts: screen-space sprites at the particle's world positions (they face the camera)
// ---------------------------------------------------------------------------------------------

/** Alpha-blends `src` (a w×h region of an image) scaled ×scale at (x, y), times `alpha`. */
function sprite(scene, src, sx, sy, sw, sh, x, y, scale, alpha, tint = [1, 1, 1]) {
  for (let j = 0; j < sh * scale; j++) {
    for (let i = 0; i < sw * scale; i++) {
      const tx = Math.round(x + i);
      const ty = Math.round(y + j);
      if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
      const k = ((sy + Math.floor(j / scale)) * src.w + sx + Math.floor(i / scale)) * 4;
      const a = (src.px[k + 3] / 255) * alpha;
      if (a <= 0) continue;
      const d = (ty * W + tx) * 4;
      for (let c = 0; c < 3; c++) {
        scene.color.px[d + c] = Math.round(src.px[k + c] * tint[c] * a + scene.color.px[d + c] * (1 - a)); // prettier-ignore
      }
    }
  }
}

function ghostRow(scene, data, atlas, items, alpha, time) {
  const A = data.GHOST_ATLAS;
  const y = data.GHOST_HEIGHT * 16 + 16; // the pot is one block up
  const iconPx = Math.round(data.GHOST_ICON_SIZE * 2 * 16 * K); // billboard size is a half-size
  const scale = iconPx / A.frame;
  const centres = [];
  items.forEach((id, i) => {
    const offset = (i - (items.length - 1) / 2) * data.GHOST_SPACING * 16;
    const phase = time + i * data.GHOST_WAVE_SECONDS;
    const bob = Math.sin((phase * 2 * Math.PI) / data.GHOST_BOB_SECONDS) * data.GHOST_BOB_HEIGHT * 16; // prettier-ignore
    const world = [RIGHT[0] * offset, y + bob, RIGHT[2] * offset];
    const [px, py] = project(scene, world);
    const cell = data.ghostIconIndex(id);
    const sx = (cell % A.columns) * A.cell + A.pad;
    const sy = Math.floor(cell / A.columns) * A.cell + A.pad;
    sprite(scene, atlas, sx, sy, A.frame, A.frame, px - iconPx / 2, py - iconPx / 2, scale, alpha);
    centres.push([px, py]);
  });
  return { centres, iconPx };
}

function sparkles(scene, data, atlas, [cx, cy], iconPx) {
  const A = data.GHOST_ATLAS;
  const cell = data.ghostIconIndex(data.GHOST_STAR);
  const sx = (cell % A.columns) * A.cell + A.pad;
  const sy = Math.floor(cell / A.columns) * A.cell + A.pad;
  const gold = [1, 0.87, 0.4];
  // a few stars at different points of their twinkle (size), around the dish
  for (const [dx, dy, size] of [
    [-0.75, -0.55, 0.6],
    [0.8, -0.2, 0.45],
    [-0.55, 0.65, 0.35],
    [0.6, 0.7, 0.55],
  ]) {
    const scale = size;
    const px = cx + dx * iconPx - (A.frame * scale) / 2;
    const py = cy + dy * iconPx - (A.frame * scale) / 2;
    sprite(scene, atlas, sx, sy, A.frame, A.frame, px, py, scale, 1, gold);
  }
}

function upscale(src, f) {
  const out = img(src.w * f, src.h * f);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const k = (Math.floor(y / f) * src.w + Math.floor(x / f)) * 4;
      out.px.set(src.px.subarray(k, k + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

async function render(data, atlas, { items, liquid, out, time }) {
  const station = data.stationById("pot");
  const view = data.ghostsFor(station, { items }, 0);
  const level = data.fillLevel(station, { items }, 3);
  const ready = view.mode === "ready";
  const scene = makeScene(W / 2, H * 0.84);
  sky(scene);
  ground(scene);
  campfire(scene);
  pot(scene, `cooking_pot_liquid_${liquid}${ready ? "_ready" : ""}`, level);
  const shown = view.icons.map((i) => i.item);
  const { centres, iconPx } = ghostRow(scene, data, atlas, shown, data.GHOST_ALPHA, time);
  if (ready && centres[0]) sparkles(scene, data, atlas, centres[0], iconPx);
  writeFileSync(path.join(HERE, out), encodePng(upscale(scene.color, UP)));
  console.log(`[render-ghosts] ${out}: ${view.mode} ${shown.join(", ")} (fill ${level})`);
}

const data = await loadData();
const atlas = load(path.join(ROOT, "packs/harvest_kitchen/resource", `${data.GHOST_ATLAS.texture}.png`)); // prettier-ignore
await render(data, atlas, {
  items: { "hk:onion": 1, "minecraft:bread": 1 },
  liquid: "broth",
  out: "ghost_ingredients.png",
  time: 0.35,
});
await render(data, atlas, {
  items: { "hk:onion": 2, "minecraft:bread": 1, "minecraft:bowl": 1 },
  liquid: "broth",
  out: "ghost_ready.png",
  time: 0.35,
});
