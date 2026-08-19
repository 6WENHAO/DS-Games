/* =========================================================================
   后处理：HDR → 阈值泛光（5 级双滤波）→ ACES 色调映射 → 暗角/颗粒 → sRGB
   ========================================================================= */
const VERT_FS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

class Post {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.cam = camera;
    this.enabled = true; this.levels = 5;
    this.fsScene = new THREE.Scene();
    this.fsCam = new THREE.Camera();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quad.frustumCulled = false; this.fsScene.add(this.quad);

    const rtOpt = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
    this.scene_rt = new THREE.WebGLRenderTarget(2, 2, { ...rtOpt, samples: 4 });
    this.mips = [];
    for (let i = 0; i < this.levels; i++) {
      this.mips.push(new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }));
    }
    this.mPre = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uPx: { value: new THREE.Vector2() }, uTh: { value: 1.05 }, uKnee: { value: 0.62 } },
      vertexShader: VERT_FS, fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform vec2 uPx; uniform float uTh, uKnee;
        vec3 fetch(vec2 o){ return max(texture2D(tD, vUv+o*uPx).rgb, vec3(0.0)); }
        void main(){
          vec3 c = fetch(vec2(0.0))*0.5 + (fetch(vec2(-1,-1))+fetch(vec2(1,-1))+fetch(vec2(-1,1))+fetch(vec2(1,1)))*0.125;
          float br = max(c.r, max(c.g, c.b));
          float sk = clamp(br - uTh + uKnee, 0.0, 2.0*uKnee);
          sk = sk*sk/(4.0*uKnee + 1e-5);
          float w = max(sk, br - uTh)/max(br, 1e-5);
          gl_FragColor = vec4(c*w, 1.0);
        }`,
    });
    this.mDown = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uPx: { value: new THREE.Vector2() } },
      vertexShader: VERT_FS, fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform vec2 uPx;
        vec3 f(vec2 o){ return texture2D(tD, vUv+o*uPx).rgb; }
        void main(){
          vec3 s = f(vec2(0.0))*4.0;
          s += (f(vec2(-1,-1))+f(vec2(1,-1))+f(vec2(-1,1))+f(vec2(1,1)));
          s += (f(vec2(-2,0))+f(vec2(2,0))+f(vec2(0,-2))+f(vec2(0,2)))*0.5;
          gl_FragColor = vec4(s/10.0, 1.0);
        }`,
    });
    this.mUp = new THREE.ShaderMaterial({
      uniforms: { tD: { value: null }, uPx: { value: new THREE.Vector2() } },
      vertexShader: VERT_FS, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
      fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD; uniform vec2 uPx;
        vec3 f(vec2 o){ return texture2D(tD, vUv+o*uPx).rgb; }
        void main(){
          vec3 s = f(vec2(0,0))*4.0 + (f(vec2(-1,0))+f(vec2(1,0))+f(vec2(0,-1))+f(vec2(0,1)))*2.0
                 + (f(vec2(-1,-1))+f(vec2(1,-1))+f(vec2(-1,1))+f(vec2(1,1)));
          gl_FragColor = vec4(s/16.0, 1.0);
        }`,
    });
    this.mComp = new THREE.ShaderMaterial({
      uniforms: {
        tD: { value: null }, tB: { value: null }, uExpo: { value: 1.0 },
        uBloom: { value: 0.085 }, uT: { value: 0 }, uVig: { value: 0.58 }, uSat: { value: 1.0 },
      },
      vertexShader: VERT_FS, fragmentShader: `
        varying vec2 vUv; uniform sampler2D tD, tB;
        uniform float uExpo, uBloom, uT, uVig, uSat;
        vec3 aces(vec3 x){
          const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14;
          return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
        }
        vec3 srgb(vec3 c){
          return mix(c*12.92, 1.055*pow(max(c, vec3(0.0)), vec3(0.4166667))-0.055, step(vec3(0.0031308), c));
        }
        void main(){
          vec3 c = texture2D(tD, vUv).rgb;
          vec3 b = texture2D(tB, vUv).rgb;
          c += b*uBloom;
          c *= uExpo;
          c = aces(c);
          float l = dot(c, vec3(0.2126,0.7152,0.0722));
          c = mix(vec3(l), c, uSat);
          vec2 q = vUv - 0.5;
          float v = 1.0 - dot(q,q)*uVig;
          c *= clamp(v, 0.0, 1.0);
          // 有序抖动 + 极轻胶片颗粒：消除天空色带
          vec2 px = floor(gl_FragCoord.xy);
          float dither = fract(dot(px, vec2(0.7548776662, 0.5698402909)));
          float g = fract(sin(dot(vUv*vec2(1.0+uT*0.0007, 1.0), vec2(12.9898,78.233)))*43758.5453);
          c += (dither-0.5)*(1.6/255.0) + (g-0.5)*0.009;
          gl_FragColor = vec4(srgb(c), 1.0);
        }`,
    });
  }
  setSize(w, h, dpr) {
    const W = Math.max(2, Math.floor(w * dpr)), H = Math.max(2, Math.floor(h * dpr));
    this.W = W; this.H = H;
    this.scene_rt.setSize(W, H);
    let mw = Math.max(2, W >> 1), mh = Math.max(2, H >> 1);
    for (let i = 0; i < this.levels; i++) {
      this.mips[i].setSize(mw, mh);
      this.mips[i].userData = { w: mw, h: mh };
      mw = Math.max(2, mw >> 1); mh = Math.max(2, mh >> 1);
    }
  }
  blit(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    if (target && mat !== this.mUp) this.r.clear();
    this.r.render(this.fsScene, this.fsCam);
  }
  render(expo) {
    const r = this.r;
    if (!this.enabled) {
      r.setRenderTarget(null); r.render(this.scene, this.cam);
      this.sceneTris = r.info.render.triangles; this.sceneCalls = r.info.render.calls;
      return;
    }
    r.setRenderTarget(this.scene_rt); r.clear();
    r.render(this.scene, this.cam);
    this.sceneTris = r.info.render.triangles; this.sceneCalls = r.info.render.calls;
    // 阈值 + 降采样
    this.mPre.uniforms.tD.value = this.scene_rt.texture;
    this.mPre.uniforms.uPx.value.set(1 / this.W, 1 / this.H);
    this.blit(this.mPre, this.mips[0]);
    for (let i = 1; i < this.levels; i++) {
      const p = this.mips[i - 1].userData;
      this.mDown.uniforms.tD.value = this.mips[i - 1].texture;
      this.mDown.uniforms.uPx.value.set(1 / p.w, 1 / p.h);
      this.blit(this.mDown, this.mips[i]);
    }
    // 升采样叠加
    for (let i = this.levels - 1; i > 0; i--) {
      const p = this.mips[i].userData;
      this.mUp.uniforms.tD.value = this.mips[i].texture;
      this.mUp.uniforms.uPx.value.set(1 / p.w, 1 / p.h);
      this.blit(this.mUp, this.mips[i - 1]);
    }
    this.mComp.uniforms.tD.value = this.scene_rt.texture;
    this.mComp.uniforms.tB.value = this.mips[0].texture;
    this.mComp.uniforms.uExpo.value = expo;
    this.mComp.uniforms.uT.value = S.t;
    this.blit(this.mComp, null);
  }
}
