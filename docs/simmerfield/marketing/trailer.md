# Trailer and screenshot plan (draft)

Draft written 2026-10-22. It shows only what the slice code implements (`slice.md`), in the order
grow → chop → cook → effect → share cake.

**Capture after PS-3 at the earliest.** All art in the pack is still temporary (slice.md, "Art"),
and none of the slice has been run in game yet. Film only once the textures are touched up and the
test script (`tests/portfolio-slice.md`) has passed.

Video length: plan §6 asks for a **60–90 s** application video (PS-5) and a separate store trailer
(M5). This plan is a **~48 s** cut with a 30 s variant. Stretch it for the application video by
holding shots longer or adding the book sequence (shot 9) in full.

## Flags

Shots that depend on something not yet proven in game carry a flag. Check those items in the test
session first.

| Flag     | What must work first                                                                                                                 | Source                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **[B2]** | Sneak + use on the pot (add the whole stack) and the board (chop the stack)                                                          | blockers.md B2                  |
| **[B3]** | Flat hotbar icons and names for the pot, board and cake                                                                              | blockers.md B3                  |
| **[B9]** | Board facing (where the knife and handle end up) and which cake corner is eaten first                                                | blockers.md B9                  |
| **[V]**  | Pot visuals: hot rim, "ready" liquid, glow while cooking (permutations combining) and the named texture slots on pot, board and cake | slice.md untested items 3 and 4 |
| **[P]**  | Chop bits look like bits (`falling_dust` tinted per crop)                                                                            | slice.md untested item 11       |
| **[MP]** | Several players at once. Multiplayer QA is M4, after the application                                                                 | plan §6 M4                      |

## Capture setup

- **Format, resolution, frame rate, safe areas, logo and end-card rules:** per publisher spec (ask
  Waypoint). Don't pick sizes until they answer.
- **Packs:** only this add-on, on a clean world with no other resource packs. Ask Waypoint whether
  they allow any visual changes (shaders, other packs) in store media; assume not.
- **Settings:** creative mode, HUD hidden, view bobbing off, a fixed field of view (about 60–70 for
  close-ups, 80 for wide shots). Option names are in Settings > Video; check them on 1.26.52.
- **World control (vanilla commands):** `/time set sunrise` (or `noon`, `sunset`, `night`),
  `/weather clear`, `/gamerule dodaylightcycle false` so the light doesn't change between takes.
- **Debug kit (operator only, `slice.md` "/wm_kitchen:debug"):**
  - `/wm_kitchen:debug kit`: every add-on item, every vanilla ingredient, a campfire, bone meal, a
    hoe, a water bucket;
  - `/wm_kitchen:debug grow`: sets every crop and bush within 8 blocks to fully grown;
  - `/wm_kitchen:debug fast`: cooking takes 1 s (toggle). Real cook times are 5–10 s, which is
    also fine to film and cut;
  - `/wm_kitchen:debug pot`: prints the pot's state, to check it's in the phase the shot needs.
- **Camera moves:** hand-flown in creative flight, slow and steady. If you want eased moves, check
  whether the vanilla `/camera` command is available without experiments on 1.26.52 before relying
  on it.
- **Audio:** game sounds come from the pack, which uses vanilla sounds only. Record them clean with
  music off in the game settings. Music: TBD, licensed.
- **On-screen text:** at most 5 words per card, and every card is optional. Keep text on its own
  layer in the edit (not burned into footage), so it can be translated or dropped per language.
  The trailer works with no text at all.

## Shot list (~48 s)

| #   | Time      | Dur | Camera                                                                                              | What happens                                                                                                                                                | On-screen text       | Audio / sfx                                                     | Flags      |
| --- | --------- | --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------- | ---------- |
| 1   | 0:00–0:04 | 4 s | Wide, low over the crops, slow push-in. FOV 80. Sunrise behind the farm.                            | A small riverside farm in plains: rows of tomato, onion and cucumber at mixed stages, a chili and a strawberry bush, a pot on a campfire with smoke rising. | none                 | Music: TBD licensed (starts soft). Campfire crackle.            |            |
| 2   | 0:04–0:07 | 3 s | Over the shoulder, eye level, static. FOV 70.                                                       | The player breaks tall grass; tomato seeds pop out and are picked up.                                                                                       | none                 | Grass break, item pickup.                                       | see note 1 |
| 3   | 0:07–0:11 | 4 s | Close, ground level beside one crop, static.                                                        | Seeds planted on farmland. Bone meal: the crop grows a stage with green sparkles, then two more cuts to the fully grown tomato plant.                       | "Grow"               | `item.bone_meal.use`; growth sparkles.                          |            |
| 4   | 0:11–0:14 | 3 s | Medium, slight high angle, slow sideways drift. Cherry grove or meadow (pink, flowery).             | The player uses a fully grown strawberry bush; strawberries pop out; the bush drops back a stage.                                                           | none                 | `block.sweet_berry_bush.pick`.                                  |            |
| 5   | 0:14–0:18 | 4 s | Close, 45° above the board, static. FOV 60.                                                         | Holding a tomato, the player uses the Cutting Board: tomato-red bits fly up, Sliced Tomato goes to the inventory. Second use with an onion.                 | "Chop"               | `hit.wood` + `mob.slime.squish` (the pack's chop).              | [B9] [P]   |
| 6   | 0:18–0:21 | 3 s | Medium, eye level, pot centred on its campfire. Static.                                             | The player drops two tomatoes into the pot: a plop and a splash each, and the liquid rises one level.                                                       | "Cook"               | `block.decorated_pot.insert`; splash.                           | [V]        |
| 7   | 0:21–0:24 | 3 s | Same framing, slow push-in.                                                                         | The pot shows "ready" (glint, chime). Empty hand on the pot: the lid goes on, steam rises, the rim glows.                                                   | none                 | `note.chime`, then `block.lantern.place` (lid) and `bubble.up`. | [V]        |
| 8   | 0:24–0:27 | 3 s | First person, hand visible, looking down at the pot.                                                | Lid comes off with a "done" ding; the player takes the Tomato Soup into their hand.                                                                         | none                 | `note.bell`, `random.pop`.                                      | [V]        |
| 9   | 0:27–0:31 | 4 s | Screen capture, UI on. GUI scale large enough to read on a phone.                                   | Recipe Book home → "What can I make?" shows two dishes the player can make right now. Tap one: its page with ingredient icons.                              | none (the UI talks)  | `item.book.page_turn`; button clicks.                           |            |
| 10  | 0:31–0:35 | 4 s | Over the shoulder, then a cut to a wide side view. Nether or an overworld lava pool, safely staged. | The player eats Chili Stew (Fire Resistance), then walks across a short stretch of lava and steps out unhurt. The bowl stays in hand.                       | "Food with powers"   | `random.eat`; lava ambience.                                    | see note 2 |
| 11  | 0:35–0:38 | 3 s | Tracking shot from the side, low.                                                                   | The player eats Strawberry Jam (Speed), the bottle comes back, and they sprint off down a path.                                                             | none                 | `random.eat`; footsteps.                                        |            |
| 12  | 0:38–0:44 | 6 s | Wide, slightly high, slow orbit around a table outdoors. Sunset.                                    | A Strawberry Cake sits on a table. Three players walk up; each takes a slice; hearts float up; the cake shrinks one slice at a time.                        | "Share with friends" | `random.eat` + `random.orb` per slice; hearts.                  | [MP] [B9]  |
| 13  | 0:44–0:48 | 4 s | Pull-back and rise over the whole farm at sunset.                                                   | End card over the shot.                                                                                                                                     | "Simmerfield"        | Music resolves.                                                 |            |

Notes:

1. **Seed drops are random:** about 5 % per grass break in the crop's biomes (slice.md "Seed
   drops"). Film several breaks in plains or forest and keep the take where seeds drop. If no take
   works, cut the shot; shot 3 can start with seeds already in hand.
2. **Lava with kids in the audience:** keep it short and calm, or swap in Onion Soup (Night Vision)
   in a dark cave. Ask Waypoint whether they prefer one. Fire Resistance lasts 120 s, so there's time
   for retakes.

**30 s cut:** drop shots 2, 4, 9 and 11 and trim shot 12 to 4 s. Order and story stay the same.

**Alternatives if a flag fails:**

- [V] fails (no visible phase change): cut shot 7 to the chime only and let the action bar carry
  it, with the HUD on.
- [MP] not tested yet: one player eats three slices in a row, with two idle friend characters in
  frame; don't caption it "Share with friends" until multiplayer is checked.
- [B2] works: optional insert in shot 5 or 6 showing sneak + use with a whole stack. It's not in
  the main list because it's unproven.

## In-game scenes

Added 2026-10-23. Every shot above has a scripted scene in dev builds:
`/scriptevent wm_kitchen:trailer <scene>` sets the time and weather, stages blocks, puts your
player on their mark with the right items, hides the HUD and flies the camera (`Camera.setCamera`
with eases). Data in `packs/simmerfield/scripts/trailer/scenes.ts`, how to record in
`recording-guide.md`, the edit in `trailer-edit.json` (cut by `tools/edit-trailer.mjs`).
Each take is preroll, a black marker, a 0.5 s handle, the shot, a 0.5 s handle and a black marker;
the edit tool finds the shot by the marker.

The set is built once with `wm_kitchen:trailer anchor` (stand at its origin, **face east**) and
`wm_kitchen:trailer stage`. It clears an area of about 24 × 25 blocks around the anchor first.

| #   | Scene     | Camera                                     | You do                                         |
| --- | --------- | ------------------------------------------ | ---------------------------------------------- |
| 1   | `farm`    | push-in over the rows, FOV 80, sunrise     | nothing (parked out of frame)                  |
| 2   | `seeds`   | over the shoulder, static                  | break grass until seeds drop                   |
| 3   | `grow`    | ground level beside one crop, static       | nothing: the scene plants and grows the tomato |
| 4   | `berries` | slight high angle, sideways drift          | use the strawberry bush                        |
| 5   | `chop`    | 45° above the board, FOV 60                | tomato on the board, then onion                |
| 6   | `cook`    | eye level, pot centred, static             | two Tomato Soup Mixes into the pot             |
| 7   | `simmer`  | same framing, slow push-in                 | empty hand on the ready pot: cooking starts    |
| 8   | `serve`   | first person (your own view, hand visible) | take the soup when it dings                    |
| 9   | `guide`   | first person, HUD on                       | Kitchen Guide → "What can I make?" → a dish    |
| 10  | `lava`    | over the shoulder, cut to a side view      | eat Chili Stew, walk across the lava           |
| 11  | `jam`     | low side view, pans and tracks             | eat the jam, sprint when the camera moves      |
| 12  | `cake`    | slow 90° orbit, slightly high, sunset      | eat a slice every ~2 s                         |
| 13  | `finale`  | pull back and rise, sunset, FOV 80         | nothing; the end card comes in the edit        |

**Where the scenes differ from the shot text** (the pack changed after this plan was written):

- **Shot 3:** a scripted re-enactment. The scene sets the crop's stages itself, with the bone meal
  sound and the growth particle, so the player stays out of frame.
- **Shot 6 (D16):** the pot cooks a mix, not raw tomatoes. The player drops two Tomato Soup Mixes
  (2 tomatoes + a bowl on the vanilla crafting table each). The scene places a fresh, empty pot.
- **Shot 7:** there's no lid while cooking. The lid only shows when cooking pauses for lack of
  heat. The shot is "ready" (glint, chime), then an empty-hand use starts cooking: the lid sound,
  steam and the glowing rim.
- **Shot 8:** no lid comes off. "Done" is the bell, and one use collects the dish.
- **Shot 9:** the Recipe Book is now the **Kitchen Guide**, an item (D19). Its "What can I make?"
  spread lists what your inventory can make; give yourself only a few ingredients first.
- **30 s cut:** dropping shots 2, 4, 9 and 11 and trimming 12 to 4 s leaves 33 s, not 30. The edit
  also trims shots 1, 3, 5, 10 and 13 by 0.5 s each and shot 8 to 2.5 s.
- **15 s vertical cut (Shorts/TikTok):** grow, chop, cook, lava, cake, finale, centre-cropped to
  9:16 with large captions.
- **Captions:** "Share with friends" is still flagged [MP]. Drop it from `trailer-edit.json` until
  multiplayer is checked.

Screenshots: `wm_kitchen:trailer still <1-8>` holds a still camera (no movement, HUD hidden,
except 5, which needs the UI) for each screenshot below, until `wm_kitchen:trailer stop`. Item
frames for screenshot 6 go on the staged wall by hand.

## Screenshots (8)

Sizes, count limits, and whether UI or text is allowed in store screenshots: per publisher spec
(ask Waypoint). Each setup below works with the HUD off unless it says otherwise.

### 1. The farm (hero shot)

- **Scene:** plains next to a river, golden hour (`/time set sunset`, clear weather). A small fenced
  farm: tilled rows of tomato, onion and cucumber (water channel between the rows), a chili bush and
  a strawberry bush at the edge. A Cooking Pot on a lit campfire and a Cutting Board on a counter
  block next to it.
- **Player:** standing at the edge of the rows, holding a tomato.
- **Camera:** three-quarter view from a little above head height, the farm leading the eye to the
  pot. HUD off.
- **Staging:** `/wm_kitchen:debug kit`, plant everything, `/wm_kitchen:debug grow` for full-grown
  plants. Leave one row at mixed stages so growth reads.
- **Flags:** [V] (hot rim on the pot), [B9] (board facing).

### 2. Strawberries in bloom

- **Scene:** cherry grove or meadow, morning. A few strawberry bushes on grass, fully grown with
  fruit, petals or flowers around.
- **Player:** standing beside a bush, reaching to pick (not sneaking, so the pick is a normal use). A few strawberries on the ground just
  dropped.
- **Camera:** low, near ground level, bushes filling the foreground. HUD off.
- **Staging:** `/wm_kitchen:debug kit` for strawberries; plant them on grass;
  `/wm_kitchen:debug grow`.

### 3. Chopping

- **Scene:** a kitchen corner inside a wooden house: counter blocks, the Cutting Board on one,
  baskets or barrels of produce nearby. Warm light from lanterns.
- **Player:** holding a cucumber over the board, mid-chop; a few green bits in the air.
- **Camera:** close, 45° above the board. HUD off. Take a burst of screenshots or grab a frame from
  video, since the bits only last a moment.
- **Staging:** `/wm_kitchen:debug kit`.
- **Flags:** [B9] (knife and handle position), [P] (bits).

### 4. The pot at night

- **Scene:** night (`/time set night`), a campfire under the Cooking Pot in a small open-air kitchen.
  The pot is cooking: lid on, steam, rim glowing.
- **Player:** standing beside it, empty hand, looking at the pot.
- **Camera:** eye level, the pot's light the main light source. HUD off.
- **Staging:** add a recipe's ingredients and start cooking with real cook time (leave
  `/wm_kitchen:debug fast` off so the cooking phase lasts long enough to frame). Check with
  `/wm_kitchen:debug pot` that the phase is `cooking`.
- **Flags:** [V] (glow and lid while cooking).

### 5. "What can I make?"

- **Scene:** any calm background (the kitchen from screenshot 3).
- **UI:** **on.** The Recipe Book's "What can I make?" page with three or four dishes listed, their
  family colour glyphs visible. Try a large GUI scale so icons read at store size.
- **Staging:** `/wm_kitchen:debug kit` gives every ingredient, so the list will show every dish. To
  show a short, believable list, clear the inventory (`/clear`) and give yourself only the
  ingredients for three or four dishes.
- **Note:** the page text is English. Ask Waypoint whether UI screenshots need per-language
  versions.

### 6. Dishes by colour

- **Scene:** a kitchen wall with item frames (or glow item frames) in four columns, one per family:
  red (Tomato Soup, Vegetable Stew, Chicken Soup, Strawberry Cake), blue (Strawberry Jam, Garden
  Salad, Strawberry Cup), yellow (Salsa), green (Chili Stew, Fish Chowder, Onion Soup). Coloured
  wool or terracotta under each column to show the family colour.
- **Player:** not in frame, or at the edge looking at the wall.
- **Camera:** straight on, centred. HUD off.
- **Staging:** `/wm_kitchen:debug kit` (it gives one of each dish).
- **Flags:** [B3] for the cake: an item frame shows the item icon, which depends on the cake's flat
  icon working. Leave the sandwiches out (no effect, no family).

### 7. Sharing the cake

- **Scene:** an outdoor table at sunset, flowers and lanterns around. A Strawberry Cake with one or
  two slices gone.
- **Players:** three players around the table, one mid-bite with hearts above. Use friends' accounts
  or a second device.
- **Camera:** slightly high, three-quarter view, the cake in the centre. HUD off.
- **Staging:** `/wm_kitchen:debug kit` for the cake; place it; eat one or two slices before framing.
- **Flags:** [MP], [B9] (which corner goes first), [B3] (the cake item placing the block).

### 8. A dish with a power

- **Scene:** a lava pool (Nether or overworld) or a dark cave.
- **Player:** with Fire Resistance from Chili Stew, wading through lava; or with Night Vision from
  Onion Soup, looking down a lit-up cave. Empty bowl in hand.
- **Camera:** side view, wide enough to show the danger and the calm player. HUD off.
- **Staging:** `/wm_kitchen:debug kit`; eat the dish just before the shot (Fire Resistance and
  Night Vision last 120 s).
- **Note:** same kids'-audience caution as trailer note 2.
