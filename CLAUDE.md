# Minecraft Bedrock add-on workspace

Base workspace for Minecraft: Bedrock Edition add-ons (Script API + custom content).
The long-term goal is polished, Marketplace-quality packs for a portfolio and for publishing
through a Marketplace publisher. `packs/hello` is only a pipeline smoke test.

The owner is an experienced TypeScript dev who is new to Minecraft content. When Bedrock-specific
concepts come up, explain them briefly.

## Hard rules

- **Stable Script API only**: `@minecraft/server`, `@minecraft/server-ui`. No beta or experimental
  modules or APIs, no `-beta`/`-rc` versions, and no "Beta APIs" experiment toggle.
- **The manifest and npm versions must match exactly.** Pin with `npm i -E`. `tools/build.mjs` fails
  the build when a manifest `module_name` version differs from `node_modules` or is a prerelease.
- **Versions are capped by the installed game**, not by npm `latest` (see "Versions" below).
- **Don't invent paths or versions.** Verify them with commands such as `npm view`, `ls`, or the
  `.d.ts` files in `node_modules/@minecraft/*`. If unsure, ask.
- Keep it simple: plain Node scripts in `tools/`, esbuild, tsc. No extra frameworks.

## Versions (verified 2026-10-21)

| Thing                  | Version   | How verified                                                               |
| ---------------------- | --------- | -------------------------------------------------------------------------- |
| Game (mcpelauncher)    | 1.26.52.3 | `~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/versions/versions.ini` |
| `@minecraft/server`    | 2.10.0    | `2.10.0-rc.1.26.50-*` exists and `2.11.0-beta.1.26.52-stable` is next      |
| `@minecraft/server-ui` | 2.2.0     | `2.2.0-rc.1.26.50-*` exists and `2.3.0-beta.1.26.52-stable` is next        |

The game refuses to load a pack that requests a module version newer than the one it ships with,
so npm `latest` is only usable when it isn't ahead of the game. To upgrade after the game updates:

1. Read the new game version from `versions.ini`. That file lists **every installed** version.
   The one that actually runs comes from `profiles/profiles.ini` next to `versions/`;
   `version=googleplay` means the latest Play Store build. A `mods/mcpelauncher-updates/<x>/`
   folder is a launcher compatibility mod, not a game install.
2. Run `npm view @minecraft/server versions`, find the `*-beta.<gameVersion>-stable` tag, and take
   the highest stable version below that beta. Cross-check that a matching `<X>-rc.<game minor>-*`
   tag exists. Do the same for `@minecraft/server-ui`.
3. Run `npm i -E @minecraft/server@X @minecraft/server-ui@Y`, then update every BP manifest to match.
   The build will flag any mismatch. Also bump `min_engine_version` if needed.

## Structure

```
packs/<name>/
  behavior/        BP source: manifest.json, pack_icon.png, later entities/, items/, ...
  resource/        RP source: manifest.json, pack_icon.png, later textures/, texts/, ...
  scripts/main.ts  Script API entry; bundled into the BP as scripts/main.js
tools/
  build.mjs        packs/ -> dist/<name>_BP, dist/<name>_RP (+ --watch)
  deploy.mjs       dist/ -> game development_* folders (copy, or --link)
  paths.mjs        shared paths (repo, dist, game dir)
docs/              learning notes (start with docs/00-setup.md)
dist/              build output (gitignored)
```

## Commands

| Command                    | What it does                                                             |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run build`            | type-check (tsc), then build all packs into `dist/`                      |
| `npm run dev`              | watch `packs/` and rebuild on change (no type-check; refreshes copies)   |
| `npm run deploy`           | copy `dist/*_BP` and `dist/*_RP` into the game's `development_*` folders |
| `npm run deploy -- --link` | symlink instead of copy (not picked up by the game, see below)           |
| `npm run typecheck`        | `tsc` only                                                               |
| `npm run lint`             | eslint (type-aware for pack scripts)                                     |
| `npm run format`           | prettier write (`format:check` to verify)                                |
| `npm run uuid`             | print 5 fresh UUIDs (one new BP+RP+script pack needs exactly 5)          |

Deploy once, then keep `npm run dev` running. It re-copies the deployed packs into the game after
every rebuild, so after a rebuild you just run `/reload` in game. It reloads scripts and functions only. Changes to manifests,
BP JSON content, or resource packs need you to leave and re-enter the world.

## Game paths

- Game data (com.mojang):
  `~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/`
  - `development_behavior_packs/`, `development_resource_packs/`: deploy targets
  - `minecraftWorlds/`, `logs/`
- Override with the `MC_GAME_DIR` env var.
- **Copy, not symlink (verified 2026-10-21, game 1.26.52.3):** the game didn't pick up symlinked
  packs, even with Flatpak read access to `dist/` and links that resolve inside the sandbox. Copied
  packs load fine, which is why copy is the default.
  - `--link` is kept for experiments. It still refuses to run unless the sandbox can see `dist/`,
    and tells you to grant access with
    `flatpak override --user --filesystem=/home/super/dev/minecraftBedrock/dist:ro io.mrarm.mcpelauncher`.
  - That override is currently set on this machine. Copy mode doesn't need it, and
    `flatpak override --user --nofilesystem=/home/super/dev/minecraftBedrock/dist io.mrarm.mcpelauncher`
    removes it.
- Deploy only replaces entries it created: symlinks into `dist/`, or copies containing
  `.deployed-from-repo`. It refuses to touch anything else.

## Adding a new pack

1. Create `packs/<name>/behavior`, `packs/<name>/resource` and `packs/<name>/scripts`, with
   `<name>` in snake_case.
2. Copy both `manifest.json` files and both `pack_icon.png` files from `packs/hello`.
3. Run `npm run uuid` and replace **all 5** UUIDs: BP header, BP data module, BP script module,
   RP header, RP resources module. Then set the BP's pack dependency `uuid` to the **new RP header
   UUID**.
4. Set `header.name` and `header.description`, and reset `version` to `[1, 0, 0]` in both
   manifests. The BP's RP dependency `version` must equal the RP header `version`.
5. Write `scripts/main.ts`. A pack without scripts drops `scripts/`, the `script` module, and the
   `module_name` dependencies.
6. Run `npm run build && npm run deploy`, then activate the BP on a world (the RP comes along).

## Conventions

- **Namespace:** `myteam` is a placeholder until the publisher namespace is decided. Every custom
  identifier is namespaced and snake_case: `myteam:ruby_sword`, `myteam:goblin`. Never use
  `minecraft:` for new content. Prefix script-side keys the same way, including dynamic properties,
  scoreboard objectives, tags, and `/scriptevent` ids (`myteam:hello.greeted`). Renaming the
  namespace later is one search-and-replace, so keep the prefix literal and consistent.
- **Naming:** pack folders and JSON/asset files use snake_case. Dist folders are `<name>_BP` and
  `<name>_RP`. TS files use kebab-case; identifiers use camelCase/PascalCase as in normal TS.
- **UUIDs:**
  - Every pack header and every module gets its own fresh UUID from `npm run uuid`.
  - Never copy UUIDs between packs. Two packs with the same UUID collide in game.
  - Never change UUIDs after a pack has shipped, because worlds reference packs by UUID. Ship
    updates by bumping `header.version`, and keep the BP's RP dependency version in sync.
- **Script code:**
  - There's no DOM or Node: use `system.run` and `system.runTimeout`, not `setTimeout`.
  - With 2.x, top-level code runs in early-execution mode. Subscribe to events there, but touch
    the world from event callbacks or `world.afterEvents.worldLoad`.
  - Handle every promise (for example `form.show()`). eslint's `no-floating-promises` enforces this.
- **Manifests:** `format_version: 2`, with arrays for pack versions and strings for `module_name`
  versions.
