class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.radius = 0.32;
    this.height = 1.62;
    this.pos = new THREE.Vector3(0, this.height, 6.5);
    this.yaw = Math.PI;   // facing -z (into store)
    this.pitch = 0;
    this.velY = 0;
    this.keys = {};
    this.enabled = false;
    this.locked = false;
    this.bob = 0;
    this.stepTimer = 0;
    this.baseFov = camera.fov;

    // flashlight
    this.flashlight = new THREE.SpotLight(0xfff0d0, 0, 16, Math.PI / 7, 0.4, 1.2);
    this.flashOn = false;
    this.flashTarget = new THREE.Object3D();
    camera.add(this.flashlight);
    camera.add(this.flashTarget);
    this.flashTarget.position.set(0, 0, -1);
    this.flashlight.target = this.flashTarget;
    this.flashlight.position.set(0.1, -0.1, 0);

    this._bindInput();
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyF' && this.enabled) this.toggleFlash();
    });
    document.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const s = 0.0022;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s;
      this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch));
    });
  }

  toggleFlash() {
    this.flashOn = !this.flashOn;
    this.flashlight.intensity = this.flashOn ? 3 : 0;
    if (this.audio) this.audio.blip(this.flashOn ? 880 : 440, 0.05, 0.06);
  }

  collide(nx, nz) {
    const r = this.radius;
    for (const c of this.world.colliders) {
      if (nx + r > c.minX && nx - r < c.maxX && nz + r > c.minZ && nz - r < c.maxZ) {
        // push out along smallest overlap
        const overL = (nx + r) - c.minX;
        const overR = c.maxX - (nx - r);
        const overT = (nz + r) - c.minZ;
        const overB = c.maxZ - (nz - r);
        const m = Math.min(overL, overR, overT, overB);
        if (m === overL) nx = c.minX - r;
        else if (m === overR) nx = c.maxX + r;
        else if (m === overT) nz = c.minZ - r;
        else nz = c.maxZ + r;
      }
    }
    return [nx, nz];
  }

  update(dt) {
    // rotate camera
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

    if (!this.enabled) { this.camera.position.copy(this.pos); return; }

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const run = this.keys['ShiftLeft'] || this.keys['ShiftRight'];
    const speed = (run ? 3.2 : 1.7) * this.speedMul;

    const dir = new THREE.Vector3();
    if (this.keys['KeyW']) dir.add(forward);
    if (this.keys['KeyS']) dir.sub(forward);
    if (this.keys['KeyD']) dir.add(right);
    if (this.keys['KeyA']) dir.sub(right);

    const moving = dir.lengthSq() > 0.001;
    if (moving) {
      dir.normalize().multiplyScalar(speed * dt);
      let nx = this.pos.x + dir.x;
      let nz = this.pos.z + dir.z;
      [nx, nz] = this.collide(nx, nz);
      // clamp to room
      nx = Math.max(-5.6, Math.min(5.6, nx));
      nz = Math.max(-8.6, Math.min(8.4, nz));
      this.pos.x = nx; this.pos.z = nz;

      // headbob + footsteps
      this.bob += dt * (run ? 13 : 9);
      this.stepTimer += dt;
      const stepInt = run ? 0.32 : 0.5;
      if (this.stepTimer > stepInt) { this.stepTimer = 0; this.audio && this.audio.footstep(run); }
    } else {
      this.bob += dt * 2;
      this.stepTimer = 0.5;
    }

    const bobY = moving ? Math.sin(this.bob) * (run ? 0.06 : 0.035) : Math.sin(this.bob) * 0.008;
    this.camera.position.set(this.pos.x, this.pos.y + bobY, this.pos.z);
  }

  get speedMul() { return this._speedMul ?? 1; }
  set speedMul(v) { this._speedMul = v; }
}
