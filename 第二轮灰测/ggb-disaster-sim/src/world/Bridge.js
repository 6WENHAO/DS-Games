import * as THREE from 'three';
import { WORLD, COLORS, FRACTURE } from '../config.js';
import { voronoiRect, extrudePrism, makeRng } from './Fracture.js';
import { createBatches } from './BatchedRigidMesh.js';
import { CableSystem } from './Cables.js';

/**
 * Bridge — the Golden Gate, assembled procedurally and ALREADY FRACTURED.
 *
 * Assembly order matters: geometry is generated first, then merged into spatial
 * batches, and only then are rigid bodies registered — so the mapping
 * chunk → (batch, instance row) → rigid body is established once and never
 * searched again at runtime.
 *
 * Structure inventory (all pre-fractured, all static until a disaster fires):
 *   • deck   — 96 × 3 Voronoi prisms (2737 m × 27.4 m slab)
 *   • towers — 2 × 2 legs × 20 tapered slabs + 7 portal struts each
 *   • cables — 2 verlet ropes of 132 nodes, 168 suspenders
 *   • piers  — static, not fractured (they are the one thing that survives)
 */
export class Bridge {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.group = new THREE.Group();
    scene.add(this.group);

    /** @type {Array<{geometry:THREE.BufferGeometry, sortKey:number}>} */
    const chunkDefs = [];
    /** Parallel metadata: where each chunk lives and what it belongs to. */
    this.meta = [];

    this._buildDeck(chunkDefs);
    this._buildTowers(chunkDefs);

    // ---- merge into spatial batches (draw-call collapse) ----
    const { batches, assign } = createBatches(chunkDefs, 180, {
      roughness: 0.88, metalness: 0.05, castShadow: true, boundsPadding: 220,
    });
    this.batches = batches;
    for (const b of batches) this.group.add(b.mesh);

    // ---- register rigid bodies ----
    this.entries = [];
    for (let i = 0; i < chunkDefs.length; i++) {
      const m = this.meta[i];
      const a = assign[i];
      const entry = this.physics.addChunk({
        position: m.position,
        hull: m.hull,
        halfExtents: m.halfExtents,
        batch: a.batch,
        index: a.index,
        density: m.density,
      });
      entry.kind = m.kind;
      entry.groupId = m.groupId;
      entry.x = m.position.x;
      entry.y = m.position.y;
      this.entries.push(entry);
      a.batch.setTransform(a.index, m.position, new THREE.Quaternion(), 1);
    }
    for (const b of batches) b.flush();

    // Index the deck by X so a span release is an O(1) range scan, not a search.
    this.deckEntries = this.entries.filter((e) => e.kind === 'deck').sort((a, b) => a.x - b.x);
    this.towerEntries = this.entries.filter((e) => e.kind === 'tower');

    this._buildCables();
    this._buildPiers();

    this.swayPhase = 0;
  }

  /** Slight vertical arch of the roadway — the deck is not flat. */
  deckArchAt(x) {
    const t = THREE.MathUtils.clamp(x / (WORLD.deckLength * 0.5), -1, 1);
    return WORLD.deckY + 6.2 * (1 - t * t);
  }

  // ------------------------------------------------------------------ deck
  _buildDeck(out) {
    const hw = WORLD.deckLength * 0.5;
    const hd = WORLD.deckWidth * 0.5;
    const cells = voronoiRect(
      WORLD.deckLength, WORLD.deckWidth,
      FRACTURE.deckCellsAlongX, FRACTURE.deckCellsAlongZ,
      FRACTURE.deckJitter, FRACTURE.seed,
    );

    const asphalt = new THREE.Color(COLORS.deckAsphalt);
    const inner = new THREE.Color(COLORS.rubbleInterior);
    const outer = new THREE.Color(COLORS.internationalOrange);
    const under = new THREE.Color(COLORS.orangeShadow);
    const stripe = new THREE.Color(0xd8c451);
    const EPS = 0.35;

    for (const cell of cells) {
      const prism = extrudePrism({
        polygon: cell.polygon,
        thickness: WORLD.deckThickness,
        topColor: asphalt,
        bottomColor: under,
        outerColor: outer,
        innerColor: inner,
        // An edge is "original structure" (painted orange) only if it lies on
        // the deck's outline; everything else is a fresh fracture face.
        isOuterEdge: (a, b) => {
          const onZ = (Math.abs(a[1] - hd) < EPS && Math.abs(b[1] - hd) < EPS)
                   || (Math.abs(a[1] + hd) < EPS && Math.abs(b[1] + hd) < EPS);
          const onX = (Math.abs(a[0] - hw) < EPS && Math.abs(b[0] - hw) < EPS)
                   || (Math.abs(a[0] + hw) < EPS && Math.abs(b[0] + hw) < EPS);
          return onZ || onX;
        },
      });

      const cx = cell.centroid[0];
      const cz = cell.centroid[1];

      // Paint the centre line onto whichever cells straddle z ≈ 0.
      const col = prism.geometry.attributes.color;
      const nor = prism.geometry.attributes.normal;
      const pos = prism.geometry.attributes.position;
      for (let v = 0; v < col.count; v++) {
        if (nor.getY(v) > 0.5 && Math.abs(cz + pos.getZ(v)) < 0.55) {
          col.setXYZ(v, stripe.r, stripe.g, stripe.b);
        }
      }

      out.push({ geometry: prism.geometry, sortKey: cx });
      this.meta.push({
        kind: 'deck',
        groupId: 0,
        position: new THREE.Vector3(cx, this.deckArchAt(cx), cz),
        hull: prism.hull,
        halfExtents: null,
        density: 2.4,
      });
    }
  }

  // ---------------------------------------------------------------- towers
  /** Box with per-face colouring: painted flanks, raw interior on the cuts. */
  _coloredBox(w, h, d, outerCol, innerCol) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const nor = g.attributes.normal;
    const colors = new Float32Array(nor.count * 3);
    for (let v = 0; v < nor.count; v++) {
      // Horizontal cuts (±Y) are fracture faces; vertical faces are painted.
      const c = Math.abs(nor.getY(v)) > 0.5 ? innerCol : outerCol;
      colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }

  _buildTowers(out) {
    const orange = new THREE.Color(COLORS.internationalOrange);
    const inner = new THREE.Color(COLORS.rubbleInterior);
    const rng = makeRng(FRACTURE.seed + 77);
    const rows = FRACTURE.towerChunkRows;
    const H = WORLD.towerHeight;

    for (const sign of [-1, 1]) {
      const towerX = sign * WORLD.towerX;
      const groupId = sign < 0 ? 1 : 2;

      for (const legSign of [-1, 1]) {
        const legZ = legSign * WORLD.towerLegSpread * 0.5;
        let y = 0;
        for (let r = 0; r < rows; r++) {
          // Uneven slab heights so the fracture lines do not look machined.
          const hRow = (H / rows) * (0.82 + rng() * 0.36);
          const t = y / H;
          // Art Deco taper with stepped setbacks every fifth slab.
          const step = Math.floor(t * 5) / 5;
          const w = WORLD.towerLegWidth * (1.30 - 0.55 * step - 0.10 * t);
          const d = WORLD.towerLegDepth * (1.22 - 0.42 * step - 0.08 * t);

          out.push({
            geometry: this._coloredBox(w, hRow, d, orange, inner),
            sortKey: towerX + legZ * 0.01,
          });
          this.meta.push({
            kind: 'tower',
            groupId,
            position: new THREE.Vector3(towerX, y + hRow * 0.5, legZ),
            hull: null,
            halfExtents: new THREE.Vector3(w * 0.5, hRow * 0.5, d * 0.5),
            density: 2.6,
          });
          y += hRow;
          if (y >= H) break;
        }
      }

      // ---- portal struts between the legs (the visual signature) ----
      const nStruts = WORLD.towerStruts;
      for (let i = 0; i < nStruts; i++) {
        // Denser near the top, matching the real bracing distribution.
        const f = Math.pow((i + 1) / (nStruts + 1), 0.82);
        const yy = 24 + f * (H - 44);
        const t = yy / H;
        const spread = WORLD.towerLegSpread + WORLD.towerLegDepth * (0.6 - 0.2 * t);
        const hStrut = 6.5 - 1.6 * t;
        const dStrut = WORLD.towerLegDepth * (0.72 - 0.18 * t);
        out.push({
          geometry: this._coloredBox(9.5, hStrut, spread, orange, inner),
          sortKey: towerX + 0.5,
        });
        this.meta.push({
          kind: 'tower',
          groupId,
          position: new THREE.Vector3(towerX, yy, 0),
          hull: null,
          halfExtents: new THREE.Vector3(4.75, hStrut * 0.5, spread * 0.5),
          density: 2.2,
        });
      }
    }
  }

  // ---------------------------------------------------------------- cables
  /**
   * Main cable profile. Main span is the classic parabola between tower tops;
   * side spans run from the tower top down to the anchorage blocks.
   */
  cableHeightAt(x) {
    const ax = Math.abs(x);
    const towerTop = WORLD.towerHeight - 3;
    if (ax <= WORLD.towerX) {
      const midY = this.deckArchAt(0) + 3.4;         // cable kisses the deck mid-span
      const t = ax / WORLD.towerX;
      return midY + (towerTop - midY) * t * t;
    }
    const t = (ax - WORLD.towerX) / (WORLD.cableAnchorX - WORLD.towerX);
    return towerTop + (WORLD.cableAnchorY - towerTop) * Math.pow(t, 1.32);
  }

  _buildCables() {
    this.cables = new CableSystem(this.scene);
    const cableZ = WORLD.towerLegSpread * 0.5;
    const n = WORLD.cableSegments;
    this.ropeIndices = [];

    for (const zSign of [-1, 1]) {
      const pts = [];
      for (let i = 0; i < n; i++) {
        const x = -WORLD.cableAnchorX + (i / (n - 1)) * (WORLD.cableAnchorX * 2);
        pts.push(new THREE.Vector3(x, this.cableHeightAt(x), zSign * cableZ));
      }
      this.ropeIndices.push(this.cables.addRope(pts, WORLD.cableRadius));
    }

    // ---- suspenders, main span only ----
    const step = WORLD.hangerSpacing;
    const nodeSpacing = (WORLD.cableAnchorX * 2) / (n - 1);
    for (let x = -WORLD.towerX + step; x < WORLD.towerX - step * 0.5; x += step) {
      const node = Math.round((x + WORLD.cableAnchorX) / nodeSpacing);
      if (node <= 0 || node >= n - 1) continue;
      const deckTop = this.deckArchAt(x) + WORLD.deckThickness * 0.5;
      for (let ri = 0; ri < 2; ri++) {
        const zSign = ri === 0 ? -1 : 1;
        this.cables.addHanger(this.ropeIndices[ri], node,
          new THREE.Vector3(x, deckTop, zSign * cableZ));
      }
    }

    this.cables.build();
    this._cableNodeSpacing = nodeSpacing;
  }

  /** Map a world X to the nearest main-cable node index. */
  cableNodeAtX(x) {
    return Math.round((x + WORLD.cableAnchorX) / this._cableNodeSpacing);
  }

  // ----------------------------------------------------------------- piers
  _buildPiers() {
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.concrete, roughness: 0.94, metalness: 0.02,
    });
    this.pierMat = mat;
    const geo = new THREE.CylinderGeometry(WORLD.pierRadius, WORLD.pierRadius * 1.15, 44, 24);
    this.pierGeo = geo;
    this.piers = new THREE.InstancedMesh(geo, mat, 2);
    const m = new THREE.Matrix4();
    [-1, 1].forEach((s, i) => {
      m.makeTranslation(s * WORLD.towerX, -8, 0);
      this.piers.setMatrixAt(i, m);
    });
    this.piers.castShadow = true;
    this.piers.receiveShadow = true;
    this.group.add(this.piers);
  }

  // ------------------------------------------------------------- behaviour
  /**
   * Kinematic sway of everything still standing. Applied to BOTH the render
   * transform and the (still static) rigid body, so if a chunk is released
   * mid-swing it inherits the displaced position instead of teleporting home.
   *
   * Amplitude grows as (y/H)² — the mode shape of a cantilever — which is why
   * the tower tops whip while the bases barely move.
   */
  sway(amplitude, frequency, t) {
    const H = WORLD.towerHeight;
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const w = Math.PI * 2 * frequency * t;

    for (const e of this.towerEntries) {
      if (e.state !== 'static') continue;
      const shape = Math.pow(e.y / H, 2);
      // Two slightly detuned modes so the motion never looks like a single sine.
      const dx = amplitude * shape * (Math.sin(w) * 0.78 + Math.sin(w * 2.31 + 1.1) * 0.22);
      const dz = amplitude * shape * 0.42 * Math.sin(w * 0.83 + 0.6);
      p.set(e.home.x + dx, e.home.y, e.home.z + dz);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -dx / H * 0.6);
      e.rb.setTranslation({ x: p.x, y: p.y, z: p.z }, false);
      e.batch.setTransform(e.index, p, q, 1);
    }

    // Deck rides the towers with a half-wave along the span.
    for (const e of this.deckEntries) {
      if (e.state !== 'static') continue;
      const span = Math.cos((e.x / WORLD.deckLength) * Math.PI);
      const dx = amplitude * 0.30 * span * Math.sin(w * 0.97 + 0.4);
      const dy = amplitude * 0.20 * span * Math.sin(w * 1.6 + 2.0);
      p.set(e.home.x + dx, e.home.y + dy, e.home.z);
      e.rb.setTranslation({ x: p.x, y: p.y, z: p.z }, false);
      e.batch.setTransform(e.index, p, q.identity(), 1);
    }

    // Cables follow their attachment points.
    this.cables.offsetPinned((hx, hy) => {
      const shape = Math.pow(Math.min(hy / H, 1), 2);
      return {
        x: amplitude * shape * (Math.sin(w) * 0.78 + Math.sin(w * 2.31 + 1.1) * 0.22),
        y: 0,
        z: amplitude * shape * 0.42 * Math.sin(w * 0.83 + 0.6),
      };
    });
  }

  /** Release every deck chunk in [x0,x1] as dynamic debris. */
  releaseDeckSpan(x0, x1, impulseFn = null) {
    let n = 0;
    const imp = new THREE.Vector3();
    for (const e of this.deckEntries) {
      if (e.x < x0 || e.x > x1) continue;
      if (e.state !== 'static') continue;
      if (impulseFn) impulseFn(e, imp); else imp.set(0, 0, 0);
      this.physics.activate(e, imp);
      n++;
    }
    this.cables.cutHangersInRange(x0, x1);
    return n;
  }

  /** Release tower chunks above a height (a topple rather than a pancake). */
  releaseTowerAbove(towerSign, y0, impulse) {
    const groupId = towerSign < 0 ? 1 : 2;
    let n = 0;
    const imp = new THREE.Vector3();
    for (const e of this.towerEntries) {
      if (e.groupId !== groupId || e.y < y0 || e.state !== 'static') continue;
      const lean = (e.y - y0) / Math.max(WORLD.towerHeight - y0, 1);
      imp.set(impulse * lean, impulse * 0.12 * lean, impulse * 0.22 * lean);
      this.physics.activate(e, imp);
      n++;
    }
    return n;
  }

  get pickables() {
    return [...this.batches.map((b) => b.mesh), this.piers];
  }

  update(dt) {
    this.cables.update(dt);
    for (const b of this.batches) { b.decayHeat(dt); b.flush(); }
  }

  reset() {
    this.cables.reset();
    const q = new THREE.Quaternion();
    for (const e of this.entries) e.batch.setTransform(e.index, e.home, q, 1);
    for (const b of this.batches) {
      for (let i = 0; i < b.count; i++) b.setHeat(i, 0);
      b.flush();
    }
  }

  dispose() {
    for (const b of this.batches) { this.group.remove(b.mesh); b.dispose(); }
    this.cables.dispose();
    this.pierGeo.dispose();
    this.pierMat.dispose();
    this.scene.remove(this.group);
  }
}
