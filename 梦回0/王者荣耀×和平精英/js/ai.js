/* ================================================================
   荣耀精英 — 英雄 AI（分路 / 推线 / 追击 / 撤退 / 打野 / 抢空投）
   ================================================================ */
HE.AI = (function () {
  const G = () => HE.Game.G;

  function lanePath(lane, team) {
    const pts = HE.LANES[lane].map(p => team === 'blue' ? p : { x: -p.x, z: -p.z });
    return pts;
  }
  function nearestWpIdx(pts, x, z) {
    let bi = 0, bd = 1e9;
    pts.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; bi = i; }
    });
    return bi;
  }

  class HeroAI {
    constructor(hero, lane) {
      this.hero = hero;
      hero.ai = this;
      this.lane = lane === 'jungle' ? 'mid' : lane;
      this.isJungler = lane === 'jungle';
      this.decideT = Math.random() * 0.3;
      this.state = this.isJungler ? 'jungle' : 'lane';
      this.moveTo = null;
      this.atkTarget = null;
      this.recallTried = false;
      this.holdT = 0;
    }
    base() { return this.hero.team === 'blue' ? HE.CFG.BLUE_BASE : HE.CFG.RED_BASE; }

    update(dt) {
      const h = this.hero;
      if (!h.alive || h.dropping > 0 || h.stunT > 0) return;
      this.decideT -= dt;
      if (this.decideT <= 0) { this.decideT = 0.28; this.decide(); }
      this.act(dt);
    }

    /* ---------- 决策 ---------- */
    decide() {
      const h = this.hero, Gm = G();
      this.buyNext();

      // 信号圈优先：圈外进圈；决赛圈内向敌方一侧压进，强制团战
      const zone = Gm.zone;
      if (zone && zone.active) {
        const d = Math.hypot(h.x - zone.x, h.z - zone.z);
        if (d > zone.r - 3) {
          this.state = 'zone';
          const k = Math.max(0, zone.r - 8) / Math.max(d, 0.01);
          this.moveTo = { x: zone.x + (h.x - zone.x) * k, z: zone.z + (h.z - zone.z) * k };
          this.atkTarget = this.pickTarget(10);
          return;
        }
        if (zone.r <= HE.CFG.ZONE_MIN_R + 8) {
          // 决赛圈：不再蹲塔，全员向圈内敌方一侧集结
          this.state = 'final';
          const ob = this.base();
          const eb = h.team === 'blue' ? HE.CFG.RED_BASE : HE.CFG.BLUE_BASE;
          const toward = (b, dist) => {
            const dx = b.x - zone.x, dz = b.z - zone.z, dd = Math.hypot(dx, dz) || 1;
            return { x: zone.x + dx / dd * dist, z: zone.z + dz / dd * dist };
          };
          if (h.hp / h.maxHp < 0.32) {
            // 残血：退到圈内己方一侧喘口气，不出圈
            if (h.healCd <= 0) h.castHeal();
            this.moveTo = toward(ob, zone.r - 9);
            this.atkTarget = null;
            return;
          }
          this.moveTo = toward(eb, Math.max(4, zone.r - 14));
          this.atkTarget = this.pickTarget(17);
          this.useSkills();
          return;
        }
      }

      // 撤退判定
      const hpRatio = h.hp / h.maxHp;
      const nearEnemyHero = h.nearestEnemyHero(16);
      if (this.state === 'retreat') {
        if (hpRatio > 0.85 || (hpRatio > 0.55 && !nearEnemyHero)) { this.state = this.isJungler ? 'jungle' : 'lane'; this.recallTried = false; }
      } else if (hpRatio < 0.26) {
        this.state = 'retreat';
        if (h.healCd <= 0) h.castHeal();
      }
      if (this.state === 'retreat') {
        this.moveTo = this.base();
        this.atkTarget = null;
        if (hpRatio < 0.15 && nearEnemyHero && h.distTo(nearEnemyHero) < 9 && h.flashCd <= 0) {
          const b = this.base();
          h.castFlash(new THREE.Vector3(b.x - h.x, 0, b.z - h.z));
        }
        if (!this.recallTried && !nearEnemyHero && Math.hypot(h.x - this.base().x, h.z - this.base().z) > 40) {
          h.startRecall(); this.recallTried = true;
        }
        return;
      }

      // 拾取空投（和平精英本能）
      const crate = Gm.units.find(u => u.kind === 'airdrop' && u.alive && u.landed);
      if (crate && h.distTo(crate) < 30 && hpRatio > 0.5) {
        this.state = 'loot';
        this.moveTo = { x: crate.x, z: crate.z };
        this.atkTarget = this.pickTarget(8);
        return;
      }

      // 打野逻辑
      if (this.isJungler && this.state !== 'gank') {
        const myCamps = HE.JUNGLE.filter(c =>
          (h.team === 'blue' ? c.id.startsWith('blue') : c.id.startsWith('red')));
        let camp = null;
        for (const c of myCamps) {
          const m = Gm.monsters[c.id];
          if (m && m.alive) { camp = m; break; }
        }
        // 6级后先看暴君
        if (h.level >= 6 && hpRatio > 0.7) {
          const ty = Gm.monsters['tyrant'];
          if (ty && ty.alive && ty.hp / ty.maxHp > 0.2) camp = ty;
        }
        if (camp) {
          this.state = 'jungle';
          this.moveTo = { x: camp.x, z: camp.z };
          const near = this.pickTarget(11);
          this.atkTarget = near && near.isHero ? near : (h.distTo(camp) < 12 ? camp : near);
          this.useSkills();
          return;
        }
        this.state = 'gank'; // 野区清空 → 支援
      }

      // 对线 / 支援
      this.state = this.isJungler ? 'gank' : 'lane';
      const lane = Gm.time > HE.CFG.ZONE_START - 60 ? 'mid' : this.lane;
      const pts = lanePath(lane, h.team);

      // 前线：己方最前排小兵
      let frontIdx = 1, front = null;
      for (const u of Gm.units) {
        if (u.kind !== 'minion' || u.team !== h.team || !u.alive) continue;
        if (u.lane !== lane) continue;
        const idx = nearestWpIdx(pts, u.x, u.z);
        if (idx >= frontIdx) { frontIdx = idx; front = u; }
      }
      let hold;
      if (front) hold = { x: front.x, z: front.z };
      else {
        // 无兵线时：站到己方最前哨塔的塔前（朝敌方向前压 7），而不是缩在塔里
        const eb = h.team === 'blue' ? HE.CFG.RED_BASE : HE.CFG.BLUE_BASE;
        const myTower = Gm.units.find(u => u.kind === 'tower' && u.team === h.team && u.alive && u.lane === lane)
          || Gm.units.find(u => u.kind === 'tower' && u.team === h.team && u.alive && u.lane === 'base');
        if (myTower) {
          const dx = eb.x - myTower.x, dz = eb.z - myTower.z, dd = Math.hypot(dx, dz) || 1;
          hold = { x: myTower.x + dx / dd * 7, z: myTower.z + dz / dd * 7 };
        } else hold = pts[Math.floor(pts.length / 2)];
      }
      this.moveTo = hold;
      this.atkTarget = this.pickTarget(13);

      // 防御塔威慑：没有兵线掩护不越塔
      if (this.atkTarget && this.atkTarget.isHero) {
        const enemyTower = Gm.units.find(u =>
          u.kind === 'tower' && u.team !== h.team && u.alive && u.distTo(this.atkTarget) < 15);
        if (enemyTower) {
          const cover = Gm.units.some(u => u.kind === 'minion' && u.team === h.team && u.alive && enemyTower.distTo(u) < 12);
          if (!cover) { this.atkTarget = null; this.moveTo = hold; }
        }
      }
      this.useSkills();
    }

    pickTarget(r) {
      const h = this.hero, Gm = G();
      let best = null, bs = -1e9;
      for (const u of Gm.units) {
        if (!u.alive || u.untargetable || u.team === h.team || u.team === 'neutral') continue;
        const d = h.distTo(u);
        if (d > r + (u.isBuilding ? u.radius : 0)) continue;
        let s = -d;
        if (u.isHero) s += 8 + (1 - u.hp / u.maxHp) * 10;
        else if (u.kind === 'crystal') s += 6;
        else if (u.kind === 'tower') s += 2;
        if (s > bs) { bs = s; best = u; }
      }
      return best;
    }

    /* ---------- 技能释放 ---------- */
    useSkills() {
      const h = this.hero, id = h.heroDef.id, Gm = G();
      const t = this.atkTarget;
      const tHero = t && t.isHero ? t : h.nearestEnemyHero(14);
      const dist = t ? h.distTo(t) : 1e9;
      const cast = i => h.castSkill(i);
      if (id === 'thunder') {
        if (tHero && h.distTo(tHero) < 14 && h.distTo(tHero) > 4) { h.faceTo(tHero.x, tHero.z); cast(0); }
        if (tHero && h.distTo(tHero) < 11) cast(2);
        if (h.hp / h.maxHp < 0.6 && tHero && h.distTo(tHero) < 7) cast(1);
      } else if (id === 'wolf') {
        if (t && dist < h.range) { cast(0); if (Math.random() < 0.5) cast(1); }
        if (tHero && tHero.hp / tHero.maxHp < 0.55 && h.distTo(tHero) < 17) cast(2);
      } else if (id === 'viper') {
        if (tHero && h.distTo(tHero) < 15 && h.distTo(tHero) > 3 && h.hp / h.maxHp > 0.45) cast(0);
        if (t && dist < h.range + 1) cast(1);
        if (tHero && tHero.hp / tHero.maxHp < 0.45 && h.distTo(tHero) < 9) cast(2);
      } else if (id === 'boom') {
        if (t && dist < 13) { h.faceTo(t.x, t.z); cast(0); }
        if (t && dist < 13 && h.skills[0].cd > 0) cast(1);
        if (tHero && h.distTo(tHero) < 19 && tHero.hp / tHero.maxHp < 0.75) cast(2);
      } else if (id === 'medic') {
        const lowAlly = Gm.heroes.some(a => a.team === h.team && a.alive && h.distTo(a) < 14 && a.hp / a.maxHp < 0.7);
        if (lowAlly) cast(0);
        if ((tHero && h.distTo(tHero) < 9) || Gm.heroes.some(a => a.team === h.team && a.alive && h.distTo(a) < 8 && a.hp / a.maxHp < 0.5)) cast(1);
        const lowCount = Gm.heroes.filter(a => a.team === h.team && a.alive && h.distTo(a) < 16 && a.hp / a.maxHp < 0.6).length;
        if (lowCount >= 2 || h.hp / h.maxHp < 0.4) cast(2);
      }
    }

    /* ---------- 装备购买 ---------- */
    buyNext() {
      const h = this.hero;
      const build = h.heroDef.build;
      if (h.items.length >= build.length) return;
      const next = HE.ITEMS.find(i => i.id === build[h.items.length]);
      if (next && h.gold >= next.price) h.buyItem(next);
    }

    /* ---------- 执行 ---------- */
    act(dt) {
      const h = this.hero;
      const t = this.atkTarget;
      if (t && t.alive) {
        const reach = h.range + (t.isBuilding ? t.radius : 0);
        const d = h.distTo(t);
        if (d <= reach) {
          // 射手保持距离拉扯
          if (!t.isBuilding && d < reach * 0.45 && h.range > 9) {
            const away = new THREE.Vector3(h.x - t.x, 0, h.z - t.z).normalize();
            h.moveToward(h.x + away.x * 4, h.z + away.z * 4, dt);
          }
          h.tryBasicAttack(t, dt);
        } else {
          this.steer(t.x, t.z, dt);
        }
        return;
      }
      if (this.moveTo) {
        const d = Math.hypot(this.moveTo.x - h.x, this.moveTo.z - h.z);
        if (d > 2.5) this.steer(this.moveTo.x, this.moveTo.z, dt);
      }
    }
    // 沿兵线路径行军，避免横穿野区
    steer(tx, tz, dt) {
      const h = this.hero;
      if (this.state !== 'lane' && this.state !== 'gank') { h.moveToward(tx, tz, dt); return; }
      const lane = G().time > HE.CFG.ZONE_START - 60 ? 'mid' : this.lane;
      const pts = lanePath(lane, h.team);
      const iMe = nearestWpIdx(pts, h.x, h.z);
      const iTgt = nearestWpIdx(pts, tx, tz);
      const meWp = pts[iMe];
      const offLane = Math.hypot(meWp.x - h.x, meWp.z - h.z) > 14;
      if (offLane || iMe === iTgt) { h.moveToward(tx, tz, dt); return; }
      const next = pts[iMe + (iTgt > iMe ? 1 : -1)];
      h.moveToward(next.x, next.z, dt);
    }
  }

  return { HeroAI };
})();
