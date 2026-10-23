import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { LIQUIDS } from "../scripts/data/liquids";
import { stationById } from "../scripts/data/stations";
import { FX_BOARD_CHOPPING_STATE, FX_ENTITY_TYPES } from "../scripts/fx/fx-config";
import { evalCondition, type MolangValue } from "./molang";

// The station fx files, checked offline: the pot's flipbook looks and lid (tools/gen-pot-flipbook.mjs,
// tools/gen-pot-block.mjs), and the fx entities (behavior/entities, resource entity/models/
// animations/particles; art/simmerfield/models/_tools/make-fx-tools.mjs). Paths are
// repo-relative (tools/test.mjs runs from the repo root).

const PACK = "packs/simmerfield";
const BP = `${PACK}/behavior`;
const RP = `${PACK}/resource`;

const read = (path: string) => readFileSync(path, "utf8");
const json = <T>(path: string) => JSON.parse(read(path)) as T;

/** Width and height of a PNG, from its IHDR chunk. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path, "latin1");
  const u32 = (o: number) =>
    ((b.charCodeAt(o) << 24) | (b.charCodeAt(o + 1) << 16) | (b.charCodeAt(o + 2) << 8) | b.charCodeAt(o + 3)) >>> 0; // prettier-ignore
  return [u32(16), u32(20)];
}

const run = (script: string) => spawnSync("node", [script, "--check"], { encoding: "utf8" });

interface Flipbook {
  flipbook_texture: string;
  atlas_tile: string;
  ticks_per_frame?: number;
  blend_frames?: boolean;
}

describe("cooking pot boil (flipbook looks)", () => {
  const terrain = json<{ texture_data: Record<string, { textures: string }> }>(
    `${RP}/textures/terrain_texture.json`,
  ).texture_data;
  const flipbooks = json<Flipbook[]>(`${RP}/textures/flipbook_textures.json`);

  it("the strips and registry entries are what the generator writes", () => {
    const r = run("tools/gen-pot-flipbook.mjs");
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  it("every liquid colour and the rim have a strip of whole 16×16 frames, registered", () => {
    const names = [...LIQUIDS.map((l) => `cooking_pot_liquid_${l}_boil`), "cooking_pot_top_boil"];
    for (const name of names) {
      const shortname = `wm_kitchen_${name}`;
      const path = `textures/wm_kitchen/blocks/${name}`;
      assert.equal(terrain[shortname]?.textures, path, `${shortname} in terrain_texture.json`);
      const [w, h] = pngSize(`${RP}/${path}.png`);
      assert.equal(w, 16, name);
      assert.ok(h > 16 && h % 16 === 0, `${name}: ${h} px tall`);
      const entries = flipbooks.filter((f) => f.atlas_tile === shortname);
      assert.equal(entries.length, 1, `${shortname} in flipbook_textures.json`);
      assert.equal(entries[0]?.flipbook_texture, path);
      assert.equal(entries[0]?.blend_frames, false, "pixel art: no blending between frames");
    }
  });

  it("our flipbook entries only name wm_kitchen_ shortnames (path-namespaced registry)", () => {
    for (const f of flipbooks) {
      if (!f.flipbook_texture.startsWith("textures/wm_kitchen/")) continue;
      assert.match(f.atlas_tile, /^wm_kitchen_/);
    }
  });

  it("lid on only while cooking without heat (paused); boiling shows the bubbles", () => {
    const pot = stationById("pot");
    const block = json<{
      "minecraft:block": {
        components: { "minecraft:geometry": { bone_visibility: Record<string, string> } };
      };
    }>(`${BP}/blocks/cooking_pot.json`);
    const lid = block["minecraft:block"].components["minecraft:geometry"].bone_visibility.lid;
    assert.ok(pot && lid);
    const { phase, hot } = pot.states;
    assert.ok(phase && hot);
    for (const ph of ["idle", "ready", "cooking", "done"]) {
      for (const isHot of [false, true]) {
        const states: Record<string, MolangValue> = { [phase]: ph, [hot]: isHot };
        assert.equal(evalCondition(lid, states), ph === "cooking" && !isHot, `${ph} hot=${isHot}`);
      }
    }
  });
});

// --- fx entities ----------------------------------------------------------------------------------

interface EntityJson {
  format_version: string;
  "minecraft:entity": {
    description: { identifier: string; is_spawnable?: boolean; is_summonable?: boolean };
    component_groups?: Record<string, Record<string, unknown>>;
    components: Record<string, unknown>;
    events?: Record<string, { add?: { component_groups: string[] } }>;
  };
}

interface ClientEntityJson {
  "minecraft:client_entity": {
    description: {
      identifier: string;
      materials: Record<string, string>;
      textures: Record<string, string>;
      geometry: Record<string, string>;
      animations: Record<string, string>;
      scripts?: { animate?: string[] };
      render_controllers: string[];
      particle_effects?: Record<string, string>;
    };
  };
}

interface GeoJson {
  "minecraft:geometry": {
    description: { identifier: string };
    bones: { name: string; locators?: Record<string, unknown> }[];
  }[];
}

interface AnimationJson {
  animations: Record<
    string,
    {
      bones?: Record<string, unknown>;
      particle_effects?: Record<string, { effect: string; locator?: string }>;
    }
  >;
}

const jsonDir = <T>(dir: string): T[] =>
  readdirSync(dir, { recursive: true })
    .filter((f) => f.endsWith(".json"))
    .map((f) => json<T>(`${dir}/${f}`));

describe("fx entities (scripts/fx)", () => {
  const behaviors = new Map(
    jsonDir<EntityJson>(`${BP}/entities`).map(
      (e) => [e["minecraft:entity"].description.identifier, e] as const,
    ),
  );
  const clients = new Map(
    jsonDir<ClientEntityJson>(`${RP}/entity`).map(
      (e) => [e["minecraft:client_entity"].description.identifier, e] as const,
    ),
  );
  const geometries = new Map(
    jsonDir<GeoJson>(`${RP}/models/entity`).flatMap((g) =>
      g["minecraft:geometry"].map((geo) => [geo.description.identifier, geo] as const),
    ),
  );
  const animations = Object.assign(
    {},
    ...jsonDir<AnimationJson>(`${RP}/animations`).map((a) => a.animations),
  ) as AnimationJson["animations"];
  const particles = new Set(
    jsonDir<{ particle_effect: { description: { identifier: string } } }>(`${RP}/particles`).map(
      (p) => p.particle_effect.description.identifier,
    ),
  );
  const renderControllers = new Set(
    jsonDir<{ render_controllers: Record<string, unknown> }>(`${RP}/render_controllers`).flatMap(
      (r) => Object.keys(r.render_controllers),
    ),
  );

  it("the textures and animations are what make-fx-tools writes", () => {
    const r = run("art/simmerfield/models/_tools/make-fx-tools.mjs");
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });

  for (const id of FX_ENTITY_TYPES) {
    it(`${id}: never natural, summonable for the script, no loot, can't be hit, pushed or hurt`, () => {
      const entity = behaviors.get(id)?.["minecraft:entity"];
      assert.ok(entity, `behavior/entities defines ${id}`);
      assert.equal(entity.description.is_spawnable, false, "no spawn egg");
      // is_summonable false also makes Dimension.spawnEntity throw (seen in game 2026-10-23), so it
      // stays true; fx.ts removes any fx entity it didn't spawn itself (entitySpawn).
      assert.equal(entity.description.is_summonable, true, "the script can spawn it");
      const c = entity.components;
      assert.equal(c["minecraft:loot"], undefined);
      assert.equal(c["minecraft:pushable_by_entity"], undefined);
      assert.equal(c["minecraft:pushable_by_block"], undefined);
      assert.equal(c["minecraft:persistent"], undefined);
      assert.deepEqual(c["minecraft:physics"], { has_gravity: false, has_collision: false });
      assert.deepEqual(c["minecraft:damage_sensor"], {
        triggers: { cause: "all", deals_damage: "no" },
      });
      assert.deepEqual(c["minecraft:custom_hit_test"], {
        hitboxes: [{ width: 0, height: 0, pivot: [0, 0, 0] }],
      });
      // the safety net: a timer that despawns it even if the script never does
      const timer = c["minecraft:timer"] as { time_down_event: { event: string } } | undefined;
      const event = timer && entity.events?.[timer.time_down_event.event];
      const groups = event?.add?.component_groups ?? [];
      assert.ok(
        groups.some((g) => entity.component_groups?.[g]?.["minecraft:instant_despawn"]),
        "the timer's event adds minecraft:instant_despawn",
      );
    });

    it(`${id}: no spawn rules`, () => {
      const dir = `${BP}/spawn_rules`;
      if (!existsSync(dir)) return;
      for (const f of readdirSync(dir, { recursive: true })) {
        if (f.endsWith(".json")) assert.ok(!read(`${dir}/${f}`).includes(`"${id}"`), f);
      }
    });

    it(`${id}: client entity, geometry, texture, animation bones, particles all resolve`, () => {
      const d = clients.get(id)?.["minecraft:client_entity"].description;
      assert.ok(d, `resource/entity defines ${id}`);
      const geo = geometries.get(d.geometry.default ?? "");
      assert.ok(geo, `geometry ${d.geometry.default}`);
      const bones = new Set(geo.bones.map((b) => b.name));
      const locators = new Set(geo.bones.flatMap((b) => Object.keys(b.locators ?? {})));
      assert.ok(existsSync(`${RP}/${d.textures.default}.png`), `${d.textures.default}.png`);
      for (const rc of d.render_controllers) assert.ok(renderControllers.has(rc), rc);
      for (const key of d.scripts?.animate ?? []) {
        const anim = animations[d.animations[key] ?? ""];
        assert.ok(anim, `animation ${key} -> ${d.animations[key]}`);
        for (const bone of Object.keys(anim.bones ?? {})) assert.ok(bones.has(bone), bone);
        for (const p of Object.values(anim.particle_effects ?? {})) {
          const particle = d.particle_effects?.[p.effect];
          assert.ok(particle && particles.has(particle), `particle ${p.effect}`);
          if (p.locator) assert.ok(locators.has(p.locator), `locator ${p.locator}`);
        }
      }
    });

    it(`${id}: has a name in the lang file`, () => {
      assert.ok(read(`${RP}/texts/en_US.lang`).includes(`\nentity.${id}.name=`));
    });
  }
});

// --- the board's own knife picks itself up (art review rework) ----------------------------------

interface BoardJson {
  "minecraft:block": {
    description: { states?: Record<string, unknown> };
    components: {
      "minecraft:geometry": { identifier: string; bone_visibility?: Record<string, string> };
    };
    permutations: { condition: string; components: Record<string, unknown> }[];
  };
}

interface GeoCube {
  origin: number[];
  size: number[];
}

describe("cutting board: the resting knife hides while the fx knife chops", () => {
  const board = json<BoardJson>(`${BP}/blocks/cutting_board.json`)["minecraft:block"];
  const geoBones = (path: string) =>
    json<{ "minecraft:geometry": { bones: { name: string; cubes?: GeoCube[] }[] }[] }>(path)[
      "minecraft:geometry"
    ][0]?.bones ?? [];

  it(`declares ${FX_BOARD_CHOPPING_STATE} as a bool state (default false: the knife shows)`, () => {
    assert.deepEqual(board.description.states?.[FX_BOARD_CHOPPING_STATE], [false, true]);
  });

  it("the knife bone shows exactly when not chopping", () => {
    const rule = board.components["minecraft:geometry"].bone_visibility?.knife;
    assert.ok(rule, "bone_visibility.knife");
    for (const [chopping, visible] of [
      [false, true],
      [true, false],
    ] as const) {
      assert.equal(evalCondition(rule, { [FX_BOARD_CHOPPING_STATE]: chopping }), visible);
    }
    const bones = geoBones(`${RP}/models/blocks/wm_kitchen/cutting_board.geo.json`).map(
      (b) => b.name,
    );
    assert.ok(bones.includes("knife"), "the board geometry has a knife bone");
  });

  it("the facing permutations are unchanged: four, transformation only", () => {
    assert.equal(board.permutations.length, 4);
    for (const p of board.permutations) {
      assert.deepEqual(Object.keys(p.components), ["minecraft:transformation"]);
      assert.ok(!p.condition.includes(FX_BOARD_CHOPPING_STATE));
    }
  });

  it("the fx knife is the board's knife: same cubes, same texture", () => {
    const cubes = (bones: { name: string; cubes?: GeoCube[] }[], name: string) =>
      (bones.find((b) => b.name === name)?.cubes ?? [])
        .map((c) => JSON.stringify([c.origin, c.size]))
        .sort();
    const resting = cubes(
      geoBones(`${RP}/models/blocks/wm_kitchen/cutting_board.geo.json`),
      "knife",
    );
    const fx = cubes(geoBones(`${RP}/models/entity/wm_kitchen/fx_knife.geo.json`), "knife");
    assert.equal(resting.length, 4);
    assert.deepEqual(fx, resting);
    assert.equal(
      readFileSync(`${RP}/textures/wm_kitchen/entity/fx_knife.png`, "latin1"),
      readFileSync(`${RP}/textures/wm_kitchen/blocks/cutting_board_knife.png`, "latin1"),
    );
  });

  it("the fx knife starts at rest (pick-up from 0, held) and then chops on the outer bone", () => {
    const d = clients_("wm_kitchen:fx_knife");
    const anims = (d.scripts?.animate ?? []).map((k) => d.animations[k] ?? "");
    const pickUp = animationsById()[anims.find((a) => a.endsWith(".pick_up")) ?? ""];
    const chop = animationsById()[anims.find((a) => a.endsWith(".chop")) ?? ""];
    assert.ok(pickUp && chop, "both animations play");
    assert.equal(pickUp.loop, "hold_on_last_frame");
    assert.deepEqual(Object.keys(pickUp.bones ?? {}), ["knife"]);
    assert.deepEqual(Object.keys(chop.bones ?? {}), ["chop"]);
    const first = (pickUp.bones?.knife as { rotation: Record<string, number[]> }).rotation["0.0"];
    assert.deepEqual(first, [0, 0, 0], "frame 0 is the resting pose");
  });
});

function clients_(id: string) {
  const d = jsonDir<ClientEntityJson>(`${RP}/entity`).find(
    (e) => e["minecraft:client_entity"].description.identifier === id,
  )?.["minecraft:client_entity"].description;
  assert.ok(d, id);
  return d;
}

function animationsById() {
  return Object.assign(
    {},
    ...jsonDir<{ animations: Record<string, { loop?: unknown; bones?: Record<string, unknown> }> }>(
      `${RP}/animations`,
    ).map((a) => a.animations),
  ) as Record<string, { loop?: unknown; bones?: Record<string, unknown> }>;
}
