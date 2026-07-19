/* ============================================================
   POOLROOMS · player.js
   第一人称:行走 / 涉水 / 游泳 / 台阶 / 头部晃动
   ============================================================ */
(function () {
  'use strict';

  const EYE = 1.7, RAD = 0.32, HEIGHT = 1.78;

  PR.player = {
    pos: new THREE.Vector3(8, 2.5, 8),   // feet
    vel: new THREE.Vector3(),
    yaw: 2.4, pitch: -0.06,
    onGround: false, swimming: false,
    bobT: 0, stepAcc: 0,
    cam: null,
    locked: false,

    init(camera) {
      this.cam = camera;
      const cv = document.getElementById('cv');
      document.addEventListener('mousemove', e => {
        if (!this.locked) return;
        this.yaw -= e.movementX * 0.0021;
        this.pitch -= e.movementY * 0.0021;
        this.pitch = Math.max(-1.53, Math.min(1.53, this.pitch));
      });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === cv;
        document.getElementById('enter').style.opacity = this.locked ? 0 : 1;
        document.getElementById('enter').style.pointerEvents = this.locked ? 'none' : 'auto';
      });
      this.keys = {};
      document.addEventListener('keydown', e => { this.keys[e.code] = true; });
      document.addEventListener('keyup', e => { this.keys[e.code] = false; });
    },

    update(dt) {
      const W = PR.world, k = this.keys || {};
      const wy = PR.WATER_Y;
      const feet = this.pos;

      const ground = W.groundAt(feet.x, feet.z, feet.y, 0.5);
      const wading = ground <= wy + 0.01 && ground > wy - 1.05;
      const wantSwim = ground < wy - 1.05;

      /* ---- 输入方向 ---- */
      let fwd = (k['KeyW'] ? 1 : 0) - (k['KeyS'] ? 1 : 0);
      let str = (k['KeyD'] ? 1 : 0) - (k['KeyA'] ? 1 : 0);
      if (!this.locked) { fwd = 0; str = 0; }
      const run = k['ShiftLeft'] && fwd > 0;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let speed = this.swimming ? 1.7 : (run ? 4.7 : 2.7);
      if (wading && !this.swimming) speed *= 0.82;
      const wishX = (-sin * fwd + cos * str) * speed;
      const wishZ = (-cos * fwd - sin * str) * speed;
      const acc = this.swimming ? 3.5 : (this.onGround ? 11 : 4);
      this.vel.x += (wishX - this.vel.x) * Math.min(1, acc * dt);
      this.vel.z += (wishZ - this.vel.z) * Math.min(1, acc * dt);

      /* ---- 垂直 ---- */
      if (this.swimming) {
        const targetY = wy - 1.18;   // 身体漂浮:眼睛≈水面+0.5
        this.vel.y += (targetY - feet.y) * 14 * dt;
        this.vel.y *= (1 - 3.2 * dt);
        if (wantSwim === false) this.swimming = false;
      } else {
        this.vel.y -= 18.5 * dt;
        if (k['Space'] && this.onGround) {
          this.vel.y = 4.4;
          PR.audio && PR.audio.step(wading ? 'splash' : 'tile', 1);
        }
      }

      /* ---- 积分 + 碰撞 ---- */
      let nx = feet.x + this.vel.x * dt;
      let nz = feet.z + this.vel.z * dt;
      let ny = feet.y + this.vel.y * dt;

      const res = W.collide(nx, nz, RAD, feet.y, HEIGHT);
      nx = res.x; nz = res.z;

      // 落地 / 台阶
      const g2 = W.groundAt(nx, nz, Math.max(feet.y, ny) + 0.3, 0.55);
      this.onGround = false;
      if (!this.swimming) {
        if (ny <= g2 + 0.001) {
          if (feet.y - ny > 0.01 && feet.y - g2 < -0.0) {}
          const falling = this.vel.y < -5.5;
          ny = g2;
          if (this.vel.y < -0.01 && falling) PR.audio && PR.audio.step(g2 < wy ? 'splash' : 'tile', Math.min(1, -this.vel.y / 8));
          this.vel.y = 0;
          this.onGround = true;
        }
        // 平滑上台阶
        if (this.onGround && g2 > feet.y + 0.02) ny = feet.y + Math.min(g2 - feet.y, 8 * dt);
        if (wantSwim && ny < wy - 1.0) this.swimming = true;
      } else {
        const gExit = W.groundAt(nx, nz, feet.y, 1.6);
        if (gExit > wy - 1.0) {   // 游到浅处 → 起身
          this.swimming = false;
          ny = Math.max(ny, gExit);
          this.vel.y = Math.max(this.vel.y, 1.2);
        }
      }
      feet.set(nx, ny, nz);
      if (feet.y < -30) feet.set(8, 3, 8);

      /* ---- 相机 ---- */
      const hSpeed = Math.hypot(this.vel.x, this.vel.z);
      const moving = hSpeed > 0.4 && (this.onGround || this.swimming);
      if (moving) this.bobT += dt * (this.swimming ? 3.6 : (run ? 11.4 : 8.2));
      const bobA = this.swimming ? 0.045 : 0.034;
      const bobY = moving ? Math.sin(this.bobT * 2) * bobA : 0;
      const bobX = moving ? Math.sin(this.bobT) * bobA * 0.8 : 0;
      const swimRoll = this.swimming ? Math.sin(performance.now() * 0.0012) * 0.012 : 0;
      const eyeY = feet.y + (this.swimming ? EYE * 0.82 : EYE);
      this.cam.position.set(
        feet.x + bobX * cos,
        eyeY + bobY + (this.swimming ? Math.sin(performance.now() * 0.0016) * 0.05 : 0),
        feet.z - bobX * sin);
      this.cam.rotation.set(0, 0, 0);
      this.cam.rotateY(this.yaw);
      this.cam.rotateX(this.pitch);
      this.cam.rotateZ(swimRoll);
      const wantFov = 72 + (run ? 4 : 0);
      this.cam.fov += (wantFov - this.cam.fov) * Math.min(1, dt * 6);
      this.cam.updateProjectionMatrix();

      /* ---- 脚步声 ---- */
      if (moving && !this.swimming && this.onGround) {
        this.stepAcc += hSpeed * dt;
        if (this.stepAcc > (run ? 2.3 : 1.9)) {
          this.stepAcc = 0;
          PR.audio && PR.audio.step(feet.y < wy ? 'splash' : 'tile', run ? 1 : 0.7);
        }
      } else if (this.swimming && moving) {
        this.stepAcc += dt;
        if (this.stepAcc > 1.15) {
          this.stepAcc = 0;
          PR.audio && PR.audio.step('stroke', 1);
        }
      }
    }
  };
})();
