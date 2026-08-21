# SALTWAKE

An original first-person shooter built to look and play like a cult release from
1997. The setting is Thresher's Reach, a fog-drowned New England port town, on
the night a summoning failed. You work inward from the wharf to the fissure
beneath the town and put back to sleep the thing that answered.

Everything in this folder was written for this project. No engine, no asset
store, no mesh files, no audio files, no image files: the geometry, the textures,
the models, the sounds, the music and the level are all generated in code.

---

## Run it

The game is a set of ES modules, which browsers fetch under CORS rules a
`file://` page cannot satisfy. Serve the folder over http:

**Windows** — double-click `start.bat`. It serves the folder and opens the
browser once the port is actually listening.

**Any platform with Node 18+**

```
node tools/serve.mjs 8130           # then open http://127.0.0.1:8130/
node tools/serve.mjs 8130 --open    # or let the server open the browser
```

`--open` fires from inside the `listen` callback, so the browser is never asked
for the URL before the port answers.

Any static server works too: `python3 -m http.server 8130`, `npx serve .`.
three.js r180 is fetched from jsDelivr by the browser, so the first load needs a
network connection. There is no build step and nothing to install.

Click the canvas to take the lamp. WebGL2 is required.

### Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Shift | Run |
| Space | Jump |
| Ctrl or `C` | Crouch |
| Left mouse | Fire |
| Right mouse | Both barrels, on the shotgun |
| `1` – `6`, wheel | Select weapon |
| `R` | Reload |
| `E` or `F` | Use, read, open |
| Esc | Release the mouse |

Movement is the Quake acceleration model: full speed in a few frames, ground
friction separate from acceleration, and air control at about an eighth of ground
control. Strafe-jumping emerges from those three rules on its own, which is how
the era's engines produced it.

### From the console

`window.saltwake` exposes the live systems. `saltwake.modern(true)` switches the
whole retro chain off — affine warping, vertex snapping, palette quantisation,
scanlines, grain, dither — and raises the internal resolution, which is the
quickest way to see what each part is contributing. `saltwake.modern(false)`
puts it back.

---

## What is in the box

```
index.html                  shell, import map, boot and pause cards
styles/shell.css            page shell: torn-paper cards, pixelated canvas upscale
styles/hud.css              HUD canvas mount and letterboxing
src/
  main.js                   boot, fixed-step loop, render staging, ritual zones
  core/
    config.js               every tunable: palette, grade, fog, movement, weapons,
                            enemies, bake. Carries no renderer dependency.
    grid.js  (in world/)    the authoring format and the global cell grid
    env.js                  shared uniform bus and the dynamic light budget
    renderer.js             low-res target and the retro composite chain
    input.js                keyboard, mouse, pointer lock
    audio.js                procedural synthesis: 65 sounds and the score
  gfx/
    chunks.js               shared GLSL: affine UVs, vertex snapping, per-vertex
                            lights, layered fog, the three-point grade
    textures.js             hand-authored atlases, written texel by texel
    materials.js            world, billboard, actor and viewmodel materials
    models.js               low-poly kit and every enemy and weapon rig
  world/
    grid.js                 cell types, zone compositing, enterability
    build.js               grid to geometry, colliders, and the vertex light bake
    collide.js              cylinder-versus-grid collision and hitscans
    levelData.js            the shipped chapter: six districts as text
  game/
    player.js               Quake movement, health, armour, sanity, camera
    weapons.js              six weapons, viewmodels, recoil, reloads
    enemies.js              six archetypes, flow-field pathing, telegraphs
    fx.js                   billboards, particles, projectiles, gibs
    sanity.js               perceptual decay: phantoms, whispers, tearing
    director.js             pickups, doors, mechanisms, tide, boss, ending
    hud.js                  brass gauges and torn paper on a 320x200 canvas
tools/
  solve-level.mjs           proves the level is completable
  smoke.mjs                 runs the whole game headless and audits every shader
  serve.mjs                 static file server
  three-alias.mjs           maps `three` to a local build for the Node tools
```

---

## The 1997 renderer

The frame is drawn into a target **200 lines tall**, widened to the viewport
aspect so pixels stay square, then point-upscaled. Three techniques do most of
the dating work, and all three are computed in the pipeline itself:

**Affine texture mapping.** Hardware of the period interpolated UVs linearly in
screen space instead of dividing by w, so textures visibly swim as geometry
turns. `swAffineUv()` reproduces it exactly: the vertex stage passes `uv * w` and
`w` as separate varyings, and dividing them in the fragment stage cancels the
rasteriser's perspective correction, leaving `sum(lambda_i * uv_i)` — screen-linear
UVs. `uAffine` blends between correct and period behaviour.

**Vertex snapping.** Vertices were transformed to integer screen coordinates, so
surfaces jitter and seams crawl. `swSnapVertex()` quantises clip-space XY onto the
low-resolution lattice, guarding geometry behind the eye so clipping still works.

**Per-vertex lighting.** There were no per-pixel lights. Illumination is baked
into vertex colours at load, with a stepped occlusion test against the grid, and a
budget of eight dynamic lights is evaluated per vertex on top. Falloff uses a
half-lambert wrap, which is why the era's lighting looks soft and blotchy rather
than physically correct. Muzzle flashes, burning enemies, the flamethrower cone,
projectiles in flight and the boss's conduits are all real lights submitted to
that budget each frame; the nearest ones win.

The composite pass then runs, in this order: ACES-ish tone map, three-point grade,
sRGB encode, palette quantisation to 15 steps per channel with ordered dithering,
scanlines, interlace dropout on alternate frames, quantised film grain, vignette.
The order matters — grading before quantisation means the limited palette is
chosen from graded colours, which is what makes the image cohere instead of
looking like a filter dropped on top.

Deliberately absent: bloom, depth of field, chromatic aberration, motion blur and
any large-radius blur. Enemies, projectiles, doors and pickups have to stay
readable at 200 lines, and the build audit asserts none of those passes exist.

**Billboards** are quantised twice over. Facing is snapped into 16 yaw buckets and
only refreshed 10 times a second, with a one-bucket dither on alternate snap
frames, so vegetation visibly clicks round as you circle it. On top of the shared
vertex snapping they carry an extra sub-pixel wobble, because sprites were the
worst offenders for this on real hardware. Alpha is cut, never blended.

**Stop-motion animation.** Every enemy and weapon rig is posed from a quantised
clock — 8 fps for enemies, 6 for the boss, 12 for the hands. Poses are held, never
blended. The curves are shaped for weight: a long slow windup, a two-frame snap,
then a recovery that overshoots. View bob, weapon sway and recoil decay all run on
the same clock, so the whole frame ticks together.

**Fog** stacks four terms: a squared distance term for the wall
of sea fog, a height term that pools mist in the streets, a slow breathing noise so
the wall is not a fixed radius, and a directional bleed towards the moon. Sanity
widens the breathing, so the world feels less fixed as you come apart.

---

## Weapons

| Slot | Weapon | Ammo | Job |
| --- | --- | --- | --- |
| 1 | Tidewatch Revolver | brass | Six rounds, accurate at any range the fog allows |
| 2 | Harbourman's Double | shell | Two shells, or both at once with right mouse |
| 3 | Whaling Harpoon Gun | iron | One shaft; pins light enemies to the wall behind them |
| 4 | Alchemist's Censer | oil | Sustained cone, and it sets things burning |
| 5 | The Unlidded Focus | ichor | Fires through walls, and takes sanity every time |
| 6 | Leviathan Bone Ordnance | bone | Splash, after a visible wind-up |

## Enemies

Every one has a telegraph, an exaggerated wind-up pose with its own sound, an
active window of two frames where damage lands, and a recovery it cannot cancel.
Each has a weakness that changes how you spend ammo, and a silhouette built from
a few chunky masses so it survives being forty pixels tall in fog.

| Enemy | Silhouette | Weakness |
| --- | --- | --- |
| Drowned Hauler | Hunched, one overgrown arm dragging a gaff hook | Headshot, ×2.6 |
| Grafted Choirman | Tall, robed, ribcage opened outward like a lectern | Flame, ×2.2 (resists bullets) |
| Trench Crawler | Low and wide, flat to the floor, too many joints | Splash, ×1.9 |
| Vitreous Choir | A drifting cluster of wet spheres, no limbs | One harpoon bursts it |
| The Wearer | A person's outline worn slightly wrong, seams at the shoulders | The focus, ×2.4 |
| Firstborn of the Sounding | Never fully in frame; a shoulder, a limb | Armoured until its three conduits are shot out |

The boss fight is a puzzle before it is a damage race. Three brass conduits are
modelled on its body and each carries its own pulsing light, so the target is
visible on the body itself. Fire anywhere else and the shot rings off the
plates. As each conduit goes dark the silhouette shading thins by a third, so the
shape becomes more legible the closer it is to dying.

## Sanity

Sanity falls near horrors that can see you, every time the focus fires, and simply
by standing in the altar, the ruins or the fissure. It recovers slowly once
nothing is looking at you.

The rule the system obeys: **it changes what you perceive, never what you
control.** No forced turns, no dropped weapons, no inverted input. What it does
instead, in tiers: the HUD dial drifts and the fog breathes harder; whispers
arrive from positions where nothing is standing; phantom figures appear at the
edge of vision and dissolve if you look straight at them; the image tears along
scanlines, the horizon tips, and the engraved numbers on the sanity dial corrupt.
Every effect is a lie about the world; the world underneath stays exactly as it
was, and you can always settle the question by shooting.

---

## The level

One chapter, six districts, composited from text grids into a single global cell
grid 53 × 83 cells across — about 159 × 249 metres, 1824 walkable cells.

| District | Walkable cells | What it is |
| --- | --- | --- |
| docks | 311 | Abandoned wharf under open sky, moonlight, long piers |
| sewer | 286 | Outfall tunnels; wading depth, a valve that moves the water |
| victorian | 291 | A subsiding street of townhouses on multiple levels |
| altar | 332 | The ritual chamber under the church, hazard floor |
| ruins | 355 | Cyclopean structure with deliberate scale confusion |
| rift | 249 | Where the town gives out and the fissure begins; the boss arena |

Progression is gated by three keys in a closure the validator proves: **brass**
opens the way off the docks, **bone** the church, **sigil** the fissure seal.
There are two mechanisms, three secrets behind `S` cells, nine readable notes, a
rising tide, and a goal at the fissure edge.

Streets lean without breaking anything. The playable grid is axis-aligned, because
a rotated grid would make collision ambiguous at every zone seam; the tilt comes
from rotated decorative geometry with a `roll` parameter, and from a persistent
per-district view roll — the Victorian blocks tip the horizon by 0.04 radians, the
fissure by 0.065.

### Authoring format

Zones are text. `plan` gives one character per cell: `#` solid, `.` floor, `~`
water, `^` hazard, `+` door, `S` secret door, `=` catwalk, `o` pit, space for
nothing. Optional `height` and `ceil` grids give a hex digit per cell, raising the
floor or ceiling by that many 0.4 m steps — a run of increasing digits is a
staircase, and a large `ceil` digit is how the ruins get their scale confusion.
The format is documented in full at the top of `src/world/grid.js`.

---

## Audio

Every sound is synthesised at runtime; nothing is fetched or embedded. 65 named
sounds plus a scheduled score, from `OscillatorNode`, procedurally filled noise
buffers, biquads, waveshapers, delays and a procedurally generated convolution
impulse.

Gunshots are layered: a noise burst, a pitched-down body, hard waveshaper
clipping, and a short feedback-delay tail. Wet flesh is filtered noise with a
fast pitch-dropping bandpass. Metal is an inharmonic partial stack ringing down
through parallel bandpasses. The chanting and the reversed voice are built from
filtered sawtooth partials with a vowel filter sweep and a reversed envelope, and
the layers run at slightly different rates so they never phase-lock.

The score is industrial: a low drone, a broken percussion pattern from noise and
metallic hits, and a retro synth motif in a phrygian-flavoured scale. Intensity
follows how many awake enemies are near you, raising tempo, adding percussion
layers and opening the filter. It stays wordless and oppressive at every level.
Voices are capped at 24 with quietest-oldest eviction, buffers and impulses are
generated once, and the score is scheduled with a lookahead against
`ctx.currentTime`, on a lookahead window. A missing or blocked `AudioContext`
degrades to no-ops and the game still runs.

## HUD

A strip of water-stained torn paper with brass instrument gauges riveted to it,
drawn on its own 320 × 200 canvas with a hand-authored bitmap font and upscaled
with `image-rendering: pixelated`. The health gauge's needle jitters when health
is low and its glass cracks past half damage. The sanity dial is the interesting
one: as sanity falls the engraved numbers on the dial face corrupt into wrong
glyphs, the needle overshoots, and a hairline of static crawls across it. Paper
grain, stains and brass hatching are generated once from a seeded PRNG and cached;
animation is quantised to about 12 fps.

---

## Asset provenance

| Asset | Origin | Licence |
| --- | --- | --- |
| All GLSL: world, billboard, actor, viewmodel, composite | Written for this project, `src/gfx/`, `src/core/renderer.js` | project code |
| World texture atlas | `createWorldAtlas()` in `src/gfx/textures.js`. Sixteen 64×64 tiles packed into one 256×256 image, each painted texel by texel with a hand-picked four-to-six colour ramp and ordered dithering: rotting dock planks, wet brick, barnacled stone, riveted iron, glazed sewer tile, cyclopean ruin, a wall that is not masonry, choir tapestry, wet cobbles, sludge channel, ritual mosaic, tidal silt, sagging beams, vault stone, brass door, bone door. | project code |
| Billboard sprite atlas | `createSpriteAtlas()`: reeds, dead weeds, seagrass, flame, smoke, hanging net, a figure in the fog, ritual candle. Alpha-cut, authored base-up. | project code |
| Enemy and weapon models | `src/gfx/models.js`. Six enemy rigs and six weapon viewmodels built from boxes, wedges, tapered tubes and jittered icosahedral blobs, flat-shaded with per-facet vertex colour. No mesh file is downloaded or bundled. | project code |
| Level | `src/world/levelData.js`, authored as text grids. | project code |
| Sound and music | `src/core/audio.js`, synthesised at runtime. No audio file is downloaded or bundled. | project code |
| HUD artwork | `src/game/hud.js`, drawn into a canvas with a hand-authored bitmap font. | project code |
| three.js r180 | `https://cdn.jsdelivr.net/npm/three@0.180.0/` | MIT |

No characters, creatures, place names, level layouts or assets are taken from any
existing published work. The cosmic-horror register is a genre; the specific
town, cult, entity, weapons and monsters here are original to this project.

---

## Verification

Two Node tools ship with the game. Both exit non-zero on any failure.

### Level solver

```
node tools/solve-level.mjs --verbose
```

Composites the grid without a renderer, then:

1. **Structure** — every zone parses, every door sits on a door cell, no entity is
   embedded in a wall, the spawn is standable, and every key a door needs exists.
2. **Key-gated reachability** — breadth-first flood from the spawn with the current
   key set, collecting keys as they are reached and repeating until the set stops
   growing. This lock-and-key closure proves the level is *finishable*: it walks the
   actual gates in the actual order, which is what catches a key placed behind
   the door it opens.
3. **Progression** — the route from spawn to goal, and the order in which keys
   become available.
4. **Budget** — walkable area, all six archetypes present, available damage against
   total enemy health, healing, secrets, mechanisms, a boss, and a playtime
   estimate.

Current result: 1824 walkable cells, a 111-cell route to the goal, key closure
`brass → bone → sigil`, all six archetypes, an ammo ratio of 3.11, 350 health
across 10 pickups, 3 secrets, 2 mechanisms, and a 29.3 minute estimate.

### Build audit

```
THREE_PATH=<path to a three package> node tools/smoke.mjs
```

Runs the real game modules under Node against a local three.js build, exercising
everything except the WebGL device and the DOM:

1. Every module imports and executes, and `config.js` is confirmed free of any
   renderer dependency so the headless tools can read it.
2. The atlases build with real spatial structure per tile, the world geometry
   builds as a single draw call with per-face atlas rects, and the light bake is
   audited **per district** — no district unlit, every district holding lamp-lit
   surfaces to navigate by.
3. Every shader passes a static audit: balanced blocks, no undeclared identifier,
   fragment varyings declared in the vertex stage, every GLSL uniform bound to a
   JS uniform, no duplicate function definitions, and no fragment-only builtin
   leaking into a vertex stage. That last check exists because `texture2D` is
   fragment-only in GLSL ES 1.00, so a shared chunk that leaks one into a vertex
   shader fails to compile even in code that never runs.
4. A feature audit reads each period technique out of the shipped shader source,
   so the check tracks the GLSL that runs and not a config flag, and confirms the
   composite contains no bloom, blur or chromatic pass — checked against code with comments stripped, since
   the file's own header names the effects it leaves out.
5. Thirty seconds of simulation at a fixed 60 Hz tick with a scripted patrol: the
   player walks, sprints, strafes, jumps, crouches, fires, reloads and cycles
   weapons while 46 enemies path and attack. It asserts nothing throws, the player
   stays inside the level and never falls through the floor, ammo is consumed, the
   particle pool stays bounded, and the dynamic light budget holds.
6. Combat correctness: the headshot weakness multiplies and a body shot does not,
   flame beats a choirman while bullets are resisted, one harpoon bursts an eye
   cluster, the boss is immune away from its conduits, shooting all three conduits
   opens it up, and it then takes damage.
7. Collision: 400 trials of a single 240 m/s step into walls from different angles,
   asserting zero escapes.

`THREE_PATH` is a development convenience only. The browser resolves `three`
through the import map in `index.html`.

---

## Performance

The level is one draw call: 92,888 triangles from a single buffer against one
packed atlas. Static vegetation is a second instanced call, fires a third,
particles a fourth. Enemies are one call each, which is what the period did.

Build cost at load, measured on a desktop CPU: world atlas 19 ms, sprite atlas
4 ms, geometry and light bake 211 ms.

The internal buffer is 200 lines by default; `RENDER.heights` also offers 168, 240
and 300 for slower and faster machines.
