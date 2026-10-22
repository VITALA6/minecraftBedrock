import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARTICLE } from "../scripts/config";
import { DEFAULT_PARTICLE_COLOR, PARTICLE_INPUTS, particleInputs } from "../scripts/data/particles";

const red = { red: 1, green: 0, blue: 0 };

describe("particle Molang inputs (vanilla 1.26.52.3 particle definitions)", () => {
  it("every particle the pack spawns has an entry", () => {
    assert.deepEqual(
      Object.values(PARTICLE).filter((id) => !(id in PARTICLE_INPUTS)),
      [],
    );
  });

  it("the water splash gets variable.direction as a vector (its .x/.y/.z)", () => {
    const inputs = particleInputs(PARTICLE.splash);
    assert.equal(inputs.length, 1);
    const [direction] = inputs;
    assert.ok(direction?.kind === "vector");
    assert.equal(direction.name, "variable.direction");
    assert.deepEqual(Object.keys(direction.value).sort(), ["x", "y", "z"]);
  });

  it("the splash ignores a colour", () => {
    assert.deepEqual(
      particleInputs(PARTICLE.splash, red).map((i) => i.kind),
      ["vector"],
    );
  });

  it("falling dust (chop bits) gets the colour, or a default one", () => {
    assert.deepEqual(particleInputs(PARTICLE.bits, red), [
      { kind: "color", name: "variable.color", value: red },
    ]);
    assert.deepEqual(particleInputs(PARTICLE.bits), [
      { kind: "color", name: "variable.color", value: DEFAULT_PARTICLE_COLOR },
    ]);
  });

  it("built-in-only particles get no map, even when a colour is passed", () => {
    for (const id of [PARTICLE.puff, PARTICLE.sparkle, PARTICLE.steam, PARTICLE.hearts]) {
      assert.deepEqual(particleInputs(id, red), [], id);
    }
    assert.deepEqual(particleInputs(PARTICLE.growth), []);
  });

  it("an unknown particle gets nothing", () => {
    assert.deepEqual(particleInputs("minecraft:not_a_particle", red), []);
  });
});
