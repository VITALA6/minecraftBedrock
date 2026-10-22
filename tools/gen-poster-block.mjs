// Writes packs/harvest_kitchen/behavior/blocks/recipe_poster.json: the 2×1 wall poster (D15) with
// one permutation per facing × half × recipe.
//
//   node tools/gen-poster-block.mjs           write the block JSON
//   node tools/gen-poster-block.mjs --check   exit 1 if the file differs from what it would write
//                                             (npm test runs this; see tests/pack-files.test.ts)
//
// Why generated: a permutation's minecraft:material_instances replaces the whole component, and
// whether a material permutation and a transformation permutation combine isn't proven (blockers
// B16 relies on it for the pot), so every permutation carries both: 4 facings (hk:facing) × 2
// halves (hk:right) × the recipes (hk:poster) = one full copy each, the first being the base.
//
// The poster is a minecraft:multi_block with 2 parts (horizontal multi-blocks are stable from
// block format 1.26.50, Microsoft Learn "Create a Multi-Block"). That trait allows only one more
// trait, placement_direction with cardinal_direction, which also decides the direction the parts
// go in. y_rotation_offset turns it 90° so the parts run along the wall instead of into it
// (posters/poster.ts checks where they really land and sets hk:right per part).
//
// The recipe list and the texture names come from the pack's own posters/poster-logic.ts, bundled
// with esbuild, so the block can't drift from what the scripts set.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import * as prettier from "prettier";
import { ROOT } from "./paths.mjs";

const OUT = path.join(ROOT, "packs/harvest_kitchen/behavior/blocks/recipe_poster.json");

/** The parts run 90° from the player's facing, i.e. along the wall they look at. */
const Y_ROTATION_OFFSET = 90;

/** Model front faces north; transformation rotation per hk:facing (as the cutting board). */
const ROTATION = { north: 0, west: 90, south: 180, east: 270 };

async function loadData() {
  const result = await build({
    stdin: {
      contents: [
        'export * from "./packs/harvest_kitchen/scripts/posters/poster-logic";',
        'export { BLOCK_RECIPE_POSTER, COMPONENT_RECIPE_POSTER, STATE_POSTER, STATE_FACING, STATE_RIGHT } from "./packs/harvest_kitchen/scripts/config";',
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

function blockJson(d) {
  if (d.POSTER_COUNT > d.POSTER_MAX_STATES) {
    throw new Error(`${d.POSTER_COUNT} poster states: an int state holds at most 16 (add a state)`);
  }
  const q = (state) => `q.block_state('${state}')`;
  const look = (facing, half, index) => ({
    "minecraft:material_instances": {
      "*": { texture: d.halfTexture(index, half).shortname, render_method: "opaque" },
    },
    "minecraft:transformation": { rotation: [0, ROTATION[facing], 0] },
  });

  const permutations = [];
  for (const facing of d.FACINGS) {
    for (const half of d.HALVES) {
      for (const index of d.posterIndices()) {
        if (facing === d.FACINGS[0] && half === d.HALVES[0] && index === 0) continue; // the base
        permutations.push({
          condition: [
            `${q(d.STATE_FACING)} == '${facing}'`,
            `${q(d.STATE_RIGHT)} == ${half === "right"}`,
            `${q(d.STATE_POSTER)} == ${index}`,
          ].join(" && "),
          components: look(facing, half, index),
        });
      }
    }
  }

  const box = { origin: [-8, 0, 7], size: [16, 16, 1] }; // 1 px deep, against the wall (south)
  return {
    format_version: "1.26.50",
    "minecraft:block": {
      description: {
        identifier: d.BLOCK_RECIPE_POSTER,
        menu_category: { category: "items" },
        states: {
          [d.STATE_POSTER]: { values: { min: 0, max: d.POSTER_COUNT - 1 } },
          [d.STATE_FACING]: [...d.FACINGS],
          [d.STATE_RIGHT]: [false, true],
        },
        traits: {
          "minecraft:placement_direction": {
            enabled_states: ["minecraft:cardinal_direction"],
            y_rotation_offset: Y_ROTATION_OFFSET,
          },
          "minecraft:multi_block": {
            enabled_states: ["minecraft:multi_block_part"],
            parts: 2,
            direction: "north",
          },
        },
      },
      components: {
        [d.COMPONENT_RECIPE_POSTER]: {},
        "minecraft:collision_box": box,
        "minecraft:selection_box": box,
        "minecraft:destructible_by_mining": { seconds_to_destroy: 0.5 },
        "minecraft:destructible_by_explosion": { explosion_resistance: 0.5 },
        "minecraft:flammable": { catch_chance_modifier: 30, destroy_chance_modifier: 60 },
        "minecraft:geometry": { identifier: "geometry.hk.recipe_poster" },
        "minecraft:light_dampening": 0,
        // Both parts drop nothing; posters/poster.ts drops one poster per break.
        "minecraft:loot": "loot_tables/hk/blocks/nothing.json",
        "minecraft:map_color": "#eedcb0",
        ...look(d.FACINGS[0], d.HALVES[0], 0),
        "minecraft:movable": { movement_type: "popped" },
        // No minecraft:placement_filter: re-checked on the trait's second part (placed against
        // no face) or after the script's state fix-up, it removed the poster right after placing
        // (2026-10-22). Floors and ceilings are refused in beforeOnPlayerPlace, and the wall
        // going is handled by posters/poster-support.ts from hk:facing.
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
      console.error(
        `[gen-poster-block] ${rel} is out of date: run node tools/gen-poster-block.mjs`,
      );
      process.exitCode = 1;
    } else console.log(`[gen-poster-block] ${rel} is up to date`);
    return;
  }
  writeFileSync(OUT, text);
  console.log(
    `[gen-poster-block] wrote ${rel} (${json["minecraft:block"].permutations.length} permutations)`,
  );
}

await main();
