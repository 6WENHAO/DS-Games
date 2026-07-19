/* game2.js — 玩法层(2):行人(智能避让·零伤亡)、环岛车流、大地图/帮助开关、每帧汇总 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const GM = G.GAME;
  const $ = id => document.getElementById(id);

  /* ================= 行人 ================= */
  GM.initPeds = function (scene) {
    GM.peds = [];
    const tintsList = [
      { jacket: 0xffffff, jeans: 0xffffff, skin: 0xffffff },
      { jacket: 0xd8a878, jeans: 0x8a8f96, skin: 0xffd8b8 },
      { jacket: 0x9fb8d8, jeans: 0x5c6670, skin: 0xf2c8a0 },
      { jacket: 0xc47878, jeans: 0x787878, skin: 0xe8c0a0 },
      { jacket: 0x88c488, jeans: 0x4a5058, skin: 0xffe0c8 },
      { jacket: 0x606870, jeans: 0xa8a8b0, skin: 0xd8a888 }
    ];
    const rng = U.rng(555);
    for (let i = 0; i < 9; i++) {
      const ch = G.CHAR.build({ tints: U.pick(rng, tintsList) });
      const pos = randomSidewalk(rng);
      ch.group.position.set(pos[0], 0.1, pos[1]);
      scene.add(ch.group);
      const ped = { ch, target: randomSidewalk(rng), speed: U.rand(rng, 1.1, 1.7), panic: 0, heading: rng() * U.TAU, shoutT: 0 };
      ch.onStep = null;
      GM.peds.push(ped);
    }
  };
  function randomSidewalk(rng) {
    const i = U.randi(rng, 0, 6), j = U.randi(rng, 0, 6);
    const [cx, cz] = G.CITY.blockCenter(i, j);
    const side = U.randi(rng, 0, 3);
    const t = U.rand(rng, -24, 24);
    if (side === 0) return [cx + t, cz - 24.5];
    if (side === 1) return [cx + t, cz + 24.5];
    if (side === 2) return [cx - 24.5, cz + t];
    return [cx + 24.5, cz + t];
  }
  GM.updatePeds = function (dt) {
    const pp = G.PLAYER.playerPos();
    const carV = G.PLAYER.mode === 'drive' && G.PLAYER.veh ? G.PLAYER.veh.sim : null;
    const carSpeed = carV ? Math.hypot(carV.vx, carV.vz) : 0;
    for (const ped of GM.peds) {
      const p = ped.ch.group.position;
      const distPlayer = Math.hypot(p.x - pp.x, p.z - pp.z);
      /* 远离玩家的行人:传送回附近 */
      if (distPlayer > 190) {
        const rng2 = U.rng((Math.random() * 1e9) | 0);
        const np = randomSidewalk(rng2);
        if (Math.hypot(np[0] - pp.x, np[1] - pp.z) < 160) { p.set(np[0], 0.1, np[1]); ped.target = randomSidewalk(rng2); }
        continue;
      }
      if (distPlayer > 130) { ped.ch.setMove(0, 0); continue; }   // 远处冻结省性能
      /* 躲避快车 */
      let speed = ped.speed, tx = ped.target[0], tz = ped.target[1];
      if (carV && carSpeed > 5) {
        const dx = p.x - carV.x, dz = p.z - carV.z;
        const d = Math.hypot(dx, dz);
        const closing = -(dx * carV.vx + dz * carV.vz) / Math.max(0.1, d);
        if (d < 13 && closing > 4) {
          ped.panic = 1.6;
          const side = Math.sign(dx * carV.vz - dz * carV.vx) || 1;
          tx = p.x + (dx / d + side * -carV.vz / carSpeed) * 10;
          tz = p.z + (dz / d + side * carV.vx / carSpeed) * 10;
          if (ped.shoutT <= 0) { G.AUDIO.blip(300 + Math.random() * 300); ped.shoutT = 2; }
        }
      }
      ped.shoutT -= dt;
      if (ped.panic > 0) { ped.panic -= dt; speed = 5.2; }
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.6 && ped.panic <= 0) {
        ped.target = randomSidewalk(U.rng((Math.random() * 1e9) | 0));
      } else if (d > 0.1) {
        const wantH = Math.atan2(dx, dz);
        ped.heading = U.dampAngle(ped.heading, wantH, ped.panic > 0 ? 10 : 4, dt);
        let nx = p.x + Math.sin(ped.heading) * speed * dt;
        let nz = p.z + Math.cos(ped.heading) * speed * dt;
        const boxes = G.CITY.hash.query(nx - 1, nz - 1, nx + 1, nz + 1);
        for (const b of boxes) {
          if (b.y0 > 1.6) continue;
          const push = U.circlePush(nx, nz, 0.33, b);
          if (push) { nx += push[0]; nz += push[1]; }
        }
        const hh = G.CITY.heightAt(nx, nz);
        if (hh > -1) { p.x = nx; p.z = nz; p.y = U.damp(p.y, hh, 10, dt); }
        else ped.target = randomSidewalk(U.rng((Math.random() * 1e9) | 0));
      }
      ped.ch.group.rotation.y = ped.heading;
      ped.ch.setMove(ped.panic > 0 ? 5.2 : (d > 1.6 ? speed : 0), 0);
      ped.ch.update(dt, {});
    }
  };

  /* ================= 车流 ================= */
  GM.initTraffic = function () {
    GM.traffic = [];
    const rng = U.rng(808);
    const types = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'sports', 'sedan', 'van'];
    for (let i = 0; i < 8; i++) {
      const v = G.VEH.build(types[i], { seed: 3000 + i });
      const ei = U.randi(rng, 0, 7), ej = U.randi(rng, 0, 6);
      const horiz = rng() < 0.5;
      const dir = rng() < 0.5 ? 1 : -1;
      const tv = {
        veh: v,
        horiz, dir,
        road: ei,
        along: G.CITY.roadAt(ej) + 26,
        speed: U.rand(rng, 7.5, 10.5),
        stopT: 0, honkT: 0
      };
      const pos = trafficPos(tv);
      G.PLAYER.registerCar(v, pos[0], pos[1], trafficHeading(tv));
      v.trafficIdx = i;
      GM.traffic.push(tv);
    }
  };
  function trafficPos(tv) {
    /* 右侧通行:沿行进方向右侧 1.8m */
    if (tv.horiz) return [tv.along, G.CITY.roadAt(tv.road) - 1.8 * tv.dir];
    return [G.CITY.roadAt(tv.road) + 1.8 * tv.dir, tv.along];
  }
  function trafficHeading(tv) {
    if (tv.horiz) return tv.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    return tv.dir > 0 ? 0 : Math.PI;
  }
  GM.releaseTraffic = function (veh) {
    const idx = veh.trafficIdx;
    if (idx == null) return;
    veh.trafficIdx = null;
    GM.traffic = GM.traffic.filter(t => t.veh !== veh);
    GM.toast('这是别人的车…现在是你的了 😎');
  };
  GM.updateTraffic = function (dt) {
    const pp = G.PLAYER.playerPos();
    for (const tv of GM.traffic) {
      const v = tv.veh, s = v.sim;
      /* 玩家车挡路检测 */
      let go = tv.speed;
      const hd = trafficHeading(tv);
      const fx = Math.sin(hd), fz = Math.cos(hd);
      if (G.PLAYER.veh && G.PLAYER.mode === 'drive') {
        const ps = G.PLAYER.veh.sim;
        const dx = ps.x - s.x, dz = ps.z - s.z;
        const ahead = dx * fx + dz * fz;
        const lat = Math.abs(-dx * fz + dz * fx);
        if (ahead > 0 && ahead < 11 && lat < 2.6) {
          go = 0;
          tv.honkT += dt;
          if (tv.honkT > 2.4) { G.AUDIO.blip(420); tv.honkT = -3; }
        } else tv.honkT = Math.max(0, tv.honkT - dt);
      }
      /* 红灯 */
      const nextNode = nearNode(tv);
      if (nextNode != null) {
        const sig = G.CITY.signalT % 20;
        const nsGreen = sig < 8, ewGreen = sig >= 10 && sig < 18;
        const isNS = !tv.horiz;
        const dNode = Math.abs(nextNode - tv.along);
        if (dNode < 10 && dNode > 5.6 && !(isNS ? nsGreen : ewGreen)) go = 0;
      }
      tv.cur = U.damp(tv.cur == null ? go : tv.cur, go, 3, dt);
      tv.along += tv.cur * dt * tv.dir;
      tv.turnCd = Math.max(0, (tv.turnCd || 0) - dt);
      /* 到达节点选向 */
      const rng2 = Math.random;
      if (tv.along > 224 + 6) { tv.along = 228; turnAt(tv); }
      else if (tv.along < -224 - 6) { tv.along = -228; turnAt(tv); }
      else if (tv.turnCd <= 0) {
        const nid = Math.round((tv.along - G.CITY.OFF) / 64);
        const npos = G.CITY.roadAt(U.clamp(nid, 0, 7));
        if (Math.abs(tv.along - npos) < 0.6 && rng2() < 0.45) turnAt(tv, nid);
      }
      const pos = trafficPos(tv);
      s.x = pos[0]; s.z = pos[1]; s.h = trafficHeading(tv);
      s.vx = fx * tv.cur * tv.dir; s.vz = fz * tv.cur * tv.dir;
      v.root.position.set(s.x, 0, s.z);
      v.root.rotation.y = s.h;
      for (const w of v.wheels) w.spin.rotation.x += tv.cur * dt / v.spec.wr;
      /* 灯 */
      const night = G.state ? G.state.night01 : 0;
      const lightsOn = night > 0.42;
      if (v.lightsOn !== lightsOn) v.setLights(lightsOn);
    }
  };
  function nearNode(tv) {
    const nid = Math.round((tv.along - G.CITY.OFF) / 64);
    if (nid < 0 || nid > 7) return null;
    return G.CITY.roadAt(nid);
  }
  function turnAt(tv, nid) {
    tv.turnCd = 4;
    const oldRoad = tv.road;
    if (nid == null) {
      /* 到达边界:调头 */
      tv.dir *= -1;
      return;
    }
    tv.road = U.clamp(nid, 0, 7);
    tv.horiz = !tv.horiz;
    tv.dir = Math.random() < 0.5 ? 1 : -1;
    tv.along = G.CITY.roadAt(oldRoad);
    /* 避免立刻越界 */
    if (tv.along >= 224 && tv.dir > 0) tv.dir = -1;
    if (tv.along <= -224 && tv.dir < 0) tv.dir = 1;
  }

  /* ================= 面板开关 ================= */
  GM.panels = { help: false, map: false };
  GM.togglePanel = function (which) {
    if (which === 'help') {
      GM.panels.help = !GM.panels.help;
      $('helpOverlay').style.display = GM.panels.help ? 'flex' : 'none';
      if (GM.panels.help) { GM.panels.map = false; $('bigmapOverlay').style.display = 'none'; }
    } else if (which === 'map') {
      GM.panels.map = !GM.panels.map;
      $('bigmapOverlay').style.display = GM.panels.map ? 'flex' : 'none';
      if (GM.panels.map) { GM.panels.help = false; $('helpOverlay').style.display = 'none'; GM.drawBigmap(); }
    } else {
      GM.panels.help = GM.panels.map = false;
      $('helpOverlay').style.display = 'none';
      $('bigmapOverlay').style.display = 'none';
      $('credits').style.display = 'none';
    }
    GM._pressedRMH = true;
  };

  /* ================= 每帧汇总 ================= */
  let mapT = 0;
  GM.update = function (dt) {
    GM.updateMissions(dt);
    GM.updateGps(dt);
    GM.updatePeds(dt);
    GM.updateTraffic(dt);
    GM.tutUpdate(dt);
    GM.updateHud(dt);
    mapT -= dt;
    if (mapT <= 0) { mapT = 0.12; GM.drawMinimap(); if (GM.panels.map) GM.drawBigmap(); }
    if (GM.vip && !GM.vipInCar && GM.vip.group.parent === GM.scene) GM.vip.update(dt, {});
    else if (GM.vip && GM.vipInCar) { GM.vip.mode = 'seat'; GM.vip.update(dt, {}); }
  };
})();
