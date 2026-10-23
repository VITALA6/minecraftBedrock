import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PREROLL_SECONDS,
  HANDLE_SECONDS,
  MARKER_SECONDS,
  SCENES,
  sceneByName,
  stillByNumber,
  takeSeconds,
  type Keyframe,
  type Scene,
} from "../scripts/trailer/scenes";
import { sceneStartTick, sceneTimeline, toTicks } from "../scripts/trailer/timeline";

// The trailer timeline on made-up scenes, for the cases the shipped scenes don't have: two cuts
// in a row, a move straight after a cut, a keyframe without an ease, and a scene without cues.

const o = { x: 0, y: 0, z: 0 };
const key = (at: number, extra: Partial<Keyframe> = {}): Keyframe => ({
  at,
  pos: o,
  look: o,
  ...extra,
});
const scene = (keys: Keyframe[], extra: Partial<Scene> = {}): Scene => ({
  name: "test",
  shot: 99,
  duration: keys[keys.length - 1]?.at ?? 0,
  time: 0,
  camera: "scripted",
  keys,
  action: "",
  ...extra,
});

describe("timeline edge cases", () => {
  const start = sceneStartTick(0);

  it("cut, cut, move: cuts jump at their time, the move after a cut waits one tick", () => {
    const steps = sceneTimeline(
      scene([key(0), key(1, { cut: true }), key(2, { cut: true }), key(4)]),
      0,
    );
    const cameras = steps.filter((s) => s.kind === "camera");
    assert.deepEqual(
      cameras.map((s) => [s.tick, s.kind === "camera" ? s.ease : undefined]),
      [
        [0, undefined],
        [start + toTicks(1), undefined],
        [start + toTicks(2), undefined],
        [start + toTicks(2) + 1, { seconds: 2 - 1 / 20, type: "InOutSine" }],
      ],
    );
  });

  it("a move keeps its own ease", () => {
    const steps = sceneTimeline(scene([key(0), key(3, { ease: "Linear" })]), 1);
    const move = steps.find((s) => s.kind === "camera" && s.ease);
    assert.ok(move && move.kind === "camera");
    assert.deepEqual(move.ease, { seconds: 3, type: "Linear" });
    assert.equal(move.tick, sceneStartTick(1));
  });

  it("a scene without cues: marker, camera, closing marker, end, in tick order", () => {
    const steps = sceneTimeline(scene([key(0), key(2)]), 1);
    assert.deepEqual(
      steps.map((s) => s.kind),
      ["camera", "marker", "camera", "marker", "end"],
    );
    const ticks = steps.map((s) => s.tick);
    assert.deepEqual(
      ticks,
      [...ticks].sort((a, b) => a - b),
    );
    const end = sceneStartTick(1) + toTicks(2 + HANDLE_SECONDS) + toTicks(MARKER_SECONDS);
    assert.equal(steps.at(-1)?.tick, end);
  });
});

describe("scene lookups and take length", () => {
  it("finds scenes and stills by name and number; unknown ones are undefined", () => {
    for (const s of SCENES) assert.equal(sceneByName(s.name), s);
    assert.equal(sceneByName("nope"), undefined);
    assert.equal(stillByNumber(0), undefined);
    assert.equal(stillByNumber(9), undefined);
    assert.ok(stillByNumber(1));
  });

  it("a take runs preroll + both markers + both handles + the shot", () => {
    const s = SCENES[0] as Scene;
    const fixed = 2 * MARKER_SECONDS + 2 * HANDLE_SECONDS + s.duration;
    assert.equal(takeSeconds(s), DEFAULT_PREROLL_SECONDS + fixed);
    assert.equal(takeSeconds(s, 0), fixed);
    // the timeline's end step is exactly the take length
    assert.equal(sceneTimeline(s, 2).at(-1)?.tick, toTicks(takeSeconds(s, 2)));
  });
});
