// Generates art/simmerfield/models/cutting_board/{textures/*.png, cutting_board.bbmodel}.
// Model faces north: the paddle handle (with its hanging hole) points to -z, the knife lies along x
// with its handle to +x. Bones: board, knife. Materials: * (board edge), top (board top), knife.
// Run: node art/simmerfield/models/_tools/make-cutting-board.mjs
// Then load the .bbmodel in Blockbench and export the geo (see make-strawberry-cake.mjs header).
import fs from "node:fs";
import path from "node:path";
import { canvas, finalizeFaces, rng, savePng, writeBbmodel } from "./model-lib.mjs";

const OUT = path.resolve(import.meta.dirname, "../cutting_board");
fs.mkdirSync(path.join(OUT, "textures"), { recursive: true });

// ---------------------------------------------------------------- geometry
const cube = (name, from, to, extra = {}) => ({ name, from, to, ...extra });

const board = {
  name: "board",
  color: 1,
  cubes: [
    cube("body_wide", [-7, 0, -2], [7, 2, 6]),
    cube("body_long", [-6, 0, -3], [6, 2, 7]),
    cube("handle", [-2, 0, -6], [2, 2, -3]),
    cube("handle_end", [-1, 0, -7], [1, 2, -6]),
  ],
};

// Knife texture atlas (custom UVs): top view in rows 0-2 (u = x + 6, v = z - 1),
// north sides row 4 (blade) / 6 (bolster+handle), south sides row 5 / 7, ends rows 8 / 9.
const BLADE_Y = [2, 2.5];
const HANDLE_Y = [2, 3];
function knifeCube(name, x1, z1, x2, z2, [y1, y2], metal) {
  const top = [x1 + 6, z1 - 1, x2 + 6, z2 - 1];
  const h = y2 - y1;
  const nRow = metal === "blade" ? 4 : 6;
  const sRow = nRow + 1;
  const eRow = metal === "blade" ? 8 : 9;
  return cube(name, [x1, y1, z1], [x2, y2, z2], {
    uvs: {
      up: top,
      down: top,
      north: [x1 + 6, nRow, x2 + 6, nRow + h],
      south: [x1 + 6, sRow, x2 + 6, sRow + h],
      west: [z1 - 1, eRow, z2 - 1, eRow + h],
      east: [z1 - 1, eRow, z2 - 1, eRow + h],
    },
  });
}
const knife = {
  name: "knife",
  color: 2,
  cubes: [
    knifeCube("blade_point", -6, 2, -4, 4, BLADE_Y, "blade"),
    knifeCube("blade", -4, 1, 2, 4, BLADE_Y, "blade"),
    knifeCube("bolster", 2, 2, 3, 4, HANDLE_Y, "handle"),
    knifeCube("handle", 3, 2, 7, 4, HANDLE_Y, "handle"),
  ],
};

const bones = [board, knife];
finalizeFaces(
  bones,
  (face, c, bone) => (bone.name === "knife" ? "knife" : face === "up" ? "top" : "*"),
  // the board is always visible, so it may hide knife faces (and vice versa)
  () => [...board.cubes, ...knife.cubes],
);

// ---------------------------------------------------------------- textures
// Oak ramp sampled from vanilla planks_oak (#c29d62 #b8945f #af8f55 #9f844d #967441 #7e6237 #67502c)
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
};

// Footprint of the board's top surface in texture space (u = x + 8, v = z + 8).
const mask = Array.from({ length: 16 }, () => Array(16).fill(false));
for (const c of board.cubes)
  for (let x = c.from[0]; x < c.to[0]; x++)
    for (let z = c.from[2]; z < c.to[2]; z++) mask[z + 8][x + 8] = true;
const inMask = (u, v) => u >= 0 && u < 16 && v >= 0 && v < 16 && mask[v][u];

function boardTop() {
  const r = rng(11);
  const cv = canvas(OAK.m);
  // long grain along x: each row has a base tone, with streaks
  const rowTone = [
    OAK.m,
    OAK.l2,
    OAK.m,
    OAK.m2,
    OAK.l2,
    OAK.m,
    OAK.m,
    OAK.l2,
    OAK.m,
    OAK.m,
    OAK.l2,
    OAK.m,
    OAK.l2,
    OAK.m,
    OAK.m,
    OAK.m,
  ];
  for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) cv.set(u, v, rowTone[v]);
  // grain streaks: short darker runs
  const streaks = [
    [2, 4, 5],
    [9, 4, 4],
    [4, 6, 6],
    [11, 7, 3],
    [1, 9, 4],
    [7, 10, 5],
    [3, 12, 3],
    [10, 13, 4],
    [5, 2, 3],
    [12, 11, 3],
    [6, 0, 4],
  ];
  for (const [u0, v, len] of streaks)
    for (let i = 0; i < len; i++) cv.set(u0 + i, v, i === 0 || i === len - 1 ? OAK.m2 : OAK.d1);
  // a knot
  cv.set(12, 4, OAK.d2);
  cv.set(13, 4, OAK.d1);
  cv.set(12, 5, OAK.d1);
  // light knife scratches (diagonal, short)
  for (const [u, v] of [
    [3, 7],
    [4, 8],
    [9, 9],
    [10, 8],
    [11, 11],
    [12, 12],
    [5, 13],
    [6, 12],
  ])
    cv.set(u, v, OAK.l1);
  // sparse noise
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) {
      const n = r();
      if (n < 0.06) cv.set(u, v, OAK.l1);
      else if (n > 0.95) cv.set(u, v, OAK.m2);
    }
  // hanging hole in the handle (painted): u 7..8, v 3 (z -5)
  cv.set(7, 3, OAK.d4);
  cv.set(8, 3, OAK.d3);
  // juice groove: a rounded rectangle 1 px inside the main body's edge (u 2..13, v 6..13)
  for (let u = 3; u <= 12; u++) {
    cv.set(u, 6, OAK.d1);
    cv.set(u, 13, OAK.m2);
  }
  for (let v = 7; v <= 12; v++) {
    cv.set(2, v, OAK.d1);
    cv.set(13, v, OAK.m2);
  }
  // bevel along the footprint outline: lit from top-left
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) {
      if (!inMask(u, v)) continue;
      const N = !inMask(u, v - 1),
        W = !inMask(u - 1, v),
        S = !inMask(u, v + 1),
        E = !inMask(u + 1, v);
      if ((S && E) || (S && W && !N) || (E && N && !W)) cv.set(u, v, OAK.d3);
      else if (S || E) cv.set(u, v, OAK.d2);
      else if (N || W) cv.set(u, v, OAK.l1);
    }
  return cv;
}

function boardSide() {
  // The board is 2 px tall: rows 14 (upper, lit edge) and 15 (lower). Tile that pair over the face.
  const r = rng(23);
  const cv = canvas(OAK.m2);
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) {
      const upper = v % 2 === 0;
      let c = upper ? OAK.l2 : OAK.d1;
      const n = r();
      if (upper && n < 0.15) c = OAK.m;
      if (!upper && n < 0.18) c = OAK.d2;
      if (!upper && n > 0.93) c = OAK.d3;
      cv.set(u, v, c);
    }
  return cv;
}

function knifeTex() {
  const STEEL = {
    w: "#eeeef4",
    l: "#d2d2dc",
    m: "#b2b2be",
    d: "#8c8c9a",
    dd: "#62626e",
    b: "#4a4a54",
  };
  const WOOD = { l: "#7a5432", m: "#5e3e22", d: "#452c17", dd: "#33200f" };
  const cv = canvas(STEEL.m);
  // Unused area: plain steel/wood swatches so nothing is transparent.
  for (let v = 0; v < 16; v++)
    for (let u = 0; u < 16; u++) cv.set(u, v, v >= 10 ? WOOD.m : STEEL.m);
  // top view, rows 0-2: v0 = cutting edge (north), v2 = spine (south); u = x + 6
  // Art review (fx rework): the edge is one clean highlight line; the handle top is plain wood
  // (body, a shaded bottom row) with a single rivet. The fx knife (make-fx-tools.mjs) copies this
  // texture, so the knife that chops is the board's own.
  const top = {
    0: Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map((u) => [u, STEEL.w])),
    1: {
      0: STEEL.w,
      ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((u) => [u, STEEL.m])),
      8: STEEL.dd,
      9: WOOD.m,
      10: STEEL.d, // the rivet
      11: WOOD.m,
      12: WOOD.m,
    },
    2: {
      0: STEEL.m,
      ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((u) => [u, STEEL.d])),
      8: STEEL.b,
      9: WOOD.d,
      10: WOOD.d,
      11: WOOD.d,
      12: WOOD.d,
    },
  };
  for (const [v, row] of Object.entries(top))
    for (const [u, c] of Object.entries(row)) cv.set(+u, +v, c);
  // sides
  for (let u = 0; u < 16; u++) {
    cv.set(u, 4, STEEL.l); // blade north (edge side)
    cv.set(u, 5, STEEL.d); // blade south (spine)
    cv.set(u, 6, u <= 8 ? STEEL.d : WOOD.m); // bolster/handle north
    cv.set(u, 7, u <= 8 ? STEEL.dd : WOOD.d); // bolster/handle south
    cv.set(u, 8, STEEL.l); // blade ends
    cv.set(u, 9, WOOD.d); // handle ends
  }
  cv.set(1, 9, STEEL.dd); // bolster end faces (z 2..4 -> u 1..3)
  cv.set(2, 9, STEEL.dd);
  return cv;
}

const tex = [
  { name: "cutting_board_side", cv: boardSide() },
  { name: "cutting_board_top", cv: boardTop() },
  { name: "cutting_board_knife", cv: knifeTex() },
];
for (const t of tex) {
  t.file = path.join(OUT, "textures", t.name + ".png");
  savePng(t.file, t.cv);
}

writeBbmodel(path.join(OUT, "cutting_board.bbmodel"), {
  name: "wm_kitchen_cutting_board",
  identifier: "wm_kitchen.cutting_board",
  bones,
  textures: tex,
  matToTex: { "*": 0, top: 1, knife: 2 },
});
console.log("cubes:", bones.map((b) => `${b.name}=${b.cubes.length}`).join(" "));
