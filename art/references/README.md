# Art references (study only)

Third-party textures we study for quality, never copy (`docs/harvest-kitchen/art-style.md`
"Reference study"). Everything they produce lives in `mods/`, which is gitignored: never
commit it, never copy a file from it into `packs/` or `art/harvest_kitchen/`, and keep it out of
any build.

## Setup

```sh
cd art/references/mods
mkdir -p jars && cd jars
# latest releases on Modrinth (versions studied on 2026-10-23)
curl -sSLO https://cdn.modrinth.com/data/R2OftAxM/versions/XTVZDOol/FarmersDelight-1.21.1-1.3.4.jar
curl -sSLO https://cdn.modrinth.com/data/LNytGWDc/versions/UjX6dr61/create-1.21.1-6.0.10.jar
cd ..
# Croptopia isn't on Modrinth and has no release jars on GitHub: textures from its source
git clone -q --depth 1 --filter=blob:none --sparse \
  https://github.com/ExcessiveAmountsOfZombies/Croptopia.git croptopia-src
git -C croptopia-src sparse-checkout set --no-cone \
  common/src/main/resources/assets/croptopia/textures/item/ \
  common/src/main/resources/assets/croptopia/textures/block/
mkdir -p tex/farmersdelight tex/create tex/croptopia
unzip -q jars/FarmersDelight-*.jar 'assets/farmersdelight/textures/item/*' \
  'assets/farmersdelight/textures/block/*' -d tex/farmersdelight
unzip -q jars/create-*.jar 'assets/create/textures/item/*' 'assets/create/textures/block/*' -d tex/create
cp -r croptopia-src/common/src/main/resources/assets tex/croptopia/
# 8-bit RGBA copies (our PNG reader skips palette PNGs below 8 bits)
for m in farmersdelight create croptopia; do for d in item block; do
  mkdir -p rgba/$m/$d
  for f in tex/$m/assets/$m/textures/$d/*.png; do
    magick "$f" PNG32:"rgba/$m/$d/$(basename "$f")"
  done
done; done
```

Then `node tools/ref-sheet.mjs` writes the sheets and metrics into `mods/sheets/`.
