// Simmerfield's docs export (tools/docs-export.mjs runs it; format: tools/docs/schema.d.ts).
// Everything comes from the pack itself, so the docs can't drift from the game: the pure data
// modules the scripts run (bundled with esbuild, as tools/gen-posters.mjs does), the recipe, item
// and loot table JSON, the manifest and en_US.lang. Prose lives in packs/simmerfield/docs/.
// Only words with no source in the pack are here: vanilla names, biome names, what each effect
// does, and the stations' one-line descriptions.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const PACK = "packs/simmerfield";
const GEN = "art/simmerfield/generated";

async function loadPackData(root) {
  const s = `./${PACK}/scripts`;
  const result = await build({
    stdin: {
      contents: [
        `export { CROPS, SEED_CHANCE_IN_BIOME, SEED_CHANCE_ANY_BIOME, SOIL_BLOCKS, SEED_DROP_BLOCKS } from "${s}/data/crops";`,
        `export { DISHES, EFFECTS, FAMILIES } from "${s}/data/dishes";`,
        `export { STATION_RECIPES, CRAFTING_RECIPES, CUTTING_RECIPES } from "${s}/data/recipes";`,
        `export { STATIONS } from "${s}/data/stations";`,
        `export { HEAT_BLOCK_IDS } from "${s}/stations/heat";`,
        `export { MOD_ITEM_IDS } from "${s}/discovery/unlock";`,
        `export { ITEM_COOKING_POT, ITEM_CUTTING_BOARD, ITEM_GUIDE_BOOK, ITEM_RECIPE_POSTER } from "${s}/config";`,
      ].join("\n"),
      resolveDir: root,
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

// --- words the pack doesn't have ---------------------------------------------------------------

const VANILLA_NAMES = {
  "minecraft:beef": "Raw Beef",
  "minecraft:cod": "Raw Cod",
  "minecraft:salmon": "Raw Salmon",
  "minecraft:chicken": "Raw Chicken",
  "minecraft:mutton": "Raw Mutton",
  "minecraft:magma": "Magma Block",
  "minecraft:flowing_lava": "Flowing Lava",
  "minecraft:short_grass": "Grass",
};

const TAG_NAMES = {
  "minecraft:planks": "Any planks",
  "wm_kitchen:crops": "Any Simmerfield crop",
};

/** Vanilla biome id -> [name, our biome icon (generated/ui/biome_<icon>.png)]. */
const BIOMES = {
  "minecraft:plains": ["Plains", "plains"],
  "minecraft:sunflower_plains": ["Sunflower Plains", "plains"],
  "minecraft:meadow": ["Meadow", "meadow"],
  "minecraft:forest": ["Forest", "forest"],
  "minecraft:forest_hills": ["Wooded Hills", "forest"],
  "minecraft:birch_forest": ["Birch Forest", "forest"],
  "minecraft:birch_forest_hills": ["Birch Forest Hills", "forest"],
  "minecraft:flower_forest": ["Flower Forest", "forest"],
  "minecraft:cherry_grove": ["Cherry Grove", "cherry_grove"],
  "minecraft:river": ["River", "river"],
  "minecraft:swampland": ["Swamp", "swamp"],
  "minecraft:taiga": ["Taiga", "taiga"],
  "minecraft:taiga_hills": ["Taiga Hills", "taiga"],
  "minecraft:mega_taiga": ["Old Growth Taiga", "taiga"],
  "minecraft:savanna": ["Savanna", "savanna"],
  "minecraft:savanna_plateau": ["Savanna Plateau", "savanna"],
  "minecraft:jungle": ["Jungle", "jungle"],
  "minecraft:jungle_hills": ["Jungle Hills", "jungle"],
  "minecraft:jungle_edge": ["Sparse Jungle", "jungle"],
  "minecraft:bamboo_jungle": ["Bamboo Jungle", "jungle"],
  "minecraft:mesa": ["Badlands", "badlands"],
  "minecraft:mesa_plateau": ["Badlands Plateau", "badlands"],
  "minecraft:mesa_plateau_stone": ["Wooded Badlands", "badlands"],
};

/** Effect id -> [name, what it does]. */
const EFFECTS = {
  "minecraft:regeneration": ["Regeneration", "Heals you, a little at a time."],
  "minecraft:absorption": ["Absorption", "Gives you extra golden hearts."],
  "minecraft:health_boost": ["Health Boost", "Gives you more hearts."],
  "minecraft:speed": ["Speed", "You run faster."],
  "minecraft:jump_boost": ["Jump Boost", "You jump higher."],
  "minecraft:slow_falling": ["Slow Falling", "You float down like a feather."],
  "minecraft:haste": ["Haste", "You mine and dig faster."],
  "minecraft:night_vision": ["Night Vision", "You can see in the dark."],
  "minecraft:water_breathing": ["Water Breathing", "You can breathe underwater."],
  "minecraft:fire_resistance": ["Fire Resistance", "Fire and lava don't hurt you."],
};

/** Minecraft colour code of a family glyph ("§c❤") -> its colour (the vanilla chat colours). */
const CODE_COLORS = { c: "#ff5555", 9: "#5555ff", e: "#ffff55", a: "#55ff55" };

const STATION_TEXT = {
  cutting_board:
    "Hold a crop and use the board to slice or chop it. Some recipes need cut crops instead of whole ones.",
  crafting_table:
    "The normal crafting table. Raw mixes for the Cooking Pot and the cold dishes (salads, sandwiches, desserts) are made here.",
  cooking_pot:
    "Put mixes in and keep a fire under it: the pot cooks every mix of one dish at once. Use it to take the dishes out.",
};

// --- helpers -----------------------------------------------------------------------------------

const shortName = (id) => id.slice(id.indexOf(":") + 1);
const titleCase = (id) =>
  shortName(id)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
/** Strips § codes and a leading glyph ("§c❤ Red food heals you" -> "Red food heals you"). */
const plain = (text) =>
  text
    .replace(/§./g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

function readLang(file) {
  const lang = new Map();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq > 0) lang.set(line.slice(0, eq), line.slice(eq + 1));
  }
  return lang;
}

/** item id -> its item JSON components (behavior/items). */
function readItemJson(root) {
  const items = new Map();
  const dir = path.join(root, PACK, "behavior/items");
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".json")) continue;
    const item = readJson(path.join(dir, file))["minecraft:item"];
    items.set(item.description.identifier, item.components ?? {});
  }
  return items;
}

/** What breaking a ripe crop drops: one entry per single-entry pool of <block>_mature.json. */
function harvestDrops(root, blockId) {
  const file = path.join(
    root,
    PACK,
    `behavior/loot_tables/wm_kitchen/blocks/${shortName(blockId)}_mature.json`,
  );
  if (!existsSync(file)) return [];
  return (readJson(file).pools ?? [])
    .filter((pool) => pool.entries?.length === 1 && !pool.conditions)
    .map((pool) => {
      const entry = pool.entries[0];
      const count = entry.functions?.find((f) => f.function === "set_count")?.count ?? 1;
      const [min, max] = typeof count === "number" ? [count, count] : [count.min, count.max];
      return { item: entry.name, min, max };
    });
}

/** The crafting-table recipes that make tools and blocks (results that aren't food or mixes). */
function readGrids(root, foodOrMix) {
  const dir = path.join(root, PACK, "behavior/recipes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(path.join(dir, f)))
    .map((json) => {
      const shaped = json["minecraft:recipe_shaped"];
      return { shaped, body: shaped ?? json["minecraft:recipe_shapeless"] };
    })
    .filter(({ body }) => body && !foodOrMix.has(body.result.item));
}

// --- the export --------------------------------------------------------------------------------

export default async function simmerfield(ctx) {
  const root = ctx.root;
  const data = await loadPackData(root);
  const lang = readLang(path.join(root, PACK, "resource/texts/en_US.lang"));
  const itemJson = readItemJson(root);
  const manifest = readJson(path.join(root, PACK, "behavior/manifest.json"));
  const art = (rel) => ctx.icon(path.join(root, GEN, `${rel}.png`), rel);

  const dishes = new Map(data.DISHES.map((d) => [d.id, d]));
  const potInputs = new Set(
    data.STATION_RECIPES.flatMap((r) => r.ingredients.flatMap((i) => i.items)),
  );
  const mixes = new Set(
    data.CRAFTING_RECIPES.map((r) => r.result).filter((id) => potInputs.has(id)),
  );
  const produce = new Set(data.CROPS.map((c) => c.produce));
  const seeds = new Set(data.CROPS.map((c) => c.seed).filter((id) => !produce.has(id)));
  const prepared = new Set(data.CUTTING_RECIPES.map((r) => r.output));
  const stationItems = new Set(data.STATIONS.map((s) => s.icon).concat(data.ITEM_CUTTING_BOARD));
  // Kitchen decor: every other block-placing item (the cake is a dish, the poster a "block").
  const placers = new Set(
    [...itemJson]
      .filter(([, components]) => components["minecraft:block_placer"])
      .map(([id]) => id),
  );
  const category = (id) =>
    dishes.has(id) ? "dish"
    : mixes.has(id) ? "mix"
    : produce.has(id) ? "produce"
    : seeds.has(id) ? "seed"
    : prepared.has(id) ? "prepared"
    : stationItems.has(id) ? "station"
    : id === data.ITEM_RECIPE_POSTER ? "block"
    : id === data.ITEM_GUIDE_BOOK ? "book"
    : placers.has(id) ? "decor"
    : null; // prettier-ignore

  function food(id) {
    const dish = dishes.get(id);
    if (dish) {
      return {
        nutrition: dish.nutrition,
        canAlwaysEat: dish.canAlwaysEat,
        leaves: dish.container ?? null,
        slices: dish.slices?.count ?? null,
      };
    }
    const f = itemJson.get(id)?.["minecraft:food"];
    if (!f) return null;
    return {
      nutrition: f.nutrition ?? 0,
      canAlwaysEat: f.can_always_eat ?? false,
      leaves: f.using_converts_to ?? null,
      slices: null,
    };
  }

  // Items: every Simmerfield item, plus each vanilla id another record names (added through `item`).
  const items = {};
  const item = (id) => {
    if (items[id]) return id;
    const vanilla = !id.startsWith("wm_kitchen:");
    const name = vanilla
      ? (VANILLA_NAMES[id] ?? titleCase(id))
      : (lang.get(`item.${id}.name`) ?? lang.get(`tile.${id}.name`));
    if (!name) throw new Error(`${id}: no name in en_US.lang`);
    const icon = vanilla ? art(`ingredients/${shortName(id)}`) : art(`items/${shortName(id)}`);
    items[id] = { id, name, icon, vanilla, category: vanilla ? null : category(id), food: null };
    if (!vanilla) items[id].food = food(id);
    if (items[id].food?.leaves) item(items[id].food.leaves);
    return id;
  };
  data.MOD_ITEM_IDS.forEach(item);

  const tags = {};
  const tag = (id) => {
    if (!tags[id]) {
      const members = [...itemJson]
        .filter(([, c]) => c["minecraft:tags"]?.tags.includes(id))
        .map(([itemId]) => item(itemId));
      tags[id] = {
        id,
        name: TAG_NAMES[id] ?? titleCase(id),
        items: members,
        icon: members[0] ? items[members[0]].icon : null,
      };
    }
    return id;
  };
  const ref = (entry) => (entry.tag ? tag(entry.tag) : item(entry.item));

  const families = Object.entries(data.FAMILIES).map(([id, f]) => ({
    id,
    name: lang.get(f.nameKey) ?? titleCase(id),
    color: CODE_COLORS[/§(.)/.exec(f.glyph)?.[1]] ?? "#888888",
    icon: art(`ui/family_${id}`),
    hint: plain(lang.get(f.hintKey) ?? ""),
  }));

  const effects = {};
  for (const [id, info] of Object.entries(data.EFFECTS)) {
    const [name, description] = EFFECTS[id] ?? [titleCase(id), ""];
    effects[id] = { id, name, description, family: info.family };
  }

  const biomes = {};
  const biome = (id) => {
    const [name, icon] = BIOMES[id] ?? [titleCase(id), null];
    biomes[id] ??= { id, name, icon: icon ? art(`ui/biome_${icon}`) : null };
    return id;
  };

  const crops = data.CROPS.map((c) => ({
    id: c.key,
    name: items[item(c.produce)].name,
    produce: c.produce,
    seed: item(c.seed),
    block: c.block,
    growth: c.type,
    plantOn: (c.plantOn === "farmland" ? ["minecraft:farmland"] : data.SOIL_BLOCKS).map(item),
    icon: art(`blocks/${shortName(c.block)}_stage_3`),
    seedSource: {
      blocks: data.SEED_DROP_BLOCKS.map(item),
      biomes: c.biomes.map(biome),
      chanceInBiome: data.SEED_CHANCE_IN_BIOME,
      chanceElsewhere: data.SEED_CHANCE_ANY_BIOME,
    },
    harvest:
      c.type === "bush" && c.pick
        ? [{ item: c.produce, min: c.pick.min, max: c.pick.max }]
        : harvestDrops(root, c.block).map((d) => ({ ...d, item: item(d.item) })),
  }));
  // A crop's block isn't an item, but the docs name it: list it with the grown-stage picture.
  for (const c of crops) {
    items[c.block] = {
      id: c.block,
      name: c.name,
      icon: c.icon,
      vanilla: false,
      category: "crop",
      food: null,
    };
  }

  const pot = data.STATIONS.find((s) => s.id === "pot");
  const stations = [
    {
      id: "cutting_board",
      name: items[item(data.ITEM_CUTTING_BOARD)].name,
      item: data.ITEM_CUTTING_BOARD,
      icon: items[data.ITEM_CUTTING_BOARD].icon,
      kind: "cutting",
      needsHeat: false,
      heatSources: [],
      capacity: null,
      description: STATION_TEXT.cutting_board,
    },
    {
      id: "crafting_table",
      name: "Crafting Table",
      item: item("minecraft:crafting_table"),
      icon: items["minecraft:crafting_table"].icon,
      kind: "crafting",
      needsHeat: false,
      heatSources: [],
      capacity: null,
      description: STATION_TEXT.crafting_table,
    },
    {
      id: "cooking_pot",
      name: lang.get(pot.nameKey) ?? items[item(pot.icon)].name,
      item: item(pot.icon),
      icon: items[pot.icon].icon,
      kind: "cooking",
      needsHeat: pot.needsHeat,
      heatSources: data.HEAT_BLOCK_IDS.map(item),
      capacity: pot.capacity,
      description: STATION_TEXT.cooking_pot,
    },
  ];
  const stationOf = { pot: "cooking_pot" };

  const ingredients = (list) => list.map((i) => ({ items: i.items.map(item), count: i.count }));
  const effectOf = (id) => {
    const e = dishes.get(id)?.effect;
    if (!e) return null;
    return {
      effect: e.effect,
      family: data.EFFECTS[e.effect]?.family ?? null,
      seconds: e.seconds,
      level: e.amplifier + 1,
    };
  };
  const recipe = (id, station, ings, result, count, seconds) => ({
    id,
    station,
    ingredients: ingredients(ings),
    result: { item: item(result), count },
    seconds,
    food: items[result].food,
    effect: effectOf(result),
  });
  const crafted = (r) => recipe(r.id, "crafting_table", r.ingredients, r.result, r.count, null);
  // The loop's order: cut, mix, cook; then the cold dishes.
  const recipes = [
    ...data.CUTTING_RECIPES.map((r) =>
      recipe(r.output, "cutting_board", [{ items: [r.input], count: 1 }], r.output, r.count, null),
    ),
    ...data.CRAFTING_RECIPES.filter((r) => mixes.has(r.result)).map(crafted),
    ...data.STATION_RECIPES.map((r) =>
      recipe(r.id, stationOf[r.station], r.ingredients, r.result, r.count, r.seconds),
    ),
    ...data.CRAFTING_RECIPES.filter((r) => !mixes.has(r.result)).map(crafted),
  ];

  const foodOrMix = new Set([...dishes.keys(), ...mixes]);
  const crafting = readGrids(root, foodOrMix).map(({ shaped, body }) => {
    const result = { item: item(body.result.item), count: body.result.count ?? 1 };
    let grid = null;
    let list = null;
    if (shaped) {
      grid = shaped.pattern.map((row) =>
        [...row].map((ch) => (ch === " " ? null : ref(shaped.key[ch]))),
      );
    } else {
      const counts = new Map();
      for (const entry of body.ingredients) {
        const id = ref(entry);
        counts.set(id, (counts.get(id) ?? 0) + (entry.count ?? 1));
      }
      list = [...counts].map(([id, count]) => ({ items: [id], count }));
    }
    const size = grid ? [grid.length, Math.max(...grid.map((r) => r.length))] : null;
    return {
      id: result.item,
      station: "crafting_table",
      result,
      shape: shaped ? "shaped" : "shapeless",
      grid,
      ingredients: list,
      mirrored: !!shaped && shaped.assume_symmetry !== false,
      fitsInventory: size
        ? size[0] <= 2 && size[1] <= 2
        : list.reduce((n, i) => n + i.count, 0) <= 4,
      unlockedBy: (body.unlock ?? []).filter((u) => u.item).map((u) => item(u.item)),
    };
  });

  const tomato = data.CROPS[0];
  const pages = [
    {
      id: "getting-started",
      title: "Getting Started",
      summary: "From your first seed to your first bowl of soup.",
      steps: [
        { text: "Break grass to find seeds.", items: ["minecraft:short_grass", tomato.seed] },
        {
          text: "Plant them on farmland and let them grow.",
          items: [tomato.seed, "minecraft:farmland"],
        },
        { text: "Harvest the ripe crop.", items: [tomato.produce] },
        {
          text: "Slice or chop crops on the Cutting Board.",
          items: [data.ITEM_CUTTING_BOARD, "wm_kitchen:sliced_tomato"],
        },
        {
          text: "Craft a raw mix on the crafting table.",
          items: ["minecraft:crafting_table", "wm_kitchen:tomato_soup_mix"],
        },
        {
          text: "Cook the mix in the Cooking Pot over a fire.",
          items: [pot.icon, "minecraft:campfire"],
        },
        { text: "Eat the dish for its effect.", items: ["wm_kitchen:tomato_soup"] },
      ].map((step) => ({ ...step, items: step.items.map(item) })),
    },
    {
      id: "crops",
      title: "Crops",
      summary: "Six crops, where to find their seeds and how to grow them.",
      steps: null,
    },
    {
      id: "stations",
      title: "Stations",
      summary: "The Cutting Board, the crafting table and the Cooking Pot.",
      steps: null,
    },
    {
      id: "recipes",
      title: "Recipes",
      summary: "Every mix and dish, what goes in and what eating it does.",
      steps: null,
    },
    {
      id: "crafting",
      title: "Crafting",
      summary:
        "How to craft the Cooking Pot, the Cutting Board, the Recipe Poster, the Kitchen Guide and the kitchen decor.",
      steps: null,
    },
  ];

  /** @type {import("./schema").ModDocs} */
  const docs = {
    format: 1,
    mod: {
      id: "simmerfield",
      name: "Simmerfield",
      namespace: "wm_kitchen",
      version: manifest.header.version.join("."),
      summary:
        "Grow six new crops from seeds you find in the grass, then cut, mix and cook them into 18 dishes that give you effects.",
      minecraft: manifest.header.min_engine_version.join("."),
      icon: items["wm_kitchen:tomato_soup"].icon,
      build: ctx.build,
      icons: { size: 16 * ctx.iconScale, scale: ctx.iconScale },
    },
    items,
    tags,
    biomes,
    effects,
    families,
    crops,
    stations,
    recipes,
    crafting,
    pages,
  };
  return { docs, pagesDir: path.join(root, PACK, "docs") };
}
