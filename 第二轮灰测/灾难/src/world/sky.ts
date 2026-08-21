import * as THREE from 'three';
import { Rng } from '../core/rng';
import { clamp, damp } from '../core/rng';

const SKY_TOP_CLEAR = new THREE.Color(0x3f9be0);
const SKY_HOR_CLEAR = new THREE.Color(0xbadff5);
const SKY_TOP_STORM = new THREE.Color(0x25303f);
const SKY_HOR_STORM = new THREE.Color(0x5a6371);
const FOG_CLEAR = new THREE.Color(0xc4e2f5);
const FOG_STORM = new THREE.Color(0x5f6874);
const SUN_CLEAR = new THREE.Color(0xffeec8);
const SUN_STORM = new THREE.Color(0xa8b3c2);

const SUN_BASE = 2.72;
const FILL_BASE = 0.5;
const HEMI_BASE = 1.02;

/**
 * Sky dome, drifting voxel clouds, sun + ambient rig and the shared weather
 * state (clear <-> storm) that several disasters push around.
 */
export class Sky {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly fill: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly clouds: THREE.InstancedMesh;

  /** 0 = bright day, 1 = full storm. */
  storm = 0;
  private stormTarget = 0;
  private sunBoost = 0;
  private cloudSpeed = 1;
  private time = 0;

  private uniforms = {
    uTop: { value: SKY_TOP_CLEAR.clone() },
    uHorizon: { value: SKY_HOR_CLEAR.clone() },
    uSunDir: { value: new THREE.Vector3(0.42, 0.62, 0.28).normalize() },
    uSunColor: { value: new THREE.Color(0xffe9b8) },
  };

  private cloudData: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; drift: number }> = [];
  private mtx = new THREE.Matrix4();

  constructor(
    private readonly scene: THREE.Scene,
    cloudClusters: number,
  ) {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(620, 32, 20),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: `
          varying vec3 vDir;
          void main() {
            vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: `
          uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
          varying vec3 vDir;
          void main() {
            float h = clamp( vDir.y * 1.1, 0.0, 1.0 );
            vec3 c = mix( uHorizon, uTop, pow( h, 0.62 ) );
            float sd = max( dot( normalize( vDir ), normalize( uSunDir ) ), 0.0 );
            c += uSunColor * pow( sd, 220.0 ) * 2.4;
            c += uSunColor * pow( sd, 5.0 ) * 0.10;
            gl_FragColor = vec4( c, 1.0 );
          }`,
      }),
    );
    dome.renderOrder = -1000;
    dome.frustumCulled = false;
    this.group.add(dome);

    this.hemi = new THREE.HemisphereLight(0xcbe8ff, 0x86ae72, HEMI_BASE);
    this.sun = new THREE.DirectionalLight(0xfff3dc, SUN_BASE);
    this.sun.position.set(78, 116, 52);
    this.sun.target.position.set(0, 0, 0);
    this.fill = new THREE.DirectionalLight(0xd8e8ff, FILL_BASE);
    this.fill.position.set(-70, 54, -86);
    this.group.add(this.hemi, this.sun, this.sun.target, this.fill);

    // ---- voxel clouds. Two bands: a distant low deck that sits inside the
    // oblique camera's view cone (so clouds are actually visible above the
    // model) and a high deck for when the player tilts toward the horizon.
    const rng = new Rng(551234);
    const boxes: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number; drift: number }> = [];
    for (let c = 0; c < cloudClusters; c++) {
      const low = c % 5 !== 0;
      const a = rng.range(0, Math.PI * 2);
      const rad = low ? rng.range(170, 400) : rng.range(150, 430);
      const cx = Math.cos(a) * rad;
      const cy = low ? rng.range(34, 64) : rng.range(92, 156);
      const cz = Math.sin(a) * rad;
      const drift = rng.range(0.55, 1.5);
      const puffs = rng.int(5, 9);
      for (let p = 0; p < puffs; p++) {
        const s = rng.range(15, 36);
        boxes.push({
          x: cx + rng.range(-24, 24),
          y: cy + rng.range(-5, 7),
          z: cz + rng.range(-20, 20),
          sx: s,
          sy: s * rng.range(0.3, 0.5),
          sz: s * rng.range(0.7, 1.1),
          drift,
        });
      }
    }
    this.cloudData = boxes;
    this.clouds = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.94 }),
      boxes.length,
    );
    this.clouds.frustumCulled = false;
    this.clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.clouds);
    this.writeClouds();

    scene.fog = new THREE.Fog(FOG_CLEAR.getHex(), 210, 640);
    scene.add(this.group);
  }

  private writeClouds(): void {
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      this.mtx.makeScale(c.sx, c.sy, c.sz);
      this.mtx.setPosition(c.x, c.y, c.z);
      this.clouds.setMatrixAt(i, this.mtx);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  setStorm(t: number): void {
    this.stormTarget = clamp(t, 0, 1);
  }

  /** Temporary sun/ambient over-brighten used by nuclear + lightning flashes. */
  pulseSun(amount: number): void {
    this.sunBoost = Math.max(this.sunBoost, amount);
  }

  reset(): void {
    this.stormTarget = 0;
    this.storm = 0;
    this.sunBoost = 0;
    this.applyWeather();
  }

  private applyWeather(): void {
    const s = this.storm;
    this.uniforms.uTop.value.copy(SKY_TOP_CLEAR).lerp(SKY_TOP_STORM, s);
    this.uniforms.uHorizon.value.copy(SKY_HOR_CLEAR).lerp(SKY_HOR_STORM, s);
    this.uniforms.uSunColor.value.copy(SUN_CLEAR).lerp(SUN_STORM, s);
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.color.copy(FOG_CLEAR).lerp(FOG_STORM, s);
      fog.near = 210 - 90 * s;
      fog.far = 640 - 260 * s;
    }
    this.sun.intensity = (SUN_BASE - SUN_BASE * 0.72 * s) * (1 + this.sunBoost * 3.4);
    this.fill.intensity = (FILL_BASE - FILL_BASE * 0.4 * s) * (1 + this.sunBoost * 2);
    this.hemi.intensity = (HEMI_BASE - HEMI_BASE * 0.4 * s) * (1 + this.sunBoost * 1.9);
    this.cloudSpeed = 1 + s * 5.5;
    const cm = this.clouds.material as THREE.MeshLambertMaterial;
    cm.color.setRGB(1 - 0.55 * s, 1 - 0.52 * s, 1 - 0.44 * s);
  }

  update(dt: number, simDt: number): void {
    this.time += simDt;
    this.storm = damp(this.storm, this.stormTarget, 1.4, dt);
    if (this.sunBoost > 0.0001) this.sunBoost = damp(this.sunBoost, 0, 9, dt);
    else this.sunBoost = 0;
    this.applyWeather();

    const span = 900;
    let moved = false;
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i];
      c.x += simDt * 3.1 * c.drift * this.cloudSpeed;
      if (c.x > span / 2) c.x -= span;
      moved = true;
    }
    if (moved) this.writeClouds();
  }
}
