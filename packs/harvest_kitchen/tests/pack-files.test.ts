import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { COMPONENT_GUIDE_BOOK, ITEM_GUIDE_BOOK } from "../scripts/config";
import { HK_ITEM_IDS } from "../scripts/discovery/unlock";
import { readParams } from "../scripts/crops/growth-logic";
import { CROPS } from "../scripts/data/crops";
import { DISHES, FAMILIES } from "../scripts/data/dishes";
import { EFFECT_ICONS, UI_ICONS, itemIcon } from "../scripts/data/icons";
import { LIQUIDS } from "../scripts/data/liquids";
import { CRAFTING_RECIPES, STATION_RECIPES, craftingJsonIds } from "../scripts/data/recipes";
import { STATIONS, stationById } from "../scripts/data/stations";
import { GUIDE_TOPICS } from "../scripts/guide/guide-pages";
import {
  FACINGS,
  HALVES,
  POSTER_COUNT,
  POSTER_MAX_STATES,
  POSTER_PAGES,
  POSTER_TEXTURE_DIR,
  halfOfPart,
  halfTexture,
  posterIndices,
  posterStates,
} from "../scripts/posters/poster-logic";
import { evalCondition, type MolangValue } from "./molang";

// What validate.ts can't check in game (texture files, lang keys, and the food values in the item
// JSON, whose ItemFoodComponent reads throw in 1.26.52), checked offline against the pack's files.
// tools/test.mjs runs tests from the repo root, so paths are repo-relative.

const PACK = "packs/harvest_kitchen";
const BP = `${PACK}/behavior`;
const RP = `${PACK}/resource`;

const read = (path: string) => readFileSync(path, "utf8");
const jsonFiles = (dir: string) =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ file: `${dir}/${f}`, json: JSON.parse(read(`${dir}/${f}`)) as unknown }));

interface ItemJson {
  "minecraft:item": {
    description: { identifier: string };
    components: {
      "minecraft:display_name"?: { value: string };
      "minecraft:food"?: {
        nutrition?: number;
        can_always_eat?: boolean;
        using_converts_to?: string;
      };
    };
  };
}

interface ShapelessJson {
  "minecraft:recipe_shapeless"?: {
    description: { identifier: string };
    tags: string[];
    ingredients: { item?: string; tag?: string }[];
    result: { item: string; count?: number };
  };
}

interface BlockJson {
  "minecraft:block": {
    description: {
      identifier: string;
      states?: Record<string, { values: { min: number; max: number } } | unknown[]>;
    };
    components: Record<string, unknown>;
    permutations?: { condition: string; components: Record<string, unknown> }[];
  };
}

const items = new Map(
  jsonFiles(`${BP}/items`).map(({ json }) => {
    const item = json as ItemJson;
    return [item["minecraft:item"].description.identifier, item["minecraft:item"]] as const;
  }),
);
const blocks = new Map(
  jsonFiles(`${BP}/blocks`).map(({ json }) => {
    const block = json as BlockJson;
    return [block["minecraft:block"].description.identifier, block["minecraft:block"]] as const;
  }),
);

/**
 * HK items without an item JSON: blocks whose own block item is the item. None since the Kitchen
 * Table went (2026-10-23); a full cube added later would be one, named by its tile key.
 */
const blockItems = new Set([...blocks.keys()].filter((id) => !items.has(id)));

const langKeys = new Set(
  read(`${RP}/texts/en_US.lang`)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("##"))
    .map((line) => line.slice(0, line.indexOf("="))),
);

function scriptSources(): string {
  const dir = `${PACK}/scripts`;
  return readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".ts"))
    .map((f) => read(`${dir}/${f}`))
    .join("\n");
}

describe("lang keys", () => {
  const used = new Set(
    [...scriptSources().matchAll(/"(hk\.[a-z0-9_.]+)"/g)]
      .map((m) => m[1] as string)
      .filter((key) => !key.endsWith(".")), // prefixes used by checks.ts
  );

  it("every hk. key the scripts use exists in resource/texts/en_US.lang", () => {
    assert.deepEqual(
      [...used].filter((key) => !langKeys.has(key)),
      [],
    );
  });

  it("every hk. key in the lang file is used", () => {
    assert.deepEqual(
      [...langKeys].filter((key) => key.startsWith("hk.") && !used.has(key)),
      [],
    );
  });

  it("data lang keys exist: crop hints, station names, families", () => {
    const keys = [
      ...CROPS.map((c) => c.whereKey),
      ...STATIONS.map((s) => s.nameKey),
      ...Object.values(FAMILIES).flatMap((f) => [f.nameKey, f.hintKey]),
    ];
    assert.deepEqual(
      keys.filter((key) => !langKeys.has(key)),
      [],
    );
  });

  it("every HK item has a display name in the lang file", () => {
    const missing = HK_ITEM_IDS.filter((id) => {
      const key = blockItems.has(id)
        ? `tile.${id}.name`
        : items.get(id)?.components["minecraft:display_name"]?.value;
      return !key || !langKeys.has(key);
    });
    assert.deepEqual(missing, []);
  });
});

describe("icons", () => {
  it("every HK item has an item JSON, or is a block's own item", () => {
    assert.deepEqual(
      HK_ITEM_IDS.filter((id) => !items.has(id) && !blockItems.has(id)),
      [],
    );
    assert.deepEqual(
      [...blockItems].filter((id) => HK_ITEM_IDS.includes(id)),
      [],
    );
  });

  it("every textures/hk/ icon the forms use exists as a PNG", () => {
    const paths = [
      ...HK_ITEM_IDS.map((id) => itemIcon(id)),
      ...Object.values(UI_ICONS),
      ...Object.values(FAMILIES).map((f) => f.icon),
      ...Object.values(EFFECT_ICONS),
    ].filter((p): p is string => p !== undefined && p.startsWith("textures/hk/"));
    assert.ok(paths.length > 30);
    assert.deepEqual(
      paths.filter((p) => !existsSync(`${RP}/${p}.png`)),
      [],
    );
  });
});

describe("item JSON against data/dishes.ts", () => {
  for (const dish of DISHES) {
    if (dish.slices) continue; // eaten from the placed block, not as an item
    it(`${dish.id}: nutrition, can_always_eat and the container match`, () => {
      const food = items.get(dish.id)?.components["minecraft:food"];
      assert.ok(food, "minecraft:food");
      assert.equal(food.nutrition, dish.nutrition);
      assert.equal(food.can_always_eat ?? false, dish.canAlwaysEat);
      assert.equal(food.using_converts_to, dish.container);
    });
  }
});

describe("crafting JSON against CRAFTING_RECIPES (the posters' copy)", () => {
  const shapeless = new Map(
    jsonFiles(`${BP}/recipes`)
      .map(({ json }) => (json as ShapelessJson)["minecraft:recipe_shapeless"])
      .filter((r) => r !== undefined)
      .map((r) => [r.description.identifier, r] as const),
  );

  for (const recipe of CRAFTING_RECIPES) {
    it(`${recipe.id}: same result and ingredients, crafting table (one JSON per alternative)`, () => {
      const tags = ["crafting_table"];
      for (const variant of craftingJsonIds(recipe)) {
        const json = shapeless.get(variant.id);
        assert.ok(json, `behavior/recipes has no shapeless ${variant.id}`);
        assert.equal(json.result.item, recipe.result);
        assert.equal(json.result.count ?? 1, recipe.count);
        assert.deepEqual(json.tags, tags, variant.id);
        const fromJson = json.ingredients.map((i) => i.item ?? `tag:${i.tag}`).sort();
        assert.deepEqual(fromJson, [...variant.items].sort(), variant.id);
      }
    });
  }

  it("every shapeless recipe in the JSON is in the data, and every recipe uses the vanilla table", () => {
    const known = new Set(CRAFTING_RECIPES.flatMap((r) => craftingJsonIds(r).map((v) => v.id)));
    const tools = ["hk:cooking_pot", "hk:cutting_board", "hk:recipe_poster", "hk:guide_book"]; // not food
    for (const r of shapeless.values()) {
      const id = r.description.identifier;
      assert.ok(known.has(id) || tools.includes(id), `${id}: not in CRAFTING_RECIPES`);
    }
    for (const { file, json } of jsonFiles(`${BP}/recipes`)) {
      const recipe = json as Record<string, { tags?: string[] } | undefined>;
      const body = recipe["minecraft:recipe_shaped"] ?? recipe["minecraft:recipe_shapeless"];
      assert.deepEqual(body?.tags, ["crafting_table"], file);
    }
    assert.equal(blocks.has("hk:kitchen_table"), false, "the Kitchen Table is gone (2026-10-23)");
  });
});

describe("mixes (D16)", () => {
  it("every mix is an item that isn't food, has a name and an icon", () => {
    const mixes = STATION_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items));
    assert.equal(mixes.length, STATION_RECIPES.length);
    for (const id of mixes) {
      const item = items.get(id);
      assert.ok(item, id);
      assert.equal(item.components["minecraft:food"], undefined, `${id} isn't eaten raw`);
      assert.ok(langKeys.has(`item.${id}.name`), id);
      assert.ok(existsSync(`${RP}/${itemIcon(id) ?? ""}.png`), id);
    }
  });
});

describe("crop block JSON against data/crops.ts", () => {
  for (const crop of CROPS) {
    it(`${crop.block}: type, stages and pick reset stage`, () => {
      const block = blocks.get(crop.block);
      assert.ok(block, "block JSON");
      const growth = readParams(block.components["hk:crop_growth"], crop.block);
      assert.equal(growth.type, crop.type);
      const state = block.description.states?.["hk:growth"];
      assert.ok(state && !Array.isArray(state), "hk:growth range state");
      assert.deepEqual(state.values, { min: 0, max: growth.maxStage });
      if (crop.pickResetStage !== undefined) {
        assert.ok(crop.pickResetStage < growth.maxStage, "a picked bush must drop back a stage");
      }
    });
  }
});

describe("crop loot tables", () => {
  interface LootJson {
    pools?: { entries: { name?: string }[] }[];
  }
  const drops = (path: unknown) => {
    assert.equal(typeof path, "string");
    const file = `${BP}/${path as string}`;
    assert.ok(existsSync(file), file);
    const loot = JSON.parse(read(file)) as LootJson;
    return [...new Set((loot.pools ?? []).flatMap((p) => p.entries.map((e) => e.name)))].sort();
  };

  for (const crop of CROPS) {
    it(`${crop.block}: young drops the seed, mature adds the produce`, () => {
      const block = blocks.get(crop.block);
      assert.ok(block, "block JSON");
      const young = drops(block.components["minecraft:loot"]);
      assert.deepEqual(young, [crop.seed]);
      const last = readParams(block.components["hk:crop_growth"], crop.block).maxStage;
      const mature = block.permutations?.find(
        (p) => p.condition === `query.block_state('hk:growth') == ${last}`,
      );
      assert.ok(mature, "a permutation for the last stage");
      assert.deepEqual(
        drops(mature.components["minecraft:loot"]),
        [...new Set([crop.produce, crop.seed])].sort(),
      );
    });
  }
});

describe("station and placed-dish block states against the data", () => {
  const states = (id: string) => blocks.get(id)?.description.states ?? {};

  for (const station of STATIONS) {
    it(`${station.block}: fill range, phase values, hot flag and liquid colours`, () => {
      const declared = states(station.block);
      const { fill, phase, hot, liquid } = station.states;
      if (fill) assert.deepEqual(declared[fill.name], { values: { min: 0, max: fill.levels } });
      if (phase) assert.deepEqual(declared[phase], ["idle", "ready", "cooking", "done"]);
      if (hot) assert.deepEqual(declared[hot], [false, true]);
      if (liquid) assert.deepEqual(declared[liquid], [...LIQUIDS]);
    });
  }

  for (const dish of DISHES) {
    if (!dish.slices) continue;
    it(`${dish.slices.block}: one hk:slices value per slice`, () => {
      const count = dish.slices?.count ?? 0;
      assert.deepEqual(states(dish.slices?.block ?? "")["hk:slices"], {
        values: { min: 0, max: count - 1 },
      });
    });
  }
});

describe("same-id placer items (B3)", () => {
  interface PlacerJson {
    description: { identifier: string; menu_category?: { category?: string } };
    components: { "minecraft:block_placer"?: { block?: string; replace_block_item?: boolean } };
  }
  interface CategoryJson {
    description: { menu_category?: { category?: string } };
  }
  const placers = [...items.values()]
    .map((item) => item as unknown as PlacerJson)
    .filter((item) => item.components["minecraft:block_placer"]?.replace_block_item === true);

  it("the stations, the cake, the poster and the kitchen decor replace their block's item", () => {
    assert.deepEqual(placers.map((p) => p.description.identifier).sort(), [
      "hk:cooking_pot",
      "hk:cutting_board",
      "hk:hanging_pan",
      "hk:kitchen_cabinet",
      "hk:kitchen_counter",
      "hk:kitchen_sink",
      "hk:kitchen_stove",
      "hk:pickle_jar",
      "hk:recipe_poster",
      "hk:spice_shelf",
      "hk:strawberry_cake",
      "hk:vegetable_basket",
    ]);
  });

  for (const placer of placers) {
    const id = placer.description.identifier;
    // Vanilla's red_shrub item uses category none (its block carries nature). Copied here, that hid
    // all four from the creative menu and the recipe book (seen in game 2026-10-22), so the item
    // carries the category itself.
    it(`${id}: same id as its block; the item is in the creative menu`, () => {
      assert.equal(placer.components["minecraft:block_placer"]?.block, id);
      assert.equal(placer.description.menu_category?.category, "items");
      const block = blocks.get(id) as unknown as CategoryJson | undefined;
      assert.ok(block, "block JSON");
      assert.notEqual(block.description.menu_category?.category ?? "none", "none");
    });
  }
});

describe("station recipes unlock in the recipe book (recipes-cheatsheet.md)", () => {
  interface UnlockJson {
    tags: string[];
    unlock: { item?: string; tag?: string }[];
    result: { item: string };
  }
  const recipe = (name: string) => {
    const json = JSON.parse(read(`${BP}/recipes/${name}.json`)) as Record<string, UnlockJson>;
    const body = json["minecraft:recipe_shaped"] ?? json["minecraft:recipe_shapeless"];
    assert.ok(body, name);
    return body;
  };
  const unlockItems = (name: string) => recipe(name).unlock.map((u) => u.item);
  const seeds = CROPS.map((crop) => crop.seed);

  for (const name of ["cooking_pot", "cutting_board", "recipe_poster"]) {
    it(`${name}: crafted on the vanilla table, makes hk:${name}`, () => {
      assert.deepEqual(recipe(name).tags, ["crafting_table"]);
      assert.equal(recipe(name).result.item, `hk:${name}`);
    });
  }

  for (const name of ["cooking_pot", "cutting_board"]) {
    it(`${name}: unlocks on every crop's seed (the first HK item a player gets)`, () => {
      const unlock = unlockItems(name);
      for (const seed of seeds) assert.ok(unlock.includes(seed), `${name} misses ${seed}`);
    });
  }

  it("the pot also unlocks on its key ingredients (iron, bowl)", () => {
    assert.ok(unlockItems("cooking_pot").includes("minecraft:iron_ingot"));
    assert.ok(unlockItems("cooking_pot").includes("minecraft:bowl"));
  });

  it("the poster unlocks on every crop's produce (its hk:crops ingredient)", () => {
    const unlock = unlockItems("recipe_poster");
    for (const crop of CROPS) assert.ok(unlock.includes(crop.produce), crop.produce);
  });
});

describe("cooking pot looks (tools/gen-pot-block.mjs)", () => {
  const pot = stationById("pot");
  const block = blocks.get("hk:cooking_pot");
  const terrain = (
    JSON.parse(read(`${RP}/textures/terrain_texture.json`)) as {
      texture_data: Record<string, { textures: string }>;
    }
  ).texture_data;
  type Materials = Record<string, { texture: string; render_method?: string }>;
  const permutations: { condition: string; components: Record<string, unknown> }[] =
    block?.permutations ?? [];

  it("the block JSON is what the generator writes", () => {
    const run = spawnSync("node", ["tools/gen-pot-block.mjs", "--check"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });

  it("every liquid colour has its plain and ready texture, registered with an hk_ shortname", () => {
    for (const liquid of LIQUIDS) {
      for (const name of [`cooking_pot_liquid_${liquid}`, `cooking_pot_liquid_${liquid}_ready`]) {
        assert.equal(terrain[`hk_${name}`]?.textures, `textures/hk/blocks/${name}`, name);
        assert.ok(existsSync(`${RP}/textures/hk/blocks/${name}.png`), `${name}.png`);
      }
    }
  });

  it("every texture the pot names exists, and every material is opaque (plan §5.1)", () => {
    assert.ok(block);
    const all = [
      block.components["minecraft:material_instances"] as Materials,
      ...permutations.map(
        (p) => p.components["minecraft:material_instances"] as Materials | undefined,
      ),
    ].filter((m): m is Materials => m !== undefined);
    for (const materials of all) {
      for (const [slot, { texture, render_method }] of Object.entries(materials)) {
        assert.equal(render_method, "opaque", `${slot}: ${texture}`);
        const path = terrain[texture]?.textures;
        assert.ok(path, `${texture} in terrain_texture.json`);
        assert.ok(existsSync(`${RP}/${path}.png`), `${path}.png`);
      }
    }
  });

  it("every state combination shows its liquid colour, the ready glint, the hot rim and the light", () => {
    assert.ok(block && pot);
    const { fill, phase, hot, liquid } = pot.states;
    assert.ok(fill && phase && hot && liquid);
    const base = block.components["minecraft:material_instances"] as Materials;
    let combinations = 0;
    for (let level = 0; level <= fill.levels; level++) {
      for (const ph of ["idle", "ready", "cooking", "done"]) {
        for (const isHot of [false, true]) {
          for (const colour of LIQUIDS) {
            combinations++;
            const states: Record<string, MolangValue> = {
              [fill.name]: level,
              [phase]: ph,
              [hot]: isHot,
              [liquid]: colour,
            };
            const applied = permutations.filter((p) => evalCondition(p.condition, states));
            const withMaterials = applied.filter(
              (p) => p.components["minecraft:material_instances"] !== undefined,
            );
            const where = JSON.stringify(states);
            assert.ok(withMaterials.length <= 1, `${where}: several material permutations`);
            const materials: Materials =
              (withMaterials[0]?.components["minecraft:material_instances"] as
                Materials | undefined) ?? base;
            const ready = ph === "ready" || ph === "done";
            const boiling = ph === "cooking" && isHot; // flipbook looks (tests/fx-pot.test.ts)
            assert.equal(
              materials.liquid?.texture,
              `hk_cooking_pot_liquid_${colour}${ready ? "_ready" : boiling ? "_boil" : ""}`,
              where,
            );
            assert.equal(
              materials.top?.texture,
              boiling
                ? "hk_cooking_pot_top_boil"
                : isHot
                  ? "hk_cooking_pot_top_hot"
                  : "hk_cooking_pot_top",
              where,
            );
            const light: unknown = applied
              .map((p) => p.components["minecraft:light_emission"])
              .find((v) => v !== undefined);
            assert.equal(light ?? 0, isHot && ph === "cooking" ? 7 : 0, `${where}: light`);
          }
        }
      }
    }
    // the bit budget (states share 16 bits): 4 × 4 × 2 × 9 = 288, 2 + 2 + 1 + 4 = 9 bits
    assert.equal(combinations, (fill.levels + 1) * 4 * 2 * LIQUIDS.length);
    const bits = (n: number) => Math.ceil(Math.log2(n));
    assert.ok(bits(fill.levels + 1) + bits(4) + bits(2) + bits(LIQUIDS.length) <= 16);
  });
});

describe("strawberry cake support (B15)", () => {
  const cake = blocks.get("hk:strawberry_cake");

  it("can only be placed on top of a block, and pops when pushed", () => {
    assert.ok(cake);
    assert.deepEqual(cake.components["minecraft:placement_filter"], {
      conditions: [{ allowed_faces: ["up"] }],
    });
    assert.deepEqual(cake.components["minecraft:movable"], { movement_type: "popped" });
  });

  it("drops nothing when it pops or breaks (no free cake)", () => {
    assert.ok(cake);
    const path = cake.components["minecraft:loot"];
    assert.equal(typeof path, "string");
    const loot = JSON.parse(read(`${BP}/${path as string}`)) as {
      pools?: { entries?: unknown[] }[];
    };
    assert.deepEqual(
      (loot.pools ?? []).flatMap((p) => p.entries ?? []),
      [],
    );
  });
});

describe("recipe poster (D15)", () => {
  const poster = blocks.get("hk:recipe_poster");
  const terrain = (
    JSON.parse(read(`${RP}/textures/terrain_texture.json`)) as {
      texture_data: Record<string, { textures: string }>;
    }
  ).texture_data;
  type Materials = Record<string, { texture: string; render_method?: string }>;
  interface PosterDescription {
    traits?: Record<string, Record<string, unknown>>;
  }

  it("the block JSON is what the generator writes", () => {
    const run = spawnSync("node", ["tools/gen-poster-block.mjs", "--check"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr || run.stdout);
  });

  it("every poster state has both halves: a 64×64 PNG with an hk_poster_ shortname", () => {
    const pngs = new Set(readdirSync(`${RP}/${POSTER_TEXTURE_DIR}`));
    const wanted = new Set<string>();
    for (const index of posterIndices()) {
      for (const half of HALVES) {
        const { path, shortname } = halfTexture(index, half);
        assert.equal(terrain[shortname]?.textures, path, shortname);
        const file = `${RP}/${path}.png`;
        assert.ok(existsSync(file), file);
        const png = readFileSync(file, "latin1"); // one char per byte
        const u32 = (at: number) =>
          [0, 1, 2, 3].reduce((n, k) => n * 256 + png.charCodeAt(at + k), 0);
        assert.deepEqual([u32(16), u32(20)], [64, 64], `${file}: width × height`);
        wanted.add(path.slice(path.lastIndexOf("/") + 1) + ".png");
      }
    }
    assert.deepEqual(
      [...pngs].filter((f) => !wanted.has(f)),
      [],
      "orphan poster PNGs",
    );
    assert.deepEqual(
      Object.keys(terrain).filter(
        (k) => k.startsWith("hk_poster_") && !k.endsWith("_left") && !k.endsWith("_right"),
      ),
      [],
    );
  });

  it("states: hk:poster (16 per page) and hk:poster_page cover every recipe + the guide", () => {
    assert.ok(poster);
    const states = poster.description.states ?? {};
    assert.deepEqual(states["hk:poster"], { values: { min: 0, max: POSTER_MAX_STATES - 1 } });
    assert.deepEqual(states["hk:poster_page"], { values: { min: 0, max: POSTER_PAGES - 1 } });
    assert.ok(POSTER_PAGES * POSTER_MAX_STATES >= POSTER_COUNT, `${POSTER_COUNT} posters`);
    assert.deepEqual(states["hk:facing"], [...FACINGS]);
    assert.equal(states["hk:right"], undefined, "the half comes from the part number, not a state");
  });

  it("a stable horizontal 2-part multi-block with only the cardinal_direction trait", () => {
    assert.ok(poster);
    const traits = (poster.description as PosterDescription).traits ?? {};
    assert.deepEqual(Object.keys(traits).sort(), [
      "minecraft:multi_block",
      "minecraft:placement_direction",
    ]);
    assert.deepEqual(traits["minecraft:multi_block"]?.["enabled_states"], [
      "minecraft:multi_block_part",
    ]);
    assert.equal(traits["minecraft:multi_block"]?.["parts"], 2);
    assert.ok(FACINGS.includes(traits["minecraft:multi_block"]?.["direction"] as never));
    assert.deepEqual(traits["minecraft:placement_direction"]?.["enabled_states"], [
      "minecraft:cardinal_direction",
    ]);
    // Microsoft Learn: horizontal multi-blocks need block format 1.26.50 without the experiment.
    const json = JSON.parse(read(`${BP}/blocks/recipe_poster.json`)) as { format_version: string };
    assert.equal(json.format_version, "1.26.50");
  });

  it("hangs on side faces, pops, drops nothing by itself, lets light through, thin boxes", () => {
    assert.ok(poster);
    const c = poster.components;
    // no placement filter: it removed the poster right after placing (2026-10-22);
    // floors/ceilings are refused by the script, the wall going by poster-support.ts
    assert.equal(c["minecraft:placement_filter"], undefined);
    assert.deepEqual(c["minecraft:movable"], { movement_type: "popped" });
    assert.equal(c["minecraft:loot"], "loot_tables/hk/blocks/nothing.json");
    assert.equal(c["minecraft:light_dampening"], 0);
    for (const box of ["minecraft:collision_box", "minecraft:selection_box"]) {
      const { origin, size } = c[box] as { origin: number[]; size: number[] };
      assert.ok((size[2] ?? 16) <= 2, `${box} depth`);
      assert.equal((origin[2] ?? 0) + (size[2] ?? 0), 8, `${box} sits against the wall`);
    }
    for (const p of poster.permutations ?? []) {
      for (const banned of ["minecraft:placement_filter", "minecraft:movable", "minecraft:loot"]) {
        assert.equal(p.components[banned], undefined, `${banned} in a permutation`);
      }
    }
  });

  it("the geometry is one 1 px deep panel with the front facing north", () => {
    const geo = JSON.parse(read(`${RP}/models/blocks/hk/recipe_poster.geo.json`)) as {
      "minecraft:geometry": { bones: { cubes: { origin: number[]; size: number[] }[] }[] }[];
    };
    const cubes = geo["minecraft:geometry"].flatMap((g) => g.bones.flatMap((b) => b.cubes));
    assert.deepEqual(
      cubes.map((cube) => [cube.origin, cube.size]),
      [
        [
          [-8, 0, 7],
          [16, 16, 1],
        ],
      ],
    );
  });

  it("every part shows its half of its recipe (from part number + cardinal), rotated, opaque", () => {
    assert.ok(poster);
    const base: Record<string, unknown> = poster.components;
    const permutations: { condition: string; components: Record<string, unknown> }[] =
      poster.permutations ?? [];
    const rotation = { north: 0, west: 90, south: 180, east: 270 } as const;
    let combinations = 0;
    for (const facing of FACINGS) {
      for (const cardinal of FACINGS) {
        for (const part of [0, 1]) {
          const half = halfOfPart(facing, cardinal, part);
          if (!half) continue; // cardinal into/out of the wall: refused on place
          for (const index of posterIndices()) {
            combinations++;
            const { slot, page } = posterStates(index);
            const states: Record<string, MolangValue> = {
              "hk:facing": facing,
              "hk:poster": slot,
              "hk:poster_page": page,
              "minecraft:cardinal_direction": cardinal,
              "minecraft:multi_block_part": part,
            };
            const applied = permutations.filter((p) => evalCondition(p.condition, states));
            const where = JSON.stringify(states);
            assert.ok(applied.length <= 1, `${where}: ${applied.length} permutations`);
            const components: Record<string, unknown> = applied[0]?.components ?? base;
            const materials = components["minecraft:material_instances"] as Materials;
            assert.deepEqual(Object.keys(materials), ["*"], where);
            assert.equal(materials["*"]?.texture, halfTexture(index, half).shortname, where);
            assert.equal(materials["*"]?.render_method, "opaque", where);
            assert.deepEqual(
              components["minecraft:transformation"],
              { rotation: [0, rotation[facing], 0] },
              where,
            );
          }
        }
      }
    }
    // 4 facings x 2 along-the-wall cardinals x 2 parts x every poster
    assert.equal(combinations, FACINGS.length * 2 * 2 * POSTER_COUNT);
  });

  it("is crafted shapeless from paper + any HK crop (tag hk:crops on exactly the produce)", () => {
    const recipe = (JSON.parse(read(`${BP}/recipes/recipe_poster.json`)) as ShapelessJson)[
      "minecraft:recipe_shapeless"
    ];
    assert.ok(recipe);
    assert.deepEqual(recipe.ingredients, [{ item: "minecraft:paper" }, { tag: "hk:crops" }]);
    assert.deepEqual(recipe.result, { item: "hk:recipe_poster", count: 1 });
    interface TaggedItem {
      components: { "minecraft:tags"?: { tags: string[] } };
    }
    const tagged = [...items.entries()]
      .filter(([, item]) =>
        (item as unknown as TaggedItem).components["minecraft:tags"]?.tags.includes("hk:crops"),
      )
      .map(([id]) => id)
      .sort();
    assert.deepEqual(tagged, CROPS.map((crop) => crop.produce).sort());
  });
});

describe("Kitchen Guide (guide/, ui/guide-screen.ts)", () => {
  const lang = new Map(
    read(`${RP}/texts/en_US.lang`)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("##"))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );

  it("is crafted shapeless from a book + a carrot, on the vanilla table, unlocked by either", () => {
    const json = JSON.parse(read(`${BP}/recipes/guide_book.json`)) as Record<
      string,
      { tags: string[]; ingredients: unknown[]; unlock: unknown[]; result: unknown } | undefined
    >;
    const recipe = json["minecraft:recipe_shapeless"];
    assert.ok(recipe);
    assert.deepEqual(recipe.tags, ["crafting_table"]);
    const book = [{ item: "minecraft:book" }, { item: "minecraft:carrot" }];
    assert.deepEqual(recipe.ingredients, book);
    assert.deepEqual(recipe.unlock, book);
    assert.deepEqual(recipe.result, { item: ITEM_GUIDE_BOOK, count: 1 });
  });

  it("the item stacks to 1 and carries the component that opens the guide", () => {
    const item = items.get(ITEM_GUIDE_BOOK);
    assert.ok(item);
    assert.deepEqual(Object.keys(item.components).sort(), [
      COMPONENT_GUIDE_BOOK,
      "minecraft:display_name",
      "minecraft:icon",
      "minecraft:max_stack_size",
    ]);
  });

  it("every How to Play topic has a title, a text with %1$s as its only placeholder, an icon", () => {
    assert.ok(GUIDE_TOPICS.length > 0);
    assert.equal(new Set(GUIDE_TOPICS.map((topic) => topic.titleKey)).size, GUIDE_TOPICS.length);
    for (const topic of GUIDE_TOPICS) {
      assert.ok(lang.get(topic.titleKey), `${topic.titleKey} is missing from en_US.lang`);
      const text = lang.get(topic.textKey);
      assert.ok(text, `${topic.textKey} is missing from en_US.lang`);
      assert.equal(text.match(/%(?!1\$s)/g), null, topic.textKey);
      assert.ok(existsSync(`${RP}/${topic.icon}.png`), topic.icon);
    }
  });
});

describe("placement filters", () => {
  // 1.26.50 binds allowed_faces to Facing: only the six face names load ("side" fails the block).
  const FACES = new Set(["up", "down", "north", "south", "east", "west"]);
  it("every block uses only real face names in allowed_faces", () => {
    for (const file of readdirSync(`${BP}/blocks`)) {
      const text = read(`${BP}/blocks/${file}`);
      for (const match of text.matchAll(/"allowed_faces"\s*:\s*\[([^\]]*)\]/g)) {
        const faces = [...(match[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
        for (const face of faces)
          assert.ok(FACES.has(face ?? ""), `${file}: allowed_faces "${face}"`);
      }
    }
  });
});
