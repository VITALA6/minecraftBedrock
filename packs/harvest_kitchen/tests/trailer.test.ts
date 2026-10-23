import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  HANDLE_SECONDS,
  MARKER_SECONDS,
  MAX_GROWTH,
  SCENES,
  SET_BOUNDS,
  SET_LAYOUT,
  STILLS,
  totalDuration,
} from "../scripts/trailer/scenes";
import {
  blockToWorld,
  cardinalOf,
  facingFromYaw,
  parseAnchor,
  rotate,
  serializeAnchor,
  toWorld,
  type Anchor,
} from "../scripts/trailer/set-space";
import { parseTrailerCommand } from "../scripts/trailer/trailer-command";
import { sceneStartTick, sceneTimeline, toTicks } from "../scripts/trailer/timeline";

// The trailer scenes (scripts/trailer/) against the plan, docs/harvest-kitchen/marketing/trailer.md.

const PLAN = readFileSync("docs/harvest-kitchen/marketing/trailer.md", "utf8");
const BLOCKS = "packs/harvest_kitchen/behavior/blocks";

/** Shot list rows: "| 3   | 0:07–0:11 | 4 s | ...". */
function planShots(): { shot: number; from: number; to: number; dur: number }[] {
  const rows = [...PLAN.matchAll(/^\| (\d+)\s+\| (\d+):(\d+)–(\d+):(\d+) \| (\d+) s \|/gm)];
  return rows.map((m) => ({
    shot: Number(m[1]),
    from: Number(m[2]) * 60 + Number(m[3]),
    to: Number(m[4]) * 60 + Number(m[5]),
    dur: Number(m[6]),
  }));
}

describe("trailer scenes match the plan", () => {
  it("every shot in the shot list has one scene with the plan's duration", () => {
    const shots = planShots();
    assert.equal(shots.length, 13);
    assert.deepEqual(
      SCENES.map((s) => s.shot),
      shots.map((s) => s.shot),
    );
    for (const plan of shots) {
      const scene = SCENES.find((s) => s.shot === plan.shot);
      assert.ok(scene, `shot ${plan.shot}`);
      assert.equal(scene.duration, plan.dur, `shot ${plan.shot} duration`);
      assert.equal(plan.to - plan.from, plan.dur, `shot ${plan.shot}: time column vs Dur`);
    }
  });

  it("durations add up to the plan's timeline (~48 s)", () => {
    const shots = planShots();
    assert.equal(totalDuration(), shots.at(-1)?.to);
    assert.equal(totalDuration(), 48);
    let t = 0;
    for (const scene of SCENES) {
      assert.equal(shots.find((s) => s.shot === scene.shot)?.from, t, scene.name);
      t += scene.duration;
    }
  });

  it("scene names are unique, file-name safe and listed in the In-game scenes section", () => {
    const names = SCENES.map((s) => s.name);
    assert.equal(new Set(names).size, names.length);
    const section = PLAN.split("## In-game scenes")[1]?.split("\n## ")[0] ?? "";
    for (const name of names) {
      assert.match(name, /^[a-z]+$/);
      assert.ok(section.includes(`\`${name}\``), `${name} in trailer.md "In-game scenes"`);
    }
  });

  it("still cameras 1-8 exist and match the screenshot headings", () => {
    const headings = [...PLAN.matchAll(/^### (\d)\. (.+)$/gm)].map((m) => ({
      n: Number(m[1]),
      title: m[2]?.replace(/"/g, ""),
    }));
    assert.deepEqual(
      STILLS.map((s) => s.n),
      [1, 2, 3, 4, 5, 6, 7, 8],
    );
    assert.deepEqual(
      STILLS.map((s) => ({ n: s.n, title: s.title })),
      headings,
    );
  });
});

describe("trailer keyframes and cues", () => {
  for (const scene of SCENES) {
    it(`${scene.name}: keyframes start at 0, increase, and end on the duration`, () => {
      if (scene.camera !== "scripted") {
        assert.equal(scene.keys.length, 0);
        return;
      }
      assert.ok(scene.keys.length >= 1);
      assert.equal(scene.keys[0]?.at, 0);
      assert.ok(!scene.keys[0]?.cut);
      for (let i = 1; i < scene.keys.length; i++) {
        const [a, b] = [scene.keys[i - 1], scene.keys[i]];
        assert.ok(a && b && b.at > a.at, `key ${i} after key ${i - 1}`);
      }
      const last = scene.keys.at(-1);
      // A static shot is one keyframe; a moving one ends exactly on the duration.
      if (scene.keys.length > 1) assert.equal(last?.at, scene.duration);
      assert.ok(scene.fov === undefined || (scene.fov >= 30 && scene.fov <= 110));
      for (const cue of scene.cues ?? []) {
        assert.ok(cue.time >= 0 && cue.time <= scene.duration, `cue at ${cue.time}`);
      }
    });
  }

  it("timeline: marker, handle, moves in order, closing marker, end", () => {
    const lava = SCENES.find((s) => s.name === "lava");
    assert.ok(lava);
    const steps = sceneTimeline(lava, 5);
    const ticks = steps.map((s) => s.tick);
    assert.deepEqual(
      ticks,
      [...ticks].sort((a, b) => a - b),
    );
    assert.equal(steps[0]?.kind, "camera");
    assert.equal(steps[0]?.tick, 0);
    const start = sceneStartTick(5);
    assert.equal(start, toTicks(5 + MARKER_SECONDS + HANDLE_SECONDS));
    const markers = steps.filter((s) => s.kind === "marker").map((s) => s.tick);
    assert.deepEqual(markers, [toTicks(5), start + toTicks(lava.duration + HANDLE_SECONDS)]);
    assert.equal(steps.at(-1)?.kind, "end");
    // The cut at 1.5 s jumps (no ease); the move after it starts one tick later.
    const cameras = steps.filter((s) => s.kind === "camera");
    assert.equal(cameras[1]?.tick, start + toTicks(1.5));
    assert.equal(cameras[1]?.ease, undefined);
    assert.equal(cameras[2]?.tick, start + toTicks(1.5) + 1);
    assert.ok(cameras[2]?.ease && Math.abs(cameras[2].ease.seconds - 2.45) < 1e-9);
  });

  it("orbit keyframes are evenly timed and keep the radius", () => {
    const cake = SCENES.find((s) => s.name === "cake");
    assert.ok(cake);
    assert.equal(cake.keys.length, 7);
    for (const key of cake.keys) {
      const r = Math.hypot(key.pos.x - key.look.x, key.pos.z - key.look.z);
      assert.ok(Math.abs(r - 4.6) < 1e-9);
    }
  });
});

describe("trailer set", () => {
  it("every crop and bush grows 0..MAX_GROWTH (staged stages exist)", () => {
    for (const block of [
      "tomato_crop",
      "onion_crop",
      "cucumber_crop",
      "chili_bush",
      "strawberry_bush",
    ]) {
      const json = JSON.parse(readFileSync(`${BLOCKS}/${block}.json`, "utf8")) as {
        "minecraft:block": { description: { states: Record<string, { values: { max: number } }> } };
      };
      const states = json["minecraft:block"].description.states;
      assert.equal(states["hk:growth"]?.values.max, MAX_GROWTH, block);
    }
  });

  it("one block per position, all inside the cleared area", () => {
    const seen = new Set<string>();
    for (const { at } of SET_LAYOUT) {
      const key = `${at.x},${at.y},${at.z}`;
      assert.ok(!seen.has(key), `two blocks at ${key}`);
      seen.add(key);
      assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y) && Number.isInteger(at.z));
      assert.ok(at.x >= SET_BOUNDS.min.x && at.x <= SET_BOUNDS.max.x, key);
      assert.ok(at.z >= SET_BOUNDS.min.z && at.z <= SET_BOUNDS.max.z, key);
      assert.ok(at.y >= SET_BOUNDS.min.y - 2 && at.y <= SET_BOUNDS.max.y, key);
    }
  });
});

describe("set space", () => {
  const anchor: Anchor = { x: 10, y: 64, z: -3, dimension: "minecraft:overworld", facing: "east" };

  it("facing east: forward is +x, right is +z (south)", () => {
    assert.deepEqual(rotate("east", { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 });
    assert.deepEqual(rotate("east", { x: 1, y: 0, z: 0 }), { x: 0, y: 0, z: 1 });
    assert.deepEqual(rotate("north", { x: 1, y: 0, z: 0 }), { x: 1, y: 0, z: 0 });
    assert.deepEqual(rotate("south", { x: 1, y: 2, z: 0 }), { x: -1, y: 2, z: 0 });
  });

  it("a block offset's centre is the same set point", () => {
    for (const facing of ["north", "south", "east", "west"] as const) {
      const a = { ...anchor, facing };
      const block = blockToWorld(a, { x: 3, y: 1, z: -2 });
      const centre = toWorld(a, { x: 3, y: 1, z: -2 });
      assert.deepEqual(centre, { x: block.x + 0.5, y: block.y, z: block.z + 0.5 });
    }
  });

  it("yaw snaps to the nearest cardinal; directions turn with the anchor", () => {
    assert.equal(facingFromYaw(0), "south");
    assert.equal(facingFromYaw(95), "west");
    assert.equal(facingFromYaw(-180), "north");
    assert.equal(facingFromYaw(-80), "east");
    assert.equal(facingFromYaw(271), "east");
    assert.equal(cardinalOf("south", "right"), "west");
    assert.equal(cardinalOf("north", "right"), "east");
    assert.equal(cardinalOf("east", "back"), "west");
    assert.equal(cardinalOf("east", "left"), "north");
  });

  it("anchor round-trips through its property string; junk is rejected", () => {
    assert.deepEqual(parseAnchor(serializeAnchor(anchor)), anchor);
    assert.equal(parseAnchor(undefined), undefined);
    assert.equal(parseAnchor("{"), undefined);
    assert.equal(parseAnchor(JSON.stringify({ ...anchor, facing: "up" })), undefined);
    assert.equal(parseAnchor(JSON.stringify({ ...anchor, x: 1.5 })), undefined);
  });
});

describe("hk:trailer command", () => {
  it("parses every command", () => {
    assert.deepEqual(parseTrailerCommand(""), { kind: "list" });
    assert.deepEqual(parseTrailerCommand(" Stop "), { kind: "stop" });
    assert.deepEqual(parseTrailerCommand("anchor"), { kind: "anchor" });
    assert.deepEqual(parseTrailerCommand("stage"), { kind: "stage" });
    assert.deepEqual(parseTrailerCommand("still 8"), { kind: "still", n: 8 });
    assert.deepEqual(parseTrailerCommand("farm"), { kind: "scene", name: "farm", preroll: 5 });
    assert.deepEqual(parseTrailerCommand("cake 10"), { kind: "scene", name: "cake", preroll: 10 });
  });

  it("rejects what it can't run", () => {
    for (const bad of ["still 9", "still", "nope", "farm -1", "farm x", "farm 1 2", "stop now"]) {
      assert.equal(parseTrailerCommand(bad).kind, "error", bad);
    }
  });
});

describe("tools/edit-trailer.mjs --check", () => {
  it("the edit list matches the scenes (names, trims, handles, cut lengths)", () => {
    const result = spawnSync("node", ["tools/edit-trailer.mjs", "--check"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /edit list OK/);
  });
});
