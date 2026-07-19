/*
  Ghost phases:
  0 - dormant
  1 - subtle apparitions (flickers, silhouette far away)
  2 - manifest (chase, teleport nearby)
  3 - jump-scare triggered
*/
class Ghost {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.phase = 0;
    this.visible = false;
    this.age = 0;
    this.cooldown = 0;
    this.speed = 4.5;
    this.buildMesh();

    // point light around ghost for eerie aura
    this.aura = new THREE.PointLight(0x88ffbb, 0, 5, 2);
    this.scene.add(this.aura);
  }

  buildMesh() {
    this.group = new THREE.Group();

    // body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x556657, roughness: 0.3, transparent: true, opacity: 0.68 })
    );
    body.position.y = 0.9; this.group.add(body);

    // head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x66775e, roughness: 0.3, transparent: true, opacity: 0.7 })
    );
    head.position.y = 1.72; this.group.add(head);

    // dark hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 1 })
    );
    hair.position.y = 1.78; hair.scale.set(1, 1.15, 0.95); this.group.add(hair);

    // long arms
    const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.2, 6);
    const armMat = new THREE.MeshStandardMaterial({ color: 0x66775e, roughness: 0.3, transparent: true, opacity: 0.65 });
    const la = new THREE.Mesh(armGeo, armMat); la.position.set(-0.36, 1.0, 0); la.rotation.z = 0.4; this.group.add(la);
    const ra = new THREE.Mesh(armGeo, armMat); ra.position.set(0.36, 1.0, 0); ra.rotation.z = -0.4; this.group.add(ra);

    this.group.visible = false;
    this.scene.add(this.group);
  }

  setPhase(p) { this.phase = p; }

  update(dt, playerPos) {
    this.age += dt;
    this.cooldown -= dt;

    if (this.group.visible) {
      // slight bobbing
      this.group.position.y = Math.sin(this.age * 2.5) * 0.05;
      // aura follows
      this.aura.position.copy(this.group.position).add(new THREE.Vector3(0, 0.8, 0));

      // slow float movement
      this.group.position.y += Math.sin(this.age * 3 + 1) * 0.015;
    }

    if (this.phase === 0) return;

    if (this.phase === 1) return this._phase1(dt, playerPos);
    if (this.phase === 2) return this._phase2(dt, playerPos);
  }

  _phase1(dt, playerPos) {
    // flicker briefly at random locations; no chase
    if (this.cooldown > 0) {
      if (!this.visible && this.group.visible) {
        this._fade(0, 0.3);
      }
      return;
    }
    // random interval
    if (Math.random() < dt * 0.25) {
      this._appearNear(playerPos, 4.5, 8);
      this._fade(0.55, 1.0);
      setTimeout(() => this._fade(0, 0.5), 1200 + Math.random() * 2000);
      this.cooldown = 5 + Math.random() * 8;
    }
  }

  _phase2(dt, playerPos) {
    // teleport or move toward player
    if (this.cooldown > 0) {
      if (this.visible) this._moveToward(playerPos, dt * 0.6);
      return;
    }

    if (Math.random() < 0.6) {
      // teleport closer
      this._appearNear(playerPos, 2.5, 4.5);
      this._fade(0.8, 1.2);
      this.cooldown = 4 + Math.random() * 5;
    } else {
      // stalk
      this._appearNear(playerPos, 3, 6);
      this._fade(0.7, 1.0);
      this.cooldown = 3 + Math.random() * 4;
    }

    // very close = jumpscare
    if (this.group.visible && this.group.position.distanceTo(playerPos) < 1.2) {
      this.triggerJumpscare();
    }
  }

  _appearNear(pos, minDist, maxDist) {
    const angle = Math.random() * Math.PI * 2;
    const dist = minDist + Math.random() * (maxDist - minDist);
    const tx = pos.x + Math.cos(angle) * dist;
    const tz = pos.z + Math.sin(angle) * dist;
    this.group.position.set(
      Math.max(-5.5, Math.min(5.5, tx)),
      0.05,
      Math.max(-8.5, Math.min(8.3, tz))
    );
    this.group.lookAt(new THREE.Vector3(pos.x, 1.3, pos.z));
    this.group.visible = true;
    this.visible = true;
  }

  _moveToward(target, speed) {
    const dir = new THREE.Vector3().subVectors(target, this.group.position).setY(0);
    if (dir.length() > 0.2) {
      dir.normalize().multiplyScalar(speed);
      this.group.position.x += dir.x;
      this.group.position.z += dir.z;
      this.group.lookAt(new THREE.Vector3(target.x, 1.3, target.z));
    }
  }

  _fade(target, dur) { // placeholder; real fade via uniform
    if (target > 0.1) {
      this.group.visible = true;
      this.visible = true;
      this.aura.intensity = target * 1.8;
    } else {
      this.group.visible = false;
      this.visible = false;
      this.aura.intensity = 0;
    }
  }

  triggerJumpscare() {
    this._fade(1, 0.1);
    return true;
  }

  hide() {
    this._fade(0, 0.3);
    this.aura.intensity = 0;
  }
}
