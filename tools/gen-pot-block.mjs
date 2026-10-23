// Writes packs/harvest_kitchen/behavior/blocks/cooking_pot.json: the pot block with one
// material permutation per liquid colour × look (still, ready glint, boiling) × hot rim.
//
//   node tools/gen-pot-block.mjs           write the block JSON
//   node tools/gen-pot-block.mjs --check   exit 1 if the file differs from what it would write
//                                          (npm test runs this; see tests/pack-files.test.ts)
//
// Why generated: a permutation's minecraft:material_instances replaces the whole component, so
// every combination of the liquid texture (hk:liquid, 9 colours), the ready glint (phase ready or
// done), the hot rim (hk:hot) and the boil needs its own full copy. Per colour: still cold, still
// hot, ready cold, ready hot, boiling (cooking + hot, always hot) = 5 looks, 9 × 5 = 45, so 44
// permutations plus the base. Only the liquid and top textures change between them.
//
// Boiling (fx, agent B): while cooking over heat the liquid and the rim use flipbook textures
// (tools/gen-pot-flipbook.mjs: <liquid>_boil bubbles, top_boil flickers) and the lid is off, so
// the bubbles and the stirring spoon (scripts/fx) show. Cooking without heat is paused: lid on,
// still liquid.
//
// The liquid ids and state names come from the pack's own data (data/liquids.ts, data/stations.ts),
// bundled with esbuild, so the block can't drift from what the scripts set.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import * as prettier from "prettier";
import { ROOT } from "./paths.mjs";

const OUT = path.join(ROOT, "packs/harvest_kitchen/behavior/blocks/cooking_pot.json");
const PHASES = ["idle", "ready", "cooking", "done"];
const READY_PHASES = ["ready", "done"];

async function loadData() {
  const result = await build({
    stdin: {
      contents: [
        'export { LIQUIDS, DEFAULT_LIQUID } from "./packs/harvest_kitchen/scripts/data/liquids";',
        'export { stationById } from "./packs/harvest_kitchen/scripts/data/stations";',
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

const material = (texture) => ({ texture, render_method: "opaque" });
const LOOK_SUFFIX = { still: "", ready: "_ready", boil: "_boil" };
const liquidTexture = (liquid, look) => `hk_cooking_pot_liquid_${liquid}${LOOK_SUFFIX[look]}`;
const topTexture = (look, hot) =>
  look === "boil"
    ? "hk_cooking_pot_top_boil"
    : hot
      ? "hk_cooking_pot_top_hot"
      : "hk_cooking_pot_top";

/** look: "still" | "ready" (phase ready or done) | "boil" (phase cooking with heat). */
function materials(liquid, look, hot) {
  return {
    "*": material("hk_cooking_pot_side"),
    top: material(topTexture(look, hot)),
    liquid: material(liquidTexture(liquid, look)),
    lid: material("hk_cooking_pot_lid"),
  };
}

function blockJson({ LIQUIDS, DEFAULT_LIQUID, stationById }) {
  const pot = stationById("pot");
  const { fill, phase, hot, liquid } = pot.states;
  if (!fill || !phase || !hot || !liquid) throw new Error("the pot config lacks a state");
  if (LIQUIDS[0] !== DEFAULT_LIQUID) throw new Error("the default liquid must come first");

  const q = (state) => `q.block_state('${state}')`;
  const isReady = `(${READY_PHASES.map((p) => `${q(phase)} == '${p}'`).join(" || ")})`;
  const notReady = READY_PHASES.map((p) => `${q(phase)} != '${p}'`).join(" && ");
  const boiling = `${q(phase)} == 'cooking' && ${q(hot)} == true`;
  // Mutually exclusive per colour: exactly one applies to every state combination.
  const LOOKS = [
    { look: "still", hot: false, when: `${notReady} && ${q(hot)} == false` },
    {
      look: "still",
      hot: true,
      when: `${notReady} && ${q(phase)} != 'cooking' && ${q(hot)} == true`,
    },
    { look: "ready", hot: false, when: `${isReady} && ${q(hot)} == false` },
    { look: "ready", hot: true, when: `${isReady} && ${q(hot)} == true` },
    { look: "boil", hot: true, when: boiling },
  ];

  const permutations = [];
  for (const colour of LIQUIDS) {
    for (const { look, hot: isHot, when } of LOOKS) {
      if (colour === DEFAULT_LIQUID && look === "still" && !isHot) continue; // the base components
      permutations.push({
        condition: `${q(liquid)} == '${colour}' && ${when}`,
        components: { "minecraft:material_instances": materials(colour, look, isHot) },
      });
    }
  }
  permutations.push({
    condition: `${q(hot)} == true && ${q(phase)} == 'cooking'`,
    components: { "minecraft:light_emission": 7 },
  });

  return {
    format_version: "1.26.50",
    "minecraft:block": {
      description: {
        identifier: pot.block,
        menu_category: { category: "items" },
        states: {
          [fill.name]: { values: { min: 0, max: fill.levels } },
          [phase]: PHASES,
          [hot]: [false, true],
          [liquid]: [...LIQUIDS],
        },
      },
      components: {
        "hk:container_station": {},
        "minecraft:collision_box": { origin: [-7, 0, -7], size: [14, 10, 14] },
        "minecraft:selection_box": { origin: [-7, 0, -7], size: [14, 10, 14] },
        "minecraft:destructible_by_mining": { seconds_to_destroy: 2.0 },
        "minecraft:destructible_by_explosion": { explosion_resistance: 6 },
        "minecraft:geometry": {
          identifier: "geometry.hk.cooking_pot",
          bone_visibility: {
            liquid_1: `${q(fill.name)} >= 1`,
            liquid_2: `${q(fill.name)} >= 2`,
            liquid_3: `${q(fill.name)} >= 3`,
            // paused (cooking without heat): lid on; boiling: lid off for the bubbles and spoon
            lid: `${q(phase)} == 'cooking' && ${q(hot)} == false`,
          },
        },
        "minecraft:light_dampening": 0,
        "minecraft:light_emission": 0,
        "minecraft:map_color": "#b86a3c",
        "minecraft:material_instances": materials(DEFAULT_LIQUID, "still", false),
        "minecraft:movable": { movement_type: "immovable" },
      },
      permutations,
    },
  };
}

async function main() {
  const json = blockJson(await loadData());
  const options = { ...(await prettier.resolveConfig(OUT)), filepath: OUT };
  const text = await prettier.format(JSON.stringify(json), options);
  const rel = path.relative(ROOT, OUT);
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      // missing counts as different
    }
    if (current !== text) {
      console.error(`[gen-pot-block] ${rel} is out of date: run node tools/gen-pot-block.mjs`);
      process.exitCode = 1;
    } else console.log(`[gen-pot-block] ${rel} is up to date`);
    return;
  }
  writeFileSync(OUT, text);
  console.log(
    `[gen-pot-block] wrote ${rel} (${json["minecraft:block"].permutations.length} permutations)`,
  );
}

await main();
