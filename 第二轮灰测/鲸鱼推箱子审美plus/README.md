# Tallgrass

A WebGL meadow rendered as 3D pixel art, and ten crate puzzles played on a mown
plot inside that meadow.

Stage one is the grass shader: tens of thousands of billboard blades in a single
instanced draw call, bending on a 12 fps stop-motion wind, under a stylised HDRI
sky with cloud shadows that sweep across the ground. Stage two is the puzzle: a
low-poly whale shoulders low-poly crates onto chalk marks on a garden plot in the
same world, reached by a camera move across one continuous scene.

---

## Run it

The application code is a set of ES modules, which browsers fetch under CORS
rules that a `file://` page cannot satisfy. Serve the folder over http:

**Windows** — double-click `start.bat`. It serves the folder on
`http://127.0.0.1:8123/` and opens a browser tab.

**Any platform with Node 18+**

```
node tools/serve.mjs 8123      # then open http://127.0.0.1:8123/
```

**Any other static server** works too:

```
python3 -m http.server 8123
npx serve .
```

three.js r180 and the two typefaces are fetched from CDNs by the browser, so the
first load needs a network connection. A static file server is the only
requirement.

### Query parameters

| Parameter | Effect |
| --- | --- |
| `?hdri=meadow` | Uses the Poly Haven CC0 sky `kloofendal_48d_partly_cloudy_puresky_1k.hdr` as the environment. |
| `?hdri=sunset` | Uses `venice_sunset_1k.hdr` from the three.js example assets. |
| `?hdri=quarry` | Uses `quarry_01_1k.hdr` from the three.js example assets. |

Any of these falls back to the generated sky if the fetch fails, and the console
prints which environment was used.

### Controls

The interface opens in Chinese. The switch sits under the title menu and in the
game's button row, and a chosen language is remembered for later visits. Every
panel, the level names, the hints and all shader-lab labels change with it, and
`index.html` carries the Chinese copy inline so the first paint is already in
that language before any module runs.

| Input | Action |
| --- | --- |
| Arrow keys, `WASD` | Move the whale one tile in that screen direction; walking into a crate pushes it |
| `Z`, `Backspace` | Undo one move |
| `R` | Restart the puzzle |
| `Esc` | Close a panel, or return to the title |
| `L` | Open the shader lab |
| `Enter`, `Space` | Start from the title, advance from the solved panel |
| Mouse over the meadow | Parts the grass around the cursor |
| On-screen pad | Appears on touch devices |

---

## What is in the box

```
index.html                  shell, import map, every UI panel
styles/ui.css               chamfered plaque UI, meadow palette
start.bat                   Windows launcher
src/
  main.js                   boot sequence, title/play modes, render loop, shader lab wiring
  core/
    config.js               every tunable: palette, sun, wind, fog, clouds, blade budgets, framings
    env.js                  the shared uniform block + the fixed-capacity actor registry
    renderer.js             low-res half-float target, ACES + palette-quantised composite
    cameraRig.js            orthographic rig with eased framing transitions
  gfx/
    shaderChunks.js         shared GLSL: noise, stepped ramp, cloud shadow, fog, HDRI probe
    grassMaterial.js        the grass/wildflower vertex + fragment shader
    groundMaterial.js       terrain: turf, gravel road, mown checker, dithered blend edge
    toonMaterial.js         trunks, canopies, stones, crates, whale — one shading model
    textures.js             pixel-art atlases written texel by texel
    sky.js                  stylised HDRI generation, ambient probe, sky dome
  world/
    noise.js                deterministic value noise, ridged noise, seeded RNG
    terrain.js              heightfield, road grading, plot levelling, baked lookup fields
    path.js                 road spline, grid-accelerated distance queries
    plot.js                 the plot's rotated frame; every tile position derives from it
    grass.js                instanced blade fields: the meadow and the hedge walls
    trees.js                five procedural species and the planting composition 
    props.js                stones, fence, kerb, stepping stones, signpost, bench
    geoBuilder.js           low-poly kit: merge accumulator, tubes, blobs, cones, chamfered boxes
  game/
    levels.js               ten original boards with their verified push pars
    sokoban.js              rules: parse, move, push, undo, win, corner-lock warning
    play.js                 staging a board on the plot, hop and slide animation
    whale.js                the whale mesh and its hop cycle
    crate.js                crates, goal marks, the crate that rolls down the road
  ui/
    ui.js                   DOM panels, level list, shader lab controls, language switch, touch pad
    i18n.js                 Chinese and English copy, level text, the DOM translation pass
tools/
  verify-levels.mjs         solves every board and checks its structure
  smoke.mjs                 runs the whole build under Node and audits every shader
  locale-runtime.mjs        drives the language switch against a minimal DOM
  markup-default.mjs        checks index.html's inline copy against the default locale
  i18n-report.mjs           lists dictionary keys nothing references
  serve.mjs                 static file server
  three-alias.mjs           maps `three` to a local build for the Node tools
```

---

## Stage one: the grass shader

### Where each technique lives

| Technique | Location |
| --- | --- |
| Instanced rendering, one draw call | `src/world/grass.js` — `BladeBuilder.build()` puts a 1×4-segment quad and four instanced attributes into an `InstancedBufferGeometry`; the medium budget is 34,000 blades and the high budget 68,000 |
| Single-face blade, normals all up | `BladeBuilder.build()` overwrites every base normal with `(0,1,0)`, so the field receives light as one continuous surface |
| Stop-motion wind | `dshStopTime()` in `src/gfx/shaderChunks.js`; `floor(uTime * fps + phase) / fps` with a per-blade `phase` in `[0,1)`, so each blade snaps on its own sub-frame and the field stays alive between ticks |
| Multi-layer noise wind | `grassMaterial.js` vertex stage: three drifting octaves at 1.0/2.37/5.90 scale, a slow gust envelope, and a per-blade flutter term |
| World-space bend about the orthogonal axis | `bendAxis = normalize(cross(up, windDir3))`, applied through `dshRotateAxis()` (Rodrigues) with the angle weighted by `pow(h, uCurvePow)` so the whole spine curves along its length |
| Push-away from moving bodies | `uActors[DSH_MAX_ACTORS]` — a fixed capacity of 8 `vec4` slots (xyz + radius) filled once per frame by the registry in `src/core/env.js`. Each actor rotates the spine about the axis orthogonal to the escape direction. The whale, every crate, the rolling crate and the mouse cursor all occupy slots. |
| Y-axis billboard | `uViewRight`, the camera's horizontal right vector, plus a per-blade yaw jitter. The axis comes from the camera basis, which an orthographic projection shares across the entire frame, so the whole field agrees on one facing. |
| Flatten compensation | The vertex stage transforms the bent tip and the upright tip into view space and compares their screen lengths — exact with no perspective divide. The fragment stage multiplies the sampled V range by that ratio, so the sprite's texels stay square while the quad foreshortens. The slider in the shader lab takes it from 0 to 1 so the difference is visible. |
| Hybrid toon shading | `dshToonRamp(x, steps, soft)` gives N plateaus joined by a soft band. On top of it sit two continuous terms: light transmitted through the blade when the sun is behind it, and a sheen on blades laid over by the wind. |
| Alpha clip | Each sprite row stores its half-width in the atlas alpha channel; the fragment stage turns that into a quantised silhouette and discards outside it |
| Cloud shadows | `dshCloudShadow(worldXZ)` samples a drifting FBM in world XZ and returns a light multiplier. Grass, ground, foliage and props all call it with the same coordinates, so one shadow crosses the whole scene as a single shape — and the sky dome projects a view ray onto the same field, so the cloud overhead and the dark patch on the meadow are the same object. |
| Distance fog | `dshApplyFog()` measures distance from the camera's focus point. Under an orthographic projection every fragment sits at roughly the same camera depth, so focus-relative distance is the quantity that separates foreground from treeline. |

### The rest of the scene

- **Terrain** — three noise octaves plus a ridged rim that lifts the outskirts
  into hills, so the world has no visible edge. The road is graded in with a
  smoothed longitudinal profile and a shallow trench; the garden plot is levelled
  flat. Relief across the basin is about 22 m.
- **Road** — a Catmull-Rom spline baked to a polyline and bucketed into a uniform
  grid, which keeps the ~100k distance queries needed to carve the terrain and
  thin the grass inside a few milliseconds. The road edge dissolves into the turf
  as dithered pixels, breaking up along the shoulder texel by texel.
- **Trees** — five species from one low-poly kit, merged into a single draw call.
  Canopy vertices carry a sway weight and their trunk's world anchor, so canopies
  bend on the same wind clock as the grass. The layout is composed: a framing
  pair around the title view, one specimen on the third line, groves of five and
  three at receding depths, a conifer ridge closing the horizon, understorey
  shrubs tying each mass to the ground, and the road corridor and plot left open.
- **Fog and sky** — the sun sits roughly opposite both cameras, so the meadow is
  lit from behind and the grass shader's transmission term carries light through
  every blade. Under a tilted orthographic camera the ground plane fills the frame
  all the way up, so distance is closed by aerial haze in place of a horizon line:
  about 24% at 20 m from the focus, 52% at 30 m, and 69% at the top of the frame.
  Canopies hold more contrast than the ground beneath them because of the height
  falloff, which is what gives the treeline its depth. The sky dome samples the
  radiance map and blends into that same fog colour at its horizon, so any framing
  that does reach the sky joins up continuously; in the default framings the
  radiance map's visible work is the ambient probe every surface reads.
- **Pixel finish** — the frame renders into a half-float target 288/384/512 px
  tall and is point-upscaled. Exposure, ACES tone mapping, saturation, palette
  quantisation with ordered dithering, and a vignette all happen in that one
  composite pass, which is what gives every surface the same limited-palette
  finish.

### Shader lab

Press `L`, or open it from the title. Every slider writes straight into the
shared uniform block, and the panel reports live blade count, draw calls,
triangle count, internal resolution and frame rate. The draw-call readout is the
quickest way to confirm the meadow is one call.

---

## Stage two: the puzzle

- The title screen is the meadow. A crate tumbles along the road on a loop,
  quarter-turn by quarter-turn, pushing the grass apart as it goes.
- Pressing Play eases the camera from the title framing to the garden plot. It is
  one continuous scene, and the same meshes stay where they are.
- **The plot is the boundary.** Wall tiles are hedge blocks built from the grass
  shader, so the level's collision limit and its silhouette are the same object.
  Floor tiles keep the mown turf, which the ground shader paints with a checker
  in the plot's own frame so the grid reads at a glance. A kerb of stone blocks
  rings the plot, with a gap where the stepping stones come up from the road.
- **The plot is rotated to face the camera.** Its axes line up with the puzzle
  view, so the board reads as an upright rectangle and an arrow key moves the
  whale in exactly that direction, while the terrain, road and treeline keep their
  own angle around it. `src/world/plot.js` owns that frame, taking its basis from
  `cameraRig.groundFrame()`, and terrain levelling, the kerb, the checker and
  every tile position derive from it. The build audit measures the four arrow
  directions through the real camera matrices, so the mapping is asserted rather
  than assumed: a row projects horizontally to within 1e-5 in clip space.
- The whale hops between tiles with squash on the crouch and stretch through the
  arc; crates rock forward as they are shoved and settle with a short bounce. Pose
  is quantised to the same 12 fps clock as the wind, while translation stays
  continuous so pushing feels responsive.
- Undo, restart, per-puzzle move and push counters, a solved panel, and a warning
  when a crate is wedged in a corner off its mark.

### The ten boards

Original designs in the compact single-idea idiom, ordered so each introduces one
mechanic. Push counts are the shortest solutions the bundled solver found.

| # | Name | Size | Crates | Pushes | Teaches |
| --- | --- | --- | --- | --- | --- |
| 1 | First Furrow | 7×5 | 1 | 2 | one push |
| 2 | Corner Bed | 7×6 | 1 | 4 | a corner mark |
| 3 | Around the Stump | 7×6 | 1 | 6 | turning a corner |
| 4 | Two Beds | 9×7 | 2 | 8 | two crates |
| 5 | Two Gates | 9×8 | 2 | 10 | one-tile gaps |
| 6 | The Long Way Round | 9×7 | 2 | 12 | a crate against a wall slides only along it |
| 7 | Far Mark First | 8×8 | 2 | 14 | order of dispatch |
| 8 | The Compost Bay | 9×8 | 2 | 16 | repositioning in a tight room |
| 9 | Three in a Row | 9×8 | 3 | 21 | three crates through one gap |
| 10 | The Whole Plot | 9×7 | 4 | 26 | ordering under pressure |

---

## Asset sources

Everything that ships in this folder was authored for this project. Two CDNs are
resolved by the browser at load time, and three photographic HDRIs are available
on request through a query parameter.

| Asset | Origin | Licence |
| --- | --- | --- |
| Grass, ground, foliage, toon, sky and composite shaders | GLSL written for this project, `src/gfx/` | project code |
| Sky HDRI (default) | Generated at load time by `generateStylizedHdri()` in `src/gfx/sky.js`: banded altitude gradient, sun disc with two halos, three cloud decks, ground-haze hemisphere. A genuine floating-point radiance map — the sun core reaches roughly 320× the sky value — stored as RGBA16F and used both as the visible sky and as the source of the ambient probe. | project code |
| Blade and wildflower sprite atlas | `createBladeAtlas()` in `src/gfx/textures.js`. Six 8×16 sprites with hand-picked palettes, ordered dithering between palette entries, and a per-row half-width profile in the alpha channel. | project code |
| Ground detail masks | `createGroundDetail()`: one tiling 128×128 texture carrying turf grain, broad patchiness, gravel speckle and clover tufts on its four channels. | project code |
| Crate faces and goal ring | `createCrateAtlas()` and `createGoalDecal()`: plank rows, iron banding, rivets, a chevron stamp for a settled crate, and a dashed chalk ring. | project code |
| Trees, shrubs, stones, fence, kerb, signpost, bench | Generated from the low-poly kit in `src/world/geoBuilder.js`. No mesh file is downloaded or bundled. | project code |
| Whale model | Built in code in `src/game/whale.js`: a faceted tube whose radius profile gives the blunt head and tapered tail, plus flukes, pectoral fins, a blowhole, eyes and a mouth wedge. Flat-shaded, vertex-coloured, one draw call. | project code |
| Crate model | `makeChamferBox()` — six inset faces, twelve edge strips, eight corner triangles, with a box-projected UV so the pixel-art atlas maps cleanly and the chamfers pick up its iron border. | project code |
| Puzzle boards | Original designs in `src/game/levels.js`, each verified by `tools/verify-levels.mjs`. | project code |
| three.js r180 | `https://cdn.jsdelivr.net/npm/three@0.180.0/` | MIT |
| Pixelify Sans, Karla | Google Fonts | SIL Open Font License 1.1 |
| `kloofendal_48d_partly_cloudy_puresky_1k.hdr` (optional, `?hdri=meadow`) | Poly Haven, by Greg Zaal — `https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky` | CC0 |
| `venice_sunset_1k.hdr` (optional, `?hdri=sunset`) | three.js example assets, from Poly Haven — served via jsDelivr from the three.js repository | CC0 |
| `quarry_01_1k.hdr` (optional, `?hdri=quarry`) | three.js example assets, from Poly Haven — served via jsDelivr from the three.js repository | CC0 |

### Technique references

- Dylearn, *How I made grass better than 99% of games — Stylized grass 3D pixel
  art* (Godot 4.3). The feature list ported here — stop-motion wind, world-space
  bend, actor push, Y billboard, flatten compensation under a non-perspective
  camera — follows that breakdown. Demo project:
  [DylearnDev/Dylearn-3D-Pixel-Art-Grass-Demo](https://github.com/DylearnDev/Dylearn-3D-Pixel-Art-Grass-Demo).
  Video: [How I made grass better than 99% of games](https://www.youtube.com/watch?v=OxsuWDtjuGw).
  The GLSL in this project is a fresh implementation for WebGL; no Godot shader
  code was copied.
- The puzzle design idiom — compact boards that teach one idea at a time —
  follows the Microban tradition established by David W. Skinner
  ([collection index](http://www.abelmartin.com/rj/sokobanJS/Skinner/David%20W.%20Skinner%20-%20Sokoban.htm)).
  The ten boards here are original designs authored for this project.

---

## Verification

Two Node tools ship with the project. Both exit non-zero on any failure.

### Level solver

```
node tools/verify-levels.mjs
```

Parses every board, checks that it has one player, matching crate and mark
counts, and walls that fully enclose the floor, then solves it optimally by push
count with a normalised-player-zone search and a deadlock filter. It prints the
minimum push count, the minimum move count for that push-optimal line, and the
solution as `uUdDlLrR` so the result can be audited by hand. All ten boards pass
and the push counts rise monotonically from 2 to 26.

### Build audit

```
THREE_PATH=<path to a three package> node tools/smoke.mjs
```

Runs the real application modules under Node against a local three.js build,
which exercises everything except the WebGL device:

1. every module imports and executes;
2. the sky radiance map, ambient probe, sprite atlases, terrain, road, trees,
   props and meadow all build, with assertions on their output — the plot is
   level to within 0.02 m, the basin has 22 m of relief, the road stays clear of
   the kerb, no blade sits on the packed road, no blade root floats off the
   ground, every blade normal points up, and the meadow is a single instanced
   draw;
3. all eight shaders pass a static audit: balanced blocks, no undeclared
   identifier, fragment varyings declared in the vertex stage, every GLSL uniform
   bound to a JS uniform, no duplicate function definitions, and no fragment-only
   builtin leaking into a vertex stage — that last check exists because
   `texture2D` is fragment-only in GLSL ES 1.00, so a shared chunk that leaks one
   into a vertex shader fails to compile even in code that never runs;
4. a feature audit asserts each of the sixteen required grass techniques is
   present in the shipped shader source;
5. the rules layer replays the solver's line for all ten boards, matches the push
   pars, confirms a full undo restores the start exactly, and checks that
   illegal moves are refused without changing state;
6. all ten boards stage inside the plot, no prop geometry lands on the
   playfield, the road runs along the far edge where the entrance is cut, and an
   animated push runs frame by frame to a solved state;
7. each arrow direction is projected through the real camera matrices and checked
   for sign and dominance, and both framings are confirmed to look towards the
   sun;
8. the two locale tables are compared key by key, every key the markup and code
   reference is confirmed to exist, and the inline copy in `index.html` is
   compared string by string against the default locale so the pre-script paint
   cannot drift; the switch is then driven against a minimal DOM, covering the
   Chinese default, interpolation, level text, the translation pass, the pressed
   state, persistence, and a stored choice outranking the default on reload.

`THREE_PATH` is a development convenience only. The browser resolves `three`
through the import map in `index.html`.

---

## Performance notes

The meadow is one draw call at any budget. Measured build times on a desktop
CPU: terrain 0.65 s (31,329 vertices plus three baked lookup fields), meadow
0.03 s, trees 0.05 s, props 0.02 s, sky 0.03 s.

Typical frame content in the title view: the meadow (1 call), terrain (1), trees
(1), props (1), sky (1), rolling crate (1). The puzzle view adds one hedge field
and one call per crate.

Blade budgets are 14,000 / 34,000 / 68,000 and are switchable in the shader lab,
which rebuilds the field. Blades are scattered as tufts with density concentrated
around the two camera framings, so the budget concentrates
inside the two visible framings of the 150 × 150 m world.

## Browser requirements

WebGL2, which every current desktop and mobile browser provides. The radiance
maps ship as RGBA16F because WebGL2 filters half-float textures without an
extension. Shaders are GLSL ES 1.00.
