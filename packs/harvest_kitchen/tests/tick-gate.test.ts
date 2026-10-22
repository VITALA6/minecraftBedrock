import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOOK_OPEN_GAP_TICKS, SLICE_BITE_GAP_TICKS } from "../scripts/config";
import { TickGate } from "../scripts/lib/tick-gate";

describe("tick gate (book open CR2, cake bites CR7)", () => {
  it("lets the first action through", () => {
    assert.equal(new TickGate(10).pass("a", 0), true);
  });

  it("refuses the same key within the gap, then lets it through again", () => {
    const gate = new TickGate(10);
    assert.equal(gate.pass("a", 100), true);
    assert.equal(gate.pass("a", 100), false, "same tick: onUse + onUseOn of one click");
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

  it("the book gap is short enough never to block a deliberate second open", () => {
    assert.ok(BOOK_OPEN_GAP_TICKS >= 1 && BOOK_OPEN_GAP_TICKS <= 10);
  });
});
