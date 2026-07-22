import * as THREE from 'three';
import { TANKS, TANK_LIST } from '../game/tankData.js';
import { prepareModel } from '../world/materials.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const $ = (id) => document.getElementById(id);

/**
 * 机库（主菜单）：3D 展台 + 车辆选择 + 属性面板
 */
export class Hangar {
  constructor(ctx) {
    this.ctx = ctx;
    this.selected = 't34';
    this.onBattle = null;
    this.group = new THREE.Group();
    this.group.position.set(5000, 260, 0);
    ctx.scene.add(this.group);
    this.displayModel = null;
    this.camAngle = 0.6;
    this.active = false;

    this._buildStage();
    this._buildUI();
  }

  _buildStage() {
    const t = this.ctx.assets.terrain;
    // 展台地面（砾石 PBR）
    const floorGeo = new THREE.CircleGeometry(30, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const gravel = {
      map: t.gravel.color.clone(),
      normalMap: t.gravel.normal.clone(),
      roughnessMap: t.gravel.rough.clone(),
    };
    for (const tex of Object.values(gravel)) {
      tex.repeat.set(7, 7);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
    }
    const floorMat = new THREE.MeshStandardMaterial({ ...gravel, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    // 中央圆台（金属质感）
    const padGeo = new THREE.CylinderGeometry(6.5, 7, 0.5, 40);
    const metalTex = { map: t.dirt.color, normalMap: t.dirt.normal };
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x5b6470, roughness: 0.6, metalness: 0.35,
      normalMap: metalTex.normalMap,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 0.25;
    pad.receiveShadow = true; pad.castShadow = true;
    this.group.add(pad);

    // 补光
    const key = new THREE.SpotLight(0xfff0d8, 500, 90, 0.7, 0.5);
    key.position.set(14, 18, 10);
    key.target = pad;
    this.group.add(key);
    const rim = new THREE.SpotLight(0x9db8ff, 260, 90, 0.8, 0.6);
    rim.position.set(-16, 12, -12);
    rim.target = pad;
    this.group.add(rim);
  }

  _buildUI() {
    const list = $('tank-list');
    list.innerHTML = '';
    for (const id of TANK_LIST) {
      const d = TANKS[id];
      const card = document.createElement('div');
      card.className = 'tank-card' + (id === this.selected ? ' selected' : '');
      card.dataset.id = id;
      card.innerHTML = `
        <div class="t-name">${d.name}</div>
        <div class="t-sub"><span>${d.nation} · 中型/重型坦克</span><span class="t-br">权重 ${d.br}</span></div>`;
      card.addEventListener('click', () => {
        this.ctx.audio.playUI('ui_click', 0.5);
        this.select(id);
      });
      list.appendChild(card);
    }
    $('btn-battle').addEventListener('click', () => {
      this.ctx.audio.playUI('ui_confirm', 0.7);
      this.onBattle?.(this.selected);
    });
  }

  select(id) {
    this.selected = id;
    document.querySelectorAll('.tank-card').forEach((c) => {
      c.classList.toggle('selected', c.dataset.id === id);
    });
    this._showStats(id);
    this._showModel(id);
  }

  _showStats(id) {
    const d = TANKS[id];
    const bar = (v) => `<div class="bar"><div style="width:${v}%"></div></div>`;
    $('tank-stats').innerHTML = `
      <h2>${d.name}</h2>
      <div class="nation">${d.nation} · 权重 ${d.br}</div>
      <div class="stat-row"><span class="lbl">火力</span>${bar(d.stats.fire)}<span class="val">${d.stats.fire}</span></div>
      <div class="stat-row"><span class="lbl">防护</span>${bar(d.stats.armor)}<span class="val">${d.stats.armor}</span></div>
      <div class="stat-row"><span class="lbl">机动</span>${bar(d.stats.mob)}<span class="val">${d.stats.mob}</span></div>
      <div class="stat-row"><span class="lbl">极速</span><span class="val" style="text-align:left">${(d.maxSpeed * 3.6).toFixed(0)} km/h</span></div>
      <div class="stat-row"><span class="lbl">装填</span><span class="val" style="text-align:left">${d.reload.toFixed(1)} s</span></div>
      <div class="stat-row"><span class="lbl">车体装甲</span><span class="val" style="text-align:left">${d.armor.hull.front}/${d.armor.hull.side}/${d.armor.hull.rear} mm</span></div>
      <table class="shell-table">
        <tr><th>弹种</th><th>穿深</th><th>伤害</th></tr>
        <tr><td>${d.shells.AP.name}</td><td>${d.shells.AP.pen}mm</td><td>${d.shells.AP.dmg[0]}-${d.shells.AP.dmg[1]}</td></tr>
        <tr><td>${d.shells.HE.name}</td><td>${d.shells.HE.pen}mm</td><td>${d.shells.HE.dmg[0]}-${d.shells.HE.dmg[1]}</td></tr>
      </table>
      <p style="margin-top:12px;color:#8a94a3;line-height:1.6">${d.desc}</p>`;
  }

  _showModel(id) {
    if (this.displayModel) {
      this.group.remove(this.displayModel);
      this.displayModel = null;
    }
    const d = TANKS[id];
    const gltf = this.ctx.assets.models[d.model];
    const model = SkeletonUtils.clone(gltf.scene);
    const holder = new THREE.Group();
    holder.add(model);
    // 归一化尺寸与落地
    const bbox = new THREE.Box3().setFromObject(model);
    const size = bbox.getSize(new THREE.Vector3());
    const scale = d.length / Math.max(size.z, size.x, 0.01);
    model.scale.setScalar(scale);
    const bbox2 = new THREE.Box3().setFromObject(holder);
    model.position.y -= bbox2.min.y;
    prepareModel(holder, { camo: d.camo, detailScale: 0.85, strength: 0.4 });
    holder.position.y = 0.5;
    this.group.add(holder);
    this.displayModel = holder;
  }

  enter() {
    this.active = true;
    $('hangar-screen').classList.remove('hidden');
    this.select(this.selected);
    this.ctx.env.follow(this.group.position);
  }

  exit() {
    this.active = false;
    $('hangar-screen').classList.add('hidden');
    if (this.displayModel) {
      this.group.remove(this.displayModel);
      this.displayModel = null;
    }
  }

  update(dt) {
    if (!this.active) return;
    this.camAngle += dt * 0.16;
    if (this.displayModel) this.displayModel.rotation.y += dt * 0.1;
    const cam = this.ctx.engine.camera;
    const r = 15;
    const cx = this.group.position.x + Math.sin(this.camAngle) * r;
    const cz = this.group.position.z + Math.cos(this.camAngle) * r;
    cam.position.set(cx, this.group.position.y + 5.2, cz);
    cam.fov = 55;
    cam.lookAt(this.group.position.x, this.group.position.y + 2.2, this.group.position.z);
    cam.updateProjectionMatrix();
  }
}
