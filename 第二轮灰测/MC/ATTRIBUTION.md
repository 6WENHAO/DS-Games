# Attribution / 资源来源与许可

WebCraft's **code** is MIT licensed. The **art and audio** come from public,
freely licensed asset sources and remain under their own licences, listed
below. No official Minecraft asset files are included or redistributed.

本项目**代码**使用 MIT 许可。**美术与音效**取自公共免费素材站，
沿用各自的原始许可（见下）。项目不包含、不分发任何 Minecraft 官方资源文件。

---

## 1. Block, item, GUI and entity textures — Pixel Perfection CE

Every texture under `assets/textures/` comes from this single pack, which
follows vanilla naming conventions and is drawn at the native 16×16
resolution.

| | |
| --- | --- |
| **Title** | Pixel Perfection CE (Community Edition) |
| **Original author** | XSSheep (original *Pixel Perfection* pack) |
| **Maintainer** | Athemis and Pixel Perfection CE contributors |
| **Licence** | **CC BY-SA 4.0** — Creative Commons Attribution-ShareAlike 4.0 International |
| **Licence URL** | https://creativecommons.org/licenses/by-sa/4.0/ |
| **Upstream** | https://github.com/Athemis/PixelPerfectionCE |
| **Files used** | 361 PNGs — see `assets/manifest.json` for the exact list |

Downloaded with `tools/fetch-assets.mjs`, which resolves each name against the
upstream git tree (so a rename is reported rather than silently 404-ing) and
verifies PNG magic bytes before writing.

```
node tools/fetch-assets.mjs           # fetch anything missing
node tools/fetch-assets.mjs --force   # re-fetch everything
node tools/fetch-assets.mjs --report  # dry run
```

**Breakdown of what is used**

| Local folder | Count | Purpose |
| --- | --- | --- |
| `textures/blocks/` | 226 | terrain, ores, plants, fluids, break-crack stages |
| `textures/items/` | 89 | inventory item sprites |
| `textures/gui/` | 8 | hotbar, HUD icons, inventory / crafting / furnace windows |
| `textures/entity/` | 10 | mob and player skins |
| `textures/environment/` | 5 | sun, moon phases, clouds, rain, snow |
| `textures/particle/` | 18 | particle sheet and individual sprites |
| `textures/font/` | 1 | `ascii.png` bitmap font sheet |
| `textures/colormap/` | 2 | grass and foliage biome colour maps |
| `textures/misc/` | 2 | underwater and pumpkin overlays |

**Because the pack is ShareAlike:** if you redistribute WebCraft with these
textures, the texture files (and any modifications you make to them) must stay
under CC BY-SA 4.0, and this attribution must be preserved.

WebCraft derives two kinds of texture at load time, which are therefore also
CC BY-SA 4.0 derivatives:

- **Per-biome grass sides** — `grass_block_side` composited with
  `grass_block_side_overlay` multiplied by each biome's grass colour
  (see `src/gfx/textures.js`).
- **Inventory icons** — isometric cubes assembled from each block's own faces
  (see `src/ui/icon-atlas.js`).

---

## 2. Sound effects

Two sources; the full per-file mapping lives in
[`assets/sounds/CREDITS.md`](assets/sounds/CREDITS.md).

### 2a. Minetest Game

| | |
| --- | --- |
| **Title** | Minetest Game |
| **Authors** | Minetest Game developers and contributors (full list in `assets/sounds/CREDITS.md`) |
| **Licence** | **CC BY-SA 3.0** — Creative Commons Attribution-ShareAlike 3.0 Unported |
| **Licence URL** | https://creativecommons.org/licenses/by-sa/3.0/ |
| **Upstream** | https://github.com/minetest/minetest_game |
| **Files used** | 49 `.ogg` files: footsteps, dig/break, place, splash, swim, hurt, pickup, explode, door |

*Licence note:* Minetest Game's media is a mixture of CC BY-SA 3.0, CC BY 3.0
and CC0 1.0 with no per-file map, so every file taken from it is conservatively
credited under the most restrictive of those, CC BY-SA 3.0.

### 2b. Kenney UI Audio

| | |
| --- | --- |
| **Title** | UI SFX Set (Kenney UI Audio) |
| **Author** | Kenney Vleugels — https://kenney.nl |
| **Licence** | **CC0 1.0 Universal** (public domain dedication) |
| **Licence URL** | https://creativecommons.org/publicdomain/zero/1.0/ |
| **Files used** | `click1.wav`, `click2.wav`, `click3.wav` |

CC0 requires no attribution; credit is given because it is deserved.

---

## 3. Sources evaluated and not used

Recorded for transparency, since the asset search is part of the build:

- **malcolmriley's Unused Textures** (OpenGameArt, CC0 / CC-BY 4.0) —
  2116 high-quality 16×16 textures, but named for a modded block set rather
  than vanilla, so it could not supply `grass_block_top`, `cobblestone`,
  `water_still` and friends.
- **Kenney Voxel Pack** (CC0) — 3D models rather than block face textures.
- **Admurin's Blocky Life** (CC BY 4.0) — isometric sprite tiles, not
  cube-face textures.
- **Minetest Game default textures** (CC BY-SA 3.0) — a viable fallback, but
  Pixel Perfection CE matches vanilla naming and proportions far more closely.

---

## 4. Licence summary

| Component | Licence |
| --- | --- |
| WebCraft source code (`src/`, `server/`, `tools/`, `start.bat`) | MIT |
| `assets/textures/**` | CC BY-SA 4.0 (Pixel Perfection CE) |
| `assets/sounds/*.ogg` | CC BY-SA 3.0 (Minetest Game) |
| `assets/sounds/click*.wav` | CC0 1.0 (Kenney) |

### MIT licence (code only)

```
Copyright (c) 2025 WebCraft contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 5. Trademark notice

*Minecraft* is a trademark of Mojang Synergies AB / Microsoft. WebCraft is an
independent, non-commercial tribute implementation. It is not affiliated with,
endorsed by, or derived from Mojang or Microsoft source code or assets.

*Minecraft* 是 Mojang Synergies AB / Microsoft 的商标。
WebCraft 是一个独立、非商业的致敬性实现，与 Mojang / Microsoft 无关，
不派生自其源代码或资源文件。
