# 01 — Custom content: item, block, mob, recipe

This doc walks through `packs/basics`, a learning pack with:

- a ruby item,
- a ruby block that drops 9 rubies,
- a hostile "slime cube" mob,
- a crafting recipe,
- English names for all of them.

It uses stable JSON formats only, with no experiment toggles.

## How it all links together

Everything is joined by **strings**. Nothing is joined by file names, apart from the paths you
type explicitly.

```
BEHAVIOR PACK (what things do)                RESOURCE PACK (how things look)
------------------------------                -------------------------------
items/ruby.json                               textures/item_texture.json
  identifier "myteam:ruby" ─────────────┐       "myteam_ruby" -> textures/myteam/items/ruby.png
  minecraft:icon "myteam_ruby" ─────────┼────────────┘
  display_name "item.myteam:ruby.name" ─┼──────> texts/en_US.lang  item.myteam:ruby.name=Ruby
                                        │
blocks/ruby_block.json                  │     textures/terrain_texture.json
  identifier "myteam:ruby_block" ───────┼──┐    "myteam_ruby_block" -> textures/myteam/blocks/...
  material_instances "myteam_ruby_block"┼──┼────────┘
  loot "loot_tables/myteam/blocks/…" ─┐ │  ├──> blocks.json  "myteam:ruby_block": sound
                                      │ │  └──> en_US.lang   tile.myteam:ruby_block.name
loot_tables/myteam/blocks/ruby_block.json
  name "myteam:ruby" ─────────────────────┘ (an item identifier)

entities/slime_cube.json                      entity/slime_cube.entity.json (client entity)
  identifier "myteam:slime_cube" ──────────────> identifier "myteam:slime_cube"
  loot "loot_tables/myteam/entities/…"          geometry  "geometry.slime" (vanilla model)
                                                texture   textures/myteam/entity/slime_cube.png
                                                render_controllers "controller.render.myteam.slime_cube"
                                                             │
                                              render_controllers/slime_cube.render_controllers.json
                                                (which geometry, material, texture to draw)

recipes/ruby_block.json   9 x "myteam:ruby" -> 1 x "myteam:ruby_block"
```

Four kinds of string are involved:

- **Identifiers** (`myteam:ruby`) name a game object. The BP defines it, and the RP and other BP
  files refer to it by the same string.
- **Texture shortnames** (`myteam_ruby`) are aliases defined in `item_texture.json` or
  `terrain_texture.json`. Items and blocks refer to the alias, not the PNG path. Entities are
  different: client entities use the PNG path directly.
- **Paths**: loot tables, entity textures. They are relative to the pack root and have no `.png`
  extension.
- **Localization keys** (`item.myteam:ruby.name`) resolve through `texts/en_US.lang`.

If one side of a link has a typo, the game usually doesn't crash. You get a missing texture (the
purple and black checkerboard), an untranslated key shown as raw text, or an error in the Content
Log.

## `format_version`: which one to use

Each file type has its own schema version. We use the **newest version that vanilla itself ships
for that file type in game 1.26.52**. I read these from the vanilla packs inside the game install
(`versions/1.26.52.3/assets/assets/*_packs/vanilla_*/__brarchive/*.brarchive`, which hold plain
JSON).

| File type            | format_version | Note                                              |
| -------------------- | -------------- | ------------------------------------------------- |
| BP item              | `1.26.30`      | newest item format in vanilla (`minecraft:apple`) |
| BP block             | `1.26.50`      |                                                   |
| BP entity            | `1.26.50`      | same as vanilla zombie                            |
| BP recipe            | `1.26.50`      |                                                   |
| BP loot table        | none           | loot tables have no format_version                |
| RP client entity     | `1.10.0`       | newest common client-entity format                |
| RP render controller | `1.8.0`        | same as nearly all vanilla render controllers     |
| RP `blocks.json`     | `[1, 1, 0]`    | an array, not a string                            |
| texture atlases      | none           |                                                   |

The format_version also decides **how fields are parsed**. For example, `minecraft:pushable` is no
longer parsed from 1.26.10 onward. It was split into `minecraft:pushable_by_entity` and
`minecraft:pushable_by_block`. When you copy an example from an older tutorial, check its
format_version.

---

## Behavior pack files

### `behavior/manifest.json`

This works the same way as in `00-setup.md`, with three differences:

- There's only a `data` module. The pack has no scripts, so there's no `script` module and no
  `@minecraft/*` dependencies.
- The pack depends on the RP's header UUID.
- `name` and `description` are **localization keys** (`pack.name`, `pack.description`), resolved
  from this pack's own `texts/en_US.lang`. Marketplace packs are expected to be localized, so
  starting this way costs nothing.

### `behavior/texts/en_US.lang` and `languages.json`

- `languages.json` lists the languages this pack provides (`["en_US"]`).
- `en_US.lang` holds `key=value` lines. In the BP it only names the pack itself.

### `behavior/items/ruby.json`: custom item

- `description.identifier` is `myteam:ruby`, the ID used by `/give`, recipes and loot tables.
- `description.menu_category.category` set to `items` decides which creative-inventory tab the
  item appears in.
- `minecraft:display_name.value` is a lang key, resolved in the **RP's** `en_US.lang`.
- `minecraft:icon.textures.default` is the **shortname** `myteam_ruby` from `item_texture.json`.
- `minecraft:max_stack_size: 64` is the default. It's written out so you can see where it goes.

### `behavior/blocks/ruby_block.json`: custom block

- `menu_category: construction` puts the block in the creative tab. Every custom block also gets
  an item form automatically, which is what you hold and place.
- `minecraft:destructible_by_mining.seconds_to_destroy` is how long it takes to break by hand.
  This is the block's "hardness". Tool-specific speeds (`item_specific_speeds`) need an
  experiment, so we don't use them yet.
- `minecraft:destructible_by_explosion.explosion_resistance` sets how well it survives TNT and
  creepers (6 is roughly stone level).
- `minecraft:loot` is the **path** of the loot table dropped when the block is broken. Without it,
  the block drops itself.
- `minecraft:material_instances` sets how faces are drawn.
  - `"*"` means all faces. You can also give per-face entries such as `up` or `north`.
  - `texture` is the **shortname** from `terrain_texture.json`.
  - `render_method: opaque` means a solid block with no transparency. `alpha_test` gives cutouts
    like leaves, and `blend` gives translucency like glass.
- `minecraft:geometry` with `identifier: minecraft:geometry.full_block` is the built-in plain cube.
  It is **required whenever `material_instances` is set**. Without it, the block isn't registered at
  all. It vanishes from creative and `/give`, and recipes that produce it fail. The only clue is an
  error in the Content Log file: `Block needs both a "geometry" and "material_instances"
component`. The other built-in shape is `minecraft:geometry.cross`, used by flowers. For any
  other shape you make a model in the RP, for example with Blockbench.
- `minecraft:map_color` is the block's color on maps.
- The block's name comes from the default key `tile.<identifier>.name`.

### `behavior/loot_tables/myteam/blocks/ruby_block.json`

- `pools` is a list of independent rolls. `rolls: 1` picks one entry from the pool.
- `entries[].type: item` with `name: myteam:ruby` is the item that drops.
- `functions` modify the drop. `set_count: 9` means exactly 9.
- The folder is namespaced (`loot_tables/myteam/...`) because loot tables are found **by path**.
  If two packs both had `loot_tables/blocks/ruby_block.json`, the pack higher in the stack would
  silently win.

### `behavior/loot_tables/myteam/entities/slime_cube.json`

- `set_count: {min: 1, max: 3}` drops 1 to 3 rubies.
- `looting_enchant` adds up to 1 extra per level of Looting.

### `behavior/entities/slime_cube.json`: server-side mob

- **`description`:**
  - `is_spawnable: true` creates a spawn egg.
  - `is_summonable: true` allows `/summon`.
  - There are no spawn rules, so it never spawns naturally.
- **Identity and stats:**
  - `minecraft:type_family` sets the tags that filters test against, such as "is this a monster?".
  - `minecraft:health` holds the current `value` and the `max`.
  - `minecraft:attack.damage` is the melee damage (3, the same as a zombie).
  - `minecraft:collision_box` is the hitbox in blocks (0.9 × 0.9).
- **Rewards:** `minecraft:loot` names the death drops (by path), and `minecraft:experience_reward`
  gives XP only when a player made the kill.
- **Movement:**
  - `minecraft:physics` provides gravity and collisions.
  - `pushable_by_entity` and `pushable_by_block` let other mobs and pistons push it.
  - `minecraft:movement` is the base speed.
  - `movement.basic` means walking. Other types include `fly` and `swim`.
  - `jump.static` lets it hop up single blocks.
  - `navigation.walk` handles pathfinding over land.
- **AI goals** (`minecraft:behavior.*`): each goal has a `priority`, where a **lower number wins**
  when goals compete.
  - `behavior.float` (0) keeps it from drowning.
  - `behavior.hurt_by_target` (1) makes it fight back when hit.
  - `behavior.nearest_attackable_target` (2) picks the nearest visible **player** within 16
    blocks as its target.
  - `behavior.melee_box_attack` (3) walks to the target and hits it, using the `attack` damage.
    This is what vanilla mobs use in 1.26.x.
  - `behavior.random_stroll`, `look_at_player` and `random_look_around` (6–8) are idle behavior.

### `behavior/recipes/ruby_block.json`: shaped recipe

- `minecraft:recipe_shaped` means the item layout matters. The other kind is
  `minecraft:recipe_shapeless`.
- `description.identifier` is the recipe's own ID. It is separate from the result item's ID.
- `tags: ["crafting_table"]` sets which station it works at.
- `pattern` and `key` work together: `#` is mapped to `myteam:ruby`, so `"###"` three times is a
  full 3×3 grid.
- `unlock` decides when the recipe appears in the recipe book: when the player first holds a ruby.
- `result` gives 1 × `myteam:ruby_block`.

---

## Resource pack files

### `resource/manifest.json`, `texts/`

- The manifest has a single `resources` module. Its header `uuid` is what the BP depends on.
- `texts/en_US.lang` holds the in-game names:

  | Key                                            | Value                |
  | ---------------------------------------------- | -------------------- |
  | `item.myteam:ruby.name`                        | Ruby                 |
  | `tile.myteam:ruby_block.name`                  | Block of Ruby        |
  | `entity.myteam:slime_cube.name`                | Slime Cube           |
  | `item.spawn_egg.entity.myteam:slime_cube.name` | Slime Cube Spawn Egg |

  Each pattern matches what vanilla uses: `item.apple.name`, `entity.zombie.name`,
  `item.spawn_egg.entity.zombie.name`.

### `resource/textures/item_texture.json`: item atlas

- It defines **shortnames** for item icons:
  `"myteam_ruby": { "textures": "textures/myteam/items/ruby" }`.
- The path has no `.png`.
- `texture_name: atlas.items` and `resource_pack_name` are fixed boilerplate.

### `resource/textures/terrain_texture.json`: block atlas

- This is the same idea for block textures (`atlas.terrain`).
- `padding` and `num_mip_levels` match vanilla.
- Shortnames are a **global** namespace across all loaded packs, so we prefix them with `myteam_`.

### `resource/blocks.json`

- It holds client-side per-block settings, keyed by **block identifier**.
- We only set `sound: stone`, which controls the break, place and step sounds.
- Textures for custom blocks come from `material_instances` in the BP, not from here. Don't
  define them in both places.

### `resource/entity/slime_cube.entity.json`: client entity

- It must use the **same identifier** as the BP entity. This file is how the game knows what to
  draw for `myteam:slime_cube`.
- Each of these is a map from short names to the real thing:

  | Map         | Our entry                                                                          | Used in the render controller as |
  | ----------- | ---------------------------------------------------------------------------------- | -------------------------------- |
  | `materials` | `default` → `entity_alphatest`, a vanilla material that supports cutout pixels     | `Material.default`               |
  | `textures`  | `default` → `textures/myteam/entity/slime_cube` (a path, not a shortname)          | `Texture.default`                |
  | `geometry`  | `default` → `geometry.slime`, borrowed from the vanilla RP, which is always loaded | `Geometry.default`               |

- `scripts.scale: "2.5"`: the slime model is a 6-pixel cube. Vanilla slimes scale it by size, so
  we scale it to about 15 pixels, roughly one block. The hitbox is 0.9 to match.
- `render_controllers` lists which controller or controllers draw this entity.
- `spawn_egg` sets the two egg colors.
- There are no animations, so the cube glides rather than bounces. Animations come later with
  Blockbench.

### `resource/render_controllers/slime_cube.render_controllers.json`

- A render controller picks **which** geometry, material and texture to draw. It can pick with
  Molang expressions, for example a different texture per variant.
- Ours is the simplest possible one: `Geometry.default`, `Material.default` on every bone (`"*"`),
  and `Texture.default`. These resolve through the client entity's maps.

### Textures (`resource/textures/myteam/...`)

- The 16×16 PNGs are generated placeholders.
- The entity texture is **64×32**, because `geometry.slime` declares that size and maps UVs into
  it:
  - the cube's faces at (0,16),
  - the eyes at (32,0) and (32,4),
  - the mouth at (32,8).
- These paths are namespaced for the same reason as the loot tables: a texture with the same path
  in a higher pack overrides yours.

---

## What reloads when

- Changes to any of these JSON files or textures need you to **leave and re-enter the world**.
  `/reload` only reloads scripts and functions.
- If something still looks stale after re-entering, restart the game.
