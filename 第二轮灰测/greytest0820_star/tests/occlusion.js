/* ==========================================================================
 * tests/occlusion.js — diagnostic: for every control at a station, ray test
 * from the crewman's eye to the control and report what (if anything) of the
 * compartment geometry is in the way.
 *
 *   node tests/occlusion.js [tankId] [station]
 * ==========================================================================*/
'use strict';
const path = require('path');
require('./smoke_stub.js');
const JS = p => require(path.join(__dirname, '..', 'js', p));
JS('math3d.js'); JS('i18n.js'); JS('mesh.js'); JS('renderer.js'); JS('tanks.js');
JS('interiors.js'); JS('sim.js'); JS('world.js'); JS('audio.js'); JS('tutorial.js'); JS('ui.js'); JS('main.js');

const M = globalThis.M;
const game = globalThis.game;
const raf = globalThis.__raf;
const step = (n, dt) => { for (let i = 0; i < n; i++) { const f = raf.shift(); if (f) f(game.last + (dt || 16)); } };

const tankId = process.argv[2] || 'sherman';
const only = process.argv[3] || null;

game.selectTank(tankId);
game.deploy();
step(2, 16);
const t = game.player;

/* triangle soup of the interior, in world space, tagged with its source */
function soup() {
  const out = [];
  const push = (mesh, mat, tag) => {
    const V = mesh.verts.map(v => M.xformPoint(mat, v));
    mesh.faces.forEach((f, fi) => {
      for (let k = 1; k + 1 < f.i.length; k++) {
        out.push({ a: V[f.i[0]], b: V[f.i[k]], c: V[f.i[k + 1]], tag, fi, col: f.c });
      }
    });
  };
  push(t.interior.hull, t.hullMatrix(), 'hull');
  push(t.interior.turret, t.turretMatrix(), 'turret');
  push(t.interior.breech.block, t.turretMatrix(), 'breech');
  return out;
}
const tris = soup();
console.log('\n' + t.spec.name + ' — interior triangles: ' + tris.length);

function rayTri(o, d, tri) {
  const e1 = M.sub(tri.b, tri.a), e2 = M.sub(tri.c, tri.a);
  const p = M.cross(d, e2);
  const det = M.dot(e1, p);
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det;
  const s = M.sub(o, tri.a);
  const u = M.dot(s, p) * inv;
  if (u < -0.0001 || u > 1.0001) return null;
  const q = M.cross(s, e1);
  const v = M.dot(d, q) * inv;
  if (v < -0.0001 || u + v > 1.0001) return null;
  const tt = M.dot(e2, q) * inv;
  return tt > 0.02 ? tt : null;
}

for (const sid in t.interior.stations) {
  if (only && sid !== only) continue;
  const st = t.interior.stations[sid];
  const eye = t.stationEye(sid);
  console.log('\n--- ' + st.name + ' (eye ' + eye.map(v => v.toFixed(2)).join(',') + ') ---');
  let blocked = 0;
  for (const hs of st.hotspots) {
    const pm = t.parentMatrix(hs.parent);
    const world = M.xformPoint(pm, hs.pos);
    const d = M.sub(world, eye);
    const dist = M.len(d);
    const dir = M.mulv(d, 1 / dist);
    let best = null;
    for (const tri of tris) {
      const tt = rayTri(eye, dir, tri);
      if (tt !== null && tt < dist - 0.05 && (best === null || tt < best.t)) best = { t: tt, tri };
    }
    if (best) {
      blocked++;
      const cen = M.mulv(M.add(M.add(best.tri.a, best.tri.b), best.tri.c), 1 / 3);
      console.log('  BLOCKED ' + hs.id.padEnd(14) + ' d=' + dist.toFixed(2) +
        '  by ' + best.tri.tag + '#' + best.tri.fi + ' at ' + best.t.toFixed(2) +
        ' (world ' + cen.map(v => v.toFixed(2)).join(',') + ' col ' + best.tri.col.map(v => v | 0).join(',') + ')');
    }
  }
  console.log('  ' + blocked + ' of ' + st.hotspots.length + ' blocked');
}
