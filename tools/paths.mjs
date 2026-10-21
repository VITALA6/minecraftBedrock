import os from "node:os";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const PACKS_DIR = path.join(ROOT, "packs");
export const DIST_DIR = path.join(ROOT, "dist");

// Bedrock's com.mojang folder (mcpelauncher Flatpak). Override with MC_GAME_DIR.
export const GAME_DIR =
  process.env.MC_GAME_DIR ??
  path.join(os.homedir(), ".var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang");
