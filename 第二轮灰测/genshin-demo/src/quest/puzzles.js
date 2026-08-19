// 解谜系统（模块 D）：7 类谜题，可复用多处。
// 契约：export class PuzzleSystem { constructor(ctx); update(dt); }
import * as THREE from 'three';
import {
  buildMonument, setMonumentLit, buildTorch, setTorchLit, buildPressurePlate,
  buildMemoryStone, setMemoryLit, buildWindField, buildSeelie, buildChest,
  mat, matClone, ELEMENT_COLORS, CHEST_REWARDS, CHEST_TIERS, groundY, InteractRegistrar,
} from './worldobjects.js';
import { height, findFlatSpot, REGIONS } from '../world/heightfield.js';

function vec3(x, y, z) { return new THREE.Vector3(x, y, z); }

// 通用：生成一个可开启的奖励宝箱（解谜成功后出现）
function makeRewardChest(ctx, pos, registrar) {
  const c = buildChest(ctx, 'exquisite');
  c.position.copy(pos);
  let opened = false;
  const lid = c.userData.lid;
  registrar.register({
    pos: pos.clone(), radius: 2.2, label: '打开宝箱', icon: 'chest', once: true,
    onInteract: () => {
      if (opened) return; opened = true;
      ctx.audio?.sfx?.('chest_open', { pos });
      ctx.fx3d?.burst?.(pos, 'geo', 1);
      ctx.events?.emit('chest:opened', { id: 'puzzle_reward', tier: 'exquisite' });
      ctx.ui?.toast?.('获得 ' + CHEST_REWARDS.exquisite, { icon: 'chest' });
      c.userData.open = 1;
    },
  });
  return c;
}

export class PuzzleSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group(); this.group.name = 'puzzles';
    ctx.scene.add(this.group);
    this.registrar = new InteractRegistrar(ctx);
    this.puzzles = [];
    this._rewardChests = [];
    this._listeners = [];
    const on = (n, f) => { const u = ctx.events?.on?.(n, f); if (u) this._listeners.push(u); };
    on('combat:hit', (p) => this._onHit(p));
    on('enemy:died', (p) => this._onEnemyDied(p));

    if (ctx.dev) this._buildDemo(); else this._buildWorld();
  }

  add(p) { this.puzzles.push(p); return p; }

  /** 测试/调试：程序化完成指定谜题。 */
  forceSolve(id) {
    const p = this.puzzles.find(x => x.id === id);
    if (p) { p.solve?.(); return true; }
    return false;
  }
  get(id) { return this.puzzles.find(x => x.id === id) ?? null; }

  // ---------- 基础谜题对象 ----------
  _base(id, type, center, element = 'geo') {
    const ctx = this.ctx;
    const p = {
      id, type, ctx, element, center: center.clone(), group: new THREE.Group(),
      solved: false, rewardPos: center.clone(),
      solve() {
        if (this.solved) return; this.solved = true;
        this.ctx.audio?.sfx?.('puzzle_solve', { pos: this.center });
        this.ctx.fx3d?.burst?.(this.center, this.element ?? 'geo', 1.5);
        this.ctx.events?.emit('puzzle:solved', { id: this.id });
        this.ctx.ui?.toast?.('解谜成功！');
        const c = makeRewardChest(this.ctx, this.rewardPos, this._registrar);
        this.group.add(c);
        this._chests.push(c);
      },
      _chests: this._rewardChests,
      _registrar: this.registrar,
    };
    this.group.add(p.group);
    return p;
  }

  // ---------- 1. 元素方碑 ----------
  _elemental(id, x, z, elements, order = false, timeLimit = 20) {
    const ctx = this.ctx;
    const p = this._base(id, 'elemental', vec3(x, groundY(ctx, x, z), z), elements[0]);
    p.elements = elements; p.order = order; p.timeLimit = timeLimit;
    p.lit = []; p.monuments = []; p.started = false; p.t = 0;
    const n = elements.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const mx = x + Math.cos(a) * 4, mz = z + Math.sin(a) * 4;
      const mon = buildMonument(ctx, elements[i]);
      mon.position.set(mx, groundY(ctx, mx, mz), mz);
      mon.userData.index = i;
      p.group.add(mon); p.monuments.push(mon);
    }
    p.reset = () => { p.lit = p.monuments.map(() => false); p.started = false; p.t = 0; for (const m of p.monuments) setMonumentLit(m, false); };
    p.update = (dt) => { if (p.solved || !p.started) return; p.t += dt; if (p.t > p.timeLimit) { ctx.ui?.toast?.('方碑熄灭了，再试一次'); p.reset(); } };
    p.reset();
    return p;
  }
  _elementalHit(p, ox, oy, oz, element) {
    if (p.solved) return;
    const litCount = p.lit.filter(Boolean).length;
    for (let i = 0; i < p.monuments.length; i++) {
      const m = p.monuments[i];
      if (Math.hypot(m.position.x - ox, m.position.z - oz) > 1.9) continue;
      if (p.lit[i]) return;
      const need = p.elements[i];
      const wrongElement = element && element !== 'physical' && element !== need;
      const wrongOrder = p.order && i !== litCount;
      if (wrongElement || wrongOrder) { ctx.ui?.toast?.('顺序不对，方碑重置了'); p.reset(); return; }
      p.lit[i] = true; setMonumentLit(m, true);
      if (!p.started) { p.started = true; p.t = 0; }
      ctx.audio?.sfx?.('skill_' + (need === 'pyro' ? 'pyro' : 'anemo'), { pos: m.position });
      if (p.lit.every(Boolean)) p.solve();
      return;
    }
  }

  // ---------- 2. 火种点燃（火盆） ----------
  _torch(id, x, z, count = 3) {
    const ctx = this.ctx;
    const p = this._base(id, 'torch', vec3(x, groundY(ctx, x, z), z), 'pyro');
    p.torches = [];
    for (let i = 0; i < count; i++) {
      const t = buildTorch(ctx);
      t.position.set(x + (i - (count - 1) / 2) * 2.2, groundY(ctx, x + (i - (count - 1) / 2) * 2.2, z), z);
      t.userData.index = i;
      p.group.add(t); p.torches.push(t);
    }
    p.update = () => {};
    return p;
  }
  _torchHit(p, ox, oy, oz, element) {
    if (p.solved || (element && element !== 'pyro' && element !== 'physical')) return;
    for (const t of p.torches) {
      if (t.userData.lit) continue;
      if (Math.hypot(t.position.x - ox, t.position.z - oz) < 1.7) {
        setTorchLit(t, true);
        this.ctx.fx3d?.burst?.(t.position, 'pyro', 0.8);
        if (p.torches.every(t2 => t2.userData.lit)) p.solve();
        return;
      }
    }
  }

  // ---------- 3. 风场（上升气流 → 高处宝箱） ----------
  _windfield(id, x, z, radius = 1.8, platformY = 8) {
    const ctx = this.ctx;
    const p = this._base(id, 'windfield', vec3(x, groundY(ctx, x, z), z), 'anemo');
    p.radius = radius; p.platformY = platformY;
    const wf = buildWindField(ctx, radius, 10);
    wf.position.set(x, groundY(ctx, x, z), z);
    p.group.add(wf);
    p.wf = wf;
    // 高处浮空平台 + 底座
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.5, 20), mat(ctx, '#8fa8a0', { rough: 0.9 }));
    plat.position.set(x, platformY, z); plat.castShadow = plat.receiveShadow = true;
    p.group.add(plat); p.platform = plat;
    p.rewardPos = vec3(x, platformY + 0.3, z);
    p.update = (dt) => {
      // 粒子
      const pa = wf.userData.points.geometry.attributes.position;
      for (let i = 0; i < wf.userData.arr.length; i++) { const pr = wf.userData.arr[i]; pr.y += pr.speed * dt; if (pr.y > 10) pr.y = 0; pa.array[i * 3 + 1] = pr.y; }
      pa.needsUpdate = true;
      const pp = ctx.player?.position;
      if (!pp || p.solved) return;
      if (Math.hypot(pp.x - x, pp.z - z) < radius && ctx.player?.velocity) ctx.player.velocity.y = Math.max(ctx.player.velocity.y ?? 0, 13.5);
      if (pp.y > platformY - 0.5 && Math.hypot(pp.x - x, pp.z - z) < 2.2) p.solve();
    };
    return p;
  }

  // ---------- 4. 仙灵引路 ----------
  _seelie(id, x, z, pathXY) {
    const ctx = this.ctx;
    const p = this._base(id, 'seelie', vec3(x, groundY(ctx, x, z), z), 'anemo');
    p.path = pathXY.map(([px, pz]) => vec3(px, groundY(ctx, px, pz), pz));
    p.targetIdx = 1; p.baseY = groundY(ctx, x, z);
    const s = buildSeelie(ctx);
    s.position.set(x, p.baseY + 1.2, z);
    p.group.add(s); p.seelie = s;
    // 最终底座
    const last = p.path[p.path.length - 1];
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.4, 14), mat(ctx, '#9a9fa8', { rough: 0.7 }));
    ped.position.set(last.x, last.y + 0.2, last.z); ped.receiveShadow = true;
    p.group.add(ped); p.pedestal = ped;
    p.rewardPos = vec3(last.x, last.y + 0.4, last.z);
    p.update = (dt) => {
      if (p.solved) return;
      const t = ctx.time?.elapsed ?? 0;
      const target = p.path[p.targetIdx];
      const d = Math.hypot(target.x - s.position.x, target.z - s.position.z);
      if (d > 0.15) { s.position.x += (target.x - s.position.x) / d * 2.4 * dt; s.position.z += (target.z - s.position.z) / d * 2.4 * dt; }
      s.position.y = p.baseY + 1.2 + Math.sin(t * 3) * 0.25;
      const pp = ctx.player?.position;
      if (pp && Math.hypot(pp.x - target.x, pp.z - target.z) < 3.0) {
        if (p.targetIdx < p.path.length - 1) p.targetIdx++;
        else p.solve();
      }
    };
    return p;
  }

  // ---------- 5. 岩石阵 / 压力板（推石块） ----------
  _pressure(id, x, z) {
    const ctx = this.ctx;
    const p = this._base(id, 'pressure', vec3(x, groundY(ctx, x, z), z), 'geo');
    p.plates = []; p.rocks = [];
    const pts = [[0, 0], [4.5, 0], [2.2, 4]];
    for (const [dx, dz] of pts) {
      const plate = buildPressurePlate(ctx);
      plate.position.set(x + dx, groundY(ctx, x + dx, z + dz), z + dz);
      p.group.add(plate); p.plates.push(plate);
    }
    const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
    const rockMat = mat(ctx, '#8d9299', { rough: 0.9 });
    const rockPos = [[1.5, -2.5], [6.5, -2.0], [4.5, 3.0]];
    for (const [dx, dz] of rockPos) {
      const r = new THREE.Mesh(rockGeo, rockMat);
      const pos = { x: x + dx, y: groundY(ctx, x + dx, z + dz) + 0.55, z: z + dz };
      r.position.set(pos.x, pos.y, pos.z); r.castShadow = r.receiveShadow = true;
      p.group.add(r);
      p.rocks.push({ pos, mesh: r });
    }
    p.update = (dt) => {
      if (p.solved) return;
      const pp = ctx.player?.position;
      const vel = ctx.player?.velocity;
      for (const r of p.rocks) {
        if (pp) {
          const dx = pp.x - r.pos.x, dz = pp.z - r.pos.z, d = Math.hypot(dx, dz);
          if (d < 1.0 && d > 0.001) {
            const moving = Math.abs(vel?.x ?? 0) + Math.abs(vel?.z ?? 0);
            const k = moving > 0.3 ? 2.4 : 0.4;
            r.pos.x += (dx / d) * k * dt; r.pos.z += (dz / d) * k * dt;
            r.mesh.position.set(r.pos.x, r.pos.y, r.pos.z);
          }
        }
      }
      let all = true;
      for (const pl of p.plates) {
        const pressed = this._platePressed(pl, pp, p.rocks);
        if (pressed !== pl.userData.pressed) { pl.userData.pressed = pressed; pl.userData.glow.material.emissiveIntensity = pressed ? 1.8 : 0.3; }
        if (!pressed) all = false;
      }
      if (all) p.solve();
    };
    return p;
  }
  _platePressed(pl, pp, rocks) {
    if (pp && Math.hypot(pp.x - pl.position.x, pp.z - pl.position.z) < 0.75) return true;
    for (const r of rocks) if (Math.hypot(r.pos.x - pl.position.x, r.pos.z - pl.position.z) < 0.75) return true;
    return false;
  }

  // ---------- 6. 时限挑战 ----------
  _timed(id, x, z, duration = 60, need = 6) {
    const ctx = this.ctx;
    const p = this._base(id, 'timed', vec3(x, groundY(ctx, x, z), z), 'pyro');
    p.duration = duration; p.need = need; p.state = 'idle'; p.time = 0; p.kills = 0; p.radius = 7;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(p.radius, 0.12, 8, 40), matClone(ctx, '#ff7a55', { emissive: '#ff7a55', emissiveIntensity: 1.2 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, groundY(ctx, x, z) + 0.15, z);
    p.group.add(ring); p.ring = ring;
    p.update = (dt) => {
      const pp = ctx.player?.position;
      if (!pp) return;
      const near = Math.hypot(pp.x - x, pp.z - z) < p.radius;
      if (p.state === 'idle' && near) {
        p.state = 'active'; p.time = p.duration; p.kills = 0;
        ctx.enemies?.spawnCamp?.('hilichurl', { x, y: groundY(ctx, x, z), z }, p.need, 9);
        ctx.ui?.subtitle?.('限时挑战：' + p.need + ' 秒内击败 ' + p.need + ' 只怪！', 4000);
        ctx.audio?.sfx?.('enemy_alert');
      } else if (p.state === 'active') {
        p.time -= dt;
        if (p.kills >= p.need) p.solve();
        else if (p.time <= 0) { p.state = 'idle'; ctx.ui?.toast?.('挑战失败，稍后再试'); }
      }
    };
    return p;
  }

  // ---------- 7. 顺序记忆 ----------
  _memory(id, x, z, count = 4) {
    const ctx = this.ctx;
    const p = this._base(id, 'memory', vec3(x, groundY(ctx, x, z), z), 'electro');
    p.stones = []; p.count = count;
    const colors = ['#c88bfa', '#4fc3f7', '#9adb4a', '#f0b93c'];
    // 洗牌序列
    p.seq = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p.seq[i], p.seq[j]] = [p.seq[j], p.seq[i]]; }
    for (let i = 0; i < count; i++) {
      const stone = buildMemoryStone(ctx, colors[i]);
      stone.position.set(x + (i - (count - 1) / 2) * 2.0, groundY(ctx, x + (i - (count - 1) / 2) * 2.0, z), z);
      stone.userData.index = i;
      p.group.add(stone); p.stones.push(stone);
      const sp = stone.position.clone();
      p._registrar.register({ pos: sp, radius: 1.8, label: '点亮记忆石', icon: 'puzzle', once: false, onInteract: () => p.press(i) });
    }
    p.phase = 'show'; p.showStep = 0; p.showT = 0; p.inputIdx = 0;
    setMemoryLit(p.stones[p.seq[0]], true, colors[p.seq[0]]);
    p.press = (i) => {
      if (p.solved || p.phase !== 'input') return;
      if (i === p.seq[p.inputIdx]) {
        ctx.audio?.sfx?.('ui_confirm');
        p.inputIdx++;
        setMemoryLit(p.stones[i], true, colors[i]);
        if (p.inputIdx >= p.count) p.solve();
      } else {
        ctx.audio?.sfx?.('ui_cancel');
        ctx.ui?.toast?.('顺序错误，重新开始');
        for (const st of p.stones) setMemoryLit(st, false, colors[st.userData.index]);
        p.phase = 'show'; p.showStep = 0; p.showT = 0; p.inputIdx = 0;
        setMemoryLit(p.stones[p.seq[0]], true, colors[p.seq[0]]);
      }
    };
    p.update = (dt) => {
      if (p.solved || p.phase !== 'show') return;
      p.showT += dt;
      if (p.showT >= 0.7) {
        setMemoryLit(p.stones[p.seq[p.showStep]], false, colors[p.seq[p.showStep]]);
        p.showStep++; p.showT = 0;
        if (p.showStep >= p.count) { p.phase = 'input'; p.inputIdx = 0; ctx.ui?.subtitle?.('按顺序点击发光石！', 3000); }
        else setMemoryLit(p.stones[p.seq[p.showStep]], true, colors[p.seq[p.showStep]]);
      }
    };
    return p;
  }

  // ---------- 事件路由 ----------
  _onHit(payload) {
    const info = payload?.info; const o = info?.origin;
    if (!o) return;
    const ox = o.x ?? o[0] ?? 0, oy = o.y ?? o[1] ?? 0, oz = o.z ?? o[2] ?? 0;
    for (const p of this.puzzles) {
      if (p.solved) continue;
      if (p.type === 'elemental') this._elementalHit(p, ox, oy, oz, info.element);
      else if (p.type === 'torch') this._torchHit(p, ox, oy, oz, info.element);
    }
  }
  _onEnemyDied(payload) {
    for (const p of this.puzzles) {
      if (p.type === 'timed' && p.state === 'active') p.kills++;
    }
  }

  // ---------- 世界布局 ----------
  _buildWorld() {
    this.add(this._elemental('ruins_monument', -1080, -420, ['anemo', 'pyro', 'cryo'], true, 20));
    this.add(this._torch('snow_torch', -260, -1080, 3));
    this.add(this._elemental('snow_monument', -340, -1030, ['pyro', 'pyro', 'pyro'], false, 20));
    this.add(this._windfield('windrise_glide', -230, 210, 1.8, 8));
    this.add(this._seelie('windrise_seelie', -160, 250, [[-160, 250], [-190, 270], [-210, 250], [-230, 230], [-210, 210]]));
    this.add(this._pressure('stonegate_plates', 980, -420));
    this.add(this._timed('stonegate_trial', 920, -360, 60, 6));
    this.add(this._memory('ruins_memory', -1140, -380, 4));
  }

  _buildDemo() {
    this.add(this._elemental('demo_elemental', -6, -4, ['anemo', 'pyro', 'cryo', 'electro'], true, 20));
    this.add(this._torch('demo_torch', 1, -4, 3));
    this.add(this._pressure('demo_pressure', 6, -4));
    this.add(this._memory('demo_memory', -7, 2, 4));
    this.add(this._windfield('demo_windfield', 8, 2, 1.6, 7));
    this.add(this._seelie('demo_seelie', -1, 6, [[-1, 6], [1, 7], [3, 6], [5, 7], [7, 6]]));
    this.add(this._timed('demo_timed', -4, 6, 60, 6));
  }

  // ---------- 每帧 ----------
  update(dt) {
    const ctx = this.ctx, t = ctx.time?.elapsed ?? 0;
    this.registrar.flush();
    for (const p of this.puzzles) { try { p.update?.(dt); } catch (e) { console.log('[puzzle]', p.id, e); } }
    // 奖励宝箱开盖动画
    for (const c of this._rewardChests) {
      if (c.userData.open) c.userData.lid.rotation.x = Math.max(-Math.PI * 0.72, c.userData.lid.rotation.x - 2.4 * dt);
      else c.userData.lid.rotation.x = 0;
      c.position.y = (c.rewardY ?? c.position.y) + Math.sin(t * 1.6) * 0.03;
      if (c.rewardY == null) c.rewardY = c.position.y;
    }
  }

  dispose() {
    for (const un of this._listeners) try { un(); } catch {}
    this.registrar.clear();
    this.ctx.scene.remove(this.group);
  }
}
