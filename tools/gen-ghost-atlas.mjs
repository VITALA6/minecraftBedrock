// Writes the Simmerfield ghost particles (decision D15): the icon atlas and the three particle
// definitions that use it.
//
//   node tools/gen-ghost-atlas.mjs           write them
//   node tools/gen-ghost-atlas.mjs --check   exit 1 if any file differs from what it would write
//                                            (npm test runs this; see tests/ghosts.test.ts)
//
// Outputs (all path-addressed, so namespaced under wm_kitchen/):
//   packs/simmerfield/resource/textures/wm_kitchen/particle/ghost_atlas.png
//   packs/simmerfield/resource/particles/wm_kitchen/ghost_icon.json      wm_kitchen:ghost_icon
//   packs/simmerfield/resource/particles/wm_kitchen/ghost_sparkle.json   wm_kitchen:ghost_sparkle
//   packs/simmerfield/resource/particles/wm_kitchen/ghost_pop.json       wm_kitchen:ghost_pop
//
// The cell list, the atlas layout, the Molang variable names and every tuning number (size,
// lifetime, fade, bob, alpha) come from the pack's own modules (data/ghost-atlas.ts, config.ts,
// stations/ghost-logic.ts), bundled with esbuild as tools/gen-pot-block.mjs does, so the texture,
// the particle JSON and the script can't drift apart.
//
// Icons are our own art only: art/simmerfield/final/<dir>/<name>.png when a hand-finished
// version exists, else art/simmerfield/generated/<dir>/<name>.png (wm_kitchen:<name> -> items/,
// minecraft:<name> -> ingredients/). No Mojang textures. The star and puff cells are drawn here.
// The atlas has no semi-transparent pixels: the ghosts' transparency is the particle's tint alpha
// (particles_blend), not baked into the texture, so the texture linter's no-alpha rule still holds.
// lint-textures.mjs doesn't read this file anyway (it checks art/simmerfield/generated/).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import * as prettier from "prettier";
import { ROOT } from "./paths.mjs";
import { decodePng, encodePng } from "./gen-textures.mjs";

const RP = path.join(ROOT, "packs/simmerfield/resource");
const ART = path.join(ROOT, "art/simmerfield");
const PARTICLE_DIR = path.join(RP, "particles/wm_kitchen");
/** Newest particle format_version vanilla 1.26.52.3 ships (vanilla_1.26.50 poplar leaves). */
const FORMAT_VERSION = "1.26.50";

async function loadData() {
  const s = "./packs/simmerfield/scripts";
  const result = await build({
    stdin: {
      contents: [
        `export { GHOST_ATLAS, GHOST_STAR, GHOST_PUFF, ghostAtlasCells, ghostAtlasSize } from "${s}/data/ghost-atlas";`,
        `export * from "${s}/config";`,
        `export { GHOST_ICON_VARIABLES } from "${s}/stations/ghost-logic";`,
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
// The atlas
// ---------------------------------------------------------------------------------------------

/** Our art for an item id: final/ first, then generated/. */
export function iconSource(id) {
  const [ns, name] = id.split(":");
  const rel = `${ns === "wm_kitchen" ? "items" : "ingredients"}/${name}.png`;
  for (const dir of ["final", "generated"]) {
    const file = path.join(ART, dir, rel);
    if (existsSync(file)) return file;
  }
  throw new Error(`no art for ${id}: expected art/simmerfield/{final,generated}/${rel}`);
}

const WHITE = [255, 255, 255, 255];
const SOFT = [222, 222, 222, 255];
/** The pale ring round each item icon (the tint makes it a soft ghostly halo). */
const OUTLINE = [255, 246, 214, 255];

/** 4-point sparkle star, white (the particle tints it gold): rays 3 px wide at the core, 1 px at
 * the tips, so it still reads when the particle draws it small. 16×16, centre (7, 7). */
function star() {
  const px = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = Math.abs(x - 7);
      const dy = Math.abs(y - 7);
      const vertical = dx <= 1 && dy <= 7 - dx * 3;
      const horizontal = dy <= 1 && dx <= 7 - dy * 3;
      if (vertical || horizontal || dx + dy <= 2) {
        px.set(dx + dy <= 3 ? WHITE : SOFT, (y * 16 + x) * 4);
      }
    }
  }
  return { w: 16, h: 16, px };
}

/** Round puff for the pop burst: white with a slightly darker rim. */
function puff() {
  const px = new Uint8Array(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d <= 6.2) px.set(d > 5 ? SOFT : WHITE, (y * 16 + x) * 4);
    }
  }
  return { w: 16, h: 16, px };
}

function drawAtlas(data) {
  const { GHOST_ATLAS: A, GHOST_STAR, GHOST_PUFF } = data;
  const cells = data.ghostAtlasCells();
  const { w, h } = data.ghostAtlasSize();
  const px = new Uint8Array(w * h * 4);
  cells.forEach((id, i) => {
    let icon;
    if (id === GHOST_STAR) icon = star();
    else if (id === GHOST_PUFF) icon = puff();
    else {
      const file = iconSource(id);
      icon = decodePng(readFileSync(file));
      if (!icon || icon.w !== A.icon || icon.h !== A.icon) {
        throw new Error(`${path.relative(ROOT, file)} must be a ${A.icon}×${A.icon} RGBA PNG`);
      }
    }
    // the icon sits 1 px inside its frame; the frame starts after the cell's padding
    const ox = (i % A.columns) * A.cell + A.pad + 1;
    const oy = Math.floor(i / A.columns) * A.cell + A.pad + 1;
    const solid = (x, y) =>
      x >= 0 && y >= 0 && x < A.icon && y < A.icon && icon.px[(y * A.icon + x) * 4 + 3] > 0;
    const outlined = id !== GHOST_STAR && id !== GHOST_PUFF;
    for (let y = -1; y <= A.icon; y++) {
      for (let x = -1; x <= A.icon; x++) {
        const at = ((oy + y) * w + ox + x) * 4;
        // Hard alpha only: any pixel that shows at all is drawn opaque (see the header).
        if (solid(x, y)) {
          const s = (y * A.icon + x) * 4;
          px.set([icon.px[s], icon.px[s + 1], icon.px[s + 2], 255], at);
        } else if (
          outlined &&
          (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))
        ) {
          px.set(OUTLINE, at);
        }
      }
    }
  });
  return { w, h, px };
}

// ---------------------------------------------------------------------------------------------
// The particles
// ---------------------------------------------------------------------------------------------

const num = (n) => Number(n.toFixed(4));

/** uv of a fixed atlas cell (the star and the puff). */
function cellUv(data, id) {
  const A = data.GHOST_ATLAS;
  const i = data.ghostAtlasCells().indexOf(id);
  return [(i % A.columns) * A.cell + A.pad, Math.floor(i / A.columns) * A.cell + A.pad];
}

function effect(data, identifier, components) {
  return {
    format_version: FORMAT_VERSION,
    particle_effect: {
      description: {
        identifier,
        basic_render_parameters: {
          material: "particles_blend",
          texture: data.GHOST_ATLAS.texture,
        },
      },
      components,
    },
  };
}

function uvBlock(data, uv) {
  const { w, h } = data.ghostAtlasSize();
  const A = data.GHOST_ATLAS;
  return { texture_width: w, texture_height: h, uv, uv_size: [A.frame, A.frame] };
}

/** wm_kitchen:ghost_icon: one floating icon, picked by variable.wm_kitchen_icon, faded in and out, bobbing. */
function ghostIcon(data) {
  const A = data.GHOST_ATLAS;
  const V = Object.fromEntries(
    Object.entries(data.GHOST_ICON_VARIABLES).map(([k, name]) => [k, name.replace(/^variable\./, "v.")]), // prettier-ignore
  );
  const life = num(data.GHOST_LIFETIME_SECONDS);
  const fade = num(data.GHOST_FADE_SECONDS);
  const degreesPerSecond = num(360 / data.GHOST_BOB_SECONDS);
  return effect(data, data.GHOST_PARTICLE.icon, {
    // Defaults, so a spawn without the variables (e.g. /particle) shows cell 0 instead of erroring.
    "minecraft:emitter_initialization": {
      creation_expression: `${V.icon} = ${V.icon} ?? 0; ${V.alpha} = ${V.alpha} ?? ${data.GHOST_ALPHA}; ${V.phase} = ${V.phase} ?? 0;`,
    },
    "minecraft:emitter_rate_instant": { num_particles: 1 },
    "minecraft:emitter_lifetime_once": { active_time: life },
    "minecraft:emitter_shape_point": {},
    "minecraft:particle_lifetime_expression": { max_lifetime: life },
    "minecraft:particle_initial_speed": 0,
    // The bob runs on world time (wm_kitchen_phase is the time within one period at spawn), so the ghost
    // re-spawned every update continues the same wave instead of restarting it.
    "minecraft:particle_motion_parametric": {
      relative_position: [
        0,
        `math.sin((${V.phase} + v.particle_age) * ${degreesPerSecond}) * ${data.GHOST_BOB_HEIGHT}`,
        0,
      ],
    },
    "minecraft:particle_appearance_billboard": {
      size: [data.GHOST_ICON_SIZE, data.GHOST_ICON_SIZE],
      facing_camera_mode: "lookat_xyz",
      uv: uvBlock(data, [
        `math.mod(${V.icon}, ${A.columns}) * ${A.cell} + ${A.pad}`,
        `math.floor(${V.icon} / ${A.columns}) * ${A.cell} + ${A.pad}`,
      ]),
    },
    // Semi-transparent by tint (particles_blend); fades in and out over GHOST_FADE_SECONDS so the
    // old and the re-spawned ghost cross-fade.
    "minecraft:particle_appearance_tinting": {
      color: [
        1,
        1,
        1,
        `${V.alpha} * math.clamp(v.particle_age / ${fade}, 0, 1) * math.clamp((v.particle_lifetime - v.particle_age) / ${fade}, 0, 1)`,
      ],
    },
  });
}

/** wm_kitchen:ghost_sparkle: two gold stars twinkling around a dish that's ready to cook. */
function ghostSparkle(data) {
  const life = num(data.GHOST_LIFETIME_SECONDS + 0.2);
  return effect(data, data.GHOST_PARTICLE.sparkle, {
    "minecraft:emitter_rate_instant": { num_particles: 2 },
    "minecraft:emitter_lifetime_once": { active_time: life },
    "minecraft:emitter_shape_box": {
      half_dimensions: [0.28, 0.18, 0.28],
      surface_only: false,
      direction: [0, 1, 0],
    },
    "minecraft:particle_lifetime_expression": { max_lifetime: `math.random(0.5, ${life})` },
    "minecraft:particle_initial_speed": 0.15,
    "minecraft:particle_motion_dynamic": { linear_drag_coefficient: 1 },
    "minecraft:particle_appearance_billboard": {
      size: [
        "0.07 * math.sin(v.particle_age / v.particle_lifetime * 180)",
        "0.07 * math.sin(v.particle_age / v.particle_lifetime * 180)",
      ],
      facing_camera_mode: "lookat_xyz",
      uv: uvBlock(data, cellUv(data, data.GHOST_STAR)),
    },
    "minecraft:particle_appearance_tinting": { color: [1, 0.87, 0.4, 1] },
  });
}

/** wm_kitchen:ghost_pop: a small white burst where a ghost was filled. */
function ghostPop(data) {
  return effect(data, data.GHOST_PARTICLE.pop, {
    "minecraft:emitter_rate_instant": { num_particles: 6 },
    "minecraft:emitter_lifetime_once": { active_time: 0.4 },
    "minecraft:emitter_shape_sphere": { radius: 0.05, surface_only: true, direction: "outwards" },
    "minecraft:particle_lifetime_expression": { max_lifetime: "math.random(0.25, 0.4)" },
    "minecraft:particle_initial_speed": "math.random(1.2, 2.0)",
    "minecraft:particle_motion_dynamic": { linear_drag_coefficient: 6 },
    "minecraft:particle_appearance_billboard": {
      size: [
        "0.06 * (1 - v.particle_age / v.particle_lifetime) + 0.02",
        "0.06 * (1 - v.particle_age / v.particle_lifetime) + 0.02",
      ],
      facing_camera_mode: "lookat_xyz",
      uv: uvBlock(data, cellUv(data, data.GHOST_PUFF)),
    },
    "minecraft:particle_appearance_tinting": {
      color: [1, 1, 1, "1 - v.particle_age / v.particle_lifetime"],
    },
  });
}

// ---------------------------------------------------------------------------------------------

export async function outputs() {
  const data = await loadData();
  const files = [
    {
      file: path.join(RP, `${data.GHOST_ATLAS.texture}.png`),
      bytes: encodePng(drawAtlas(data)),
    },
  ];
  for (const [name, json] of [
    ["ghost_icon", ghostIcon(data)],
    ["ghost_sparkle", ghostSparkle(data)],
    ["ghost_pop", ghostPop(data)],
  ]) {
    const file = path.join(PARTICLE_DIR, `${name}.json`);
    const options = { ...(await prettier.resolveConfig(file)), filepath: file };
    files.push({ file, bytes: Buffer.from(await prettier.format(JSON.stringify(json), options)) });
  }
  return { data, files };
}

async function main() {
  const { data, files } = await outputs();
  if (process.argv.includes("--check")) {
    const stale = files.filter(
      ({ file, bytes }) => !existsSync(file) || !readFileSync(file).equals(bytes),
    );
    for (const { file } of stale) {
      console.error(`[gen-ghost-atlas] ${path.relative(ROOT, file)} is out of date`);
    }
    if (stale.length > 0) {
      console.error("[gen-ghost-atlas] run node tools/gen-ghost-atlas.mjs");
      process.exitCode = 1;
    } else console.log(`[gen-ghost-atlas] ${files.length} files up to date`);
    return;
  }
  for (const { file, bytes } of files) {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    console.log(`[gen-ghost-atlas] wrote ${path.relative(ROOT, file)}`);
  }
  const { w, h } = data.ghostAtlasSize();
  console.log(`[gen-ghost-atlas] atlas ${w}×${h}, ${data.ghostAtlasCells().length} cells`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
