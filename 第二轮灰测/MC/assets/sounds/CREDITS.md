# Sound Credits

Short sound effects used by the game, acquired from two freely licensed
sources. Every file was downloaded with `tools/fetch-sounds.mjs`, which also
validates the audio magic bytes (`OggS` / `RIFF`) before writing anything to
disk.

Reproduce the download at any time with:

```
node tools/fetch-sounds.mjs
```

---

## 1. Minetest Game (`minetest/minetest_game`)

The bulk of the game's sounds — the Minecraft-like footsteps, dig/break,
place, water, hurt, pickup, explosion and door sounds.

- **Title:** Minetest Game
- **Author:** Minetest Game developers and contributors (see attribution below)
- **Licence:** Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)
- **Licence URL:** https://creativecommons.org/licenses/by-sa/3.0/
- **Upstream repository:** https://github.com/minetest/minetest_game

**Licence note (important).** Minetest Game's media is not all under one
licence. Its `LICENSE.txt` states the media is CC BY-SA 3.0, while
`mods/default/license.txt` additionally lists contributors under CC BY 3.0 and
CC0 1.0. The repository does **not** provide a per-file licence map, so every
sound taken from this source is conservatively credited under **CC BY-SA 3.0**
(the most restrictive licence named for the media). If you redistribute the
game, keep this file (attribution) and note that the sounds may be used under
CC BY-SA 3.0.

**Source paths used:**

| Path | Used for |
| --- | --- |
| `mods/default/sounds/` | footsteps, dig/break, place, splash, hurt, pickup pop |
| `mods/env_sounds/sounds/` | swim (water ambience) |
| `mods/tnt/sounds/` | explode |
| `mods/doors/sounds/` | door open |

**Logical sound → upstream file mapping:**

| Logical sound | Upstream file(s) |
| --- | --- |
| `step_grass` | `default_grass_footstep.1–3.ogg` |
| `step_stone` | `default_hard_footstep.1–3.ogg` |
| `step_wood` | `default_wood_footstep.1–2.ogg` |
| `step_sand` | `default_sand_footstep.1–3.ogg` |
| `step_gravel` | `default_gravel_footstep.1–4.ogg` |
| `step_snow` | `default_snow_footstep.1–5.ogg` |
| `dig_grass` | `default_dig_crumbly.ogg` |
| `dig_sand` | `default_dig_crumbly.ogg` |
| `dig_stone` | `default_dig_cracky.1–3.ogg` |
| `dig_wood` | `default_dig_choppy.1–3.ogg` |
| `dig_gravel` | `default_gravel_dig.1–2.ogg` |
| `dig_glass` | `default_break_glass.1–3.ogg` |
| `dig_wool` | `default_dig_snappy.ogg` |
| `place_generic` | `default_place_node.1–3.ogg` |
| `splash` | `default_water_footstep.1–3.ogg` |
| `swim` | `env_sounds_water.1–4.ogg` |
| `hurt` | `player_damage.ogg` |
| `pop` | `default_dug_node.1–2.ogg` |
| `explode` | `tnt_explode.ogg` |
| `door_open` | `doors_door_open.ogg` |

**Local files from this source:** all `*.ogg` files in `assets/sounds/`
(that is, everything except `click*.wav`).

**Attribution (as listed in Minetest Game's `mods/default/license.txt`):**

CC BY-SA 3.0 — Copyright (C) 2010–2023: celeron55, Perttu Ahola
<celeron55@gmail.com>, Cisoun, G4JC, VanessaE, RealBadAngel, Calinou,
MirceaKitsune, Jordach, PilzAdam, jojoa1997, InfinityProject, Splizard, Zeg9,
paramat, BlockMen, sofar, Neuromancer, Gambit, asl97, KevDoy, Mito551,
GreenXenith, kaeza, kilbith, tobyplowy, CloudyProton, TumeniNodes,
Mossmanikin, random-geek, Extex101, An0n3m0us, Lopano.

The same licence file also names the following under **CC BY 3.0**:
cmusounddesign, Tomlija, lsprice, sonictechtonic, yadronoff, HerbertBoland,
AGFX — and under **CC0 1.0**: Iwan Gabovitch, Ottomaani138, Ogrebane,
blukotek, Sevin7, Yoyodaman234, Ryding.

---

## 2. Kenney UI Audio ("UI SFX Set")

The UI click sounds.

- **Title:** UI SFX Set (Kenney UI Audio)
- **Author:** Kenney Vleugels (Kenney.nl)
- **Licence:** Creative Commons Zero v1.0 Universal (CC0 1.0) — public domain dedication
- **Licence URL:** https://creativecommons.org/publicdomain/zero/1.0/
- **Original asset page:** https://kenney.nl/assets/ui-audio
- **Fetched via (Godot repack, WAV conversion):** https://github.com/Calinou/kenney-ui-audio

**Local files from this source:** `click1.wav`, `click2.wav`, `click3.wav`
(from upstream `addons/kenney_ui_audio/click1–3.wav`).

CC0 means no attribution is required, but credit to Kenney (or kenney.nl) is
appreciated.
