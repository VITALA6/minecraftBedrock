import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countField, emptyLabel, header, slotLabel } from "../scripts/slot-label";

// forms.json cuts the header with '%.3s', which counts bytes: it must always be 3 ASCII bytes.

const isAscii = (text: string) => [...text].every((c) => c.charCodeAt(0) < 0x80);

function throwsError(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

describe("slot label header", () => {
  it("is always 3 bytes", () => {
    for (const count of [0, 1, 2, 9, 10, 64, 99, 150, "", "+1", " ?", "8s"]) {
      const text = header("s", count);
      assert.equal(text.length, 3, String(count));
      assert.ok(isAscii(text), String(count));
    }
  });

  it("hides counts of 0 and 1, caps at 99, pads to the right edge", () => {
    assert.equal(countField(1), "  ");
    assert.equal(countField(0), "  ");
    assert.equal(countField(2), " 2");
    assert.equal(countField(64), "64");
    assert.equal(countField(150), "99");
    assert.equal(countField("+1"), "+1");
  });

  it("rejects count text the JSON can't cut", () => {
    assert.ok(throwsError(() => countField("100")));
    assert.ok(throwsError(() => countField("§a")));
  });

  it("puts the header before any RawMessage", () => {
    assert.deepEqual(slotLabel("l", 3, { translate: "item.bowl.name" }), {
      rawtext: [{ text: "l 3" }, { translate: "item.bowl.name" }],
    });
    assert.deepEqual(emptyLabel(), { rawtext: [{ text: "e  " }] });
  });
});
