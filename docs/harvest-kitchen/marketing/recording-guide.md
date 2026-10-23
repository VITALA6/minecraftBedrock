# Recording the trailer (Arch Linux + Hyprland, mcpelauncher)

How to record the shots in `trailer.md` at 1920×1080, 60 fps, and cut them with
`tools/edit-trailer.mjs`. The in-game side is `/scriptevent hk:trailer …`
(`packs/harvest_kitchen/scripts/trailer/`). It flies the camera, so each take of a shot frames
the same way and you only press record.

Items marked **(unverified)** weren't checked on this machine. Try them once before a real
session.

## What this machine has (checked 2026-10-23)

| Thing                   | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| Hyprland                | 0.56.2, **Lua config** (`~/.config/hypr/hyprland.lua`)                               |
| Monitors in the config  | `DP-1` 2560×1440@180, scale 1 (external) · `eDP-1` 1920×1080@144, **scale 1.5**      |
| Connected at check time | `eDP-1` only (logical size 1280×720, so a "1920×1080" window can't fit at scale 1.5) |
| GPU                     | NVIDIA RTX 4050 Laptop (NVENC available)                                             |
| OBS                     | obs-studio 32.2.2                                                                    |
| Portal                  | xdg-desktop-portal-hyprland 1.4.1, pipewire 1.6.9, wireplumber 0.5.18                |
| Screenshots             | grim 1.5.0, slurp 1.5.0                                                              |
| wf-recorder             | **not installed** (`sudo pacman -S wf-recorder`)                                     |
| ffmpeg                  | n9.0.2 with libx264, h264_nvenc, aac; font Inter (fc-match)                          |
| mcpelauncher (Flatpak)  | v1.8.4, Wayland and X11 sockets; the launcher UI runs as a native Wayland client     |

Your `hyprland.lua` notes that `hyprctl dispatch <legacy>` no longer works under the Lua config,
so window changes below are Lua binds, not `hyprctl dispatch` lines.

## 1. Build and deploy a dev build

The trailer scenes are in dev builds only (`main.ts`: `if (!__RELEASE__) registerTrailer();`),
so don't use `build:release`.

```sh
npm run build && npm run deploy
```

Leave and re-enter the world (a `/reload` reloads scripts, enough if only scripts changed). The
build line in chat on join tells you which build is running.

World: a fresh flat or plains world with **cheats on** (`/scriptevent` is an operator command and
needs cheats **(unverified for 1.26.52)**), creative mode, only this add-on, no other resource
packs.

## 2. Game settings

Settings > Video (names on 1.26.52 **unverified**):

- **Field of view:** the scripted shots set their own FOV (`Camera.setFov`) and clear it at the
  end. Your own FOV matters for the first-person shots (`serve`, `guide`) and screenshot 5: use
  about 70.
- **GUI scale:** larger for the `guide` shot and screenshot 5, so the book reads on a phone.
- **View bobbing:** off.
- **Hide hand:** keep the hand visible for `serve` (it's the point of the shot). The free camera
  of the other shots doesn't draw the hand.
- **Smooth lighting, fancy graphics, beautiful skies:** on. Render distance high enough that the
  `finale` pull-back shows land, not fog (12+ chunks).
- **Max frame rate / VSync:** steady 60. Lock the game to 60 when the monitor runs at 144, so the
  60 fps capture doesn't judder.
- Settings > Audio: **music 0**, everything else on. Music comes in the edit.
- Settings > Creator: Content Log GUI off, so errors don't pop up over a take.

The HUD is hidden by the scenes (`setHudVisibility`), except in `guide` and screenshot 5. **Chat
isn't a HUD element** and stays visible: every scene prints its instructions, then waits 5 s
(preroll) before the take starts. If chat lines are still on screen after that, give a longer
preroll: `/scriptevent hk:trailer farm 10`.

## 3. A 1920×1080 game image on Hyprland

PipeWire captures **physical pixels**. The game window has to be 1920×1080 physical pixels, and
the game has to render at that size rather than at a logical size that gets upscaled.

**Docked (DP-1, scale 1), recommended:** float the game window and make it exactly 1920×1080.
Add a bind next to your SUPER + W one in `hyprland.lua` (same API as that bind; **unverified**
that `resize` takes these exact pixels):

```lua
-- SUPER + SHIFT + R : recording size, 1920×1080 physical pixels, centred
hl.bind(MOD .. " + SHIFT + R", function()
	local m = hl.get_active_monitor()
	hl.dispatch(hl.dsp.window.float({ action = "enable" }))
	hl.dispatch(hl.dsp.window.resize({ x = math.floor(1920 / m.scale), y = math.floor(1080 / m.scale) }))
	hl.dispatch(hl.dsp.window.center())
end, { description = "[Custom] recording size 1920x1080" })
```

If `action = "enable"` isn't accepted, use `"toggle"` as your SUPER + W bind does.

**Laptop only (eDP-1, scale 1.5):** the logical screen is 1280×720. Either:

- for the session, change line 67 of `hyprland.lua` to
  `hl.monitor({ output = "eDP-1", mode = "1920x1080@60", position = "0x1440", scale = 1 })`,
  then make the game fullscreen (Hyprland's fullscreen bind). Put the line back afterwards. 60 Hz
  also matches the capture rate. **(unverified:** whether saving the Lua config reloads it
  automatically, as it does for hyprland.conf**)**; or
- keep scale 1.5 and make the game fullscreen. The capture is 1920×1080, but whether the game
  renders at 1920×1080 or at 1280×720 and gets upscaled depends on whether the client is
  fractional-scale aware **(unverified)**. Compare a test frame with the first option before you
  rely on it.

The launcher profile has its own window size (`profiles/profiles.ini`: `windowCustomSize`,
`windowWidth`, `windowHeight`; in the launcher, edit the profile). Under Hyprland the tiling
layout or the bind above decides the size anyway, so leave it off.

**Check the size** before a session: record 2 s and run
`ffprobe -v error -show_entries stream=width,height,r_frame_rate -of csv=p=0 test.mkv`. It must
print `1920,1080,60/1`.

## 4. OBS (recommended)

1. **Source:** Sources > + > **Screen Capture (PipeWire)** for the fullscreen game, or **Window
   Capture (PipeWire)** for the floating window. xdg-desktop-portal-hyprland shows a picker: pick
   the monitor or the game window. Right-click the source > Transform > Fit to screen.
2. **Settings > Video:** Base (canvas) 1920×1080, Output (scaled) 1920×1080, Common FPS 60.
3. **Settings > Output**, Output Mode: Advanced, Recording tab:
   - Type Standard, Recording Format **Matroska Video (.mkv)** (a crash doesn't lose the file).
   - Recording Path: `<repo>/trailer/raw`. **`trailer/` isn't gitignored yet**: never commit raw
     video.
   - Video Encoder: **NVIDIA NVENC H.264**, Rate Control **CQP**, CQ level 16, Preset P5 (Slow) or
     better, Profile high, Keyframe interval 2 s. Without NVENC: **x264**, Rate Control CRF 16,
     CPU preset veryfast (lower if the game drops frames).
   - Audio: 48 kHz (Settings > Audio). Desktop Audio (PipeWire) records the game. Turn off the
     microphone source.
4. Hotkeys (Settings > Hotkeys): Start/Stop Recording on a key the game doesn't use, so you never
   alt-tab during a take. Under Wayland, OBS global hotkeys may not reach OBS while the game has
   focus **(unverified)**. If they don't, bind `obs-cmd` or OBS's WebSocket to a Hyprland key, or
   start and stop from OBS before and after typing the command (the preroll gives you time).
5. **Remux:** `edit-trailer.mjs` reads `.mkv` directly. For sharing a raw clip: File > Remux
   Recordings, or `ffmpeg -i farm.mkv -c copy farm.mp4`.

OBS names files by date. Rename right after each take:

```sh
mv "$(ls -t trailer/raw/*.mkv | head -1)" trailer/raw/farm.mkv
```

## 5. wf-recorder (alternative, not installed)

```sh
sudo pacman -S wf-recorder
wf-recorder --help    # check the flag names below against your version
```

Whole output at 60 fps, with game audio (**flags unverified on this machine**; `-r` is
`--framerate` and `-D` is `--no-damage` in recent versions, which keeps a constant 60 fps when the
picture doesn't change):

```sh
wf-recorder -o eDP-1 -r 60 -D -c libx264 -p crf=16 -p preset=veryfast -a -f trailer/raw/farm.mkv
```

A region instead of an output (logical coordinates; at scale 1.5, 1280×720 logical is 1920×1080
physical):

```sh
wf-recorder -g "$(slurp)" -r 60 -D -c libx264 -p crf=16 -p preset=veryfast -a -f trailer/raw/farm.mkv
```

`-a` takes the default sink's monitor. To pick one: `pactl list short sources`, then
`-a=<name>.monitor`. Stop with Ctrl+C in the terminal (from a second workspace or a bind).

## 6. Per-shot workflow

Once per world:

1. Go to flat open ground near water if you can. Stand where the set's origin should be and
   **face east** (sunrise behind the farm, sunset behind the cake table).
2. `/scriptevent hk:trailer anchor`: saves your position and facing (`hk:trailer.anchor`).
3. `/scriptevent hk:trailer stage`: **clears about 24 × 25 blocks** around the anchor (y 0–5 to
   air, then grass on dirt) and builds the set: farm rows at mixed stages with a water channel,
   chili and strawberry bushes with flowers, the pot on a lit campfire, the board on a counter, the
   cake table with lanterns, a grass patch, a lava strip in a stone basin, and a wall for
   screenshot 6. It reports problems in chat (a block id that didn't resolve).
4. `/hk:debug kit` (items), `/scriptevent hk:trailer list` (scenes and stills).

Per shot (`farm`, `seeds`, `grow`, `berries`, `chop`, `cook`, `simmer`, `serve`, `guide`, `lava`,
`jam`, `cake`, `finale`):

1. Start recording.
2. `/scriptevent hk:trailer <scene>`: chat says the length and what you do. The scene sets time
   and weather, stages what the shot needs, teleports you to your mark with the right hotbar
   (**slots 1–2 are overwritten**), hides the HUD and sets the camera.
3. After the preroll: a short **black flash** (the marker), then the shot. Do the action when the
   picture comes back. In shots with "look locked", your mouse doesn't turn you, so your clicks hit
   what the mark faces even though the camera shows another view.
4. A second black flash, then camera and HUD come back and chat says "done".
5. Stop recording. Save as `trailer/raw/<scene>.mkv`.

`/scriptevent hk:trailer stop` cancels a take at any time and gives everything back. Leaving the
world mid-take is safe; your camera and HUD are reset when you rejoin.

**Continuity:** `cook`, `simmer` and `serve` are one pot. `cook` places a fresh, empty pot; after
it the pot is "ready". Run `simmer` next, then `serve` once it's done (`/hk:debug fast` makes
cooking 1 s; `/hk:debug pot` shows the phase). Seeds (`seeds`) drop 5 % of the time: do several
takes and keep the one where seeds drop.

**Screenshots:** `/scriptevent hk:trailer still <1-8>` holds a still camera (HUD hidden; 5 keeps
the UI) until `stop`. Do the staging the chat line asks for, then capture with OBS (File >
Screenshot) or `grim trailer/stills/1.png` (whole output). On a scale-1.5 screen, grim saves
physical pixels **(unverified)**.

## 7. The edit

`tools/edit-trailer.mjs` expects one clip per scene, named after the scene:
`trailer/raw/<scene>.mkv` (`.mp4`, `.mov` and `.webm` also work). It finds each shot by the first
black marker, so **record from before the command until after "done"** and don't trim by hand.
(Already trimmed clips: `--no-detect`, or set `"offset"` for that shot in `trailer-edit.json`.)

```sh
node tools/edit-trailer.mjs --check                  # edit list vs scenes, no ffmpeg
node tools/edit-trailer.mjs --dry-run                # print the ffmpeg commands
node tools/edit-trailer.mjs --music ~/music/track.wav
node tools/edit-trailer.mjs --music track.wav --only vertical --no-text
```

Output in `dist/trailer/`: `harvest-kitchen-trailer.mp4` (48 s), `harvest-kitchen-trailer-30s.mp4`,
`harvest-kitchen-vertical-15s.mp4` (1080×1920), all H.264 + AAC, 60 fps. Order, trims, crossfades,
captions and the end card's product name and store line are in `trailer-edit.json`. Check a
result with:

```sh
ffprobe -v error -show_entries stream=width,height,r_frame_rate:format=duration -of compact dist/trailer/harvest-kitchen-trailer.mp4
```

## What to look at in the first session

- The camera eases (`setCamera` with `easeOptions`, `InOutSine` and `Linear`): smooth, no jumps
  at keyframes, and the `cake` orbit (7 linear segments) doesn't visibly change speed.
- The black marker (`Camera.fade` with 0 s fade in and out) is fully black for about 0.4 s.
- The HUD is really hidden and comes back after `stop`; the FOV is reset (`/camera @s fov_clear`).
- Board facing on the staged set (blocker B9): if the knife faces the wrong way, re-place the
  board by hand from the actor's mark.
- Whether `stage` places every block (chat lists problems): flowers, lava and the decor ids.
