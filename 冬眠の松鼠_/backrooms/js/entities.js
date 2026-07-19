/* ============================================================
   entities.js — Backrooms entities
   - Smiler: lurks in darkness, drains sanity when it sees you
   - Hunter: tall figure that pathfinds & chases the player
   ============================================================ */
(function () {
  const BR = (window.BR = window.BR || {});

  // ---------------- SMILER ----------------
  class Smiler {
    constructor(scene, maze, cell, tex) {
      this.maze = maze;
      this.cell = cell;
      const p = maze.cellToWorld(cell.i, cell.j);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 });
      this.sprite = new THREE.Sprite(mat);
      this.sprite.scale.set(2.4, 2.4, 1);
      this.sprite.position.set(p.x, 1.6, p.z);
      scene.add(this.sprite);
      this.scene = scene;
      this.visibleT = 0;
      this.relocCd = 3 + Math.random() * 4;
      this.type = "smiler";
      this.alive = true;
    }

    relocate(player) {
      // teleport to a dark cell not directly in view & not too close
      for (let t = 0; t < 20; t++) {
        const i = 1 + ((Math.random() * (this.maze.cols - 2)) | 0);
        const j = 1 + ((Math.random() * (this.maze.rows - 2)) | 0);
        const p = this.maze.cellToWorld(i, j);
        const d = Math.hypot(p.x - player.x, p.z - player.z);
        if (d > 12 && d < 40) {
          this.cell = { i, j };
          this.sprite.position.set(p.x, 1.6, p.z);
          return;
        }
      }
    }

    update(dt, player, game) {
      const pos = this.sprite.position;
      const dx = pos.x - player.x, dz = pos.z - player.z;
      const dist = Math.hypot(dx, dz);
      const litHere = game.lightLevelAt(pos.x, pos.z);
      const inView = game.isInView(pos.x, pos.z) && !BR.lineBlocked(pos.x, pos.z, player.x, player.z, this.maze);

      // fade in when close & in darkness, fade out in bright light
      let targetOp = 0;
      if (dist < 22 && litHere < 0.55) targetOp = Math.min(1, (22 - dist) / 16);
      // bright flashlight/being lit dispels it
      if (litHere > 0.7) targetOp *= 0.2;
      const mat = this.sprite.material;
      mat.opacity += (targetOp - mat.opacity) * Math.min(1, dt * 3);

      // drain sanity when it is visible to you and near
      if (mat.opacity > 0.25 && inView && dist < 18) {
        game.damageSanity(dt * (10 + (18 - dist)) * 0.6, "smiler");
        this.visibleT += dt;
        if (this.visibleT > 1.2 && Math.random() < dt) game.audio.whisper();
      } else {
        this.visibleT = 0;
      }

      // relocate occasionally when NOT being watched (classic behavior)
      this.relocCd -= dt;
      if (this.relocCd <= 0 && (!inView || mat.opacity < 0.1)) {
        this.relocate(player);
        this.relocCd = 5 + Math.random() * 6;
      }
    }

    dispose() { this.scene.remove(this.sprite); this.sprite.material.dispose(); this.alive = false; }
  }

  // ---------------- HUNTER ----------------
  class Hunter {
    constructor(scene, maze, cell, opts) {
      opts = opts || {};
      this.maze = maze;
      this.scene = scene;
      this.type = "hunter";
      this.speed = opts.speed || 2.6;
      this.chaseSpeed = opts.chaseSpeed || 4.6;
      this.senseRange = opts.senseRange || 26;
      this.catchRange = opts.catchRange || 1.15;
      this.alive = true;
      this.state = "wander"; // wander | chase | search
      this.path = null;
      this.pathIdx = 0;
      this.repathCd = 0;
      this.growlCd = 2 + Math.random() * 4;
      this.searchT = 0;

      const p = maze.cellToWorld(cell.i, cell.j);
      this.pos = new THREE.Vector3(p.x, 0, p.z);
      this.wanderTarget = { i: cell.i, j: cell.j };

      this.mesh = this._buildMesh();
      this.mesh.position.copy(this.pos);
      scene.add(this.mesh);
    }

    _buildMesh() {
      const g = new THREE.Group();
      const dark = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 1, metalness: 0 });
      // torso — tall thin
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 2.0, 8), dark);
      torso.position.y = 1.85; g.add(torso);
      // head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10), dark);
      head.position.y = 3.0; g.add(head);
      // long arms
      const armGeo = new THREE.CylinderGeometry(0.08, 0.06, 1.9, 6);
      const armL = new THREE.Mesh(armGeo, dark); armL.position.set(-0.34, 1.7, 0); armL.rotation.z = 0.2; g.add(armL);
      const armR = new THREE.Mesh(armGeo, dark); armR.position.set(0.34, 1.7, 0); armR.rotation.z = -0.2; g.add(armR);
      // legs
      const legGeo = new THREE.CylinderGeometry(0.1, 0.07, 1.7, 6);
      const legL = new THREE.Mesh(legGeo, dark); legL.position.set(-0.14, 0.85, 0); g.add(legL);
      const legR = new THREE.Mesh(legGeo, dark); legR.position.set(0.14, 0.85, 0); g.add(legR);
      // glowing eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3311 });
      const eL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat); eL.position.set(-0.1, 3.02, 0.22); g.add(eL);
      const eR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat); eR.position.set(0.1, 3.02, 0.22); g.add(eR);
      this._eyes = eyeMat;
      this._limbs = { armL, armR, legL, legR };
      g.traverse(o => { o.frustumCulled = false; });
      return g;
    }

    _newWander() {
      const c = this.maze.worldToCell(this.pos.x, this.pos.z);
      const t = this.maze.randomCellFar(c.i, c.j, 6);
      if (t) this.wanderTarget = { i: t[0], j: t[1] };
    }

    _repath(ti, tj) {
      const c = this.maze.worldToCell(this.pos.x, this.pos.z);
      this.path = this.maze.findPath(c.i, c.j, ti, tj);
      this.pathIdx = 1;
    }

    update(dt, player, game) {
      const dx = player.x - this.pos.x, dz = player.z - this.pos.z;
      const dist = Math.hypot(dx, dz);

      // detection: closer sense range when player uses flashlight/runs/low sanity
      let sense = this.senseRange;
      if (game.flashlightOn) sense += 6;
      if (game.player.sprinting) sense += 8;
      if (game.crouching) sense -= 8;
      const canSee = dist < sense && !BR.lineBlocked(this.pos.x, this.pos.z, player.x, player.z, this.maze);
      const canHear = dist < (game.crouching ? 5 : game.player.sprinting ? 22 : 12);

      if (canSee || canHear) {
        if (this.state !== "chase") { this.state = "chase"; game.audio.screech(); }
        this.lastKnown = { x: player.x, z: player.z };
        this.searchT = 0;
      } else if (this.state === "chase") {
        this.state = "search"; this.searchT = 6;
      }

      const curSpeed = this.state === "chase" ? this.chaseSpeed : this.speed;

      // choose target cell
      this.repathCd -= dt;
      if (this.state === "chase") {
        if (this.repathCd <= 0) { const pc = this.maze.worldToCell(player.x, player.z); this._repath(pc.i, pc.j); this.repathCd = 0.4; }
      } else if (this.state === "search") {
        this.searchT -= dt;
        if (this.repathCd <= 0 && this.lastKnown) { const lc = this.maze.worldToCell(this.lastKnown.x, this.lastKnown.z); this._repath(lc.i, lc.j); this.repathCd = 0.6; }
        if (this.searchT <= 0) { this.state = "wander"; this.path = null; }
      } else {
        if (!this.path || this.pathIdx >= (this.path ? this.path.length : 0)) { this._newWander(); this._repath(this.wanderTarget.i, this.wanderTarget.j); this.repathCd = 1; }
      }

      // follow path
      let moved = false;
      if (this.path && this.pathIdx < this.path.length) {
        const node = this.path[this.pathIdx];
        const w = this.maze.cellToWorld(node[0], node[1]);
        const ndx = w.x - this.pos.x, ndz = w.z - this.pos.z;
        const nd = Math.hypot(ndx, ndz);
        if (nd < 0.4) { this.pathIdx++; }
        else {
          this.pos.x += (ndx / nd) * curSpeed * dt;
          this.pos.z += (ndz / nd) * curSpeed * dt;
          this.mesh.rotation.y = Math.atan2(ndx, ndz);
          moved = true;
        }
      } else if (this.state === "chase") {
        // direct approach when very close / same cell
        if (dist > 0.1) {
          this.pos.x += (dx / dist) * curSpeed * dt;
          this.pos.z += (dz / dist) * curSpeed * dt;
          this.mesh.rotation.y = Math.atan2(dx, dz);
          moved = true;
        }
      }

      this.mesh.position.copy(this.pos);

      // limb walking animation
      if (moved) {
        this._walkT = (this._walkT || 0) + dt * curSpeed * 1.6;
        const s = Math.sin(this._walkT);
        this._limbs.legL.rotation.x = s * 0.6;
        this._limbs.legR.rotation.x = -s * 0.6;
        this._limbs.armL.rotation.x = -s * 0.5;
        this._limbs.armR.rotation.x = s * 0.5;
      }
      // eye glow pulse
      this._eyes.color.setRGB(1, 0.15 + 0.1 * Math.sin(performance.now() * 0.005), 0.05);

      // growl audio scaled by distance
      this.growlCd -= dt;
      if (this.growlCd <= 0 && dist < 30) {
        if (this.state === "chase") game.audio.screech();
        this.growlCd = this.state === "chase" ? 2.5 + Math.random() * 2 : 5 + Math.random() * 6;
      }

      // proximity tension for audio + sanity
      if (dist < 16) game.threatFromEntity(Math.max(game._entityThreat || 0, (16 - dist) / 16));

      // catch!
      if (dist < this.catchRange) { game.onCaught(this); }
    }

    dispose() { this.scene.remove(this.mesh); this.alive = false; }
  }

  BR.Smiler = Smiler;
  BR.Hunter = Hunter;
})();
