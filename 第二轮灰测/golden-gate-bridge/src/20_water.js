/* =========================================================================
   海面 · 金门海峡（在 MeshStandardMaterial 上注入波浪法线/浅滩/浪花，
   因此天然拥有 GGX 高光、环境反射、桥体投影与雾）
   ========================================================================= */
let water, waterU = null, shoreTex = null;

function buildWater(scene) {
  shoreTex = bakeShoreFromTerrain();
  const EXT = T.EXT;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x14323f, roughness: 0.055, metalness: 0.02, envMapIntensity: 1.0,
  });
  waterU = {
    uT: { value: 0 }, uShore: { value: shoreTex }, uExt: { value: EXT }, uWi: { value: 1 / T.WARP },
    uDeep: { value: new THREE.Color(0x081c2a) }, uShal: { value: new THREE.Color(0x1d5a63) },
    uSky: { value: new THREE.Color(0x88a8c8) }, uChop: { value: 1.0 },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, waterU);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix*vec4(position,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWP;
        uniform float uT, uExt, uChop, uWi; uniform sampler2D uShore;
        uniform vec3 uDeep, uShal, uSky;
        float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453123); }
        float wn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(wh(i),wh(i+vec2(1,0)),f.x), mix(wh(i+vec2(0,1)),wh(i+vec2(1,1)),f.x), f.y); }
        float wfb(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<4;i++){ s+=a*wn(p); p=p*2.11+vec2(3.3,7.1); a*=0.5; } return s; }
        // 叠加深水色散波，返回坡度
        vec2 slope(vec2 p, float att, float turb){
          vec2 s = vec2(0.0);
          const int N = 5;
          vec2 dirs[5]; float lam[5]; float amp[5];
          dirs[0]=normalize(vec2( 0.94, 0.34)); lam[0]=88.0; amp[0]=0.90;
          dirs[1]=normalize(vec2( 0.72,-0.69)); lam[1]=41.0; amp[1]=0.46;
          dirs[2]=normalize(vec2(-0.30, 0.95)); lam[2]=19.0; amp[2]=0.22;
          dirs[3]=normalize(vec2(-0.88,-0.47)); lam[3]= 9.5; amp[3]=0.10;
          dirs[4]=normalize(vec2( 0.15, 0.99)); lam[4]= 4.6; amp[4]=0.05;
          for(int i=0;i<N;i++){
            float k = 6.28318/lam[i];
            float w = sqrt(9.81*k);
            float a = amp[i]*att*(1.0+turb*1.6);
            s += dirs[i]*(a*k*cos(dot(dirs[i],p)*k + uT*w*0.9));
          }
          // 细碎浪花
          float e = 1.4;
          float n0 = wfb(p*0.09 + vec2(uT*0.06, -uT*0.04));
          float nx = wfb((p+vec2(e,0.0))*0.09 + vec2(uT*0.06, -uT*0.04));
          float nz = wfb((p+vec2(0.0,e))*0.09 + vec2(uT*0.06, -uT*0.04));
          s += vec2(nx-n0, nz-n0)*(2.6*att*(1.0+turb*2.2));
          return s;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 p = vWP.xz;
          float dist = length(vWP - cameraPosition);
          float att = 1.0/(1.0 + dist*0.0016);
          // 金门海峡潮流：塔柱与主跨中部湍流更强
          float turb = uChop*(exp(-abs(abs(p.x)-640.0)*0.006)*0.7 + exp(-abs(p.x)*0.0016)*0.25);
          vec2 sl = slope(p, att, turb);
          vec3 wn3 = normalize(vec3(-sl.x, 1.0, -sl.y));
          normal = normalize((viewMatrix*vec4(wn3,0.0)).xyz);

          vec2 qq = clamp(p/(uExt*0.5), -1.0, 1.0);
          vec2 uvS = vec2(sign(qq.x)*pow(abs(qq.x), uWi), sign(qq.y)*pow(abs(qq.y), uWi))*0.5 + 0.5;
          vec4 sh4 = texture2D(uShore, clamp(uvS, 0.002, 0.998));
          float dep = sh4.r, deep2 = sh4.g;
          vec3 wc = mix(uShal, uDeep, smoothstep(0.02, 0.55, dep));
          wc = mix(mix(vec3(0.30,0.27,0.21), uShal, 0.4), wc, smoothstep(0.0, 0.06, dep)); // 滩涂
          wc = mix(wc, wc*0.72+uSky*0.30, 0.45);
          diffuseColor.rgb = wc;
          roughnessFactor = mix(0.11, 0.05, smoothstep(0.0,0.3,dep));

          // 碎浪 / 岸线白沫（噪声打碎块状）
          float fnoise = wfb(p*0.075 + vec2(uT*0.05, uT*0.02));
          float fine = wfb(p*0.31 - vec2(uT*0.11, uT*0.06));
          float band = smoothstep(0.34, 0.0, dep);
          float surf = band * smoothstep(0.30, 0.78, fnoise*0.62+fine*0.38);
          float crest = smoothstep(0.62, 1.25, length(sl)) * (0.35+0.65*turb);
          float wake = smoothstep(0.55,0.95, wfb(p*0.02+vec2(-uT*0.09,uT*0.03)))*turb*0.9;
          float foam = clamp(surf*1.2 + crest*0.5 + wake*0.5, 0.0, 1.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88,0.90,0.92), foam*0.92);
          roughnessFactor = mix(roughnessFactor, 0.78, foam);
        }`);
  };
  const g = new THREE.PlaneGeometry(60000, 60000, 1, 1);
  g.rotateX(-Math.PI / 2);
  water = new THREE.Mesh(g, mat);
  water.position.y = 0;
  water.receiveShadow = true;
  water.name = 'water';
  scene.add(water);
  return water;
}

function updateWater(dt) {
  if (!waterU) return;
  waterU.uT.value = S.t;
  waterU.uSky.value.copy(S.hz).lerp(S.zen, 0.45);
  const nd = S.night;
  waterU.uDeep.value.setHex(0x081c2a).lerp(_tc.setHex(0x03060d), nd);
  waterU.uShal.value.setHex(0x1d5a63).lerp(_tc.setHex(0x0a1c26), nd);
}

/* ---------------- 海雾带（体积感 billboard） ---------------- */
let fogBank = null, fogMats = [];
function buildFogBanks(scene) {
  const t = tex(puffCanvas(), 1, 1);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  fogBank = new THREE.Group();
  fogBank.name = 'fogbank';
  const N = 26;
  for (let i = 0; i < N; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: t, transparent: true, depthWrite: false, opacity: 0,
      side: THREE.DoubleSide, fog: true, color: 0xffffff,
    });
    fogMats.push(mat);
    const w = rr(700, 1900), h = rr(150, 380);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(rr(-2600, 2600), rr(14, 96), rr(-4200, 2600));
    m.userData = { spd: rr(9, 22), ph: rr(0, 100), y0: m.position.y, amp: rr(4, 14) };
    m.renderOrder = 8;
    fogBank.add(m);
  }
  scene.add(fogBank);
}
function updateFog(cam, dt) {
  if (!fogBank) return;
  const lvl = S.fog;
  for (const m of fogBank.children) {
    const u = m.userData;
    m.position.z += u.spd * dt * (0.35 + lvl);
    if (m.position.z > 3000) m.position.z = -4600;
    m.position.y = u.y0 + Math.sin(S.t * 0.14 + u.ph) * u.amp;
    m.lookAt(cam.position.x, m.position.y, cam.position.z);
    const near = smoothstep(120, 700, m.position.distanceTo(cam.position));
    m.material.opacity = clamp((lvl - 0.05) * 0.5, 0, 1) * near;
    m.material.color.copy(S.hz).lerp(S.sunC, 0.16 * (1 - S.night)).multiplyScalar(lerp(0.35, 1.05, 1 - S.night));
  }
}
