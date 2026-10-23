import {
  HANDLE_SECONDS,
  MARKER_SECONDS,
  type Cue,
  type Ease,
  type Keyframe,
  type Scene,
} from "./scenes";

// A scene as timed steps in ticks after the command, for scripts/trailer/trailer.ts to schedule
// with system.runTimeout. Pure, so tests check the timing.
//
//   0 ........ preroll: camera already on the first keyframe, HUD hidden (chat fades meanwhile)
//   marker ... MARKER_SECONDS of black (Camera.fade): tools/edit-trailer.mjs finds the take by it
//   handle ... HANDLE_SECONDS on the first keyframe, room for a crossfade
//   start .... scene time 0: keyframe moves and cues run on their `at` / `time`
//   + duration handle, then the closing marker, then the camera and HUD come back

export const TICKS_PER_SECOND = 20;

export type Step =
  | { readonly tick: number; readonly kind: "marker" }
  | {
      readonly tick: number;
      readonly kind: "camera";
      readonly key: Keyframe;
      /** Undefined: jump (the first keyframe, or a cut). */
      readonly ease?: { readonly seconds: number; readonly type: Ease };
    }
  | { readonly tick: number; readonly kind: "cue"; readonly cue: Cue }
  | { readonly tick: number; readonly kind: "end" };

export const toTicks = (seconds: number): number => Math.round(seconds * TICKS_PER_SECOND);

/** Tick (after the command) at which scene time 0 begins. */
export function sceneStartTick(prerollSeconds: number): number {
  return toTicks(prerollSeconds + MARKER_SECONDS + HANDLE_SECONDS);
}

export function sceneTimeline(scene: Scene, prerollSeconds: number): Step[] {
  const start = sceneStartTick(prerollSeconds);
  const steps: Step[] = [{ tick: toTicks(prerollSeconds), kind: "marker" }];
  scene.keys.forEach((key, i) => {
    const previous = scene.keys[i - 1];
    if (!previous) {
      // The first keyframe is set when the command runs (tick 0), so the preroll shows it too.
      steps.push({ tick: 0, kind: "camera", key });
    } else if (key.cut) {
      steps.push({ tick: start + toTicks(key.at), kind: "camera", key });
    } else {
      // A move right after a cut waits one tick, so the jump has landed before the ease begins.
      const delay = previous.cut ? 1 : 0;
      steps.push({
        tick: start + toTicks(previous.at) + delay,
        kind: "camera",
        key,
        ease: {
          seconds: key.at - previous.at - delay / TICKS_PER_SECOND,
          type: key.ease ?? "InOutSine",
        },
      });
    }
  });
  for (const cue of scene.cues ?? [])
    steps.push({ tick: start + toTicks(cue.time), kind: "cue", cue });
  const after = start + toTicks(scene.duration + HANDLE_SECONDS);
  steps.push({ tick: after, kind: "marker" });
  steps.push({ tick: after + toTicks(MARKER_SECONDS), kind: "end" });
  // Stable sort: same-tick steps keep their order (a move starting on a cut's tick follows it).
  return steps.sort((a, b) => a.tick - b.tick);
}
