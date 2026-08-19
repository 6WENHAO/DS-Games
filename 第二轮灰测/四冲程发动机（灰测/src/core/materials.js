/**
 * materials.js —— PBR 材质库
 * 每种零件按真实材料给出 metalness / roughness / clearcoat 近似值。
 * housing 类材质参与「透视 / 剖切」模式切换。
 */
import * as THREE from 'three';

// 流道示意材质的名称片段（克隆材质按名称归类，保证"流道显示"滑块同时生效）
const FLUID_NAMES = ['冷却液腔', '润滑油道', '进气道', '排气道', '主油道'];

export function createMaterials() {
  const housing = [];
  const all = [];
  const fluids = [];

  const M = (name, opts, isHousing = false) => {
    const m = new THREE.MeshStandardMaterial(opts);
    m.name = name;
    m.userData.baseOpacity = opts.opacity ?? 1;
    m.userData.baseTransparent = !!opts.transparent;
    m.userData.baseSide = opts.side ?? THREE.FrontSide;
    m.userData.isHousing = isHousing;
    if (isHousing) housing.push(m);
    all.push(m);
    return m;
  };

  const mats = {
    // ---- 铸件 / 壳体（可透视、可剖切）----
    castIron: M('灰铸铁 HT250', { color: 0x76797e, metalness: 0.82, roughness: 0.66 }, true),
    castIronHead: M('合金铸铁缸盖', { color: 0x7e828a, metalness: 0.8, roughness: 0.62 }, true),
    castIronDark: M('耐热铸铁 排气管', { color: 0x53514e, metalness: 0.7, roughness: 0.82 }, true),
    steelSheet: M('冲压钢板 油底壳', { color: 0x5f6672, metalness: 0.9, roughness: 0.42 }, true),
    alumCast: M('铸铝合金 ZL104', { color: 0xa9b0b8, metalness: 0.88, roughness: 0.44 }, true),
    alumMachined: M('精加工铝合金', { color: 0xc3cad2, metalness: 0.95, roughness: 0.26 }, true),

    // ---- 运动件 ----
    forgedSteel: M('锻钢 42CrMo（调质）', { color: 0x9aa1a9, metalness: 0.98, roughness: 0.36 }),
    nodularIron: M('球墨铸铁 QT700-2', { color: 0x82868c, metalness: 0.85, roughness: 0.5 }),
    nitridedSteel: M('渗氮钢（表面硬化）', { color: 0xcdd3da, metalness: 1.0, roughness: 0.18 }),
    hardChrome: M('镀硬铬表面', { color: 0xdfe5ec, metalness: 1.0, roughness: 0.09 }),
    pistonAlloy: M('共晶铝硅合金 ZL109', { color: 0xcfd3d8, metalness: 0.72, roughness: 0.38 }),
    pistonBowl: M('燃烧室（阳极氧化+积碳）', { color: 0x3a3733, metalness: 0.5, roughness: 0.78 }),
    ringSteel: M('合金铸铁活塞环（镀铬）', { color: 0x4c5057, metalness: 0.95, roughness: 0.28 }),
    bearingAlloy: M('铜铅合金三层轴瓦', { color: 0xc79a5f, metalness: 0.9, roughness: 0.34 }),
    bushBronze: M('锡青铜衬套', { color: 0xb98a52, metalness: 0.9, roughness: 0.38 }),
    springSteel: M('60Si2Mn 弹簧钢', { color: 0xa8aeb6, metalness: 0.96, roughness: 0.24 }),
    valveSteel: M('21-4N 耐热气门钢', { color: 0xb9c0c8, metalness: 0.98, roughness: 0.2 }),
    valveFace: M('气门锥面（硬化堆焊）', { color: 0x8d8577, metalness: 0.9, roughness: 0.35 }),
    gearSteel: M('20CrMnTi 渗碳齿轮钢', { color: 0x9ba2aa, metalness: 0.96, roughness: 0.3 }),

    // ---- 附件 ----
    chrome: M('不锈钢高压油管', { color: 0xd8dee6, metalness: 1.0, roughness: 0.12 }),
    turbineAlloy: M('镍基高温合金 K418', { color: 0xb0b6bd, metalness: 1.0, roughness: 0.24 }),
    copper: M('紫铜散热带', { color: 0xb06a35, metalness: 0.95, roughness: 0.42 }),
    brass: M('黄铜接头', { color: 0xc2a15a, metalness: 0.95, roughness: 0.3 }),
    filterPaper: M('滤纸滤芯', { color: 0xd9c48a, metalness: 0.0, roughness: 0.95 }),
    paintedBlack: M('喷漆钢结构件', { color: 0x2b2f36, metalness: 0.55, roughness: 0.62 }),
    paintedRed: M('喷漆（标识色）', { color: 0x9d3428, metalness: 0.5, roughness: 0.55 }),

    // ---- 弹性 / 密封 ----
    rubber: M('丁腈橡胶 NBR', { color: 0x22252a, metalness: 0.0, roughness: 0.94 }),
    silicone: M('硅胶软管', { color: 0x2a2d33, metalness: 0.0, roughness: 0.88 }),
    gasketMat: M('石墨复合缸垫', { color: 0x3c4046, metalness: 0.35, roughness: 0.85 }),
    gasketPaper: M('耐油纸垫', { color: 0x8a6b3f, metalness: 0.1, roughness: 0.9 }),
    boltSteel: M('8.8 级螺栓钢', { color: 0x8f959d, metalness: 0.95, roughness: 0.34 }),

    // ---- 流体腔（示意，半透明）----
    coolantVol: M('冷却液腔（示意）', {
      color: 0x2f9bd8, metalness: 0.1, roughness: 0.25, transparent: true, opacity: 0.3,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    oilVol: M('润滑油道（示意）', {
      color: 0xf0a02a, metalness: 0.15, roughness: 0.3, transparent: true, opacity: 0.42,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    intakeVol: M('进气道（示意）', {
      color: 0x69d2ff, metalness: 0.1, roughness: 0.3, transparent: true, opacity: 0.26,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    exhaustVol: M('排气道（示意）', {
      color: 0xff7043, metalness: 0.1, roughness: 0.3, transparent: true, opacity: 0.26,
      depthWrite: false, side: THREE.DoubleSide,
    }),
    glass: M('观察窗（示意）', {
      color: 0xdff1ff, metalness: 0.0, roughness: 0.05, transparent: true, opacity: 0.18,
      depthWrite: false,
    }),
  };

  for (const k of ['coolantVol', 'oilVol', 'intakeVol', 'exhaustVol']) fluids.push(mats[k]);
  mats.$housing = housing;
  mats.$all = all;
  mats.$fluids = fluids;

  /** 应用显示模式：solid / ghost / section */
  mats.setMode = (mode, clipPlanes = []) => {
    for (const m of all) {
      m.clippingPlanes = m.userData.isHousing && mode === 'section' ? clipPlanes : [];
      m.clipShadows = true;
      if (!m.userData.isHousing) continue;
      if (mode === 'ghost') {
        m.transparent = true;
        m.opacity = 0.16;
        m.depthWrite = false;
        m.side = THREE.FrontSide;
      } else if (mode === 'section') {
        m.transparent = m.userData.baseTransparent;
        m.opacity = m.userData.baseOpacity;
        m.depthWrite = true;
        m.side = THREE.DoubleSide;
      } else {
        m.transparent = m.userData.baseTransparent;
        m.opacity = m.userData.baseOpacity;
        m.depthWrite = true;
        m.side = m.userData.baseSide;
      }
      m.needsUpdate = true;
    }
  };

  /** 流体腔可见性（透视/剖切时才有意义） */
  mats.setFluidOpacity = (k) => {
    for (const m of fluids) {
      m.opacity = (m.userData.baseOpacity ?? 0.3) * k;
      m.visible = k > 0.02;
    }
  };

  /**
   * 收集场景中"由各系统模块克隆出来"的材质，使它们也参与
   * 透视 / 剖切 / 流道显隐（否则克隆材质会漏掉模式切换）。
   * 在所有零件模块构建完成后调用一次。
   */
  mats.collectFromScene = (root) => {
    const seen = new Set(all);
    let added = 0;
    root.traverse((o) => {
      const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of list) {
        if (!m || seen.has(m)) continue;
        seen.add(m);
        if (m.userData && m.userData.isHousing) housing.push(m);
        if (m.userData && m.userData.baseOpacity === undefined) {
          m.userData.baseOpacity = m.opacity;
          m.userData.baseTransparent = m.transparent;
          m.userData.baseSide = m.side;
        }
        if (FLUID_NAMES.some((n) => (m.name || '').includes(n))) fluids.push(m);
        all.push(m);
        added++;
      }
    });
    return added;
  };

  return mats;
}
