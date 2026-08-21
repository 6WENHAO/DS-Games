/* ============ 生物：属性 / AI / 战斗 / 状态 / 卡位自救 ============ */
(function (D) {
  "use strict";
  var U = D.util;
  var nextId = 1;

  function Creature(spKey, x, y, opts) {
    opts = opts || {};
    this.id = nextId++;
    this.sp = spKey;
    this.def = D.SPECIES[spKey] || D.SPECIES.compy;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
    this.face = opts.face != null ? opts.face : Math.random() * U.TAU;
    this.dirWanted = this.face;
    this.throttle = 0;
    this.level = opts.level || 1;
    this.exp = opts.exp || 0;
    this.isPlayer = !!opts.player;
    this.ally = !!opts.ally;
    this.sizeJit = opts.player ? 1 : 0.9 + Math.random() * 0.2;
    this.hunger = opts.hunger != null ? opts.hunger : 60 + Math.random() * 30;
    this.thirst = opts.thirst != null ? opts.thirst : 60 + Math.random() * 30;
    this.stamina = 100;
    this.relics = opts.relics || null;
    this.mana = 100; this.manaMax = 100;
    this.scale = 1; this.maxHp = 10; this.dmg = 1; this.speed = 100; this.stage = 0;
    this.fireproof = !!this.def.fireproof;
    this.applyLevel(false);
    if (opts.hp != null) this.hp = Math.min(this.maxHp, opts.hp);
    this.state = "wander";
    this.thinkT = Math.random() * 0.25;
    this.target = null; this.plant = null; this.fleeFrom = null; this.grudge = 0;
    this.wx = x; this.wy = y; this.wanderT = 0;
    this.homeX = x; this.homeY = y;
    this.herdX = null; this.herdY = null;
    this.village = null;
    this.attackCd = 0; this.atkAnim = 0; this.hurtT = 0; this.roarT = 0;
    this.rangedCd = 0.6 + Math.random(); this.magicCd = 2 + Math.random() * 3;
    this.breathCd = 0; this.breathT = 0; this.breathKind = null; this.breathPts = null; this.breathAng = 0;
    this.blinkCd = 2 + Math.random() * 3;
    this.burn = 0; this.burnDmg = 0; this.burnAcc = 0;
    this.chill = 0; this.stun = 0; this.shield = 0; this.bless = null;
    this.dead = false; this.meat = 0; this.decay = 0; this.remove = false;
    this.phase = Math.random() * 10; this.speedNow = 0;
    this.sprinting = false; this.fleeT = 0; this.scaredT = 0; this.alertT = 0;
    this.waterMemo = null; this.waterMemoT = 0;
    this.eatT = 0; this.stepAcc = 0; this.age = 0;
    this.stuckT = 0; this.ignoreId = 0; this.ignoreT = 0;
    this.untargetable = false;
    this.trailT = 0;
  }

  var P = Creature.prototype;

  Object.defineProperty(P, "radius", { get: function () { return this.def.size * this.scale; } });
  Object.defineProperty(P, "power", {
    get: function () {
      return this.dmg * (0.7 + this.scale * 0.6) * (this.def.diet === "herb" ? 0.82 : 1.15);
    }
  });

  P.brave = function () {
    return this.def.brave * (0.7 + 0.5 * (this.hp / this.maxHp)) * (this.ally ? 2.2 : 1);
  };

  P.applyLevel = function (keep) {
    var d = this.def, oldMax = this.maxHp;
    this.stage = D.stageOf(this.level);
    this.scale = D.stageScale(this.level) * this.sizeJit;
    this.maxHp = Math.round(d.hp * (0.42 + 0.64 * this.scale) * (1 + (this.level - 1) * 0.05));
    this.dmg = d.dmg * (0.42 + 0.62 * this.scale) * (1 + (this.level - 1) * 0.045);
    this.speed = d.speed * (0.86 + 0.14 * this.scale);
    if (D.Magic && D.Magic.applyRelicStats) D.Magic.applyRelicStats(this);
    if (keep) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    else this.hp = this.maxHp;
    if (this.mana > this.manaMax) this.mana = this.manaMax;
  };

  P.reach = function (o) {
    return this.radius * 0.82 + o.radius * 0.82 + this.def.reach * this.scale * 0.95;
  };

  P.faction = function () {
    if (this.isPlayer || this.ally) return "p";
    var k = this.def.kind;
    if (k === "human" || k === "struct") return "h";
    return "w" + this.sp;
  };

  P.judge = function (o) {
    if (o.dead || o.remove) return "none";
    if (o.def.ignoreAI) return "none";
    if (o.isPlayer && o.untargetable) return "none";
    if (this.faction() === o.faction()) return "none";
    if (this.def.hunter) {
      // 人类猎手：成群围猎一切恐龙，重伤或对上龙王才退
      if (this.hp < this.maxHp * 0.3) return "threat";
      if (o.def.boss && this.hp < this.maxHp * 0.75) return "threat";
      return "prey";
    }
    if (this.grudge === o.id) {
      return (o.power > this.power * Math.max(0.7, this.brave())) ? "threat" : "prey";
    }
    if (o.power > this.power * 1.12 && o.def.diet !== "herb") return "threat";
    if (this.def.diet !== "herb" && o.power < this.power * 0.92) return "prey";
    return "none";
  };

  P.gainExp = function (n, game) {
    if (this.dead) return;
    this.exp += n;
    var need = D.expNeed(this.level);
    while (this.exp >= need && this.level < 20) {
      this.exp -= need;
      this.level++;
      this.applyLevel(true);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
      if (this.isPlayer && game) game.onLevelUp();
      need = D.expNeed(this.level);
    }
  };

  P.tryAttack = function (game, target) {
    if (this.attackCd > 0 || this.dead || this.stun > 0) return false;
    this.attackCd = this.def.atkRate * (this.isPlayer ? 0.92 : 1);
    this.atkAnim = 0.3;
    game.onAttack(this, target);
    return true;
  };

  P.damage = function (amount, from, game, silent) {
    if (this.dead || amount <= 0) return;
    if (this.isPlayer && game && game.playerDamageMul) amount *= game.playerDamageMul();
    if (this.shield > 0) {
      var absorb = Math.min(this.shield, amount);
      this.shield -= absorb;
      amount -= absorb;
      if (game) game.fx.spray(this.x, this.y - this.radius * 0.5, 3, { col: "#9fe8ff", r: 3, sp: 60, life: 0.3 });
      if (amount <= 0) return;
    }
    this.hp -= amount;
    this.hurtT = 0.3;
    if (from && from !== this) {
      this.grudge = from.id;
      var a = Math.atan2(this.y - from.y, this.x - from.x);
      var kb = (90 + Math.min(220, amount * 5)) / Math.max(0.7, this.scale);
      if (this.def["static"]) kb = 0;
      this.kx += Math.cos(a) * kb;
      this.ky += Math.sin(a) * kb;
      if (this.def.diet === "herb" || this.power < from.power * 0.9) this.scaredT = 3.2;
      this.thinkT = 0;
    }
    if (game) {
      if (this.def["static"]) {
        game.fx.spray(this.x, this.y - this.radius * 0.6, 6, { col: "#b08a52", r: 3, sp: 90, up: 40, life: 0.5 });
      } else if (!silent) {
        game.fx.blood(this.x, this.y - this.radius * 0.5, this.radius, 6 + Math.min(10, amount * 0.3));
      }
      if (this.isPlayer) {
        game.shake(Math.min(14, 3 + amount * 0.3));
        game.vibrate(30);
        D.Audio.hurt();
      } else if (game.near(this, 760) && !silent) {
        D.Audio.hurt();
      }
      if (this.def.thorns && from && !from.dead && U.dist(this.x, this.y, from.x, from.y) < this.reach(from) * 1.3) {
        from.damage(this.def.thorns * this.scale, null, game);
      }
    }
    if (this.hp <= 0) this.die(from, game);
  };

  P.die = function (from, game) {
    if (this.dead) return;
    this.dead = true;
    this.hp = 0;
    this.state = "dead";
    this.decay = this.def["static"] ? 1.5 : 100;
    this.throttle = 0;
    this.vx = 0; this.vy = 0;
    this.burn = 0; this.chill = 0; this.stun = 0;
    this.meat = this.def["static"] ? 0 : Math.round(34 + this.maxHp * 0.5);
    if (game) {
      if (!this.def["static"]) game.fx.blood(this.x, this.y, this.radius * 1.4, 18);
      if (game.near(this, 900)) D.Audio.die();
      game.onDeath(this, from);
    }
  };

  P.moveDir = function (ang, throttle) {
    this.dirWanted = ang;
    this.throttle = throttle;
  };

  P.moveTo = function (tx, ty, throttle) {
    this.moveDir(Math.atan2(ty - this.y, tx - this.x), throttle);
  };

  /* ---------- 卡位自救：位置非法时就近滑出（修「墙角被卡住」） ---------- */
  P.unstick = function (game) {
    var w = game.world, r = this.radius * 0.78;
    if (w.canWalk(this.x, this.y, r)) return false;
    for (var step = 1; step <= 6; step++) {
      var d = step * Math.max(10, this.radius * 0.55);
      for (var i = 0; i < 12; i++) {
        var a = this.face + (i / 12) * U.TAU;
        var nx = this.x + Math.cos(a) * d, ny = this.y + Math.sin(a) * d;
        if (w.canWalk(nx, ny, r)) {
          var mv = Math.min(d, 26);   // 小步滑出，避免瞬移
          this.x += Math.cos(a) * mv;
          this.y += Math.sin(a) * mv;
          this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
          return true;
        }
      }
    }
    var lp = w.findLand(this.x, this.y, r);
    this.x = lp.x; this.y = lp.y;
    this.vx = 0; this.vy = 0; this.kx = 0; this.ky = 0;
    return true;
  };

  /* ---------- 目标不可达时放弃，避免顶着墙推一辈子 ---------- */
  P.giveUp = function (game) {
    if (this.target && this.target.dead) { this.ignoreId = this.target.id; this.ignoreT = 10; }
    if (this.plant) this.ignoreId = -1;
    this.target = null;
    this.plant = null;
    this.waterMemo = null;
    this.state = "wander";
    this.wanderT = 0;
    var a = this.face + Math.PI * (0.6 + Math.random() * 0.8);
    var pt = game.world.findLand(this.x + Math.cos(a) * 220, this.y + Math.sin(a) * 220, this.radius);
    this.wx = pt.x; this.wy = pt.y;
    this.wanderT = 3;
  };

  /* ---------------- AI 决策（低频） ---------------- */
  P.think = function (game) {
    if (this.isPlayer || this.dead || this.def["static"]) return;
    var d = this.def;
    var fog = game.fogFactor || 0;
    var nightBoost = (game.night > 0.5 && d.diet === "carn") ? 1.22 : 1;
    var aggroR = d.aggro * (1 - fog * 0.35) * nightBoost * (game.predBuff || 1);
    var list = game.neighbors(this.x, this.y, Math.max(aggroR, 520));

    var threat = null, threatD = 1e9, prey = null, preyScore = 1e9, preyD = 1e9;
    var carrion = null, carrionD = 1e9;
    var hx = 0, hy = 0, hn = 0;

    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o === this || o.remove) continue;
      var dd = U.dist(this.x, this.y, o.x, o.y);
      if (o.dead) {
        if (d.diet !== "herb" && !d.hunter && o.meat > 2 && o.id !== this.ignoreId && dd < 560 && dd < carrionD) {
          carrion = o; carrionD = dd;
        }
        continue;
      }
      if (o.sp === this.sp && !o.isPlayer && !o.ally && !this.ally && dd < 340) { hx += o.x; hy += o.y; hn++; }
      if (dd > aggroR) continue;
      var j = this.judge(o);
      if (j === "threat") {
        if (dd < threatD) { threat = o; threatD = dd; }
      } else if (j === "prey") {
        var sc = dd + (o.isPlayer ? -70 : 0) + (o.hp < o.maxHp * 0.5 ? -90 : 0) + (o.def.thorns ? 160 : 0);
        if (sc < preyScore) { preyScore = sc; prey = o; preyD = dd; }
      }
    }

    this.herdX = hn > 0 ? hx / hn : null;
    this.herdY = hn > 0 ? hy / hn : null;

    var hungry = this.hunger < 74;
    var thirsty = this.thirst < 46 && d.thirsty > 0;

    if (this.ally) {
      if (threat && threatD < 420) { this.state = "fight"; this.target = threat; }
      else if (game.playerTarget && !game.playerTarget.dead && !game.playerTarget.remove &&
               U.dist(this.x, this.y, game.playerTarget.x, game.playerTarget.y) < 460) {
        this.state = "fight"; this.target = game.playerTarget;
      } else this.state = "follow";
      return;
    }

    if (threat && threatD < aggroR) {
      var fight = this.brave() * this.power > threat.power * 1.05;
      if (this.scaredT > 0 && this.hp < this.maxHp * 0.55) fight = false;
      if (d.diet === "herb" && d.brave < 0.9) fight = false;
      if (fight) { this.state = "fight"; this.target = threat; }
      else { this.state = "flee"; this.fleeFrom = threat; this.fleeT = Math.max(this.fleeT, 2.6); }
      return;
    }
    if (this.fleeT > 0 && this.fleeFrom) { this.state = "flee"; return; }

    // 人类猎手：只要看见恐龙就围上去
    if (d.hunter && prey && preyD < aggroR) { this.state = "hunt"; this.target = prey; return; }

    if (thirsty) {
      if (!this.waterMemo || this.waterMemoT <= 0) {
        this.waterMemo = game.world.findWater(this.x, this.y, 820);
        this.waterMemoT = 5;
      }
      if (this.waterMemo) {
        this.state = "drink";
        this.wx = this.waterMemo.x; this.wy = this.waterMemo.y;
        return;
      }
    }

    if (hungry && !d.hunter) {
      if (d.diet === "herb" || (d.diet === "omni" && !prey)) {
        var pl = game.world.findPlant(this.x, this.y, 820, 14);
        if (pl) { this.state = "graze"; this.plant = pl; return; }
      } else {
        if (carrion && carrionD < 460) { this.state = "scavenge"; this.target = carrion; return; }
        if (prey && preyD < aggroR) { this.state = "hunt"; this.target = prey; return; }
        if (carrion) { this.state = "scavenge"; this.target = carrion; return; }
      }
    } else if (prey && preyD < aggroR * 0.45 && d.diet === "carn" && d.brave > 1.2) {
      this.state = "hunt"; this.target = prey; return;
    }

    this.state = "wander";
  };

  /* ---------------- 每帧行为 ---------------- */
  P.act = function (dt, game) {
    var d = this.def;
    this.sprinting = false;
    if (d["static"]) { this.throttle = 0; return; }

    // 萨满支援
    if (d.magic && this.magicCd <= 0 && D.Magic) D.Magic.support(game, this);
    // NPC 吐息（龙王 / 幽影）
    if (d.breath && !this.isPlayer && this.target && !this.target.dead && this.breathCd <= 0 && D.Magic) {
      var bd = U.dist(this.x, this.y, this.target.x, this.target.y);
      if (bd < 230 && Math.random() < 0.5) {
        this.face = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        D.Magic.cast(game, this);
      } else if (this.breathCd <= 0) this.breathCd = 1.2;
    }

    switch (this.state) {
      case "flee": {
        var f = this.fleeFrom;
        var ang = f ? Math.atan2(this.y - f.y, this.x - f.x) : this.face;
        if (f) {
          var dd = U.dist(this.x, this.y, f.x, f.y);
          if (dd > d.aggro * 1.5) { this.fleeT = 0; this.state = "wander"; break; }
        }
        this.moveDir(ang + Math.sin(this.age * 1.7) * 0.25, 1.0);
        this.sprinting = this.stamina > 6;
        break;
      }
      case "fight":
      case "hunt": {
        var t = this.target;
        if (!t || t.remove || (t.dead && this.state === "fight")) { this.state = "wander"; this.target = null; break; }
        if (t.dead) { this.state = d.hunter ? "wander" : "scavenge"; break; }
        var dist = U.dist(this.x, this.y, t.x, t.y);
        if (dist > d.aggro * 1.8) { this.target = null; this.state = "wander"; break; }
        var rr = this.reach(t);
        // 瞬移偷袭
        if (d.blink && this.blinkCd <= 0 && dist > 150 && dist < 560 && D.Magic) {
          D.Magic.blink(game, this, t);
          break;
        }
        // 远程攻击（人类）
        if (d.ranged) {
          var rd = d.ranged;
          if (dist < rd.range) {
            if (dist < 105 + t.radius) this.moveDir(Math.atan2(this.y - t.y, this.x - t.x), 0.6);
            else if (dist > rd.range * 0.72) this.moveTo(t.x, t.y, 0.5);
            else { this.throttle = 0; this.dirWanted = Math.atan2(t.y - this.y, t.x - this.x); }
            if (this.rangedCd <= 0) {
              this.rangedCd = rd.cd * (0.8 + Math.random() * 0.5);
              this.atkAnim = 0.32;
              D.Magic.fireProjectile(game, this, t, rd.kind);
            }
            if (dist < rr) this.tryAttack(game, t);
          } else this.moveTo(t.x, t.y, 0.95);
          break;
        }
        if (dist < rr) {
          this.moveTo(t.x, t.y, 0.14);
          this.tryAttack(game, t);
        } else {
          this.moveTo(t.x, t.y, 0.95);
          this.sprinting = dist < 360 && this.stamina > 10;
        }
        break;
      }
      case "scavenge": {
        var c = this.target;
        if (!c || c.remove || c.meat <= 0) { this.target = null; this.state = "wander"; break; }
        var cd = U.dist(this.x, this.y, c.x, c.y);
        if (cd < this.radius + c.radius * 0.8 + 14) {
          this.moveDir(Math.atan2(c.y - this.y, c.x - this.x), 0);
          this.feedCorpse(c, dt, game);
        } else this.moveTo(c.x, c.y, 0.75);
        break;
      }
      case "graze": {
        var plt = this.plant;
        if (!plt || plt.food < 8) { this.plant = null; this.state = "wander"; break; }
        var pd = U.dist(this.x, this.y, plt.x, plt.y);
        if (pd < this.radius + 26) {
          this.moveDir(Math.atan2(plt.y - this.y, plt.x - this.x), 0);
          this.grazePlant(plt, dt, game);
        } else this.moveTo(plt.x, plt.y, 0.6);
        break;
      }
      case "drink": {
        var wd = U.dist(this.x, this.y, this.wx, this.wy);
        if (wd < this.radius + 52) {
          this.moveDir(Math.atan2(this.wy - this.y, this.wx - this.x), 0);
          this.thirst = Math.min(100, this.thirst + 24 * dt);
          this.eatT = 0.25;
          if (this.thirst > 94) { this.state = "wander"; this.waterMemo = null; }
        } else this.moveTo(this.wx, this.wy, 0.7);
        break;
      }
      case "follow": {
        var p = game.player;
        if (!p) { this.state = "wander"; break; }
        var fd = U.dist(this.x, this.y, p.x, p.y);
        if (fd > 240) { this.moveTo(p.x, p.y, 1.0); this.sprinting = fd > 420 && this.stamina > 8; }
        else if (fd > 110) this.moveTo(p.x, p.y, 0.55);
        else this.throttle = 0;
        break;
      }
      default: {
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 2 + Math.random() * 4;
          var cx = this.herdX != null ? this.herdX : this.homeX;
          var cy = this.herdY != null ? this.herdY : this.homeY;
          var a2 = Math.random() * U.TAU, r2 = 60 + Math.random() * (d.kind === "human" ? 170 : 260);
          var pt = game.world.findLand(
            U.clamp(cx + Math.cos(a2) * r2, 90, game.world.w - 90),
            U.clamp(cy + Math.sin(a2) * r2, 90, game.world.h - 90),
            this.radius
          );
          this.wx = pt.x; this.wy = pt.y;
        }
        var dw = U.dist(this.x, this.y, this.wx, this.wy);
        if (dw > 26) this.moveTo(this.wx, this.wy, 0.38);
        else this.throttle = 0;
        break;
      }
    }
  };

  P.feedCorpse = function (corpse, dt, game) {
    var amt = Math.min(corpse.meat, 26 * dt);
    if (amt <= 0) return;
    corpse.meat -= amt;
    this.hunger = Math.min(100, this.hunger + amt * 1.15);
    this.gainExp(amt * 0.5, game);
    this.eatT = 0.25;
    if (game && Math.random() < dt * 6) {
      game.fx.blood(corpse.x, corpse.y - 4, corpse.radius * 0.6, 2);
      if (this.isPlayer) D.Audio.chomp();
    }
    if (corpse.meat <= 0) corpse.decay = Math.min(corpse.decay, 3);
  };

  P.grazePlant = function (plant, dt, game) {
    var amt = Math.min(plant.food, 20 * dt);
    if (amt <= 0) return;
    plant.food -= amt;
    this.hunger = Math.min(100, this.hunger + amt * 1.0);
    this.gainExp(amt * 0.42, game);
    this.eatT = 0.25;
    if (game && Math.random() < dt * 7) {
      game.fx.leaf(plant.x, plant.y);
      if (this.isPlayer) D.Audio.eat();
    }
  };

  P.metabolism = function (dt, game) {
    var d = this.def;
    if (d["static"]) return;
    if (this.ally || d.kind === "human") {
      if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.015 * dt);
      return;
    }
    this.hunger = Math.max(0, this.hunger - 0.2 * d.appetite * dt * (this.sprinting ? 1.7 : 1));
    if (d.thirsty > 0) this.thirst = Math.max(0, this.thirst - 0.24 * d.thirsty * dt);
    if (this.hunger <= 0 || (d.thirsty > 0 && this.thirst <= 0)) {
      this.hp -= this.maxHp * 0.012 * dt;
      if (this.hp <= 0) { this.die(null, game); return; }
    } else if (this.hp < this.maxHp && this.hunger > 45) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.014 * dt);
    }
  };

  P.integrate = function (dt, game) {
    var w = game.world;
    if (this.def["static"]) { this.speedNow = 0; return; }
    this.unstick(game);

    var moveAng = this.isPlayer ? this.dirWanted : this.face;
    var turn = (this.isPlayer ? 16 : 4.6 + this.speed * 0.012) * dt;
    this.face = U.turnToward(this.face, this.dirWanted, turn);
    if (this.isPlayer && this.throttle <= 0.01) moveAng = this.face;

    var terrain = w.speedAt(this.x, this.y);
    var hungerPenalty = (this.hunger <= 0 || (this.def.thirsty > 0 && this.thirst <= 0)) ? 0.66 : 1;
    var chillMul = this.chill > 0 ? 0.55 : 1;
    var blessMul = (this.bless && this.bless.speed) ? this.bless.speed : 1;
    var sp = this.speed * this.throttle * terrain * hungerPenalty * chillMul * blessMul *
      (this.sprinting ? 1.52 : 1) * (this.hurtT > 0 ? 0.78 : 1);
    if (this.stun > 0) sp = 0;
    var tvx = Math.cos(moveAng) * sp, tvy = Math.sin(moveAng) * sp;
    var k = Math.min(1, 9 * dt);
    this.vx = U.lerp(this.vx, tvx, k);
    this.vy = U.lerp(this.vy, tvy, k);

    var r = this.radius * 0.78;
    var nx = this.x + (this.vx + this.kx) * dt;
    var ny = this.y + (this.vy + this.ky) * dt;
    if (w.canWalk(nx, this.y, r)) this.x = nx; else { this.vx *= -0.15; this.kx *= -0.3; }
    if (w.canWalk(this.x, ny, r)) this.y = ny; else { this.vy *= -0.15; this.ky *= -0.3; }
    var decay = Math.pow(0.0015, dt);
    this.kx *= decay; this.ky *= decay;

    this.speedNow = U.len(this.vx, this.vy);
    this.phase += this.speedNow * dt * 0.052 + dt * 0.5;

    // 脚步 / 涉水 / 火痕
    this.stepAcc += this.speedNow * dt;
    var stepLen = 46 * this.scale;
    if (this.stepAcc > stepLen) {
      this.stepAcc = 0;
      if (game.near(this, 900)) {
        if (w.isWater(this.x, this.y)) game.fx.splash(this.x, this.y + this.radius * 0.4, this.radius);
        else if (this.speedNow > this.speed * 0.4) game.fx.dust(this.x, this.y + this.radius * 0.45, this.radius);
        if (this.isPlayer) D.Audio.step(game.time, this.scale);
      }
    }
    if (this.def.fireTrail && this.speedNow > 30) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.5;
        if (!w.isWater(this.x, this.y) && !w.solidAt(this.x, this.y)) {
          game.fires.push({ x: this.x, y: this.y, r: 44, t: 4, dmgT: 0.4, own: "n" });
        }
      }
    }
  };

  P.updateStatus = function (dt, game) {
    if (this.burn > 0) {
      this.burn -= dt;
      this.burnAcc += dt;
      if (this.burnAcc >= 0.5) {
        this.burnAcc = 0;
        this.damage(this.burnDmg * 0.5, null, game, true);
        if (game.quality > 0 && game.near(this, 900)) game.fx.ember(this.x + (Math.random() - 0.5) * this.radius, this.y - this.radius * 0.3);
      }
      if (this.burn <= 0) this.burnDmg = 0;
    }
    if (this.chill > 0) {
      this.chill -= dt;
      if (game.quality > 1 && game.near(this, 800) && Math.random() < dt * 5) {
        game.fx.spray(this.x, this.y - this.radius * 0.3, 1, { col: "#bfeaff", r: 2.4, sp: 16, up: 12, g: 40, life: 0.5 });
      }
    }
    if (this.stun > 0) this.stun -= dt;
    if (this.shield > 0) this.shield = Math.max(0, this.shield - dt * 1.5);
    if (this.bless) {
      this.bless.t -= dt;
      if (this.bless.t <= 0) {
        var nm = this.bless.name;
        this.bless = null;
        if (this.isPlayer && game) game.toast(nm + "结束了", "info");
      }
    }
    if (this.relics && this.relics.regen && this.hp < this.maxHp && !this.dead) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.006 * dt);
    }
  };

  P.update = function (dt, game) {
    this.age += dt;
    if (this.dead) {
      this.decay -= dt;
      if (this.decay <= 0) this.remove = true;
      return;
    }
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.atkAnim = Math.max(0, this.atkAnim - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.fleeT = Math.max(0, this.fleeT - dt);
    this.scaredT = Math.max(0, this.scaredT - dt);
    this.roarT = Math.max(0, this.roarT - dt);
    this.eatT = Math.max(0, this.eatT - dt);
    this.rangedCd = Math.max(0, this.rangedCd - dt);
    this.magicCd = Math.max(0, this.magicCd - dt);
    this.breathCd = Math.max(0, this.breathCd - dt);
    this.breathT = Math.max(0, this.breathT - dt);
    this.blinkCd = Math.max(0, this.blinkCd - dt);
    this.ignoreT -= dt;
    if (this.ignoreT <= 0) this.ignoreId = 0;
    this.waterMemoT -= dt;
    this.updateStatus(dt, game);
    if (this.dead) return;

    if (!this.isPlayer) {
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = 0.16 + Math.random() * 0.18;
        this.think(game);
      }
      this.metabolism(dt, game);
      if (this.dead) return;
      if (this.stun > 0) this.throttle = 0;
      else this.act(dt, game);
      if (this.sprinting) {
        this.stamina = Math.max(0, this.stamina - 16 * dt);
        if (this.stamina <= 0) this.sprinting = false;
      } else this.stamina = Math.min(100, this.stamina + 11 * dt);

      // 目标不可达检测（顶墙/隔水），2.2 秒几乎没动就放弃
      if (this.throttle > 0.3 && this.speedNow < this.speed * 0.12) {
        this.stuckT += dt;
        if (this.stuckT > 2.2) { this.stuckT = 0; this.giveUp(game); }
      } else if (this.stuckT > 0) this.stuckT = Math.max(0, this.stuckT - dt * 0.6);
    }
    this.integrate(dt, game);
  };

  D.Creature = Creature;
})(window.DINO);
