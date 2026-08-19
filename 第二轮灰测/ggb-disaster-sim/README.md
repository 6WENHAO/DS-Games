# Golden Gate Bridge · Cinematic Disaster Simulator

金门大桥电影级灾难模拟器 — **Three.js r180 + Rapier3D (Wasm)**, a procedurally
built, *pre-fractured* Golden Gate Bridge with four disaster modes, a free
cinematic camera, a full day/night + storm atmosphere system, and a WebGL2
post-processing chain (god rays, selective bloom, screen-space shockwaves,
temporal motion blur, chromatic aberration).

```bash
npm start          # or:  python -m http.server 5173   →  http://localhost:5173
```

> ES modules + importmap, no bundler, no install. **WebGL2 required.**
> An optional WebGPU/TSL ocean demo lives at `webgpu-ocean.html`.

---

## 1 · Module architecture

```
index.html              importmap (the ONLY place CDN pins live) + boot shell
src/
  config.js             single source of truth: world scale, tuning, palette
  main.js               composition root + the master loop (order matters, see below)
  core/
    Engine.js           renderer, scene, camera, post-FX wiring, adaptive resolution
    Clock.js            SimClock (scaled dt = global slow-motion/pause) + fixed-step accumulator
    CinematicCamera.js  damped orbit, 10–3000 m stepless zoom, click-to-focus, shake-safe rig
    PhysicsWorld.js     Rapier wrapper: static-until-activated bodies, water, budgets, impulses
  world/
    Bridge.js           deck/towers/cables/piers; assembles + registers all 406 chunks
    Fracture.js         2D Voronoi + prism extrusion (deck), jittered box rubble (towers)
    BatchedRigidMesh.js GPU rigid-body skinning: N chunks → 1 draw call (see §4)
    Cables.js           Verlet ropes (main cables) + instanced suspenders
    Ocean.js            Gerstner sea + tsunami soliton, CPU/GPU dual evaluator
    Sky.js              time-of-day → sun, lights, fog, god-ray coupling
    Terrain.js          Marin/SF landmasses, Fort Point, instanced skyline
  disasters/
    DisasterDirector.js scheduler + shared DI context; resets the whole world
    Earthquake.js       staged timeline: sway → cable whips → deck peel → tower tops
    Tsunami.js          travelling soliton, staged tower/deck interaction
    Meteor.js           entry trail → detonation (impulse+heat+shockwave) → aftermath
    Monster.js          aimable strikeAt(point) + claw swipes + footfall pressure waves
  shaders/
    skyCommon.glsl.js   ONE shared atmosphere function (dome AND ocean reflections)
    sky.glsl.js  ocean.glsl.js  shockwave.glsl.js  godrays.glsl.js
    grade.glsl.js  particles.glsl.js
  vfx/
    ParticleSystem.js   4 GPU pools (fire/smoke/splash/spark), analytic motion
    CameraShake.js      trauma model → offset/roll/motion-blur/aberration
    PostFX.js           composer chain + isolated-layer selective bloom + GradePass history
  ui/Controls.js        operator panel + HUD (stats, time, weather, snapshots)
  webgpu/OceanTSL.js    the same Gerstner ocean in TSL (WebGPU path demo)
```

### The master loop (frame order is a design decision)

```
clock → director → physics → bridge/cables → sky → ocean → particles
      → shake (REAL dt) → camera (REAL dt) → postfx state → render
```

- Anything that *consumes physics* runs after physics; anything that *reads the
  camera's final matrices* (sun projection for god rays) runs after the camera.
- Shake and camera damping consume **unscaled** dt so the operator never enters
  slow motion — slow-mo applies to the *world*, not the cinematographer.

---

## 2 · Custom shaders (GLSL)

| Shader | What it does |
|---|---|
| `skyCommon.glsl.js` | One analytic sky (zenith/horizon × sun elevation, real Rayleigh/HG phase functions, bounded by design). Consumed by the dome **and** the ocean reflection → horizon/glitter can never disagree. |
| `ocean.glsl.js` | 6 Gerstner waves with analytic tangent/binormal normals + an asymmetric **tsunami soliton** term; Fresnel reflection of the shared sky, sun transmission, crest/wall foam, aerial-perspective fade. |
| `shockwave.glsl.js` | Screen-space blast front: ring-shaped radial UV displacement with a signed lobe (a *lens*, not a smear), per-channel dispersion, turbulent heat shimmer inside the swept volume. 3 concurrent fronts, aspect-corrected. |
| `godrays.glsl.js` | 48-tap radial occlusion blur anchored on the projected sun; bright-pass self-occlusion carves real shadow shafts from the towers for free. |
| `grade.glsl.js` | One fused final pass: temporal motion blur (previous-frame history), radial chromatic aberration, vignette, animated grain, contrast/saturation — four effects, one framebuffer round-trip. |
| `particles.glsl.js` | Per-kind analytic particles (fire/smoke/splash/spark): closed-form ballistic motion with linear drag, blackbody fire ramp, fbm smoke. |
| `BatchedRigidMesh` patch | Injected into `MeshStandardMaterial` via `onBeforeCompile`: `p' = q⊗p + t` sampled from a DataTexture — rigid-body skinning at full PBR + shadows. |

### Key shader technique — the shockwave ring

The front is modelled as a *refractive-index gradient*, not a blur circle:

```glsl
float x = (r - w.z) / max(m.x, 1e-4);   // signed distance from the front
float lobe = x * exp(-x*x*2.0) * 2.718; // signed lobe: positive inside, negative outside
totalOffset += dir * lobe * amp;        // bends light toward the front
chroma     += abs(lobe) * m.y * amp;    // dispersion ∝ bend strength
```

That signed lobe is what makes the front read as a shockwave lens rather than a
smudge, and the per-channel sampling (`col.r/b` offset outward, `col.g` at
centre) produces physically-flavoured dispersion. The heat shimmer is confined
to the volume the front has already swept (`smoothstep` on radius).

---

## 3 · Camera & focus

`CinematicCamera` wraps OrbitControls with:

- `minDistance 10 / maxDistance 3000` — from "one snapped cable strand" to the
  whole bay, stepless, with damping.
- **Click-to-focus**: raycast against bridge/ocean/terrain, the orbit target
  glides there exponentially (frame-rate independent lerp) and a world-anchored
  marker fades in. A click is distinguished from a drag so orbiting never
  re-targets.
- **Slow motion / pause / snapshot A-B**: the clock owns scaled time; pause +
  frame-step (`.`) works everywhere because particles, physics and disasters all
  consume the same `dt`. Snapshot slots capture camera state + a canvas JPEG and
  restore the camera on click — the pause-and-compare feature.
- **The shake feedback fix**: OrbitControls re-derives its spherical state from
  `camera.position` each update, so naively adding shake after it corrupts the
  orbit. The rig keeps an authoritative `_base` position: restore → controls
  update → save back → apply shake purely for rendering. The noise never leaks
  into the controller.
- Shift-click = **strikeAt()** — aimable local destruction at any bridge point.

---

## 4 · Performance strategy (the four that matter)

1. **GPU rigid-body skinning (`BatchedRigidMesh`)** — every fracture chunk is
   unique geometry, so instancing can't apply and 406 meshes would be 406 draw
   calls. Instead all chunks merge into ~3 spatial batches; each vertex carries
   `aChunkId`, per-body rigid transforms live in a float DataTexture, and a
   small vertex patch applies `p' = q⊗p + t` to position *and* normal. Cost per
   frame: one ~26 KB texture upload. **Measured whole-frame cost: 53 draw calls**
   (scene + shadow pass + bloom + 5 post passes), 465k triangles, on a software
   rasteriser.

2. **Pre-fractured but asleep** — all 406 bodies exist from frame one as *fixed*
   (static) colliders, which cost the solver nothing. A disaster doesn't build
   anything: it flips bodies to Dynamic with `setBodyType()` and hands them an
   impulse, so destruction starts the same frame the button is pressed. Bodies
   are retired back to Fixed when at rest or sunk, keeping the active island
   count bounded forever (budget: 900, evicted oldest-at-rest first).

3. **Closed-form GPU particles** — particle position is `p(t)` (exact solution
   of ballistic motion + linear drag) evaluated in the vertex shader. The CPU
   writes each instance's spawn state once; after that a frame with 60k live
   particles costs one draw call and zero buffer traffic. Bonus: because time is
   a uniform, slow motion and pause work on particles *for free*.

4. **Selective bloom via layer isolation, plus three small wins** —
   fire/embers live on a dedicated render layer; a second (cheap) composer
   renders *only* that layer against black, blooms it, and adds it back — so fire
   glows while a sunlit tower does not. The grade pass fuses four effects into
   one round-trip; the ocean's grid is camera-snapped in whole cells so waves
   never swim; and the renderer drives an **adaptive resolution governor**
   (0.62×–1.75× device ratio, EMA-smoothed) that trades pixels before it ever
   drops an effect or a debris body.

### Mesh fracture

The deck is a 96×3 **2D Voronoi** partition (sites on a jittered grid, cells
clipped by perpendicular bisectors — no Delaunay needed), extruded into convex
prisms. 2D-in-plane fracture is deliberate: the slab is 2 orders of magnitude
longer than thick, real bending failure fragments *in plan*, and convex prism
hulls are exactly what keeps a rigid-body solver calm. Towers use jittered box
rubble. Fresh fracture faces are vertex-coloured raw concrete against the
painted International Orange exterior — the colour tells the fracture story.

---

## 5 · WebGPU / TSL path

`src/webgpu/OceanTSL.js` + `webgpu-ocean.html` re-implement the **identical**
Gerstner field as a TSL node graph (positionNode / normalNode / colorNode,
compile-time-unrolled wave loop, Fresnel + analytic-sky colorNode). Why a demo
and not the main path: the cinematic chain depends on `EffectComposer` GLSL
passes and `onBeforeCompile` patching, neither of which exists under
WebGPURenderer — shipping half of a second backend would be worse than one
complete backend plus a working example of the target API. The migration path is
documented in that file's header.

## 6 · Verification (how this was actually tested)

The project ships harness pages — `verify-smoke.html`, `verify-atmosphere.html`,
`verify-physics.html`, `verify-physics-realtime.html`, `verify-shot.html` and
`tools/verify-exposure.html` — driven headlessly against a small report server
(`tools/static-server.mjs`, which also accepts `POST /report` and `POST /png/<name>`):

- **Smoke**: boots, triggers every disaster + reset → `DONE OK`, zero console
  errors/warnings, 53 draw calls, 406 bodies, 27 shader programs.
- **Atmosphere**: GPU framebuffer readback across the full day cycle. Caught and
  fixed (a) the horizon clipping to white at noon — scattering was multiplied by
  an `airmass` that reaches 11× with none of the saturation real extinction
  provides; (b) golden hour crushing to near-black (`33,37,18`); and (c) the
  missing **`OutputPass`**, the classic composer bug where linear values are
  blitted into an sRGB canvas and the whole image is ~2.4× too dark. Final sweep:
  no clipped channel at any hour, correct warm shift into dusk, deep blue at night.
- **Physics (real time)**: per-disaster runs sampling body state. Earthquake
  staged exactly as designed — `t=3.6 s` sway only (0 dynamic), `t=5.2 s` cables
  parting (7 dynamic, 13 breaks), `t=7.2 s` deck peeling (112 dynamic),
  `t=11 s` towers (239), `t=16 s` settling (270 dynamic, 10 sunk). Tsunami
  reached 348 dynamic bodies. Every run returned to **406 static** after reset:
  pristine, no leaks.
- **Exposure**: in-page histogram of the real framebuffer. Caught two compounding
  HDR bugs that rendered a meteor blast **100% pure white**: `UnrealBloomPass`
  outputs *input + bloom*, and the bloom layer is also present in the main pass,
  so the combine step counted the fireball twice — now it subtracts the pass
  input to add only the halo *excess*; and fire particles were authored at
  "bright on their own" values although additive blending stacks 20–40 deep in a
  dense burst, so per-particle peak must be ~1/overlap. After the fix: a white-hot
  core still reaches 255 (bloom triggers) with **0.27%** fully-blown pixels
  instead of 100%, and the baseline frame is unchanged.
- Note: Chrome's `--virtual-time-budget` fast-forwards timers but does **not**
  advance `performance.now()`, which `SimClock` reads — so a run under virtual
  time reports `simT ≈ 0.1 s` forever and *nothing actually happens*. All
  simulation verification therefore runs on wall-clock time with the page POSTing
  its own results back. Worth knowing before trusting any headless 3D test.

## 7 · Operation

| Input | Action |
|---|---|
| drag / wheel / right-drag | orbit / stepless zoom / pan |
| click | set camera focus point |
| **Shift+click** | strike the bridge at that point (kaiju damage) |
| 1–4 | earthquake / tsunami / meteor / monster |
| Space | pause (world freezes; camera still flies) |
| `.` | single frame step while paused |
| R · F | reset bridge · frame the whole structure |
| panel sliders | time-of-day, storm, time scale (0.02×–2×), snapshot A/B |

Known simplification, said plainly: terrain, skyline and waves are procedural
stand-ins at game-realism fidelity, not photogrammetry; the *structure* is the
subject and uses real Golden Gate dimensions (2737 m deck, 227 m towers, 1280 m
main span) so a 90 m tsunami reads at true scale.
