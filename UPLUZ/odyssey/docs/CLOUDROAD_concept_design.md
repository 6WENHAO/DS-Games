# CLOUDROAD (雲路)
### Concept & Design Proposal — a browser-native 3D solo exploration game
**Version 0.1 · Concept Direction Pass · Art Direction + Systems + Web Tech Feasibility**

---

## 0. High Concept

> *You wake on a hill of pale grass beneath a sky where something enormous is still breathing. Nobody explains. You walk toward it.*

**CLOUDROAD** is a wordless, combat-free, failure-free 3D exploration game that runs in a browser tab. A single traveler crosses six continuous landscapes — grassland, dunes, drowned terraces, a cloud sea, a ruin-field, a summit — pulled forward only by things visible on the horizon. The world **responds** to presence: flowers open in a wake behind the player, wind chimes wake as they pass, runes light one at a time along a wall, fog lifts when a bell is rung. Those responses are the narration. There is no dialogue, no HUD, no quest log, no lose condition, and no way to be told what any of it means.

**Target session:** 60–90 minutes for a full traversal; ~15 minutes to a first emotional beat.
**Platform:** desktop + tablet browser, WebGL2 baseline, WebGPU opportunistic. Mobile as a reduced tier.
**Pillars:** *Warmth · Solitude-not-loneliness · The world answers you.*

**Design lineage, stated honestly:** the interaction grammar (a single expressive non-combat "call", traversal-as-narrative, wordless pacing) descends from *Journey* and *Flower*. The visual and tonal register (translucent light, hand-painted foliage, benign giants in the sky, nostalgia over spectacle) descends from Ghibli. We take *language and philosophy*, not assets, characters, or shot-for-shot recreation. Everything below is designed to be built original.

---

## 1. Art Style Definition

### 1.1 The three rules

Every art decision is resolved against these, in order:

1. **Light is the subject.** Geometry exists to catch light. If a shot reads well as a flat value study of 4 tones, it ships; if it needs texture detail to read, it's redesigned.
2. **Everything is slightly translucent.** Leaves, petals, wings, fabric, distant hills, fog, even stone edges. Nothing is fully opaque and nothing is fully matte. This single rule produces most of the "Ghibli" feeling.
3. **Nothing is threatening.** No spikes, no sharp silhouettes, no red, no eyes that stare back, no darkness you cannot see into. Scale can be overwhelming; it is never hostile.

### 1.2 Palette

High-key, low-contrast, warm-biased. Deliberately narrow value range (most of the frame sits between 55–90% luminance) so the few dark accents carry all the drama.

| Role | Name | Hex | Use |
|---|---|---|---|
| Base 1 | Pale meadow | `#C9DFA4` | Grass midtone, dominant field color |
| Base 2 | Sun-bleached green | `#E4EEC0` | Grass highlight, hilltops facing sun |
| Base 3 | Shadow green | `#7FA97E` | Grass in shadow — *never* desaturated grey-green |
| Sky 1 | High blue | `#8FC4E8` | Zenith |
| Sky 2 | Horizon milk | `#E9F2F5` | Horizon band, aerial perspective target |
| Warm key | Butter light | `#FFE3B0` | Direct sunlight tint, bloom color |
| Warm accent | Apricot | `#F2A65A` | Golden hour, lantern glow, response VFX |
| Cool accent | Rune cyan | `#7FD8D2` | Only for *ancient/awakened* things. Rationed. |
| Off-white | Cloud body | `#FBF7EE` | Clouds, cloth, whale belly |
| Deep note | Ink teal | `#2E4A54` | The *only* dark. Cave mouths, doorways, ink of murals |

**Discipline rule:** rune cyan is the world's "memory" color and appears in under 5% of screen pixels at any time. When it floods the frame in Chapter 6, it lands because it was rationed for 70 minutes.

### 1.3 Lighting model

Not physically-based. **Illustrated lighting** — a stylized ramp with three hand-authored bands (shadow / mid / light) and one artist-controlled terminator wrap, plus a strong translucency term.

- **Key:** one directional sun. Never overhead. Held between 12° and 28° above horizon for 80% of the game — long shadows, rim on everything, permanent "late afternoon in memory" feel.
- **Fill:** hemisphere ambient with sky color above and *warm ground bounce* below (`#E8D8B0`), not grey. Ground bounce is the second-most important trick after translucency.
- **Translucency:** cheap wrapped-diffuse back-scatter on all foliage/cloth/wings — `pow(saturate(dot(-L, V)), p) * thickness * warmTint`. Backlit grass glowing amber is the signature shot of the game.
- **Volumetrics:** god rays as a screen-space radial blur from the sun position (cheap), *not* raymarched fog. Additional soft height-fog per-biome with a warm-to-cool vertical gradient.
- **No realtime shadows on small props.** Contact darkening is baked into vertex color / a blob decal. One cascaded shadow map for terrain and hero silhouettes only.
- **No specular highlights** anywhere except water and awakened runes. Specular is what makes stylized worlds look like plastic.

### 1.4 Texture & material philosophy

- **Hand-painted albedo, no normal maps, no roughness maps.** Form comes from silhouette and gradient, not from surface detail.
- Textures painted with visible brush direction that follows the form — long strokes down a cliff face, curling strokes on a canopy.
- **Paper grain overlay** applied in post at ~4% opacity, screen-space, static — one shared 512² tiling texture. It unifies everything into a single illustration and hides banding for free.
- Materials limited to **6 master shaders** total: Foliage, Terrain, Architecture, Cloth/Creature, Water, Emissive-Rune. Anything else is a parameter set, not a new shader. This is a hard technical *and* art-consistency constraint.

### 1.5 Shape language

| Element | Language |
|---|---|
| Terrain | Long S-curves, no straight ridgelines, hills that fold into each other. Slopes readable as walkable at a glance. |
| Trees | Massive trunk-to-canopy ratio (2:1 wide canopies). Canopies as soft clustered blobs, never as individual leaves. |
| Architecture | Round-shouldered arches, tapered towers, weathered edges. Structural logic implied but impossible — a tower with no stair, a bridge to nothing. |
| Creatures | Whale/manta/koi topology. Slow, low-frequency motion. Big volume, small features. No visible mouth. |
| The player | Small, hooded, cloth-heavy, faceless. Occupies ~7% of frame height in the default camera. Smallness is the point. |

### 1.6 Sky & the giants

The sky is 45–60% of every frame. It is authored like a matte painting, not simulated.

- Gradient dome driven by a **1D LUT texture per time-of-day key** — six authored sky states, cross-faded. An artist can repaint the entire mood of the game by editing a 256×1 PNG.
- **Cloud layers:** 3 parallax layers of painted billboard cards + one low-frequency noise-warped plane for the horizon band. No volumetric raymarching (see §5.6).
- **Sky fauna (the landmarks that do the level design):**
  - **The Long One** — a whale-scale creature, 400m, drifts on a fixed 11-minute orbit around the world center. Visible from ~70% of the map. It is the compass.
  - **Drift-rays** — flocks of small manta shapes that pass low over the player at scripted moments, casting a soft moving shadow across the grass. Pure emotional punctuation, zero mechanics.
  - **The Hanging Ruin** — an inverted island with a waterfall that falls *up* into a cloud. It never gets closer. It is the game's unattainable image.

### 1.7 Particles & atmosphere

Always present, never noisy. Global cap: **6,000 live particles**, budgeted per biome.

| Type | Count | Behavior |
|---|---|---|
| Pollen / light motes | 2000 | Local to camera, slow brownian drift, additive, 30% opacity, size 2–5px |
| Petals | 1500 | Emitted by bloom responses, spiral-fall with per-particle phase, alpha-blended |
| Fireflies | 800 | Dusk/night only, pulse at 0.3Hz with random phase, attracted weakly to player at <8m |
| Seed-drift | 600 | Large, slow, backlit — Chapter 2 signature |
| Dust motes in shafts | 1000 | Only inside architecture, spawned in god-ray volumes |
| Spray / mist | 100 | Water contact only |

### 1.8 Camera & composition

- Third-person, orbiting, **slow**. Damped follow (~0.35s), rotation lag, no snap. Camera *breathes* — 0.15° sine drift on two axes, ~0.08Hz.
- FOV 55° default, easing to 68° while gliding (speed sensation), 42° at revelation moments (compression, painting-like).
- **Composition assists (soft, invisible):** when the player stands still for >4s, the camera slowly re-frames toward the nearest landmark, rule-of-thirds aligned. Never wrests control — it's a nudge of ±8°.
- **Vista locks:** at ~14 authored spots, cresting a ridge triggers a 2.5s camera slow-down and a slight FOV pull. The player still has full control; it just *feels* like the game exhaled.

### 1.9 Audio direction (art-adjacent, load-bearing)

- Core instrumentation: solo cello, prepared piano, wooden flute, bowed glass, breath, distant choir (no words).
- **Layered adaptive score**: a 4-stem bed per biome (pad / pulse / melody / air) whose gains are driven by *elevation, speed, and response-density*. Gliding raises the "air" stem; blooming a field raises "melody".
- Silence is a resource. Chapter 4 has ~3 minutes of near-total score absence with only wind and cloth.
- **Diegetic response sounds are the game's voice:** wind chimes (tuned to a pentatonic set so any random collision is consonant), stone-hum on rune activation, a soft bell for the player's call.
- Whispers: heavily processed, non-linguistic vocal fragments, panned in HRTF, ~-24dB, triggered near narrative objects. Deliberately below the threshold of confident comprehension.

---

## 2. Core Gameplay Mechanics

### 2.1 The verb set — deliberately four

| Verb | Input | Notes |
|---|---|---|
| **Move** | WASD / left stick / touch drag | Walk→run analog. Terrain slope affects gait & speed. No sprint button. |
| **Jump** | Space / A / tap | Floaty. Apex hang time 0.35s. Gravity 12 m/s², ~2.2m height. |
| **Glide** | Hold jump in air | Cloth unfurls. Descends at 1.2 m/s, forward 14 m/s. Wind currents give lift. |
| **Call** | E / X / two-finger tap | The whole interaction system. See below. |

That's it. No inventory, no menu, no map, no interact-prompt, no crouch, no combat, no stamina bar. **A player must be able to learn the entire control scheme in 40 seconds with zero text.**

### 2.2 The Call — the game's single mechanic

A soft luminous pulse expands from the player (radius 12m, 0.9s). It is:

- **An emotive act** — hold to charge for a longer, warmer, louder call; tap for a small one. Expressive range with one button, like *Journey*'s chirp.
- **A universal key** — every responsive object in the world listens for the pulse. Nothing else "unlocks" anything.
- **A wayfinder** — dormant responsive objects within 40m emit a single faint answering glimmer ~0.4s after your call. Never a marker, never persistent. It's *echolocation for curiosity*.
- **A recharge** — calling near living things (grass, flowers, trees) returns Bloom (§2.4).

Design intent: the player's only means of affecting the world is *asking politely*. That single framing does more thematic work than any amount of writing.

### 2.3 Response taxonomy

Responses are the narrative delivery layer. They are graded by cost so the world always feels alive but revelation stays rare.

| Tier | Trigger | Example | Frequency |
|---|---|---|---|
| **Ambient** | Proximity, automatic | Grass parts and springs back; flowers turn toward you; a bird lifts | Constant |
| **Touch** | Physical contact | Wind chimes ring; a puddle ripples; seedheads burst | Every ~20s of play |
| **Call-response** | The Call | A flower field blooms outward in a wave; a chime tower answers in a chord; a lantern lights | ~every 60–90s |
| **Chain** | Sequence of calls along a path | Runes light one-by-one down a corridor, each waiting for you to arrive | 2–4 per chapter |
| **World-shift** | Completing a chapter's implicit gesture | Fog lifts across a whole valley; the sky turns; water returns to a dry lake; The Long One changes course | Once per chapter |

**The bloom wake:** the player's continuous, always-on reward. Walking through dormant grass leaves a trail of color and small flowers that persists for ~90 seconds then gently fades. You can look back and see where you have been. This is the single strongest "the world knows you're here" signal, and it costs almost nothing (see §5.4 for the splat-texture implementation).

### 2.4 Bloom — a resource that cannot fail you

Glide is limited by **Bloom**, shown *only* as the brightness and length of the player's cloth — never a bar.

- Bloom depletes while gliding (~14s of continuous glide from full).
- Bloom refills by: passing near living plants, calling near them, standing in a light shaft, or being passed over by sky fauna.
- **At zero, you simply stop gliding and land softly.** No damage, no reset, no failure sound. You walk for a while, the world refills you, you fly again.

The economy teaches the game's thesis mechanically: *life gives you the ability to rise; you gather it by being near things, not by taking them.*

### 2.5 No failure — what replaces it

| Traditional | CLOUDROAD |
|---|---|
| Death | Falling into water/void: a slow fade-to-white, an inhale, you're set down at the last stable ground. ~2s. Reads as a dream-cut, not a punishment. |
| Getting lost | Impossible by design — every point on the map has line of sight to ≥1 landmark. If the player idles >90s, a drift-ray flock passes in the intended direction. |
| Puzzle failure | Puzzles have no wrong state. Rune sequences accept any order; they simply produce different chord voicings. |
| Missable content | Nothing is missable and nothing is required. The world remembers what you found and adjusts the ending's density, not its availability. |
| Timer | None, anywhere. |

### 2.6 Traversal systems

- **Wind currents:** invisible splines with visible tells — bent grass, a curl of petals, a ribbon of mist. Entering while gliding gives lift. The primary vertical mobility. Grass bends *toward the current*, so the terrain itself teaches you to read wind.
- **Slides:** dune faces and grass slopes over 30° become a low-friction slide with a rising cello swell. Pure joy, no risk.
- **Thermals near warm stone:** ruins radiate heat-shimmer and give upward push. Ties architecture to movement.
- **Late-game flight (Chapter 6):** glide converts to sustained flight once the world has "answered enough". Not unlocked by an item — the cloth simply doesn't fall anymore. No notification. The player discovers it mid-jump.

### 2.7 What we deliberately do *not* build

Stated up front so scope doesn't rot: no crafting, no collectible counter, no photo mode UI chrome (a hidden hotkey screenshot is fine), no achievements surfaced in-game, no multiplayer, no companions, no dialogue, no cutscenes with cuts (all "cinematics" are in-engine, in-control camera holds), no tutorial text.

---

## 3. Scene & Emotional Pacing

The world is authored as a **single emotional curve**, not a set of levels. Chapters flow into each other with no loading break (streamed, §5.7).

### 3.1 The curve

```
 arousal
   ▲
   │                                      ╭──╮  Ch6 Ascent
   │                     Ch3 ╭─╮          │  ╰──╮
   │        Ch2 ╭────╮       │ ╰──╮  Ch5 ╭╯     ╰─╮ resolve
   │   Ch1 ╭────╯    ╰───────╯    ╰──────╯        ╰────
   │ ╭─────╯                 Ch4 (trough)
   └─┴──────────────────────────────────────────────────▶ time
     0        15         30        45       60        80 min
```

### 3.2 Chapter breakdown

| # | Place | Minutes | Emotion | Color key | Signature response | Music |
|---|---|---|---|---|---|---|
| 1 | **The Waking Meadow** — endless rolling grass, one distant tower | 0–15 | Curiosity, gentleness, safety | Pale green + high blue, full daylight | First bloom wake; first wind chime | Solo piano, sparse |
| 2 | **The Windward Dunes** — pale gold sand, half-buried arches, hard wind | 15–30 | Exhilaration, scale, first loneliness | Warm sand + bleached sky, sun higher | Slides; wind currents; a buried bell tower rings when uncovered | Cello enters, rhythmic |
| 3 | **The Drowned Terraces** — flooded stone rice-terraces, mirror water, mist | 30–45 | Melancholy, reverence, slowing | Desaturating, first grey-blues, overcast | Calling clears fog in a radius; reflections show the world *before* | Held strings, water percussion |
| 4 | **The Quiet Between** — a cloud sea, almost featureless, near-silence | 45–55 | Loss, doubt, weightlessness | Off-white on off-white, near-monochrome | Almost nothing responds. The world stops answering. | Near-silence. Wind and cloth only. |
| 5 | **The Rememberers** — a ruin-field at golden hour, dense with murals | 55–70 | Recognition, warmth returning, ache | Full apricot golden hour — the warmest frame in the game | Rune chains; the mural sequence; whispers at their densest | Full ensemble, first melody statement |
| 6 | **The Ascent** — vertical flight up through cloud to the summit | 70–85 | Release, awe, peace | Cyan floods the frame for the first time, then dawn | Sustained flight; the whole world blooms below you | Choir enters. Full theme. |

### 3.3 Pacing craft notes

- **The trough is mandatory.** Chapter 4's emptiness is the most important 10 minutes in the game. Without a stretch where the world does *not* answer, Chapter 5's warmth is just more of the same. Playtesters will call Ch4 "boring" in the first pass; hold it, and only tune its *length* (target: the moment before frustration), never its emptiness.
- **Rhythm within each chapter:** ~4 min open traversal → ~2 min dense-response cluster → ~1 min vista/stillness. Repeat. Never two revelation moments back to back.
- **Landmark handoff rule:** the player must be able to see the *next* chapter's landmark before losing sight of the current one. This is the whole navigation design; it is enforced by an editor tool that raycasts landmark visibility from a grid of sample points.
- **Golden-hour discipline:** the sun angle is authored per-chapter, not simulated. Chapter 5 is the only true golden hour. Chapter 6 crosses into dawn — the game's only sunrise, saved for the last 8 minutes.
- **Stillness invitations:** each chapter contains 2–3 places that offer *nothing* to do but are beautiful to stand in (a bench-shaped rock facing a vista, a tree with dappled light). Players will sit in them. Do not put a collectible there.

---

## 4. Narrative Structure

### 4.1 The rule

**No words in the world.** No subtitles, no readable script, no voice you can parse. The story exists in three layers, and a player who engages with only the first still completes an emotional arc.

| Layer | Delivery | Reach |
|---|---|---|
| **L1 — Felt** | Traversal, music, weather, scale, the world's responses | 100% of players. Delivers the *emotional* story: solitude → wonder → loss → warmth → release. |
| **L2 — Read** | Murals, keepsakes, architecture, the Long One's behavior | ~60%. Delivers the *events*: what happened here. |
| **L3 — Inferred** | Whispers, rune arrangements, mural composition details, the ending's variance | ~15%. Delivers the *why*, and never confirms it. |

### 4.2 The story (author's bible — never stated in-game)

*The world once breathed in a rhythm kept by the Long Ones — great sky-creatures whose slow orbits moved the wind, the rain, and the seasons. The people who lived beneath them built nothing to control this; they built instruments. Towers that rang, terraces that sang when flooded, chimes on every ridge. Their entire civilization was a way of listening and answering — a call and response with the sky, sustained for a very long time.*

*Then the answering stopped. Not through catastrophe — through forgetting. Each generation played a little less. The wind slowed. The terraces dried. The last Long One kept its orbit anyway, alone, over a world that had gone quiet, waiting for someone to call back.*

*The player is not a chosen one, a descendant, or a ghost. The player is simply the first thing in a very long time that walked out and made a sound.*

**The ending:** at the summit, the player makes one final call. The Long One answers — the first response it has received in an age — and the world's rhythm resumes: wind returns across all six regions, visible from above as a wave of color crossing the whole map. Then it drifts on. The player is left on the summit at dawn. Nothing is explained. Camera pulls back. Fade to white.

### 4.3 Fragment types

| Type | Count | Content | Placement rule |
|---|---|---|---|
| **Murals** | ~24 | Weathered painted panels, 3–5 figures max, readable in 3 seconds. Each shows one moment of the call-and-response culture. | Always on a wall you pass *along*, never one you must detour to. Lit by a single shaft. |
| **Keepsakes** | ~18 | A child's chime, a worn shoe, a bowl, a carved bird. Approach → it lifts, glows faintly, plays a 2-second sound, settles. | In domestic ruins. Never near a "puzzle". |
| **Whispers** | ~30 | 1–3s processed vocal fragments on the wind. Non-linguistic. | Triggered by proximity + a 45s global cooldown so they stay precious. |
| **Rune walls** | 12 | Sequences that light on Call. The *pattern* of lit runes maps to the mural iconography — the game's only true puzzle-like layer, and it's optional and unmarked. | One per major structure. |
| **The Long One's behavior** | continuous | Its orbit visibly tightens toward the player's position over the game's duration. Almost nobody notices consciously. Everybody feels it. | Systemic. |

### 4.4 Structure & non-linearity

- **Spine + latitude.** The chapter order is fixed (geography enforces it — you descend into the terraces, you climb out into cloud). Within each chapter, the player is free to roam, and 60–80% of fragments are off the direct path.
- **World memory:** the game silently tracks fragments found, fields bloomed, chimes rung, runes lit. This feeds a single float, `resonance ∈ [0,1]`.
- **`resonance` affects the ending's *texture*, not its outcome:** at low resonance, the final world-bloom is sparse and the choir is a single voice; at high resonance, it crosses the entire map and the choir is full. Both are complete. Neither is "the good ending". A second playthrough is rewarded without the first being punished.
- **Total replay hook:** New Game keeps the world identical but starts the Long One on a different orbit phase, so the sky reads differently. That's all. The game is not designed for grinding.

### 4.5 Narrative craft notes

- **Never confirm.** The murals never show the player's character. There is no "reveal" that you are the last person, or a spirit, or the Long One's child. Every player's private theory is more moving than anything we could write.
- **Show culture, not plot.** Fragments depict *ordinary life inside a strange practice* — a family at a chime, children learning a call, a workshop making bells. Ordinariness produces nostalgia; plot produces exposition.
- **One deliberate wound.** In Chapter 5 there is a single mural of a full chime-tower with people, and directly opposite it, through a broken arch, the *real* tower, collapsed and silent. This is the only time the game aims for the heart with a hard edit. Once is enough.

---

## 5. Web Technical Feasibility & Performance

### 5.1 Recommendation: **Three.js** (r160+), WebGL2 baseline, WebGPU as a progressive upgrade path

| Criterion | Three.js | Babylon.js | Verdict |
|---|---|---|---|
| Custom stylized shading | Full control via `ShaderMaterial` / `onBeforeCompile`; the ecosystem *expects* you to write your own | Excellent NodeMaterial + editor, but the PBR-first pipeline fights a non-PBR art direction | **Three** — this game is 90% custom shaders |
| Bundle size (min+gz) | ~150–200 KB with tree-shaken imports | ~600 KB–1.4 MB depending on modules | **Three** — matters hugely for a "click a link and you're in" pitch |
| Built-in engine services (physics, GUI, inspector, asset mgr) | Minimal; you assemble | Batteries included, genuinely excellent | **Babylon** — but we need almost none of them |
| Instanced grass / custom LOD | Manual but unobstructed | Thin-instances are great; slightly more boilerplate to break out of | Tie, edge to Three |
| Post-processing | `pmndrs/postprocessing` (merged-pass, much faster than stock EffectComposer) | Strong built-in chain | Tie |
| Team ramp-up / hiring / examples | Largest ecosystem by far | Strong, smaller | **Three** |

**Decision:** Three.js + [`pmndrs/postprocessing`](https://github.com/pmndrs/postprocessing) + `three-mesh-bvh` (raycast/collision) + `meshoptimizer` + `KTX2`/Basis. We need no physics engine — see §5.9. *Choose Babylon instead only if the team lacks graphics-programming depth and would benefit from NodeMaterial + the inspector more than from bundle size and shader freedom.*

### 5.2 Performance budgets

Target: **60 fps on a 2021 MacBook Air (M1) at 1440×900**, 30 fps floor on a 2020 mid-range Android tablet.

| Resource | Budget | Notes |
|---|---|---|
| Frame time | 16.6 ms → **CPU ≤ 6 ms, GPU ≤ 12 ms** | Leaves headroom for browser compositing & GC |
| Draw calls | **≤ 350** | Hard ceiling; instancing + merging is non-negotiable |
| Triangles | **≤ 1.2 M** visible | Grass is ~60% of this |
| Texture memory | **≤ 220 MB** GPU | All KTX2/ETC1S or UASTC |
| Initial download to playable | **≤ 12 MB gz** | Chapter 1 only; rest streams |
| Full world payload | **≤ 90 MB** | Streamed over ~15 min of play |
| JS heap | **≤ 400 MB** | iOS Safari kills tabs near ~1 GB |
| Shader programs | **≤ 25** | Long compile stalls are the #1 cause of first-minute jank |

### 5.3 Rendering architecture

```
Frame
├── Sim (fixed 60 Hz, decoupled): player, wind field, response state machines
├── Streaming tick (every 250 ms): chunk load/unload, LOD promotion
├── Render
│   ├── Shadow pass    — 1 CSM cascade set (2 cascades, 1024²), terrain + hero only
│   ├── Depth prepass  — OFF on mobile, ON on desktop (grass overdraw killer)
│   ├── Opaque         — terrain → architecture → creatures  (front-to-back)
│   ├── Foliage        — instanced, alpha-test, sorted by chunk distance
│   ├── Sky            — dome + cloud cards, drawn after opaque with depth-test
│   └── Transparent    — particles, god-ray volumes, water, additive VFX (back-to-front)
└── Post (single merged pass via pmndrs/postprocessing)
    └── Bloom(dual-Kawase) → GodRays → ColorGrade LUT → Grain → Vignette → Dither
```

### 5.4 Key systems, concretely

**Terrain — chunked geometry clipmap.** Heightmap authored as a 4096² R16 texture, streamed as 256² tiles. Vertex displacement in the shader; the CPU only manages a ring of ~40 chunk meshes that share **one** geometry per LOD level (5 levels) with per-chunk uniforms. Result: entire terrain = ~40 draw calls, ~180k tris, zero geometry uploads while moving.

**Grass — GPU instancing with per-chunk density.**
```js
// One InstancedMesh per terrain chunk; 3 LOD blade meshes (7 / 3 / 1 tris)
// Positions packed into an InstancedBufferAttribute generated once per chunk
// on a worker, from a blue-noise mask × biome density map.
const grass = new THREE.InstancedMesh(bladeGeo[lod], grassMat, count);
// Vertex shader does: terrain height sample → wind sway → view-facing billboard
// → distance fade → bloom-wake color lookup.
```
- Density: 12 blades/m² at <25m, 4 at <60m, 0 beyond 60m where a painted terrain-detail texture takes over. The transition is hidden by height fog.
- Wind: a single scrolling 256² RG noise texture sampled in the vertex shader, plus a global wind-direction uniform. Gusts are a low-frequency sine on wind strength — no per-blade CPU work, ever.
- **Cost:** ~300k blades visible ≈ 700k tris in ~40 draw calls. This is the single largest budget line and the first thing to cut on mobile (→ 4 blades/m², 90k blades).

**The bloom wake — a splat texture, not objects.** Maintain one 1024² RGBA render target covering a 512m region around the player. When the player moves, splat a soft radial brush into it (one tiny draw call). The grass and terrain shaders sample this texture to drive color, flower-blend, and bend. Cost: **~0.1 ms/frame, one texture.** No per-flower objects, no CPU tracking, infinite trail length, free persistence. This is the highest value-per-millisecond system in the entire game.

**Response system — data-driven, no per-frame scanning.** All responsive objects register into a **spatial hash** (16m cells) at chunk load. A Call queries only the 9 neighboring cells. Each object is a small state machine (`dormant → answering → active → settling`) ticked only while non-dormant. Typical active count: <40. CPU cost is negligible; the trick is simply never iterating the whole world.

**Sky.** Inverted icosphere, single shader, samples a 256×1 gradient LUT (six authored keys, cross-faded by a time-of-day float) + a warped-noise horizon band + sun disc with a fat soft falloff. Cloud cards: ~120 alpha-blended quads across 3 parallax layers, sorted, drawn in ~6 draw calls via instancing. **No volumetric clouds** — they cost 3–6 ms and painted cards look more Ghibli anyway. This is an art win *and* a perf win.

**Sky fauna.** The Long One is ~14k tris with vertex-shader spline animation (no skeleton, no CPU bone math) driven by 3 sine harmonics along its length. Drift-rays are instanced, 400 tris each, phase-offset from one shared animation.

**Water.** Gerstner waves (3 summed) in the vertex shader + a screen-space reflection *fake*: reflect only the sky dome and the 4 nearest hero objects into a 512² planar reflection RT updated at 30 Hz. Full SSR is not worth 2.5 ms here.

**Post-processing.** Use `pmndrs/postprocessing` to merge everything into **one** fullscreen pass. Specifically:
- Bloom via **dual-filter Kawase** at ¼ res (~0.6 ms), not `UnrealBloomPass` (~2.5 ms).
- Color grade via a 32³ 3D LUT — the entire "Ghibli grade" lives in one file the art director owns.
- **Dithering is mandatory**: high-key, low-contrast gradients band severely in 8-bit. A 1-frame ordered dither at the end of the chain fixes it for ~0.05 ms and is the difference between "painting" and "cheap".
- God rays: 24-tap radial blur from the sun's screen position at ½ res, masked by depth. ~0.4 ms.

**Particles.** One `Points` system per type, GPU-simulated via a small ping-pong position texture where behavior warrants it; otherwise fully procedural in the vertex shader from `(instanceId, time)` — zero CPU cost, zero uploads. Texture atlas for all sprites → 1 draw call per blend mode.

**Audio.** WebAudio with 4 looping stems per biome, gain-automated from gameplay signals. HRTF panning only for whispers (expensive); everything else uses cheap equal-power stereo panning. Decode stems as compressed and stream; do not `decodeAudioData` 40 MB up front — that blocks and spikes heap.

### 5.5 Asset pipeline

| Asset | Format | Tooling |
|---|---|---|
| Meshes | glTF 2.0 + **meshopt** compression | `gltfpack` (better than Draco for decode speed on low-end) |
| Textures | **KTX2** — ETC1S for albedo/masks, UASTC for the sky LUT & grade LUT | `toktx` / `basisu` |
| Heightmaps | R16 PNG tiles | Custom exporter |
| Audio | Opus (`.ogg`) 96 kbps stems, AAC fallback for Safari | ffmpeg |
| Chunk manifest | Single JSON, ~40 KB, defines chunk→asset dependency graph | Build script |

**Rule:** every asset ships as a `.ktx2`/`meshopt` pair; PNG/GLB source never reaches production. Texture transcode happens on the GPU-native format, so we never pay a full-res RGBA upload.

### 5.6 Streaming & loading

- **Zero loading screens after the first.** The initial load is Chapter 1 only (~12 MB) behind a single hand-painted title frame with a "click anywhere" gate (also satisfies the WebAudio autoplay policy).
- Chunk loader runs on a **Web Worker** (fetch + meshopt decode + grass instance generation). Main thread only receives transferable ArrayBuffers and does the GPU upload.
- **Upload budget: 2 ms per frame.** Queue GPU uploads and amortize; a single unbudgeted 40 MB texture upload is a 300 ms hitch and it will be the thing playtesters remember.
- **Shader pre-warm during the title screen:** render every material once to a 1×1 offscreen target. Non-negotiable — WebGL compiles lazily on first draw, and a 200 ms stall the first time the player sees water is worse than 3 extra seconds on the title.
- Prefetch the next chapter's chunks when the player crosses a 70%-through trigger volume.

### 5.7 Platform-specific hazards

| Hazard | Mitigation |
|---|---|
| **iOS Safari memory ceiling** (~1 GB tab, aggressive reaper) | Hard-cap texture memory at 140 MB on iOS; unload chapters behind the player; avoid float32 RTs (use half-float) |
| **Safari WebGL2 quirks** — no `EXT_disjoint_timer_query`, patchy `OES_texture_float_linear` | Feature-detect; fall back to half-float linear; do perf telemetry via frame-time sampling instead of GPU timers |
| **WebGPU still uneven** | Ship WebGL2 as the product. Keep a WebGPU renderer path behind a flag for compute-based particles/grass later; do not let it dictate architecture. |
| **Context loss** (tab backgrounded on mobile) | Handle `webglcontextlost`; rebuild from the chunk manifest and restore player transform. Test this deliberately — most WebGL games ship broken here. |
| **Thermal throttling** on laptops/tablets after ~10 min | **Dynamic resolution scaling**: 3-second rolling frame-time average drives a render-scale between 1.0 and 0.65. Never touch grass density at runtime (visible popping); scale resolution instead — post-bloom and the paper grain hide it almost completely. |
| **Autoplay policy** | Single click gate on the title. |
| **60-minute session, no GC discipline** | Object-pool everything per-frame; zero allocation in the render loop; verify with a 90-minute soak test watching heap slope. A leak that costs 3 MB/min is invisible in a 5-minute test and fatal in a full playthrough. |

### 5.8 Quality tiers (auto-detected, user-overridable)

| Tier | Detect | Grass density | Shadows | Post | Res scale | Particles |
|---|---|---|---|---|---|---|
| **High** | Discrete GPU or Apple Silicon | 12/m² | 2 cascades 1024² | Full chain | 1.0 | 6000 |
| **Medium** | Integrated, WebGL2 | 7/m² | 1 cascade 1024² | Bloom + grade + dither | 0.85 | 3000 |
| **Low** | Mobile / low-end | 4/m² | Blob shadows only | Grade + dither only | 0.7 | 1200 |

Detect via `WEBGL_debug_renderer_info` heuristics **plus** a 3-second live benchmark on the title screen, then keep adjusting via dynamic res. Never trust the string alone.

### 5.9 Collision without a physics engine

We need: ground-following, slope limits, wall blocking, trigger volumes. We do **not** need rigid bodies, ragdolls, or stacking. Shipping Rapier/Ammo (300 KB–1.5 MB wasm) for this would be a mistake.

- **Ground:** sample the heightmap texture on the CPU (keep a `Float32Array` copy of the loaded tiles) — O(1) bilinear lookup, no raycast.
- **Walls/architecture:** `three-mesh-bvh` against a low-poly collision mesh (≤2k tris per structure), capsule-vs-BVH sweep. ~0.1 ms.
- **Triggers:** the same spatial hash as the response system, sphere overlaps only.
- **Total cost:** well under 0.5 ms/frame, ~40 KB of code.

### 5.10 Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Grass perf on integrated GPUs | High | Prototype grass **first**, week 1, before any art. It is the load-bearing technical bet. |
| Art style falls apart at low quality tiers | High | Author the Low tier as a *deliberate style* (softer, more painterly, higher fog) rather than as degraded High |
| Chapter 4's emptiness reads as "broken/unfinished" | Medium | Playtest specifically for this; hold the design, tune only its length. Add one non-interactive beauty beat mid-trough. |
| Wordless story reads as "no story" | Medium | L1 (felt) must fully stand alone. Test with players who skip 100% of murals — they should still describe an emotional arc. |
| 90 MB total payload deters casual click-through | Medium | The 12 MB first-chapter gate is the whole answer. Measure time-to-first-input, target <8 s on 20 Mbps. |
| Scope creep into "more mechanics" | High | The four-verb list in §2.1 is a contract. Any new verb must delete an existing one. |

### 5.11 Suggested build order

1. **Weeks 1–3 — Tech risk slice (grey-box):** grass + terrain streaming + character controller + glide + the bloom-wake splat, running at 60 fps on target hardware. No art. **Ship-or-redesign gate.**
2. **Weeks 4–8 — The Vertical Slice:** Chapter 1 complete and beautiful — final shading, sky, one mural, one chime tower, one Long One pass, adaptive music. This is the pitch, the funding artifact, and the style bible all at once.
3. **Weeks 9–16 — Chapters 2, 3, 5** (the response-dense ones), plus the fragment authoring tools.
4. **Weeks 17–20 — Chapters 4 & 6**, the ending, `resonance` wiring.
5. **Weeks 21–24 — Pacing pass, soak testing, quality tiers, mobile, polish.** Reserve the last 3 weeks entirely for pacing tuning based on playtests; that's where this genre is won.

---

## Appendix A — Risk slice: built and measured

Step 1 of §5.11 is implemented and running (see [`../README.md`](../README.md)).
Terrain streaming, grass, the controller, glide, the Call, the response system and the
bloom-wake splat all work at the budgets above. Three assumptions in §5 turned out wrong:

- **Post-processing, not grass, is the frame's largest line item.** §5.4 budgeted ~0.6 ms
  for bloom; the merged post pass measures 2.5–4 ms on an M1. Bloom is nearly free — its
  resolution scale barely moves the total — so the cost is anti-aliasing plus the
  fullscreen blend over the half-float buffer. Grass came in at 2.3–3.3 ms, close to
  estimate.
- **The scene is vertex/draw bound, not fill bound.** Halving the pixel count barely
  changes scene time. §5.7's dynamic *resolution* scaling therefore buys less than assumed;
  the real lever is grass LOD tier distances. Resolution scaling still earns its place
  because it hides thermal throttling, but it is not the primary knob.
- **The High tier's pixel ratio should start at 1.25, not 1.75.** The extra 2 megapixels
  cost ~3 ms and are invisible under bloom, grain and SMAA.

One §5.7-class hazard was hit that the risk register did not name: **MSAA on a half-float
composer buffer renders a black frame** on Chrome/macOS/ANGLE-Metal, silently. The fix is
`multisampling: 0` plus SMAA, which is also cheaper. Add "verify the composer's buffer
format against MSAA on every target driver" to the platform matrix.

Verdict on the §5.11 gate: **pass, with the post chain flagged for optimisation.** At the
shipping defaults the frame costs 8.6 ms of the 12 ms GPU budget, leaving headroom for
the sky fauna, water and architecture that Chapters 2–6 add.

---

## Appendix B — One-page pitch

> **CLOUDROAD.** A browser tab opens onto a hill of pale grass. Above you, something the size of a city drifts slowly across the sky, and it has been alone for a very long time. You cannot fight, you cannot fail, and you cannot be told what any of this means. You can walk, glide, and call out. Everything you pass answers — flowers open behind you, chimes wake on the ridge, runes light one by one down a corridor of ruins. Eighty minutes later you stand on a summit at dawn and make one last sound, and for the first time in an age, something answers back.
>
> *No combat. No failure. No words. Just a very long walk toward something beautiful, in a browser tab.*
