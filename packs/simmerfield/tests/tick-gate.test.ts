import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  POSTER_USE_GAP_TICKS,
  POT_FORM_PRESS_GAP_TICKS,
  SLICE_BITE_GAP_TICKS,
  STOVE_PRESS_GAP_TICKS,
} from "../scripts/config";
import { PressGate, TickGate } from "../scripts/lib/tick-gate";

describe("tick gate (poster use, cake bites CR7)", () => {
  it("lets the first action through", () => {
    assert.equal(new TickGate(10).pass("a", 0), true);
  });

  it("refuses the same key within the gap, then lets it through again", () => {
    const gate = new TickGate(10);
    assert.equal(gate.pass("a", 100), true);
    assert.equal(gate.pass("a", 100), false, "same tick: both poster parts report one click");
    assert.equal(gate.pass("a", 109), false);
    assert.equal(gate.pass("a", 110), true);
  });

  it("a refused attempt doesn't push the next one back", () => {
    const gate = new TickGate(10);
    gate.pass("a", 0);
    gate.pass("a", 5);
    assert.equal(gate.pass("a", 10), true);
  });

  it("keys are independent: two players eat from one cake together", () => {
    const gate = new TickGate(10);
    assert.equal(gate.pass("steve", 0), true);
    assert.equal(gate.pass("alex", 0), true);
  });

  it("a held button eats at most one slice per gap; separate taps aren't affected", () => {
    const gate = new TickGate(SLICE_BITE_GAP_TICKS);
    // Holding use, if the game repeats the interaction every 4 ticks for 2 s:
    let bites = 0;
    for (let tick = 0; tick < 40; tick += 4) if (gate.pass("p", tick)) bites++;
    assert.ok(bites <= 4, `${bites} bites in 2 s`);
    // Taps half a second apart all count.
    const taps = new TickGate(SLICE_BITE_GAP_TICKS);
    assert.ok([0, 10, 20, 30].every((tick) => taps.pass("p", tick)));
  });

  it("the poster gap is short enough never to block a deliberate second sneak + use", () => {
    assert.ok(POSTER_USE_GAP_TICKS >= 1 && POSTER_USE_GAP_TICKS <= 10);
  });
});

describe("press gate (stove switch, pot choice form)", () => {
  it("lets the first press through", () => {
    assert.equal(new PressGate(8).press("a", 0), true);
  });

  it("a held button acts once, however long it's held", () => {
    const gate = new PressGate(STOVE_PRESS_GAP_TICKS);
    // Holding use for 5 s, if the game repeats the interaction every 4 ticks:
    let switches = 0;
    for (let tick = 0; tick < 100; tick += 4) if (gate.press("p", tick)) switches++;
    assert.equal(switches, 1);
  });

  it("the next press after a pause acts again", () => {
    const gate = new PressGate(8);
    gate.press("p", 0);
    gate.press("p", 4); // a repeat
    assert.equal(gate.press("p", 11), false, "only 7 ticks after the last repeat");
    assert.equal(gate.press("p", 30), true);
  });

  it("keys are independent: two players switch the same stove", () => {
    const gate = new PressGate(8);
    assert.equal(gate.press("steve", 0), true);
    assert.equal(gate.press("alex", 0), true);
  });

  it("the gaps are short enough never to swallow a deliberate second click", () => {
    for (const gap of [STOVE_PRESS_GAP_TICKS, POT_FORM_PRESS_GAP_TICKS]) {
      assert.ok(gap >= 5 && gap <= 10, `${gap} ticks`);
    }
  });
});
