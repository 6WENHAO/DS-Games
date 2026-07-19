/* mirror.js - 平面反射镜：Reflector 模式（相机+RenderTarget）
 * 优化（借鉴 three.js Reflector / Immersive Portals 的传送门渲染剔除思路）：
 *  ① 可见性剔除：镜面不在主相机视锥内 / 相机位于镜面背面 / 超出距离 → 跳过整帧反射渲染
 *  ② 帧率节流：近距全帧率，中距隔帧更新（纹理保留上一帧，感知差异极小）
 *  ③ 斜切近平面（oblique frustum）：裁掉镜面背后的几何，反射正确且省填充率
 *  ④ 远平面钳制：反射相机 far 独立钳制，远景 LOD 大幅被视锥剔除 */
const MirrorReflector = (function () {
  'use strict';

  function create(opts) {
    const w = opts.width, h = opts.height;
    const pos = opts.position.clone();
    const norm = opts.normal.clone().normalize();
    const scene = opts.scene;
    const renderer = opts.renderer;
    const res = opts.resolution || 512;
    const maxDist = opts.maxDist || 110;       // 超过此距离不再更新反射
    const nearFull = opts.nearFull || 28;      // 该距离内全帧率，之外隔帧
    const maxFar = opts.maxFar || 2600;        // 反射相机远平面钳制

    // RenderTarget
    let rt = makeRT(res);
    function makeRT(r) {
      return new THREE.WebGLRenderTarget(r, Math.max(16, Math.round(r * h / w)), {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    }

    // 镜面相机
    const mirrorCam = new THREE.PerspectiveCamera(75, w / h, 0.1, maxFar);

    // 镜面几何
    const geo = new THREE.PlaneGeometry(w, h);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        reflectionTex: { value: rt.texture },
        mirrorProjView: { value: new THREE.Matrix4() },
      },
      vertexShader: [
        'varying vec4 vProjCoord;',
        'uniform mat4 mirrorProjView;',
        'void main() {',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vProjCoord = mirrorProjView * worldPos;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec4 vProjCoord;',
        'uniform sampler2D reflectionTex;',
        'void main() {',
        '  vec2 uv = vProjCoord.xy / vProjCoord.w;',
        '  uv = uv * 0.5 + 0.5;',
        '  gl_FragColor = texture2D(reflectionTex, uv);',
        '}'
      ].join('\n'),
      side: THREE.FrontSide,
      depthTest: true,
      depthWrite: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), norm);
    mesh.setRotationFromQuaternion(q);
    mesh.renderOrder = 1;
    mesh.name = '_mirrorPlane';

    scene.add(mesh);

    // 复用临时对象（避免每帧分配）
    const _v1 = new THREE.Vector3();
    const _v2 = new THREE.Vector3();
    const _fwd = new THREE.Vector3();
    const _frustum = new THREE.Frustum();
    const _projView = new THREE.Matrix4();
    const _sphere = new THREE.Sphere(pos.clone(), Math.sqrt(w * w + h * h) / 2);
    const _plane = new THREE.Plane();
    const _clip = new THREE.Vector4();
    const _q = new THREE.Vector4();
    let frameNo = 0;
    let rendered = false;

    // 反射辅助
    function reflectPt(p, out) {
      const d = norm.dot(_v2.copy(p).sub(pos));
      return out.copy(p).addScaledVector(norm, -2 * d);
    }

    function update(mainCam) {
      frameNo++;
      const camPos = mainCam.position;

      /* ① 剔除：背面 / 距离 / 视锥（首帧强制渲染一次，避免黑镜） */
      if (rendered) {
        const side = norm.dot(_v2.copy(camPos).sub(pos));
        if (side <= 0.01) return;                       // 相机在镜面背面
        const dist = camPos.distanceTo(pos);
        if (dist > maxDist) return;                     // 距离过远
        if (dist > nearFull && (frameNo & 1)) return;   // ② 中距隔帧
        _projView.multiplyMatrices(mainCam.projectionMatrix, mainCam.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projView);
        if (!_frustum.intersectsSphere(_sphere)) return; // 不在视锥内
      }

      // 反射相机位置/朝向
      reflectPt(camPos, _v1);
      mirrorCam.position.copy(_v1);
      _fwd.set(0, 0, -1).applyQuaternion(mainCam.quaternion);
      reflectPt(_v2.copy(camPos).addScaledVector(_fwd, 10), _v1);
      mirrorCam.lookAt(_v1);

      mirrorCam.fov = mainCam.fov;
      mirrorCam.aspect = mainCam.aspect;
      mirrorCam.near = mainCam.near;
      mirrorCam.far = Math.min(maxFar, mainCam.far);   // ④ 远平面钳制
      mirrorCam.updateProjectionMatrix();
      mirrorCam.updateMatrixWorld(true);
      mirrorCam.matrixWorldInverse.copy(mirrorCam.matrixWorld).invert();

      // 更新采样矩阵（用未斜切的投影，xy/w 与纹理一致）
      mat.uniforms.mirrorProjView.value.multiplyMatrices(
        mirrorCam.projectionMatrix, mirrorCam.matrixWorldInverse
      );

      /* ③ 斜切近平面：把镜面所在平面作为反射相机近裁剪面 */
      _plane.setFromNormalAndCoplanarPoint(norm, pos);
      _plane.applyMatrix4(mirrorCam.matrixWorldInverse);
      _clip.set(_plane.normal.x, _plane.normal.y, _plane.normal.z, _plane.constant);
      const pe = mirrorCam.projectionMatrix.elements;
      _q.x = (Math.sign(_clip.x) + pe[8]) / pe[0];
      _q.y = (Math.sign(_clip.y) + pe[9]) / pe[5];
      _q.z = -1.0;
      _q.w = (1.0 + pe[10]) / pe[14];
      _clip.multiplyScalar(2.0 / _clip.dot(_q));
      pe[2] = _clip.x;
      pe[6] = _clip.y;
      pe[10] = _clip.z + 1.0;
      pe[14] = _clip.w;

      // 渲染反射
      mesh.visible = false;
      const oldBg = scene.background;
      scene.background = null;

      const oldTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, mirrorCam);
      renderer.setRenderTarget(oldTarget);

      scene.background = oldBg;
      mesh.visible = true;
      rendered = true;
    }

    function setResolution(r) {
      const old = rt;
      rt = makeRT(r);
      mat.uniforms.reflectionTex.value = rt.texture;
      old.dispose();
      rendered = false;
    }

    function dispose() {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      rt.dispose();
    }

    return {
      mesh: mesh, update: update, dispose: dispose, setResolution: setResolution,
      get renderTarget() { return rt; }, camera: mirrorCam
    };
  }

  return { create: create };
})();
