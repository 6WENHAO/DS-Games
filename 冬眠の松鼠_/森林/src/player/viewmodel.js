import * as THREE from 'three';
import { Assets } from '../core/assets.js';

// 手持武器视模型：挂在相机下，带挥舞/摆动动画
export class ViewModel {
  constructor(camera) {
    this.camera = camera;
    this.holder = new THREE.Group();
    camera.add(this.holder);

    this.current = null;   // itemId
    this.mesh = null;
    this.swingT = 1;       // 0..1 挥舞进度（1=空闲）
    this.bobT = 0;
  }

  equip(itemId) {
    if (this.mesh) {
      this.holder.remove(this.mesh);
      this.mesh = null;
    }
    this.current = itemId;
    if (!itemId) return;

    let obj = null;
    if (itemId === 'hatchet') {
      obj = Assets.cloneModelScene('hatchet', { castShadow: false });
      obj.scale.setScalar(1.5);
      obj.rotation.set(0.3, Math.PI * 0.52, 0.15);
    } else if (itemId === 'machete') {
      obj = Assets.cloneModelScene('machete', { castShadow: false });
      obj.scale.setScalar(1.4);
      obj.rotation.set(0.4, Math.PI * 0.5, 0.28);
    } else if (itemId === 'spear') {
      // 程序化长矛：树枝杆 + 石尖
      obj = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.03, 1.7, 6),
        new THREE.MeshStandardMaterial({ map: Assets.tex('bark_col'), roughness: 1 })
      );
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.035, 0.22, 6),
        new THREE.MeshStandardMaterial({ map: Assets.tex('rock_col'), roughness: 0.8 })
      );
      tip.position.y = 0.95;
      obj.add(shaft, tip);
      obj.rotation.set(1.25, 0.2, 0);
    }
    if (!obj) return;

    obj.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        o.material = o.material.clone();
        o.material.depthTest = true;
      }
    });
    this.mesh = obj;
    this._setIdlePos();
    this.holder.add(obj);
  }

  _setIdlePos() {
    if (!this.mesh) return;
    if (this.current === 'spear') {
      this.mesh.position.set(0.32, -0.34, -0.6);
    } else {
      this.mesh.position.set(0.38, -0.34, -0.55);
    }
  }

  swing() {
    this.swingT = 0;
  }

  update(dt, moving) {
    if (!this.mesh) return;
    this.bobT += dt * (moving ? 6.5 : 2);

    if (this.swingT < 1) {
      this.swingT = Math.min(1, this.swingT + dt * 2.6);
      const p = this.swingT;
      // 挥砍弧线：抬起 -> 快速下劈 -> 回位
      let ang;
      if (p < 0.3) ang = -(p / 0.3) * 0.9;
      else if (p < 0.6) ang = -0.9 + ((p - 0.3) / 0.3) * 2.1;
      else ang = 1.2 - ((p - 0.6) / 0.4) * 1.2;
      this.holder.rotation.x = -ang * 0.8;
      this.holder.rotation.z = -ang * 0.25;
      this.holder.position.z = -Math.sin(Math.min(p * 2, 1) * Math.PI) * 0.18;
    } else {
      // 待机摆动
      this.holder.rotation.x *= 0.85;
      this.holder.rotation.z *= 0.85;
      this.holder.position.z *= 0.85;
      this.mesh.position.y = (this.current === 'spear' ? -0.34 : -0.34) + Math.sin(this.bobT) * 0.008;
      this.mesh.position.x = (this.current === 'spear' ? 0.32 : 0.38) + Math.cos(this.bobT * 0.7) * 0.006;
    }
  }
}
