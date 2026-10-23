// Drives the running Blockbench (MCP server at http://localhost:3000/bb-mcp, override with BB_MCP)
// to export Bedrock geometry from a generated .bbmodel and to render it to PNG files.
//
//   node art/simmerfield/models/_tools/bb-export.mjs <file.bbmodel> [--geo <out.geo.json>]
//        [--render <out prefix>] [--views 3q_nw,3q_ne,top,front] [--size 768]
//
// One call = one Blockbench session: it opens the .bbmodel as a new project tab, exports and
// renders through risky_eval (Codecs.bedrock.compile + an own offscreen THREE renderer, written
// with fs: the MCP export/screenshot tools can't, blockers.md B8), then closes only that tab.
// The geometry is post-fixed (format 1.26.50, no visible_bounds_*, plan §4.5).
// Blockbench is shared with other agents: run every call under `flock <lock file>`.
import fs from "node:fs";
import path from "node:path";
import { postFixGeo } from "./model-lib.mjs";

const URL = process.env.BB_MCP ?? "http://localhost:3000/bb-mcp";
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

async function evalInBlockbench(code) {
  const init = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "bb-export", version: "1" },
    },
  });
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, init.sid);
  const res = await rpc(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "risky_eval", arguments: { code } },
    },
    init.sid,
  );
  const text = (res.json.result?.content ?? []).map((c) => c.text ?? "").join("\n");
  if (res.json.result?.isError || /^Error/.test(text)) throw new Error(text);
  return JSON.parse(text);
}

// Camera directions (from the model towards the camera). The model front faces north (-z).
const VIEWS = {
  "3q_nw": [-1, 0.82, -1], // front + west side
  "3q_ne": [1, 0.82, -1], // front + east side
  "3q_sw": [-1, 0.82, 1], // back + west side
  front: [0, 0.35, -1],
  top: [0.0001, 1, -0.35],
};

/** Runs inside Blockbench. Keep it self-contained (no closures over Node values). */
function blockbenchJob(job) {
  return `(async () => {
  const job = ${JSON.stringify(job)};
  const fs = require("fs");
  const before = new Set(ModelProject.all);
  loadModelFile({ content: fs.readFileSync(job.model, "utf8"), path: job.model });
  const proj = ModelProject.all.find((p) => !before.has(p));
  if (!proj) throw new Error("project did not open");
  const out = { project: proj.name };
  try {
    if (Project !== proj) proj.select();
    for (let i = 0; i < 50 && Texture.all.some((t) => t.img && !t.img.complete); i++)
      await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 400));
    if (job.geo) {
      const geo = Codecs.bedrock.compile();
      fs.writeFileSync(job.geo, typeof geo === "string" ? geo : JSON.stringify(geo));
      out.geo = job.geo;
    }
    if (job.render) {
      const W = job.size, H = job.size;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H);
      renderer.setClearColor(0x000000, 0);
      const model = proj.model_3d;
      const parent = model.parent;
      const sceneR = new THREE.Scene();
      sceneR.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
      out.files = [];
      for (const [name, dir] of job.views) {
        const d = new THREE.Vector3(...dir).normalize();
        const half = radius * 1.08;
        const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 1000);
        cam.position.copy(center).addScaledVector(d, 200);
        cam.up.set(0, 1, 0);
        cam.lookAt(center);
        cam.updateProjectionMatrix();
        renderer.render(sceneR, cam);
        const data = renderer.domElement.toDataURL("image/png").split(",")[1];
        const file = job.render + "_" + name + ".png";
        fs.writeFileSync(file, Buffer.from(data, "base64"));
        out.files.push(file);
      }
      if (parent) parent.add(model);
      renderer.dispose();
      renderer.forceContextLoss();
    }
  } finally {
    proj.close(true);
  }
  return out;
})()`;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const model = args.find((a) => a.endsWith(".bbmodel"));
  if (!model) throw new Error("usage: bb-export.mjs <file.bbmodel> [--geo f] [--render prefix]");
  const geo = opt("--geo") && path.resolve(opt("--geo"));
  const render = opt("--render") && path.resolve(opt("--render"));
  const views = (opt("--views") ?? "3q_nw,3q_ne").split(",").map((v) => {
    if (!VIEWS[v]) throw new Error(`unknown view ${v}`);
    return [v, VIEWS[v]];
  });
  if (render) fs.mkdirSync(path.dirname(render), { recursive: true });
  const out = await evalInBlockbench(
    blockbenchJob({
      model: path.resolve(model),
      geo,
      render,
      views,
      size: Number(opt("--size") ?? 768),
    }),
  );
  if (geo) postFixGeo(geo);
  console.log(JSON.stringify(out));
}

await main();
