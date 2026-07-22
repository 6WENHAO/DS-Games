import * as THREE from 'three';
import { rand, pick, clamp } from '../core/utils.js';

function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.live = [];
    this.time = 0;

    this.texSoft = makeCanvas(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });

    this.texSpark = makeCanvas(128, (ctx, s) => {
      ctx.translate(s / 2, s / 2);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,240,200,0.8)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.5, s * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.texRing = makeCanvas(256, (ctx, s) => {
      ctx.strokeStyle = 'rgba(255,255,255,1)';
      ctx.lineWidth = s * 0.05;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = s * 0.016;
      ctx.beginPath();
      ctx.arc(s / 2, s / 2, s * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    });

    this.texFlame = makeCanvas(128, (ctx, s) => {
      const g = ctx.createRadialGradient(s / 2, s * 0.62, 0, s / 2, s * 0.62, s * 0.55);
      g.addColorStop(0, 'rgba(255,240,180,1)');
      g.addColorStop(0.3, 'rgba(255,170,60,0.85)');
      g.addColorStop(0.65, 'rgba(220,80,20,0.4)');
      g.addColorStop(1, 'rgba(120,20,5,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    });

    this.texSmoke = makeCanvas(128, (ctx, s) => {
      for (let i = 0; i < 14; i++) {
        const x = rand(s * 0.25, s * 0.75), y = rand(s * 0.25, s * 0.75), r = rand(s * 0.1, s * 0.3);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.24)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
      }
    });

    this.flames = [];
    this.trails = [];
  }

  spawnSprite({ tex, color = 0xffffff, pos, vel = null, size = 1, life = 0.5, grow = 0, gravity = 0, fade = true, additive = true, rot = 0, spin = 0 }) {
    let sp = this.pool.pop();
    if (!sp) {
      sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
      }));
      this.scene.add(sp);
    }
    sp.visible = true;
    sp.material.map = tex;
    sp.material.color.set(color);
    sp.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    sp.material.opacity = 1;
    sp.material.rotation = rot;
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    this.live.push({
      sp, vel: vel ? vel.clone() : new THREE.Vector3(),
      life, maxLife: life, grow, gravity, fade, baseSize: size, spin,
    });
    return sp;
  }

  hitSpark(pos, { heavy = false, color = 0xffd27a } = {}) {
    this.spawnSprite({ tex: this.texSpark, color: 0xfff3cf, pos, size: heavy ? 2.6 : 1.7, life: 0.16, grow: heavy ? 7 : 4 });
    const n = heavy ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const up = rand(1.4, heavy ? 5.4 : 3.6);
      const v = new THREE.Vector3(Math.cos(a) * rand(1.5, 4.2), up, Math.sin(a) * rand(1.5, 4.2));
      this.spawnSprite({ tex: this.texSoft, color, pos, vel: v, size: rand(0.12, 0.3), life: rand(0.25, 0.5), gravity: -9.5 });
    }
  }

  bloodBurst(pos, color = 0xcfd4d9) {
    for (let i = 0; i < 9; i++) {
      const a = rand(0, Math.PI * 2);
      const v = new THREE.Vector3(Math.cos(a) * rand(1, 3.4), rand(1.2, 4), Math.sin(a) * rand(1, 3.4));
      this.spawnSprite({ tex: this.texSmoke, color, pos, vel: v, size: rand(0.35, 0.8), life: rand(0.3, 0.6), gravity: -7, additive: false });
    }
  }

  dust(pos, count = 6, color = 0x9a8f78) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const v = new THREE.Vector3(Math.cos(a) * rand(0.6, 2.2), rand(0.4, 1.4), Math.sin(a) * rand(0.6, 2.2));
      this.spawnSprite({
        tex: this.texSmoke, color, pos: pos.clone().add(new THREE.Vector3(0, 0.15, 0)),
        vel: v, size: rand(0.5, 1.0), life: rand(0.4, 0.8), grow: 1.6, additive: false,
      });
    }
  }

  soulWisp(pos, count = 8) {
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rand(-0.7, 0.7), rand(1.6, 3.4), rand(-0.7, 0.7));
      this.spawnSprite({ tex: this.texSoft, color: 0xffd873, pos: pos.clone().add(new THREE.Vector3(rand(-0.4, 0.4), rand(0.2, 1), rand(-0.4, 0.4))), vel: v, size: rand(0.16, 0.4), life: rand(0.7, 1.3), gravity: 1.2 });
    }
  }

  healGlow(pos) {
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0.3, 0.8);
      this.spawnSprite({
        tex: this.texSoft, color: 0x7dffa0,
        pos: pos.clone().add(new THREE.Vector3(Math.cos(a) * r, rand(0, 0.5), Math.sin(a) * r)),
        vel: new THREE.Vector3(0, rand(1, 2.4), 0), size: rand(0.15, 0.34), life: rand(0.5, 1),
      });
    }
  }

  stunRing(pos) {
    const sp = this.spawnSprite({ tex: this.texRing, color: 0xffd873, pos: pos.clone().add(new THREE.Vector3(0, 0.4, 0)), size: 0.6, life: 0.5, grow: 6 });
    return sp;
  }

  groundRing(x, y, z, radius, color = 0xff5030) {
    const geo = new THREE.RingGeometry(radius * 0.86, radius, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.12, z);
    this.scene.add(mesh);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 0.86, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(x, y + 0.1, z);
    this.scene.add(inner);
    return {
      ring: mesh, inner,
      setProgress: (k) => { mat.opacity = 0.4 + 0.5 * Math.sin(k * Math.PI * 6); inner.scale.setScalar(clamp(k, 0.01, 1)); },
      dispose: () => {
        this.scene.remove(mesh); this.scene.remove(inner);
        geo.dispose(); mat.dispose(); inner.geometry.dispose(); inner.material.dispose();
      },
    };
  }

  shockwave(pos, color = 0xffcf9a, maxSize = 9) {
    this.spawnSprite({ tex: this.texRing, color, pos: pos.clone().add(new THREE.Vector3(0, 0.35, 0)), size: 1.4, life: 0.42, grow: maxSize });
    this.dust(pos, 12, 0xb0a58c);
  }

  addFlame(pos, scale = 1) {
    const group = new THREE.Group();
    const mats = [];
    for (let i = 0; i < 2; i++) {
      const m = new THREE.SpriteMaterial({ map: this.texFlame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 });
      const sp = new THREE.Sprite(m);
      sp.scale.setScalar(0.7 * scale);
      sp.position.y = 0.1 * i;
      group.add(sp);
      mats.push(sp);
    }
    group.position.copy(pos);
    this.scene.add(group);
    this.flames.push({ group, sprites: mats, seed: rand(0, 100), scale });
  }

  attachTrail(getTipPos, color = 0xffe0a0) {
    const trail = { getTipPos, color, points: [], active: false };
    this.trails.push(trail);
    return trail;
  }

  update(dt, camera) {
    this.time += dt;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sp.visible = false;
        this.pool.push(p.sp);
        this.live.splice(i, 1);
        continue;
      }
      const k = p.life / p.maxLife;
      p.vel.y += p.gravity * dt;
      p.sp.position.addScaledVector(p.vel, dt);
      const size = p.baseSize + p.grow * (1 - k) * p.baseSize;
      p.sp.scale.setScalar(size);
      if (p.spin) p.sp.material.rotation += p.spin * dt;
      if (p.fade) p.sp.material.opacity = k < 0.6 ? k / 0.6 : 1;
    }

    for (const f of this.flames) {
      for (let i = 0; i < f.sprites.length; i++) {
        const sp = f.sprites[i];
        const n = Math.sin(this.time * (9 + i * 3.7) + f.seed + i * 1.8);
        const n2 = Math.sin(this.time * 17.3 + f.seed * 2 + i);
        sp.scale.set(0.62 * f.scale * (1 + n2 * 0.13), 0.72 * f.scale * (1 + n * 0.2), 1);
        sp.position.y = 0.1 * i + n * 0.03;
        sp.material.opacity = 0.75 + n2 * 0.2;
      }
      if (Math.random() < dt * 6) {
        this.spawnSprite({
          tex: this.texSoft, color: 0xff9a40,
          pos: f.group.position.clone().add(new THREE.Vector3(rand(-0.1, 0.1), 0.25, rand(-0.1, 0.1))),
          vel: new THREE.Vector3(rand(-0.2, 0.2), rand(0.8, 1.6), rand(-0.2, 0.2)),
          size: rand(0.05, 0.14), life: rand(0.4, 0.9),
        });
      }
    }

    // weapon trails: sample tip each frame while active
    for (const t of this.trails) {
      if (!t.active) { t.points.length = 0; continue; }
      const tip = t.getTipPos();
      if (tip) {
        this.spawnSprite({ tex: this.texSoft, color: t.color, pos: tip, size: 0.55, life: 0.16, grow: -0.5 });
      }
    }
  }
}
