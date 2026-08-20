// Weather + time of day.
//
// Every preset is a complete "look": sun, sky, clouds, fog, wind, palette and grade.
// The system cross-fades between them, so a change of weather sweeps across the whole
// image at once — the sky, the shadows on the meadow, the colour of the grass.

import * as THREE from 'three';
import { U } from './uniforms.js';

const preset = (key, name, sub, hold, num, col) => ({ key, name, sub, hold, num, col });

export const PRESETS = [
  preset('dawn', '晓雾', 'DAWN MIST', 62, {
    sunElev: 5.5, sunAzim: 104, sunIntensity: 1.45, sunGlow: 1.55, stars: 0.10,
    cloudThresh: 0.665, cloudDensity: 1.05, cloudSpeed: 0.55, cloudShadow: 0.62, cloudAbsorb: 0.95,
    fogDensity: 1.65, fogHeight: 17, fogGround: 2.5,
    wind: 0.42, windSpeed: 0.65, rain: 0, wet: 0.06,
    exposure: 1.06, sat: 1.06, bloom: 1.25, flowerGlow: 0.22, motes: 0.75, lift: 0.02,
  }, {
    sunColor: 0xffc492, skyTop: 0x3c62a0, skyHorizon: 0xf6c69c, skyHaze: 0xead3bd,
    ambSky: 0x93aed2, ambGround: 0x5c5641, fogColor: 0xecdcc8, mistColor: 0xf6ebdc,
    grassDry: 0xb0ab6c, grassLush: 0x74b551, grassDeep: 0x2b5030, grassTip: 0xdcdd93,
    earth: 0x6d5a41, petalTint: 0xffdbe4,
  }),

  preset('clear', '晴光', 'CLEAR NOON', 78, {
    sunElev: 58, sunAzim: 140, sunIntensity: 2.05, sunGlow: 0.85, stars: 0,
    cloudThresh: 0.680, cloudDensity: 1.05, cloudSpeed: 0.8, cloudShadow: 0.72, cloudAbsorb: 1.0,
    fogDensity: 0.72, fogHeight: 30, fogGround: 0.55,
    wind: 0.72, windSpeed: 1.0, rain: 0, wet: 0,
    exposure: 1.0, sat: 1.12, bloom: 1.0, flowerGlow: 0.0, motes: 1.0, lift: 0.012,
  }, {
    sunColor: 0xfff0d2, skyTop: 0x2a6ec4, skyHorizon: 0xbfdcf0, skyHaze: 0xd6e6ee,
    ambSky: 0x8ab6e2, ambGround: 0x62784a, fogColor: 0xd2e4ee, mistColor: 0xe8f3f6,
    grassDry: 0xa3b166, grassLush: 0x6ec04b, grassDeep: 0x2f6b34, grassTip: 0xd6ea8a,
    earth: 0x6f5d43, petalTint: 0xffd7e2,
  }),

  preset('windy', '风起', 'RISING WIND', 58, {
    sunElev: 44, sunAzim: 172, sunIntensity: 1.85, sunGlow: 0.95, stars: 0,
    cloudThresh: 0.675, cloudDensity: 1.25, cloudSpeed: 1.9, cloudShadow: 0.80, cloudAbsorb: 1.05,
    fogDensity: 0.95, fogHeight: 28, fogGround: 0.8,
    wind: 1.55, windSpeed: 2.1, rain: 0, wet: 0.05,
    exposure: 1.0, sat: 1.06, bloom: 1.05, flowerGlow: 0.0, motes: 1.4, lift: 0.015,
  }, {
    sunColor: 0xffeece, skyTop: 0x2d6cb0, skyHorizon: 0xc6d9e4, skyHaze: 0xd2dfe4,
    ambSky: 0x8fb2cd, ambGround: 0x5c7048, fogColor: 0xcfdde4, mistColor: 0xe4eef2,
    grassDry: 0x9faa68, grassLush: 0x66bb4a, grassDeep: 0x224f2a, grassTip: 0xc2dc7d,
    earth: 0x6b5941, petalTint: 0xffd9e2,
  }),

  preset('overcast', '阴云', 'OVERCAST', 54, {
    sunElev: 36, sunAzim: 200, sunIntensity: 0.95, sunGlow: 0.35, stars: 0,
    cloudThresh: 0.480, cloudDensity: 1.6, cloudSpeed: 1.15, cloudShadow: 0.55, cloudAbsorb: 1.25,
    fogDensity: 1.5, fogHeight: 24, fogGround: 1.5,
    wind: 0.95, windSpeed: 1.25, rain: 0, wet: 0.2,
    exposure: 1.12, sat: 0.95, bloom: 0.85, flowerGlow: 0.05, motes: 0.6, lift: 0.022,
  }, {
    sunColor: 0xdfe6ea, skyTop: 0x6b7f90, skyHorizon: 0xacbcc4, skyHaze: 0xb8c4c8,
    ambSky: 0x9aacb6, ambGround: 0x54604a, fogColor: 0xb9c7cc, mistColor: 0xcfdadd,
    grassDry: 0x93a06c, grassLush: 0x5da954, grassDeep: 0x1f4a2c, grassTip: 0xb0cd80,
    earth: 0x615341, petalTint: 0xf4dbe2,
  }),

  preset('rain', '细雨', 'SOFT RAIN', 50, {
    sunElev: 30, sunAzim: 222, sunIntensity: 0.62, sunGlow: 0.2, stars: 0,
    cloudThresh: 0.400, cloudDensity: 1.95, cloudSpeed: 1.5, cloudShadow: 0.50, cloudAbsorb: 1.5,
    fogDensity: 1.5, fogHeight: 22, fogGround: 1.45,
    wind: 1.15, windSpeed: 1.5, rain: 1, wet: 1,
    exposure: 1.12, sat: 1.0, bloom: 0.85, flowerGlow: 0.08, motes: 0.25, lift: 0.038,
  }, {
    sunColor: 0xc3d2dc, skyTop: 0x4c5c69, skyHorizon: 0x8b9aa2, skyHaze: 0x94a1a6,
    ambSky: 0x9aabbb, ambGround: 0x5b6a52, fogColor: 0x8a99a2, mistColor: 0xaab7bc,
    grassDry: 0x869668, grassLush: 0x559f52, grassDeep: 0x193f27, grassTip: 0x9bbd76,
    earth: 0x554839, petalTint: 0xefd6de,
  }),

  preset('sunset', '夕照', 'GOLDEN HOUR', 70, {
    sunElev: 7.5, sunAzim: 264, sunIntensity: 1.95, sunGlow: 2.1, stars: 0.05,
    cloudThresh: 0.655, cloudDensity: 1.2, cloudSpeed: 0.7, cloudShadow: 0.75, cloudAbsorb: 1.0,
    fogDensity: 1.55, fogHeight: 20, fogGround: 1.9,
    wind: 0.6, windSpeed: 0.85, rain: 0, wet: 0.08,
    exposure: 1.0, sat: 1.10, bloom: 1.4, flowerGlow: 0.3, motes: 1.5, lift: 0.02,
  }, {
    sunColor: 0xffb268, skyTop: 0x2d4a86, skyHorizon: 0xffb478, skyHaze: 0xf5b58c,
    ambSky: 0x86a0d0, ambGround: 0x6b533a, fogColor: 0xf3bd93, mistColor: 0xffd8b4,
    grassDry: 0xbaab64, grassLush: 0x71ad48, grassDeep: 0x334729, grassTip: 0xf7d489,
    earth: 0x745a3d, petalTint: 0xffcdd2,
  }),

  preset('night', '月夜', 'MOONLIT', 60, {
    sunElev: 41, sunAzim: 310, sunIntensity: 0.42, sunGlow: 0.55, stars: 1,
    cloudThresh: 0.630, cloudDensity: 0.95, cloudSpeed: 0.5, cloudShadow: 0.55, cloudAbsorb: 1.1,
    fogDensity: 1.35, fogHeight: 19, fogGround: 1.7,
    wind: 0.5, windSpeed: 0.7, rain: 0, wet: 0.12,
    exposure: 1.45, sat: 1.08, bloom: 1.5, flowerGlow: 1.0, motes: 1.8, lift: 0.042,
  }, {
    sunColor: 0xbcd2ff, skyTop: 0x080f24, skyHorizon: 0x25405e, skyHaze: 0x2b4358,
    ambSky: 0x4d6f9e, ambGround: 0x333f3d, fogColor: 0x39506a, mistColor: 0x577891,
    grassDry: 0x5c6d6e, grassLush: 0x3f785c, grassDeep: 0x152c2a, grassTip: 0x86ab84,
    earth: 0x3b3a35, petalTint: 0xd7e2ff,
  }),
];

const ORDER = ['dawn', 'clear', 'windy', 'overcast', 'rain', 'clear', 'sunset', 'night'];

function byKey(k) {
  return PRESETS.find((p) => p.key === k) || PRESETS[1];
}

const smoothstep = (t) => t * t * (3 - 2 * t);

export class Weather {
  constructor(startKey = 'dawn') {
    this.numKeys = Object.keys(PRESETS[0].num);
    this.colKeys = Object.keys(PRESETS[0].col);

    this.from = byKey(startKey);
    this.to = this.from;
    this.blend = 1;
    this.transition = 13;
    this.orderIndex = ORDER.indexOf(startKey) < 0 ? 0 : ORDER.indexOf(startKey);
    this.hold = this.from.hold;
    this.timer = 0;
    this.auto = true;
    this.azimDrift = 0;
    this.windAngle = 0.54;
    this.frozen = false;
    this.windScale = 1.0;
    this.flash = 0;
    this.flashTimer = 4;

    this.num = {};
    this.col = {};
    for (const k of this.numKeys) this.num[k] = this.from.num[k];
    for (const k of this.colKeys) this.col[k] = new THREE.Color(this.from.col[k]);

    // pre-convert preset colours once
    for (const p of PRESETS) {
      p._col = {};
      for (const k of this.colKeys) p._col[k] = new THREE.Color(p.col[k]);
    }
    this.name = this.from.name;
    this.sub = this.from.sub;
    this.cloudPhase = new THREE.Vector2();
    this.apply(0);
  }

  get current() { return this.blend < 0.5 ? this.from : this.to; }

  goTo(key, transition = 13) {
    const target = byKey(key);
    if (target === this.to && this.blend >= 1) {
      // restart hold, no visual change
      this.timer = 0;
      return;
    }
    // freeze the current interpolated look as the new starting point
    const frozen = { key: 'blend', name: this.to.name, sub: this.to.sub, hold: this.to.hold, num: {}, _col: {} };
    for (const k of this.numKeys) frozen.num[k] = this.num[k];
    for (const k of this.colKeys) frozen._col[k] = new THREE.Color().copy(this.col[k]);
    this.from = frozen;
    this.to = target;
    this.blend = 0;
    this.transition = transition;
    this.timer = 0;
    this.hold = target.hold;
    this.orderIndex = Math.max(0, ORDER.indexOf(key));
  }

  next() {
    this.orderIndex = (this.orderIndex + 1) % ORDER.length;
    this.goTo(ORDER[this.orderIndex]);
  }

  update(dt, time) {
    if (this.frozen) return;      // debug/verification hook: hold the current look
    if (this.blend < 1) {
      this.blend = Math.min(1, this.blend + dt / this.transition);
    } else if (this.auto) {
      this.timer += dt;
      if (this.timer > this.hold) this.next();
    }
    this.azimDrift += dt * 0.28;              // the sun keeps moving, slowly

    // the wind slowly veers
    this.windAngle += dt * 0.021 * (0.6 + 0.8 * Math.sin(time * 0.037));
    U.uWindDir.value.set(Math.cos(this.windAngle), Math.sin(this.windAngle));

    const t = smoothstep(this.blend);
    for (const k of this.numKeys) {
      const a = this.from.num[k], b = this.to.num[k];
      this.num[k] = a + (b - a) * t;
    }
    for (const k of this.colKeys) {
      this.col[k].copy(this.from._col[k]).lerp(this.to._col[k], t);
    }
    this.name = t < 0.5 ? this.from.name : this.to.name;
    this.sub = t < 0.5 ? this.from.sub : this.to.sub;

    // lightning while it rains
    const rain = this.num.rain;
    this.flash = Math.max(0, this.flash - dt * 3.4);
    if (rain > 0.55) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashTimer = 5 + Math.random() * 16;
        this.flash = 0.55 + Math.random() * 0.75;
      }
    }

    // clouds drift downwind (noise units/s; 1 unit ~= 1/uCloudFreq metres)
    const wd = U.uWindDir.value;
    const cs = this.num.cloudSpeed * 0.030;
    this.cloudPhase.x += wd.x * cs * dt;
    this.cloudPhase.y += wd.y * cs * dt;

    this.apply(time);
  }

  apply() {
    const n = this.num, c = this.col;

    const elev = THREE.MathUtils.degToRad(n.sunElev);
    const azim = THREE.MathUtils.degToRad(n.sunAzim + this.azimDrift);
    U.uSunDir.value.set(
      Math.cos(elev) * Math.cos(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.sin(azim),
    ).normalize();

    U.uSunColor.value.copy(c.sunColor);
    U.uSunIntensity.value = n.sunIntensity;
    U.uSunGlow.value = n.sunGlow;
    U.uStars.value = n.stars;
    U.uSkyTop.value.copy(c.skyTop);
    U.uSkyHorizon.value.copy(c.skyHorizon);
    U.uSkyHaze.value.copy(c.skyHaze);
    U.uAmbSky.value.copy(c.ambSky);
    U.uAmbGround.value.copy(c.ambGround);

    U.uCloudThresh.value = n.cloudThresh;
    U.uCloudDensity.value = n.cloudDensity;
    U.uCloudShadow.value = n.cloudShadow;
    U.uCloudAbsorb.value = n.cloudAbsorb;
    U.uCloudWind.value.copy(this.cloudPhase);

    U.uFogColor.value.copy(c.fogColor);
    U.uMistColor.value.copy(c.mistColor);
    U.uFogDensity.value = n.fogDensity;
    U.uFogHeight.value = n.fogHeight;
    U.uFogGround.value = n.fogGround;

    U.uGrassDry.value.copy(c.grassDry);
    U.uGrassLush.value.copy(c.grassLush);
    U.uGrassDeep.value.copy(c.grassDeep);
    U.uGrassTip.value.copy(c.grassTip);
    U.uEarth.value.copy(c.earth);
    U.uPetalTint.value.copy(c.petalTint);

    U.uWindStrength.value = n.wind * 0.52 * this.windScale;
    U.uWindSpeed.value = n.windSpeed * (0.55 + 0.45 * this.windScale);

    U.uWet.value = n.wet;
    U.uRain.value = n.rain;
    U.uFlowerGlow.value = n.flowerGlow;
    U.uFlash.value = this.flash;
  }
}
