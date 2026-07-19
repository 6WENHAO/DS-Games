import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { getHeight } from './heightfield.js';

// 地形网格 + 四重纹理混合（草/泥/岩/沙，按高度与坡度）
// 通过 onBeforeCompile 注入 splat 混合，保留 three 的光照/雾/阴影管线
export function createTerrain(scene) {
  const size = CONFIG.world.size;
  const segments = 384;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, getHeight(x, z));
  }
  geo.computeVertexNormals();

  const grassCol = Assets.tex('grass_col');
  const dirtCol = Assets.tex('dirt_col');
  const rockCol = Assets.tex('rock_col');
  const sandCol = Assets.tex('sand_col');
  const grassNrm = Assets.tex('grass_nrm');
  const rockNrm = Assets.tex('rock_nrm');

  const mat = new THREE.MeshStandardMaterial({
    map: grassCol,
    normalMap: grassNrm,
    roughness: 1.0,
    metalness: 0.0,
  });

  const texScale = 0.09; // 世界单位 -> 纹理重复
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDirtMap = { value: dirtCol };
    shader.uniforms.uRockMap = { value: rockCol };
    shader.uniforms.uSandMap = { value: sandCol };
    shader.uniforms.uRockNormal = { value: rockNrm };
    shader.uniforms.uTexScale = { value: texScale };
    shader.uniforms.uBeachLevel = { value: CONFIG.world.beachLevel };
    shader.uniforms.uRockSlope = { value: CONFIG.world.rockSlope };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vTerrainNormal;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vTerrainNormal = normalize(mat3(modelMatrix) * objectNormal);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldPos;
        varying vec3 vTerrainNormal;
        uniform sampler2D uDirtMap;
        uniform sampler2D uRockMap;
        uniform sampler2D uSandMap;
        uniform float uTexScale;
        uniform float uBeachLevel;
        uniform float uRockSlope;`)
      .replace('#include <map_fragment>', `
        vec2 tuv = vWorldPos.xz * uTexScale;
        vec4 cGrass = texture2D(map, tuv);
        vec4 cDirt  = texture2D(uDirtMap, tuv);
        vec4 cRock  = texture2D(uRockMap, tuv * 0.6);
        vec4 cSand  = texture2D(uSandMap, tuv);

        float slope = 1.0 - clamp(vTerrainNormal.y, 0.0, 1.0);
        float h = vWorldPos.y;

        // 草地和泥土按噪声混合（用两张图低频采样近似噪声）
        float patchNoise = texture2D(uDirtMap, vWorldPos.xz * 0.006).r;
        vec4 ground = mix(cGrass, cDirt, smoothstep(0.35, 0.65, patchNoise) * 0.75);

        // 高处/陡坡 -> 岩石
        float rockW = smoothstep(uRockSlope - 0.15, uRockSlope + 0.12, slope);
        rockW = max(rockW, smoothstep(30.0, 40.0, h) * 0.65);
        vec4 col = mix(ground, cRock, rockW);

        // 低处 -> 沙滩
        float sandW = 1.0 - smoothstep(uBeachLevel - 1.2, uBeachLevel + 0.6, h);
        col = mix(col, cSand, sandW);

        diffuseColor *= col;
      `);
  };

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  // 海底延伸平面（远处海床，防止看到世界边缘空洞）
  const seabedGeo = new THREE.PlaneGeometry(size * 6, size * 6);
  seabedGeo.rotateX(-Math.PI / 2);
  const seabedMat = new THREE.MeshStandardMaterial({
    map: sandCol,
    roughness: 1,
  });
  seabedMat.map = sandCol.clone();
  seabedMat.map.repeat.set(200, 200);
  seabedMat.map.wrapS = seabedMat.map.wrapT = THREE.RepeatWrapping;
  const seabed = new THREE.Mesh(seabedGeo, seabedMat);
  seabed.position.y = -6.5;
  scene.add(seabed);

  return mesh;
}
