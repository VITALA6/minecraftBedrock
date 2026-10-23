import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FX_CAPS, type FxCaps, type FxKind } from "../scripts/fx/fx-config";
import {
  FxRegistry,
  areaKey,
  ownerKey,
  type FxEntry,
  type FxSpot,
} from "../scripts/fx/fx-registry";
import { property, type Rng } from "./fuzz";

// The fx registry (scripts/fx/fx-registry.ts) against a plain model: random adds, removes (by
// owner and by entity id), extends and expiry queries, with small caps so they're hit often and
// spots on both sides of 0 so negative area keys are exercised. The registry must agree with the
// model on every answer and never exceed a cap.

const KINDS: readonly FxKind[] = ["knife", "spoon"];
const DIMS = ["minecraft:overworld", "minecraft:nether"];

function randomCaps(rng: Rng): FxCaps {
  if (rng.bool(0.2)) return FX_CAPS;
  const perKind = rng.int(1, 4);
  return {
    areaSize: rng.pick([1, 4, 16]),
    perAreaKind: { knife: perKind, spoon: rng.int(1, 4) },
    perArea: rng.int(1, 6),
    total: rng.int(1, 12),
  };
}

function randomSpot(rng: Rng): FxSpot {
  return {
    dimension: rng.pick(DIMS),
    x: rng.int(-20, 20),
    y: rng.int(60, 62),
    z: rng.int(-20, 20),
  };
}

/** What the registry should answer, computed from the list of live entries. */
class Model {
  readonly live = new Map<string, FxEntry<string>>();

  constructor(private readonly caps: FxCaps) {}

  canAdd(kind: FxKind, spot: FxSpot): boolean {
    const owner = ownerKey(kind, spot);
    const others = [...this.live.values()].filter((e) => e.owner !== owner);
    const area = areaKey(spot, this.caps.areaSize);
    const inArea = others.filter((e) => areaKey(e.spot, this.caps.areaSize) === area);
    return (
      inArea.filter((e) => e.kind === kind).length < this.caps.perAreaKind[kind] &&
      inArea.length < this.caps.perArea &&
      others.length < this.caps.total
    );
  }
}

function checkCaps(reg: FxRegistry<string>, caps: FxCaps) {
  const all = reg.entries();
  assert.ok(all.length <= caps.total, `total ${all.length} > ${caps.total}`);
  const areas = new Map<string, FxEntry<string>[]>();
  for (const e of all) {
    const key = areaKey(e.spot, caps.areaSize);
    areas.set(key, [...(areas.get(key) ?? []), e]);
  }
  for (const [key, list] of areas) {
    assert.ok(list.length <= caps.perArea, `area ${key}: ${list.length} > ${caps.perArea}`);
    for (const kind of KINDS) {
      const n = list.filter((e) => e.kind === kind).length;
      assert.ok(n <= caps.perAreaKind[kind], `area ${key}: ${n} ${kind} > cap`);
    }
  }
}

describe("fx registry against a model (property)", () => {
  it("random adds, removes, extends and expiry agree with the model and keep every cap", () => {
    property("fx registry ops", 300, (rng, note) => {
      const caps = randomCaps(rng);
      const reg = new FxRegistry<string>(caps);
      const model = new Model(caps);
      const ids: string[] = [];
      const log: string[] = [];
      let next = 0;
      note("caps", caps);
      try {
        for (let step = rng.int(1, 150); step > 0; step--) {
          const op = rng.weighted([
            ["add", 6],
            ["remove", 2],
            ["removeId", 2],
            ["extend", 1],
            ["expired", 1],
          ] as const);
          if (op === "add") {
            const kind = rng.pick(KINDS);
            const spot = randomSpot(rng);
            const id = `e${next++}`;
            ids.push(id);
            const expires = kind === "knife" ? rng.int(0, 100) : undefined;
            const entry = { owner: ownerKey(kind, spot), kind, spot, id, handle: id, expires };
            const expected = model.canAdd(kind, spot);
            log.push(`add ${entry.owner} ${id} (expect ${expected})`);
            assert.equal(reg.canAdd(kind, spot), expected, "canAdd");
            assert.equal(reg.add(entry), expected, "add");
            if (expected) model.live.set(entry.owner, entry);
          } else if (op === "remove") {
            const owners = [...model.live.keys(), ownerKey("knife", randomSpot(rng))];
            const owner = rng.pick(owners);
            log.push(`remove ${owner}`);
            assert.equal(reg.remove(owner), model.live.get(owner));
            model.live.delete(owner);
          } else if (op === "removeId") {
            const id = ids.length > 0 && rng.bool(0.9) ? rng.pick(ids) : "nope";
            const entry = [...model.live.values()].find((e) => e.id === id);
            log.push(`removeId ${id}`);
            assert.equal(reg.removeId(id), entry);
            if (entry) model.live.delete(entry.owner);
          } else if (op === "extend") {
            const owner = rng.pick([...model.live.keys(), "spoon:none:0,0,0"]);
            const tick = rng.int(0, 200);
            log.push(`extend ${owner} ${tick}`);
            const entry = model.live.get(owner);
            assert.equal(reg.extend(owner, tick), entry !== undefined);
            if (entry) assert.equal(reg.get(owner)?.expires, tick);
          } else {
            const tick = rng.int(0, 200);
            const expected = [...model.live.values()]
              .filter((e) => e.expires !== undefined && e.expires <= tick)
              .map((e) => e.owner)
              .sort();
            assert.deepEqual(
              reg
                .expired(tick)
                .map((e) => e.owner)
                .sort(),
              expected,
              `expired(${tick})`,
            );
          }
          // the registry and the model hold the same entries
          assert.equal(reg.size, model.live.size);
          assert.deepEqual(
            reg
              .entries()
              .map((e) => e.owner)
              .sort(),
            [...model.live.keys()].sort(),
          );
          for (const kind of KINDS) {
            const n = [...model.live.values()].filter((e) => e.kind === kind).length;
            assert.equal(reg.count(kind), n);
            assert.ok(reg.entries(kind).every((e) => e.kind === kind));
          }
          for (const id of ids) {
            const live = [...model.live.values()].some((e) => e.id === id);
            assert.equal(reg.hasId(id), live, `hasId ${id}`);
          }
          checkCaps(reg, caps);
        }
      } catch (error) {
        note("last ops", log.slice(-15));
        throw error;
      }
    });
  });

  it("filling to the caps and emptying again leaves nothing behind", () => {
    property("fx registry refill", 100, (rng) => {
      const caps = randomCaps(rng);
      const reg = new FxRegistry<string>(caps);
      const fill = () => {
        let added = 0;
        for (let i = 0; i < 400; i++) {
          const kind = rng.pick(KINDS);
          const spot = randomSpot(rng);
          const id = `f${i}-${added}`;
          if (reg.add({ owner: ownerKey(kind, spot), kind, spot, id, handle: id })) added++;
        }
        return reg.size;
      };
      const first = fill();
      assert.ok(first <= caps.total);
      for (const e of reg.entries()) reg.remove(e.owner);
      assert.equal(reg.size, 0, "nothing left behind");
      assert.ok(KINDS.every((kind) => reg.count(kind) === 0));
      // empty again, so every first add in any area must fit
      const kind = rng.pick(KINDS);
      assert.equal(reg.canAdd(kind, randomSpot(rng)), true);
    });
  });
});
