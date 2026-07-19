// Authentic PS1 / VHS look: render scene to a low-res target, then upscale
// through a CRT/VHS shader (chromatic aberration, scanlines, grain, vignette,
// tracking distortion). PS1 vertex snapping is applied via patchMaterial().

const VHS_FRAG = `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime;
uniform float uAberration;
uniform float uGrain;
uniform float uScan;
uniform float uVignette;
uniform float uDistort;
uniform float uDesat;
varying vec2 vUv;

float rand(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }

void main(){
  vec2 uv = vUv;

  // vertical wobble / tracking distortion
  float track = uDistort;
  float roll = step(0.985 - track*0.4, fract(uv.y*2.0 - uTime*0.4));
  uv.x += (rand(vec2(uv.y, floor(uTime*12.0))) - 0.5) * (0.004 + track*0.05) * roll;
  uv.x += sin(uv.y*80.0 + uTime*3.0) * 0.0007;

  // chromatic aberration (stronger toward edges)
  vec2 dir = uv - 0.5;
  float ca = uAberration * (0.4 + dot(dir,dir)*3.0);
  float r = texture2D(tDiffuse, uv + dir*ca).r;
  float g = texture2D(tDiffuse, uv).g;
  float b = texture2D(tDiffuse, uv - dir*ca).b;
  vec3 col = vec3(r, g, b);

  // desaturate slightly + cool grade
  float lum = dot(col, vec3(0.299,0.587,0.114));
  col = mix(col, vec3(lum), uDesat);
  col *= vec3(0.94, 0.98, 1.06);
  col = pow(col, vec3(1.05));

  // scanlines
  float scan = sin(uv.y * uRes.y * 1.4) * 0.5 + 0.5;
  col *= 1.0 - uScan * (1.0 - scan);

  // moving grain
  float gn = rand(uv * uRes + fract(uTime)*vec2(543.0,231.0));
  col += (gn - 0.5) * uGrain;

  // occasional bright tracking band
  col += roll * 0.15;

  // vignette
  float vig = smoothstep(0.9, 0.35, length(dir));
  col *= mix(1.0, vig, uVignette);

  gl_FragColor = vec4(col, 1.0);
}`;

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }`;

class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // low internal resolution -> PS1 chunkiness
    this.scale = 0.42;
    this.target = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
    });

    this.quadScene = new THREE.Scene();
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.target.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uAberration: { value: 0.0022 },
        uGrain: { value: 0.10 },
        uScan: { value: 0.28 },
        uVignette: { value: 0.9 },
        uDistort: { value: 0.0 },
        uDesat: { value: 0.25 },
      },
      vertexShader: VERT,
      fragmentShader: VHS_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.quadScene.add(quad);

    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(w, h) {
    this.w = w; this.h = h;
    const lw = Math.max(2, Math.floor(w * this.scale));
    const lh = Math.max(2, Math.floor(h * this.scale));
    this.target.setSize(lw, lh);
    this.material.uniforms.uRes.value.set(lw, lh);
  }

  setDistort(v) { this.material.uniforms.uDistort.value = v; }
  setGrain(v) { this.material.uniforms.uGrain.value = v; }
  setDesat(v) { this.material.uniforms.uDesat.value = v; }

  render(dt) {
    this.material.uniforms.uTime.value += dt;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }
}

// PS1 vertex snapping + affine texture wobble on a material.
function patchMaterial(mat, snap = 64) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: snap };
    shader.vertexShader = 'uniform float uSnap;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      vec4 snapped = projectionMatrix * mvPosition;
      snapped.xyz = snapped.xyz / snapped.w;
      snapped.xy = floor(snapped.xy * uSnap) / uSnap;
      snapped.xyz *= snapped.w;
      gl_Position = snapped;
      `
    );
  };
  return mat;
}
