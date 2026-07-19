/* player.js — 玩家:步行角色控制、街机化车辆动力学(漂移/胎痕/轮烟)、
   开门上下车动画衔接、第三人称镜头(惯性/FOV随速/碰撞收缩/震屏) */
window.G = window.G || {};
(function () {
  const U = G.U;
  const P = {};
  G.PLAYER = P;

  const keys = {};
  P.keys = keys;
  let scene, camera;
  let mouseDown = false, mouseYaw = 0, mousePitch = 0, mouseIdle = 99, zoomMul = 1;

  P.init = function (sc, cam) {
    scene = sc; camera = cam;
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (!e.repeat) P.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyG') G.AUDIO.horn(false); });
    const cv = document.getElementById('c');
    cv.addEventListener('mousedown', () => { mouseDown = true; });
    window.addEventListener('mouseup', () => { mouseDown = false; });
    window.addEventListener('mousemove', e => {
      if (!mouseDown) return;
      mouseYaw -= e.movementX * 0.0042;
      mousePitch = U.clamp(mousePitch - e.movementY * 0.003, -0.5, 0.55);
      mouseIdle = 0;
    });
    window.addEventListener('wheel', e => { zoomMul = U.clamp(zoomMul + (e.deltaY > 0 ? 0.1 : -0.1), 0.62, 1.8); }, { passive: true });

    /* 角色 */
    P.char = G.CHAR.build();
    P.char.group.position.set(G.CITY.spawn[0], 0.1, G.CITY.spawn[1]);
    P.char.onStep = (run) => { G.AUDIO.step(run); if (run > 0.5) { const p = P.char.group.position; G.FX.dust(p.x, p.y + 0.06, p.z, U.rand(Math.random, -0.4, 0.4), 0.5, U.rand(Math.random, -0.4, 0.4)); } };
    scene.add(P.char.group);
    P.mode = 'walk';
    P.veh = null;
    P.heading = Math.PI;
    P.vel = new THREE.Vector2();
    P.camYaw = Math.PI; P.camPos = new THREE.Vector3(); P.camLook = new THREE.Vector3();
    P.camPos.set(G.CITY.spawn[0], 4, G.CITY.spawn[1] + 8);
    P.shake = 0;
    P.driftScore = 0; P.driftPop = 0;
    P.camMode = 0;
    P.fov = 60;
    /* 大灯 */
    P.spotL = new THREE.SpotLight(0xffeecc, 0, 60, 0.5, 0.45, 1.3);
    P.spotR = new THREE.SpotLight(0xffeecc, 0, 60, 0.5, 0.45, 1.3);
    P.spotLT = new THREE.Object3D(); P.spotRT = new THREE.Object3D();
    P.spotL.target = P.spotLT; P.spotR.target = P.spotRT;
    scene.add(P.spotL, P.spotR, P.spotLT, P.spotRT);
    const t = G.TEX.t;
    P.glowL = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.flare.map, color: 0xfff2cc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    P.glowR = P.glowL.clone();
    P.glowL.scale.set(1.5, 1.5, 1); P.glowR.scale.set(1.5, 1.5, 1);
    scene.add(P.glowL, P.glowR);
  };

  P.onKey = function (code) {
    if (code === 'KeyE') {
      if (P.mode === 'walk') tryEnter();
      else if (P.mode === 'drive') tryExit();
    }
    if (code === 'KeyC') P.camMode = (P.camMode + 1) % 3;
    if (code === 'KeyG' && P.mode === 'drive') G.AUDIO.horn(true);
    if (code === 'KeyR' && P.mode === 'drive') {
      const n = (G.AUDIO.station + 2) % (G.AUDIO.stations.length + 1) - 1;
      G.AUDIO.setStation(n);
      G.GAME.radioToast(n);
    }
  };

  /* ================= 车辆注册 ================= */
  P.cars = [];
  P.registerCar = function (veh, x, z, heading) {
    veh.root.position.set(x, 0, z);
    veh.root.rotation.y = heading;
    veh.sim = { x, z, h: heading, vx: 0, vz: 0, yawRate: 0, steer: 0, rpm: 0, gear: 1, damage: 0, y: G.CITY.heightAt(x, z) };
    scene.add(veh.root);
    P.cars.push(veh);
    return veh;
  };

  function carDoorWorld(veh) {
    return veh.doorOut.clone().applyEuler(new THREE.Euler(0, veh.sim.h, 0)).add(new THREE.Vector3(veh.sim.x, 0, veh.sim.z));
  }
  function tryEnter() {
    let best = null, bd = 3.2;
    const p = P.char.group.position;
    for (const v of P.cars) {
      const d = Math.hypot(v.sim.x - p.x, v.sim.z - p.z) - v.spec.L * 0.3;
      if (d < bd) { bd = d; best = v; }
    }
    if (!best) return;
    P.veh = best;
    if (best.trafficIdx != null) G.GAME.releaseTraffic(best);
    P.mode = 'enter';
    P.animT = 0;
    P.enterFrom = p.clone();
    P.doorPoint = carDoorWorld(best);
    G.GAME.onEnterCar && G.GAME.onEnterCar(best);
  }
  function tryExit() {
    const v = P.veh;
    if (!v) return;
    if (Math.hypot(v.sim.vx, v.sim.vz) > 3.5) return;
    P.mode = 'exit';
    P.animT = 0;
    G.AUDIO.engine(false, 0, 0);
    G.AUDIO.skid(0);
    G.AUDIO.radioGain(false);
  }

  /* ================= 每帧 ================= */
  P.update = function (dt) {
    mouseIdle += dt;
    if (P.mode === 'walk') updateWalk(dt);
    else if (P.mode === 'drive') updateDrive(dt);
    else if (P.mode === 'enter') updateEnter(dt);
    else if (P.mode === 'exit') updateExit(dt);
    /* 非玩家车静置 */
    for (const v of P.cars) {
      if (v === P.veh && P.mode !== 'walk') continue;
      if (v.trafficIdx != null) continue;
      syncCar(v, dt, false);
    }
    updateCamera(dt);
  };

  /* ---------------- 步行 ---------------- */
  function updateWalk(dt) {
    const ch = P.char;
    let ix = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    let iz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
    const run = keys.ShiftLeft || keys.ShiftRight;
    const want = (ix || iz) ? (run ? 5.6 : 1.9) : 0;
    const mlen = Math.hypot(ix, iz) || 1;
    ix /= mlen; iz /= mlen;
    /* 相机相对 */
    const cy = P.camYaw;
    const wx = ix * Math.cos(cy) + iz * Math.sin(cy);
    const wz = -ix * Math.sin(cy) + iz * Math.cos(cy);
    const targetV = new THREE.Vector2(wx * want, wz * want);
    P.vel.x = U.damp(P.vel.x, targetV.x, 8, dt);
    P.vel.y = U.damp(P.vel.y, targetV.y, 8, dt);
    const sp = P.vel.length();
    const pos = ch.group.position;
    let nx = pos.x + P.vel.x * dt, nz = pos.z + P.vel.y * dt;
    /* 碰撞 */
    const R = 0.34;
    const boxes = G.CITY.hash.query(nx - 2, nz - 2, nx + 2, nz + 2);
    for (const b of boxes) {
      if (b.y0 > 1.6) continue;
      const push = U.circlePush(nx, nz, R, b);
      if (push) { nx += push[0]; nz += push[1]; }
    }
    for (const v of P.cars) {
      const d = new THREE.Vector2(nx - v.sim.x, nz - v.sim.z);
      d.rotateAround(new THREE.Vector2(), -v.sim.h);
      const hw = v.halfW + R, hl = v.halfL + R;
      if (Math.abs(d.x) < hw && Math.abs(d.y) < hl) {
        const pxo = hw - Math.abs(d.x), pzo = hl - Math.abs(d.y);
        if (pxo < pzo) d.x = Math.sign(d.x) * hw; else d.y = Math.sign(d.y) * hl;
        d.rotateAround(new THREE.Vector2(), v.sim.h);
        nx = v.sim.x + d.x; nz = v.sim.z + d.y;
      }
    }
    const h = G.CITY.heightAt(nx, nz);
    if (h < -1) {
      /* 落水 → 捞起 */
      G.FX.splash(nx, 0, nz);
      G.AUDIO.crash(0.3);
      const nnx = U.clamp(pos.x, -220, 220), nnz = U.clamp(pos.z, -220, 220);
      ch.group.position.set(G.CITY.roadAt(Math.round((nnx - G.CITY.OFF) / 64)), 0.1, G.CITY.roadAt(Math.round((nnz - G.CITY.OFF) / 64)));
      P.vel.set(0, 0);
      G.GAME.toast('你被免费捞了上来 🌊');
      return;
    }
    pos.x = nx; pos.z = nz;
    pos.y = U.damp(pos.y, h, 12, dt);
    if (sp > 0.2) {
      const targetH = Math.atan2(P.vel.x, P.vel.y);
      const turn = U.wrapAngle(targetH - P.heading);
      P.heading = U.dampAngle(P.heading, targetH, 10, dt);
      ch.setMove(sp, turn);
    } else ch.setMove(0, 0);
    ch.group.rotation.y = P.heading;
    ch.update(dt, {});
    G.AUDIO.ambience(shore01(pos.x, pos.z), 0, G.state && G.state.night01 > 0.5);
  }
  function shore01(x, z) {
    const dx = Math.max(0, 236 - Math.abs(x));
    const dz1 = Math.max(0, z + 236), dz2 = Math.max(0, 274 - z);
    const d = Math.min(dx, dz1, dz2);
    return U.clamp(1 - d / 60, 0, 1);
  }

  /* ---------------- 驾驶 ---------------- */
  function updateDrive(dt) {
    const v = P.veh, s = v.sim, spec = v.spec;
    const f = new THREE.Vector2(Math.sin(s.h), Math.cos(s.h));
    const r = new THREE.Vector2(f.y, -f.x);
    let vF = s.vx * f.x + s.vz * f.y;
    let vL = s.vx * r.x + s.vz * r.y;
    const throttle = keys.KeyW || keys.ArrowUp ? 1 : 0;
    const brake = keys.KeyS || keys.ArrowDown ? 1 : 0;
    const hand = keys.Space ? 1 : 0;
    const sIn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const speed = Math.hypot(s.vx, s.vz);
    /* 转向 */
    const maxSteer = 0.62 / (1 + speed * 0.055);
    s.steer = U.damp(s.steer, sIn * maxSteer, 7, dt);
    /* 纵向 */
    let aF = 0;
    if (throttle) aF += spec.power * (1 - U.clamp(vF / spec.top, -0.2, 0.96));
    if (brake) {
      if (vF > 0.6) aF -= 22;
      else aF -= spec.power * 0.55;                     // 倒车
    }
    aF -= vF * 0.045 + Math.sign(vF) * 0.35;            // 阻力
    if (hand) aF -= Math.sign(vF) * 7;
    /* 横向抓地 */
    let grip = spec.grip;
    if (hand) grip *= 0.30;
    const aLmax = 26;
    let aL = -vL * grip;
    aL = U.clamp(aL, -aLmax, aLmax);
    const drifting = Math.abs(vL) > 3.4 || (hand && speed > 7);
    /* 手刹甩尾 */
    if (hand && speed > 4) s.yawRate += s.steer * dt * 2.4 * Math.min(1, speed / 14);
    /* 积分 */
    vF += aF * dt; vL += aL * dt;
    s.vx = f.x * vF + r.x * vL;
    s.vz = f.y * vF + r.y * vL;
    const yawTarget = vF / spec.wb * Math.tan(s.steer) * (drifting ? 0.75 : 1);
    s.yawRate = U.damp(s.yawRate, yawTarget, drifting ? 3.2 : 8, dt);
    s.h += s.yawRate * dt;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    /* 碰撞 */
    collideCar(v, dt);
    /* 落水 */
    const hh = G.CITY.heightAt(s.x, s.z);
    if (hh < -1) {
      G.FX.splash(s.x, 0, s.z);
      G.AUDIO.crash(0.8);
      G.GAME.toast('拖车把你和车都捞了上来 🚗🌊');
      const ni = U.clamp(Math.round((s.x - G.CITY.OFF) / 64), 0, 7), nj = U.clamp(Math.round((s.z - G.CITY.OFF) / 64), 0, 7);
      s.x = G.CITY.roadAt(ni); s.z = G.CITY.roadAt(nj) + 3;
      s.vx = s.vz = s.yawRate = 0;
      P.shake = 0.4;
    }
    s.y = U.damp(s.y, Math.max(0, hh), 10, dt);
    syncCar(v, dt, true, vF, vL, drifting, throttle, brake, hand);
    /* 角色手部跟方向盘 */
    const ch = P.char;
    ch.update(dt, {
      steer: s.steer / 0.62,
      wheelPos: v.wheelPos.clone().sub(v.seatL),
      wheelR: 0.19,
      headTurn: U.clamp(s.steer * 1.2, -0.5, 0.5)
    });
    /* 声音 */
    const rpm = U.clamp(Math.abs(vF) / spec.top + Math.abs(aF) * 0.006 * throttle, 0, 1);
    s.rpm = U.damp(s.rpm, rpm, 5, dt);
    G.AUDIO.engine(true, s.rpm, throttle * 0.8 + hand * 0.2);
    const slip = U.clamp((Math.abs(vL) - 2.2) / 8, 0, 1) * U.clamp(speed / 8, 0, 1);
    G.AUDIO.skid(drifting ? Math.max(slip, 0.35) : slip * 0.6);
    G.AUDIO.ambience(shore01(s.x, s.z), U.clamp(speed / 40, 0, 1), false);
    /* 漂移分 & 特效 */
    if (drifting && speed > 6) {
      P.driftScore += Math.abs(vL) * dt * 14;
      P.driftPop = 1.2;
      for (const w of v.wheels) {
        if (w.steer) continue;
        const wp = new THREE.Vector3(w.side * (spec.W / 2 - 0.2), 0.02, w.z).applyEuler(new THREE.Euler(0, s.h, 0));
        const wx = s.x + wp.x, wz = s.z + wp.z;
        G.FX.skid('w' + w.side + (w.z > 0 ? 'f' : 'r'), wx, s.y, wz, U.clamp(slip + 0.3, 0, 1));
        if (Math.random() < dt * 30) {
          const g2 = 0.55 + Math.random() * 0.2;
          G.FX.smoke(wx, s.y + 0.15, wz, -s.vx * 0.06 + U.rand(Math.random, -0.5, 0.5), 0.8, -s.vz * 0.06 + U.rand(Math.random, -0.5, 0.5), 0.9, 1.4, g2, 0.34);
        }
      }
    }
    P.speedKmh = speed * 3.6;
    v.brakeGlow(brake > 0);
  }

  function collideCar(v, dt) {
    const s = v.sim, spec = v.spec;
    const corners = [[spec.W / 2 - 0.1, spec.L / 2 - 0.12], [-spec.W / 2 + 0.1, spec.L / 2 - 0.12], [spec.W / 2 - 0.1, -spec.L / 2 + 0.12], [-spec.W / 2 + 0.1, -spec.L / 2 + 0.12]];
    const boxes = G.CITY.hash.query(s.x - 5, s.z - 5, s.x + 5, s.z + 5);
    let bump = 0;
    for (const [cx, cz] of corners) {
      const wx = s.x + cx * Math.cos(s.h) + cz * Math.sin(s.h);
      const wz = s.z - cx * Math.sin(s.h) + cz * Math.cos(s.h);
      for (const b of boxes) {
        if (b.y0 > 2.5) continue;
        if (wx > b.x0 && wx < b.x1 && wz > b.z0 && wz < b.z1) {
          const pl = wx - b.x0, pr = b.x1 - wx, pt = wz - b.z0, pb = b.z1 - wz;
          const m = Math.min(pl, pr, pt, pb);
          let nx = 0, nz = 0;
          if (m === pl) nx = -1; else if (m === pr) nx = 1; else if (m === pt) nz = -1; else nz = 1;
          s.x += nx * m; s.z += nz * m;
          const vn = s.vx * nx + s.vz * nz;
          if (vn < 0) {
            s.vx -= vn * nx * 1.3; s.vz -= vn * nz * 1.3;
            bump = Math.max(bump, -vn);
            s.yawRate += (cx * nz - cz * nx) * vn * 0.05;
            G.FX.spark(wx, s.y + 0.4, wz, 5);
          }
        }
      }
      /* 与其他车 */
      for (const o of P.cars) {
        if (o === v) continue;
        const dx = wx - o.sim.x, dz = wz - o.sim.z;
        const lx = dx * Math.cos(-o.sim.h) + dz * Math.sin(-o.sim.h);
        const lz = -dx * Math.sin(-o.sim.h) + dz * Math.cos(-o.sim.h);
        if (Math.abs(lx) < o.halfW + 0.05 && Math.abs(lz) < o.halfL + 0.05) {
          const pxo = o.halfW + 0.05 - Math.abs(lx), pzo = o.halfL + 0.05 - Math.abs(lz);
          let nx, nz;
          if (pxo < pzo) { nx = Math.sign(lx) * Math.cos(o.sim.h); nz = -Math.sign(lx) * Math.sin(o.sim.h); }
          else { nx = Math.sign(lz) * Math.sin(o.sim.h); nz = Math.sign(lz) * Math.cos(o.sim.h); }
          const pd = Math.min(pxo, pzo);
          s.x += nx * pd; s.z += nz * pd;
          const vn = s.vx * nx + s.vz * nz;
          if (vn < 0) {
            s.vx -= vn * nx * 1.5; s.vz -= vn * nz * 1.5;
            bump = Math.max(bump, -vn * 0.8);
          }
        }
      }
    }
    if (bump > 2) {
      G.AUDIO.crash(U.clamp(bump / 14, 0.15, 1));
      P.shake = Math.min(0.7, bump * 0.035);
      v.sim.damage += bump;
      G.GAME.damageFlash(U.clamp(bump / 16, 0, 0.6));
    } else if (bump > 0.5) G.AUDIO.crash(0.12);
  }

  function syncCar(v, dt, active, vF, vL, drifting, throttle, brake, hand) {
    const s = v.sim;
    v.root.position.set(s.x, s.y, s.z);
    v.root.rotation.y = s.h;
    if (!active) return;
    /* 车轮转动 & 转向 */
    const spin = (vF || 0) / v.spec.wr * dt;
    for (const w of v.wheels) {
      w.spin.rotation.x += spin;
      if (w.steer) w.steerG.rotation.y = s.steer * 0.9;
    }
    /* 车身姿态(俯仰/侧倾) */
    const pitchT = U.clamp((throttle ? -0.016 : 0) + (brake ? 0.024 : 0) * Math.sign(vF || 1), -0.05, 0.05);
    const rollT = U.clamp((vL || 0) * 0.006 + s.steer * -0.02, -0.06, 0.06);
    v.body.rotation.x = U.damp(v.body.rotation.x, pitchT, 6, dt);
    v.body.rotation.z = U.damp(v.body.rotation.z, rollT, 6, dt);
    /* 排气 */
    if (throttle && Math.random() < dt * 8 && Math.abs(vF) < 8) {
      const ep = new THREE.Vector3(v.spec.W / 2 - 0.35, 0.22, -v.spec.L / 2).applyEuler(new THREE.Euler(0, s.h, 0));
      G.FX.smoke(s.x + ep.x, s.y + ep.y, s.z + ep.z, 0, 0.4, 0, 0.3, 0.8, 0.3, 0.16);
    }
    /* 大灯 */
    const night = G.state ? G.state.night01 : 0;
    const lightsOn = night > 0.42;
    if (v.lightsOn !== lightsOn) v.setLights(lightsOn);
    const e = new THREE.Euler(0, s.h, 0);
    for (const [spot, tgt, glow, sx] of [[P.spotL, P.spotLT, P.glowL, 0.55], [P.spotR, P.spotRT, P.glowR, -0.55]]) {
      const lp = new THREE.Vector3(sx, 0.62, v.spec.L / 2 - 0.05).applyEuler(e);
      spot.position.set(s.x + lp.x, s.y + lp.y, s.z + lp.z);
      const tp = new THREE.Vector3(sx, 0.1, v.spec.L / 2 + 17).applyEuler(e);
      tgt.position.set(s.x + tp.x, s.y + tp.y, s.z + tp.z);
      spot.intensity = lightsOn ? 2.6 : 0;
      glow.position.set(s.x + lp.x, s.y + lp.y, s.z + lp.z + 0);
      glow.material.opacity = lightsOn ? 0.75 : 0;
    }
  }

  /* ---------------- 上下车动画 ---------------- */
  function updateEnter(dt) {
    P.animT += dt;
    const v = P.veh, ch = P.char;
    const T1 = 0.4, T2 = 0.72, T3 = 1.3, T4 = 1.55;
    const t = P.animT;
    const door = carDoorWorld(v);
    if (t < T1) {
      const k = U.smooth(t / T1);
      ch.group.position.lerpVectors(P.enterFrom, door, k);
      const dir = Math.atan2(v.sim.x - door.x, v.sim.z - door.z);
      P.heading = U.dampAngle(P.heading, dir, 12, dt);
      ch.group.rotation.y = P.heading;
      ch.setMove(2.2, 0); ch.update(dt, {});
    } else if (t < T2) {
      v.doorPivot.rotation.y = U.smooth((t - T1) / (T2 - T1)) * 1.0;
      ch.setMove(0, 0); ch.update(dt, {});
    } else if (t < T3) {
      if (!P._parented) {
        P._parented = true;
        v.body.add(ch.group);
        ch.group.position.copy(door.sub(new THREE.Vector3(v.sim.x, v.sim.y || 0, v.sim.z)).applyEuler(new THREE.Euler(0, -v.sim.h, 0)));
        ch.group.rotation.y = 0;
        ch.mode = 'enter';
      }
      const k = U.smooth((t - T2) / (T3 - T2));
      const seatPos = v.seatL.clone().add(new THREE.Vector3(0, -0.86 + (v.type === 'sports' ? -0.05 : 0), 0.05));
      const doorLocal = new THREE.Vector3(v.spec.W / 2 + 0.55, 0, v.seatL.z + 0.3);
      ch.group.position.lerpVectors(doorLocal, seatPos, k);
      ch.group.position.y += Math.sin(k * Math.PI) * 0.12;
      ch.update(dt, { t: k });
    } else if (t < T4) {
      v.doorPivot.rotation.y = (1 - U.smooth((t - T3) / (T4 - T3))) * 1.0;
      ch.mode = 'seat';
      ch.update(dt, { steer: 0, wheelPos: v.wheelPos.clone().sub(v.seatL), wheelR: 0.19 });
    } else {
      P.mode = 'drive';
      P._parented = false;
      G.AUDIO.blip(440);
      G.AUDIO.radioGain(true);
      G.GAME.onDriveStart && G.GAME.onDriveStart(v);
    }
  }
  function updateExit(dt) {
    P.animT += dt;
    const v = P.veh, ch = P.char;
    const T1 = 0.25, T2 = 0.85, T3 = 1.1;
    const t = P.animT;
    if (t < T1) {
      v.doorPivot.rotation.y = U.smooth(t / T1) * 1.0;
      ch.update(dt, { t: 1 });
      ch.mode = 'exit';
    } else if (t < T2) {
      const k = U.smooth((t - T1) / (T2 - T1));
      const seatPos = v.seatL.clone().add(new THREE.Vector3(0, -0.86, 0.05));
      const doorLocal = new THREE.Vector3(v.spec.W / 2 + 0.75, 0, v.seatL.z + 0.35);
      ch.group.position.lerpVectors(seatPos, doorLocal, k);
      ch.update(dt, { t: 1 - k });
    } else if (t < T3) {
      if (!P._unparented) {
        P._unparented = true;
        const wp = new THREE.Vector3();
        ch.group.getWorldPosition(wp);
        scene.add(ch.group);
        wp.y = G.CITY.heightAt(wp.x, wp.z);
        ch.group.position.copy(wp);
        ch.group.rotation.set(0, v.sim.h + Math.PI / 2, 0);
        P.heading = v.sim.h + Math.PI / 2;
        ch.mode = 'stand';
        ch.setMove(0, 0);
      }
      v.doorPivot.rotation.y = (1 - U.smooth((t - T2) / (T3 - T2))) * 1.0;
      ch.update(dt, {});
    } else {
      P.mode = 'walk';
      P._unparented = false;
      P.vel.set(0, 0);
      const s = P.veh.sim;
      s.vx *= 0.2; s.vz *= 0.2;
      P.spotL.intensity = P.spotR.intensity = 0;
      P.glowL.material.opacity = P.glowR.material.opacity = 0;
      P.veh.brakeGlow(false);
      P.veh = null;
    }
  }

  /* ---------------- 镜头 ---------------- */
  const camTmp = new THREE.Vector3(), lookTmp = new THREE.Vector3();
  function updateCamera(dt) {
    let targetPos, lookAt, dist, height, fovT;
    const drive = P.mode === 'drive' || (P.mode === 'enter' && P.animT > 0.9) || P.mode === 'exit';
    if (drive && P.veh) {
      const s = P.veh.sim;
      const speed = Math.hypot(s.vx, s.vz);
      const back = Math.atan2(-Math.sin(s.h), -Math.cos(s.h));
      if (mouseIdle > 2.2 && speed > 3) {
        mouseYaw = U.dampAngle(mouseYaw, 0, 1.6, dt);
        mousePitch = U.damp(mousePitch, 0, 1.6, dt);
      }
      const mode = P.camMode;
      dist = (mode === 1 ? 10.5 : 6.1) * zoomMul + speed * 0.055;
      height = (mode === 1 ? 4.6 : 2.35) + speed * 0.02;
      if (mode === 2) { dist = -0.4; height = P.veh.spec.H - 0.18; }
      const yaw = s.h + Math.PI + mouseYaw;
      const lateral = U.clamp(-s.yawRate * 0.9, -1.4, 1.4) * (mode === 2 ? 0 : 1);
      targetPos = new THREE.Vector3(
        s.x + Math.sin(yaw) * dist + Math.cos(s.h) * lateral,
        s.y + height + mousePitch * dist,
        s.z + Math.cos(yaw) * dist - Math.sin(s.h) * lateral
      );
      lookAt = new THREE.Vector3(s.x + Math.sin(s.h) * 4.2, s.y + 1.1, s.z + Math.cos(s.h) * 4.2);
      if (mode === 2) lookAt.set(s.x + Math.sin(s.h) * 30, s.y + 0.6, s.z + Math.cos(s.h) * 30);
      fovT = 58 + U.clamp(speed / 42, 0, 1) * 17;
      P.camYaw = yaw + Math.PI;
    } else {
      const p = P.char.group.getWorldPosition(new THREE.Vector3());
      const speed = P.vel.length();
      if (mouseIdle > 3 && speed > 0.6) mousePitch = U.damp(mousePitch, 0.06, 1, dt);
      /* 相机 yaw 独立累计:鼠标增量 + 移动时缓回身后 */
      if (P._cy == null) P._cy = P.heading + Math.PI;
      P._cy += mouseYaw - (P._lastMY || 0);
      P._lastMY = mouseYaw;
      if (speed > 0.8 && mouseIdle > 2.4) P._cy = U.dampAngle(P._cy, P.heading + Math.PI, 2.2, dt);
      dist = 4.3 * zoomMul;
      height = 1.9 + mousePitch * 3.4;
      targetPos = new THREE.Vector3(p.x + Math.sin(P._cy) * dist, p.y + height, p.z + Math.cos(P._cy) * dist);
      lookAt = new THREE.Vector3(p.x, p.y + 1.45, p.z);
      fovT = 60;
      P.camYaw = P._cy + Math.PI;
    }
    /* 镜头防穿墙 */
    const boxes = G.CITY.hash.query(Math.min(lookAt.x, targetPos.x) - 1, Math.min(lookAt.z, targetPos.z) - 1, Math.max(lookAt.x, targetPos.x) + 1, Math.max(lookAt.z, targetPos.z) + 1);
    let tMin = 1;
    for (const b of boxes) {
      if (b.y1 < 2) continue;
      const hit = U.segAabb(lookAt, targetPos, b);
      if (hit != null && hit > 0.04 && hit < tMin) tMin = hit;
    }
    if (tMin < 1) targetPos.lerpVectors(lookAt, targetPos, Math.max(0.12, tMin * 0.9));
    if (targetPos.y < 0.5) targetPos.y = 0.5;
    const damp = drive ? 7.5 : 9;
    P.camPos.x = U.damp(P.camPos.x, targetPos.x, damp, dt);
    P.camPos.y = U.damp(P.camPos.y, targetPos.y, damp, dt);
    P.camPos.z = U.damp(P.camPos.z, targetPos.z, damp, dt);
    P.camLook.x = U.damp(P.camLook.x, lookAt.x, 12, dt);
    P.camLook.y = U.damp(P.camLook.y, lookAt.y, 12, dt);
    P.camLook.z = U.damp(P.camLook.z, lookAt.z, 12, dt);
    /* 震屏 */
    P.shake = Math.max(0, P.shake - dt * 1.4);
    const sh = P.shake * P.shake;
    camTmp.copy(P.camPos);
    if (sh > 0.0001) camTmp.add(new THREE.Vector3((Math.random() - 0.5) * sh * 1.4, (Math.random() - 0.5) * sh * 1.1, (Math.random() - 0.5) * sh * 1.4));
    camera.position.copy(camTmp);
    camera.lookAt(P.camLook);
    P.fov = U.damp(P.fov, fovT, 4, dt);
    if (Math.abs(camera.fov - P.fov) > 0.05) { camera.fov = P.fov; camera.updateProjectionMatrix(); }
    P.driftPop = Math.max(0, P.driftPop - dt);
  }
  P.playerPos = function () {
    if (P.mode === 'drive' && P.veh) return new THREE.Vector3(P.veh.sim.x, 0, P.veh.sim.z);
    return P.char.group.getWorldPosition(new THREE.Vector3());
  };
  P.teleport = function (x, z, h) {
    if (P.veh && P.mode === 'drive') {
      P.veh.sim.x = x; P.veh.sim.z = z; P.veh.sim.h = h || 0;
      P.veh.sim.vx = P.veh.sim.vz = 0;
    } else {
      P.char.group.position.set(x, G.CITY.heightAt(x, z), z);
      P.heading = h || 0;
    }
  };
})();
