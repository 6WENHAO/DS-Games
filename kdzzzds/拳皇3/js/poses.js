(function(){
'use strict';
var KOF = window.KOF;

// Pose space: facing right. hip origin. angles deg.
// t: torso lean (+fwd), n: neck tilt. shoulders: 0=down,90=fwd,180=up. elbow: +flex fwd.
// hips: 0=down,90=fwd knee up, neg=behind. knee: +heel back. hy: hip height. hx: hip x shift.
var D = { hx:0, hy:40, t:4, n:0, ls:22, le:20, rs:26, re:24, lh:-10, lk:8, rh:12, rk:8, lf:80, rf:80, face:0 };
function P(o){ var r={}; for(var k in D) r[k]=D[k]; for(var k2 in o) r[k2]=o[k2]; return r; }

var Poses = {
// ---- neutral / movement ----
idleA: P({ ls:30, le:100, rs:50, re:105, t:6 }),
idleB: P({ hy:39, ls:32, le:104, rs:52, re:110, t:8 }),
walk1: P({ lh:-22, lk:12, rh:24, rk:10, ls:35, le:60, rs:10, re:40 }),
walk2: P({ lh:-8,  lk:18, rh:8,  rk:22, ls:25, le:55, rs:25, re:55, hy:39 }),
walk3: P({ lh:24,  lk:10, rh:-22, rk:12, ls:10, le:40, rs:35, re:60 }),
walk4: P({ lh:8,   lk:22, rh:-8, rk:18, ls:25, le:55, rs:25, re:55, hy:39 }),
run1: P({ t:24, lh:-38, lk:35, rh:45, rk:20, ls:60, le:80, rs:-25, re:60, hy:38 }),
run2: P({ t:26, lh:20, lk:60, rh:-15, rk:45, ls:20, le:70, rs:30, re:70, hy:36 }),
run3: P({ t:24, lh:45, lk:20, rh:-38, rk:35, ls:-25, le:60, rs:60, re:80, hy:38 }),
jumpUp: P({ t:8, lh:35, lk:60, rh:55, rk:70, ls:40, le:70, rs:120, re:30, hy:42 }),
jumpTop: P({ t:4, lh:45, lk:80, rh:60, rk:90, ls:35, le:80, rs:60, re:80, hy:42 }),
jumpDn: P({ t:10, lh:20, lk:35, rh:40, rk:45, ls:45, le:60, rs:70, re:50, hy:42 }),
crouchIn: P({ hy:30, t:14, lh:35, lk:60, rh:55, rk:75, ls:30, le:90, rs:45, re:95 }),
crouch: P({ hy:20, t:16, lh:55, lk:105, rh:75, rk:120, ls:32, le:95, rs:50, re:100 }),
backdash: P({ t:-14, lh:-30, lk:40, rh:25, rk:35, ls:50, le:80, rs:70, re:70, hy:40 }),
// ---- guard / hit ----
guardHi: P({ t:2, ls:40, le:115, rs:62, re:118, lh:-12, lk:8, rh:12, rk:10, hy:39 }),
guardLo: P({ hy:20, t:12, lh:55, lk:105, rh:75, rk:120, ls:42, le:112, rs:60, re:118 }),
guardAir: P({ t:6, lh:35, lk:60, rh:50, rk:70, ls:45, le:110, rs:62, re:115, hy:42 }),
hitHi: P({ t:-16, n:-14, ls:-15, le:30, rs:-5, re:40, lh:-16, lk:10, rh:8, rk:6, hy:39 }),
hitHi2: P({ t:-24, n:-18, ls:-25, le:20, rs:-15, re:35, lh:-20, lk:14, rh:4, rk:8, hy:38 }),
hitGut: P({ t:26, n:10, ls:15, le:60, rs:20, re:65, lh:-10, lk:14, rh:16, rk:16, hy:36 }),
hitLo: P({ hy:19, t:26, n:8, lh:50, lk:100, rh:72, rk:118, ls:20, le:60, rs:25, re:70 }),
hitAir: P({ t:-30, n:-15, lh:20, lk:30, rh:45, rk:40, ls:-30, le:20, rs:120, re:20, hy:42 }),
flyBack: P({ t:-55, n:-20, lh:35, lk:25, rh:60, rk:35, ls:-40, le:15, rs:140, re:15, hy:42 }),
lieDown: P({ hy:7, t:-88, n:-10, lh:86, lk:6, rh:80, rk:12, ls:-60, le:10, rs:160, re:10, lf:10, rf:10 }),
getup1: P({ hy:16, t:30, lh:60, lk:110, rh:80, rk:125, ls:60, le:60, rs:70, re:60 }),
getup2: P({ hy:32, t:16, lh:30, lk:50, rh:45, rk:60, ls:35, le:80, rs:50, re:85 }),
rollA: P({ hy:22, t:60, n:30, lh:70, lk:120, rh:90, rk:130, ls:70, le:110, rs:80, re:115 }),
rollB: P({ hy:18, t:120, n:40, lh:95, lk:135, rh:110, rk:140, ls:100, le:120, rs:110, re:125 }),
dizzy: P({ t:-8, n:16, ls:10, le:30, rs:15, re:35, lh:-14, lk:12, rh:10, rk:10, hy:37 }),
// ---- normals ----
jabWind: P({ t:6, ls:32, le:100, rs:60, re:95, lh:-12, rh:14 }),
jabA: P({ t:10, ls:32, le:105, rs:88, re:4, lh:-14, rh:16, hy:40 }),
straightWind: P({ t:-6, ls:36, le:105, rs:30, re:110, hx:-3, lh:-18, rh:10 }),
straightA: P({ t:20, hx:5, ls:38, le:110, rs:95, re:0, lh:-24, lk:10, rh:22, rk:8 }),
upperWind: P({ t:22, hy:34, ls:35, le:95, rs:-20, re:80, lh:-12, lk:20, rh:20, rk:25 }),
upperHit: P({ t:-14, hy:41, ls:30, le:100, rs:172, re:8, lh:-20, lk:8, rh:18, rk:30 }),
lkickA: P({ t:-8, ls:35, le:100, rs:50, re:95, lh:-8, lk:5, rh:78, rk:8, hy:40, rf:95 }),
hkickWind: P({ t:10, hy:38, ls:40, le:95, rs:55, re:100, lh:-15, lk:10, rh:35, rk:70 }),
hkickA: P({ t:-16, ls:45, le:90, rs:20, re:60, lh:-6, lk:5, rh:102, rk:4, hy:41, rf:100 }),
cJabA: P({ hy:20, t:18, lh:55, lk:105, rh:75, rk:120, ls:35, le:95, rs:88, re:6 }),
cUpperA: P({ hy:24, t:-4, lh:50, lk:95, rh:70, rk:112, ls:35, le:95, rs:165, re:10 }),
cKickA: P({ hy:20, t:20, lh:55, lk:105, rh:70, rk:20, ls:32, le:95, rs:48, re:95, rf:92 }),
sweepA: P({ hy:16, t:30, lh:60, lk:112, rh:58, rk:2, ls:45, le:80, rs:60, re:40, rf:90 }),
jumpP: P({ t:18, lh:30, lk:55, rh:50, rk:70, ls:40, le:80, rs:110, re:35, hy:42 }),
jumpHP: P({ t:26, lh:25, lk:45, rh:45, rk:65, ls:50, le:70, rs:120, re:10, hy:42 }),
jumpLK: P({ t:12, lh:40, lk:75, rh:70, rk:15, ls:40, le:80, rs:60, re:80, hy:42, rf:95 }),
jumpHK: P({ t:22, lh:45, lk:85, rh:60, rk:5, ls:55, le:60, rs:30, re:70, hy:42, rf:100 }),
blowCD: P({ t:34, hx:6, ls:40, le:100, rs:60, re:15, lh:-28, lk:12, rh:30, rk:10, hy:38 }),
jumpCD: P({ t:30, lh:35, lk:60, rh:55, rk:8, ls:60, le:50, rs:45, re:60, hy:42, rf:100 }),
// ---- throws ----
grabReach: P({ t:16, ls:60, le:40, rs:75, re:20, lh:-14, rh:16, hy:39 }),
throwToss: P({ t:-20, hx:-2, ls:120, le:20, rs:150, re:15, lh:-22, lk:10, rh:16, rk:12, hy:40 }),
thrownHeld: P({ t:-40, lh:30, lk:40, rh:55, rk:50, ls:-30, le:20, rs:130, re:25, hy:42 }),
// ---- specials shared ----
fbWind: P({ t:12, hy:36, ls:-30, le:60, rs:-40, re:70, lh:-16, lk:15, rh:18, rk:20 }),
fbThrow: P({ t:22, hx:4, ls:80, le:15, rs:85, re:8, lh:-26, lk:10, rh:24, rk:10, hy:38 }),
dpWind: P({ hy:26, t:28, lh:45, lk:90, rh:65, rk:105, ls:20, le:80, rs:-30, re:90 }),
dpRise: P({ hy:42, t:-10, lh:15, lk:35, rh:55, rk:80, ls:-20, le:40, rs:175, re:5 }),
rekka1: P({ t:18, hx:4, ls:40, le:100, rs:100, re:15, lh:-20, rh:20, hy:39 }),
rekka2: P({ t:24, hx:6, ls:95, le:10, rs:35, re:90, lh:-24, rh:24, hy:38 }),
rekka3: P({ t:14, hx:6, hy:34, ls:45, le:95, rs:130, re:40, lh:-20, lk:15, rh:22, rk:20 }),
palmA: P({ t:20, hx:4, ls:38, le:105, rs:80, re:12, lh:-22, rh:22, hy:39, rf:85 }),
lariat1: P({ t:8, ls:95, le:5, rs:95, re:5, lh:-14, lk:8, rh:16, rk:8, hy:40 }),
lariat2: P({ t:-8, ls:100, le:8, rs:100, re:8, lh:-10, lk:8, rh:12, rk:8, hy:41 }),
slideA: P({ hy:13, t:42, lh:45, lk:80, rh:62, rk:4, ls:60, le:70, rs:30, re:50, rf:90 }),
diveKick: P({ t:32, lh:45, lk:80, rh:75, rk:10, ls:60, le:60, rs:110, re:30, hy:42, rf:110 }),
flipKick1: P({ t:-22, hy:40, lh:-20, lk:20, rh:120, rk:15, ls:60, le:70, rs:100, re:40, rf:120 }),
flipKick2: P({ t:-45, hy:42, lh:10, lk:40, rh:160, rk:10, ls:80, le:60, rs:130, re:30, rf:140 }),
tackle: P({ t:48, hx:8, ls:20, le:90, rs:45, re:70, lh:-30, lk:20, rh:35, rk:15, hy:34 }),
kneeRise: P({ hy:42, t:-16, lh:-15, lk:25, rh:95, rk:90, ls:50, le:80, rs:110, re:60 }),
beamPose: P({ t:14, hx:3, ls:85, le:10, rs:88, re:6, lh:-20, lk:8, rh:20, rk:10, hy:38 }),
chargePose: P({ t:10, hy:36, ls:45, le:120, rs:55, re:125, lh:-16, lk:14, rh:18, rk:16 }),
grabLift: P({ t:-12, ls:140, le:25, rs:150, re:20, lh:-14, lk:8, rh:14, rk:10, hy:40 }),
grabSlam: P({ t:44, hy:30, ls:60, le:10, rs:70, re:5, lh:-20, lk:25, rh:25, rk:25 }),
stomp: P({ t:12, hy:38, lh:-10, lk:8, rh:70, rk:60, ls:40, le:90, rs:60, re:80, rf:100 }),
axeKick: P({ t:20, ls:45, le:90, rs:30, re:60, lh:-8, lk:5, rh:115, rk:35, hy:40, rf:60 }),
teleFade: P({ hy:24, t:20, lh:45, lk:95, rh:65, rk:110, ls:70, le:115, rs:75, re:118 }),
spinKick: P({ t:-10, ls:60, le:40, rs:80, re:30, lh:-10, lk:6, rh:95, rk:10, hy:41, rf:100 }),
// ---- win / misc ----
winA: P({ t:-6, ls:25, le:30, rs:170, re:12, lh:-10, lk:6, rh:12, rk:6 }),
winB: P({ t:4, ls:45, le:110, rs:45, re:110, lh:-12, rh:14, n:6 }),
winC: P({ t:-4, ls:100, le:5, rs:100, re:5, lh:-16, rh:16 }),
intro1: P({ t:12, ls:35, le:90, rs:70, re:95, lh:-14, rh:16, hy:38 }),
taunt: P({ t:-6, n:10, ls:20, le:20, rs:70, re:100, lh:-12, rh:14 })
};

// interpolate two poses (for tween authoring)
function mix(a, b, f){
  var pa = Poses[a]||a, pb = Poses[b]||b, r = {};
  for(var k in D){ r[k] = pa[k] + (pb[k]-pa[k])*f; }
  return r;
}

KOF.Poses = Poses;
KOF.PoseDefault = D;
KOF.PoseMix = mix;
KOF.MakePose = P;
})();
