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
types/             ambient globals the game provides (console); no DOM lib on purpose
tools/
  build.mjs        packs/ -> dist/<name>_BP, dist/<name>_RP (+ --watch)
  deploy.mjs       dist/ -> game development_* folders (copy, or --link)
  paths.mjs        shared paths (repo, dist, game dir)
docs/              learning notes (00-setup, 01-custom-content, ...)
dist/              build output (gitignored)
```

Current packs:

- `hello`: script smoke test.
- `basics`: content-only learning pack (item, block, mob, recipe; see `docs/01-custom-content.md`).
- `scripting`: a self-contained **copy** of `basics` content plus a Script API ruby economy (see
  `docs/02-scripting.md`). It copies rather than depends because the bank custom component must be
  listed in `myteam:ruby_block`'s JSON.
  - **Never activate `basics` and `scripting` on the same world**: same identifiers.
  - Stage 1 content fixes must be made in both packs.
- `harvest_kitchen`: product MVP (farming + cooking), namespace placeholder `hk` instead of
  `myteam`. Notes in `docs/harvest-kitchen/mvp.md`.

## Commands

| Command                    | What it does                                                             |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run build`            | type-check (tsc), check every pack `.json` parses, build into `dist/`    |
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
- **Debugging: read the Content Log _file_, not the in-game GUI.** The GUI can show nothing while
  the file has the real error (seen on 2026-10-21: a rejected block).
  - Files are `logs/ContentLog<date>_<time>_1.txt`, written when Enable Content Log File is on.
  - **The file loses its tail (seen 2026-10-21 under mcpelauncher).** It's written in 4 KB blocks
    and the last partial block is never flushed, even on a clean quit. Every log is an exact
    multiple of 4096 bytes and ends mid-line, and a short session leaves a 0-byte file. Errors from
    the last few KB of a session are lost.
  - Launching `mcpelauncher-client` from a terminal doesn't help. Its stdout carries the general
    game log (`[Minecraft] NO LOG FILE! - …`) but no Content Log messages: no `[Scripting]`, no
    JSON errors.
  - Workaround: after loading the world, fly in creative for a minute or two. The
    `No sound found … 'fly'` verbose spam fills the first 4 KB block, which pushes the load-time
    messages to disk.
  - Hide the noise with `grep -v '\[verbose\]' <file> | grep -v '^$'`.
  - A broken definition usually causes follow-on errors, such as recipe or `blocks.json` errors
    for the missing block. Fix the first one.
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
2. Copy both `manifest.json` files and both `pack_icon.png` files from `packs/hello` (a script
   pack, 5 UUIDs) or `packs/basics` (a content-only pack, 4 UUIDs, localized pack names).
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
  - **Verify every API in the pinned `.d.ts` before using it.**
    - `@privilege no-restricted-execution` marks calls that throw inside before-events and custom
      command callbacks. Defer those with `system.run`.
    - Custom components and custom commands register only in `system.beforeEvents.startup`.
  - **Module layout** (see `packs/scripting/scripts`):
    - `main.ts` only wires things together, and `config.ts` holds IDs and numbers.
    - Each feature is a module exporting `register*()`, in `events/`, `components/` or `ui/`.
    - Shared state goes through one module (`wallet.ts`).
    - Validation lives in logic modules (`shop.ts`), not in UI code.
  - **After any `await`** (forms), check `player.isValid`, and re-validate server-side before
    changing anything.
  - Scoreboard objective IDs use `[a-z0-9_]` (`myteam_coins`), because they get typed into
    commands. Dynamic property keys use `myteam:`.
- **Manifests:** `format_version: 2`, with arrays for pack versions and strings for `module_name`
  versions. Set `header.name` and `header.description` to `pack.name` and `pack.description`, and
  define both keys in each pack's own `texts/en_US.lang`.
- **Content JSON `format_version`:** use the newest version that **vanilla itself ships** for that
  file type in the installed game. Don't guess, and don't copy versions from tutorials. The vanilla
  packs are plain JSON inside
  `~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/versions/<game>/assets/assets/{behavior,resource}_packs/vanilla*/__brarchive/*.brarchive`,
  so `grep -a '"format_version"'` works on them. Those vanilla files are also the best reference
  for current component names. For example, 1.26.x uses `behavior.melee_box_attack` and
  `pushable_by_entity`/`pushable_by_block`, not `minecraft:pushable`.
  - Vanilla files contain internal-only fields such as `internal_vanilla_data`. Don't copy those.
  - A block with `minecraft:material_instances` **must** also have `minecraft:geometry`. For a
    plain cube that is `{ "identifier": "minecraft:geometry.full_block" }`. Without it, the block
    isn't registered at all.
  - When unsure whether an identifier or enum value exists, `strings` on
    `versions/<game>/lib/x86_64/libminecraftpe.so` shows what the game knows, including its error
    message texts.
  - Check Microsoft Learn when you're unsure whether a component is stable. Anything that needs an
    experiment is out; `item_specific_speeds` is one example.
  - Current picks for 1.26.52 are listed in `docs/01-custom-content.md`.
- **Path-addressed files are namespaced by folder**, because a same-path file in a higher pack
  silently overrides yours: `textures/myteam/{items,blocks,entity}/...` and
  `loot_tables/myteam/{blocks,entities}/...`. Identifier-addressed files (`items/`, `blocks/`,
  `entities/`, `recipes/`) don't need this.
- **Texture shortnames** in `item_texture.json` and `terrain_texture.json` are global across
  packs, so prefix them: `myteam_<name>`.
- **Lang keys:**
  - items: an explicit `minecraft:display_name` value `item.<id>.name`
  - blocks: the default `tile.<id>.name`
  - entities: `entity.<id>.name`
  - spawn eggs: `item.spawn_egg.entity.<id>.name`
