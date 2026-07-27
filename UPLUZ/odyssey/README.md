# CLOUDROAD — week 1–3 technical risk slice

The grey-box prototype from §5.11 step 1 of [the concept proposal](docs/CLOUDROAD_concept_design.md).
No art. Its only job is to answer the ship-or-redesign question: **can this world run
at 60 fps in a browser tab before anyone paints anything?**

```bash
npm install
npm run dev          # http://localhost:5180
```

Controls: **WASD** move · **Space** jump, hold to glide · **E** Call · mouse look
(click to capture) · **P** toggle the perf HUD.

## What is actually implemented

| System | File | Notes |
|---|---|---|
| Heightfield | `src/world.js` | 1024² baked once; `Float32Array` on the CPU for collision, RGBA16F on the GPU (R = height, GBA = normal) so terrain and grass share one surface |
| Terrain streaming | `src/terrain.js` | 4 LOD levels, **one geometry per level shared by every chunk**, skirts for seam cracks, manual frustum culling against per-chunk spheres |
| Grass | `src/grass.js` | 3 tiers (7/3/1 tris), one instance buffer per tier shared by all chunks, 90° per-chunk rotation to break tiling. Terrain snap, wind, player push, distance dissolve and the wake all happen in the vertex shader — zero CPU work per blade |
| Bloom wake | `src/wake.js` | The 1024² splat texture. R = walk trail, G = Call bloom. Re-centres by blitting itself with a UV offset |
| Response system | `src/response.js` | 16 m spatial hash; a Call queries 9 cells. Chime stones answer as the pulse reaches them, not all at once |
| Controller | `src/player.js` | Four verbs. Glide runs on Bloom; at zero you land softly. No fail state anywhere |
| Sky | `src/sky.js` | Gradient LUT dome, 3 parallax layers of painted cloud cards, the Long One on an 11-minute orbit, procedural motes |
| Post | `src/post.js` | One merged pass: SMAA → bloom → grade/grain/vignette/dither |

## Dev harness

`?dev=1` skips the title gate, keeps the loop alive while the tab is backgrounded, and
exposes `window.__cloudroad` (including `bench()`). Overrides: `?aa=0|1|2 &pr=1.25 &grass=0.5`.

## Measured — M1, Chrome, 1440×900 CSS

`window.__cloudroad.bench()`, standing mid-field with hills across the frame.
Timed by forcing a pipeline flush with a 1×1 `readPixels` on the default framebuffer
(`EXT_disjoint_timer_query` is advertised by ANGLE/Metal but never resolves in-task).

| Config | Buffer | Frame | Scene | Grass | Post |
|---|---|---|---|---|---|
| pr 1.75 + SMAA HIGH | 3.97 MP | **12.4 ms** | 4.3 | 2.5 | 8.1 |
| pr 1.75, no AA | 3.97 MP | 9.4 ms | 5.0 | 2.3 | 4.4 |
| **pr 1.25 + SMAA MEDIUM** (shipping default) | 2.02 MP | **8.6 ms** | 4.7 | 3.3 | 4.0 |
| pr 1.25, no AA | 2.02 MP | 6.4 ms | 3.9 | — | 2.5 |

~100 draw calls, 730k–1.33M triangles, 155k–300k blades, 23 MB JS heap.

### What the numbers changed

- **Post-processing was the bottleneck, not grass.** The proposal budgeted ~0.6 ms for
  bloom; the real merged pass costs 2.5–4 ms. Bloom itself is nearly free — changing its
  resolution scale from 1.0 to 0.25 moved the total by 0.06 ms — so the cost is SMAA plus
  the fullscreen blend over a half-float buffer.
- **Pixel ratio capped at 1.25, not 1.75.** The extra 2 megapixels cost ~3 ms and are
  invisible under bloom, grain and SMAA. Resolution is the cheapest thing to give back.
- **SMAA MEDIUM, not HIGH.** HIGH costs ~3 ms at 4 MP and is indistinguishable through
  the grade.
- **The scene is vertex/draw bound, not fill bound** — halving the pixel count barely
  moved `scene_ms`. Grass LOD tiers are the lever, resolution is not.
- Peak views reach ~1.33 M triangles, over the proposal's 1.2 M line, at 15 blades/m².
  The millisecond cost is fine; the triangle budget was set conservatively.

### Two bugs worth remembering

- **MSAA on a half-float composer buffer renders black** on Chrome/macOS/ANGLE-Metal.
  No error, no warning — just a black frame. `multisampling: 0` + SMAA instead.
- **A stratified scatter with a partial last row** leaves an unseeded strip along one edge
  of every chunk. Once chunks are rotated, that reads as a bald corridor running to the
  horizon. The instance grid must be square and complete.

## Not in the slice

Audio is synthesised rather than streamed; there is no asset pipeline (nothing is loaded
from disk — the world is generated at boot), no save state, no chapters beyond the meadow,
and no murals, keepsakes or whispers. Those are vertical-slice work, not risk work.
