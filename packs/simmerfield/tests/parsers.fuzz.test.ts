import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCENES } from "../scripts/trailer/scenes";
import { STATION_RECIPES } from "../scripts/data/recipes";
import { parseFound, serializeFound } from "../scripts/discovery/unlock";
import { parseSaved, serializeSaved, type StationState } from "../scripts/stations/station-logic";
import {
  FACINGS,
  facingFromYaw,
  parseAnchor,
  rotate,
  serializeAnchor,
  type Anchor,
} from "../scripts/trailer/set-space";
import { parseTrailerCommand } from "../scripts/trailer/trailer-command";
import { property, type Rng } from "./fuzz";

// Everything the scripts read back from the world (dynamic properties) or from a command line, fed
// random and malformed input: the parsers must never throw, must return either nothing or a value
// that holds their invariants, and must round-trip what their serializers write.

const CHARS = ' {}[]":,0123456789-.eE+abcnulltruefalse\\/é\u{1F345}';

function randomText(rng: Rng, max = 40): string {
  let s = "";
  for (let n = rng.int(0, max); n > 0; n--) s += rng.pick([...CHARS]);
  return s;
}

/** A random JSON value, biased toward the shapes the parsers look for. */
function randomJson(rng: Rng, depth = 0): unknown {
  const kind = rng.int(0, depth > 2 ? 4 : 7);
  switch (kind) {
    case 0:
      return null;
    case 1:
      return rng.bool();
    case 2:
      return rng.pick([0, 1, -1, 2.5, 1e308, -0, 3, 64, rng.int(-1000, 1000)]);
    case 3:
      return rng.pick(["", "pot", "wm_kitchen:tomato_soup", "minecraft:overworld", "east", "x"]);
    case 4:
      return randomText(rng, 8);
    case 5:
      return Array.from({ length: rng.int(0, 4) }, () => randomJson(rng, depth + 1));
    default: {
      const keys = ["st", "dim", "pos", "items", "job", "out", "recipe", "ticks", "total"];
      const more = ["servings", "item", "count", "x", "y", "z", "dimension", "facing", "__proto__"];
      const obj: Record<string, unknown> = {};
      for (let n = rng.int(0, 5); n > 0; n--) {
        obj[rng.pick([...keys, ...more, "wm_kitchen:tomato_soup_mix"])] = randomJson(
          rng,
          depth + 1,
        );
      }
      return obj;
    }
  }
}

/** A random input: JSON (often almost right), broken JSON or plain text. */
function randomInput(rng: Rng): string {
  const json = JSON.stringify(randomJson(rng)) ?? "null";
  return rng.weighted([
    [json, 5],
    [json.slice(0, rng.int(0, json.length)), 2],
    [randomText(rng), 2],
  ] as const);
}

const positiveInt = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n > 0;

function randomState(rng: Rng): StationState {
  const items: Record<string, number> = {};
  for (let n = rng.int(0, 4); n > 0; n--)
    items[`wm_kitchen:item_${rng.int(0, 5)}`] = rng.int(1, 64);
  const recipe = rng.pick(STATION_RECIPES);
  const total = rng.int(1, 400);
  return {
    items,
    ...(rng.bool(0.4)
      ? { job: { recipe: recipe.id, ticks: rng.int(0, total), total, servings: rng.int(1, 4) } }
      : {}),
    ...(rng.bool(0.3) ? { out: { item: recipe.result, count: rng.int(1, 4) } } : {}),
  };
}

/** A saved station value with one field (anywhere in it) replaced by random JSON. */
function mutatedSaved(rng: Rng): string {
  const value = JSON.parse(
    serializeSaved("pot", "minecraft:overworld", { x: 1, y: 2, z: 3 }, randomState(rng)),
  ) as Record<string, unknown>;
  const objects: Record<string, unknown>[] = [value];
  for (const v of Object.values(value)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v))
      objects.push(v as Record<string, unknown>);
  }
  const target = rng.pick(objects);
  const keys = Object.keys(target);
  if (keys.length > 0) target[rng.pick(keys)] = randomJson(rng, 2);
  return JSON.stringify(value);
}

describe("station saved form (property)", () => {
  it("any input parses without throwing, to nothing or a valid state", () => {
    property("parseSaved never throws", 1500, (rng, note) => {
      const raw = rng.bool(0.5) ? mutatedSaved(rng) : randomInput(rng);
      note("raw", raw);
      const saved = parseSaved(raw);
      if (!saved) return;
      const { items, job, out } = saved.state;
      for (const [id, n] of Object.entries(items)) assert.ok(positiveInt(n), `${id}: ${n}`);
      if (job) {
        assert.equal(typeof job.recipe, "string");
        assert.ok(Number.isInteger(job.ticks) && job.ticks >= 0, `ticks ${job.ticks}`);
        assert.ok(positiveInt(job.total) && positiveInt(job.servings));
      }
      if (out) assert.ok(typeof out.item === "string" && positiveInt(out.count));
      if (saved.pos) for (const n of Object.values(saved.pos)) assert.equal(typeof n, "number");
      // what it read is stable: writing it and reading again gives the same state
      const again = parseSaved(serializeSaved("pot", "d", { x: 0, y: 0, z: 0 }, saved.state));
      assert.deepEqual(again?.state, saved.state);
    });
  });

  it("every state the engine writes reads back unchanged", () => {
    property("saved form round-trips", 500, (rng, note) => {
      const state = randomState(rng);
      const pos = { x: rng.int(-3e7, 3e7), y: rng.int(-64, 320), z: rng.int(-3e7, 3e7) };
      note("state", state);
      const saved = parseSaved(serializeSaved("pot", "minecraft:the_end", pos, state));
      assert.deepEqual(saved, { state, station: "pot", dim: "minecraft:the_end", pos });
    });
  });
});

describe("trailer anchor (property)", () => {
  it("any input parses without throwing; anchors round-trip; yaws snap to a facing", () => {
    property("anchor", 800, (rng, note) => {
      const raw = randomInput(rng);
      note("raw", raw);
      const parsed = parseAnchor(raw);
      if (parsed) {
        assert.ok(FACINGS.includes(parsed.facing));
        assert.ok([parsed.x, parsed.y, parsed.z].every(Number.isInteger));
      }
      assert.equal(parseAnchor(rng.pick([undefined, 5, true, null, {}])), undefined);
      const anchor: Anchor = {
        x: rng.int(-3e7, 3e7),
        y: rng.int(-64, 320),
        z: rng.int(-3e7, 3e7),
        dimension: rng.pick(["minecraft:overworld", "minecraft:nether", "x"]),
        facing: rng.pick(FACINGS),
      };
      assert.deepEqual(parseAnchor(serializeAnchor(anchor)), anchor);
      const yaw = (rng.next() - 0.5) * 7200;
      assert.ok(FACINGS.includes(facingFromYaw(yaw)), `yaw ${yaw}`);
      // a quarter turn more turns the snapped facing by one step
      const i = FACINGS.indexOf(facingFromYaw(yaw));
      assert.equal(facingFromYaw(yaw + 90), FACINGS[(i + 1) % 4], `yaw ${yaw} + 90`);
      const v = { x: rng.int(-9, 9), y: rng.int(-9, 9), z: rng.int(-9, 9) };
      const r = rotate(anchor.facing, v);
      assert.equal(r.y, v.y);
      assert.equal(Math.hypot(r.x, r.z), Math.hypot(v.x, v.z), "rotating keeps distances");
    });
  });
});

describe("found crops property (property)", () => {
  it("any value parses; sets of keys round-trip", () => {
    property("found", 500, (rng, note) => {
      const raw = rng.bool(0.5) ? randomInput(rng) : randomJson(rng);
      note("raw", raw);
      const found = parseFound(raw);
      assert.ok(found instanceof Set);
      if (typeof raw !== "string" || raw === "") assert.equal(found.size, 0);
      const keys = new Set(
        Array.from({ length: rng.int(0, 6) }, () => rng.pick(["tomato", "onion", "chili", "a_b"])),
      );
      assert.deepEqual(parseFound(serializeFound(keys)), keys);
    });
  });
});

describe("trailer command (property)", () => {
  const names = SCENES.map((s) => s.name);
  const words = [...names, "list", "help", "anchor", "stage", "stop", "still", "", "x"];

  it("any line parses without throwing, to a command that can run or an error", () => {
    property("trailer command", 1500, (rng, note) => {
      const parts = Array.from({ length: rng.int(0, 3) }, () =>
        rng.weighted([
          [rng.pick(words), 4],
          [String(rng.pick([0, 1, 8, 9, -1, 2.5, 60, 61, 1e9, Number.NaN])), 2],
          [randomText(rng, 6), 1],
        ] as const),
      );
      const line = parts.join(rng.pick([" ", "  ", "\t", " \n "]));
      note("line", line);
      const command = parseTrailerCommand(line);
      switch (command.kind) {
        case "scene":
          assert.ok(names.includes(command.name), command.name);
          assert.ok(Number.isFinite(command.preroll), `preroll ${command.preroll}`);
          assert.ok(command.preroll >= 0 && command.preroll <= 60, `preroll ${command.preroll}`);
          break;
        case "still":
          assert.ok(Number.isInteger(command.n) && command.n >= 1 && command.n <= 8);
          break;
        case "error":
          assert.ok(command.message.length > 0);
          break;
        default:
          assert.ok(["list", "anchor", "stage", "stop"].includes(command.kind));
      }
      // case and surrounding whitespace don't matter
      assert.deepEqual(parseTrailerCommand(`  ${line.toUpperCase()} \t`), command);
    });
  });
});
