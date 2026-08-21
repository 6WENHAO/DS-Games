// ---------------------------------------------------------------------------
//  double-wishbone kinematics -- numeric verification of the exact math that
//  is embedded in index.html (same functions, plain-object vectors, Rodrigues)
// ---------------------------------------------------------------------------
const V = (x, y, z) => ({ x, y, z });
const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => V(a.x * s, a.y * s, a.z * s);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const len = (a) => Math.sqrt(dot(a, a));
const norm = (a) => mul(a, 1 / len(a));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const DEG = 180 / Math.PI;
// Rodrigues rotation of vector p about unit axis by ang
function rotV(p, axis, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(p, c), mul(cross(axis, p), s)), mul(axis, dot(axis, p) * (1 - c)));
}
const rotP = (p, A, axis, ang) => add(A, rotV(sub(p, A), axis, ang));
// minimal-arc rotation carrying u0 onto u, applied to vector p (== THREE setFromUnitVectors)
function alignV(p, u0, u) {
  const c = clamp(dot(u0, u), -1, 1);
  if (c > 1 - 1e-12) return p;
  const cr = cross(u0, u);
  if (len(cr) < 1e-9) { const ax = norm(Math.abs(u0.x) < 0.9 ? cross(u0, V(1, 0, 0)) : cross(u0, V(0, 1, 0))); return rotV(p, ax, Math.PI); }
  return rotV(p, norm(cr), Math.acos(c));
}

// ------------------------------------------------------------- hard points --
const HP = {
  lcaAxisPt: V(0, 0.112, 0.160), lcaAxisSkewDeg: 2.0,      // pivot axis ~ +X
  lcaOuter: V(0.013, 0.128, 0.600),                        // theta_l = +2.08 deg
  ucaAxisPt: V(0, 0.390, 0.255), ucaAxisSkewDeg: -1.4,
  ucaOuter: V(-0.013, 0.455, 0.540),                       // theta_u = +12.9 deg
  wheelCentre: V(0, 0.315, 0.655),
  steerArm: V(-0.095, 0.215, 0.595),
  rackBall: V(-0.095, 0.174, 0.190),   // on the FVIC->outer-ball line: low bump steer
  springLo: V(0, 0.120, 0.430),                            // on lower arm
  springHi: V(0, 0.615, 0.215),                            // on chassis
  tyreR: 0.315, camber0: -0.5,
};
function axisDir(skewDeg) { const s = skewDeg * Math.PI / 180; return V(Math.cos(s), 0, Math.sin(s)); }

// a revolute arm: its outer point sweeps a circle about the chassis axis
function makeArm(axisPt, dir, outer) {
  const a = norm(dir);
  const rel = sub(outer, axisPt);
  const C = add(axisPt, mul(a, dot(rel, a)));
  const rv = sub(outer, C), r = len(rv);
  const ea = mul(rv, 1 / r), eb = cross(a, ea);
  return { axisPt, a, C, r, ea, eb, at: (t) => add(C, add(mul(ea, r * Math.cos(t)), mul(eb, r * Math.sin(t)))) };
}
// rotation angle t of a point on circle(C,r,ea,eb) whose distance to T equals L
function solveCircleDistance(C, r, ea, eb, u, T, L, prev) {
  const d = sub(T, C);
  const dpar = dot(d, u), dp = sub(d, mul(u, dpar));
  const K = (dpar * dpar + dot(dp, dp) + r * r - L * L) / (2 * r);
  const A = dot(dp, ea), B = dot(dp, eb);
  const m = Math.hypot(A, B);
  const base = Math.atan2(B, A);
  if (m < 1e-12) return { t: prev, reach: false };
  const q = clamp(K / m, -1, 1);
  const off = Math.acos(q);
  const c1 = base + off, c2 = base - off;
  const wrap = (t) => { let d2 = t - prev; while (d2 > Math.PI) d2 -= 2 * Math.PI; while (d2 < -Math.PI) d2 += 2 * Math.PI; return prev + d2; };
  const w1 = wrap(c1), w2 = wrap(c2);
  return { t: Math.abs(w1 - prev) <= Math.abs(w2 - prev) ? w1 : w2, reach: Math.abs(K / m) <= 1 };
}

const LCA = makeArm(HP.lcaAxisPt, axisDir(HP.lcaAxisSkewDeg), HP.lcaOuter);
const UCA = makeArm(HP.ucaAxisPt, axisDir(HP.ucaAxisSkewDeg), HP.ucaOuter);
const L_KNUCKLE = len(sub(HP.ucaOuter, HP.lcaOuter));
const U0 = norm(sub(HP.ucaOuter, HP.lcaOuter));
const L_TIE = len(sub(HP.rackBall, HP.steerArm));
const N0 = (() => { const g = -HP.camber0 * Math.PI / 180; return V(0, Math.sin(g), Math.cos(g)); })();
const LOC = (p) => sub(p, HP.lcaOuter);                    // knuckle-local (design frame)

// full pose for a given lower-arm angle tL, rack lateral offset dz.
// refU / refDelta anchor the branch of each circle-sphere solution (design = 0).
function pose(tL, rackDz, refU = 0, refDelta = 0) {
  const Bl = LCA.at(tL);
  const su = solveCircleDistance(UCA.C, UCA.r, UCA.ea, UCA.eb, UCA.a, Bl, L_KNUCKLE, refU);
  const Bu = UCA.at(su.t);
  const u = norm(sub(Bu, Bl));                              // kingpin axis
  // steering: knuckle twist about kingpin solved from the tie rod length
  const armLocal = alignV(LOC(HP.steerArm), U0, u);
  const cS = add(Bl, mul(u, dot(armLocal, u)));
  const rv = sub(add(Bl, armLocal), cS), rS = len(rv);
  const eaS = mul(rv, 1 / rS), ebS = cross(u, eaS);
  const rack = V(HP.rackBall.x, HP.rackBall.y, HP.rackBall.z + rackDz);
  const ss = solveCircleDistance(cS, rS, eaS, ebS, u, rack, L_TIE, refDelta);
  const delta = ss.t;
  const xf = (p) => add(Bl, alignV(rotV(LOC(p), U0, delta), U0, u));   // knuckle point -> world
  const W = xf(HP.wheelCentre);
  const n = alignV(rotV(N0, U0, delta), U0, u);             // wheel spin axis
  const camber = -Math.asin(clamp(dot(n, V(0, 1, 0)), -1, 1)) * DEG;
  const toe = Math.atan2(n.x, n.z) * DEG;
  const caster = Math.atan2(-u.x, u.y) * DEG;
  const kpi = Math.atan2(-u.z, u.y) * DEG;
  const py = sub(V(0, -1, 0), mul(n, dot(V(0, -1, 0), n)));
  const contact = add(W, mul(norm(py), HP.tyreR));
  const springA = add(LCA.axisPt, rotV(sub(HP.springLo, LCA.axisPt), LCA.a, tL));
  // front-view instant centre (yz plane) and roll centre height
  const Al = LCA.axisPt, Au = UCA.axisPt;
  const dl = sub(Bl, V(Al.x, Al.y, Al.z)), du = sub(Bu, V(Au.x, Au.y, Au.z));
  const den = dl.z * du.y - dl.y * du.z;
  let ic = null, rcH = NaN;
  if (Math.abs(den) > 1e-9) {
    const s = ((Au.z - Al.z) * du.y - (Au.y - Al.y) * du.z) / den;
    ic = V(0, Al.y + dl.y * s, Al.z + dl.z * s);
    const dz = contact.z - ic.z;
    if (Math.abs(dz) > 1e-9) rcH = ic.y + (0 - ic.z) * (contact.y - ic.y) / dz;
  }
  return { tL, tU: su.t, delta, Bl, Bu, u, W, n, camber, toe, caster, kpi, contact, ic, rcH,
    springLen: len(sub(HP.springHi, springA)), armPt: xf(HP.steerArm), rack,
    resKnuckle: len(sub(Bu, Bl)) - L_KNUCKLE, resTie: len(sub(rack, xf(HP.steerArm))) - L_TIE, reach: su.reach && ss.reach };
}
// invert: wheel-centre height -> lower-arm angle. Monotone on the working
// bracket, so a plain bisection with branch anchoring is unconditionally stable.
const T_LIM = 0.17;                                        // +-0.17 rad  ~  +-73 mm
function solveTravel(travelMM, rackDz, refDelta = 0) {
  const targetY = HP.wheelCentre.y + travelMM / 1000;
  let lo = -T_LIM, hi = T_LIM;
  const fy = (t) => pose(t, rackDz, 0, refDelta).W.y - targetY;
  let flo = fy(lo), fhi = fy(hi);
  if (flo * fhi > 0) return pose(Math.abs(flo) < Math.abs(fhi) ? lo : hi, rackDz, 0, refDelta);
  for (let i = 0; i < 44; i++) {
    const mid = (lo + hi) / 2, fm = fy(mid);
    if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; }
  }
  return pose((lo + hi) / 2, rackDz, 0, refDelta);
}
// rack offset that yields a commanded steer angle at design height (monotone)
function rackForSteer(deg) {
  const target = deg * Math.PI / 180;
  if (Math.abs(deg) < 1e-9) return 0;
  let lo = -0.14, hi = 0.14;
  const fd = (dz) => solveTravel(0, dz, target).delta - target;
  let flo = fd(lo), fhi = fd(hi);
  if (flo * fhi > 0) return 0;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, fm = fd(mid); if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else { hi = mid; fhi = fm; } }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------------- tests --
const base = pose(0, 0, 0, 0);
console.log('--- design position -------------------------------------------');
console.log(' knuckle len          ', L_KNUCKLE.toFixed(6), 'm   tie rod', L_TIE.toFixed(6), 'm');
console.log(' lower arm radius     ', LCA.r.toFixed(5), '  upper arm radius', UCA.r.toFixed(5));
console.log(' camber / caster / KPI', base.camber.toFixed(3), '/', base.caster.toFixed(3), '/', base.kpi.toFixed(3), 'deg');
console.log(' toe                  ', base.toe.toFixed(4), 'deg   spring', (base.springLen*1000).toFixed(1), 'mm');
console.log(' contact patch        ', 'y=' + base.contact.y.toFixed(5), ' z=' + base.contact.z.toFixed(5));
console.log(' constraint residuals ', base.resKnuckle.toExponential(2), base.resTie.toExponential(2));
console.log('\n--- wheel travel sweep (steer 0) ------------------------------');
console.log(' trav   camber   caster    KPI     toe   dTrack/2  spring   rcH   ICz   resid');
let bad = 0, prevCam = null, monotone = true;
for (let t = -50; t <= 50; t += 10) {
  const p = solveTravel(t, 0, 0);
  const travErr = (p.W.y - HP.wheelCentre.y) * 1000 - t;
  const dTrack = (p.contact.z - base.contact.z) * 1000;
  if (!isFinite(p.camber) || !p.reach) bad++;
  if (prevCam !== null && p.camber > prevCam + 1e-9) monotone = false;
  prevCam = p.camber;
  console.log(String(t).padStart(5), p.camber.toFixed(3).padStart(8), p.caster.toFixed(3).padStart(8),
    p.kpi.toFixed(3).padStart(7), p.toe.toFixed(3).padStart(7), dTrack.toFixed(2).padStart(9),
    (p.springLen*1000).toFixed(1).padStart(8), (p.rcH*1000).toFixed(0).padStart(6), (p.ic.z*1000).toFixed(0).padStart(6),
    Math.max(Math.abs(p.resKnuckle), Math.abs(p.resTie), Math.abs(travErr)*1e-3).toExponential(1).padStart(9));
}
console.log(' camber decreases monotonically with travel:', monotone, '  failures:', bad);
console.log('\n--- steering sweep at design height --------------------------');
console.log(' cmd    actual   rackDz(mm)   toe     camber');
for (let d = -30; d <= 30; d += 10) {
  const dz = rackForSteer(d);
  const p = solveTravel(0, dz, d * Math.PI / 180);
  console.log(String(d).padStart(4), (p.delta*DEG).toFixed(3).padStart(9), (dz*1000).toFixed(2).padStart(11),
    p.toe.toFixed(3).padStart(8), p.camber.toFixed(3).padStart(8));
}
console.log('\n--- bump steer at 15 deg of lock ------------------------------');
const dz15 = rackForSteer(15);
console.log(' trav   steer    toe     camber');
for (let t = -50; t <= 50; t += 25) {
  const p = solveTravel(t, dz15, 15 * Math.PI / 180);
  console.log(String(t).padStart(5), (p.delta*DEG).toFixed(3).padStart(8), p.toe.toFixed(3).padStart(8), p.camber.toFixed(3).padStart(8));
}
// stress: dense random walk, look for NaN / lost branch
let worst = 0, worstTrav = 0, unreach = 0;
for (let i = 0; i < 3000; i++) {
  const deg = -30 + 60 * Math.random();
  const t = -50 + 100 * Math.random(), dz = rackForSteer(deg);
  const p = solveTravel(t, dz, deg * Math.PI / 180);
  worst = Math.max(worst, Math.abs(p.resKnuckle), Math.abs(p.resTie));
  worstTrav = Math.max(worstTrav, Math.abs((p.W.y - HP.wheelCentre.y) * 1000 - t));
  if (!p.reach) unreach++;
  if (!isFinite(p.camber + p.toe + p.caster)) { console.log('NaN at', i); break; }
}
console.log('\nstress 3000 random poses: worst constraint residual', worst.toExponential(2),
  'm | worst travel error', worstTrav.toExponential(2), 'mm | unreachable', unreach);
// reachability across the whole bracket
let rmin = 1;
for (let t = -T_LIM; t <= T_LIM; t += T_LIM / 40) { const p = pose(t, 0, 0, 0); if (!p.reach) rmin = 0; }
console.log('every pose across the +-' + T_LIM + ' rad bracket solvable:', rmin === 1);
