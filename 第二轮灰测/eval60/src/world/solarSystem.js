/**
 * 太阳系：恒星（表面对流+日冕+耀斑）、八大行星（程序化贴图）、
 * 行星环、卫星、轨道参考线。
 * 所有天体都登记到 bodies[]，供 HUD 标记、雷达与碰撞使用。
 */
import * as THREE from 'three';
import { TAU } from '../util/math.js';
import { SKY_GLSL } from '../fx/skyGLSL.js';
import {
  planetTextureSet, cloudTexture, ringTexture, flareTexture,
} from '../util/textures.js';
import { ringGeometry } from '../util/geom.js';

const PLANETS = [
  {
    key: 'mercury', name: 'Mercury', cn: '水星', kind: 'rocky', radius: 105,
    orbit: 9200, period: 92, day: 42, tilt: 0.03, color: 0x9a9086,
  },
  {
    key: 'venus', name: 'Venus', cn: '金星', kind: 'rocky', radius: 215,
    orbit: 14200, period: 148, day: -110, tilt: 0.05, color: 0xe0c48a,
    atmosphere: { color: 0xffd9a0, size: 1.055, power: 2.4, strength: 0.9 },
  },
  {
    key: 'earth', name: 'Earth', cn: '地球', kind: 'earth', radius: 230,
    orbit: 20400, period: 220, day: 34, tilt: 0.409, color: 0x2a6ab0,
    clouds: true,
    atmosphere: { color: 0x6fb4ff, size: 1.045, power: 2.9, strength: 1.35 },
    moons: [{ name: 'Luna', cn: '月球', radius: 62, dist: 900, period: 46, pal: 'moon' }],
  },
  {
    key: 'mars', name: 'Mars', cn: '火星', kind: 'rocky', radius: 138,
    orbit: 27600, period: 300, day: 36, tilt: 0.44, color: 0xc1613a,
    atmosphere: { color: 0xffb08a, size: 1.03, power: 3.2, strength: 0.45 },
  },
  {
    key: 'jupiter', name: 'Jupiter', cn: '木星', kind: 'gas', radius: 920,
    orbit: 43000, period: 520, day: 16, tilt: 0.05, color: 0xd8b98c,
    atmosphere: { color: 0xffe0b0, size: 1.02, power: 3.0, strength: 0.55 },
    moons: [
      { name: 'Io', cn: '木卫一', radius: 58, dist: 1900, period: 40, pal: 'venus' },
      { name: 'Europa', cn: '木卫二', radius: 52, dist: 2500, period: 58, pal: 'moon' },
      { name: 'Ganymede', cn: '木卫三', radius: 76, dist: 3200, period: 82, pal: 'mercury' },
    ],
  },
  {
    key: 'saturn', name: 'Saturn', cn: '土星', kind: 'gas', radius: 790,
    orbit: 59000, period: 760, day: 18, tilt: 0.47, color: 0xe3cd9a,
    ring: { inner: 1.32, outer: 2.42 },
    moons: [{ name: 'Titan', cn: '土卫六', radius: 68, dist: 3400, period: 76, pal: 'venus' }],
  },
  {
    key: 'uranus', name: 'Uranus', cn: '天王星', kind: 'ice', radius: 400,
    orbit: 76000, period: 980, day: -24, tilt: 1.71, color: 0x9fe0e6,
    ring: { inner: 1.55, outer: 1.95, opacity: 0.32 },
    atmosphere: { color: 0xa9f0f6, size: 1.04, power: 3.0, strength: 0.7 },
  },
  {
    key: 'neptune', name: 'Neptune', cn: '海王星', kind: 'ice', radius: 385,
    orbit: 93000, period: 1180, day: 22, tilt: 0.49, color: 0x3f6cd0,
    atmosphere: { color: 0x7ba6ff, size: 1.04, power: 3.0, strength: 0.85 },
  },
];

export class SolarSystem {
  constructor({ quality = 'high' } = {}) {
    this.group = new THREE.Group();
    this.group.name = 'SolarSystem';
    this.bodies = [];
    this.time = 0;
    this.quality = quality;
    this.texSize = quality === 'low' ? 256 : quality === 'medium' ? 384 : 512;
    this.sunRadius = 3100;
    this._tmp = new THREE.Vector3();
    this._planets = [];
    this._moons = [];
  }

  /** 分步构建，便于加载进度提示。返回步骤函数数组。 */
  buildSteps() {
    const steps = [];
    steps.push({ label: '点燃恒星', fn: () => this._buildSun() });
    for (const def of PLANETS) {
      steps.push({ label: `生成${def.cn}`, fn: () => this._buildPlanet(def) });
    }
    steps.push({ label: '绘制轨道', fn: () => this._buildOrbits() });
    return steps;
  }

  /* --------------------------- 恒星 --------------------------- */
  _buildSun() {
    const R = this.sunRadius;
    this.sunUniforms = {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(0xfff6dd) },
      uColorB: { value: new THREE.Color(0xff9b2e) },
      uColorC: { value: new THREE.Color(0xff4d10) },
    };
    const surface = new THREE.ShaderMaterial({
      uniforms: this.sunUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vPos;
        void main(){
          vN = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uTime;
        uniform vec3 uColorA, uColorB, uColorC;
        varying vec3 vN;
        varying vec3 vPos;
        void main(){
          vec3 p = normalize(vPos);
          // 对流米粒组织：两层不同速度的噪声
          float n1 = skyFbm(p * 7.0 + vec3(0.0, uTime * 0.045, 0.0));
          float n2 = skyRidge(p * 15.0 - vec3(uTime * 0.06, 0.0, uTime * 0.03));
          float gran = n1 * 0.62 + n2 * 0.38;
          // 亮斑与暗子
          float spots = smoothstep(0.28, 0.02, skyFbm(p * 3.4 + 17.0));
          vec3 col = mix(uColorC, uColorB, smoothstep(0.25, 0.62, gran));
          col = mix(col, uColorA, smoothstep(0.6, 0.95, gran));
          col *= 1.0 - spots * 0.45;
          // 边缘变暗 + 边缘增亮的色球层
          float rim = 1.0 - abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0)));
          col *= mix(1.25, 0.72, pow(rim, 1.4));
          col += uColorB * pow(rim, 5.0) * 1.6;
          gl_FragColor = vec4(col * 3.0, 1.0);
        }
      `,
      toneMapped: true,
    });
    const sun = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), surface);
    sun.name = 'Sun';
    this.sunMesh = sun;
    this.group.add(sun);

    // 日冕：两层加法混合外壳
    this.coronaUniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffb45c) } };
    const corona = new THREE.ShaderMaterial({
      uniforms: this.coronaUniforms,
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPos = position;
          vN = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uTime; uniform vec3 uColor;
        varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        void main(){
          float f = 1.0 - abs(dot(normalize(vN), normalize(vView)));
          float n = skyFbm(normalize(vPos) * 5.0 + vec3(uTime * 0.08, uTime * 0.05, 0.0));
          float a = pow(f, 2.6) * (0.55 + 0.75 * n);
          gl_FragColor = vec4(uColor * a * 1.7, a * 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const coronaMesh = new THREE.Mesh(new THREE.SphereGeometry(R * 1.42, 48, 32), corona);
    coronaMesh.renderOrder = 5;
    this.group.add(coronaMesh);

    // 耀斑贴片（始终面向相机）
    const flare = flareTexture(256);
    if (flare) {
      const mat = new THREE.SpriteMaterial({
        map: flare, color: 0xffd9a0, blending: THREE.AdditiveBlending,
        transparent: true, depthWrite: false, depthTest: true, opacity: 0.55,
      });
      this.sunFlare = new THREE.Sprite(mat);
      this.sunFlare.scale.setScalar(R * 9);
      this.sunFlare.renderOrder = 6;
      this.group.add(this.sunFlare);
    }

    // 光源：无衰减，模拟“远方的太阳”
    this.sunLight = new THREE.PointLight(0xfff1d8, 5.2, 0, 0);
    this.group.add(this.sunLight);

    this.bodies.push({
      key: 'sun', name: 'Sun', cn: '太阳', type: 'star',
      radius: R, object: sun, position: new THREE.Vector3(0, 0, 0),
      color: 0xffcc66, hazard: 'heat',
    });
  }

  /* --------------------------- 行星 --------------------------- */
  _buildPlanet(def) {
    const segs = this.quality === 'low' ? 32 : this.quality === 'medium' ? 48 : 72;
    const tex = planetTextureSet(def.kind, def.key, def.radius + def.orbit, this.texSize);
    const mat = new THREE.MeshStandardMaterial({
      color: tex.map ? 0xffffff : def.color,
      map: tex.map,
      normalMap: tex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughness: def.kind === 'gas' || def.kind === 'ice' ? 0.85 : 0.95,
      metalness: 0.0,
      emissiveMap: tex.emissiveMap ?? null,
      emissive: tex.emissiveMap ? new THREE.Color(0xffd79a) : new THREE.Color(0x000000),
      emissiveIntensity: tex.emissiveMap ? 1.35 : 0,
    });

    const pivot = new THREE.Group();          // 公转
    const holder = new THREE.Group();         // 自转轴倾角
    holder.rotation.z = def.tilt;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(def.radius, segs, segs / 2), mat);
    mesh.name = def.name;
    holder.add(mesh);
    pivot.add(holder);
    this.group.add(pivot);

    // 云层
    let clouds = null;
    if (def.clouds) {
      const ct = cloudTexture(def.radius, this.texSize);
      if (ct) {
        clouds = new THREE.Mesh(
          new THREE.SphereGeometry(def.radius * 1.012, segs, segs / 2),
          new THREE.MeshStandardMaterial({
            map: ct, transparent: true, alphaMap: ct, depthWrite: false,
            roughness: 1, metalness: 0, opacity: 0.9,
          }),
        );
        clouds.renderOrder = 1;
        holder.add(clouds);
      }
    }

    // 大气辉光
    if (def.atmosphere) {
      const a = def.atmosphere;
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(def.radius * a.size, segs, segs / 2),
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(a.color) },
            uPower: { value: a.power },
            uStrength: { value: a.strength },
            uSun: { value: new THREE.Vector3(0, 0, 0) },
          },
          vertexShader: /* glsl */ `
            varying vec3 vN; varying vec3 vView; varying vec3 vW;
            void main(){
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vW = wp.xyz;
              vN = normalize(mat3(modelMatrix) * normal);
              vView = normalize(cameraPosition - wp.xyz);
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: /* glsl */ `
            precision mediump float;
            uniform vec3 uColor; uniform float uPower; uniform float uStrength; uniform vec3 uSun;
            varying vec3 vN; varying vec3 vView; varying vec3 vW;
            void main(){
              float f = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), uPower);
              vec3 L = normalize(uSun - vW);
              float lit = clamp(dot(normalize(vN), L) * 1.6 + 0.35, 0.0, 1.0);
              float a = f * uStrength * lit;
              gl_FragColor = vec4(uColor * a * 1.5, a);
            }
          `,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.BackSide,
        }),
      );
      atmo.renderOrder = 2;
      holder.add(atmo);
      this._atmos = this._atmos ?? [];
      this._atmos.push(atmo);
    }

    // 行星环
    if (def.ring) {
      const rt = ringTexture(def.radius, 1024);
      const ringMat = new THREE.MeshBasicMaterial({
        map: rt, color: 0xffffff, transparent: true, side: THREE.DoubleSide,
        depthWrite: false, opacity: def.ring.opacity ?? 0.95,
        blending: THREE.NormalBlending,
      });
      const ring = new THREE.Mesh(
        ringGeometry(def.radius * def.ring.inner, def.radius * def.ring.outer, 256),
        ringMat,
      );
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 3;
      holder.add(ring);
    }

    const body = {
      key: def.key, name: def.name, cn: def.cn, type: 'planet',
      radius: def.radius, object: mesh, position: new THREE.Vector3(),
      color: def.color, def,
    };
    this.bodies.push(body);
    this._planets.push({
      def, pivot, holder, mesh, clouds, body,
      angle: (def.orbit * 0.00037) % TAU + def.radius * 0.01,
    });

    // 卫星
    for (const m of def.moons ?? []) {
      const mt = planetTextureSet('rocky', m.pal ?? 'moon', m.radius * 7, Math.max(128, this.texSize / 2));
      const mm = new THREE.Mesh(
        new THREE.SphereGeometry(m.radius, Math.max(20, segs / 2), Math.max(10, segs / 4)),
        new THREE.MeshStandardMaterial({
          color: mt.map ? 0xffffff : 0xbbbbbb, map: mt.map, normalMap: mt.normalMap,
          roughness: 0.95, metalness: 0,
        }),
      );
      mm.name = m.name;
      const mPivot = new THREE.Group();
      mPivot.add(mm);
      mPivot.rotation.x = (m.dist % 7) * 0.04;
      holder.add(mPivot);
      const mBody = {
        key: `${def.key}-${m.name}`, name: m.name, cn: m.cn, type: 'moon',
        radius: m.radius, object: mm, position: new THREE.Vector3(), color: 0xaaaaaa,
      };
      this.bodies.push(mBody);
      this._moons.push({ def: m, pivot: mPivot, mesh: mm, body: mBody, angle: m.dist });
    }
  }

  /* --------------------------- 轨道线 --------------------------- */
  _buildOrbits() {
    const pts = [];
    const N = 256;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.orbitLines = new THREE.Group();
    for (const def of PLANETS) {
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x5f86b8, transparent: true, opacity: 0.14, depthWrite: false,
        }),
      );
      line.scale.setScalar(def.orbit);
      this.orbitLines.add(line);
    }
    this.group.add(this.orbitLines);
  }

  /** 太阳系整体位置（用于把飞船放在地球附近等） */
  getBody(key) {
    return this.bodies.find((b) => b.key === key);
  }

  update(dt, camera) {
    this.time += dt;
    if (this.sunUniforms) this.sunUniforms.uTime.value = this.time;
    if (this.coronaUniforms) this.coronaUniforms.uTime.value = this.time;

    // 太阳耀斑随距离缩放，避免近距离糊屏
    if (this.sunFlare && camera) {
      const d = camera.position.distanceTo(this.group.position);
      const k = THREE.MathUtils.clamp(d / (this.sunRadius * 12), 0.35, 3.2);
      this.sunFlare.scale.setScalar(this.sunRadius * 7.5 * k);
    }

    for (const p of this._planets) {
      p.angle += (TAU / p.def.period) * dt;
      const x = Math.cos(p.angle) * p.def.orbit;
      const z = Math.sin(p.angle) * p.def.orbit;
      p.pivot.position.set(x, 0, z);
      p.mesh.rotation.y += (TAU / p.def.day) * dt;
      if (p.clouds) p.clouds.rotation.y += (TAU / (p.def.day * 1.6)) * dt;
      p.mesh.getWorldPosition(p.body.position);
    }
    for (const m of this._moons) {
      m.angle += (TAU / m.def.period) * dt;
      m.mesh.position.set(
        Math.cos(m.angle) * m.def.dist, 0, Math.sin(m.angle) * m.def.dist,
      );
      m.mesh.rotation.y += (TAU / (m.def.period * 1.2)) * dt;
      m.mesh.getWorldPosition(m.body.position);
    }
    for (const a of this._atmos ?? []) {
      a.material.uniforms.uSun.value.copy(this.group.position);
    }
  }
}
