import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, it } from "node:test";
import { HK_ITEM_IDS } from "../scripts/book/unlock";
import { readParams } from "../scripts/crops/growth-logic";
import { CROPS } from "../scripts/data/crops";
import { DISHES, FAMILIES } from "../scripts/data/dishes";
import { EFFECT_ICONS, UI_ICONS, itemIcon } from "../scripts/data/icons";
import { CRAFTING_RECIPES } from "../scripts/data/recipes";
import { STATIONS } from "../scripts/data/stations";

// What validate.ts can't check in game (texture files, lang keys) and what it can only check at
// world load (food values in the item JSON), checked offline against the pack's files.
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
      const key = items.get(id)?.components["minecraft:display_name"]?.value;
      return !key || !langKeys.has(key);
    });
    assert.deepEqual(missing, []);
  });
});

describe("icons", () => {
  it("every HK item has an item JSON", () => {
    assert.deepEqual(
      HK_ITEM_IDS.filter((id) => !items.has(id)),
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

describe("crafting JSON against CRAFTING_RECIPES (the book's copy)", () => {
  const shapeless = new Map(
    jsonFiles(`${BP}/recipes`)
      .map(({ json }) => (json as ShapelessJson)["minecraft:recipe_shapeless"])
      .filter((r) => r !== undefined)
      .map((r) => [r.description.identifier, r] as const),
  );

  for (const recipe of CRAFTING_RECIPES) {
    it(`${recipe.id}: same result and ingredients`, () => {
      const json = shapeless.get(recipe.id);
      assert.ok(json, `behavior/recipes has no shapeless ${recipe.id}`);
      assert.equal(json.result.item, recipe.result);
      assert.equal(json.result.count ?? 1, recipe.count);
      const fromJson = json.ingredients.map((i) => i.item ?? `tag:${i.tag}`).sort();
      const fromData = recipe.ingredients
        .flatMap(({ items: ids, count }) => {
          assert.equal(ids.length, 1, "alternatives need a tag in the JSON; compare by hand");
          return Array<string>(count).fill(ids[0] as string);
        })
        .sort();
      assert.deepEqual(fromJson, fromData);
    });
  }
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
    it(`${station.block}: fill range, phase values and hot flag`, () => {
      const declared = states(station.block);
      const { fill, phase, hot } = station.states;
      if (fill) assert.deepEqual(declared[fill.name], { values: { min: 0, max: fill.levels } });
      if (phase) assert.deepEqual(declared[phase], ["idle", "ready", "cooking", "done"]);
      if (hot) assert.deepEqual(declared[hot], [false, true]);
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

  it("the pot, the board and the cake replace their block's item", () => {
    assert.deepEqual(placers.map((p) => p.description.identifier).sort(), [
      "hk:cooking_pot",
      "hk:cutting_board",
      "hk:strawberry_cake",
    ]);
  });

  for (const placer of placers) {
    const id = placer.description.identifier;
    it(`${id}: same id as its block; the block carries the creative category (vanilla red_shrub)`, () => {
      assert.equal(placer.components["minecraft:block_placer"]?.block, id);
      assert.equal(placer.description.menu_category?.category, "none");
      const block = blocks.get(id) as unknown as CategoryJson | undefined;
      assert.ok(block, "block JSON");
      assert.notEqual(block.description.menu_category?.category ?? "none", "none");
    });
  }
});
