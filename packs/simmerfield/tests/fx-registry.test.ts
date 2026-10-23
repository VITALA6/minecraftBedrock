import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FX_BOARD_YAW,
  FX_CAPS,
  FX_TIMING,
  type FxCaps,
  type FxKind,
} from "../scripts/fx/fx-config";
import { FxRegistry, areaKey, ownerKey, type FxSpot } from "../scripts/fx/fx-registry";

// The fx bookkeeping (scripts/fx/fx-registry.ts): caps per area and in total, one fx per station
// and kind, knife expiry, and forgetting entities by id (unload / despawn events).

const CAPS: FxCaps = { areaSize: 16, perAreaKind: { knife: 2, spoon: 2 }, perArea: 3, total: 5 };

const spot = (x: number, z: number, dimension = "minecraft:overworld"): FxSpot => ({
  dimension,
  x,
  y: 64,
  z,
});

let ids = 0;
function add(reg: FxRegistry<string>, kind: FxKind, at: FxSpot, expires?: number): boolean {
  const id = `e${++ids}`;
  return reg.add({ owner: ownerKey(kind, at), kind, spot: at, id, handle: id, expires });
}

describe("fx registry: caps", () => {
  it("allows up to the per-kind cap in one area, then refuses that kind", () => {
    const reg = new FxRegistry<string>(CAPS);
    assert.ok(add(reg, "knife", spot(0, 0)));
    assert.ok(add(reg, "knife", spot(1, 0)));
    assert.equal(reg.canAdd("knife", spot(2, 0)), false);
    assert.equal(add(reg, "knife", spot(2, 0)), false);
    assert.equal(reg.size, 2, "a refused add changes nothing");
    assert.ok(reg.canAdd("spoon", spot(3, 0)), "the other kind still fits");
  });

  it("caps all kinds together per area", () => {
    const reg = new FxRegistry<string>(CAPS);
    add(reg, "knife", spot(0, 0));
    add(reg, "knife", spot(1, 0));
    add(reg, "spoon", spot(2, 0));
    assert.equal(reg.canAdd("spoon", spot(3, 0)), false);
  });

  it("areas are 16×16 columns per dimension: the next area and other dimensions have room", () => {
    const reg = new FxRegistry<string>(CAPS);
    add(reg, "knife", spot(0, 0));
    add(reg, "knife", spot(15, 15));
    assert.equal(reg.canAdd("knife", spot(8, 8)), false);
    assert.ok(reg.canAdd("knife", spot(16, 0)));
    assert.ok(reg.canAdd("knife", spot(-1, 0)), "negative coordinates are another area");
    assert.ok(reg.canAdd("knife", spot(0, 0, "minecraft:nether")));
    assert.notEqual(areaKey(spot(-1, 0), 16), areaKey(spot(0, 0), 16));
  });

  it("caps the whole world", () => {
    const reg = new FxRegistry<string>(CAPS);
    for (let i = 0; i < 5; i++) assert.ok(add(reg, "spoon", spot(i * 16, 0)));
    assert.equal(reg.canAdd("spoon", spot(100 * 16, 0)), false);
  });

  it("replacing a station's own fx doesn't count against the caps", () => {
    const reg = new FxRegistry<string>(CAPS);
    add(reg, "knife", spot(0, 0));
    add(reg, "knife", spot(1, 0));
    assert.ok(reg.canAdd("knife", spot(1, 0)));
    assert.ok(add(reg, "knife", spot(1, 0)));
    assert.equal(reg.size, 2, "one per station and kind");
  });

  it("removing frees the slot", () => {
    const reg = new FxRegistry<string>(CAPS);
    add(reg, "knife", spot(0, 0));
    add(reg, "knife", spot(1, 0));
    reg.remove(ownerKey("knife", spot(0, 0)));
    assert.ok(reg.canAdd("knife", spot(2, 0)));
  });

  it("the shipped caps are sane: per kind ≤ per area ≤ total", () => {
    for (const n of Object.values(FX_CAPS.perAreaKind)) assert.ok(n >= 1 && n <= FX_CAPS.perArea);
    assert.ok(FX_CAPS.perArea <= FX_CAPS.total);
    assert.ok(FX_CAPS.total <= 64, "the fx loop walks every entry");
  });
});

describe("fx registry: lifetime", () => {
  it("knives expire at their tick, and extend() pushes it back (sneak-chop)", () => {
    const reg = new FxRegistry<string>(CAPS);
    const board = spot(0, 0);
    add(reg, "knife", board, 120);
    add(reg, "spoon", spot(1, 0));
    assert.deepEqual(reg.expired(119), []);
    assert.equal(reg.expired(120).length, 1);
    assert.ok(reg.extend(ownerKey("knife", board), 140));
    assert.deepEqual(reg.expired(130), []);
    assert.equal(reg.expired(1e9).length, 1, "spoons never expire by time");
    assert.equal(reg.extend(ownerKey("knife", spot(5, 5)), 1), false);
  });

  it("forgets an entity by id (unloaded with its chunk, despawned)", () => {
    const reg = new FxRegistry<string>(CAPS);
    const at = spot(0, 0);
    add(reg, "spoon", at);
    const entry = reg.get(ownerKey("spoon", at));
    assert.ok(entry && reg.hasId(entry.id));
    assert.equal(reg.removeId(entry.id)?.owner, entry.owner);
    assert.equal(reg.hasId(entry.id), false);
    assert.equal(reg.get(ownerKey("spoon", at)), undefined);
    assert.equal(reg.removeId("nope"), undefined);
    assert.equal(reg.count("spoon"), 0);
  });

  it("owners are per kind and block: a board and a pot never share one", () => {
    assert.notEqual(ownerKey("knife", spot(0, 0)), ownerKey("spoon", spot(0, 0)));
    assert.equal(ownerKey("knife", spot(3, -4)), "knife:minecraft:overworld:3,64,-4");
  });
});

describe("fx config", () => {
  it("a knife lives about a second, and the loop is low-frequency", () => {
    assert.ok(FX_TIMING.knifeLifeTicks >= 10 && FX_TIMING.knifeLifeTicks <= 30);
    assert.ok(FX_TIMING.loopTicks >= 4);
    assert.ok(FX_TIMING.loopTicks * FX_TIMING.spoonCheckEvery >= 20);
  });

  it("every board facing has a yaw, a quarter turn apart", () => {
    const yaws = ["north", "east", "south", "west"].map((f) => FX_BOARD_YAW[f]);
    assert.ok(yaws.every((y) => y !== undefined && y % 90 === 0));
    assert.equal(new Set(yaws).size, 4);
  });
});
