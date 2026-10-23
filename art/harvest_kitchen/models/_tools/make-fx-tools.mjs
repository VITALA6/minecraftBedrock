// Generates the station fx models (scripts/fx): the chopping knife (hk:fx_knife) over the cutting
// board and the stirring spoon (hk:fx_spoon) in the cooking pot.
//
//   node art/harvest_kitchen/models/_tools/make-fx-tools.mjs           write everything below
//   node art/harvest_kitchen/models/_tools/make-fx-tools.mjs --check   exit 1 if a pack file
//                                    (texture, animation) differs from what it would write
//
// Writes, per tool <name> = fx_knife | fx_spoon:
//   art/harvest_kitchen/models/<name>/textures/<name>.png   16×16 texture (also copied to the pack:
//                                                           resource/textures/hk/entity/<name>.png;
//                                                           the knife's is the board knife's texture)
//   art/harvest_kitchen/models/<name>/<name>.src.bbmodel    Bedrock Entity model, no animation yet
//   art/harvest_kitchen/models/<name>/<name>.animation.json the client animation (also copied to
//                                                           resource/animations/hk/<name>.animation.json)
// and the chop particle's crumb, resource/textures/hk/particle/chop_bit.png.
// Then fx-blockbench.mjs (Blockbench MCP) loads the .src.bbmodel and the animation, exports the
// geometry (resource/models/entity/hk/<name>.geo.json), saves <name>.bbmodel with the animation,
// and renders renders/*.png with the board or pot around the tool.
//
// Model space is Blockbench's, shared with the board and pot models: x/z −8..8 around the block
// centre, y up from the block's bottom, the board's paddle handle at −z. The entity stands at the
// bottom centre of the station block; scripts/fx turns the knife to the board's facing.
//
// Knife: the board's own knife (same cubes, place and texture). Bone `knife` stands it on its
// edge (pick-up), bone `chop` rocks it on the tip: the heel lifts and slams twice a second.
// Locator `edge` (mid-blade, on the board) is where the chop particles burst.
// Spoon: a wooden spoon standing in the pot, leaning out a little; bone `stir` turns it round the
// pot's centre, bone `spoon` holds the lean. Bowl bottom at y 1 (the pot floor), so the liquid
// (y 3/5/7) hides more of the bowl as the pot fills; the handle clears the rim (x < 4.5 at y 9).
import fs from "node:fs";
import path from "node:path";
import { canvas, rng, uuid } from "./model-lib.mjs";
import * as prettier from "prettier";
import { writePng } from "./png.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const ART = path.resolve(import.meta.dirname, "..");
const RP = path.join(ROOT, "packs/harvest_kitchen/resource");
const CHECK = process.argv.includes("--check");

// ---------------------------------------------------------------- palettes
// Spoon wood: a lighter beech ramp than the board's oak, hue-shifted (shadows
// toward red-brown, highlights toward yellow) so it stands out against the dark pot.
const BEECH = { hi: "#f0d49a", l: "#e0bb7c", m: "#c89a5c", d: "#a2703e", dd: "#7a4c2c" };

// ---------------------------------------------------------------- model helpers
/** A cube with explicit per-face UV rects [u1, v1, u2, v2]; null hides the face. */
const cube = (name, from, to, uv) => ({ name, from, to, uv });

/** Paints a UV rect with one colour (or a function (u, v) -> colour). */
function paint(cv, [u1, v1, u2, v2], color) {
  for (let v = Math.floor(v1); v < Math.ceil(v2); v++)
    for (let u = Math.floor(u1); u < Math.ceil(u2); u++)
      cv.set(u, v, typeof color === "function" ? color(u, v) : color);
}

// ---------------------------------------------------------------- knife
// The board's own knife (art review, rework): the same four cubes in the same place, with the same
// texture (art/harvest_kitchen/models/cutting_board/textures/cutting_board_knife.png, drawn by
// make-cutting-board.mjs), so at rest the fx knife is exactly the knife lying on the board. The
// board hides its knife bone while an fx knife is alive (hk:chopping, scripts/fx), so it reads as
// the board's knife picking itself up. Unlike the board's copy every face is kept: lifted, the
// underside and the ends show.
//
// Cubes and UVs follow knifeCube() in make-cutting-board.mjs: top view rows 0-2 (u = x + 6,
// v = z - 1), long sides rows 4/5 (blade) and 6/7 (bolster + handle), ends rows 8/9.
const BLADE_Y = [2, 2.5];
const HANDLE_Y = [2, 3];
function knifeCube(name, x1, z1, x2, z2, [y1, y2], metal) {
  const top = [x1 + 6, z1 - 1, x2 + 6, z2 - 1];
  const h = y2 - y1;
  const nRow = metal === "blade" ? 4 : 6;
  const sRow = nRow + 1;
  const eRow = metal === "blade" ? 8 : 9;
  return cube(name, [x1, y1, z1], [x2, y2, z2], {
    up: top,
    down: top,
    north: [x1 + 6, nRow, x2 + 6, nRow + h],
    south: [x1 + 6, sRow, x2 + 6, sRow + h],
    west: [z1 - 1, eRow, z2 - 1, eRow + h],
    east: [z1 - 1, eRow, z2 - 1, eRow + h],
  });
}

const knife = {
  name: "fx_knife",
  identifier: "hk.fx_knife",
  bones: [
    // the rock: pivots at the blade tip on the board
    { name: "chop", pivot: [-6, 2, 1], cubes: [] },
    {
      // the pick-up: stands the flat knife on its cutting edge (the z = 1 line, on the board)
      name: "knife",
      parent: "chop",
      pivot: [0, 2, 1],
      cubes: [
        knifeCube("blade_point", -6, 2, -4, 4, BLADE_Y, "blade"),
        knifeCube("blade", -4, 1, 2, 4, BLADE_Y, "blade"),
        knifeCube("bolster", 2, 2, 3, 4, HANDLE_Y, "handle"),
        knifeCube("handle", 3, 2, 7, 4, HANDLE_Y, "handle"),
      ],
      locators: { edge: [-1, 2, 1] }, // mid-blade, on the edge line: the crumbs burst here
    },
  ],
};

const BOARD_KNIFE_TEXTURE = path.join(ART, "cutting_board/textures/cutting_board_knife.png");

// Pick up: 0.15 s, then hold: the knife turns onto its edge (spine up: +x, checked in the
// renders). Chop: 0.5 s loop on the outer bone, unchanged from the first round (approved): lift
// the heel (rock on the tip; +z lifts the +x handle, checked in the renders) and half a pixel,
// hold, slam at 0.30 s (the particle burst), a small rebound, rest. Both start at spawn, so the
// knife rises as it turns.
const knifeAnimation = {
  "animation.hk.fx_knife.pick_up": {
    loop: "hold_on_last_frame",
    animation_length: 0.15,
    bones: { knife: { rotation: { "0.0": [0, 0, 0], 0.15: [90, 0, 0] } } },
  },
  "animation.hk.fx_knife.chop": {
    loop: true,
    animation_length: 0.5,
    bones: {
      chop: {
        rotation: {
          "0.0": [0, 0, 0],
          0.18: [0, 0, 24],
          0.24: [0, 0, 26],
          0.3: [0, 0, 0],
          0.34: [0, 0, 3],
          0.4: [0, 0, 0],
        },
        position: {
          "0.0": [0, 0, 0],
          0.18: [0, 0.5, 0],
          0.24: [0, 0.5, 0],
          0.3: [0, 0, 0],
        },
      },
    },
    particle_effects: { 0.3: { effect: "chop", locator: "edge" } },
  },
};

// ---------------------------------------------------------------- spoon
// UV atlas: handle sides u 0..4 (north, east, south, west), v 0..10; handle top u 4, v 0; bowl
// front/back u 6..8 / 8..10, v 0..3; bowl sides u 10 / 11, v 0..3; bowl bottom u 12..14, v 0;
// bowl top (under the handle) u 12..14, v 1.
const SPOON_UV = {
  handle: {
    north: [0, 0, 1, 10],
    east: [1, 0, 2, 10],
    south: [2, 0, 3, 10],
    west: [3, 0, 4, 10],
    up: [4, 0, 5, 1],
    down: null,
  },
  bowl: {
    north: [6, 0, 8, 3],
    south: [8, 0, 10, 3],
    east: [10, 0, 11, 3],
    west: [11, 0, 12, 3],
    up: [12, 1, 14, 2],
    down: [12, 0, 14, 1],
  },
};

const spoon = {
  name: "fx_spoon",
  identifier: "hk.fx_spoon",
  bones: [
    { name: "stir", pivot: [0, 0, 0], cubes: [] },
    {
      name: "spoon",
      parent: "stir",
      pivot: [2, 1, 0],
      rotation: [0, 0, -10], // lean: the handle top out toward +x, away from the centre
      cubes: [
        cube("bowl", [1, 1, -0.5], [3, 4, 0.5], SPOON_UV.bowl),
        cube("handle", [1.5, 4, -0.5], [2.5, 14, 0.5], SPOON_UV.handle),
      ],
    },
  ],
};

function spoonTexture() {
  const r = rng(31);
  const cv = canvas(BEECH.m);
  // handle sides: lit west/north, shaded east/south; a few grain flecks; the top end darker
  const side = { 0: BEECH.l, 1: BEECH.d, 2: BEECH.m, 3: BEECH.hi };
  for (let u = 0; u < 4; u++)
    for (let v = 0; v < 10; v++) {
      let c = side[u];
      if (r() < 0.12) c = u === 3 ? BEECH.l : u === 1 ? BEECH.dd : BEECH.d;
      cv.set(u, v, c);
    }
  cv.set(4, 0, BEECH.l); // handle end grain
  // bowl: food-stained darker wood, lit top-left
  paint(cv, [6, 0, 8, 3], (u, v) => (u === 6 && v === 0 ? BEECH.l : v === 2 ? BEECH.dd : BEECH.d));
  paint(cv, [8, 0, 10, 3], (u, v) => (v === 2 ? BEECH.dd : BEECH.d));
  paint(cv, [10, 0, 11, 3], BEECH.dd);
  paint(cv, [11, 0, 12, 3], (u, v) => (v === 0 ? BEECH.m : BEECH.d));
  paint(cv, [12, 0, 14, 1], BEECH.dd);
  paint(cv, [12, 1, 14, 2], BEECH.m);
  return cv;
}

// Stir: a full turn every 2 s round the pot's centre, with a slow bob.
const spoonAnimation = {
  "animation.hk.fx_spoon.stir": {
    loop: true,
    animation_length: 2.0,
    bones: {
      stir: { rotation: [0, "q.anim_time * -180", 0] },
      spoon: { position: [0, "math.sin(q.anim_time * 360) * 0.4", 0] },
    },
  },
};

// ---------------------------------------------------------------- .bbmodel (Bedrock Entity)
function bbmodel(model, textureFile) {
  const groups = [];
  const elements = [];
  const nodes = new Map();
  for (const bone of model.bones) {
    const gid = uuid();
    const node = { uuid: gid, isOpen: true, children: [] };
    nodes.set(bone.name, node);
    groups.push({
      name: bone.name,
      uuid: gid,
      export: true,
      locked: false,
      visibility: true,
      origin: bone.pivot,
      rotation: bone.rotation ?? [0, 0, 0],
      color: 0,
      children: [],
      reset: false,
      shade: true,
      mirror_uv: false,
      autouv: 0,
      isOpen: true,
    });
    for (const c of bone.cubes) {
      const id = uuid();
      const faces = {};
      for (const f of ["north", "east", "south", "west", "up", "down"]) {
        const rect = c.uv[f];
        faces[f] = rect ? { uv: rect, texture: 0 } : { uv: [0, 0, 0, 0], texture: null };
      }
      elements.push({
        name: c.name,
        box_uv: false,
        rescale: false,
        locked: false,
        render_order: "default",
        allow_mirror_modeling: true,
        from: c.from,
        to: c.to,
        autouv: 0,
        color: 0,
        origin: bone.pivot,
        faces,
        type: "cube",
        uuid: id,
      });
      node.children.push(id);
    }
    for (const [name, position] of Object.entries(bone.locators ?? {})) {
      const id = uuid();
      elements.push({ name, position, rotation: [0, 0, 0], type: "locator", uuid: id });
      node.children.push(id);
    }
    if (bone.parent) nodes.get(bone.parent).children.push(node);
  }
  const outliner = model.bones.filter((b) => !b.parent).map((b) => nodes.get(b.name));
  return {
    meta: { format_version: "5.0", model_format: "bedrock", box_uv: false },
    name: model.name,
    model_identifier: model.identifier,
    visible_box: [1, 1, 0],
    variable_placeholders: "",
    variable_placeholder_buttons: [],
    resolution: { width: 16, height: 16 },
    elements,
    groups,
    outliner,
    textures: [
      {
        name: `${model.name}.png`,
        path: "",
        folder: "",
        namespace: "",
        id: "0",
        width: 16,
        height: 16,
        uv_width: 16,
        uv_height: 16,
        particle: false,
        render_mode: "default",
        render_sides: "auto",
        visible: true,
        internal: true,
        saved: false,
        uuid: uuid(),
        source: "data:image/png;base64," + fs.readFileSync(textureFile).toString("base64"),
      },
    ],
  };
}

// ---------------------------------------------------------------- write / check
/** Formatted like the rest of the pack (prettier), so format:check and --check agree. */
async function animationJson(animations, file) {
  const options = { ...(await prettier.resolveConfig(file)), filepath: file };
  return prettier.format(JSON.stringify({ format_version: "1.10.0", animations }), options);
}

const problems = [];
function output(file, data) {
  if (CHECK) {
    const same = fs.existsSync(file) && fs.readFileSync(file).equals(Buffer.from(data));
    if (!same) problems.push(`${path.relative(ROOT, file)} is out of date`);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}

function pngBytes(cv) {
  const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "hk-fx-")), "t.png");
  writePng(tmp, 16, 16, cv.toRgba());
  const bytes = fs.readFileSync(tmp);
  fs.rmSync(path.dirname(tmp), { recursive: true });
  return bytes;
}

for (const [model, png, animations] of [
  [knife, fs.readFileSync(BOARD_KNIFE_TEXTURE), knifeAnimation],
  [spoon, pngBytes(spoonTexture()), spoonAnimation],
]) {
  const dir = path.join(ART, model.name);
  const animFile = path.join(RP, "animations/hk", `${model.name}.animation.json`);
  const anim = await animationJson(animations, animFile);
  output(path.join(RP, "textures/hk/entity", `${model.name}.png`), png);
  output(animFile, anim);
  if (CHECK) continue;
  const texFile = path.join(dir, "textures", `${model.name}.png`);
  output(texFile, png);
  output(path.join(dir, `${model.name}.animation.json`), anim);
  output(
    path.join(dir, `${model.name}.src.bbmodel`),
    JSON.stringify(bbmodel(model, texFile), null, 2),
  );
}

// The chop particle (resource/particles/hk/chop_bits.json): a 4×4 crumb, lit top-left, tinted by
// the particle. Opaque pixels only (particles_alpha cuts, it doesn't blend).
{
  const crumb = [
    ["#ffffff", "#ffffff", "#ececec", "#d8d8d8"],
    ["#ffffff", "#ececec", "#ececec", "#d8d8d8"],
    ["#ececec", "#ececec", "#d8d8d8", "#c4c4c4"],
    ["#d8d8d8", "#d8d8d8", "#c4c4c4", "#c4c4c4"],
  ].flat();
  const file = path.join(RP, "textures/hk/particle/chop_bit.png");
  const tmp = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "hk-fx-")), "c.png");
  writePng(
    tmp,
    4,
    4,
    crumb.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(255)),
  );
  output(file, fs.readFileSync(tmp));
  fs.rmSync(path.dirname(tmp), { recursive: true });
}

if (problems.length > 0) {
  for (const p of problems) console.error(`[make-fx-tools] ${p}: run the generator`);
  process.exitCode = 1;
} else
  console.log(`[make-fx-tools] ${CHECK ? "pack files up to date" : "wrote fx_knife, fx_spoon"}`);
