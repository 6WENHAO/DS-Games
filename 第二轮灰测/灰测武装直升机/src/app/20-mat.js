/* ============================================================================
 *  20 · 材质库
 * ==========================================================================*/

const MATS = {};

function buildMaterials(onStep = () => {}) {
  onStep('生成主蒙皮漆贴图 (2048²)');
  const paintMaps = makePaint({ baseColor: '#535b4d', panel: 0.85, wear: 1.15, seed: 3 });
  onStep('生成金属 / 复材 / 橡胶贴图');
  const paintMaps2 = paintMaps;                       // 共用（靠 color 区分明暗）
  const metalMaps = makeMetal({ base: '#9aa0a6', rough: '#5c5c5c', scale: 1 / 0.5 });
  const gunMaps = { map: metalMaps.map, normalMap: metalMaps.normalMap, roughnessMap: metalMaps.roughnessMap };
  const compMaps = makeComposite();
  const tireMaps = makeTire();

  /* ---- 机身漆（哑光军绿 + 微清漆） ---- */
  MATS.paint = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, ...paintMaps,
    metalness: 0.12, roughness: 0.97, normalScale: new THREE.Vector2(1.05, 1.05),
    clearcoat: 0.22, clearcoatRoughness: 0.5, envMapIntensity: 1.05,
  });
  /* ---- 深色蒙皮（发动机罩 / 防眩板 / 尾梁上盖） ---- */
  MATS.paintDark = new THREE.MeshPhysicalMaterial({
    color: 0x8b917f, ...paintMaps2,
    metalness: 0.14, roughness: 0.98, normalScale: new THREE.Vector2(0.95, 0.95),
    clearcoat: 0.14, clearcoatRoughness: 0.55, envMapIntensity: 1.0,
  });
  /* ---- 哑光黑（防眩 / 机炮罩 / 排气整流） ---- */
  MATS.matteBlack = new THREE.MeshPhysicalMaterial({
    color: 0x14161a, ...{ normalMap: paintMaps.normalMap, roughnessMap: paintMaps.roughnessMap },
    metalness: 0.25, roughness: 0.82, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.8,
  });
  /* ---- 结构铝 / 未涂装金属 ---- */
  MATS.alu = new THREE.MeshPhysicalMaterial({
    color: 0xb9bfc6, ...metalMaps, metalness: 0.95, roughness: 1.0,
    normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 1.1,
  });
  /* ---- 枪械 / 挂架金属 ---- */
  MATS.gunMetal = new THREE.MeshPhysicalMaterial({
    color: 0x585d64, ...gunMaps, metalness: 0.92, roughness: 0.62,
    normalScale: new THREE.Vector2(0.7, 0.7), envMapIntensity: 1.0,
  });
  MATS.barrel = new THREE.MeshPhysicalMaterial({
    color: 0x2f3236, metalness: 1.0, roughness: 0.28,
    normalMap: gunMaps.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 1.2,
  });
  MATS.steel = new THREE.MeshPhysicalMaterial({
    color: 0xd7dbe0, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.25,
    normalMap: metalMaps.normalMap, normalScale: new THREE.Vector2(0.25, 0.25),
  });
  MATS.titanium = new THREE.MeshPhysicalMaterial({
    color: 0x8f9298, metalness: 1.0, roughness: 0.38, envMapIntensity: 1.15,
  });
  /* ---- 排气 / 热区 ---- */
  MATS.exhaust = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: makeHeatRamp(), metalness: 0.85, roughness: 0.52,
    envMapIntensity: 0.9, side: THREE.DoubleSide,
  });
  /* ---- 复合材料桨叶 ---- */
  MATS.blade = new THREE.MeshPhysicalMaterial({
    color: 0x9aa0a8, ...compMaps, metalness: 0.25, roughness: 1.0,
    clearcoat: 0.35, clearcoatRoughness: 0.35,
    normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.0,
  });
  /* ---- 橡胶 / 轮胎 ---- */
  MATS.tire = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1c, ...tireMaps, metalness: 0.0, roughness: 0.88,
    normalScale: new THREE.Vector2(1.0, 1.0), envMapIntensity: 0.5,
  });
  MATS.rubber = new THREE.MeshPhysicalMaterial({ color: 0x16171a, metalness: 0.0, roughness: 0.9, envMapIntensity: 0.4 });
  /* ---- 座舱玻璃（平板多面风挡） ---- */
  MATS.glass = new THREE.MeshPhysicalMaterial({
    color: 0x7d9294, metalness: 0.0, roughness: 0.04, transparent: true, opacity: 0.235,
    envMapIntensity: 2.4, clearcoat: 1.0, clearcoatRoughness: 0.03, ior: 1.52,
    side: THREE.DoubleSide, depthWrite: false,
  });
  MATS.glassDark = new THREE.MeshPhysicalMaterial({
    color: 0x121a1c, metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.72,
    envMapIntensity: 2.0, clearcoat: 1.0, side: THREE.DoubleSide,
  });
  /* ---- 光学镜片 ---- */
  MATS.lens = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: makeLens('#123f3a'), metalness: 0.85, roughness: 0.05,
    envMapIntensity: 3.4, clearcoat: 1.0, iridescence: 0.8, iridescenceIOR: 1.9,
  });
  MATS.lensIR = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: makeLens('#3a2a18'), metalness: 0.8, roughness: 0.11,
    envMapIntensity: 3.0, clearcoat: 1.0, iridescence: 0.55,
  });
  /* ---- 龙弓雷达罩（玻璃钢） ---- */
  MATS.radome = new THREE.MeshPhysicalMaterial({
    color: 0x5d6058, roughness: 0.62, metalness: 0.05,
    normalMap: paintMaps.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), envMapIntensity: 0.9,
  });
  /* ---- 座舱内部 ---- */
  MATS.cockpit = new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.82, metalness: 0.12, envMapIntensity: 0.5 });
  MATS.seat = new THREE.MeshPhysicalMaterial({ color: 0x2b3126, roughness: 0.95, metalness: 0.0, sheen: 0.5, sheenColor: 0x3d4436, envMapIntensity: 0.3 });
  MATS.mfd = new THREE.MeshStandardMaterial({ color: 0x0a1418, emissive: 0x18c08a, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.2 });
  /* ---- 导弹 / 火箭 ---- */
  MATS.missile = new THREE.MeshPhysicalMaterial({
    color: 0x6f7469, roughness: 0.55, metalness: 0.25, clearcoat: 0.3, clearcoatRoughness: 0.4,
    normalMap: metalMaps.normalMap, normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 1.0,
  });
  MATS.missileNose = new THREE.MeshPhysicalMaterial({
    color: 0x2a2f33, roughness: 0.25, metalness: 0.6, clearcoat: 0.6, envMapIntensity: 1.3,
  });
  MATS.podOlive = new THREE.MeshPhysicalMaterial({
    color: 0xa5aa96, map: paintMaps2.map, normalMap: paintMaps2.normalMap, roughnessMap: paintMaps2.roughnessMap,
    metalness: 0.2, roughness: 1.0, envMapIntensity: 1.0, normalScale: new THREE.Vector2(0.6, 0.6),
  });
  /* ---- 网 / 滤网 ---- */
  MATS.screen = new THREE.MeshStandardMaterial({
    color: 0x23262a, metalness: 0.9, roughness: 0.5, alphaMap: makeScreenAlpha(9),
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  /* ---- 灯 ---- */
  const light = (c, i = 3) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.25, metalness: 0.0, toneMapped: true });
  MATS.navRed = light(0xff2b18, 2.2);
  MATS.navGreen = light(0x22ff5a, 2.2);
  MATS.navWhite = light(0xffffff, 2.2);
  MATS.strobe = light(0xffffff, 0.0);
  MATS.formation = light(0x9ad4ff, 0.7);
  MATS.lampGlass = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ea, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.45, envMapIntensity: 2.0 });
  /* ---- 旋翼虚化盘 ---- */
  MATS.disc = new THREE.MeshBasicMaterial({
    map: makeRotorDisc(4), transparent: true, opacity: 0.0, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.NormalBlending,
  });
  /* ---- 贴花基材 ---- */
  MATS.decalOf = (texture, { rough = 0.55, metal = 0.1, opacity = 1 } = {}) => new THREE.MeshPhysicalMaterial({
    map: texture, transparent: true, opacity, roughness: rough, metalness: metal,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    envMapIntensity: 0.7, side: THREE.DoubleSide, alphaTest: 0.01,
  });
  return MATS;
}

/* 统一给所有材质刷环境贴图强度 */
function applyEnvIntensity(k) {
  for (const m of Object.values(MATS)) {
    if (m && m.isMaterial && m.envMapIntensity !== undefined) m.envMapIntensity = (m.userData._env || (m.userData._env = m.envMapIntensity)) * k;
  }
}
