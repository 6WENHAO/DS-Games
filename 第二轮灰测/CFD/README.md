# CFD-SPH-BENCH 1.0.0

A 3D real-time fluid dynamics simulator and GPU/CPU benchmark for the browser.
A weakly-compressible water block is solved with hand written smoothed particle
hydrodynamics inside a closed glass cube and rendered as lit sphere impostors.

**Zero dependencies.** No physics engine, no three.js, no CDN, no build step, no
network access. Raw WebGL2 plus plain ES5-compatible JavaScript. The container
size, the particle seed and the timestep are fixed, so a run is reproducible and
two machines can be compared directly.

## Running

Open `index.html` in any browser with WebGL2 (Chrome, Edge, Firefox, Safari 15+).
Scripts are loaded as classic scripts on purpose, so opening the file directly
from disk (`file://`) works; no local server is required. If you prefer one:

    python -m http.server 8000        # then open http://localhost:8000/

Optional query parameters: `?count=3500` initial particle count,
`?warm=90` advance the simulation 90 steps before the first frame (deterministic
screenshots).

## Layout

    index.html                    interface shell
    css/style.css                 instrument styling (square, shadowless, monospace)
    js/mat4.js                    4x4 matrix helpers (perspective, lookAt, multiply)
    js/sph.js                     the fluid solver - all physics lives here
    js/renderer.js                WebGL2 renderer: impostors, glass shell, GPU timer
    js/benchmark.js               warmup/sampling state machine, statistics, export
    js/main.js                    fixed-step loop, telemetry, controls, orchestration
    test/node-selftest.js         headless physics verification (node)
    test/stress.js               worst-case physics cost measurement (node)
    test/gl-verify.html           framebuffer readback assertions on the renderer
    test/gl-scene.html            renders the scene alone, for pixel inspection
    test/fallback-verify.html     asserts graceful degradation with no WebGL2
    test/error-verify.html        asserts error reporting never blocks the tool
    test/bench-verify.html        end-to-end benchmark path assertions
    test/layout-verify.html       DOM geometry and style-contract assertions
    test/screenshot-harness.html  deterministic static capture of the full interface

## The physics

Scene scale is fixed: a 1.00 x 1.00 x 1.00 m closed container, x and z in
[-0.5, 0.5], y in [0, 1]. The fluid is always 0.304 m^3 of water at
rho0 = 1000 kg/m^3, started as a dam-break column against the -X wall. Because
the volume is fixed, particle spacing follows from the count,
d = (0.304 / N)^(1/3), and the smoothing radius is h = 2d, which keeps the
neighbourhood at roughly 28 particles for every count in the 2500..4000 range.
Particle mass is calibrated numerically so that a perfect lattice at spacing d
reads exactly rho0 (m = rho0 / sum W over the lattice), rather than assumed.

Density uses the poly6 kernel, constraint gradients the spiky kernel:

    W(r)      = 315/(64 pi h^9) (h^2 - r^2)^3
    grad W(r) = -45/(pi h^6) (h - r)^2 * r_vec/r

Each substep runs: gravity integration with a CFL speed clamp
(|v| <= 0.9 h/dt, so no particle can cross more than one smoothing radius),
position prediction, a uniform spatial hash built by counting sort, a full state
permutation into cell order for memory locality, fixed-radius neighbour lists
(27 cells collapsed into 9 contiguous index runs), then K Jacobi iterations of
the density constraint:

    C_i      = rho_i / rho0 - 1,   clamped at 0 (pressure under compression only)
    lambda_i = -C_i / (sum_k |grad_k C_i|^2 + eps)
    dp_i     = sum_j (lambda_i + lambda_j) g_ij + lambda_i g_wall

where g_ij = (m/rho0) grad W. Velocity is recovered from the position change,
smoothed by XSPH viscosity, and finally corrected by the wall response.

### Boundaries

Walls are not approximated by a penalty force. Two mechanisms act together.

1. *Analytic density completion.* A particle near a wall is missing the fluid
   that would exist beyond it, which would otherwise make it read a spurious
   density deficit and let it pack too tightly against the boundary. The
   fraction of kernel mass in the spherical cap beyond a plane at distance dw is
   integrated numerically once at startup into a 65-entry table (the value at
   dw = 0 is 0.5, i.e. exactly a half space) and added to the density, together
   with its derivative as a consistent constraint gradient. Wall contact
   therefore carries real pressure.
2. *Collision response.* Positions are hard-clamped inside the container every
   iteration, so escape is impossible by construction. Velocity is then
   resolved per wall: on impact the normal component is reflected with
   restitution and the tangential component loses a friction fraction; in
   resting contact the inward normal component is removed and the tangential
   component decays at a rate (exp(-mu * 6 * dt)) instead of per frame. That
   distinction matters - applying impact friction on every frame of resting
   contact silently damps the whole pool and kills the slosh in under a second.

The incoming normal speed is read from the pre-solve velocity, because the
constraint clamp has already removed it from the position difference. A
threshold (3 g dt) suppresses restitution jitter for particles at rest.

### Stability

Fixed timestep of 1/60 s, one simulation frame per rendered frame, so the
workload per frame is constant and a slow machine runs in slow motion instead of
taking larger, less stable steps. Guards: CFL speed clamp, per-iteration
position correction limit of 0.4 d, constraint-force-mixing epsilon scaled to
the typical gradient magnitude, zero-distance gradient rejection, hard
containment clamp, and a per-frame integrity sweep that respawns any non-finite
particle and counts it as an anomaly. Verified over 900 frames at 3000
particles: 0 non-finite values, 0 escapes, 0 neighbour-list overflows, mean
compression error 2.9 percent, peak speed 4.2 m/s.

## Colour mapping

Particle colour is data, not decoration. Two sources, selectable at runtime:
velocity magnitude (0 to a configurable range, default 3 m/s) or local density
(0.60 to 1.15 rho0). Both run through the same six-stop ramp - deep navy, blue,
teal, bright cyan, amber, red - defined once in `renderer.js` and used for both
the GLSL shader and the HTML legend, so they cannot drift apart. Slow or
quiescent fluid is dark navy; the leading edge of the surge and the high
pressure region where it slams into the far wall run cyan to red.

## Rendering

Particles are drawn as a single `GL_POINTS` call. The fragment shader turns each
sprite into an analytic sphere: a per-fragment normal from the point coordinate,
Blinn-Phong shading with a rim term, and a corrected `gl_FragDepth` computed
from the sphere surface in view space, so particles intersect each other and the
container correctly rather than sorting as flat discs. Point size is derived
from the projection so world-space radius is respected under perspective, and
clamped to the driver's maximum point size. Three shading modes are provided:
lit impostor, flat disc, and 2 px points, the last one for isolating CPU physics
cost from fragment cost. The glass shell is drawn in two passes, far faces
before the fluid and near faces after, with a fresnel alpha.

## Telemetry

Top left: FPS, frame time, physics time per frame with a three-way breakdown
(neighbour search, density solver, velocity/viscosity/boundary), render CPU
time, GPU timer (when `EXT_disjoint_timer_query_webgl2` is available), active
particle count, average neighbours, maximum speed, mean compression error,
cumulative anomaly count, and a 40 ms frame-time sparkline with 8.3/16.7/33.3 ms
reference lines. The panel below reports the derived discretisation: spacing,
smoothing radius, calibrated mass, timestep, hash grid dimensions, simulated
time and step index.

## Benchmark

The benchmark ignores the current interactive settings and forces one canonical
workload so results are comparable across machines:

    3000 particles, 3 density iterations, 1 substep, dt = 1/60 s
    gravity 9.81, viscosity 0.20, restitution 0.25, wall friction 0.08
    fixed seed 20240517, fixed camera, lit sphere impostors
    backbuffer locked to exactly 1280x720 regardless of window size

Procedure: reset to the seeded initial state, run the warmup frames unrecorded
(JIT warm-up, shader/pipeline warm-up, cache population), then record every
frame of the sampling window. Two frame pumps are offered:

- **Uncapped (throughput)** - frames are pumped through a MessageChannel, which
  is not clamped like `setTimeout`, so the loop is not limited to the display
  refresh rate. This is the default, because a vsync-limited 16.7 ms tells you
  nothing about a machine that could have finished in 5 ms.
- **Vsync / rAF** - `requestAnimationFrame`, reports what the display actually
  shows.

With *GPU sync* enabled a `glFinish` is issued each frame, so the measured frame
time includes GPU completion instead of only command submission.

Reported: mean, median, P95, P99, min, max and standard deviation of frame time;
mean/median/5%-low/1%-low FPS; the same statistics for physics time and its
breakdown; render CPU time; GPU timer statistics when available; average
neighbours, peak speed, mean and max compression error; anomaly counts
(non-finite, escaped, neighbour overflow, stutter frames beyond twice the median);
and scores - Fluid Performance Index (particles x mean FPS / 1000), particle
updates per second, neighbour interactions per second, and the share of the
frame spent in physics.

Exports: `EXPORT JSON` writes environment (user agent, platform, cores, device
memory, DPR, screen, viewport, timezone, `performance.now` resolution, GPU
vendor/renderer via `WEBGL_debug_renderer_info`), the full workload description,
sampling configuration, all statistics, and the complete per-frame series.
`EXPORT CSV` writes one row per sampled frame with 15 columns:

    frame, elapsed_ms, frame_ms, cpu_ms, physics_ms, neighbor_ms, solver_ms,
    velocity_ms, render_cpu_ms, gpu_ms, fps_inst, max_speed_mps,
    density_error_pct, neighbors_avg, anomalies

### A note on opening from disk

Opening `index.html` directly works, but some browsers treat every `file://`
document as its own unique security origin and log warnings such as

    Unsafe attempt to load URL file:///.../index.html from frame with URL
    file:///.../index.html. 'file:' URLs are treated as unique security origins.

That message comes from the browser or from an installed extension, not from this
tool, and it does not affect the simulation. Such reports arrive as opaque
`"Script error."` events with no file or line number; they are recorded in the
diagnostics and otherwise ignored. Serving the folder over http silences them:

    python -m http.server 8000

## When something goes wrong

The tool is built so a failure degrades instead of stopping the instrument.

- **Nothing is ever unclosable.** The diagnostic panel has a CLOSE button and a
  DISMISS button, closes on Escape, and closes on a click outside the box.
- **A stray error does not take the tool down.** Runtime errors are reported in a
  slim dismissible bar at the bottom, not a blocking modal, and errors raised by
  foreign scripts such as browser extensions are recorded but never shown as if
  they were faults of this tool.
- **No 3D view is not fatal.** If the WebGL2 context cannot be created the solver
  and the telemetry keep running (the header reads PHYSICS ONLY), so frame and
  physics timings are still measurable while the 3D view is unavailable.
- **DIAG button** in the header, at any time, opens a copyable report: browser,
  platform, cores, viewport, DPR, WebGL2/WebGL1 availability, GL vendor and
  renderer strings, GLSL version, sample count, maximum point size, which context
  attribute set succeeded, whether impostor depth correction is active, solver
  state, anomaly counters, and the last six errors seen.

Context creation is attempted with five progressively more permissive attribute
sets before giving up, and the diagnosis distinguishes "WebGL1 works but WebGL2
does not" (browser or driver too old) from "no WebGL at all" (hardware
acceleration disabled, with the exact setting to change). If a driver rejects
`gl_FragDepth`, the renderer automatically falls back to a particle shader
without depth correction rather than failing to start, and says so. The particle
shader deliberately uses no integer uniforms, because fragment shaders have no
default integer precision in GLSL ES and drivers disagree about it.

## Verification

Five harnesses, all offline. The three browser harnesses encode their results as
colour bands as well as text, so they can be decoded from a screenshot without a
vision model.

    node test/node-selftest.js [count] [frames]     16 physics assertions
    node test/stress.js                             worst-case cost measurement
    test/gl-verify.html                             12 framebuffer assertions
    test/bench-verify.html                          10 benchmark path assertions
    test/layout-verify.html                         12 layout / style assertions
    test/fallback-verify.html                       10 degradation assertions
    test/error-verify.html                          10 error-reporting assertions

`node-selftest.js` asserts the boundary cap integral equals a half space at the
wall and vanishes at h, mass calibration, containment on all six walls, that the
column actually collapses and reaches the far wall, plausible peak speed, energy
decay after the surge, compression error, neighbour count, that the transient
lasts long enough to observe and does settle, and that the same seed reproduces
a bit-identical trajectory.

`gl-verify.html` reads the framebuffer back and asserts no GL error, plausible
rasterised and fluid coverage, a blue/cyan dominant ramp, that no fluid pixel
falls outside the projected container silhouette beyond one sprite footprint,
that impostor luminance actually varies (i.e. the spheres are shaded, not flat),
that high-energy colours are present, that the glass shell and grid drew, and
that growing the count to 4000 and shrinking it to 2500 both re-render cleanly
(vertex buffer regrowth) with no GL error and no solver anomaly.

`bench-verify.html` runs a real short benchmark and asserts the report exists,
statistics are finite and correctly ordered, physics timing is broken down, the
canonical workload was enforced including the 1280x720 backbuffer, the per-frame
series and CSV are complete and well formed, the JSON round-trips with
environment and GPU data, no anomalies occurred, scores are consistent, and the
interactive state (resolution lock, frame pump, buttons, particle count) is fully
restored afterwards.

`error-verify.html` replays an opaque cross-origin `"Script error."` report of the
kind a browser extension or a file:// origin restriction produces, and asserts it
raises neither a panel nor an alert while still being recorded in the diagnostics;
then it replays an error attributed to this tool and asserts that one does reach
the dismissible bar, still without a blocking panel, with the simulation running
throughout.

`fallback-verify.html` stubs out the renderer to simulate a machine with no
WebGL2 and asserts that the application still boots, that the diagnosis names the
cause and is copyable, that the alert bar and the panel both dismiss (button,
DIAG re-open, Escape), that physics keeps advancing and telemetry stays live
without a renderer, that the benchmark is disabled with the mode reported, and
that the controls still operate after the panel is dismissed.

`layout-verify.html` asserts the geometry (no panel or control off screen, no
horizontally clipped text, columns not overlapping, backbuffer matching the CSS
box times the resolution scale, telemetry actually populated by the live loop)
and the style contract (every corner square, no box or text shadow, monospace
everywhere, no emoji anywhere in the interface).

## Measured reference (development machine, V8, physics only, single thread)

    2500 particles, 1 substep, 3 iterations     4.9 ms/frame
    3000 particles, 1 substep, 3 iterations     5.6 ms/frame
    4000 particles, 2 substeps, 4 iterations   16.7 ms/frame   (compression error 0.7%)

## Known limits

- Single threaded on purpose: the point is to measure one core's integration
  throughput plus GPU fill rate, not to hide the cost in workers.
- Surface tension and vorticity confinement are not modelled; at this resolution
  a low-viscosity fluid therefore looks granular at the crest of a splash.
- The constraint is clamped to compression only, which is stable and prevents
  surface clustering but leaves the pool roughly 5 percent denser than the
  nominal rest volume at 3 iterations. Raising iterations reduces it (0.7
  percent at 4 iterations with 2 substeps).
- `EXT_disjoint_timer_query_webgl2` is unavailable in most shipping browsers, so
  the GPU timer usually reads N/A; use uncapped mode with GPU sync instead.
- All controls fit without scrolling at a viewport height of about 1000 px and
  above; on shorter screens the control column scrolls.
- A background tab is throttled by the browser: keep the window in the
  foreground while benchmarking.
