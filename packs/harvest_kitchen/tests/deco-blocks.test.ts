import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

// The decorative kitchen blocks (art/harvest_kitchen/models/_tools/make-kitchen-deco.mjs): every
// block has its geometry, textures, item, lang keys, sound and recipe, and faces the player.
// Paths are repo-relative (tools/test.mjs runs from the repo root).

const PACK = "packs/harvest_kitchen";
const BP = `${PACK}/behavior`;
const RP = `${PACK}/resource`;
const MODELS = "art/harvest_kitchen/models";

const DECO = [
  "kitchen_counter",
  "kitchen_cabinet",
  "spice_shelf",
  "kitchen_sink",
  "kitchen_stove",
  "hanging_pan",
  "pickle_jar",
  "vegetable_basket",
] as const;

/** Where each one may be placed: no filter (any face), on top of a block, or under one. */
const FACES: Record<(typeof DECO)[number], string[] | undefined> = {
  kitchen_counter: undefined,
  kitchen_cabinet: undefined,
  spice_shelf: undefined,
  kitchen_sink: undefined,
  kitchen_stove: undefined,
  hanging_pan: ["down"],
  pickle_jar: ["up"],
  vegetable_basket: ["up"],
};

type Json = Record<string, unknown>;
const read = (path: string) => readFileSync(path, "utf8");
const json = (path: string) => JSON.parse(read(path)) as Json;
const obj = (value: unknown, where: string): Json => {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), where);
  return value as Json;
};

interface Box {
  origin: [number, number, number];
  size: [number, number, number];
}
interface Permutation {
  condition: string;
  components: { "minecraft:transformation"?: { rotation: number[] } };
}
interface Geo {
  format_version: string;
  "minecraft:geometry": {
    description: { identifier: string };
    bones: {
      cubes?: {
        origin: number[];
        size: number[];
        uv: Record<string, { material_instance?: string }>;
      }[];
    }[];
  }[];
}

const terrain = obj(json(`${RP}/textures/terrain_texture.json`).texture_data, "terrain");
const itemTextures = obj(json(`${RP}/textures/item_texture.json`).texture_data, "item textures");
const soundOf = json(`${RP}/blocks.json`);
const lang = new Set(
  read(`${RP}/texts/en_US.lang`)
    .split("\n")
    .map((line) => line.slice(0, line.indexOf("=")).trim())
    .filter(Boolean),
);

/** Width and height from a PNG's IHDR (read as latin1 so each char is one byte). */
function pngSize(path: string): [number, number] {
  const b = read(path);
  const u32 = (at: number) =>
    ((b.charCodeAt(at) << 24) |
      (b.charCodeAt(at + 1) << 16) |
      (b.charCodeAt(at + 2) << 8) |
      b.charCodeAt(at + 3)) >>>
    0;
  assert.equal(b.slice(12, 16), "IHDR", path);
  return [u32(16), u32(20)];
}

/** A terrain/item shortname: hk_ prefixed, registered, its PNG present and 16×16. */
function checkTexture(table: Json, shortname: string, where: string) {
  assert.match(shortname, /^hk_/, where);
  const entry = obj(table[shortname], `${where}: ${shortname} registered`);
  const path = `${RP}/${String(entry.textures)}.png`;
  assert.match(String(entry.textures), /^textures\/hk\//, `${where}: ${shortname} under hk/`);
  assert.ok(existsSync(path), `${where}: ${path}`);
  assert.deepEqual(pngSize(path), [16, 16], `${where}: ${path} is 16×16 (vanilla texel density)`);
}

describe("kitchen decor blocks", () => {
  it("textures and geometry match make-kitchen-deco.mjs (art/ and the pack)", () => {
    const run = spawnSync("node", [`${MODELS}/_tools/make-kitchen-deco.mjs`, "--check"], {
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });

  for (const id of DECO) {
    describe(`hk:${id}`, () => {
      const blockFile = json(`${BP}/blocks/${id}.json`);
      const block = obj(blockFile["minecraft:block"], "minecraft:block");
      const description = obj(block.description, "description");
      const components = obj(block.components, "components");

      it("block format 1.26.50, creative menu, own geometry with matching materials", () => {
        assert.equal(blockFile.format_version, "1.26.50");
        assert.equal(description.identifier, `hk:${id}`);
        assert.deepEqual(description.menu_category, { category: "items" });
        assert.deepEqual(components["minecraft:geometry"], { identifier: `geometry.hk.${id}` });

        const geoPath = `${RP}/models/blocks/hk/${id}.geo.json`;
        assert.ok(existsSync(geoPath), geoPath);
        const geo = JSON.parse(read(geoPath)) as Geo;
        assert.equal(geo.format_version, "1.26.50");
        const g = geo["minecraft:geometry"][0];
        assert.ok(g, "one geometry");
        assert.equal(g.description.identifier, `geometry.hk.${id}`);
        assert.equal(
          Object.keys(g.description).sort().join(),
          "identifier,texture_height,texture_width",
        );

        const used = new Set<string>();
        for (const bone of g.bones)
          for (const cube of bone.cubes ?? []) {
            for (const face of Object.values(cube.uv)) used.add(face.material_instance ?? "*");
            // inside the 30-texel model limit: x, z within -15..15, y within 0..30
            for (const axis of [0, 2])
              assert.ok(
                (cube.origin[axis] ?? 0) >= -15 &&
                  (cube.origin[axis] ?? 0) + (cube.size[axis] ?? 0) <= 15,
              );
            assert.ok(
              (cube.origin[1] ?? 0) >= 0 && (cube.origin[1] ?? 0) + (cube.size[1] ?? 0) <= 30,
            );
          }
        const materials = obj(components["minecraft:material_instances"], "material_instances");
        assert.deepEqual(
          Object.keys(materials).sort(),
          [...used].sort(),
          "materials = geo materials",
        );
        for (const [name, m] of Object.entries(materials)) {
          const mat = obj(m, name);
          assert.equal(mat.render_method, "opaque", `${name}: textures are fully opaque`);
          checkTexture(terrain, String(mat.texture), `${id}.${name}`);
        }
      });

      it("faces the player: cardinal_direction with a 180° offset, one rotation per direction", () => {
        const traits = obj(description.traits, "traits");
        assert.deepEqual(traits["minecraft:placement_direction"], {
          enabled_states: ["minecraft:cardinal_direction"],
          y_rotation_offset: 180,
        });
        const perms = block.permutations as Permutation[];
        const want: Record<string, number> = { north: 0, west: 90, south: 180, east: 270 };
        assert.equal(perms.length, 4);
        for (const [dir, deg] of Object.entries(want)) {
          const p = perms.find(
            (x) => x.condition === `query.block_state('minecraft:cardinal_direction') == '${dir}'`,
          );
          assert.ok(p, dir);
          assert.deepEqual(p.components["minecraft:transformation"]?.rotation, [0, deg, 0], dir);
        }
      });

      it("boxes stay inside the block; small pieces have their placement rule", () => {
        for (const key of ["minecraft:collision_box", "minecraft:selection_box"]) {
          const box = components[key] as Box;
          for (const axis of [0, 1, 2]) {
            const lo = axis === 1 ? 0 : -8;
            const origin = box.origin[axis] ?? Number.NaN;
            const size = box.size[axis] ?? Number.NaN;
            assert.ok(origin >= lo, `${key} origin ${axis}`);
            assert.ok(origin + size <= lo + 16, `${key} size ${axis}`);
            assert.ok(size > 0, `${key} size ${axis}`);
          }
        }
        const filter = components["minecraft:placement_filter"] as
          { conditions: { allowed_faces: string[] }[] } | undefined;
        assert.deepEqual(filter?.conditions[0]?.allowed_faces, FACES[id]);
        if (FACES[id])
          assert.deepEqual(components["minecraft:movable"], { movement_type: "popped" });
        // drops itself: no loot override, so the block drops its (same-id) item
        assert.equal(components["minecraft:loot"], undefined);
      });

      it("same-id placer item with an icon, a tile name, a sound", () => {
        const item = obj(json(`${BP}/items/${id}.json`)["minecraft:item"], "minecraft:item");
        const itemComponents = obj(item.components, "item components");
        assert.deepEqual(obj(item.description, "item description"), {
          identifier: `hk:${id}`,
          menu_category: { category: "items" },
        });
        assert.deepEqual(itemComponents["minecraft:block_placer"], {
          block: `hk:${id}`,
          replace_block_item: true,
        });
        assert.deepEqual(itemComponents["minecraft:display_name"], { value: `tile.hk:${id}.name` });
        assert.deepEqual(itemComponents["minecraft:icon"], { textures: { default: `hk_${id}` } });
        checkTexture(itemTextures, `hk_${id}`, `${id} icon`);
        assert.ok(lang.has(`tile.hk:${id}.name`), "tile key");
        assert.ok(lang.has(`item.hk:${id}.name`), "item key");
        assert.ok(obj(soundOf[`hk:${id}`], "blocks.json entry").sound, "sound");
      });

      it("crafted on the vanilla table (shaped), unlocked by its key ingredient or a station", () => {
        const recipe = obj(json(`${BP}/recipes/${id}.json`)["minecraft:recipe_shaped"], "shaped");
        assert.deepEqual(recipe.tags, ["crafting_table"]);
        assert.deepEqual(obj(recipe.description, "description").identifier, `hk:${id}`);
        assert.equal(obj(recipe.result, "result").item, `hk:${id}`);
        const unlock = (recipe.unlock as { item?: string }[]).map((u) => u.item);
        assert.ok(unlock.includes("hk:cooking_pot") && unlock.includes("hk:cutting_board"));
        assert.ok(unlock.length >= 3);
        const pattern = recipe.pattern as string[];
        const key = obj(recipe.key, "key");
        for (const ch of pattern.join("").replace(/ /g, "")) assert.ok(key[ch], `key '${ch}'`);
      });
    });
  }

  it("no two deco recipes share a grid (pattern + ingredients)", () => {
    const grids = DECO.map((id) => {
      const r = obj(json(`${BP}/recipes/${id}.json`)["minecraft:recipe_shaped"], id);
      const key = obj(r.key, "key");
      return (r.pattern as string[])
        .map((row) => [...row].map((ch) => (ch === " " ? "_" : JSON.stringify(key[ch]))).join(","))
        .join("|");
    });
    assert.equal(new Set(grids).size, grids.length);
  });
});
