// entities.js - 实体：敌人、道具、火球、粒子、弹金币
(function () {
  "use strict";

  var GRAV = 0.35;
  var MAX_FALL = 7;

  function Entity(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.dead = false;
    this.remove = false;
    this.onGround = false;
  }

  Entity.prototype.rect = function () {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  };

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // 与图块的碰撞（实体通用，简化为脚底/头顶/左右探测）
  function tileCollide(e, level) {
    e.vy = Math.min(e.vy + GRAV, MAX_FALL);

    // 水平
    e.x += e.vx;
    var dir = e.vx > 0 ? 1 : -1;
    var edgeX = e.vx > 0 ? e.x + e.w : e.x;
    var tx = Math.floor(edgeX / 16);
    var ty1 = Math.floor(e.y / 16);
    var ty2 = Math.floor((e.y + e.h - 1) / 16);
    for (var ty = ty1; ty <= ty2; ty++) {
      if (level.isSolid(tx, ty)) {
        if (e.vx > 0) e.x = tx * 16 - e.w - 0.01;
        else e.x = (tx + 1) * 16 + 0.01;
        e.vx = -e.vx * (e.bounceWall ? 1 : 0);
        if (e.turnOnWall) e.facing = -dir;
        break;
      }
    }

    // 垂直
    e.y += e.vy;
    e.onGround = false;
    if (e.vy >= 0) {
      var by = Math.floor((e.y + e.h) / 16);
      var bx1 = Math.floor((e.x + 2) / 16);
      var bx2 = Math.floor((e.x + e.w - 2) / 16);
      for (var bx = bx1; bx <= bx2; bx++) {
        if (level.isSolid(bx, by)) {
          e.y = by * 16 - e.h;
          e.vy = 0;
          e.onGround = true;
          break;
        }
      }
    } else {
      var hy = Math.floor(e.y / 16);
      var hx1 = Math.floor((e.x + 2) / 16);
      var hx2 = Math.floor((e.x + e.w - 2) / 16);
      for (var hx = hx1; hx <= hx2; hx++) {
        if (level.isSolid(hx, hy)) {
          e.y = (hy + 1) * 16;
          e.vy = 0;
          break;
        }
      }
    }

    if (e.y > 260) e.remove = true;
  }

  // ---------- 栗子怪 ----------
  function Goomba(x, y) {
    Entity.call(this, x, y + 1, 14, 14);
    this.type = "goomba";
    this.vx = -0.6;
    this.bounceWall = true;
    this.anim = 0;
    this.squashTimer = 0;
    this.active = false;
  }
  Goomba.prototype = Object.create(Entity.prototype);
  Goomba.prototype.update = function (level) {
    if (this.squashTimer > 0) {
      this.squashTimer--;
      if (this.squashTimer === 0) this.remove = true;
      return;
    }
    this.anim++;
    tileCollide(this, level);
  };
  Goomba.prototype.stomp = function () {
    this.dead = true;
    this.squashTimer = 30;
    this.vx = 0;
  };
  Goomba.prototype.draw = function (g, S, camX) {
    var x = Math.round(this.x - camX - 1), y = Math.round(this.y);
    if (this.squashTimer > 0) g.drawImage(S.goombaFlat, x, y);
    else g.drawImage(S.goomba[Math.floor(this.anim / 10) % 2], x, y);
  };

  // ---------- 绿龟 ----------
  function Koopa(x, y) {
    Entity.call(this, x, y, 14, 22);
    this.type = "koopa";
    this.vx = -0.6;
    this.bounceWall = true;
    this.anim = 0;
    this.mode = "walk"; // walk | shell | slide
    this.wakeTimer = 0;
    this.kickGrace = 0;
  }
  Koopa.prototype = Object.create(Entity.prototype);
  Koopa.prototype.update = function (level) {
    this.anim++;
    if (this.kickGrace > 0) this.kickGrace--;
    if (this.mode === "shell") {
      this.vx = 0;
      this.wakeTimer++;
      if (this.wakeTimer > 480) { this.mode = "walk"; this.h = 22; this.y -= 8; this.vx = -0.6; }
    }
    tileCollide(this, level);
  };
  Koopa.prototype.stomp = function (player) {
    if (this.mode === "walk") {
      this.mode = "shell";
      this.h = 14;
      this.y += 8;
      this.vx = 0;
      this.wakeTimer = 0;
    } else if (this.mode === "slide") {
      this.mode = "shell";
      this.vx = 0;
      this.wakeTimer = 0;
    }
  };
  Koopa.prototype.kick = function (dir) {
    this.mode = "slide";
    this.vx = 3.2 * dir;
    this.wakeTimer = 0;
    this.kickGrace = 16;
  };
  Koopa.prototype.draw = function (g, S, camX) {
    var x = Math.round(this.x - camX - 1);
    if (this.mode === "walk") {
      var f = S.koopa[this.vx > 0 ? 0 : 1][Math.floor(this.anim / 10) % 2];
      g.drawImage(f, x, Math.round(this.y + this.h - 17));
    } else {
      g.drawImage(S.shell, x, Math.round(this.y + this.h - 11));
    }
  };

  // ---------- 蘑菇 / 1UP ----------
  function Mushroom(x, y, oneUp) {
    Entity.call(this, x, y, 14, 14);
    this.type = oneUp ? "oneup" : "mushroom";
    this.vx = 1.0;
    this.bounceWall = true;
    this.riseTimer = 16;
  }
  Mushroom.prototype = Object.create(Entity.prototype);
  Mushroom.prototype.update = function (level) {
    if (this.riseTimer > 0) {
      this.riseTimer--;
      this.y -= 1;
      return;
    }
    tileCollide(this, level);
  };
  Mushroom.prototype.draw = function (g, S, camX) {
    g.drawImage(this.type === "oneup" ? S.oneUpShroom : S.mushroom, Math.round(this.x - camX - 1), Math.round(this.y - 1));
  };

  // ---------- 火花（升级花） ----------
  function Flower(x, y) {
    Entity.call(this, x, y, 14, 14);
    this.type = "flower";
    this.riseTimer = 16;
    this.anim = 0;
  }
  Flower.prototype = Object.create(Entity.prototype);
  Flower.prototype.update = function () {
    this.anim++;
    if (this.riseTimer > 0) { this.riseTimer--; this.y -= 1; }
  };
  Flower.prototype.draw = function (g, S, camX) {
    g.drawImage(S.flower[Math.floor(this.anim / 8) % 2], Math.round(this.x - camX - 1), Math.round(this.y - 1));
  };

  // ---------- 星星 ----------
  function Star(x, y) {
    Entity.call(this, x, y, 14, 14);
    this.type = "star";
    this.vx = 1.2;
    this.bounceWall = true;
    this.riseTimer = 16;
    this.anim = 0;
  }
  Star.prototype = Object.create(Entity.prototype);
  Star.prototype.update = function (level) {
    this.anim++;
    if (this.riseTimer > 0) { this.riseTimer--; this.y -= 1; return; }
    tileCollide(this, level);
    if (this.onGround) this.vy = -4.5;
  };
  Star.prototype.draw = function (g, S, camX) {
    g.drawImage(S.star[Math.floor(this.anim / 6) % 2], Math.round(this.x - camX - 1), Math.round(this.y - 1));
  };

  // ---------- 火球 ----------
  function Fireball(x, y, dir) {
    Entity.call(this, x, y, 8, 8);
    this.type = "fireball";
    this.vx = 4 * dir;
    this.life = 120;
  }
  Fireball.prototype = Object.create(Entity.prototype);
  Fireball.prototype.update = function (level) {
    this.life--;
    if (this.life <= 0) this.remove = true;
    var oldVx = this.vx;
    tileCollide(this, level);
    if (this.vx === 0) this.remove = true; // 撞墙
    else this.vx = oldVx;
    if (this.onGround) this.vy = -3.2;
  };
  Fireball.prototype.draw = function (g, S, camX) {
    g.drawImage(S.fireball, Math.round(this.x - camX), Math.round(this.y));
  };

  // ---------- 弹出金币（顶砖时） ----------
  function CoinPop(x, y) {
    Entity.call(this, x, y, 16, 16);
    this.type = "coinpop";
    this.vy = -5;
    this.anim = 0;
  }
  CoinPop.prototype = Object.create(Entity.prototype);
  CoinPop.prototype.update = function () {
    this.anim++;
    this.vy += GRAV;
    this.y += this.vy;
    if (this.anim > 28) this.remove = true;
  };
  CoinPop.prototype.draw = function (g, S, camX) {
    g.drawImage(S.coin[Math.floor(this.anim / 4) % 4], Math.round(this.x - camX), Math.round(this.y));
  };

  // ---------- 碎砖粒子 ----------
  function BrickBit(x, y, vx, vy) {
    Entity.call(this, x, y, 8, 8);
    this.type = "brickbit";
    this.vx = vx; this.vy = vy;
    this.life = 60;
  }
  BrickBit.prototype = Object.create(Entity.prototype);
  BrickBit.prototype.update = function () {
    this.life--;
    if (this.life <= 0 || this.y > 260) this.remove = true;
    this.vy += GRAV;
    this.x += this.vx;
    this.y += this.vy;
  };
  BrickBit.prototype.draw = function (g, S, camX) {
    g.drawImage(S.brickBit, Math.round(this.x - camX), Math.round(this.y));
  };

  // ---------- 浮动分数 ----------
  function ScorePop(x, y, text) {
    Entity.call(this, x, y, 1, 1);
    this.type = "scorepop";
    this.text = text;
    this.life = 40;
  }
  ScorePop.prototype = Object.create(Entity.prototype);
  ScorePop.prototype.update = function () {
    this.life--;
    this.y -= 0.7;
    if (this.life <= 0) this.remove = true;
  };
  ScorePop.prototype.draw = function (g, S, camX, drawText) {
    drawText(g, this.text, Math.round(this.x - camX), Math.round(this.y), "#fff");
  };

  window.MarioEntities = {
    Goomba: Goomba,
    Koopa: Koopa,
    Mushroom: Mushroom,
    Flower: Flower,
    Star: Star,
    Fireball: Fireball,
    CoinPop: CoinPop,
    BrickBit: BrickBit,
    ScorePop: ScorePop,
    overlap: overlap,
    GRAV: GRAV
  };
})();
