import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  GHOST_ALPHA,
  GHOST_DONE_ALPHA,
  GHOST_FADE_SECONDS,
  GHOST_HEIGHT,
  GHOST_LIFETIME_SECONDS,
  GHOST_MAX_ICONS,
  GHOST_PARTICLE,
  GHOST_SPACING,
  GHOST_UPDATE_TICKS,
} from "../scripts/config";
import {
  GHOST_ATLAS,
  GHOST_PUFF,
  GHOST_STAR,
  ghostAtlasCells,
  ghostAtlasSize,
  ghostIconIndex,
} from "../scripts/data/ghost-atlas";
import { recipesFor, stationInputsMadeFrom } from "../scripts/data/recipes";
import { stationById, type ContainerStation } from "../scripts/data/stations";
import {
  altCycle,
  GHOST_ICON_VARIABLES,
  ghostPositions,
  ghostsFor,
  ghostStyle,
  hintView,
  iconVariables,
  nearestPots,
  NO_GHOSTS,
  popIndices,
  rowCenter,
  spawnCost,
  type GhostView,
} from "../scripts/stations/ghost-logic";
import type { StationState } from "../scripts/stations/station-logic";

// Ghost ingredients above the pot (D15, D16): what each pot state shows, the mix hint, where the
// icons go, which pots a player sees, what pops, and that the atlas and particle JSON match.

const pot = stationById("pot") as ContainerStation;
const RP = "packs/harvest_kitchen/resource";
const SOUP_MIX = "hk:tomato_soup_mix";
const ONION_MIX = "hk:onion_soup_mix";
const items = (view: GhostView) => view.icons.map((i) => i.item);
const ghosts = (contents: Record<string, number>, extra: Partial<StationState> = {}, cycle = 0) =>
  ghostsFor(pot, { items: contents, ...extra }, cycle);

// With mixes (D16) every pot recipe is one mix, so a pot is empty, ready or busy: the "missing"
// ghosts (and "cod or salmon" turns) only show for a station with multi-slot recipes, which the
// pot no longer has. The crafting table's recipe book answers "what goes in"; the hint answers
// "what do I do with this tomato?".

describe("what a pot shows", () => {
  it("an empty pot shows nothing", () => {
    assert.deepEqual(ghosts({}), NO_GHOSTS);
  });

  it("items that make nothing (an old pot's raw items) show nothing", () => {
    assert.deepEqual(ghosts({ "hk:tomato": 2 }), NO_GHOSTS);
  });

  it("a mix inside: the dish it cooks into (with a sparkle)", () => {
    const view = ghosts({ [SOUP_MIX]: 1 });
    assert.deepEqual(view, { mode: "ready", icons: [{ item: "hk:tomato_soup", accepts: [] }] });
    assert.equal(ghostStyle(view.mode).sparkle, true);
    assert.equal(spawnCost(view), 2);
    assert.deepEqual(items(ghosts({ [SOUP_MIX]: 3 })), ["hk:tomato_soup"], "one icon per dish");
  });

  it("several dishes possible: one dish icon each", () => {
    const view = ghosts({ [SOUP_MIX]: 1, [ONION_MIX]: 2 });
    assert.equal(view.mode, "ready");
    assert.deepEqual(items(view), ["hk:tomato_soup", "hk:onion_soup"]);
  });

  it("cooking shows nothing; done shows the finished dish, nearly solid, no sparkle", () => {
    const job = { recipe: "hk:tomato_soup", ticks: 10, total: 100, servings: 1 };
    assert.deepEqual(ghosts({ [SOUP_MIX]: 1 }, { job }), NO_GHOSTS);
    const done = ghosts({ [ONION_MIX]: 3 }, { out: { item: "hk:tomato_soup", count: 1 } });
    assert.equal(done.mode, "done");
    assert.deepEqual(items(done), ["hk:tomato_soup"]);
    assert.deepEqual(ghostStyle("done"), { alpha: GHOST_DONE_ALPHA, sparkle: false });
    assert.deepEqual(ghostStyle("missing"), { alpha: GHOST_ALPHA, sparkle: false });
    assert.equal(spawnCost(NO_GHOSTS), 0);
  });

  it("every state of up to 4 mixes: ghosts unless empty, capped, and every icon has a cell", () => {
    const ids = [...new Set(recipesFor("pot").flatMap((r) => r.ingredients.flatMap((i) => i.items)))]; // prettier-ignore
    let states = 0;
    const walk = (start: number, contents: Record<string, number>, left: number) => {
      states++;
      const view = ghosts(contents, {}, states);
      const empty = Object.keys(contents).length === 0;
      assert.equal(view.mode === "none", empty, JSON.stringify(contents));
      assert.notEqual(view.mode, "missing");
      assert.ok(view.icons.length <= GHOST_MAX_ICONS);
      for (const icon of view.icons) assert.ok(ghostIconIndex(icon.item) >= 0, icon.item);
      if (left === 0) return;
      for (let i = start; i < ids.length; i++) {
        const id = ids[i] as string;
        walk(i, { ...contents, [id]: (contents[id] ?? 0) + 1 }, left - 1);
      }
    };
    walk(0, {}, 4);
    assert.ok(states > 500);
  });
});

describe("the mix hint (D16)", () => {
  it("shows the mixes a raw ingredient goes into, no sparkle, capped", () => {
    const view = hintView(stationInputsMadeFrom("pot", "hk:strawberry"));
    assert.deepEqual(view, { mode: "hint", icons: [{ item: "hk:strawberry_jam_mix", accepts: [] }] }); // prettier-ignore
    assert.deepEqual(ghostStyle("hint"), { alpha: GHOST_ALPHA, sparkle: false });
    assert.equal(spawnCost(view), 1);
    const onion = hintView(stationInputsMadeFrom("pot", "hk:onion"));
    assert.equal(onion.icons.length, GHOST_MAX_ICONS, "the onion goes into more mixes than fit");
  });

  it("nothing to suggest shows nothing", () => {
    assert.deepEqual(hintView([]), NO_GHOSTS);
  });

  it("every mix a hint can show has an atlas cell", () => {
    for (const id of ["hk:tomato", "hk:onion", "hk:eggplant", "minecraft:cod", "minecraft:bowl"]) {
      for (const icon of hintView(stationInputsMadeFrom("pot", id)).icons) {
        assert.ok(ghostIconIndex(icon.item) >= 0, icon.item);
      }
    }
  });
});

describe("popping a ghost", () => {
  it("only missing ghosts pop: dish icons and hints never do", () => {
    assert.deepEqual(popIndices(ghosts({ [SOUP_MIX]: 1 }), SOUP_MIX, 1), []);
    assert.deepEqual(popIndices(hintView([SOUP_MIX]), SOUP_MIX, 1), []);
  });

  it("a missing ghost pops for the items that fill it, only as many as went in", () => {
    const view: GhostView = {
      mode: "missing",
      icons: [
        { item: "minecraft:cod", accepts: ["minecraft:cod", "minecraft:salmon"] },
        { item: "hk:onion", accepts: ["hk:onion"] },
        { item: "hk:onion", accepts: ["hk:onion"] },
      ],
      recipe: "x",
    };
    assert.deepEqual(popIndices(view, "hk:onion", 1), [1]);
    assert.deepEqual(popIndices(view, "hk:onion", 5), [1, 2]);
    assert.deepEqual(popIndices(view, "minecraft:salmon", 1), [0]);
    assert.deepEqual(popIndices(view, "minecraft:sugar", 1), []);
    assert.equal(altCycle(0), altCycle(39));
    assert.notEqual(altCycle(39), altCycle(40));
  });
});

describe("where the ghosts go", () => {
  const potAt = { x: 10, y: 64, z: -3 };

  it("a row above the pot, centred on it, spaced evenly", () => {
    const row = ghostPositions(potAt, { x: 10.5, y: 64, z: 2 }, 3);
    assert.equal(row.length, 3);
    for (const p of row) assert.equal(p.y, potAt.y + GHOST_HEIGHT);
    const mid = row[1];
    assert.ok(mid);
    assert.deepEqual(mid, rowCenter(potAt));
    const [a, b] = row;
    assert.ok(a && b);
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - GHOST_SPACING) < 1e-9);
  });

  it("across the viewer's line of sight, the first icon on their left", () => {
    // viewer south of the pot looks north: left is west (smaller x), the row runs east-west
    const north = ghostPositions(potAt, { x: 10.5, y: 64, z: 2 }, 2);
    assert.ok(north[0] && north[1]);
    assert.ok(north[0].x < north[1].x);
    assert.equal(north[0].z, north[1].z);
    // viewer east of the pot looks west: left is south (larger z), the row runs north-south
    const west = ghostPositions(potAt, { x: 16, y: 64, z: -2.5 }, 2);
    assert.ok(west[0] && west[1]);
    assert.ok(west[0].z > west[1].z);
    assert.ok(Math.abs(west[0].x - west[1].x) < 1e-9);
  });

  it("a viewer right above still gets a row", () => {
    const row = ghostPositions(potAt, { x: 10.5, y: 70, z: -2.5 }, 2);
    assert.ok(row[0] && row[1]);
    assert.ok(row[0].x < row[1].x);
  });
});

describe("which pots a player sees", () => {
  const place = (key: string, x: number, dimension = "minecraft:overworld") => ({
    key,
    dimension,
    location: { x, y: 64, z: 0 },
  });
  const pots = [
    place("far", 20),
    place("b", 3),
    place("a", 1),
    place("nether", 0, "minecraft:nether"),
  ];
  const viewer = { x: 0.5, y: 64, z: 0.5 };

  it("nearest first, same dimension, within the radius, capped", () => {
    const keys = (max: number, radius = 6) =>
      nearestPots(viewer, "minecraft:overworld", pots, radius, max).map((p) => p.key);
    assert.deepEqual(keys(5), ["a", "b"]);
    assert.deepEqual(keys(1), ["a"]);
    assert.deepEqual(keys(5, 1.2), ["a"]); // a is 1.1 away (pot centre is half a block up)
    assert.deepEqual(
      nearestPots(viewer, "minecraft:nether", pots, 6, 5).map((p) => p.key),
      ["nether"],
    );
  });
});

describe("ghost timing", () => {
  it("the lifetime covers one update plus one fade: continuous, never stacked more than two", () => {
    const period = GHOST_UPDATE_TICKS / 20;
    assert.ok(GHOST_LIFETIME_SECONDS > period);
    assert.ok(GHOST_LIFETIME_SECONDS <= period + GHOST_FADE_SECONDS + 1e-9);
    assert.ok(GHOST_LIFETIME_SECONDS < 2 * period);
  });

  it("the bob phase follows world time, so a re-spawned ghost continues the wave", () => {
    const a = iconVariables(SOUP_MIX, 0, "missing", 100);
    const b = iconVariables(SOUP_MIX, 0, "missing", 100 + GHOST_UPDATE_TICKS);
    assert.ok(a && b);
    assert.ok(Math.abs(b.phase - a.phase - GHOST_UPDATE_TICKS / 20) < 1e-9);
    const neighbour = iconVariables(SOUP_MIX, 1, "missing", 100);
    assert.ok(neighbour && neighbour.phase !== a.phase);
    assert.equal(a.icon, ghostIconIndex(SOUP_MIX));
    assert.equal(a.alpha, GHOST_ALPHA);
    assert.equal(iconVariables("minecraft:dirt", 0, "missing", 0), undefined);
  });
});

describe("ghost atlas and particles (tools/gen-ghost-atlas.mjs)", () => {
  const cells = ghostAtlasCells();

  it("the star and puff are cells 0 and 1; every pot ingredient and dish has one cell", () => {
    assert.equal(cells[0], GHOST_STAR);
    assert.equal(cells[1], GHOST_PUFF);
    assert.equal(new Set(cells).size, cells.length);
    for (const recipe of recipesFor("pot")) {
      for (const id of [recipe.result, ...recipe.ingredients.flatMap((i) => i.items)]) {
        assert.ok(ghostIconIndex(id) >= 2, id);
      }
    }
  });

  it("the generated texture and particle files are up to date", () => {
    const run = spawnSync("node", ["tools/gen-ghost-atlas.mjs", "--check"], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr + run.stdout);
    assert.ok(existsSync(`${RP}/${GHOST_ATLAS.texture}.png`));
  });

  const particle = (name: string) => {
    const text = readFileSync(`${RP}/particles/hk/${name}.json`, "utf8");
    const json = JSON.parse(text) as {
      format_version: string;
      particle_effect: {
        description: {
          identifier: string;
          basic_render_parameters: { material: string; texture: string };
        };
        components: Record<string, unknown>;
      };
    };
    return { text, json, effect: json.particle_effect };
  };
  const files = { icon: "ghost_icon", sparkle: "ghost_sparkle", pop: "ghost_pop" } as const;

  it("one file per GHOST_PARTICLE id: namespaced, the atlas texture, blended", () => {
    for (const [key, name] of Object.entries(files)) {
      const { json, effect } = particle(name);
      assert.equal(json.format_version, "1.26.50");
      assert.equal(effect.description.identifier, GHOST_PARTICLE[key as keyof typeof files]);
      assert.equal(effect.description.basic_render_parameters.texture, GHOST_ATLAS.texture);
      assert.equal(effect.description.basic_render_parameters.material, "particles_blend");
      const billboard = effect.components["minecraft:particle_appearance_billboard"] as {
        uv: { texture_width: number; texture_height: number };
      };
      assert.deepEqual(
        { w: billboard.uv.texture_width, h: billboard.uv.texture_height },
        ghostAtlasSize(),
      );
    }
  });

  it("hk:ghost_icon reads exactly the variables the script sets; the others read none", () => {
    const read = (text: string) =>
      [...new Set([...text.matchAll(/\b(?:v|variable)\.(hk_\w+)/g)].map((m) => m[1]))].sort();
    const set = Object.values(GHOST_ICON_VARIABLES).map((name) => name.replace("variable.", ""));
    assert.deepEqual(read(particle(files.icon).text), set.sort());
    assert.deepEqual(read(particle(files.sparkle).text), []);
    assert.deepEqual(read(particle(files.pop).text), []);
  });
});
