# Recipe book and pot screen mockups (D13)

Target look for the custom JSON UI recipe book and pot screen, which replace the `ActionFormData`
screens. These are pictures, not game files: the spike builds the real screens to the same
structure. Each PNG is a 426×240 UI-px screen drawn at GUI scale 3 (1278×720), with hard pixels
and no anti-aliasing.

```sh
node art/harvest_kitchen/mockups/render-mockups.mjs
```

- Plain Node, no dependencies, deterministic. It needs the installed game for the vanilla icons
  (`vanillaTextures()` from `tools/gen-textures.mjs`) and reads our icons from
  `art/harvest_kitchen/generated/{items,ui}`. Re-run after regenerating the textures.
- It writes `parts/` first and then builds every mockup from those parts with the same 9-slice
  rule JSON UI uses: corners stay fixed, edges and centre stretch. If a part looks right in the
  mockups, it will stretch the same way in game.
- Vanilla textures only end up inside the rendered PNGs. None are copied into the repo.

## Mockups

| File                        | Shows                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `book_dish_page.png`        | Tomato Soup page; the Tomato slot is selected and shows where tomatoes come from                      |
| `book_dish_page_locked.png` | Chili Stew, locked: silhouettes, "?", and the "Find it!" hint                                         |
| `book_chapter_index.png`    | Pot chapter: the station, the family legend, 7 dish tiles (2 locked), hover                           |
| `book_home.png`             | Home: the big "What to make?" button and four chapter buttons                                         |
| `book_what_can_i_make.png`  | What to make?: dishes you can make now, plus "Almost!" (+1 of one item)                               |
| `pot_screen.png`            | 2 Tomato + Bowl over a lit fire → Tomato Soup, Cook enabled                                           |
| `pot_screen_almost.png`     | Onion + Bread: "Almost!" +1 Onion, +1 Bowl → Onion Soup, Cook disabled                                |
| `pot_screen_cold.png`       | Extra: same as the first pot screen, but with no fire. Unlit flame, Cook disabled, "Needs fire below" |

### Why they look like this

**The book.** It's a real book: a leather cover, two parchment pages with a page stack on the
outer edges, a stitched gutter and brass corners. Chapters are bookmark ribbons on the right edge.
Each ribbon shows only an icon, and the open chapter's ribbon sticks out further and is lighter.
The ribbons are plum because the four family colours are reserved for effects (plan §1.4), so no
tab can be mistaken for "heal" or "move". The nav bar on the cover has the same four buttons on
every page: ◀, Back (one level up), Home and ▶, plus the page number.

**Dish page.** The left page answers "what is it and what does it do?" without reading. It has the
name, the dish at 3× on a sunburst, the effect badge (family colour and icon, the vanilla effect
icon, "8 s") next to the station chip (pot + flame = "cook over fire"), and the food value as vanilla
hunger icons. The right page answers "how do I make it?" with a 3×3 grid of slots, an arrow and
the result. Counts follow vanilla: only counts above 1 are shown. The box under the grid shows the
selected ingredient, from grass to seeds to tomato in Plains, so "tap an ingredient to find it"
becomes something you can see.

**Locked page.** The page keeps its layout, so a locked dish still teaches the structure. Unknown
things are dark silhouettes with "?": the dish, its effect and the missing crop. Known ingredients
and the station stay visible, so the player knows the dish is close. "Find it!" says where to look
in pictures: the crop's silhouette → grass + jungle, "Jungle grass".

**Chapter index.** The left page shows the station as a picture with "Needs fire", plus a legend of
the four families. That legend is where the colour language is learned once. The right page shows
big 2× dish tiles, each with a small family gem, a found counter, and "Tap a dish". The tooltip is
the hover state. Because touch screens have no hover, it never carries information you can't get
elsewhere.

**Home.** "What to make?" is the biggest, warmest button in the book, with a count bubble for how
many dishes you can make right now. That's the positioning feature (plan §0), so it gets the most
weight. The four chapters are large icon buttons with a progress line.

**What to make?** The left page lists dishes you can make from your bag, each with its station.
The right page shows "Almost!" (one missing item) in the same form as the pot: missing item with
+1 → ghosted dish.

**Pot screen.** It reads left to right like a vanilla furnace: what's in the pot → arrow with the
heat under it → what comes out → **Cook!**. The 8 slots sit inside a pot shape: copper belly, iron
rim, handles. The info box below either says what you get (name, effect badge, food) or, when
nothing matches, shows "Almost!" with the +1 items and the target dish, plus a book icon because
tapping it opens that recipe. When Cook can't be pressed, it's grey and the result is ghosted, and
the screen always shows why (missing items or no fire). The Cook button is copper-orange (fire,
the pot's own colour) instead of Bedrock's green, because green means Explore.

## Deviations from the brief

- "What can I make?" is 4 words, so the label is **"What to make?"**. The chapter and lang key can
  keep the old name.
- The selected-ingredient box on the dish page shows one way tapping could work (details in place).
  The plan's version, where tapping jumps to the crop page, fits the same layout.
- `pot_screen_cold.png` is extra. It shows the unlit flame, which no other mockup does.
- The biome hint uses the vanilla jungle sapling as a stand-in until the biome icons (plan §4.3,
  P2) exist.

## Parts

`parts/*.png` are drawn to ship as real UI textures. Every 9-slice part has a Bedrock sidecar next
to it (`<name>.json`: `nineslice_size` [left, top, right, bottom] in source px, `base_size`), so
the PNG + JSON pair can be copied into `textures/ui/hk/` as is. Check the inset order in game once.

| Part                                                  | Size         | 9-slice [l, t, r, b] | Use                                                                      |
| ----------------------------------------------------- | ------------ | -------------------- | ------------------------------------------------------------------------ |
| `book_cover`                                          | 32×32        | 10                   | Leather cover with brass corners                                         |
| `page_left`                                           | 24×24        | 6, 3, 7, 4           | Parchment page; page stack on the left, gutter bands on the right        |
| `page_right`                                          | 24×24        | 7, 3, 6, 4           | Mirror of `page_left`                                                    |
| `parchment_grain`                                     | 16×16        | tiled                | Specks laid over the page centre (`"tiled": true`)                       |
| `book_gutter`                                         | 8×4          | 0, 1, 0, 1           | Stitched binding, stretched down the middle                              |
| `ribbon_tab`, `ribbon_tab_active`                     | 26×24, 33×24 | none                 | Chapter ribbons; the icon goes on top                                    |
| `slot`                                                | 18×18        | 1                    | Vanilla slot (#8B8B8B, #373737 top/left, #FFFFFF bottom/right); any size |
| `slot_large`                                          | 26×26        | 1                    | Result slot                                                              |
| `slot_locked`                                         | 18×18        | 1                    | Darker slot for locked dishes                                            |
| `slot_select`                                         | 20×20        | 3                    | White frame for hover/selected, drawn 2 px around a slot                 |
| `badge_heal`, `_move`, `_work`, `_explore`, `_locked` | 16×16        | 3                    | Effect badge, family-tinted                                              |
| `chip`                                                | 16×16        | 3                    | Parchment chip (station, food, hint boxes)                               |
| `count_bubble`                                        | 12×12        | 4                    | Plum count bubble (home "What to make?")                                 |
| `button_book`, `button_book_hover`                    | 16×18        | 3, 3, 3, 5           | Parchment buttons on the cover and chapter buttons                       |
| `button_cook`, `button_cook_disabled`                 | 16×18        | 3, 3, 3, 5           | Cook button states (and the home "What to make?" button)                 |
| `button_gray`                                         | 16×18        | 3, 3, 3, 5           | Vanilla-grey button (Recipe Book on the pot screen)                      |
| `pot_panel`                                           | 32×40        | 9, 20, 9, 5          | Pot screen panel: copper title rim, vanilla grey body                    |
| `pot_well`                                            | 24×28        | 7                    | Pot-shaped well behind the 8 slots                                       |
| `pot_handle`                                          | 6×11         | none                 | Left handle; mirror it for the right side                                |
| `arrow_ink`, `arrow_pot`, `arrow_pot_ready`           | 14×10        | none                 | Recipe arrow; pot arrow idle/ready (drawn 2× on the pot)                 |
| `flame_on`, `flame_off`                               | 16×16        | none                 | Heat indicator (drawn 2×); `flame_on` = `ui/needs_heat`                  |
| `dish_halo`                                           | 64×64        | none                 | Sunburst behind the 3× dish                                              |
| `divider`, `divider_gem`                              | 12×1, 11×5   | 2, 0, 2, 0 / none    | Title rule (stretched) + brass diamond centred on it                     |
| `tooltip`                                             | 12×12        | 3                    | Dark hover tooltip                                                       |
| `gem_heal`, `_move`, `_work`, `_explore`              | 7×7          | none                 | Family dot on dish tiles                                                 |

Vanilla textures the screens use directly (no art cost): `textures/ui/<effect>_effect` (18×18),
`textures/ui/hunger_full` + `hunger_background` (9×9, drawn 2×), and item textures such as
`textures/items/bowl`. Our icons come from `generated/` (`items/*`, `ui/family_*`, `ui/locked`,
`ui/chapter_*`, `ui/needs_heat`).

The mockup text uses a 5×7 bitmap font written inside the script, close to the game font. In game,
labels use the game font (`font_scale_factor: 2` for titles). Draw ◀ ▶ ⌂ ↶ as small images rather
than text glyphs, because whether symbols render in JSON UI labels depends on the glyph pages
(spike S2).

## Likely hard in JSON UI

- **Data goes in through form fields only.** A server form sends a title, a body and buttons
  (text + icon path). Every changing thing on a page has to be packed into those and unpacked with
  bindings: 9 slots with counts, family, duration, station, heat, locked flags, selected slot,
  page number and active tab. This is the biggest risk, and it's the spike's job.
- **Every tappable thing must be a form button.** That includes the ribbons, ◀ ▶, Back, Home,
  slots and tiles. A JSON UI button can't send anything back to the script otherwise, so the
  button order has to be a fixed contract (e.g. 0–4 tabs, 5–8 nav, 9+ content).
- **Silhouettes and ghosts:** an image's `color` multiplies its texture, so `[0, 0, 0]` gives a
  silhouette and `alpha` gives a ghost. Switching between them per slot likely needs two image
  controls with bound visibility.
- **Selected ingredient / where-from box:** with forms, tapping means re-opening the page with a
  new selection (a round trip, maybe a flicker). Jumping to the crop page costs the same.
- **Hover tooltips** only exist with a mouse. Nothing important may live only in a tooltip.
- **Block icons:** the crafting table is drawn here as its flat front face. A form icon is a
  texture path, so the 3D inventory render isn't available.
- **Variable widths:** badges and labels change width with text and language. Use stack panels
  sized to content, and allow titles to shrink for longer translations.
- **Live updates:** form screens are snapshots. The pot screen won't show a friend's change until
  it re-opens (same as plan §2.4).
- **Check with the publisher early:** whether Marketplace add-ons may ship JSON UI overrides at all,
  and how to scope the server-form override so it can't restyle other add-ons' forms.
