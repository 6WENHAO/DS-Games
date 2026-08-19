# 箱庭小镇 · MODULE CONTRACT (read this fully before writing code)

A stylised **3-D diorama town** (箱庭 / hakoniwa) built with **three.js r152 UMD**, plain
classic scripts (no ES modules) so `index.html` runs straight from `file://`.

Project root: `/home/admin/0819测试`

```
index.html
js/vendor/three.min.js      three r152 (UMD, global THREE)
js/core/core.js             TOWN namespace: U, noise, Palette, Tex, Mat, Env, Ticker, Stage
js/core/geo.js              TOWN.Geo geometry toolkit  (29 helpers, all verified)
js/world/*.js               <-- asset modules (one per author)
tools/probe.sh              headless Chromium/WebGL prober — USE THIS TO VERIFY
```

---

## 1 · Absolute rules

1. **Create only your own assigned file.** Never edit `core.js`, `geo.js`, `index.html`,
   `tools/*`, or another author's module. No new dependencies, no network, no asset files.
2. **Classic script only.** Wrap everything in an IIFE; attach one namespace object:
   ```js
   (function (global) {
     'use strict';
     const T = global.THREE;
     const TOWN = global.TOWN;
     const { U, Geo, Mat, Palette: P } = TOWN;
     const MyMod = TOWN.MyMod = {};
     /* ... */
   })(window);
   ```
   No `import`, no `export`, no `require`, no top-level `await`, no optional chaining
   in hot loops (fine elsewhere), no classes-in-globals collisions.
3. **Every material comes from `TOWN.Mat`.** Never `new THREE.MeshStandardMaterial(...)`
   in an asset module. Shared materials are what make the static merger collapse a
   60-part building into ~4 draw calls. (Exception: the `sky`/`fx` authors may create
   `ShaderMaterial`/`PointsMaterial` where genuinely required.)
4. **Deterministic.** Every factory takes `opts.seed` (a number) and uses
   `const r = U.rng(opts.seed || 1)` for *all* randomness. Never call `Math.random()`.
5. **Never throw on missing opts.** `opts = opts || {}` and default everything.

---

## 2 · Units, orientation, origin  (get this wrong and nothing lines up)

* **1 unit = 1 metre.** `Y` is up. The town lies in the `XZ` plane.
* A factory returns a **`THREE.Group`** whose **origin is the centre of its footprint,
  sitting on the ground plane `y = 0`**. Nothing may dip below `y = -0.05` unless it is
  explicitly a foundation/underwater part.
* **Buildings and props face `+Z`** (front door / shopfront / main facade toward `+Z`).
  The placement code rotates the group about `Y`.
* Every returned group **must** set:
  ```js
  g.userData.footprint = { w: <x-extent>, d: <z-extent> };  // metres
  g.userData.height    = <max y>;
  g.userData.kind      = 'cottage';                          // factory name
  ```
* Shadows: `TOWN.mesh(geo, mat, x, y, z)` already sets `castShadow`/`receiveShadow`.
  Use it instead of `new THREE.Mesh` where convenient.

Reference tiers used by the layout (for scale intuition only — do **not** offset your
geometry by these):

| tier | y | contents |
|---|---|---|
| sea | 0.0 | water |
| harbour | 1.6 | docks, warehouses, fish market |
| town | 4.2 | main square, shops, town hall, tram |
| terrace | 8.4 | houses, church, windmill, gardens |
| hill | 13.2 | observatory, lookout, big tree |

---

## 3 · THE ANTI-CUBE MANDATE (the single most important quality rule)

The brief explicitly demands: **注意高低错落，避免变成小方块堆砌** — *vary the heights,
never let it become a pile of little cubes.* Enforced as follows.

* **Never use a bare `new THREE.BoxGeometry` as a visible primary mass.** For any wall
  block use `Geo.chamferBox(w,h,d,c)`, `Geo.taperBox(...)` or `Geo.prism(plan,h)`.
  Bare boxes are fine only for small details (sills, bars, planks, muntins, steps).
* **Every building carries a real roof** from `Geo`: `gableRoof`, `hipRoof`,
  `mansardRoof`, `barrelRoof`, `pyramidRoof`, `coneRoof`, `bellSpire`, `domeRoof`,
  `sawtoothRoof` — always with an **eaves overhang** (`over`) so a shadow line
  separates roof from wall.
* **Each building must break its own silhouette with ≥ 3** of: chimney (with a cap),
  dormer window, balcony, bay/oriel window, awning, cornice/string course, projecting
  wing or setback upper floor, roof railing/parapet, signboard, chimney pot, vent,
  turret, external stair, roof terrace, weather-vane, antenna.
* **Facade depth is mandatory:** recess window panes ~0.06 behind the wall face, add
  sills, add a plinth/base course, add a lintel or shutter. A flat painted rectangle
  reads as a cube face; a 6-cm reveal does not.
* **Height variety inside multi-part factories:** in any row/cluster you generate,
  adjacent units must differ in height by ≥ 0.8 m and vary roof type and wall colour.
* **Avoid axis-alignment monotony:** where a factory places sub-parts, allow small
  rotations (±2–6°) and offsets.

---

## 4 · API you build on

### 4.1 `TOWN.U` — math & random
```
clamp saturate lerp invLerp smoothstep smootherstep damp mod angleDelta hash
rng(seed) -> f()               f.range(lo,hi) f.int(lo,hi) f.pick(arr)
                               f.pickW([[v,w],...]) f.chance(p) f.sign() f.bell()
                               f.shuffle(arr)
TOWN.noise.fbm(x,y,oct?,lac?,gain?)   TOWN.noise.n2(x,y)   TOWN.noise.ridged(x,y,oct?)
TOWN.makeNoise(seed) -> {n2, fbm, ridged}
```

### 4.2 `TOWN.Palette` (alias `P`) — use these names, do not invent hex codes
```
terrain : grass grassDark grassDry soil soilDark rock rockDark sand sandWet
          stone stoneDark stoneWarm cobble asphalt asphaltLight concrete
water   : water waterDeep waterShallow foam
walls   : wallCream wallIvory wallSand wallPeach wallRose wallMint wallSky
          wallLilac wallOchre wallBrick wallBrickDark wallTerra wallGrey wallOlive
roofs   : roofRust roofRed roofTerracotta roofBlue roofSlate roofTeal roofGreen
          roofBrown roofPlum roofCharcoal roofCopper
matter  : wood woodDark woodLight woodGrey timber metal metalDark iron brass
          copper gold white offWhite black glass glassDark
plants  : leafSpring leafDeep leafLime leafOlive leafPine leafPineDark leafAutumn
          leafRust leafPink leafPurple bark barkLight hedge
accents : flowerRed flowerYellow flowerWhite flowerPink flowerBlue flowerOrange
          awningRed awningGreen awningBlue awningYellow awningCream
          fabricWhite fabricRed
lights  : lampWarm lampCool windowWarm windowCool neonPink neonCyan fire
          headlight taillight
```

### 4.3 `TOWN.Mat` — materials (always cached & shared)
```js
Mat.std(colorHex, {rough, metal, flat, side, transparent, opacity, map,
                   emissive, emissiveIntensity, vertexColors, name})
Mat.basic(colorHex, {transparent, opacity, side, additive, depthWrite, map, toneMapped})
Mat.window(group /*0..7*/, {cool, tint})   // glazing that lights up after dusk
Mat.lamp(colorHex, {max, flick})           // lantern globe: dark by day, glowing at night
Mat.neon(colorHex)                         // sign: strong night glow + slight flicker
Mat.glow(colorHex, intensity)              // always emissive
Mat.registerNight(mat, {on, max, flick}, seed)   // make any material follow the cycle
```
**Windows:** spread `Mat.window(i)` groups across a facade (`i = r.int(0,7)`), so that
at night some rooms are lit warm, one flickers like a TV, and group `6` stays dark.
That staggering is a headline feature of the scene — use it on every glazed opening.

### 4.4 `TOWN.Geo` — geometry toolkit (all verified NaN-free)
```
fromQuads(verts, faces)          box(w,h,d)                chamferBox(w,h,d,c)
taperBox(w,h,d,sx,sz?)           prism(plan2d,h,{center,y0,cap})
polyPlan(sides,r,rot?)           roundRectPlan(w,d,r,seg?,jitter?,rng?)
gableRoof(w,d,h,{over,thick,ridgeShift})    hipRoof(w,d,h,{over,ridge})
pyramidRoof(w,d,h,{over})        mansardRoof(w,d,h,{over,knee,inset,cap})
barrelRoof(w,d,h,seg,{over,thick})          coneRoof(r,h,sides)
bellSpire(r,h,sides,curve?)      domeRoof(r,h,sides,ogee?)   sawtoothRoof(w,d,h,teeth)
lathe(profile[[r,y]],sides)      taperTower(rB,rT,h,sides,{pow,bulge,steps})
ring(rIn,rOut,h,sides)           torus(r,tube,seg,rad)
archShape(w,h,arcH)              archWall(w,h,d,[{x,y,w,h,arc}])
frame(w,h,t,d)                   muntins(w,h,cols,rows,t,d)
stairs(width,rise,run,steps)     curvedStairs(rIn,rOut,rise,steps,arcRad)
railing(len,h,{spacing,postR,style:'baluster'|'bar'})
retainingWall(polyline2d,h,{thick,batter})
ribbon(points3d,width,{widthFn}) catmullPath(pts,closed,samples) -> {curve, poly}
tube(points3d,radius,radialSeg,closed?)     catenary(a,b,sag,radius,seg) -> {geo,pts}
mergeGeometries([geo,...])       mergeStatic(root,{castShadow,receiveShadow})
instanced(geo, mat, [{p:[x,y,z], r:ry|[rx,ry,rz], s:s|[sx,sy,sz], c:hex}], {castShadow})
applyVertexNoise(geo,amp,freq,noise?)       paint(geo, (color,x,y,z,i)=>{})
at(geo,x,y,z,ry?)                sizeOf(obj3d) -> {size, box}
fixNormals(geo)
```
`Geo.instanced` is the tool for anything repeated > ~12 times (leaves, flowers, fence
posts, cobbles, roof tiles, crowd). Instanced meshes are automatically kept out of the
static merger.

### 4.5 `TOWN.Ticker` — animation
```js
TOWN.Ticker.add(function (dt, elapsed, Env) { /* ... */ }, 'name');
TOWN.Ticker.add(fn, 'name', { always: true });   // keeps running when dynamics are OFF
```
* `dt` = seconds since last frame (already clamped), `elapsed` = seconds since start.
* Anything that moves **must** be inside a group marked `TOWN.markDynamic(grp)`, or the
  static merger will bake it into place and it will stop moving. Instanced meshes are
  already exempt.
* A ticker that throws is auto-disabled and logged — but don't rely on it; keep them cheap.
* Keep per-frame work small: no geometry rebuilds per frame except for small point clouds.

### 4.6 `TOWN.Env` — read-only environment state (written by the sky module)
```
hours 0..24 | dayF 0..1 | nightF | duskF | lampF 0..1 | sunUp bool
sunDir moonDir (THREE.Vector3, normalised, origin -> body)
sunColor fogColor horizonColor zenithColor (THREE.Color)
elapsed dt quality reduced
```

### 4.7 `TOWN.Stage` — shared scene refs (the app fills these in)
```
scene camera renderer sunLight moonLight hemi groups{}
nightLights[]   // push real PointLights here; the app budgets/culls them
nightOnly[]     // objects auto-hidden by day (stars, beams, fireflies)
dayOnly[]
```
Real lights are expensive: **at most 2 `PointLight`s per module**, pushed to
`TOWN.Stage.nightLights`. For lamp/window glow use `Mat.lamp` + an additive sprite halo.

### 4.8 misc
```js
TOWN.mesh(geo, mat, x, y, z)   // Mesh with shadows on
TOWN.group('name')
TOWN.markDynamic(obj)          // exempt a subtree from static merging
TOWN.Tex.canvas(key, w, h, (ctx,w,h)=>{...}, {repeat:[u,v], wrap})  // cached CanvasTexture
TOWN.Tex.radialGlow(key, hardness)                                  // soft round gradient

// additive sprite halo that fades in with the night — use this instead of
// real lights for every lamp, lantern, window spill, headlight and neon sign
TOWN.halo(colorHex, size, {max, on, always, hardness, flick}) -> THREE.Sprite
```
A lamp is therefore: post + arm + `Mat.lamp()` globe + `TOWN.halo(P.lampWarm, 2.2)`
parented at the globe. Zero lights, and it blooms on at dusk automatically.


---

## 5 · Performance budget

| thing | budget |
|---|---|
| small house / prop | ≤ 900 triangles |
| landmark building | ≤ 3 500 triangles |
| tree | ≤ 500 triangles |
| whole module | ≤ 45 000 triangles for a typical call set |
| distinct materials per module | ≤ 25 (reuse!) |
| real lights per module | ≤ 2 |
| particles per module | ≤ 1 500 |

Prefer: instancing, shared geometry (build a geometry once outside the factory and
reuse it — `Geo.at(geo, x, y, z)` clones with an offset), low segment counts
(cylinders 5–10 sides, spheres 8–12), `flat: true` shading for a crafted look.

---

## 6 · Verify your work — mandatory

`tools/probe.sh` loads three.js + core + geo + your file in real headless
Chromium/WebGL, evaluates expressions, and reports triangle counts, bounds, material
counts, NaN geometry and every console error.

```bash
cd /home/admin/0819测试

# probe individual factories
./tools/probe.sh --files js/world/YOURFILE.js \
  --expr "TOWN.MyMod.cottage({seed:1})" \
  --expr "TOWN.MyMod.cottage({seed:7})"

# list exports / run arbitrary checks
./tools/probe.sh --files js/world/YOURFILE.js \
  --eval "return Object.keys(TOWN.MyMod)"
```
Per-expression output: `ok, meshes, instancedMeshes, instances, triangles, materials,
geometries, dynamicNodes, lights, sprites, size:[x,y,z], center, minY, maxY, matNames`.
Exit code is non-zero if any error was collected.

**Your file is done only when, for EVERY exported factory and ≥ 5 different seeds:**
1. `errors: []` — zero console errors, zero page errors.
2. `ok: true`, no `nan`, finite `size`.
3. `size` matches the spec'd footprint (± 25 %) and `minY >= -0.05`.
4. `triangles` within budget.
5. `userData.footprint` / `height` / `kind` are set — check with
   `--eval "const g=TOWN.MyMod.cottage({seed:2}); return g.userData"`.
6. Seeds visibly differ: check with
   `--eval "return [1,2,3,4,5].map(s=>{const g=TOWN.MyMod.cottage({seed:s}); return [g.userData.height.toFixed(2), TOWN.Geo.sizeOf(g).size.x.toFixed(2)]})"`
   → the heights must **not** all be equal (anti-cube rule 3).

Write a short `// ---- probe results ----` comment block at the end of your file with
the final numbers you measured.

---

## 7 · Style target

Warm, hand-crafted storybook realism — think *Monument Valley* meets a Studio-Ghibli
seaside village, at ~1:100 scale. Chunky readable forms, soft flat-ish shading, no
textures needed beyond the occasional `Tex.canvas` sign or clock face. Everything must
still read clearly from a 60-metre orbiting camera: silhouette first, then the small
delights you find when you zoom in (a cat on a wall, laundry on a line, a bicycle
leaning on a fence).
