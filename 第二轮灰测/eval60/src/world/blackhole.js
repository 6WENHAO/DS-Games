/**
 * 黑洞：广义相对论近似的光线弯折（逐像素测地线积分）
 *  - 事件视界（纯黑剪影）
 *  - 吸积盘：开普勒旋转 + 多普勒集束 + 引力红移 + 湍流条带
 *  - 引力透镜：把背景星空绕过视界，自然形成爱因斯坦环与盘的“顶部回环”
 *  - 极区相对论喷流
 *  - 对飞船施加真实引力（可玩性：会被拉进去）
 *
 * 关键实现：面向相机的公告板 + premultipliedAlpha 混合，
 * rgb = 盘发光 + 弯折星空 * mask，alpha = mask，
 * 于是边缘处 mask→0 与真实天空球无缝衔接，且能被前方物体正常遮挡。
 */
import * as THREE from 'three';
import { SKY_GLSL } from '../fx/skyGLSL.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m3 = new THREE.Matrix3();

export class BlackHole {
  /**
   * @param {object} o
   * @param {THREE.Vector3} o.position 世界坐标
   * @param {number} o.rs 史瓦西半径（世界单位）
   * @param {number} o.steps 积分步数（画质）
   */
  constructor({
    position = new THREE.Vector3(),
    rs = 900,
    diskIn = 3.15,
    diskOut = 9.0,
    steps = 110,
    tilt = new THREE.Vector3(0.22, 1.0, 0.16),
  } = {}) {
    this.position = position.clone();
    this.rs = rs;
    this.diskIn = diskIn;   // 以 rs 为单位
    this.diskOut = diskOut;
    this.mu = 1.44e10;      // 引力参数（游戏性调校）
    this.group = new THREE.Group();
    this.group.name = 'BlackHole';
    this.group.position.copy(this.position);

    // 盘面朝向（局部 Y 轴）
    this.diskNormal = tilt.clone().normalize();
    const right = new THREE.Vector3(1, 0, 0);
    if (Math.abs(right.dot(this.diskNormal)) > 0.9) right.set(0, 0, 1);
    const fwd = new THREE.Vector3().crossVectors(right, this.diskNormal).normalize();
    right.crossVectors(this.diskNormal, fwd).normalize();
    this.l2w = new THREE.Matrix3().set(
      right.x, this.diskNormal.x, fwd.x,
      right.y, this.diskNormal.y, fwd.y,
      right.z, this.diskNormal.z, fwd.z,
    );
    this.w2l = new THREE.Matrix3().copy(this.l2w).transpose();

    this.influence = Math.max(this.diskOut * 1.55, 26); // rs 单位
    const half = this.influence * 1.06 * rs;

    this.uniforms = {
      uTime: { value: 0 },
      uRo: { value: new THREE.Vector3() },
      uW2L: { value: new THREE.Matrix3() },
      uL2W: { value: new THREE.Matrix3() },
      uDiskIn: { value: this.diskIn },
      uDiskOut: { value: this.diskOut },
      uInfluence: { value: this.influence },
      uEscape: { value: 200 },
      uDiskBright: { value: 1.0 },
      uStepScale: { value: 1.0 },
    };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      defines: { LENS_STEPS: String(Math.max(24, Math.round(steps))) },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        ${SKY_GLSL}
        uniform float uTime;
        uniform vec3  uRo;        // 相机位置（黑洞局部系, 单位 rs）
        uniform mat3  uW2L;
        uniform mat3  uL2W;
        uniform float uDiskIn;
        uniform float uDiskOut;
        uniform float uInfluence;
        uniform float uEscape;
        uniform float uDiskBright;
        uniform float uStepScale;
        varying vec3 vWorld;

        // 吸积盘发光：温度梯度 + 湍流 + 多普勒集束 + 引力红移
        vec3 diskEmission(vec3 hit, vec3 rayDir){
          float r = length(hit.xz);
          float t = clamp((r - uDiskIn) / max(0.001, uDiskOut - uDiskIn), 0.0, 1.0);
          float ang = atan(hit.z, hit.x);
          float orb = uTime * 2.6 / pow(max(r, 1.0), 1.5);

          vec3 q = vec3(cos(ang - orb), log(max(r, 1.0)) * 1.25, sin(ang - orb)) * 2.6;
          float turb = skyFbm(q * 1.7 + 4.0);
          float bands = 0.52 + 0.48 * sin(log(max(r, 1.0)) * 26.0 + turb * 8.0 - orb * 1.4);
          float dens = pow(1.0 - t, 1.25) * (0.35 + 0.85 * bands) * (0.45 + 0.9 * turb);
          // 内外边缘柔化
          dens *= smoothstep(0.0, 0.09, t) * (1.0 - smoothstep(0.72, 1.0, t));

          vec3 hot  = vec3(1.00, 0.97, 0.92);
          vec3 warm = vec3(1.00, 0.62, 0.22);
          vec3 cool = vec3(0.72, 0.19, 0.05);
          vec3 col = mix(hot, warm, smoothstep(0.0, 0.34, t));
          col = mix(col, cool, smoothstep(0.34, 1.0, t));

          // 开普勒轨道速度（单位 c）→ 多普勒集束（钳制在可成像范围内）
          float beta = clamp(sqrt(0.5 / max(r, 1.2)), 0.0, 0.62);
          vec3 vdir = normalize(cross(vec3(0.0, 1.0, 0.0), hit));
          float mu = dot(vdir, -rayDir);
          float dop = clamp(1.0 / pow(max(0.24, 1.0 - beta * mu), 3.0), 0.22, 5.0);
          float redshift = sqrt(max(0.05, 1.0 - 1.0 / max(r, 1.05)));

          return col * dens * dop * redshift * uDiskBright * 0.42;
        }

        void main(){
          vec3 rdW = normalize(vWorld - cameraPosition);
          vec3 rd = normalize(uW2L * rdW);
          vec3 ro = uRo;

          float tc = -dot(ro, rd);
          vec3 closest = ro + rd * tc;
          float bImp = length(closest);

          vec3 disk = vec3(0.0);
          float transmit = 1.0;      // 吸积盘是光学厚介质：穿过一次就基本挡光
          bool captured = false;
          vec3 escDir = rd;

          float R = uInfluence;
          float cc = dot(ro, ro) - R * R;
          float disc = tc * tc - cc;

          if (disc <= 0.0 && cc > 0.0){
            // 完全掠过影响球：弱场解析偏折
            vec3 perp = closest;
            float pl = length(perp);
            if (pl > 0.0001){
              float alpha = 2.0 / max(bImp, 1.5);
              escDir = normalize(rd - normalize(perp) * alpha);
            }
          } else {
            // 进入影响球：逐步积分测地线
            vec3 p = ro;
            if (cc > 0.0){
              float tEnter = tc - sqrt(max(disc, 0.0));
              if (tEnter > 0.0) p = ro + rd * (tEnter * 0.999);
            }
            vec3 v = rd;
            vec3 L = cross(p, v);
            float h2 = dot(L, L);

            for (int i = 0; i < LENS_STEPS; i++){
              float r = length(p);
              if (r < 1.008){ captured = true; break; }
              if (r > uEscape && dot(p, v) > 0.0) break;
              if (transmit < 0.02) break;   // 已被盘挡住，无需继续

              float dt = clamp(r * 0.105, 0.02, 3.2) * uStepScale;
              // 靠近盘面时收紧步长，保证穿越检测精确
              if (length(p.xz) < uDiskOut * 1.35){
                dt = min(dt, max(0.055, abs(p.y) * 0.55 + 0.055));
              }

              vec3 prev = p;
              vec3 acc = -1.5 * h2 * p / pow(r, 5.0);
              v += acc * dt;
              p += v * dt;

              if (prev.y * p.y < 0.0){
                float k = prev.y / (prev.y - p.y);
                vec3 hit = mix(prev, p, k);
                float rr = length(hit.xz);
                if (rr > uDiskIn && rr < uDiskOut){
                  disk += diskEmission(hit, normalize(p - prev)) * transmit;
                  transmit *= 0.10;
                }
              }
            }
            escDir = normalize(v);
          }

          float mask = clamp(2.4 / max(bImp, 1.0), 0.0, 1.0);
          vec3 col = disk;
          if (captured) {
            mask = 1.0;               // 事件视界：纯黑剪影
          } else {
            col += skyColor(normalize(uL2W * escDir)) * mask * transmit;
          }
          // premultiplied alpha：rgb 已是“发出的光”，alpha 表示遮挡了多少真实背景
          float alpha = clamp(max(mask, 1.0 - transmit), 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: true,
    });

    this.lens = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), this.material);
    this.lens.frustumCulled = false;
    this.lens.renderOrder = 20;
    this.group.add(this.lens);

    // 相对论喷流（极区）
    this.jetMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x77ccff) } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vPos;
        void main(){
          vUv = uv; vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        ${SKY_GLSL}
        uniform float uTime;
        uniform vec3 uColor;
        varying vec2 vUv;
        varying vec3 vPos;
        void main(){
          float along = clamp(vUv.y, 0.0, 1.0);
          float n = skyFbm(vec3(vUv.x * 6.0, along * 5.0 - uTime * 0.55, 2.0));
          float core = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 2.2);
          float fade = pow(1.0 - along, 1.6) * smoothstep(0.0, 0.06, along);
          float a = core * fade * (0.35 + 0.9 * n);
          vec3 c = mix(uColor, vec3(1.0), core * 0.65);
          gl_FragColor = vec4(c * a * 1.5, a * 0.75);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const jetLen = rs * 46;
    const jetGeo = new THREE.CylinderGeometry(rs * 0.5, rs * 5.5, jetLen, 22, 1, true);
    jetGeo.translate(0, jetLen * 0.5, 0);
    const jetA = new THREE.Mesh(jetGeo, this.jetMaterial);
    const jetB = new THREE.Mesh(jetGeo, this.jetMaterial);
    jetB.rotation.z = Math.PI;
    this.jets = new THREE.Group();
    this.jets.add(jetA, jetB);
    this.jets.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.diskNormal);
    this.group.add(this.jets);

    this.uniforms.uW2L.value.copy(this.w2l);
    this.uniforms.uL2W.value.copy(this.l2w);
  }

  setQuality(steps, stepScale = 1) {
    this.material.defines.LENS_STEPS = String(Math.max(20, Math.round(steps)));
    this.uniforms.uStepScale.value = stepScale;
    this.material.needsUpdate = true;
  }

  update(dt, camera) {
    this.uniforms.uTime.value += dt;
    this.jetMaterial.uniforms.uTime.value = this.uniforms.uTime.value;

    // 公告板始终面向相机
    this.lens.quaternion.copy(camera.quaternion);

    _v.copy(camera.position).sub(this.position).divideScalar(this.rs);
    _v.applyMatrix3(this.w2l);
    this.uniforms.uRo.value.copy(_v);
    this.uniforms.uEscape.value = Math.max(_v.length() * 1.25 + this.diskOut * 2.0, this.influence * 1.6);
  }

  /** 距离（世界单位） */
  distanceTo(pos) {
    return pos.distanceTo(this.position);
  }

  /** 引力加速度，累加到 out */
  addGravity(pos, out) {
    _v.copy(this.position).sub(pos);
    const r2 = Math.max(_v.lengthSq(), this.rs * this.rs * 0.25);
    out.addScaledVector(_v.normalize(), this.mu / r2);
    return out;
  }

  /** 0 = 安全, 1 = 已被吞没 */
  dangerLevel(pos) {
    const d = this.distanceTo(pos);
    const start = this.rs * 30;
    if (d > start) return 0;
    return Math.min(1, (start - d) / (start - this.rs * 1.35));
  }

  isConsumed(pos) {
    return this.distanceTo(pos) < this.rs * 1.15;
  }
}
