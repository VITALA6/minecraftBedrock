// Shared helpers for the Simmerfield model generators (cutting_board, strawberry_cake).
// A model is described as bones of cubes; this module projects block-style UVs, drops faces that
// are hidden inside other cubes, and writes a Blockbench 5 .bbmodel (Bedrock Block format) with
// the textures embedded. Blockbench then exports the .geo.json (see README notes in the generators).
import fs from "node:fs";
import crypto from "node:crypto";
import { writePng } from "./png.mjs";

export const FACES = ["north", "east", "south", "west", "up", "down"];

/** Block-face UV projection (Java/Blockbench convention, block space x,z in -8..8, y in 0..16). */
export function projectUv(face, from, to) {
  const [X1, Y1, Z1] = [from[0] + 8, from[1], from[2] + 8];
  const [X2, Y2, Z2] = [to[0] + 8, to[1], to[2] + 8];
  switch (face) {
    case "north":
      return [16 - X2, 16 - Y2, 16 - X1, 16 - Y1];
    case "south":
      return [X1, 16 - Y2, X2, 16 - Y1];
    case "west":
      return [Z1, 16 - Y2, Z2, 16 - Y1];
    case "east":
      return [16 - Z2, 16 - Y2, 16 - Z1, 16 - Y1];
    case "up":
      return [X1, Z1, X2, Z2];
    case "down":
      return [X1, 16 - Z2, X2, 16 - Z1];
  }
  throw new Error(face);
}

/** The face rectangle as an axis + plane + 2D extent, plus its outward normal. */
function faceGeom(face, from, to) {
  const n = {
    north: [2, -1],
    south: [2, 1],
    west: [0, -1],
    east: [0, 1],
    down: [1, -1],
    up: [1, 1],
  }[face];
  const [axis, sign] = n;
  const plane = sign < 0 ? from[axis] : to[axis];
  const others = [0, 1, 2].filter((a) => a !== axis);
  return { axis, sign, plane, others };
}

const inside = (p, c) => [0, 1, 2].every((a) => p[a] > c.from[a] && p[a] < c.to[a]);

/** True when every sample point just outside the face lies inside one of `coverers`. */
export function faceCovered(face, cube, coverers) {
  const { axis, sign, plane, others } = faceGeom(face, cube.from, cube.to);
  const [a, b] = others;
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const p = [0, 0, 0];
      p[axis] = plane + sign * 0.01;
      p[a] = cube.from[a] + ((i + 0.5) / steps) * (cube.to[a] - cube.from[a]);
      p[b] = cube.from[b] + ((j + 0.5) / steps) * (cube.to[b] - cube.from[b]);
      if (!coverers.some((c) => c !== cube && inside(p, c))) return false;
    }
  }
  return true;
}

export const uuid = () => crypto.randomUUID();

/** Deterministic RNG so the generated textures are re-runnable. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A 16x16 canvas of hex colours. */
export function canvas(fill) {
  const px = Array.from({ length: 16 }, () => Array(16).fill(fill));
  return {
    px,
    set(x, y, c) {
      if (x >= 0 && x < 16 && y >= 0 && y < 16 && c) px[y][x] = c;
    },
    get: (x, y) => px[y][x],
    toRgba() {
      return px
        .flat()
        .map((h) => [
          parseInt(h.slice(1, 3), 16),
          parseInt(h.slice(3, 5), 16),
          parseInt(h.slice(5, 7), 16),
          255,
        ]);
    },
  };
}

export function savePng(file, cv) {
  writePng(file, 16, 16, cv.toRgba());
}

/**
 * Builds a .bbmodel.
 * bones: [{ name, cubes: [{ name, from, to, faces: { north: { mat, uv? } | null, ... } }] }]
 * textures: [{ name, file }] in material order; matToTex maps material name -> texture index.
 */
export function writeBbmodel(file, { name, identifier, bones, textures, matToTex }) {
  const groups = [];
  const outliner = [];
  const elements = [];
  for (const bone of bones) {
    const gid = uuid();
    const children = [];
    for (const c of bone.cubes) {
      const id = uuid();
      children.push(id);
      const faces = {};
      for (const f of FACES) {
        const spec = c.faces[f];
        if (!spec) {
          faces[f] = { uv: [0, 0, 0, 0], texture: null };
          continue;
        }
        const face = { uv: spec.uv ?? projectUv(f, c.from, c.to), texture: matToTex[spec.mat] };
        if (spec.mat !== "*") face.material_name = spec.mat;
        faces[f] = face;
      }
      elements.push({
        name: c.name,
        box_uv: false,
        render_order: "default",
        locked: false,
        export: true,
        scope: 0,
        allow_mirror_modeling: true,
        from: c.from,
        to: c.to,
        autouv: 0,
        color: bone.color ?? 0,
        origin: [0, 0, 0],
        faces,
        type: "cube",
        uuid: id,
      });
    }
    groups.push({
      name: bone.name,
      uuid: gid,
      export: true,
      locked: false,
      scope: 0,
      selected: false,
      visibility: true,
      origin: [0, 0, 0],
      rotation: [0, 0, 0],
      color: bone.color ?? 0,
      children: [],
      reset: false,
      shade: true,
      mirror_uv: false,
      autouv: 0,
      isOpen: false,
    });
    outliner.push({ uuid: gid, isOpen: false, children });
  }
  const tex = textures.map((t, i) => ({
    name: t.name,
    path: "",
    folder: "",
    namespace: "",
    id: String(i),
    group: "",
    scope: 0,
    width: 16,
    height: 16,
    uv_width: 16,
    uv_height: 16,
    particle: false,
    use_as_default: false,
    layers_enabled: false,
    sync_to_project: "",
    file_format: "png",
    render_mode: "default",
    render_sides: "auto",
    wrap_mode: "limited",
    pbr_channel: "color",
    fps: 7,
    frame_time: 1,
    frame_order_type: "loop",
    frame_order: "",
    frame_interpolate: false,
    visible: true,
    internal: true,
    saved: false,
    uuid: uuid(),
    source: "data:image/png;base64," + fs.readFileSync(t.file).toString("base64"),
  }));
  const model = {
    meta: { format_version: "5.0", model_format: "bedrock_block", box_uv: false },
    name,
    model_identifier: identifier,
    front_gui_light: false,
    visible_box: [1, 1, 0],
    variable_placeholders: "",
    variable_placeholder_buttons: [],
    unhandled_root_fields: {},
    resolution: { width: 16, height: 16 },
    elements,
    groups,
    outliner,
    textures: tex,
  };
  fs.writeFileSync(file, JSON.stringify(model, null, 2));
  return model;
}

/**
 * Assigns face materials and removes hidden faces.
 * classify(face, cube, bone) -> material name or null (null = no face).
 * coverers(bone) -> cubes that can hide this bone's faces (always-visible geometry only).
 */
export function finalizeFaces(bones, classify, coverers) {
  for (const bone of bones) {
    const cov = coverers(bone);
    for (const c of bone.cubes) {
      c.faces ??= {};
      for (const f of FACES) {
        if (c.faces[f] !== undefined) continue;
        if (faceCovered(f, c, cov)) {
          c.faces[f] = null;
          continue;
        }
        const mat = classify(f, c, bone);
        c.faces[f] = mat ? { mat, uv: c.uvs?.[f] } : null;
      }
    }
  }
  return bones;
}

/** Post-fix for Blockbench's Bedrock export (plan §4.5). */
export function postFixGeo(file) {
  const g = JSON.parse(fs.readFileSync(file, "utf8"));
  g.format_version = "1.26.50";
  for (const geo of g["minecraft:geometry"]) {
    delete geo.description.visible_bounds_width;
    delete geo.description.visible_bounds_height;
    delete geo.description.visible_bounds_offset;
  }
  fs.writeFileSync(file, JSON.stringify(g, null, 2) + "\n");
  return g;
}
