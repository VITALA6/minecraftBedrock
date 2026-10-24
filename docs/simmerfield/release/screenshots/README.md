# In-game screenshots and loops (2026-10-24)

Real in-game captures for the CurseForge gallery and MCPEDL, taken in the owner's test world (game
1.26.52.3, build `90145ec`, standard renderer). [contact-sheet.png](contact-sheet.png) shows them
all, so you can choose. **The player character is in none of them.** Scenery shots used spectator
mode, and the cooking and chopping loops used invisibility with an empty hand.

| File                        | What it shows                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `01-pot-on-campfire.png`    | The Cooking Pot on a lit campfire at sunset, pink sky, the Cutting Board behind                            |
| `02-cooking-chili-stew.png` | Close-up of a pot on the lit Kitchen Stove cooking Chili Stew, with the spoon                              |
| `03-kitchen-decor.png`      | The decor kitchen, front on: counter, sink, stove with pot, cabinet, jar, basket, spice shelf, hanging pan |
| `04-kitchen-sunset.png`     | The same kitchen at three-quarters at sunset, with the campfire pot behind                                 |
| `05-strawberry-bushes.png`  | Strawberry and chili bushes among flowers, low angle, sunset sky                                           |
| `06-cake-table.png`         | The Strawberry Cake on a table between lanterns, the farm and kitchen behind                               |
| `07-chopping.png`           | The Cutting Board mid-chop (cucumber bits flying), a llama behind                                          |
| `08-farm.png`               | Tomato, onion and cucumber rows toward the mountain, golden hour                                           |
| `MCPEDL-thumbnail.png`      | 720×340, cropped from 01 (upload it titled exactly `MCPEDL`)                                               |
| `cooking.gif` / `.mp4`      | 9 s loop: the spoon stirs Chili Stew on the stove, 640 px, 15 fps                                          |
| `chopping.gif` / `.mp4`     | 7 s loop: cucumbers chopped on the board, 640 px, 15 fps                                                   |

All stills are 1920×1080. `raw/` (gitignored, about 50 MB) holds every original capture, including
the variants that weren't picked (three times of day per angle, the trailer stills 1, 2, 3, 7 and 8).

## How they were made

- **Set:** `/scriptevent wm_kitchen:trailer anchor` + `stage` on flat savanna about 350 blocks from
  spawn, at (-380, 63, -380) facing east. Around it I levelled the ground, cleared tree canopies and
  built the decor kitchen with `/setblock`.
- **Shots:** custom `/camera @s set minecraft:free` angles, `/time set` 1000 / 11800 / 12450,
  clear weather, GUI hidden (F1), the game fullscreen at 1920×1080. Captured with `grim`. Input went
  through a uinput virtual keyboard and mouse (python-evdev), focus-checked before every key.
- **Loops:** `grim` frame grabs at 15 fps, encoded with ffmpeg (palette GIF plus H.264 MP4).
- **Grade (ImageMagick):** red ×1.03, blue ×0.96, saturation +10 %, brightness +6 %, a gentle
  sigmoidal contrast, a vignette down to 74 % in the corners, and a light unsharp mask. No block or
  item changed. The GIFs got the same warmth with ffmpeg `eq` / `colorbalance`.

## Decisions and gaps

- **Savanna, not plains.** The nearest plains were coastline and cliffs. The savanna site was flat,
  with a pond and a mountain as backdrop. Its grass is olive, which suits the warm golden-hour look.
- **No shot with the player.** The trailer stills 1, 3, 7 and 8 put your character in frame by
  design, so none of them were picked.
- **Vibrant Visuals: not tried.** Turning it on needs the video settings menu. The standard
  renderer's time-of-day changes are subtle, so the grade does the warming.
- **No crop-growth loop.** Bone meal kept hitting the grass beside a sprout, and resetting the
  grown field with `/fill` and `replace` doesn't match grown states. Try it in the trailer `grow`
  scene instead.
- **Still to shoot (needs a person):** the Kitchen Guide's "What can I make?" page (screenshot 5)
  and dishes in item frames (screenshot 6). Both need hands-on actions in menus.
- **World changes in the test world:** the set, the levelled ring and the kitchen at about
  (-380, -380). Gamerules changed: `dodaylightcycle`, `doweathercycle` and `domobspawning` are all
  false. The player was left in spectator mode with invisibility.
