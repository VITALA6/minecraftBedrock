// Generates art/simmerfield/models/strawberry_cake/{textures/*.png, strawberry_cake.bbmodel}.
//
// A 14x8x14 cake (rounded 1 px corners) split into four quarter bones. The block drives them with
// bone_visibility from wm_kitchen:slices (0-3 eaten): slice_k is visible while wm_kitchen:slices <= 4 - k, so
// slice_4 goes first and slice_1 is the last piece left.
//   slice_1 = south-east quarter, slice_2 = south-west, slice_3 = north-east, slice_4 = north-west
// Every quarter carries its own cut faces (material `inner`) on the x = 0 and z = 0 planes, a
// cream dollop and a strawberry on top. Materials: * (frosted side), top (glaze + cream piping;
// its unused corner also textures the dollops), inner (cut sponge/cream/jam), berry.
//
// Pipeline (plan §4.5):
//   1. node art/simmerfield/models/_tools/make-strawberry-cake.mjs
//   2. In Blockbench (MCP risky_eval): loadModelFile({content, path}) on the .bbmodel
//   3. export_model codec "bedrock" -> strawberry_cake.geo.json, then postFixGeo() from model-lib
import fs from "node:fs";
import path from "node:path";
import { canvas, finalizeFaces, rng, savePng, writeBbmodel } from "./model-lib.mjs";

const OUT = path.resolve(import.meta.dirname, "../strawberry_cake");
fs.mkdirSync(path.join(OUT, "textures"), { recursive: true });

// ---------------------------------------------------------------- geometry
// Quarters are modelled once in the +x/+z quadrant and mirrored.
const QUARTERS = [
  { name: "slice_1", sx: 1, sz: 1, color: 1 },
  { name: "slice_2", sx: -1, sz: 1, color: 2 },
  { name: "slice_3", sx: 1, sz: -1, color: 3 },
  { name: "slice_4", sx: -1, sz: -1, color: 4 },
];
const mirror = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
function qcube(q, name, [x1, x2], [y1, y2], [z1, z2], extra = {}) {
  const [mx1, mx2] = mirror(q.sx, x1, x2);
  const [mz1, mz2] = mirror(q.sz, z1, z2);
  return { name, from: [mx1, y1, mz1], to: [mx2, y2, mz2], ...extra };
}

// Dollop: cream, textured from the top texture's unused corner (u 0..2, v 0..2 and row 0).
const DOLLOP_UV = {
  up: [0, 0, 2, 2],
  north: [2, 0, 4, 1],
  east: [4, 0, 6, 1],
  south: [6, 0, 8, 1],
  west: [8, 0, 10, 1],
};
// Strawberry atlas: calyx on top, skin on the sides; each quarter gets its own column of sides.
const berryUv = (i) => ({
  up: [2 * i, 0, 2 * i + 2, 2],
  north: [2 * i, 2, 2 * i + 2, 4],
  east: [2 * i, 4, 2 * i + 2, 6],
  south: [2 * i, 6, 2 * i + 2, 8],
  west: [2 * i, 8, 2 * i + 2, 10],
});

const bones = QUARTERS.map((q, i) => ({
  name: q.name,
  color: q.color,
  cubes: [
    qcube(q, "cake_wide", [0, 7], [0, 8], [0, 6]),
    qcube(q, "cake_deep", [0, 6], [0, 8], [6, 7]),
    qcube(q, "cream", [2, 4], [8, 9], [2, 4], { mat: "top", uvs: DOLLOP_UV }),
    qcube(q, "strawberry", [2, 4], [9, 11], [2, 4], { mat: "berry", uvs: berryUv(i) }),
  ],
}));

finalizeFaces(
  bones,
  (face, c) => {
    if (c.mat) return c.mat;
    if (face === "up") return "top";
    if (face === "down") return "*";
    const axis = face === "east" || face === "west" ? 0 : 2;
    const plane = face === "east" || face === "south" ? c.to[axis] : c.from[axis];
    return plane === 0 ? "inner" : "*";
  },
  // A quarter may only hide its own faces: neighbours can be eaten.
  (bone) => bone.cubes,
);

// ---------------------------------------------------------------- palette
const P = {
  // strawberry glaze
  g0: "#ff9cb2",
  g1: "#f26d8d",
  g2: "#d94a6f",
  g3: "#b0335a",
  // pale pink frosting
  f1: "#fff1f4",
  f2: "#fcdbe3",
  f3: "#f4bfcd",
  f4: "#e39fb3",
  // whipped cream
  c1: "#fffcf5",
  c2: "#f4e8d6",
  c3: "#e2d0b6",
  // sponge
  s1: "#f8e1a4",
  s2: "#eccb83",
  s3: "#dbaf67",
  s4: "#c1904d",
  // strawberry
  r0: "#ff7c8c",
  r1: "#f2445c",
  r2: "#d42a45",
  r3: "#a51c37",
  r4: "#7c1229",
  seed: "#ffe48a",
  l1: "#86c94e",
  l2: "#5ea535",
  l3: "#3e7a24",
};

// Footprint of the cake top (u = x + 8, v = z + 8): u,v 1..14 minus the four corner pixels.
const inCake = (u, v) =>
  u >= 1 && u <= 14 && v >= 1 && v <= 14 && !((u === 1 || u === 14) && (v === 1 || v === 14));

function topTex() {
  const r = rng(7);
  const cv = canvas(P.g1);
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) {
      if (!inCake(u, v)) continue;
      const rim = !inCake(u - 1, v) || !inCake(u + 1, v) || !inCake(u, v - 1) || !inCake(u, v + 1);
      if (rim) {
        // piped cream border: alternating dollops, shaded on the south/east side
        const se = !inCake(u + 1, v) || !inCake(u, v + 1);
        cv.set(u, v, (u + v) % 2 === 0 ? (se ? P.c2 : P.c1) : se ? P.c3 : P.c2);
        continue;
      }
      // glaze: lighter towards the top-left, a darker ring inside the S/E rim
      let c = P.g1;
      const n = r();
      if (u + v < 10 && n < 0.12) c = P.g0;
      else if (n > 0.95) c = P.g2;
      if (u === 13 || v === 13) c = P.g2;
      if (u === 2 || v === 2) c = P.g0;
      cv.set(u, v, c);
    }
  // sauce sheen streaks
  for (const [u, v] of [
    [4, 4],
    [5, 4],
    [4, 5],
    [10, 6],
    [11, 6],
    [6, 10],
    [9, 11],
    [10, 11],
  ])
    cv.set(u, v, P.g0);
  // unused corner = cream for the dollops (top 2x2 + side strips in row 0)
  for (let u = 0; u < 16; u++) cv.set(u, 0, u % 2 === 0 ? P.c1 : P.c2);
  cv.set(0, 0, P.c1);
  cv.set(1, 0, P.c1);
  cv.set(0, 1, P.c1);
  cv.set(1, 1, P.c2);
  for (let v = 2; v < 16; v++) {
    cv.set(0, v, P.c2);
    cv.set(15, v, P.c2);
  }
  for (let u = 0; u < 16; u++) cv.set(u, 15, P.c2);
  return cv;
}

function sideTex() {
  // Cake side is rows 8..15 (y 8..0). Rows 0..7 repeat it so the face tiles.
  const cv = canvas(P.f2);
  // drip lengths per column (0 = glaze band only)
  const drip = [1, 2, 0, 1, 3, 1, 0, 2, 1, 0, 3, 2, 0, 1, 2, 0];
  for (let u = 0; u < 16; u++) {
    const col = [];
    col[0] = u % 2 === 0 ? P.c1 : P.c2; // cream piping, top edge
    col[1] = P.g1; // glaze band
    for (let k = 0; k < 4; k++)
      col[2 + k] = k < drip[u] ? (k === drip[u] - 1 ? P.g2 : P.g1) : k === drip[u] ? P.f1 : P.f2;
    col[6] = P.f2;
    col[7] = u % 2 === 0 ? P.f4 : P.f3; // piped bottom border
    // frosting shading: one darker row above the border
    if (col[5] === P.f2) col[5] = P.f3;
    if (col[6] === P.f2) col[6] = P.f3;
    for (let k = 0; k < 8; k++) {
      cv.set(u, 8 + k, col[k]);
      cv.set(u, k, col[k]);
    }
  }
  // glaze highlight pixels
  for (const u of [2, 6, 9, 13]) {
    cv.set(u, 9, P.g0);
    cv.set(u, 1, P.g0);
  }
  return cv;
}

function innerTex() {
  // Cut face, rows 8..15 (y 8..0). Columns 1 and 14 are the frosting coat at the cake's outside;
  // columns 2..13 show the inside. Column 8 is the cake's centre.
  const r = rng(31);
  const cv = canvas(P.s2);
  for (let u = 0; u < 16; u++) {
    for (let k = 0; k < 8; k++) {
      const n = r();
      let c;
      if (u <= 1 || u >= 14) {
        // frosting coat (outside skin)
        c = [P.c1, P.g1, P.g2, P.f2, P.f2, P.f2, P.f3, P.f4][k];
      } else {
        c = [
          P.g2, // glaze skin on top
          n < 0.2 ? P.s1 : P.s1,
          n < 0.25 ? P.s3 : P.s2,
          [3, 6, 10, 12].includes(u) ? P.r1 : u === 7 ? P.c2 : P.c1, // cream with strawberry pieces
          [2, 5, 9].includes(u) ? P.r1 : [7, 11].includes(u) ? P.r3 : P.r2, // jam layer
          n < 0.15 ? P.s2 : P.s1,
          n < 0.25 ? P.s3 : P.s2,
          n < 0.4 ? P.s4 : P.s3, // bottom crust
        ][k];
      }
      cv.set(u, 8 + k, c);
      cv.set(u, k, c);
    }
  }
  return cv;
}

function berryTex() {
  const r = rng(53);
  const cv = canvas(P.r2);
  // skin everywhere: red with yellow seeds on a diagonal grid, lit top-left
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) {
      let c = (u + v) % 4 === 0 && v % 2 === 1 ? P.seed : v % 2 === 0 ? P.r1 : P.r2;
      if (r() < 0.12) c = P.r3;
      cv.set(u, v, c);
    }
  // per quarter i (columns 2i, 2i+1): calyx on top (rows 0..1), leaf tips on the upper side rows
  for (let i = 0; i < 8; i++) {
    const a = 2 * i,
      b = a + 1;
    cv.set(a, 0, P.l1);
    cv.set(b, 0, P.l2);
    cv.set(a, 1, P.l2);
    cv.set(b, 1, P.l3);
    for (const row of [2, 4, 6, 8]) {
      // side face of a 2x2 berry: upper row bright skin (one leaf tip on alternate faces),
      // lower row darker skin with a seed
      const leaf = (row / 2 + i) % 2 === 0;
      cv.set(a, row, leaf ? P.l2 : P.r0);
      cv.set(b, row, P.r1);
      cv.set(a, row + 1, leaf ? P.r2 : P.seed);
      cv.set(b, row + 1, P.r3);
    }
  }
  return cv;
}

const tex = [
  { name: "strawberry_cake_side", cv: sideTex() },
  { name: "strawberry_cake_top", cv: topTex() },
  { name: "strawberry_cake_inner", cv: innerTex() },
  { name: "strawberry_cake_berry", cv: berryTex() },
];
for (const t of tex) {
  t.file = path.join(OUT, "textures", t.name + ".png");
  savePng(t.file, t.cv);
}

writeBbmodel(path.join(OUT, "strawberry_cake.bbmodel"), {
  name: "wm_kitchen_strawberry_cake",
  identifier: "wm_kitchen.strawberry_cake",
  bones,
  textures: tex,
  matToTex: { "*": 0, top: 1, inner: 2, berry: 3 },
});
console.log("cubes:", bones.map((b) => `${b.name}=${b.cubes.length}`).join(" "));
