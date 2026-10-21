# 00 — Setup and core concepts

## Behavior pack and resource pack

An add-on is usually a pair of packs:

- **Behavior pack (BP)** holds server-side logic: entity, item, and block _behavior_ (JSON
  components), loot tables, recipes, functions, and **scripts**. It runs on the host or server.
- **Resource pack (RP)** holds client-side looks: textures, models, sounds, animations, UI, and
  translations (`texts/en_US.lang`). It is sent to every client that joins.

A custom entity, for example, needs both: the BP defines what it does and the RP defines how it
looks. You activate the BP on a world, and because our BP lists the RP as a dependency, the game
offers to activate the RP too.

## manifest.json

Each pack has one at its root. `packs/hello/behavior/manifest.json` has three parts:

- `format_version`: the manifest schema version. We use `2`.
- `header`: the pack's identity.
  - `name` and `description` are what you see in the pack list.
  - `uuid` is the pack's unique id.
  - `version: [1, 0, 0]`: bump it when you release an update.
  - `min_engine_version`: the oldest game version the pack targets. It also decides which version
    of BP JSON behavior the game applies.
- `modules`: what the pack contains. Each module has its own `uuid`.
  - `data` marks BP content (JSON behavior).
  - `resources` marks RP content.
  - `script` marks Script API code. It needs `language: "javascript"` and `entry: "scripts/main.js"`.
- `dependencies`: what must be loaded alongside the pack.
  - `{ "uuid": ..., "version": [...] }` is another pack, here our RP.
  - `{ "module_name": "@minecraft/server", "version": "2.10.0" }` is a built-in Script API module.

## UUIDs

The game identifies packs by UUID, not by name or folder. Worlds store "pack `<uuid>` at version
`<x.y.z>`" in `world_behavior_packs.json` and `world_resource_packs.json`. As a result:

- Each pack header and each module needs a unique UUID. Generate new ones with `npm run uuid`.
- If two packs share a UUID, one shadows the other.
- If you change a shipped pack's UUID, existing worlds lose it. Bump `version` instead.

## Script module dependencies

`@minecraft/server` (core API: world, entities, events) and `@minecraft/server-ui` (forms and
dialogs) are provided **by the game**. The npm packages only contain TypeScript types. esbuild
keeps `import ... from "@minecraft/server"` as-is (it's marked external) and bundles everything
else into a single `main.js`.

Each game version ships specific module versions. If the manifest asks for one the game doesn't
have, the script won't load and you'll see an error in the Content Log. That's why this repo pins
the versions that the installed game (**1.26.52**) supports: server 2.10.0 and server-ui 2.2.0.
Don't just take npm `latest`. It can be ahead of your game.
Stable modules need no experiment toggles on the world.

## Where packs are loaded from

Under `~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/`:

| Folder                               | Purpose                                                              |
| ------------------------------------ | -------------------------------------------------------------------- |
| `development_behavior_packs/`        | BPs under development. Read live, never cached or copied into worlds |
| `development_resource_packs/`        | same, for RPs                                                        |
| `behavior_packs/`, `resource_packs/` | installed packs (for example imported `.mcpack` files)               |
| `minecraftWorlds/<id>/`              | worlds, including their pack references                              |

`npm run deploy` puts `dist/hello_BP` and `dist/hello_RP` into the two `development_*` folders.
Because those folders are read live, a rebuild plus `/reload` is enough to pick up script changes.

## Content Log (see your errors)

Script errors, manifest problems, and bad JSON are reported here. Without it, failures are silent.

1. Open **Settings → Creator**.
2. Turn on **Enable Content Log GUI** (errors pop up on screen in game) and
   **Enable Content Log File** (saves the log to disk; look in the game data dir's `logs/`).

Starting mcpelauncher from a terminal (`flatpak run io.mrarm.mcpelauncher`) also shows the game's
log output there.

## /reload

`/reload` reruns all BP scripts and functions without leaving the world, so `npm run dev` plus
`/reload` is the inner loop. The world needs **cheats enabled** (world settings → Cheats), because
`/reload` is an operator command. These changes are **not** picked up by `/reload`: manifests, RP
content, and most BP JSON (entities, items, blocks). For those, leave and re-enter the world.
