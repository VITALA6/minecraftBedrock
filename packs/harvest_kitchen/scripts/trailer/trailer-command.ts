import { DEFAULT_PREROLL_SECONDS, sceneByName, stillByNumber } from "./scenes";

// `/scriptevent hk:trailer <message>`: the message parsed into one command. Pure, so tests run it.
//
//   list               scenes and stills, with what to do in each
//   anchor             saves where you stand and the way you face as the set's origin
//   stage              builds the set around the anchor (clears an area first, see scenes.ts)
//   <scene> [preroll]  runs a shot's scene, after `preroll` seconds (default 5)
//   still <1-8>        a still camera for a store screenshot, until `stop`
//   stop               cancels everything and gives you your camera and HUD back

export type TrailerCommand =
  | { readonly kind: "list" }
  | { readonly kind: "anchor" }
  | { readonly kind: "stage" }
  | { readonly kind: "stop" }
  | { readonly kind: "still"; readonly n: number }
  | { readonly kind: "scene"; readonly name: string; readonly preroll: number }
  | { readonly kind: "error"; readonly message: string };

export const USAGE = "hk:trailer list | anchor | stage | <scene> [preroll s] | still <1-8> | stop";

const MAX_PREROLL_SECONDS = 60;

export function parseTrailerCommand(message: string): TrailerCommand {
  const [word = "", arg, extra] = message.trim().toLowerCase().split(/\s+/);
  if (extra !== undefined) return { kind: "error", message: `Too many words. ${USAGE}` };
  switch (word) {
    case "":
    case "help":
    case "list":
      return { kind: "list" };
    case "anchor":
    case "stage":
    case "stop":
      return arg === undefined
        ? { kind: word }
        : { kind: "error", message: `"${word}" takes no value.` };
    case "still": {
      const n = Number(arg);
      return stillByNumber(n)
        ? { kind: "still", n }
        : { kind: "error", message: "Use: hk:trailer still <1-8>" };
    }
  }
  if (!sceneByName(word)) return { kind: "error", message: `No scene "${word}". ${USAGE}` };
  if (arg === undefined) return { kind: "scene", name: word, preroll: DEFAULT_PREROLL_SECONDS };
  const preroll = Number(arg);
  if (!Number.isFinite(preroll) || preroll < 0 || preroll > MAX_PREROLL_SECONDS) {
    return { kind: "error", message: `Preroll is seconds, 0..${MAX_PREROLL_SECONDS}.` };
  }
  return { kind: "scene", name: word, preroll };
}
