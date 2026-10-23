// Cuts the Simmerfield trailer from per-shot clips with ffmpeg (no other dependencies):
//
//   node tools/edit-trailer.mjs --music <file>        every cut in the edit list -> dist/trailer/
//   node tools/edit-trailer.mjs --only full,30s       just these cuts (ids from the edit list)
//   node tools/edit-trailer.mjs --dry-run             print the ffmpeg commands, run nothing
//   node tools/edit-trailer.mjs --check               validate the edit list against the in-game
//                                                     scenes; no ffmpeg, no clips (tests run it)
//
// Options:
//   --raw <dir>          clips folder (default trailer/raw): <scene>.mkv (.mp4, .mov, .webm also)
//   --out <dir>          output folder (default dist/trailer)
//   --edit <json>        edit list (default docs/simmerfield/marketing/trailer-edit.json)
//   --music <file>       music bed, trimmed to the cut and faded out (without it: game sound only)
//   --music-volume <x>   music gain, default 0.7; --sfx-volume <x> game sound gain, default 1
//   --font <file>        font for captions and the end card (default: fc-match "Inter:bold")
//   --no-text            no captions or end-card text (trailer.md: the trailer works without)
//   --no-detect          clips are already trimmed: scene time 0 is the clip's first frame
//
// Clips come from `/scriptevent wm_kitchen:trailer <scene>` (packs/simmerfield/scripts/trailer/,
// recording workflow in docs/simmerfield/marketing/recording-guide.md). Each take has a
// black marker (MARKER_SECONDS) before a HANDLE_SECONDS lead-in, so the tool finds scene time 0 by
// itself with ffmpeg's blackdetect: offset = end of the first black run + HANDLE_SECONDS. A shot
// can override it with "offset" (seconds into the clip where scene time 0 is).
//
// Edit list format (JSON): { productName, storeLine, cuts: [cut] }, where a cut is
//   { id, output, width, height, fps, xfade, target?, requireAll?, frame?: "crop" | "fit",
//     captionStyle?: "lower" | "big", endCard?: { seconds, hold }, musicFadeOut?, shots: [shot] }
// and a shot is { scene, in?, out?, xfade?, caption?, focusX?, offset? }:
//   in/out    scene time in seconds (default 0 and the scene's duration)
//   xfade     crossfade into the next shot (default: the cut's xfade; 0 = hard cut). Fades are
//             centred on the cut, so each side reaches xfade/2 into the take's handle, and the
//             cut's length is exactly the sum of out - in (plus endCard.hold).
//   caption   at most 5 words (trailer.md), drawn over the shot
//   focusX    vertical cuts with frame "crop": where the 9:16 window sits, 0 left .. 1 right
// "frame": "fit" puts the whole 16:9 frame over a blurred fill instead of cropping.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import { DIST_DIR, ROOT } from "./paths.mjs";

const SCENES_TS = path.join(ROOT, "packs/simmerfield/scripts/trailer/scenes.ts");
const DEFAULT_EDIT = path.join(ROOT, "docs/simmerfield/marketing/trailer-edit.json");
const CLIP_EXTENSIONS = [".mkv", ".mp4", ".mov", ".webm"];
const MAX_CAPTION_WORDS = 5;
const TARGET_TOLERANCE = 0.05;
const EPS = 1e-6;

// --- arguments -----------------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    raw: path.join(ROOT, "trailer/raw"),
    out: path.join(DIST_DIR, "trailer"),
    edit: DEFAULT_EDIT,
    music: undefined,
    musicVolume: 0.7,
    sfxVolume: 1,
    font: undefined,
    only: undefined,
    dryRun: false,
    check: false,
    text: true,
    detect: true,
  };
  const value = (i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`${argv[i]} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--raw":
        opts.raw = path.resolve(value(i++));
        break;
      case "--out":
        opts.out = path.resolve(value(i++));
        break;
      case "--edit":
        opts.edit = path.resolve(value(i++));
        break;
      case "--music":
        opts.music = path.resolve(value(i++));
        break;
      case "--music-volume":
        opts.musicVolume = Number(value(i++));
        break;
      case "--sfx-volume":
        opts.sfxVolume = Number(value(i++));
        break;
      case "--font":
        opts.font = path.resolve(value(i++));
        break;
      case "--only":
        opts.only = value(i++).split(",");
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--check":
        opts.check = true;
        break;
      case "--no-text":
        opts.text = false;
        break;
      case "--no-detect":
        opts.detect = false;
        break;
      default:
        throw new Error(`unknown argument ${arg} (see the header of tools/edit-trailer.mjs)`);
    }
  }
  for (const key of ["musicVolume", "sfxVolume"]) {
    if (!Number.isFinite(opts[key]) || opts[key] < 0) throw new Error(`bad --${key} value`);
  }
  return opts;
}

// --- the in-game scenes (bundled from the pack's TypeScript, which is pure data) -----------------

async function loadScenes() {
  const result = await build({
    entryPoints: [SCENES_TS],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    logLevel: "silent",
  });
  const code = result.outputFiles[0].text;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  return {
    scenes: new Map(mod.SCENES.map((scene) => [scene.name, scene])),
    handle: mod.HANDLE_SECONDS,
    marker: mod.MARKER_SECONDS,
  };
}

// --- edit list -----------------------------------------------------------------------------------

const round = (n) => Math.round(n * 1000) / 1000;

/** Segment plan for one cut: what to read from each clip and where it lands in the output. */
function planCut(cut, scenes) {
  const shots = cut.shots ?? [];
  const fadeAfter = (i) => (i < shots.length - 1 ? (shots[i].xfade ?? cut.xfade ?? 0) : 0);
  const segments = [];
  let at = 0;
  shots.forEach((shot, i) => {
    const scene = scenes.get(shot.scene);
    const xb = i > 0 ? fadeAfter(i - 1) : 0;
    const xa = fadeAfter(i);
    const sIn = shot.in ?? 0;
    const sOut = shot.out ?? scene?.duration ?? 0;
    const start = sIn - xb / 2;
    const end = sOut + xa / 2;
    segments.push({
      shot,
      scene,
      xb,
      xa,
      in: sIn,
      out: sOut,
      start,
      length: end - start,
      at, // output time where this segment's first frame lands
      shown: [at + xb / 2, at + xb / 2 + (sOut - sIn)], // from cut to cut
    });
    at += end - start - xa;
  });
  const hold = cut.endCard?.hold ?? 0;
  return { segments, total: round(at + hold), body: round(at), hold };
}

function checkEdit(edit, { scenes, handle }) {
  const problems = [];
  if (!Array.isArray(edit.cuts) || edit.cuts.length === 0) return ["edit list has no cuts"];
  const ids = new Set();
  for (const cut of edit.cuts) {
    const where = `cut "${cut.id}"`;
    if (!cut.id || ids.has(cut.id)) problems.push(`${where}: missing or duplicate id`);
    ids.add(cut.id);
    if (!/^[\w.-]+\.mp4$/.test(cut.output ?? ""))
      problems.push(`${where}: output must be a .mp4 name`);
    for (const key of ["width", "height", "fps"]) {
      if (!Number.isInteger(cut[key]) || cut[key] <= 0 || cut[key] % 2 !== 0) {
        problems.push(`${where}: ${key} must be a positive even integer`);
      }
    }
    if (cut.frame && !["crop", "fit"].includes(cut.frame))
      problems.push(`${where}: frame is crop|fit`);
    if (!Array.isArray(cut.shots) || cut.shots.length === 0) {
      problems.push(`${where}: no shots`);
      continue;
    }
    const { segments, total } = planCut(cut, scenes);
    for (const [i, seg] of segments.entries()) {
      const at = `${where} shot ${i + 1} "${seg.shot.scene}"`;
      if (!seg.scene) {
        problems.push(`${at}: no such scene (have ${[...scenes.keys()].join(", ")})`);
        continue;
      }
      if (seg.in < 0 || seg.out > seg.scene.duration + EPS || seg.out <= seg.in) {
        problems.push(`${at}: needs 0 <= in < out <= ${seg.scene.duration}`);
      }
      if (seg.start < -handle - EPS || seg.out + seg.xa / 2 > seg.scene.duration + handle + EPS) {
        problems.push(`${at}: crossfades reach past the ${handle} s handles`);
      }
      if (seg.xa < 0 || seg.xa > Math.min(seg.length, segments[i + 1]?.length ?? Infinity)) {
        problems.push(`${at}: crossfade ${seg.xa} s is longer than a shot it joins`);
      }
      const caption = seg.shot.caption;
      if (caption !== undefined) {
        const words = String(caption).trim().split(/\s+/).length;
        if (words > MAX_CAPTION_WORDS)
          problems.push(`${at}: caption over ${MAX_CAPTION_WORDS} words`);
      }
      if (seg.shot.focusX !== undefined && !(seg.shot.focusX >= 0 && seg.shot.focusX <= 1)) {
        problems.push(`${at}: focusX is 0..1`);
      }
    }
    if (cut.target !== undefined && Math.abs(total - cut.target) > TARGET_TOLERANCE) {
      problems.push(`${where}: ${total} s long, target ${cut.target} s`);
    }
    if (cut.requireAll) {
      const used = new Set(cut.shots.map((s) => s.scene));
      const missing = [...scenes.keys()].filter((name) => !used.has(name));
      if (missing.length) problems.push(`${where}: missing scenes ${missing.join(", ")}`);
    }
    if (cut.endCard && !(cut.endCard.seconds > 0 && cut.endCard.seconds <= total)) {
      problems.push(`${where}: endCard.seconds must be within the cut`);
    }
  }
  return problems;
}

// --- ffmpeg helpers ------------------------------------------------------------------------------

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  return result;
}

function findFont() {
  for (const pattern of ["Inter:bold", "Noto Sans:bold", "DejaVu Sans:bold", "sans:bold"]) {
    const result = run("fc-match", ["-f", "%{file}", pattern], { capture: true });
    const file = result.stdout.trim();
    if (result.status === 0 && file && existsSync(file)) return file;
  }
  throw new Error("no font found with fc-match; pass --font <file>");
}

function findClip(rawDir, scene) {
  for (const ext of CLIP_EXTENSIONS) {
    const file = path.join(rawDir, `${scene}${ext}`);
    if (existsSync(file)) return file;
  }
  return undefined;
}

function probe(file) {
  const result = run(
    "ffprobe",
    ["-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file],
    { capture: true },
  );
  if (result.status !== 0) throw new Error(`ffprobe ${file}: ${result.stderr.trim()}`);
  const info = JSON.parse(result.stdout);
  return {
    duration: Number(info.format?.duration ?? 0),
    audio: (info.streams ?? []).some((s) => s.codec_type === "audio"),
  };
}

/** Seconds into the clip where scene time 0 is: after the first marker-length black run. */
function detectOffset(file, { handle, marker }) {
  const result = run(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostats",
      "-i",
      file,
      "-an",
      "-vf",
      `blackdetect=d=${round(marker * 0.6)}:pix_th=0.10:pic_th=0.98`,
      "-f",
      "null",
      "-",
    ],
    { capture: true },
  );
  const runs = [...result.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => ({
    start: Number(m[1]),
    end: Number(m[2]),
  }));
  // The marker is MARKER_SECONDS long; a longer black run is the recorder starting up, not it.
  const first = runs.find((r) => r.end - r.start <= marker * 2.5);
  return first ? first.end + handle : undefined;
}

/** Shell quoting, only for printing --dry-run commands (ffmpeg runs without a shell). */
const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;
/** A path inside the filter graph: single-quoted, so ':' and ',' are literal. */
function fq(file) {
  if (/['\\]/.test(file)) throw new Error(`can't use a path with ' or \\ in a filter: ${file}`);
  return `'${file}'`;
}
const shellLine = (cmd, args) =>
  [cmd, ...args].map((a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : q(a))).join(" ");

// --- filter graph --------------------------------------------------------------------------------

/** Per-segment video: same size, rate, format and timebase, exactly `length` seconds. */
function videoChain(cut, seg, index) {
  const { width: W, height: H, fps } = cut;
  const len = round(seg.length);
  const landscape = W >= H;
  const parts = [`[${index}:v]fps=${fps}`];
  if (landscape || cut.frame !== "fit") {
    if (landscape) {
      parts.push(`scale=${W}:${H}:force_original_aspect_ratio=increase`, `crop=${W}:${H}`);
    } else {
      const fx = seg.shot.focusX ?? 0.5;
      parts.push(`scale=-2:${H}`, `crop=${W}:${H}:x='(iw-${W})*${fx}':y=0`);
    }
    parts.push(`setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1`);
    parts.push(`trim=duration=${len},setpts=PTS-STARTPTS,settb=1/${fps * 1000}[v${index}]`);
    return parts.join(",");
  }
  // "fit": the whole 16:9 frame centred over a blurred, darkened fill of itself.
  return [
    `[${index}:v]fps=${fps},setsar=1,format=yuv420p,split[f${index}][b${index}]`,
    `[b${index}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=40,eq=brightness=-0.12[bb${index}]`,
    `[f${index}]scale=${W}:-2[ff${index}]`,
    `[bb${index}][ff${index}]overlay=(W-w)/2:(H-h)/2,tpad=stop_mode=clone:stop_duration=1,trim=duration=${len},setpts=PTS-STARTPTS,settb=1/${fps * 1000}[v${index}]`,
  ].join(";");
}

function audioChain(seg, index, hasAudio, sfxVolume) {
  const len = round(seg.length);
  const tail = `apad,atrim=duration=${len},asetpts=PTS-STARTPTS,volume=${sfxVolume}[a${index}]`;
  return hasAudio
    ? `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,${tail}`
    : `anullsrc=r=48000:cl=stereo,${tail}`;
}

function textFilter(font, file, size, y, from, to, fade, extra = "") {
  const t0 = round(from);
  const t1 = round(to);
  const alpha = `if(lt(t,${t0 + fade}),(t-${t0})/${fade},if(gt(t,${t1 - fade}),(${t1}-t)/${fade},1))`;
  return (
    `drawtext=fontfile=${fq(font)}:textfile=${fq(file)}:fontsize=${size}:fontcolor=white` +
    `:borderw=${Math.max(2, Math.round(size / 16))}:bordercolor=black@0.55` +
    `:shadowcolor=black@0.4:shadowx=0:shadowy=${Math.round(size / 18)}` +
    `:x=(w-text_w)/2:y=${y}:enable='between(t,${t0},${t1})':alpha='${alpha}'${extra}`
  );
}

function buildCommand(cut, plan, ctx) {
  const { opts, font, workDir, edit } = ctx;
  const { width: W, height: H, fps } = cut;
  const args = ["-hide_banner", "-y"];
  const graph = [];
  plan.segments.forEach((seg, i) => {
    const seek = Math.max(0, round(seg.clipOffset + seg.start));
    args.push("-ss", String(seek), "-t", String(round(seg.length + 1)), "-i", seg.file);
    graph.push(videoChain(cut, seg, i));
    graph.push(audioChain(seg, i, seg.hasAudio, opts.sfxVolume));
  });

  // Join: xfade/acrossfade where the shot fades, concat where it cuts.
  let v = "[v0]";
  let a = "[a0]";
  plan.segments.slice(1).forEach((seg, k) => {
    const i = k + 1;
    const x = round(seg.xb);
    if (x > 0) {
      graph.push(`${v}[v${i}]xfade=transition=fade:duration=${x}:offset=${round(seg.at)}[vx${i}]`);
      graph.push(`${a}[a${i}]acrossfade=d=${x}:c1=tri:c2=tri[ax${i}]`);
    } else {
      graph.push(`${v}[v${i}]concat=n=2:v=1:a=0[vx${i}]`);
      graph.push(`${a}[a${i}]concat=n=2:v=0:a=1[ax${i}]`);
    }
    v = `[vx${i}]`;
    a = `[ax${i}]`;
  });

  // Hold, end card, captions.
  const total = plan.total;
  const post = [];
  if (plan.hold > 0) post.push(`tpad=stop_mode=clone:stop_duration=${plan.hold}`);
  const card = cut.endCard;
  if (card) {
    const from = round(total - card.seconds);
    graph.push(
      `color=c=black:s=${W}x${H}:r=${fps}:d=${card.seconds},format=yuva420p,colorchannelmixer=aa=0.55,` +
        `fade=t=in:st=0:d=0.6:alpha=1,setpts=PTS+${from}/TB[card]`,
    );
    graph.push(`${v}${post.length ? post.join(",") : "null"}[vh]`);
    graph.push(`[vh][card]overlay=eof_action=pass:format=auto[vc]`);
    v = "[vc]";
    post.length = 0;
  }
  if (opts.text) {
    const big = cut.captionStyle === "big";
    const unit = Math.min(W, H);
    plan.segments.forEach((seg, i) => {
      if (!seg.shot.caption) return;
      const file = path.join(workDir, `${cut.id}-caption-${i}.txt`);
      ctx.textFiles.push([file, seg.shot.caption]);
      const size = Math.round(unit * (big ? 0.1 : 0.075));
      const y = big ? `h*0.68-text_h/2` : `h*0.80-text_h/2`;
      post.push(textFilter(font, file, size, y, seg.shown[0] + 0.25, seg.shown[1] - 0.25, 0.25));
    });
    if (card) {
      const from = total - card.seconds + 0.3;
      const name = path.join(workDir, `${cut.id}-product.txt`);
      const line = path.join(workDir, `${cut.id}-store.txt`);
      ctx.textFiles.push([name, edit.productName ?? "[PRODUCT NAME]"]);
      ctx.textFiles.push([line, edit.storeLine ?? "[STORE / DOWNLOAD LINE]"]);
      const nameSize = Math.round(unit * 0.12);
      const lineSize = Math.round(unit * 0.045);
      post.push(textFilter(font, name, nameSize, "h*0.45-text_h", from, total + 1, 0.5));
      post.push(textFilter(font, line, lineSize, "h*0.45+text_h*1.2", from + 0.3, total + 1, 0.5));
    }
  }
  graph.push(`${v}${post.length ? post.join(",") : "null"},format=yuv420p[vout]`);

  // Sound: game audio padded to the hold, music trimmed, faded out, mixed under it.
  graph.push(`${a}apad=whole_dur=${total}[sfx]`);
  if (opts.music) {
    const m = plan.segments.length;
    args.push("-i", opts.music);
    const fadeOut = cut.musicFadeOut ?? 2;
    graph.push(
      `[${m}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,` +
        `atrim=duration=${total},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,` +
        `afade=t=out:st=${round(total - fadeOut)}:d=${fadeOut},volume=${opts.musicVolume}[mus]`,
    );
    graph.push(`[sfx][mus]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`);
  } else {
    graph.push(`[sfx]anull[aout]`);
  }

  const output = path.join(opts.out, cut.output);
  args.push(
    "-filter_complex",
    graph.join(";\n"),
    "-map",
    "[vout]",
    "-map",
    "[aout]",
    "-t",
    String(total),
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-g",
    String(fps * 2),
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-movflags",
    "+faststart",
    output,
  );
  return { args, output };
}

// --- main ----------------------------------------------------------------------------------------

function report(file) {
  const result = run(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,avg_frame_rate:format=duration",
      "-of",
      "json",
      file,
    ],
    { capture: true },
  );
  const info = JSON.parse(result.stdout);
  const s = info.streams?.[0] ?? {};
  const [num, den] = String(s.avg_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  return `${s.width}x${s.height} ${round(num / (den || 1))} fps ${round(Number(info.format?.duration))} s`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const edit = JSON.parse(readFileSync(opts.edit, "utf8"));
  const sceneData = await loadScenes();
  const problems = checkEdit(edit, sceneData);
  if (opts.check || problems.length) {
    for (const problem of problems) console.error(`[edit-trailer] ${problem}`);
    if (problems.length) {
      process.exitCode = 1;
      return;
    }
    for (const cut of edit.cuts) {
      const { total } = planCut(cut, sceneData.scenes);
      console.log(
        `[edit-trailer] ${cut.id}: ${cut.shots.length} shots, ${total} s -> ${cut.output}`,
      );
    }
    console.log("[edit-trailer] edit list OK");
    return;
  }

  const cuts = edit.cuts.filter((cut) => !opts.only || opts.only.includes(cut.id));
  if (cuts.length === 0) throw new Error(`no cut matches --only ${opts.only?.join(",")}`);
  if (opts.music && !existsSync(opts.music)) throw new Error(`no music file ${opts.music}`);
  if (!opts.music) console.warn("[edit-trailer] no --music: the cuts get game sound only");
  const font = opts.font ?? (opts.text ? findFont() : "");
  if (opts.text && !existsSync(font)) throw new Error(`no font file ${font}`);
  const workDir = path.join(opts.out, "work");

  // Clips: probe each once (audio, length) and find where scene time 0 is.
  const clips = new Map();
  const missing = [];
  for (const name of new Set(cuts.flatMap((cut) => cut.shots.map((s) => s.scene)))) {
    const file = findClip(opts.raw, name);
    if (!file) {
      missing.push(name);
      clips.set(name, { file: path.join(opts.raw, `${name}.mkv`), hasAudio: true, offset: 0 });
      continue;
    }
    const info = probe(file);
    let offset = 0;
    if (opts.detect) {
      offset = detectOffset(file, sceneData);
      if (offset === undefined) {
        console.warn(`[edit-trailer] ${name}: no black marker found; using the clip start`);
        offset = 0;
      }
    }
    clips.set(name, { file, hasAudio: info.audio, offset, duration: info.duration });
  }
  if (missing.length && !opts.dryRun) {
    throw new Error(`missing clips in ${opts.raw}: ${missing.map((n) => `${n}.mkv`).join(", ")}`);
  }
  if (missing.length) console.warn(`[edit-trailer] dry run; no clip yet for ${missing.join(", ")}`);

  for (const cut of cuts) {
    const plan = planCut(cut, sceneData.scenes);
    for (const seg of plan.segments) {
      const clip = clips.get(seg.shot.scene);
      seg.file = clip.file;
      seg.hasAudio = clip.hasAudio;
      seg.clipOffset = seg.shot.offset ?? clip.offset;
      if (seg.clipOffset + seg.start < -EPS) {
        console.warn(`[edit-trailer] ${cut.id}/${seg.shot.scene}: starts before the clip; clamped`);
      }
    }
    const ctx = { opts, font, workDir, edit, textFiles: [] };
    const { args, output } = buildCommand(cut, plan, ctx);
    console.log(`\n[edit-trailer] ${cut.id}: ${plan.total} s -> ${path.relative(ROOT, output)}`);
    if (opts.dryRun) {
      for (const [file, text] of ctx.textFiles) console.log(`# ${file}: ${JSON.stringify(text)}`);
      console.log(shellLine("ffmpeg", args));
      continue;
    }
    mkdirSync(workDir, { recursive: true });
    for (const [file, text] of ctx.textFiles) writeFileSync(file, text);
    const result = run("ffmpeg", ["-loglevel", "error", "-stats", ...args]);
    if (result.status !== 0) throw new Error(`ffmpeg failed for ${cut.id} (exit ${result.status})`);
    console.log(`[edit-trailer] ${cut.id}: ${report(output)}`);
  }
}

main().catch((error) => {
  console.error(`[edit-trailer] ${error.message}`);
  process.exitCode = 1;
});
