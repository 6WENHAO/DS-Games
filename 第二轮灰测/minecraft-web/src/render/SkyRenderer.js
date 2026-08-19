/* =====================================================================
 * SkyRenderer — 天空穹顶、太阳、月亮、星空、云层、雾色
 * ===================================================================== */
import { Program, Mesh } from './GL.js';
import {
  skyVS, skyFS, celestialVS, celestialFS, starVS, starFS, cloudVS, cloudFS,
} from './Shaders.js';
import { Rng } from '../math/Random.js';
import { clamp01, lerp, mixColor, hexToRgb } from '../math/MathUtils.js';
import * as Mat4 from '../math/Mat4.js';

/** 天空颜色关键帧（按一天的比例 0..1） */
const SKY_KEYS = [
  { t: 0.00, zenith: '#3f5f96', horizon: '#ff9a52' },   // 日出 (0)
  { t: 0.06, zenith: '#4a86d8', horizon: '#c9e2ff' },
  { t: 0.25, zenith: '#4a90e2', horizon: '#a8cfff' },   // 正午 (6000)
  { t: 0.44, zenith: '#4a86d8', horizon: '#cfe4ff' },
  { t: 0.50, zenith: '#39548f', horizon: '#ff7a3c' },   // 日落 (12000)
  { t: 0.55, zenith: '#1b2747', horizon: '#5e4a6b' },
  { t: 0.60, zenith: '#0a1226', horizon: '#141c33' },
  { t: 0.75, zenith: '#050a17', horizon: '#0b1224' },   // 午夜 (18000)
  { t: 0.92, zenith: '#0d1730', horizon: '#2a2f52' },
  { t: 0.97, zenith: '#2a3f6b', horizon: '#8a5a5c' },
  { t: 1.00, zenith: '#3f5f96', horizon: '#ff9a52' },
];
const SKY_RGB = SKY_KEYS.map(k => ({ t: k.t, zenith: hexToRgb(k.zenith), horizon: hexToRgb(k.horizon) }));

export class SkyRenderer {
  constructor(glc, atlas) {
    this.glc = glc;
    this.atlas = atlas;
    const gl = glc.gl;

    this.skyProgram = new Program(glc, skyVS, skyFS, 'sky');
    this.celestialProgram = new Program(glc, celestialVS, celestialFS, 'celestial');
    this.starProgram = new Program(glc, starVS, starFS, 'star');
    this.cloudProgram = new Program(glc, cloudVS, cloudFS, 'cloud');

    // 全屏三角形
    this.skyMesh = new Mesh(glc, [{ name: 'aPos', size: 2, offset: 0, stride: 8 }]);
    this.skyMesh.upload(this.skyProgram, new Float32Array([
      -1, -1, 3, -1, -1, 3,
    ]));

    // 天体四边形
    this.quadMesh = new Mesh(glc, [
      { name: 'aPos', size: 3, offset: 0, stride: 20 },
      { name: 'aUV', size: 2, offset: 12, stride: 20 },
    ]);
    this.quadMesh.upload(this.celestialProgram, new Float32Array([
      -1, -1, 0, 0, 1,
      1, -1, 0, 1, 1,
      1, 1, 0, 1, 0,
      -1, -1, 0, 0, 1,
      1, 1, 0, 1, 0,
      -1, 1, 0, 0, 0,
    ]));

    // 星空
    const rng = new Rng(0xC0FFEE);
    const STARS = 1800;
    const starData = new Float32Array(STARS * 4);
    for (let i = 0; i < STARS; i++) {
      let x, y, z, l;
      do {
        x = rng.range(-1, 1); y = rng.range(-1, 1); z = rng.range(-1, 1);
        l = Math.hypot(x, y, z);
      } while (l < 0.15 || l > 1);
      starData[i * 4] = x / l;
      starData[i * 4 + 1] = y / l;
      starData[i * 4 + 2] = z / l;
      starData[i * 4 + 3] = rng.range(0.4, 1.6);
    }
    this.starMesh = new Mesh(glc, [
      { name: 'aPos', size: 3, offset: 0, stride: 16 },
      { name: 'aSize', size: 1, offset: 12, stride: 16 },
    ]);
    this.starMesh.upload(this.starProgram, starData);
    this.starCount = STARS;

    // 云平面
    this.cloudMesh = new Mesh(glc, [{ name: 'aPos', size: 2, offset: 0, stride: 8 }]);
    this.cloudMesh.upload(this.cloudProgram, new Float32Array([
      -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5,
    ]));

    this.sunLayer = atlas.layer('sun');
    this.moonLayer = atlas.layer('moon');

    // 输出给其他系统使用
    this.fogColor = new Float32Array([0.7, 0.8, 0.95]);
    this.skyColor = new Float32Array([0.4, 0.6, 0.9]);
    this.sunDir = new Float32Array([0, 1, 0]);
    this.nightFactor = 0;
    void gl;
  }

  /** 更新颜色与天体方向 */
  update(world, camera, biomeFog = null) {
    const t = world.dayFraction;
    const { zenith, horizon } = sampleSky(t);

    // 天气压暗
    let dim = 1;
    if (world.weather === 'rain') dim = 0.72;
    else if (world.weather === 'thunder') dim = 0.5;

    const zen = [zenith[0] * dim, zenith[1] * dim, zenith[2] * dim];
    let hor = [horizon[0] * dim, horizon[1] * dim, horizon[2] * dim];

    // 生物群系雾色微调
    if (biomeFog) hor = mixColor(hor, biomeFog, 0.22 * world.daylight);

    this.skyColor.set(zen);
    this.fogColor.set(mixColor(hor, zen, 0.25));

    const a = t * Math.PI * 2;
    const sx = Math.cos(a), sy = Math.sin(a);
    const len = Math.hypot(sx, sy, 0.18);
    this.sunDir[0] = sx / len; this.sunDir[1] = sy / len; this.sunDir[2] = 0.18 / len;

    this.nightFactor = clamp01(1 - world.daylight * 1.6);
    void camera;
  }

  render(world, camera, underwater) {
    const glc = this.glc, gl = glc.gl;

    // ---------- 天空渐变 ----------
    glc.setDepthTest(false);
    glc.setDepthMask(false);
    glc.setBlend(false);
    const inv = Mat4.create();
    // 只用旋转部分（相机在原点）
    const viewNoTrans = Mat4.copy(Mat4.create(), camera.view);
    viewNoTrans[12] = viewNoTrans[13] = viewNoTrans[14] = 0;
    const vp = Mat4.multiply(Mat4.create(), camera.proj, viewNoTrans);
    Mat4.invert(inv, vp);

    this.skyProgram.use()
      .m4('uInvVP', inv)
      .v3('uZenith', this.skyColor)
      .v3('uHorizon', this.fogColor)
      .v3('uSunDir', this.sunDir)
      .v3('uSunColor', 1.0, 0.92, 0.75)
      .f('uNight', this.nightFactor)
      .f('uUnderwater', underwater ? 1 : 0);
    this.skyMesh.draw();

    if (underwater) {
      glc.setDepthTest(true);
      glc.setDepthMask(true);
      return;
    }

    // ---------- 星星 ----------
    if (this.nightFactor > 0.02) {
      glc.setBlend(true, gl.SRC_ALPHA, gl.ONE);
      this.starProgram.use()
        .m4('uProj', camera.proj)
        .m4('uView', viewNoTrans)
        .f('uScale', 1.6 * Math.min(2, glc.pixelRatio))
        .f('uOpacity', this.nightFactor * 0.9);
      this.starMesh.draw(gl.POINTS);
    }

    // ---------- 太阳 / 月亮 ----------
    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.atlas.bind(0);
    const cp = this.celestialProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', viewNoTrans)
      .i('uTex', 0)
      .f('uDistance', 150);

    cp.v3('uCenter', this.sunDir[0], this.sunDir[1], this.sunDir[2])
      .f('uSize', 14)
      .f('uLayer', this.sunLayer)
      .v4('uTint', 1, 1, 1, 1);
    this.quadMesh.draw();

    cp.v3('uCenter', -this.sunDir[0], -this.sunDir[1], -this.sunDir[2])
      .f('uSize', 9)
      .f('uLayer', this.moonLayer)
      .v4('uTint', 1, 1, 1, clamp01(this.nightFactor * 1.4));
    this.quadMesh.draw();

    glc.setDepthTest(true);
    glc.setDepthMask(true);
  }

  renderClouds(world, camera, farPlane, opacity = 1) {
    if (opacity <= 0.01) return;
    const glc = this.glc, gl = glc.gl;
    glc.setBlend(true, gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    glc.setDepthMask(false);
    glc.setCull(false);
    this.atlas.bindCloud(1);
    const bright = 0.55 + 0.45 * world.daylight;
    this.cloudProgram.use()
      .m4('uProj', camera.proj)
      .m4('uView', camera.view)
      .v3('uCamera', camera.eye[0], camera.eye[1], camera.eye[2])
      .f('uHeight', 122)
      .f('uSize', Math.max(600, farPlane * 2.4))
      .i('uTex', 1)
      .f('uTime', performance.now() * 0.001)
      .v3('uColor', bright, bright, bright * 1.02)
      .v3('uFogColor', this.fogColor)
      .f('uFogEnd', farPlane * 1.6)
      .f('uOpacity', opacity * 0.92);
    this.cloudMesh.draw();
    glc.setDepthMask(true);
    glc.setCull(true);
    const glr = this.glc.gl;
    glr.activeTexture(glr.TEXTURE0);
  }
}

/** 在关键帧之间插值天空颜色 */
function sampleSky(t) {
  t = ((t % 1) + 1) % 1;
  let i = 0;
  while (i < SKY_RGB.length - 1 && SKY_RGB[i + 1].t < t) i++;
  const a = SKY_RGB[i], b = SKY_RGB[Math.min(i + 1, SKY_RGB.length - 1)];
  const span = Math.max(1e-5, b.t - a.t);
  const f = clamp01((t - a.t) / span);
  return {
    zenith: mixColor(a.zenith, b.zenith, f),
    horizon: mixColor(a.horizon, b.horizon, f),
  };
}

export { sampleSky, lerp };
