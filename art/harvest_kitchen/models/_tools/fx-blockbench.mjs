// Blockbench step for the station fx models (after make-fx-tools.mjs). Talks to the Blockbench MCP
// server (BB_MCP, default http://localhost:3000/bb-mcp) and runs everything inside Blockbench with
// risky_eval. Opens and closes its own projects only.
//
//   node art/harvest_kitchen/models/_tools/fx-blockbench.mjs
//
// For fx_knife and fx_spoon:
//   1. load <name>.src.bbmodel (Bedrock Entity) and <name>.animation.json
//   2. export the geometry -> art/.../<name>/<name>.geo.json and
//      packs/harvest_kitchen/resource/models/entity/hk/<name>.geo.json (format 1.26.10, the newest
//      entity geometry version vanilla 1.26.52 ships; prettier-formatted)
//   3. save <name>.bbmodel (model + animation, for editing in Blockbench)
//   4. render renders/*.png in a Generic Model project with the board (knife) or the pot (spoon)
//      around the tool: three angles at rest and the animation frames.
// Run it under the shared Blockbench lock when other sessions use the same Blockbench.
/* global Animation, Animator, Canvas, Codecs, document, Formats, Group, loadModelFile, Modes,
   newProject, Preview, Project, scene, THREE, Timeline -- Blockbench globals (inBlockbench) */
import fs from "node:fs";
import path from "node:path";
import * as prettier from "prettier";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const ART = path.resolve(import.meta.dirname, "..");
const RP = path.join(ROOT, "packs/harvest_kitchen/resource");
const URL = process.env.BB_MCP ?? "http://localhost:3000/bb-mcp";
const ENTITY_GEO_FORMAT = "1.26.10";

// ---------------------------------------------------------------- minimal MCP client
const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};
async function rpc(body, sid) {
  const res = await fetch(URL, {
    method: "POST",
    headers: sid ? { ...HEADERS, "mcp-session-id": sid } : HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: ")) ?? text;
  return {
    sid: res.headers.get("mcp-session-id"),
    json: text.trim() ? JSON.parse(line.replace(/^data: /, "")) : null,
  };
}
const init = await rpc({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "fx-blockbench", version: "1" },
  },
});
const SID = init.sid;
await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, SID);

let callId = 10;
async function evalInBlockbench(code) {
  const r = await rpc(
    {
      jsonrpc: "2.0",
      id: callId++,
      method: "tools/call",
      params: { name: "risky_eval", arguments: { code } },
    },
    SID,
  );
  const text = (r.json.result?.content ?? []).map((c) => c.text ?? "").join("");
  if (r.json.result?.isError || text.startsWith("Error"))
    throw new Error(text || JSON.stringify(r.json));
  return JSON.parse(text);
}

// ---------------------------------------------------------------- the Blockbench side
// Runs inside Blockbench (desktop: require is available). Kept as a function and stringified, so
// no comments inside it: risky_eval refuses code containing "//" or "/* */".
// Steps: export the geometry and save the full .bbmodel; then the renders with the station around.
async function inBlockbench(job) {
  const fs = require("fs");
  const out = {};
  loadModelFile({ content: fs.readFileSync(job.src, "utf8"), path: job.src });
  const exportProject = Project;
  try {
    Animator.loadFile({ content: fs.readFileSync(job.anim, "utf8"), path: job.anim });
    out.geo = Codecs.bedrock.compile();
    exportProject.name = job.name;
    out.bbmodel = Codecs.project.compile();
  } finally {
    exportProject.close(true);
  }
  newProject(Formats.free);
  const renderProject = Project;
  try {
    Codecs.project.merge(JSON.parse(fs.readFileSync(job.src, "utf8")));
    Codecs.project.merge(JSON.parse(fs.readFileSync(job.context, "utf8")));
    Animator.loadFile({ content: fs.readFileSync(job.anim, "utf8"), path: job.anim });
    Canvas.updateAll();
    const hide = new Set(job.hideGroups);
    for (const g of Group.all) {
      if (!hide.has(g.name)) continue;
      g.visibility = false;
      for (const c of g.children) c.visibility = false;
    }
    Canvas.updateVisibility();
    Modes.options.animate.select();
    const anim = Animation.all[Animation.all.length - 1];
    anim.select();
    for (const a of Animation.all) a.playing = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    const renderer = Preview.selected.renderer;
    const target = new THREE.WebGLRenderTarget(job.size, job.size);
    const keep = new Set([Project.model_3d]);
    const shot = (file, view, time) => {
      Timeline.setTime(time);
      Animator.preview();
      const cam = new THREE.PerspectiveCamera(view.fov ?? 30, 1, 0.5, 2000);
      cam.position.set(...view.eye);
      cam.lookAt(new THREE.Vector3(...view.target));
      const hidden = [];
      for (const c of scene.children) {
        if (keep.has(c) || c.name === "lights" || !c.visible) continue;
        c.visible = false;
        hidden.push(c);
      }
      const clear = renderer.getClearColor(new THREE.Color()).getHex();
      const alpha = renderer.getClearAlpha();
      renderer.setRenderTarget(target);
      renderer.setClearColor(0xffffff, 1);
      renderer.clear();
      renderer.render(scene, cam);
      const px = new Uint8Array(job.size * job.size * 4);
      renderer.readRenderTargetPixels(target, 0, 0, job.size, job.size, px);
      renderer.setRenderTarget(null);
      renderer.setClearColor(clear, alpha);
      for (const c of hidden) c.visible = true;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = job.size;
      const ctx = canvas.getContext("2d");
      const img = ctx.createImageData(job.size, job.size);
      const row = job.size * 4;
      for (let y = 0; y < job.size; y++) {
        img.data.set(px.subarray((job.size - 1 - y) * row, (job.size - y) * row), y * row);
      }
      ctx.putImageData(img, 0, 0);
      fs.writeFileSync(file, Buffer.from(canvas.toDataURL("image/png").split(",")[1], "base64"));
      return file;
    };
    out.renders = [];
    for (const r of job.renders) out.renders.push(shot(r.file, job.views[r.view], r.time));
    target.dispose();
    Modes.options.edit.select();
  } finally {
    renderProject.close(true);
  }
  return out;
}

// ---------------------------------------------------------------- jobs
const VIEWS = {
  knife: {
    "3q": { eye: [-30, 26, -34], target: [0, 2, 0] },
    "3q_back": { eye: [32, 22, 30], target: [0, 2, 0] },
    side: { eye: [0, 6, -48], target: [0, 4, 0], fov: 26 },
    top: { eye: [0, 52, -6], target: [0, 0, 0] },
  },
  spoon: {
    "3q": { eye: [-30, 30, -34], target: [0, 6, 0] },
    side: { eye: [0, 9, -46], target: [0, 7, 0], fov: 30 },
    top: { eye: [0, 56, -8], target: [0, 4, 0] },
  },
};

function job(name, kind, context, hideGroups, frames) {
  const dir = path.join(ART, name);
  const renders = path.join(dir, "renders");
  fs.mkdirSync(renders, { recursive: true });
  return {
    name,
    src: path.join(dir, `${name}.src.bbmodel`),
    anim: path.join(dir, `${name}.animation.json`),
    context: path.join(ART, context),
    hideGroups,
    size: 768,
    views: VIEWS[kind],
    renders: [
      ...Object.keys(VIEWS[kind]).map((view) => ({
        file: path.join(renders, `${name}_${view}.png`),
        view,
        time: 0,
      })),
      ...frames.map(([view, t]) => ({
        file: path.join(
          renders,
          `${name}_anim_${view}_${String(Math.round(t * 100)).padStart(3, "0")}.png`,
        ),
        view,
        time: t,
      })),
    ],
  };
}

const JOBS = [
  job(
    "fx_knife",
    "knife",
    "cutting_board/cutting_board.bbmodel",
    ["knife2"], // the board's own knife (renamed by the merge): hidden while the fx knife lives
    [
      ["side", 0],
      ["side", 0.08],
      ["side", 0.15],
      ["side", 0.21],
      ["side", 0.3],
      ["side", 0.34],
      ["3q", 0.08],
      ["3q", 0.21],
      ["3q", 0.3],
    ],
  ),
  job(
    "fx_spoon",
    "spoon",
    "cooking_pot/cooking_pot.bbmodel",
    ["liquid_1", "liquid_3", "lid"],
    [
      ["3q", 0.25],
      ["3q", 0.5],
      ["3q", 0.75],
      ["3q", 1.0],
      ["top", 0.5],
      ["top", 1.0],
    ],
  ),
];

async function writeFormatted(file, json) {
  const options = { ...(await prettier.resolveConfig(file)), filepath: file };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, await prettier.format(JSON.stringify(json), options));
}

for (const j of JOBS) {
  const result = await evalInBlockbench(`(${inBlockbench.toString()})(${JSON.stringify(j)})`);
  const geo = JSON.parse(result.geo);
  geo.format_version = ENTITY_GEO_FORMAT;
  await writeFormatted(path.join(ART, j.name, `${j.name}.geo.json`), geo);
  await writeFormatted(path.join(RP, "models/entity/hk", `${j.name}.geo.json`), geo);
  fs.writeFileSync(path.join(ART, j.name, `${j.name}.bbmodel`), result.bbmodel);
  console.log(`[fx-blockbench] ${j.name}: geo, bbmodel, ${result.renders.length} renders`);
}
