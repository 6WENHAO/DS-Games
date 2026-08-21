import * as THREE from 'three';

/** Ground aiming reticle sized to the selected disaster's radius. */
export class Reticle {
  private group = new THREE.Group();
  private outer: THREE.Mesh;
  private inner: THREE.Mesh;
  private ticks: THREE.Mesh;
  private t = 0;
  private radius = 1;
  private visible = false;

  constructor(scene: THREE.Scene) {
    const mk = (geo: THREE.BufferGeometry, opacity: number): THREE.Mesh => {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      m.frustumCulled = false;
      m.renderOrder = 8;
      return m;
    };
    const ring = new THREE.RingGeometry(0.94, 1, 72, 1);
    ring.rotateX(-Math.PI / 2);
    const ring2 = new THREE.RingGeometry(0.24, 0.3, 40, 1);
    ring2.rotateX(-Math.PI / 2);
    const tickGeo = new THREE.RingGeometry(0.72, 0.9, 4, 1, 0, Math.PI * 2);
    tickGeo.rotateX(-Math.PI / 2);
    this.outer = mk(ring, 0.95);
    this.inner = mk(ring2, 0.8);
    this.ticks = mk(tickGeo, 0.35);
    this.group.add(this.outer, this.inner, this.ticks);
    this.group.visible = false;
    scene.add(this.group);
  }

  show(x: number, z: number, radius: number, hex: number): void {
    this.visible = true;
    this.radius = Math.max(1.2, radius);
    this.group.visible = true;
    this.group.position.set(x, 0.3, z);
    for (const m of [this.outer, this.inner, this.ticks])
      (m.material as THREE.MeshBasicMaterial).color.setHex(hex);
  }

  hide(): void {
    this.visible = false;
    this.group.visible = false;
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.t += dt;
    const pulse = 1 + Math.sin(this.t * 4.2) * 0.03;
    this.outer.scale.set(this.radius * pulse, 1, this.radius * pulse);
    this.inner.scale.set(this.radius, 1, this.radius);
    this.ticks.scale.set(this.radius, 1, this.radius);
    this.ticks.rotation.y += dt * 0.7;
    (this.outer.material as THREE.MeshBasicMaterial).opacity = 0.7 + Math.sin(this.t * 6) * 0.22;
  }
}
