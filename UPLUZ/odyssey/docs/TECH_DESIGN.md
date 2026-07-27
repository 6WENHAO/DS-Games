# Project Sunhat — Technical Design

A browser-native 3D platformer in the spirit of *Super Mario Odyssey*: one seamless open
world, split into a stylized **Town** and a themed **Wilderness**, rendered with PBR
materials, dynamic water, and a full real-time day/night cycle.

Target: **60 fps @ 1080p** on an M1 MacBook Air / GTX 1650-class GPU in Chrome, with a
graceful 30 fps low tier for integrated graphics. Stack is Three.js r16x on **WebGL2**,
authored in TypeScript, bundled by Vite.

---

## 0. Table of contents

1. [Stack & hard constraints](#1-stack--hard-constraints)
2. [Code architecture](#2-code-architecture)
3. [World structure & streaming](#3-world-structure--streaming)
4. [Terrain: hills, cliffs, canyons](#4-terrain-hills-cliffs-canyons)
5. [Character controller & physics](#5-character-controller--physics)
6. [Camera](#6-camera)
7. [Rendering & material pipeline](#7-rendering--material-pipeline)
8. [The day/night cycle controller](#8-the-daynight-cycle-controller)
9. [Sky & atmosphere](#9-sky--atmosphere)
10. [Dynamic lighting updates](#10-dynamic-lighting-updates)
11. [Night emissives: windows & streetlights](#11-night-emissives-windows--streetlights)
12. [Water system](#12-water-system)
13. [Town, NPCs, and interaction](#13-town-npcs-and-interaction)
14. [Wilderness biomes & platforming](#14-wilderness-biomes--platforming)
15. [Post-processing](#15-post-processing)
16. [Asset pipeline](#16-asset-pipeline)
17. [Performance optimization checklist](#17-performance-optimization-checklist)
18. [Quality tiers & scaling](#18-quality-tiers--scaling)
19. [Milestones](#19-milestones)
20. [Known risks](#20-known-risks)

---

## 1. Stack & hard constraints

| Concern | Choice | Why |
|---|---|---|
| Renderer | Three.js (WebGL2 only, no WebGPU fallback for v1) | Mature ecosystem, `onBeforeCompile` shader injection, PMREM, glTF |
| Language | TypeScript, strict | A world this size needs types on the data contracts |
| Bundler | Vite + `vite-plugin-glsl` | HMR on shaders is a huge iteration win |
| Physics | `@dimforge/rapier3d-compat` (WASM) | Built-in kinematic character controller, heightfield colliders, deterministic |
| Post-FX | `postprocessing` (pmndrs) | Merges effects into one fullscreen pass instead of N ping-pongs |
| Animation | glTF skinned meshes + custom state machine over `AnimationMixer` | |
| Audio | Web Audio via Howler, positional pool | |
| State/UI | Preact + signals for HUD/menus | Tiny; keeps DOM out of the render loop |

**Hard constraints that shape everything below:**

- WebGL2 has **no compute shaders**. Anything "GPU simulation" must be a fragment-shader
  ping-pong on a float render target, or move to the CPU/Worker.
- Draw calls are the #1 cost in a Three.js scene. The town is where this dies. Budget
  below is enforced by instancing + merging, not by hope.
- Shader compilation stalls are the #1 cause of visible hitching. Everything is
  pre-warmed at load via `renderer.compileAsync()`.
- One directional shadow-casting light. Not two. The sun/moon transition is a *cross-fade
  of one light's parameters*, not two lights.

---

## 2. Code architecture

Not a full ECS — that's over-engineering for a single-player platformer. Instead:
**a fixed-order system pipeline over a small typed world state**, with entities as plain
objects that opt into behaviors.

```
src/
  main.ts                    // bootstrap, canvas, loading screen
  core/
    Engine.ts                // renderer, clock, fixed-step loop, system registry
    Loop.ts                  // accumulator-based fixed update + interpolated render
    Services.ts              // typed service locator (no globals sprinkled about)
    EventBus.ts              // 'timeofday:phase', 'player:landed', 'npc:interact'
    Assets.ts                // GLTF/KTX2/Draco loaders, ref-counted cache, progress
    GlobalUniforms.ts        // THE shared uniform object (see §7.3)
    Profiler.ts              // frame timings, draw-call counter, GPU timer queries
  systems/                   // run in fixed order every frame
    InputSystem.ts
    PhysicsSystem.ts         // rapier step, collider sync
    PlayerSystem.ts          // character controller state machine
    CameraSystem.ts
    StreamingSystem.ts       // chunk load/unload around player
    TimeOfDaySystem.ts       // <-- day/night clock + sky state
    LightingSystem.ts        // applies sky state to lights, env, fog
    LightPoolSystem.ts       // nearest-N real point lights (night)
    WaterSystem.ts           // reflection RT, wave uniforms
    NPCSystem.ts
    AnimationSystem.ts
    AudioSystem.ts
    UISystem.ts
  world/
    WorldConfig.ts           // regions, biomes, spawn tables, day length
    Chunk.ts, ChunkLoader.ts // + chunk.worker.ts
    Terrain.ts               // heightfield mesh, LOD, splat material
    Region.ts                // Town / Wilderness definitions, camera hints, audio beds
    Props.ts                 // instanced prop manager
  render/
    Sky.ts                   // stylized atmospheric sky dome shader
    Water.ts                 // Gerstner + planar reflection material
    CSM.ts                   // cascaded shadow maps
    EnvProbe.ts              // dynamic PMREM from the sky (the key IBL trick)
    PostFX.ts
    materials/
      TerrainMaterial.ts     // splat + triplanar, extends MeshStandardMaterial
      ToonPBRMaterial.ts     // stylized PBR w/ rim + saturation lift
      EmissiveWindow.ts
  gameplay/
    CharacterController.ts   // move/jump/climb/ground-pound
    MoveStates.ts
    Interactable.ts
    Collectible.ts
  data/                      // JSON authored content
    timeofday.gradients.json
    world.regions.json
    biomes/*.json
```

### 2.1 The loop

Fixed 60 Hz simulation, decoupled render, interpolated transforms. This matters: a
platformer with variable-step physics feels different on a 144 Hz monitor, and that's a
bug players *feel* but can't name.

```ts
// core/Loop.ts
const FIXED_DT = 1 / 60;
const MAX_SUBSTEPS = 5;

export class Loop {
  private acc = 0;
  private last = performance.now() / 1000;

  constructor(private systems: System[], private renderSystems: System[]) {}

  tick = () => {
    const now = performance.now() / 1000;
    // Clamp: after a tab switch, don't try to catch up 40 seconds of simulation.
    let frameTime = Math.min(now - this.last, 0.25);
    this.last = now;
    this.acc += frameTime;

    let steps = 0;
    while (this.acc >= FIXED_DT && steps < MAX_SUBSTEPS) {
      for (const s of this.systems) s.fixedUpdate(FIXED_DT);
      this.acc -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_SUBSTEPS) this.acc = 0; // give up on the backlog

    const alpha = this.acc / FIXED_DT;        // interpolation factor for render
    for (const s of this.renderSystems) s.render(frameTime, alpha);

    requestAnimationFrame(this.tick);
  };
}
```

Systems that must run per *rendered* frame (camera smoothing, water RT, reflections,
day/night visual lerp) implement `render()`. Systems that affect simulation (physics,
player state) implement `fixedUpdate()`. Day/night advances in `fixedUpdate` (it's game
state) but *applies* its visuals in `render` (it's presentation).

---

## 3. World structure & streaming

**World extents:** 2048 m × 2048 m, split into **64 m chunks** (32×32 grid = 1024 chunks).
Vertical range −80 m (canyon floors) to +180 m (mountain peaks).

```
                 ┌──────────────────────────────────────┐
   +1024         │   SNOW PEAKS      │   ROCK CANYON     │
                 │                   │   (deep, verticality)
                 ├─────────┐         └───────────────────┤
                 │         │   LAKE   ◄── water + reflection
        0        │  TOWN   │ ~~~~~~~~ ├───────────────────┤
                 │ (dense) │          │   FOREST          │
                 ├─────────┴──────────┤   (canopy, vines) │
   -1024         │   GRASSLAND (hub, gentle hills)        │
                 └──────────────────────────────────────┘
                   -1024                              +1024
```

Grassland is the connective tissue — every region touches it, so there is never a loading
boundary the player can see. The lake sits at the town/wilderness seam so the town skyline
reflects in it at dusk (this is the money shot; design the layout around it).

### 3.1 Streaming

A ring of chunks around the player, three states:

| Ring | Radius | State |
|---|---|---|
| Hot | 0–2 chunks (128 m) | Full mesh, colliders, props, NPCs, shadow casting |
| Warm | 3–5 chunks (320 m) | Terrain LOD1/2, instanced props, no colliders, no NPCs |
| Cold | 6–9 chunks (576 m) | Terrain LOD3 imposter, silhouette props only |
| Unloaded | > 9 | Geometry disposed, GPU buffers freed |

Loading happens in a **Web Worker**: it decodes the heightmap tile, builds the LOD mesh
positions/normals/UVs into `Float32Array`s, and posts them back as **transferables**. The
main thread only does `new THREE.BufferAttribute(...)` + `geometry.setAttribute(...)` — a
sub-millisecond operation.

```ts
// world/ChunkLoader.ts (main-thread side)
export class ChunkLoader {
  private pending = new Map<string, Promise<ChunkPayload>>();
  private pool = new WorkerPool('/workers/chunk.worker.js', navigator.hardwareConcurrency > 4 ? 3 : 1);

  // Budget: at most N chunk uploads per frame, so streaming never spikes the frame.
  private uploadQueue: ChunkPayload[] = [];
  private static UPLOADS_PER_FRAME = 1;

  request(cx: number, cz: number, lod: number) { /* dedupe by `${cx},${cz},${lod}` */ }

  render() {
    let budget = ChunkLoader.UPLOADS_PER_FRAME;
    while (budget-- > 0 && this.uploadQueue.length) {
      this.commit(this.uploadQueue.shift()!);   // create BufferGeometry, add to scene
    }
  }
}
```

**Hysteresis is mandatory:** load at radius R, unload at R + 1.5 chunks. Without it, a
player pacing back and forth across a chunk border thrashes the loader forever.

**Prediction:** offset the streaming center by `player.velocity * 1.2s`. You load ahead of
where the player is going, not where they are.

---

## 4. Terrain: hills, cliffs, canyons

A pure heightmap cannot express overhangs, arches, or a climbable vertical rock wall. So:
**hybrid terrain**.

1. **Base heightfield** — a 2048×2048 R16 heightmap (tiled into 64×64 px chunk tiles),
   authored in Gaea/World Machine or generated offline with a Node script. Gives rolling
   hills, valleys, dunes, plateaus. Cheap collision (Rapier `heightfield` collider), cheap
   LOD (just skip vertices).

2. **Cliff & canyon set-pieces** — authored meshes placed on top: canyon walls, arches,
   climbable rock faces, overhangs. Triplanar-mapped so no UV stretching on verticals.
   Collision = simplified convex-hull decomposition baked offline, not the render mesh.

3. **Blend** — cliff meshes get a vertex-color alpha at their base and a height-based
   blend to the terrain splat, plus a scattered rubble/grass instance ring at the seam. The
   seam is hidden by geometry, not by shader trickery.

### 4.1 Terrain LOD without cracks

Discrete LODs (1 m / 2 m / 4 m / 8 m vertex spacing) with **skirts**: each chunk mesh
extends a downward-facing 3 m apron around its border. Cracks between LOD levels are
physically covered by the skirt. This costs ~4% extra triangles and eliminates an entire
class of stitching bugs — far better ROI than geo-morphing for a stylized game where the
terrain isn't photoreal.

### 4.2 Splat material

Four channels (R grass, G rock, B sand, A snow) from an RGBA splatmap, plus **slope-based
triplanar rock** that automatically overrides on anything steeper than ~40°. Snow only
appears above the biome's snow line, blended by height. Implemented by extending
`MeshStandardMaterial` via `onBeforeCompile` so you keep Three's full PBR + shadow +
fog + IBL chain and only replace the albedo/normal/roughness fetch.

```ts
// render/materials/TerrainMaterial.ts
export function makeTerrainMaterial(maps: TerrainMaps) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSplat  = { value: maps.splat };
    shader.uniforms.uAlbedo = { value: maps.albedoArray };   // DataArrayTexture, 4 layers
    shader.uniforms.uNormal = { value: maps.normalArray };
    shader.uniforms.uMR     = { value: maps.mrArray };       // metal/rough packed
    shader.uniforms.uTiling = { value: new THREE.Vector4(24, 18, 20, 26) };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n varying vec3 vWorldPos; varying vec3 vWorldNrm;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed,1.0)).xyz;
        vWorldNrm = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos; varying vec3 vWorldNrm;
        uniform sampler2D uSplat; uniform sampler2DArray uAlbedo, uNormal, uMR;
        uniform vec4 uTiling;
        vec4 triplanar(sampler2DArray t, float layer, vec3 p, vec3 n, float scale) {
          vec3 b = pow(abs(n), vec3(4.0)); b /= (b.x + b.y + b.z);
          return texture(t, vec3(p.zy / scale, layer)) * b.x
               + texture(t, vec3(p.xz / scale, layer)) * b.y
               + texture(t, vec3(p.xy / scale, layer)) * b.z;
        }`)
      .replace('#include <map_fragment>', `
        vec4 sw = texture2D(uSplat, vWorldPos.xz / 2048.0 + 0.5);
        float slope = 1.0 - clamp(vWorldNrm.y, 0.0, 1.0);
        sw.g = max(sw.g, smoothstep(0.35, 0.62, slope));      // auto-rock on steep faces
        sw /= max(dot(sw, vec4(1.0)), 1e-4);
        vec3 albedo = vec3(0.0);
        for (int i = 0; i < 4; i++)
          albedo += sw[i] * triplanar(uAlbedo, float(i), vWorldPos, vWorldNrm, uTiling[i]).rgb;
        diffuseColor.rgb *= albedo;`);
  };
  // Stable cache key so Three doesn't recompile this program per-chunk.
  mat.customProgramCacheKey = () => 'terrain-splat-v1';
  return mat;
}
```

> `customProgramCacheKey` is not optional. Without it, every material instance using
> `onBeforeCompile` risks a separate shader program — 1024 chunks × one compile each is a
> multi-second stall.

### 4.3 Climbable surfaces

Climbability is **data on the collider**, not a raycast against material names. Each cliff
collider gets `userData = { surface: 'climbable', grip: 1.0 }` at bake time. The character
controller reads it from the Rapier contact manifold. Artists mark it in Blender with a
custom property; the glTF exporter carries it through to `mesh.userData`.

---

## 5. Character controller & physics

Rapier's `KinematicCharacterController` handles the hard parts (slope limits, step-up,
snap-to-ground, sliding) — do not write your own capsule solver. What you write is the
**move state machine** on top.

```
Idle ──run──► Run ──► Dive
  │            │
  ├─jump──► Jump1 ─(land<0.2s)─► Jump2 ─(land<0.2s)─► Jump3 (triple, tall)
  │            │                                      
  │            ├─crouch+jump──► LongJump
  │            ├─Z (down)─────► GroundPound ──► Bounce
  │            └─near climbable + toward────► WallCling ─► WallClimb ─► LedgeGrab ─► Mantle
  └─crouch──► Roll ──► RollJump
```

Feel parameters (tune these first, they define the whole game):

```ts
export const MOVE = {
  runSpeed: 9.0, sprintSpeed: 13.0, accel: 60, decel: 45, airAccel: 22,
  turnRateDeg: 900,                 // near-instant turns; Odyssey is snappy, not simulaty
  jumpVel: 11.5, jump2Vel: 13.0, jump3Vel: 16.5,
  gravity: -34,                     // ~3.5x "realistic"; platformers need heavy gravity
  fallGravityMult: 1.45,            // heavier on the way down -> crisp arcs
  lowJumpMult: 2.2,                 // release jump early = short hop
  coyoteTime: 0.12,                 // still jumpable 120ms after leaving ground
  jumpBuffer: 0.14,                 // pressing jump early still lands the jump
  terminalVel: -48,
  climbSpeed: 3.2, climbStamina: Infinity,
  groundPoundVel: -40, poundHangTime: 0.22,
};
```

`coyoteTime` + `jumpBuffer` + asymmetric gravity are ~80% of why a platformer feels good.
Ship them from day one.

**Moving platforms:** kinematic Rapier bodies. Each frame, if the character's ground
collider is a kinematic body, add that body's frame delta to the character's translation
*before* the controller's own move. Reparenting the player is a trap — it wrecks camera
smoothing and physics interpolation.

**Physics threading:** keep Rapier on the main thread for v1. It's ~1.2 ms for this scene.
Moving it to a Worker adds a frame of input latency, which you'll feel in a platformer.
Revisit only if the profiler says so.

---

## 6. Camera

Spring-arm third person, 8 m default boom, with:

- **Collision sweep** — sphere-cast from pivot to desired camera position; pull in on hit,
  return out with a slow ease (fast in, slow out — never the reverse, it induces nausea).
- **Look-ahead** — offset the pivot by `velocity.xz * 0.25` so the player sees where
  they're going.
- **Vertical framing** — during a jump, the camera follows Y with a dead-zone band (±1.5 m)
  so small hops don't bob the whole screen.
- **Camera hint volumes** — box triggers that override FOV / boom length / pitch / a fixed
  look-at. Town alleys use short booms; canyon overlooks push out to 14 m and widen FOV to
  70° for scale. This is authored data, not code.
- **FOV kick** — +6° over 0.2 s when sprinting or long-jumping. Cheap, huge feel win.

---

## 7. Rendering & material pipeline

### 7.1 Renderer setup

```ts
const renderer = new THREE.WebGLRenderer({
  antialias: false,              // we do SMAA in post; MSAA + post = paying twice
  powerPreference: 'high-performance',
  stencil: false,
  depth: true,
  alpha: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;   // AgX keeps saturated colors from clipping to white
renderer.toneMappingExposure = 1.0;            // driven by the day/night controller
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;         // we control shadow refresh manually
renderer.info.autoReset = false;               // so the profiler can read stable counts
```

**On tone mapping:** the brief asks for bright, highly saturated color. ACESFilmic
desaturates saturated highlights toward white — exactly wrong here. **AgX** (or a custom
Reinhard-with-saturation-preservation) keeps a hot red roof *red* instead of pink. If you
want maximum control, use `NoToneMapping` in the renderer and do tone mapping + a 3D LUT
grade in the post stack (see §15).

### 7.2 Material strategy: "Stylized PBR"

Full PBR — metalness/roughness, real IBL, real normals — so metal reads as metal and wood
reads as wood. The *stylization* comes from art direction plus three shader tweaks applied
uniformly across the game via one shared `onBeforeCompile` patch:

1. **Saturation lift** on final lit color (`mix(luma, color, 1.15)`).
2. **Rim/wrap light** — a wrapped diffuse term (`(NdotL + w)/(1+w)`, w≈0.35) so shadowed
   sides stay colorful instead of black, plus a subtle fresnel rim tinted by the sky
   color. This is what makes Odyssey-style models pop.
3. **Shadow tinting** — shadowed regions receive a cool blue-violet ambient, not gray.

Material archetypes (each a preset, not a new shader):

| Archetype | metalness | roughness | Notes |
|---|---|---|---|
| Painted wood | 0.0 | 0.55–0.75 | strong normal map, low-freq grain |
| Brushed metal | 1.0 | 0.28 | anisotropic hint via normal map streaks |
| Stone / rock | 0.0 | 0.85 | triplanar, high normal strength |
| Foliage | 0.0 | 0.7 | alpha-test + `DoubleSide` + subsurface wrap |
| Glass / window | 0.0 | 0.05 | + emissive at night (§11) |
| Character skin/cloth | 0.0 | 0.6 | wrap lighting boosted to 0.5 |

### 7.3 The shared uniform block — the spine of the whole renderer

Every custom shader (sky, water, terrain, foliage, emissives) reads from **one shared
uniform object held by reference**. The day/night controller writes to it once per frame;
every material sees the update with zero per-material work.

```ts
// core/GlobalUniforms.ts
export const G = {
  uTime:          { value: 0 },
  uSunDirection:  { value: new THREE.Vector3(0, 1, 0) },   // world-space, points TO the sun
  uSunColor:      { value: new THREE.Color(1, 1, 1) },
  uSunIntensity:  { value: 3.0 },
  uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
  uMoonColor:     { value: new THREE.Color(0.55, 0.68, 1.0) },
  uSkyZenith:     { value: new THREE.Color() },
  uSkyHorizon:    { value: new THREE.Color() },
  uSkyGround:     { value: new THREE.Color() },
  uFogColor:      { value: new THREE.Color() },
  uFogParams:     { value: new THREE.Vector2(120, 900) },   // near, far
  uStarOpacity:   { value: 0 },
  uEmissiveBlend: { value: 0 },                              // 0 day .. 1 night
  uAmbientTint:   { value: new THREE.Color() },
  uWindDir:       { value: new THREE.Vector2(0.7, 0.7) },
  uWindStrength:  { value: 1.0 },
};

/** Attach the shared uniforms to any material compiled with onBeforeCompile. */
export function bindGlobals(shader: THREE.WebGLProgramParametersWithUniforms) {
  for (const k in G) shader.uniforms[k] = (G as any)[k];
}
```

Because the uniform *objects* are shared by reference, `G.uSunColor.value.setRGB(...)`
propagates everywhere — no dirty flags, no traversal, no `material.needsUpdate`.

---

## 8. The day/night cycle controller

This is the system the brief cares most about, so it gets the most rigor.

### 8.1 Model

Time is a normalized float `t ∈ [0,1)` where `0 = midnight, 0.25 = sunrise, 0.5 = noon,
0.75 = sunset`. Configurable day length; the default is a **12-minute full cycle**, which
is long enough that a play session has a distinct mood but short enough that the player
sees the whole cycle in one sitting.

```ts
export interface TimeOfDayConfig {
  dayLengthSeconds: number;   // full 24h cycle in real seconds. default 720
  startTime: number;          // 0..1, default 0.30 (bright morning)
  paused: boolean;
  timeScale: number;          // multiplier, live-tweakable (debug slider, in-game item)
  latitudeDeg: number;        // sun path tilt; 35 gives nice long shadows at the poles of the day
}
```

### 8.2 Sun & moon direction

Not a naive `sin/cos` in the XZ plane — that makes the sun pass straight overhead and
produces a boring, shadowless noon. Tilt the orbital plane by latitude so the sun peaks at
~55° elevation, which gives readable shadows all day and *very* long shadows at dawn/dusk.

```ts
function sunDirection(t: number, latitudeDeg: number, out: THREE.Vector3) {
  const theta = (t - 0.25) * Math.PI * 2;       // t=0.25 -> theta=0 -> sunrise at east horizon
  const lat = THREE.MathUtils.degToRad(latitudeDeg);
  // Orbit in a plane tilted from vertical by `lat`, rising in +X, setting in -X.
  out.set(Math.cos(theta), Math.sin(theta) * Math.cos(lat), Math.sin(theta) * Math.sin(lat));
  return out.normalize();
}
// Moon is the antipode plus a small inclination offset so it isn't a perfect mirror.
```

### 8.3 Keyframed atmosphere gradients

All color/intensity output is authored data, not computed physics. Physically-based sky
color at 4 a.m. is *correct* and *ugly*; artists need to hand-place the dusk orange. Store
keyframes in JSON and interpolate.

```jsonc
// data/timeofday.gradients.json  (excerpt)
{
  "keys": [
    { "t": 0.00, "name": "midnight",
      "sunColor": "#000000", "sunIntensity": 0.0,
      "moonColor": "#8FB4FF", "moonIntensity": 0.45,
      "skyZenith": "#060B24", "skyHorizon": "#141F45", "skyGround": "#0A0E1C",
      "ambient": "#243A6B", "ambientIntensity": 0.35,
      "fog": "#131C3A", "fogNear": 60, "fogFar": 520,
      "starOpacity": 1.0, "exposure": 1.15, "emissive": 1.0, "bloom": 0.55 },

    { "t": 0.22, "name": "dawn",
      "sunColor": "#FF8C5A", "sunIntensity": 1.2,
      "skyZenith": "#2B4A8C", "skyHorizon": "#FFB07A", "skyGround": "#5A4A50",
      "ambient": "#7C86B8", "ambientIntensity": 0.7,
      "fog": "#E8A87C", "fogNear": 40, "fogFar": 420,
      "starOpacity": 0.25, "exposure": 1.05, "emissive": 0.6, "bloom": 0.4 },

    { "t": 0.30, "name": "morning",
      "sunColor": "#FFE0B0", "sunIntensity": 3.0,
      "skyZenith": "#3E86D6", "skyHorizon": "#BFE4FF", "skyGround": "#8A9A7A",
      "ambient": "#9FC4F0", "ambientIntensity": 0.9,
      "fog": "#CFE8FF", "fogNear": 150, "fogFar": 1100,
      "starOpacity": 0.0, "exposure": 1.0, "emissive": 0.0, "bloom": 0.25 },

    { "t": 0.50, "name": "noon",
      "sunColor": "#FFFBF0", "sunIntensity": 4.2,
      "skyZenith": "#1E6FD9", "skyHorizon": "#A8DCFF", "skyGround": "#9AAE85",
      "ambient": "#BBD9F7", "ambientIntensity": 1.0,
      "fog": "#D6EEFF", "fogNear": 200, "fogFar": 1400,
      "starOpacity": 0.0, "exposure": 0.95, "emissive": 0.0, "bloom": 0.2 },

    { "t": 0.72, "name": "goldenHour",
      "sunColor": "#FFB061", "sunIntensity": 2.6,
      "skyZenith": "#2E5FA8", "skyHorizon": "#FFCB7A", "skyGround": "#A08050",
      "ambient": "#D9A87C", "ambientIntensity": 0.85,
      "fog": "#FFC98F", "fogNear": 90, "fogFar": 800,
      "starOpacity": 0.0, "exposure": 1.05, "emissive": 0.25, "bloom": 0.45 },

    { "t": 0.78, "name": "dusk",
      "sunColor": "#FF5E3A", "sunIntensity": 0.9,
      "skyZenith": "#1B2E63", "skyHorizon": "#FF7A4D", "skyGround": "#43324A",
      "ambient": "#6E6AA8", "ambientIntensity": 0.6,
      "fog": "#B9668A", "fogNear": 60, "fogFar": 560,
      "starOpacity": 0.35, "exposure": 1.1, "emissive": 0.85, "bloom": 0.55 },

    { "t": 0.86, "name": "night",
      "sunColor": "#000000", "sunIntensity": 0.0,
      "moonColor": "#8FB4FF", "moonIntensity": 0.45,
      "skyZenith": "#070C26", "skyHorizon": "#16214A", "skyGround": "#0A0E1C",
      "ambient": "#2A407A", "ambientIntensity": 0.38,
      "fog": "#141D3C", "fogNear": 60, "fogFar": 520,
      "starOpacity": 0.95, "exposure": 1.15, "emissive": 1.0, "bloom": 0.55 }
  ]
}
```

**Interpolate colors in Oklab, not sRGB.** Lerping `#FF7A4D` → `#16214A` in sRGB passes
through a muddy brown; in Oklab it passes through a plausible violet. This single change is
the difference between "sunset" and "someone turned the brightness down".

```ts
// Oklab conversion (Björn Ottosson). ~20 lines, worth every one.
function srgbToOklab(c: THREE.Color, out: [number,number,number]) {
  const l = 0.4122214708*c.r + 0.5363325363*c.g + 0.0514459929*c.b;
  const m = 0.2119034982*c.r + 0.6806995451*c.g + 0.1073969566*c.b;
  const s = 0.0883024619*c.r + 0.2817188376*c.g + 0.6299787005*c.b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  out[0] = 0.2104542553*l_ + 0.7936177850*m_ - 0.0040720468*s_;
  out[1] = 1.9779984951*l_ - 2.4285922050*m_ + 0.4505937099*s_;
  out[2] = 0.0259040371*l_ + 0.7827717662*m_ - 0.8086757660*s_;
}
// oklabToSrgb is the inverse; lerpOklab(a, b, k) converts both, mixes, converts back.
```

### 8.4 The controller

```ts
// systems/TimeOfDaySystem.ts
export interface SkyState {
  t: number;
  phase: 'night' | 'dawn' | 'day' | 'dusk';
  sunDir: THREE.Vector3;   moonDir: THREE.Vector3;
  sunColor: THREE.Color;   sunIntensity: number;
  moonColor: THREE.Color;  moonIntensity: number;
  skyZenith: THREE.Color;  skyHorizon: THREE.Color;  skyGround: THREE.Color;
  ambient: THREE.Color;    ambientIntensity: number;
  fog: THREE.Color;        fogNear: number;  fogFar: number;
  starOpacity: number;     exposure: number;
  emissive: number;        bloom: number;
  /** 1 while the sun is the shadow caster, 0 while the moon is. Cross-fades at horizon. */
  sunAuthority: number;
}

export class TimeOfDaySystem implements System {
  readonly state: SkyState = createDefaultSkyState();
  private cfg: TimeOfDayConfig;
  private keys: Keyframe[];              // sorted, wrapped (last key duplicated at t+1)
  private lastAppliedT = -1;
  private lastPhase: SkyState['phase'] = 'day';

  constructor(cfg: TimeOfDayConfig, gradients: GradientData, private bus: EventBus) {
    this.cfg = cfg;
    this.keys = buildWrappedKeys(gradients.keys);
    this.state.t = cfg.startTime;
  }

  /** Advance the clock. Simulation, so this lives in fixedUpdate. */
  fixedUpdate(dt: number) {
    if (this.cfg.paused) return;
    this.state.t = (this.state.t + (dt * this.cfg.timeScale) / this.cfg.dayLengthSeconds) % 1;
  }

  /** Evaluate + publish. Presentation, so this lives in render. */
  render() {
    const t = this.state.t;
    // Skip the whole evaluation if time barely moved (paused, or a very long day).
    if (Math.abs(t - this.lastAppliedT) < 1e-5 && this.lastAppliedT >= 0) return;
    this.lastAppliedT = t;

    const { a, b, k } = this.findSpan(t);
    const s = this.state;

    lerpOklab(a.skyZenith,  b.skyZenith,  k, s.skyZenith);
    lerpOklab(a.skyHorizon, b.skyHorizon, k, s.skyHorizon);
    lerpOklab(a.skyGround,  b.skyGround,  k, s.skyGround);
    lerpOklab(a.sunColor,   b.sunColor,   k, s.sunColor);
    lerpOklab(a.ambient,    b.ambient,    k, s.ambient);
    lerpOklab(a.fog,        b.fog,        k, s.fog);
    s.sunIntensity     = lerp(a.sunIntensity, b.sunIntensity, k);
    s.ambientIntensity = lerp(a.ambientIntensity, b.ambientIntensity, k);
    s.fogNear = lerp(a.fogNear, b.fogNear, k);
    s.fogFar  = lerp(a.fogFar,  b.fogFar,  k);
    s.starOpacity = lerp(a.starOpacity, b.starOpacity, k);
    s.exposure    = lerp(a.exposure,    b.exposure,    k);
    s.emissive    = lerp(a.emissive,    b.emissive,    k);
    s.bloom       = lerp(a.bloom,       b.bloom,       k);

    sunDirection(t, this.cfg.latitudeDeg, s.sunDir);
    s.moonDir.copy(s.sunDir).negate().applyAxisAngle(AXIS_X, 0.22).normalize();

    // Cross-fade shadow authority as the sun dips below the horizon.
    s.sunAuthority = smoothstep(-0.06, 0.10, s.sunDir.y);

    this.publishToGlobals(s);
    this.emitPhaseEvents(s);
  }

  private publishToGlobals(s: SkyState) {
    G.uTime.value = performance.now() / 1000;
    G.uSunDirection.value.copy(s.sunDir);
    G.uMoonDirection.value.copy(s.moonDir);
    G.uSunColor.value.copy(s.sunColor);
    G.uSunIntensity.value = s.sunIntensity;
    G.uSkyZenith.value.copy(s.skyZenith);
    G.uSkyHorizon.value.copy(s.skyHorizon);
    G.uSkyGround.value.copy(s.skyGround);
    G.uFogColor.value.copy(s.fog);
    G.uFogParams.value.set(s.fogNear, s.fogFar);
    G.uStarOpacity.value = s.starOpacity;
    G.uEmissiveBlend.value = s.emissive;
    G.uAmbientTint.value.copy(s.ambient);
  }

  /** Fire once when crossing a phase boundary — audio beds, NPC schedules, spawn tables. */
  private emitPhaseEvents(s: SkyState) {
    const t = s.t;
    const phase: SkyState['phase'] =
      t < 0.20 || t >= 0.82 ? 'night' : t < 0.28 ? 'dawn' : t < 0.70 ? 'day' : 'dusk';
    if (phase !== this.lastPhase) {
      this.bus.emit('timeofday:phase', { from: this.lastPhase, to: phase, t });
      this.lastPhase = phase;
    }
    s.phase = phase;
  }

  // ── Public API ────────────────────────────────────────────────
  setTime(t: number)      { this.state.t = ((t % 1) + 1) % 1; this.lastAppliedT = -1; }
  setDayLength(sec: number) { this.cfg.dayLengthSeconds = Math.max(1, sec); }
  setTimeScale(m: number) { this.cfg.timeScale = m; }
  pause(p: boolean)       { this.cfg.paused = p; }
  /** Cinematic: ease to a target time over `dur` seconds — used for cutscenes/fast-forward. */
  skipTo(target: number, dur = 1.5) { /* tween timeScale up, then restore */ }
}
```

### 8.5 Why events matter

`timeofday:phase` drives more than lighting: NPC schedules (shopkeepers go home at dusk),
ambient audio crossfades (birds → crickets), firefly particle spawns, and the town's
window-lighting sequence. Keep it a single authoritative signal so nothing drifts.

---

## 9. Sky & atmosphere

A single inverted sphere (or a fullscreen triangle at far depth — cheaper) with a custom
shader. Not Three's `Sky` example: that's a Preetham model, physically plausible but hard
to art-direct into the palette this game wants. Instead, drive it from the same authored
gradient the lighting uses, so **sky and lighting can never desynchronize**.

```glsl
// render/shaders/sky.frag
uniform vec3 uSkyZenith, uSkyHorizon, uSkyGround;
uniform vec3 uSunDirection, uSunColor, uMoonDirection, uMoonColor;
uniform float uStarOpacity, uTime;
uniform sampler2D uStarMap;      // equirect star field, or procedural hash
varying vec3 vDir;

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;

  // --- base vertical gradient, sharpened near the horizon ---
  vec3 sky = mix(uSkyHorizon, uSkyZenith, pow(clamp(h, 0.0, 1.0), 0.55));
  sky = mix(sky, uSkyGround, smoothstep(0.0, -0.12, h));

  // --- sun/moon aligned horizon glow: the dusk color must bloom AROUND the sun,
  //     not ring the whole horizon uniformly. This is what sells golden hour. ---
  float sunAlign = max(dot(d, normalize(vec3(uSunDirection.x, 0.0, uSunDirection.z))), 0.0);
  float horizonBand = exp(-abs(h) * 7.0);
  sky += uSunColor * pow(sunAlign, 4.0) * horizonBand * 0.9;

  // --- sun disc + halo ---
  float sd = dot(d, uSunDirection);
  sky += uSunColor * smoothstep(0.9993, 0.9997, sd) * 14.0;      // disc (bloom picks it up)
  sky += uSunColor * pow(max(sd, 0.0), 220.0) * 1.5;             // tight halo
  sky += uSunColor * pow(max(sd, 0.0), 8.0) * 0.12;              // wide scatter

  // --- moon disc + soft glow ---
  float md = dot(d, uMoonDirection);
  sky += uMoonColor * smoothstep(0.9990, 0.9996, md) * 6.0;
  sky += uMoonColor * pow(max(md, 0.0), 90.0) * 0.35;

  // --- stars: fade in with uStarOpacity, dimmed near the horizon and near the moon ---
  if (uStarOpacity > 0.001) {
    vec2 uv = vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(h, -1.0, 1.0)) / 3.1415927 + 0.5);
    float stars = texture2D(uStarMap, uv).r;
    stars *= smoothstep(0.02, 0.30, h);                          // no stars in the haze
    float twinkle = 0.75 + 0.25 * sin(uTime * 2.7 + stars * 91.0);
    sky += vec3(stars * twinkle * uStarOpacity);
  }

  gl_FragColor = vec4(sky, 1.0);
}
```

**Clouds:** two scrolling layers of a soft, tileable cloud texture on a flattened dome,
tinted by `mix(uSkyHorizon, uSunColor, sunAlign)` so they catch the sunset. Do *not*
raymarch volumetric clouds — a full-screen raymarch costs more than the entire rest of the
frame on a laptop GPU, for a game where the player is looking at the ground.

**Fog:** `FogExp2` is too aggressive for a game with 900 m vistas. Use linear `Fog` with
near/far from the gradient, and add a **height-fog term** in the shared shader patch so
canyon floors fill with mist at dawn:

```glsl
float heightFog = exp(-max(vWorldPos.y - uFogHeight, 0.0) * uFogFalloff);
fogFactor = clamp(fogFactor + heightFog * uFogHeightStrength, 0.0, 1.0);
```

---

## 10. Dynamic lighting updates

### 10.1 The light rig

```
DirectionalLight  "celestial"   — ONE light. Sun and moon share it.
HemisphereLight   "ambient"     — sky/ground bounce, tinted by the gradient
Environment map   (PMREM)       — regenerated from the sky (see §10.3)
PointLight pool   ×8            — dynamically assigned to the nearest night lights
```

One shadow-casting directional light, always. When the sun sets, the same light object
retargets to the moon direction and takes the moon's color and a lower intensity. This
avoids paying for two shadow maps and avoids the double-shadow artifact at the crossover.

```ts
// systems/LightingSystem.ts
export class LightingSystem implements System {
  private sun = new THREE.DirectionalLight(0xffffff, 1);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private csm: CSM;
  private probe: EnvProbe;
  private shadowDirty = true;
  private lastShadowDir = new THREE.Vector3();

  constructor(scene: THREE.Scene, private tod: TimeOfDaySystem, renderer: THREE.WebGLRenderer) {
    this.sun.castShadow = true;
    this.csm = new CSM({ camera, parent: scene, light: this.sun,
      cascades: 3, maxFar: 320, shadowMapSize: 2048, mode: 'practical', lightMargin: 200 });
    this.probe = new EnvProbe(renderer, /* size */ 64);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xffffff, 100, 900);
  }

  render(dt: number) {
    const s = this.tod.state;

    // ── 1. Celestial direction & color: cross-fade sun -> moon ──────────────
    const a = s.sunAuthority;                        // 1 day, 0 night, smooth at horizon
    const dir = _v1.copy(s.sunDir).multiplyScalar(a)
                  .addScaledVector(s.moonDir, 1 - a).normalize();

    // Never let the shadow direction go fully horizontal — shadow acne + infinite-length
    // shadows. Clamp elevation to a 4-degree minimum and fade intensity instead.
    if (dir.y < 0.07) { dir.y = 0.07; dir.normalize(); }

    this.sun.position.copy(dir).multiplyScalar(300);
    this.sun.target.position.set(0, 0, 0);
    this.sun.color.copy(s.sunColor).lerp(s.moonColor, 1 - a);
    this.sun.intensity = lerp(s.moonIntensity, s.sunIntensity, a);

    // Softer, longer shadows at low sun angles = the "elongated dusk shadows" look.
    const elev = Math.max(s.sunDir.y, 0);
    this.sun.shadow.bias       = lerp(-0.0016, -0.0004, elev);
    this.sun.shadow.normalBias = lerp(0.09, 0.022, elev);
    this.sun.shadow.radius     = lerp(4.5, 1.6, elev);   // PCF softness

    // ── 2. Ambient ───────────────────────────────────────────────────────────
    this.hemi.color.copy(s.skyHorizon);
    this.hemi.groundColor.copy(s.skyGround);
    this.hemi.intensity = s.ambientIntensity;

    // ── 3. Fog ───────────────────────────────────────────────────────────────
    const fog = scene.fog as THREE.Fog;
    fog.color.copy(s.fog); fog.near = s.fogNear; fog.far = s.fogFar;
    scene.background = null;                          // sky dome draws it

    // ── 4. Exposure ──────────────────────────────────────────────────────────
    renderer.toneMappingExposure = s.exposure;

    // ── 5. Shadow refresh throttling (see 10.2) ─────────────────────────────
    this.csm.update();
    this.maybeRefreshShadows(dir);

    // ── 6. Environment probe (see 10.3) ─────────────────────────────────────
    this.probe.maybeUpdate(s);
  }
}
```

### 10.2 Shadow map refresh throttling

Redrawing 3 cascades × 2048² every frame is a large, mostly wasted cost — the sun moves a
fraction of a degree per frame. So:

- `renderer.shadowMap.autoUpdate = false`, `renderer.shadowMap.needsUpdate = true` set
  manually.
- **Cascade 0** (0–35 m, contains the player and everything they interact with) refreshes
  **every frame** — dynamic objects live here.
- **Cascade 1** (35–120 m) refreshes every **2** frames.
- **Cascade 2** (120–320 m) refreshes every **6** frames, *or* immediately when the sun
  direction has rotated more than 0.35°.

Implement by giving each cascade its own light + shadow camera and toggling
`light.shadow.needsUpdate` (Three r16x supports per-light `shadow.autoUpdate`). Cost drops
roughly 55% with no perceivable difference — distant shadows sliding one frame late is
invisible.

Additionally, **objects declare their shadow role**:

```ts
mesh.castShadow    = tag.isSignificant;      // small props: false. A pebble's shadow is noise.
mesh.receiveShadow = tag.isGround || tag.isLarge;
```

Rule of thumb: anything under ~0.4 m in its largest dimension does not cast. Bake a soft
blob-shadow decal instead — it looks better *and* costs less.

### 10.3 Dynamic IBL — the trick that makes it all cohere

The single highest-value idea in this document: **regenerate the environment map from the
sky shader as time advances.** Without it, metal props reflect a fixed noon sky at
midnight and the whole scene reads as fake. With it, a brass lamp post picks up the orange
of the sunset automatically, and every PBR material in the game gets correct ambient for
free.

Cost control: the sky is low-frequency, so a **64×64 cube** is plenty, and it only needs
regenerating when the sky has *visibly* changed.

```ts
// render/EnvProbe.ts
export class EnvProbe {
  private cubeRT: THREE.WebGLCubeRenderTarget;
  private cubeCam: THREE.CubeCamera;
  private pmrem: THREE.PMREMGenerator;
  private skyOnlyScene: THREE.Scene;          // ONLY the sky dome + clouds. Nothing else.
  private generated: THREE.Texture | null = null;
  private lastT = -1;
  private accum = 0;

  constructor(private renderer: THREE.WebGLRenderer, size = 64) {
    this.cubeRT  = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType });
    this.cubeCam = new THREE.CubeCamera(1, 2000, this.cubeRT);
    this.pmrem   = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  maybeUpdate(s: SkyState) {
    // Update when the day has advanced 1/200th (≈3.6 s of a 12-min day) — about 0.5 Hz.
    // Far cheaper than per-frame, far smoother than per-phase.
    if (this.lastT >= 0 && Math.abs(shortestAngle(s.t, this.lastT)) < 1 / 200) return;
    this.lastT = s.t;

    this.cubeCam.update(this.renderer, this.skyOnlyScene);
    const next = this.pmrem.fromCubemap(this.cubeRT.texture).texture;
    this.generated?.dispose();                 // free the previous PMREM chain — leaks otherwise
    this.generated = next;
    scene.environment = next;
    scene.environmentIntensity = lerp(0.35, 1.0, s.sunAuthority);
  }
}
```

> **Watch the leak.** `PMREMGenerator.fromCubemap` allocates a new render target every
> call. Disposing the previous one is mandatory; without it you leak ~1 MB every 3.6 s and
> the tab dies in 20 minutes. This is the #1 bug in every "dynamic sky in Three.js" blog
> post.

Optionally double-buffer and blend two PMREMs over the transition to remove the 0.5 Hz
step. In practice the step is invisible because ambient is low-frequency; only add the
blend if QA flags it.

### 10.4 Many lights at night without dying

The town at night wants ~120 streetlights and ~300 lit windows. Three.js forward rendering
will not give you 120 real point lights — each one multiplies fragment cost across every
affected material, and the shader recompiles when the count changes.

Four-tier strategy:

1. **Emissive geometry + bloom** — the light *source* glows. Free. Covers 100% of lights.
2. **Light-pool decals** — a downward-projected additive quad on the ground under each
   lamp, tinted by the lamp color, faded in with `uEmissiveBlend`. All lamps' decals live in
   **one instanced mesh** — 120 lamps = 1 draw call. This is what actually sells "the
   streetlights are lighting the street."
3. **Real `PointLight` pool of 8** — assigned each frame to the 8 nearest lamps to the
   player, from a spatial hash. These give real specular and real falloff on the player and
   nearby props.
4. **Baked AO / bounce** in the vertex colors of static town geometry.

```ts
// systems/LightPoolSystem.ts
const POOL_SIZE = 8;
export class LightPoolSystem implements System {
  private pool: THREE.PointLight[] = [];
  private grid: SpatialHash<LampSource>;

  render() {
    const blend = G.uEmissiveBlend.value;
    if (blend < 0.02) { for (const l of this.pool) l.intensity = 0; return; }

    const near = this.grid.queryNearest(player.position, POOL_SIZE, /*maxDist*/ 28);
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = this.pool[i], src = near[i];
      if (!src) { l.intensity = 0; continue; }
      l.position.copy(src.position);
      l.color.copy(src.color);
      // Fade by distance so a lamp entering/leaving the pool doesn't pop.
      const d = l.position.distanceTo(player.position);
      l.intensity = src.intensity * blend * smoothstep(28, 20, d);
      l.distance = src.range;
      l.decay = 2;
    }
  }
}
```

Keep `POOL_SIZE` **constant** and the lights **always in the scene** (intensity 0 when
unused). Adding/removing lights changes `NUM_POINT_LIGHTS` in the shader defines and
triggers a full recompile of every material — a multi-hundred-millisecond freeze.

---

## 11. Night emissives: windows & streetlights

Everything keys off `G.uEmissiveBlend` (0 by day, 1 at night), which the gradient ramps
between `goldenHour` and `night`.

### 11.1 Standard materials

Patch once, apply to every emissive material:

```ts
export function makeNightEmissive(mat: THREE.MeshStandardMaterial, opts: {
  peak: number;            // emissiveIntensity at full night
  mask?: THREE.Texture;    // which texels glow (window panes, lamp glass)
  flicker?: boolean;
}) {
  mat.emissive = new THREE.Color(opts.color ?? 0xffd9a0);
  mat.onBeforeCompile = (shader) => {
    bindGlobals(shader);
    shader.uniforms.uPeak = { value: opts.peak };
    shader.uniforms.uMask = { value: opts.mask ?? null };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uEmissiveBlend, uPeak, uTime;
        ${opts.mask ? 'uniform sampler2D uMask;' : ''}
        varying float vLightSeed;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float m = ${opts.mask ? 'texture2D(uMask, vUv).r' : '1.0'};
        // Per-instance stagger: windows switch on over ~8% of the cycle, not all at once.
        float onset = smoothstep(vLightSeed * 0.18, vLightSeed * 0.18 + 0.22, uEmissiveBlend);
        ${opts.flicker ? 'onset *= 0.92 + 0.08 * sin(uTime * 11.0 + vLightSeed * 40.0);' : ''}
        totalEmissiveRadiance += emissive * m * onset * uPeak;`);
  };
  mat.customProgramCacheKey = () => `night-emissive-${opts.peak}-${!!opts.mask}-${!!opts.flicker}`;
  return mat;
}
```

`vLightSeed` is a **per-instance attribute** (`InstancedBufferAttribute`) with a random
0–1 per building/window. The staggered switch-on — windows lighting up one by one over
several seconds as dusk falls — is the single most charming detail in the whole day/night
system, and it costs one float per instance.

### 11.2 Lamp glow sprites

Each streetlight gets an additive, camera-facing quad (in one `InstancedMesh`) with a
radial falloff texture, scaled by `uEmissiveBlend`. Fake volumetric glow, essentially free,
and it makes the bloom read as an actual light source rather than a bright pixel.

### 11.3 Interaction with bloom

Emissive intensity `> 1.0` in linear space is what the bloom threshold catches. Set lamp
`peak` around 3–6 and window `peak` around 1.5–2.5; bloom threshold ~1.0 with the strength
driven by `s.bloom` from the gradient (higher at dusk/night). Do not raise bloom to
compensate for dim emissives — you'll wash out the whole frame.

---

## 12. Water system

Requirements: dynamic waves, real-time reflections, and the reflection must track the sky.

Architecture: a custom `ShaderMaterial` combining **Gerstner wave displacement**, a
**planar reflection render target**, a **refraction/depth grab**, and Fresnel blending.

### 12.1 Gerstner waves

Sum 4 Gerstner waves in the vertex shader with analytically-derived normals (no
finite-difference, no normal map dependency for the base shape). Gerstner over simple sine
because it produces sharpened crests and flattened troughs — actual wave shape.

```glsl
// water.vert
uniform float uTime;
uniform vec4 uWaveA, uWaveB, uWaveC, uWaveD;   // xy = direction, z = steepness, w = wavelength
varying vec3 vWorldPos, vWorldNormal;
varying vec4 vScreenPos;

vec3 gerstner(vec4 w, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float k = 6.28318530718 / w.w;               // wave number
  float c = sqrt(9.8 / k);                     // deep-water phase speed
  vec2  d = normalize(w.xy);
  float f = k * (dot(d, p.xz) - c * uTime);
  float a = w.z / k;                            // amplitude from steepness

  tangent  += vec3(-d.x * d.x * w.z * sin(f), d.x * w.z * cos(f), -d.x * d.y * w.z * sin(f));
  binormal += vec3(-d.x * d.y * w.z * sin(f), d.y * w.z * cos(f), -d.y * d.y * w.z * sin(f));
  return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}

void main() {
  vec3 p = position;
  vec3 tangent = vec3(1,0,0), binormal = vec3(0,0,1);
  p += gerstner(uWaveA, position, tangent, binormal);
  p += gerstner(uWaveB, position, tangent, binormal);
  p += gerstner(uWaveC, position, tangent, binormal);
  p += gerstner(uWaveD, position, tangent, binormal);

  vWorldNormal = normalize(cross(binormal, tangent));
  vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vScreenPos = clip;
  gl_Position = clip;
}
```

Total steepness across all waves must stay under 1.0 or the surface self-intersects into
visible loops. Author the four waves as: one long swell (λ=48 m), two mid (λ=18 m, 11 m at
crossing angles), one short chop (λ=5 m).

**Wave query on the CPU:** the same Gerstner sum is implemented in TypeScript so gameplay
can ask "what is the water height at (x,z)?" for buoyancy on floating platforms, splash
placement, and the swim-surface constraint. Keep the two implementations in one shared
constants file so they can't drift.

### 12.2 Planar reflection

Mirror the camera across the water plane, render to a half-resolution target with an
**oblique near clip plane** at the water surface (so geometry below the water doesn't leak
into the reflection).

```ts
// render/Water.ts — reflection pass
export class PlanarReflector {
  private rt: THREE.WebGLRenderTarget;
  private reflCam = new THREE.PerspectiveCamera();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private frameParity = 0;

  constructor(renderer, waterY: number, quality: Quality) {
    const scale = quality === 'high' ? 0.5 : 0.25;
    this.rt = new THREE.WebGLRenderTarget(
      innerWidth * scale, innerHeight * scale,
      { type: THREE.HalfFloatType, depthBuffer: true, samples: 0 });
    this.plane.constant = -waterY;
  }

  update(renderer: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.PerspectiveCamera) {
    // Reflections are low-frequency: updating every other frame is imperceptible on
    // rippling water and halves the cost of the most expensive pass in the game.
    if ((this.frameParity ^= 1) === 0) return;

    reflectCameraAcrossPlane(cam, this.plane, this.reflCam);
    setObliqueNearPlane(this.reflCam, this.plane);      // clip everything below water

    // Reflect only what matters. Layer 2 = "reflectable": sky, terrain, buildings, big props.
    // Excluded: grass instances, small debris, particles, the water itself, and the player's
    // shadow cascades. Typically cuts reflection draw calls by 70%.
    const prevMask = cam.layers.mask;
    this.reflCam.layers.set(REFLECTION_LAYER);

    const prevShadow = renderer.shadowMap.enabled;
    renderer.shadowMap.enabled = false;                 // no shadows in the reflection
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, this.reflCam);
    renderer.setRenderTarget(null);
    renderer.shadowMap.enabled = prevShadow;
  }
}
```

**The sky sync is automatic and free:** the sky dome is on the reflectable layer, so the
reflection buffer contains the current sky. When the sunset turns the sky orange, the lake
turns orange in the same frame, with no extra code. This is exactly why a planar reflection
beats a static cubemap here.

### 12.3 Water fragment shader

```glsl
// water.frag
uniform sampler2D uReflection, uRefraction, uSceneDepth, uNormalMap;
uniform vec3  uSunDirection, uSunColor, uSkyHorizon;
uniform vec3  uShallowColor, uDeepColor;
uniform float uTime, uEmissiveBlend;
uniform vec2  uResolution;
uniform float uCameraNear, uCameraFar;
varying vec3 vWorldPos, vWorldNormal;
varying vec4 vScreenPos;

float linearDepth(float z) {
  float ndc = z * 2.0 - 1.0;
  return (2.0 * uCameraNear * uCameraFar) / (uCameraFar + uCameraNear - ndc * (uCameraFar - uCameraNear));
}

void main() {
  vec2 uv = vScreenPos.xy / vScreenPos.w * 0.5 + 0.5;

  // --- high-frequency detail: two scrolling normal maps over the Gerstner base ---
  vec2 t = vWorldPos.xz * 0.055;
  vec3 n1 = texture2D(uNormalMap, t + vec2( 0.021, 0.014) * uTime).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uNormalMap, t * 1.9 - vec2(0.017, 0.026) * uTime).xyz * 2.0 - 1.0;
  vec3 detail = normalize(vec3(n1.xy + n2.xy, n1.z * n2.z * 3.0));
  vec3 N = normalize(vWorldNormal + vec3(detail.x, 0.0, detail.y) * 0.45);

  vec3 V = normalize(cameraPosition - vWorldPos);

  // --- depth-driven color, foam and shoreline softening ---
  float sceneZ   = linearDepth(texture2D(uSceneDepth, uv).r);
  float surfaceZ = linearDepth(gl_FragCoord.z);
  float waterDepth = max(sceneZ - surfaceZ, 0.0);

  vec3 body = mix(uShallowColor, uDeepColor, smoothstep(0.0, 6.5, waterDepth));

  // --- refraction: distort the scene grab by the surface normal, less when shallow ---
  vec2 distort = N.xz * 0.045 * clamp(waterDepth, 0.0, 1.0);
  vec3 refr = texture2D(uRefraction, uv + distort).rgb;
  refr = mix(refr, body, smoothstep(0.0, 4.0, waterDepth));      // absorb with depth

  // --- reflection: distort by the same normal, flipped in Y (mirrored render) ---
  vec3 refl = texture2D(uReflection, vec2(uv.x, 1.0 - uv.y) + distort * 1.35).rgb;

  // --- Fresnel (Schlick, F0 = 0.02 for water) ---
  float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 col = mix(refr, refl, F);

  // --- sun specular on the wave normals: the glitter path across the lake at golden hour ---
  vec3 H = normalize(uSunDirection + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 420.0) * 2.4;
  col += uSunColor * pow(max(dot(N, H), 0.0), 24.0) * 0.10;      // broad sheen

  // --- shoreline foam: depth-difference band + animated noise mask ---
  float foam = 1.0 - smoothstep(0.0, 0.85, waterDepth);
  foam *= 0.55 + 0.45 * sin(vWorldPos.x * 3.1 + vWorldPos.z * 2.7 + uTime * 2.2);
  col = mix(col, vec3(1.0), clamp(foam, 0.0, 1.0) * 0.75);

  // --- at night, lamps on the shore reflect as streaks; boost reflected emissives ---
  col += refl * uEmissiveBlend * 0.18;

  // --- soft edge so the water plane doesn't cut a hard line into the sand ---
  float alpha = clamp(waterDepth * 2.4, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
```

### 12.4 Getting `uRefraction` and `uSceneDepth`

Three's `MeshPhysicalMaterial` transmission machinery does its own scene grab, which is
expensive and inflexible. Instead, render the opaque scene into an offscreen target with a
depth texture, then draw water in a second pass sampling both:

```ts
const sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
sceneRT.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
// pass 1: opaque scene (water layer disabled) -> sceneRT
// pass 2: water, sampling sceneRT.texture (refraction) + sceneRT.depthTexture -> back to sceneRT
// pass 3: transparents, particles
// pass 4: post-processing chain reads sceneRT
```

`samples: 4` gives you MSAA on the WebGL2 multisampled render target, which handles the
hard edges (foliage alpha-test, thin railings) that post-AA struggles with.

### 12.5 Water quality tiers

| Tier | Reflection | Refraction | Waves |
|---|---|---|---|
| High | Planar RT @ 0.5×, every 2nd frame | Scene grab + depth | 4 Gerstner + 2 normal maps |
| Medium | Planar RT @ 0.25×, every 3rd frame | Scene grab, no depth foam | 3 Gerstner + 1 normal map |
| Low | Env cubemap only (the sky PMREM — still tracks time of day) | Flat color by depth-of-plane | 2 Gerstner |

The low tier still satisfies "reflections respond to the sky" because it reuses the dynamic
sky PMREM from §10.3.

---

## 13. Town, NPCs, and interaction

### 13.1 Architecture style & construction

Whimsical, exaggerated proportions: buildings 1.4× too tall for their footprint, doors
slightly too small, roofs oversized and curved, chimneys tilted. Built from a **kit** of
~40 modular pieces (wall, window, door, roof segment, awning, balcony, sign) so a whole
town is authored from a small asset set and rendered with heavy instancing.

Per-building color variation via a **per-instance color attribute** (`InstancedMesh`
supports `setColorAt`), giving 200 differently-painted houses from one material.

### 13.2 Draw call strategy for the town

This is where a naive build hits 4000 draw calls and 22 fps. The plan:

| Content | Technique | Draw calls |
|---|---|---|
| Building shells (200) | `InstancedMesh` per kit piece, ~40 pieces | ~40 |
| Streetlights (120) | 1 instanced post + 1 instanced glass + 1 instanced glow quad + 1 instanced light decal | 4 |
| Benches, bins, crates | Instanced per type (~15 types) | ~15 |
| Cobblestone streets | Merged into per-block `BufferGeometry` (8 blocks) | 8 |
| Signs & decals | Single texture atlas, one merged mesh | 1–2 |
| Foliage / planters | Instanced, 3 species | 3 |
| NPCs (18 active) | Skinned, individual draws (unavoidable) | ~18 |
| Windows (emissive) | Instanced quads, per-instance seed | 2 |
| **Town total** | | **~95** |

Plus terrain (~25 chunk draws), sky (1), water (1 + reflection pass), player (3), particles
(4), UI (DOM, 0). **Target ≤ 200 draw calls in the town, ≤ 120 in the wilderness.**

### 13.3 Occlusion in the town

Dense town geometry occludes itself heavily but WebGL2 has no cheap hardware occlusion
query workflow that fits a frame budget. Use **authored sector visibility** instead: divide
the town into ~10 sectors; each sector has a hand-authored list of sectors visible from it.
The `StreamingSystem` sets `visible = false` on non-visible sectors' instanced meshes. Crude,
authored, and dramatically effective — this is how games shipped for 20 years before GPU
culling.

Cheaper fallback that needs no authoring: **distance + frustum culling with tightened
bounding spheres**, plus `mesh.frustumCulled = true` (Three does this per-object; ensure
instanced meshes have correct `boundingSphere` set, otherwise they never cull).

### 13.4 NPCs

18 active NPCs in the town. Each:

- Skinned glTF, ~4k triangles, 3 LODs (LOD2 is a non-skinned imposter beyond 40 m — freeze
  the pose and stop the mixer; `AnimationMixer` updates on 18 skeletons is real CPU time).
- A tiny behavior tree: `Idle → Walk(waypoint) → Chat(nearby NPC) → React(player)`.
- **Day/night schedule** driven by `timeofday:phase`: at dusk they path to doorways and
  despawn; at dawn they respawn. Fewer active NPCs at night is both authentic and a free
  performance win at exactly the time the lighting cost peaks.
- Interaction: a trigger sphere + a screen-space prompt; dialogue from JSON with a typewriter
  reveal. Camera hint volume pushes to a closer over-shoulder framing during dialogue.

`AnimationMixer` cost control: update mixers at 30 Hz for NPCs beyond 15 m, 60 Hz for near
ones, and skip entirely beyond 45 m. Skeleton updates are the top CPU cost in a crowd
scene.

---

## 14. Wilderness biomes & platforming

Each biome is a data-driven config: splat weights, prop spawn tables, fog overrides, audio
bed, particle system, and a distinct traversal verb.

| Biome | Look | Traversal verb | Day/night hook |
|---|---|---|---|
| **Grassland** | Rolling hills, wind-swept grass, scattered boulders | Long jumps across gaps; rolling down slopes | Fireflies at night; grass tint shifts cool |
| **Forest** | Dense canopy, dappled light, vines, mushroom platforms | Vertical climbing, vine swings, bouncy mushrooms | God rays through canopy at dawn/dusk; glowing fungi at night |
| **Desert** | Dunes, mesas, ruins, quicksand | Wall-climb on mesas, dune sliding | Extreme temp shift: blazing white noon → deep blue night, +stars |
| **Canyon** | Deep chasms, arches, rock walls | Climbing, ledge grabs, timed falling rocks | Long shadows fill the canyon early; near-black at night, lit by crystals |
| **Snow** | Peaks, ice sheets, drifts | Low-friction ice physics, snow-depth slowdown | Aurora at night; blue-hour ambient; snow SSS at low sun |

**Wind and vegetation:** grass and foliage use a shared vertex-shader wind function reading
`G.uWindDir` / `G.uWindStrength`, plus per-instance phase offset. Grass is an
`InstancedMesh` of 3-quad clumps, ~40k instances in the hot ring, faded by distance and
frustum-culled per chunk. This alone will be a large fraction of your vertex cost — cap
instance count per quality tier.

**Platforming primitives** shared across biomes: moving platforms (kinematic bodies on
spline paths), crumbling platforms, bounce pads, swinging ropes, one-way collision
platforms, checkpoint flags. All authored as prefabs in JSON, all physics-driven.

---

## 15. Post-processing

One merged pass via `postprocessing`'s `EffectComposer` (it composites multiple effects
into a single fragment shader — critical, since N separate passes means N fullscreen
ping-pongs on a bandwidth-limited laptop GPU).

Chain, in order:

1. **Bloom** — threshold 1.0, radius 0.7, intensity driven by `s.bloom` (0.2 day → 0.55
   night). Uses mip-chain downsampling; keep to 5 mips.
2. **Tone mapping** — AgX. Exposure driven by `s.exposure`.
3. **Color grade LUT** — a 32³ 3D LUT, *two* of them (day LUT and night LUT), blended by
   `uEmissiveBlend`. This is the cheapest, most powerful art-direction lever you have: the
   colorist can push the whole night palette cyan-magenta without touching a single
   material.
4. **Vignette** — subtle, 0.25 strength; slightly stronger at night.
5. **SMAA** — since MSAA on the scene RT handles geometry edges, SMAA is mostly cleaning up
   specular aliasing. On the low tier, drop SMAA entirely and rely on the 4× MSAA RT.

**Explicitly not shipping:** SSAO (bake AO into textures + vertex colors instead — a
stylized game doesn't need contact darkening it can't art-direct), SSR (planar reflection
covers the only reflective surface that matters), motion blur (hurts platformer
readability), DoF (same), volumetric light shafts (use billboard god-ray cards in the
forest instead — 1 draw call vs. a raymarch).

---

## 16. Asset pipeline

| Stage | Tool | Output |
|---|---|---|
| Modeling | Blender | `.blend` source |
| Export | glTF 2.0 (`.glb`) | one file per kit/character |
| Mesh compression | `gltfpack -cc` (meshoptimizer) | ~4–6× smaller, fast GPU-side decode |
| Texture compression | `toktx` / `basisu` → **KTX2 / UASTC** for normals & albedo, **ETC1S** for masks/roughness | 4–8× VRAM reduction, GPU-native |
| LOD generation | `gltf-transform` simplify, 3 levels (100/45/18%) | baked into the same `.glb` |
| Heightmaps | Gaea → 16-bit PNG tiles | 64×64 per chunk |
| Atlasing | Custom Node script | props share one 2048² atlas per material family |

Rules:

- **KTX2 is not optional.** A 2048² RGBA PNG is 16 MB in VRAM; the same as KTX2/UASTC is
  ~4 MB and uploads without a decode stall. With ~60 textures this is the difference
  between 900 MB and 250 MB of VRAM.
- **Texture budget:** albedo 1024², normal 1024², ORM (occlusion/roughness/metal packed into
  RGB of one texture) 512². Hero assets (player, key buildings) may go 2048².
- **Draco vs meshopt:** meshopt. Draco decode is slower and needs a bigger WASM blob;
  meshopt decodes at ~1 GB/s and works with `EXT_meshopt_compression` natively.
- Load order: (1) player + town core + sky/water shaders → playable, (2) nearby biomes,
  (3) distant biomes, (4) audio. Show the world as soon as tier 1 lands.
- **Shader pre-warm:** after asset load, place one instance of every material archetype in
  front of an offscreen camera and `await renderer.compileAsync(scene, camera)`. Skipping
  this means a 200 ms freeze the first time the player sees a new material — which will
  happen at the exact moment they enter a new biome.

---

## 17. Performance optimization checklist

### Frame budget @ 60 fps (16.6 ms)

| Pass | Budget |
|---|---|
| Shadow maps (throttled cascades) | 2.2 ms |
| Water planar reflection (half-res, every other frame) | 1.6 ms amortized |
| Opaque scene | 5.5 ms |
| Water + transparents + particles | 1.4 ms |
| Post-processing (merged) | 1.8 ms |
| CPU: physics + systems + streaming | 3.0 ms |
| Headroom | 1.1 ms |

### Draw calls & geometry

- [ ] ≤ 200 draw calls in the town, ≤ 120 in the wilderness (assert in dev via `renderer.info.render.calls`)
- [ ] ≤ 1.5 M triangles rendered per frame
- [ ] Every repeated prop is an `InstancedMesh`; every static unique cluster is merged with `mergeGeometries`
- [ ] Instanced meshes have a correct `boundingSphere` — otherwise they are never frustum-culled
- [ ] Small props (< 0.4 m) never cast shadows; use blob decals
- [ ] LOD switching via `THREE.LOD` with hysteresis on the distance thresholds (prevents pop-thrash at a boundary)
- [ ] Sort opaque front-to-back (Three does this by default — do not disable it by setting `renderOrder` casually)
- [ ] `object.matrixAutoUpdate = false` on every static object; call `updateMatrix()` once

### Shaders & materials

- [ ] Every `onBeforeCompile` material defines `customProgramCacheKey` — non-negotiable
- [ ] Total unique shader programs ≤ 40 (log `renderer.info.programs.length` in dev)
- [ ] `renderer.compileAsync()` pre-warm for all archetypes before gameplay starts
- [ ] Zero material creation, texture creation, or `needsUpdate = true` inside the render loop
- [ ] Point light pool is a **fixed size**, always in the scene — never add/remove lights at runtime
- [ ] Shared uniforms passed **by reference** through `bindGlobals`, never copied per material

### Textures & memory

- [ ] All textures KTX2 (UASTC for normal/albedo, ETC1S for masks); zero raw PNG/JPG in the shipping build
- [ ] Occlusion/Roughness/Metalness packed into one RGB texture
- [ ] `texture.generateMipmaps` off for render targets; `anisotropy` capped at 4
- [ ] VRAM budget ≤ 400 MB (measure with `WEBGL_debug_renderer_info` + `renderer.info.memory`)
- [ ] Disposal audit: `geometry.dispose()`, `material.dispose()`, `texture.dispose()`, **and the PMREM render target** on chunk unload. Run a 30-minute soak test watching `renderer.info.memory` — it must be flat.

### Shadows

- [ ] 3 cascades max, 2048² each, `maxFar` 320 m (not the camera's far plane)
- [ ] `shadowMap.autoUpdate = false`; per-cascade refresh throttling (1 / 2 / 6 frames)
- [ ] `normalBias` tuned per sun elevation, not a fixed value
- [ ] Shadow camera bounds fitted to the cascade frustum, not the whole world

### CPU

- [ ] Chunk mesh generation in a Worker with transferable `ArrayBuffer`s
- [ ] Max 1 chunk geometry upload per frame
- [ ] Object pooling for particles, projectiles, coins, and audio nodes — zero per-frame allocation in hot paths
- [ ] Pre-allocated scratch `Vector3`/`Quaternion`/`Matrix4` at module scope; never `new THREE.Vector3()` in an update
- [ ] `AnimationMixer` updates throttled by distance (60/30/0 Hz bands)
- [ ] Spatial hash for proximity queries (light pool, NPC triggers, collectibles) — never a linear scan over all entities
- [ ] Physics: convex hulls and heightfields for collision, never the render mesh as a trimesh

### Adaptive

- [ ] Dynamic resolution: measure a 30-frame rolling GPU time; scale `renderer.setPixelRatio` between 0.65× and device DPR to hold the target frame time. Change in steps of 0.1 with a 1 s cooldown, so it doesn't oscillate visibly.
- [ ] Auto-detect tier at boot from `WEBGL_debug_renderer_info` + a 2-second calibration burn-in; let the user override
- [ ] Degrade in this order under load: grass density → reflection resolution → shadow cascade count → post-FX → pixel ratio. Never degrade the player character or the sky.

### Load & startup

- [ ] Time-to-first-frame < 4 s on cable broadband; time-to-playable < 8 s
- [ ] Stream tier 1 assets first; the loading screen shows the actual world, not a spinner
- [ ] `Cache-Control: immutable` on hashed asset filenames; serve `.glb`/`.ktx2` with Brotli
- [ ] Service worker caches assets so a second visit is near-instant

### Instrumentation

- [ ] In-dev overlay: fps, CPU ms, GPU ms (`EXT_disjoint_timer_query_webgl2`), draw calls, triangles, programs, texture memory, chunk count, active lights
- [ ] Assert-on-regression in CI: a headless run of a fixed camera flythrough that fails the build if draw calls or triangles exceed budget
- [ ] `performance.mark`/`measure` around each system, surfaced in the overlay as a stacked bar

---

## 18. Quality tiers & scaling

| Setting | Low | Medium | High |
|---|---|---|---|
| Pixel ratio | 0.65–1.0 | 1.0 | up to 2.0 |
| Shadow cascades | 1 @ 1024² | 2 @ 2048² | 3 @ 2048² |
| Shadow distance | 90 m | 180 m | 320 m |
| Water reflection | Sky cubemap | Planar 0.25×, 1/3 frames | Planar 0.5×, 1/2 frames |
| Gerstner waves | 2 | 3 | 4 |
| Grass instances (hot ring) | 6 k | 18 k | 40 k |
| Streaming radius | 5 chunks | 7 | 9 |
| Point light pool | 4 | 6 | 8 |
| Post-FX | Bloom + LUT | + SMAA + vignette | Full chain |
| Env probe rate | 1/400 of a day | 1/200 | 1/200, double-buffered |
| NPC count | 8 | 14 | 18 |
| Target | 30 fps | 60 fps | 60 fps |

---

## 19. Milestones

| # | Deliverable | Weeks | Definition of done |
|---|---|---|---|
| M0 | Engine skeleton | 1 | Fixed-step loop, renderer, asset loader, dev overlay, profiler |
| M1 | **Vertical slice of feel** | 2 | Capsule on a heightmap; full jump/climb move set; camera. *Locks game feel before art exists.* |
| M2 | Terrain + streaming | 2 | 2 km world, chunked LOD, worker streaming, cliffs, splat material |
| M3 | **Day/night + lighting** | 2 | TimeOfDay controller, sky shader, CSM, dynamic PMREM, gradient authoring tool |
| M4 | Water | 1.5 | Gerstner, planar reflection, refraction, foam, CPU height query |
| M5 | Town | 3 | Modular kit, instancing, sector culling, streetlights, night emissives, NPCs |
| M6 | Wilderness biomes | 3 | 5 biomes, biome-specific traversal, prop scatter, wind |
| M7 | Gameplay layer | 2 | Collectibles, checkpoints, moving platforms, objectives, save/load |
| M8 | Polish & perf | 3 | Budgets met on all tiers, soak-test clean, LUT grading, audio, SFX |

M3 before M5 is deliberate: the town's art direction (paint colors, emissive intensities,
material roughness) can only be judged under the real lighting system. Building the town
under a placeholder light means repainting it later.

**Build the gradient authoring tool in M3.** A dev panel with a time scrubber, a day-length
slider, and live color pickers bound to the keyframe JSON — with export. Without it, tuning
the day/night cycle means an edit-reload cycle per tweak, and the cycle will end up
under-tuned, which is fatal for the thing the game is selling.

---

## 20. Known risks

1. **Shader program explosion.** The most likely cause of a shipped build that hitches.
   Mitigation: hard cap of 40 programs asserted in CI, mandatory `customProgramCacheKey`,
   `compileAsync` pre-warm.

2. **The PMREM leak (§10.3).** Will kill a long play session. Mitigation: explicit dispose
   + a 30-minute automated soak test in CI watching `renderer.info.memory.textures`.

3. **Town draw calls.** A naively-authored town is 10× over budget and cannot be fixed
   cheaply after the fact. Mitigation: the kit-piece constraint is an *art pipeline rule*
   from day one, plus an automated check that fails the asset build if a town scene exceeds
   its instance-group count.

4. **Water reflection cost on integrated GPUs.** Mitigation: tiered fallback to the sky
   cubemap, which still tracks time of day, so the low tier loses fidelity but not the
   feature.

5. **Sun-at-horizon shadow artifacts.** Near-grazing light produces acne and shadows that
   stretch past the cascade. Mitigation: elevation clamp at 4°, elevation-driven
   `normalBias`, and fading shadow *strength* to zero across the horizon crossing rather
   than letting geometry go dark.

6. **Mobile.** Out of scope for v1. WebGL2 on mid-range Android will not hold this frame
   budget with planar reflections and cascaded shadows. If mobile becomes a requirement,
   plan a separate low-tier scene setup, not a settings toggle.
