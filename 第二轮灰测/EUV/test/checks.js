/**
 * checks.js — 工程自动校验套件
 * ==================================================================
 * 直接对应规格书 §4 验收清单的可自动化项：
 *   ☐ 10 个工艺步骤全部完整且顺序正确，无组件功能错误
 *   ☐ 参数校准一致，「示意 / Simulation」标注规范
 *   ☐ 无穿模、相交；光路方向正确
 * 每次改动后运行 test/verify.html，全绿方可推进里程碑。
 */

import {
  PARAMS, PROCESS_STEPS, PROVENANCE, SIM_TAGGED_STEPS, PV, needsSimTag,
} from '../src/params.js';
import {
  CHAIN, CHAIN_BY_KEY, MASK, MASK_NORMAL, MASK_INCIDENCE_DEG, MASK_INCIDENT_DIR,
  MASK_INCIDENT_HEADING, POB_ENTRY_DIR,
  POB, ILLUMINATOR, WAFER, IF_POINT, PLASMA, ELLIPSOID, COLLECTOR_APERTURE,
  COLLECTOR_VERTEX, COLLECTOR_REF, COLLECTOR_REF_PHI, collectorNormal,
  DROPLET_NOZZLE, DROPLET_CATCHER, LASER_ORIGIN, LASER_AXIS,
  reflectOffCollector, collectorPoint, incidenceReport, mirrorRadius, patternScaleAt,
  incidenceFromDeviation, deviationFromIncidence,
  vec, mm, MM_PER_UNIT, PURITY, BOUNDS,
} from '../src/layout.js';
import {
  TIMELINE, SHOTS, shotAt, sampleFX, captionAt, allCaptions, allAudioCues,
  stepSpans, CUTS, cutDuration, EASE, kf,
} from '../src/script.js';
import { FILM, QUALITY, BRAND, DEFAULT_LANG } from '../src/config.js';
import { EXAGGERATION, FX_DEFAULTS } from '../src/fx.js';

const { V, add, sub, scale, dot, len, norm } = vec;

// ─── 迷你断言框架 ──────────────────────────────────────────────────
function makeRunner() {
  const lines = []; let passed = 0, failed = 0, total = 0;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const group = (t) => lines.push(`\n<b style="color:#3FA9F5">── ${esc(t)} ──</b>`);
  const ok = (name, detail = '') => { total++; passed++; lines.push(`  <span class="pass">✓</span> ${esc(name)}${detail ? `  <span style="color:#5A6B7C">${esc(detail)}</span>` : ''}`); };
  const bad = (name, detail = '') => { total++; failed++; lines.push(`  <span class="fail">✗ ${esc(name)}</span>  <span class="fail">${esc(detail)}</span>`); };
  const check = (name, cond, detail = '') => (cond ? ok(name, detail) : bad(name, detail));
  const near = (name, actual, expect, tol, unit = '') =>
    check(name, Math.abs(actual - expect) <= tol,
      `实测 ${fmt(actual)}${unit} / 期望 ${fmt(expect)}±${tol}${unit}`);
  const info = (t) => lines.push(`    <span style="color:#5A6B7C">${esc(t)}</span>`);
  return { lines, group, ok, bad, check, near, info, get passed() { return passed; }, get failed() { return failed; }, get total() { return total; } };
}
const fmt = (n) => (typeof n === 'number' ? (Math.abs(n) < 1e-6 ? n.toExponential(2) : n.toFixed(4).replace(/\.?0+$/, '')) : String(n));

// 规格书 §1.1 列举的 10 步顺序（逐字对齐，不得改动）
const CANONICAL_ORDER = [
  'droplet',      // 锡滴发生器高频喷射
  'prepulse',     // 预脉冲压扁成盘
  'mainpulse',    // 主脉冲汽化成等离子体
  'emission',     // 辐射 13.5 nm EUV
  'collector',    // 多层膜集光镜 → 中间焦点
  'purity',       // 光谱纯化与锡碎屑防护
  'illuminator',  // 照明光学整形均匀照明
  'mask',         // 反射式多层膜掩模
  'projection',   // 投影光学 4:1
  'exposure',     // 光刻胶曝光 → 潜影 → 芯片图形
];

export async function runAllChecks() {
  const R = makeRunner();

  // ═══════════════════════════════════════════════════════════════
  R.group('A. 工艺链完整性与顺序（§1.1）');
  // ═══════════════════════════════════════════════════════════════
  R.check('工艺步骤数量 = 10', PROCESS_STEPS.length === 10, `实测 ${PROCESS_STEPS.length}`);
  R.check('order 字段为 1..10 严格递增',
    PROCESS_STEPS.every((s, i) => s.order === i + 1),
    PROCESS_STEPS.map((s) => s.order).join(','));
  const keys = PROCESS_STEPS.map((s) => s.key);
  R.check('步骤 key 唯一', new Set(keys).size === keys.length);
  R.check('步骤顺序与规格书 §1.1 逐项一致',
    keys.join('>') === CANONICAL_ORDER.join('>'),
    `实测 ${keys.join('>')}`);
  for (const s of PROCESS_STEPS) {
    const missing = s.params.filter((p) => !PARAMS[p]);
    R.check(`步骤 ${s.order} 「${s.zh}」参数引用有效`, missing.length === 0, missing.join(','));
    R.check(`步骤 ${s.order} 中英文案齐备`,
      !!(s.zh && s.en && s.zhDesc && s.enDesc && s.zhDesc.length > 20 && s.enDesc.length > 20));
  }
  // 组件功能不得错误：关键功能断言
  R.check('预脉冲功能 = 压扁成盘（非汽化）',
    /压扁|圆盘/.test(PROCESS_STEPS[1].zhDesc) && !/汽化|等离子体/.test(PROCESS_STEPS[1].zhDesc));
  R.check('主脉冲功能 = 汽化成等离子体',
    /汽化|等离子体/.test(PROCESS_STEPS[2].zhDesc));
  R.check('掩模明确为反射式且否证透射式',
    /反射式/.test(PROCESS_STEPS[7].zhDesc) && /不存在透射式/.test(PROCESS_STEPS[7].zhDesc));
  R.check('EUV 不可见性已在辐射步骤中声明',
    /人眼不可见/.test(PROCESS_STEPS[3].zhDesc) && /invisible/i.test(PROCESS_STEPS[3].enDesc));
  R.check('投影光学声明为反射镜且无透镜',
    /反射镜/.test(PROCESS_STEPS[8].zhDesc) && /no lenses/i.test(PROCESS_STEPS[8].enDesc));
  R.check('未以 DUV 冒充 EUV：波长锁定 13.5 nm',
    PARAMS.wavelength.value === 13.5 && PARAMS.wavelength.unit === 'nm');
  R.check('全片无透射光学元件（CHAIN 中仅 mirror/mask/focus/source/wafer）',
    CHAIN.nodes.every((n) => ['mirror', 'mask', 'focus', 'source', 'wafer'].includes(n.kind)),
    [...new Set(CHAIN.nodes.map((n) => n.kind))].join(','));

  // ═══════════════════════════════════════════════════════════════
  R.group('B. 参数一致性与标注规范（§1.2）');
  // ═══════════════════════════════════════════════════════════════
  const ids = Object.keys(PARAMS);
  R.check('每条参数 id 与键名一致', ids.every((k) => PARAMS[k].id === k));
  R.check('每条参数具备 provenance', ids.every((k) => Object.values(PROVENANCE).includes(PARAMS[k].provenance)));
  R.check('每条参数具备中英名称', ids.every((k) => PARAMS[k].zh && PARAMS[k].en));
  const noNote = ids.filter((k) => !PARAMS[k].note || PARAMS[k].note.length <= 4);
  R.check('每条参数具备来源/推算说明', noNote.length === 0, noNote.join(','));

  const schematic = ids.filter(needsSimTag);
  R.info(`示意值 ${schematic.length} 条，必须携带「示意 / Simulation」标注：${schematic.join(', ')}`);
  R.check('所有示意值的说明文字自带「示意」字样',
    schematic.every((k) => /示意/.test(PARAMS[k].note)),
    schematic.filter((k) => !/示意/.test(PARAMS[k].note)).join(','));

  // 交叉一致性 —— 数值之间不得互相矛盾
  R.near('锡滴间距 = 速度 / 频率',
    PARAMS.dropletSpacing.value,
    (PARAMS.dropletVelocity.value / PARAMS.dropletRate.value) * 1000, 0.01, ' mm');
  R.near('光子能量 = hc/λ',
    PARAMS.photonEnergy.value, 1239.841984 / PARAMS.wavelength.value, 0.05, ' eV');
  R.near('多层膜周期 ≈ λ/2',
    PARAMS.multilayerPeriod.value, PARAMS.wavelength.value / 2, 0.25, ' nm');
  const fm = PARAMS.exposureFieldMask.value.split('×').map((s) => parseFloat(s));
  const fw = PARAMS.exposureFieldWafer.value.split('×').map((s) => parseFloat(s));
  R.check('掩模场 = 晶圆场 × 4（4:1 缩比自洽）',
    Math.abs(fm[0] - fw[0] * 4) < 0.01 && Math.abs(fm[1] - fw[1] * 4) < 0.01,
    `掩模 ${fm.join('×')} / 晶圆 ${fw.join('×')}`);
  R.check('缩比标注为 4:1', PARAMS.demagnification.value === '4:1');
  R.check('掩模入射角参数 = 6°', PARAMS.maskIncidenceAngle.value === 6);
  R.check('锡滴直径标注为区间 25–30 µm', PARAMS.dropletDiameter.value === '25–30' && PARAMS.dropletDiameter.unit === 'µm');
  R.check('锡滴频率 = 50,000 滴/秒', PARAMS.dropletRate.value === 50000);
  R.check('驱动激光为 CO₂ 双脉冲', /CO₂/.test(PARAMS.driveLaserType.value) && !!PARAMS.prePulseRole && !!PARAMS.mainPulseRole);
  R.check('PV() 取值格式正确', PV('wavelength') === '13.5 nm' && PV('dropletRate') === '50,000 滴/秒', `${PV('wavelength')} / ${PV('dropletRate')}`);
  R.check('每个工艺步骤均在需标注集合内', PROCESS_STEPS.every((s) => SIM_TAGGED_STEPS.has(s.key)));

  // ═══════════════════════════════════════════════════════════════
  R.group('C. 光路方向正确性（§1.3）');
  // ═══════════════════════════════════════════════════════════════
  // C1 椭球集光镜：任意自 F1 出射的光线必过 F2
  let worstMiss = 0, worstAt = null, samples = 0;
  for (let i = 0; i <= 24; i++) {
    const phi = COLLECTOR_APERTURE.phiMin + (COLLECTOR_APERTURE.phiMax - COLLECTOR_APERTURE.phiMin) * (i / 24);
    for (let j = 0; j < 8; j++) {
      const theta = (j / 8) * Math.PI * 2;
      const r = reflectOffCollector(phi, theta);
      samples++;
      if (r.missDistanceToIF > worstMiss) { worstMiss = r.missDistanceToIF; worstAt = { phi, theta }; }
    }
  }
  R.check(`集光镜 ${samples} 条采样光线全部收敛于中间焦点`, worstMiss < 1e-9,
    `最大偏离 ${worstMiss.toExponential(3)} unit (= ${(worstMiss * MM_PER_UNIT).toExponential(3)} mm)`);
  R.check('椭球焦点 F1 = 等离子体点', len(sub(ELLIPSOID.f1, PLASMA)) < 1e-12);
  R.check('椭球焦点 F2 = 中间焦点', len(sub(ELLIPSOID.f2, IF_POINT)) < 1e-12);
  R.near('椭球关系 a² = b² + c²', ELLIPSOID.a ** 2, ELLIPSOID.b ** 2 + ELLIPSOID.c ** 2, 1e-9);
  // 集光镜必须位于等离子体背后（+X 为下游）
  R.check('集光镜位于等离子体上游（光路方向 -X→+X 正确）', COLLECTOR_VERTEX.x < PLASMA.x && PLASMA.x < IF_POINT.x,
    `顶点 x=${fmt(COLLECTOR_VERTEX.x)} < 等离子体 x=${fmt(PLASMA.x)} < IF x=${fmt(IF_POINT.x)}`);

  // C2 驱动激光穿中心孔命中锡滴
  const holeEdge = collectorPoint(COLLECTOR_APERTURE.phiMin, 0).point;
  const holeR = Math.hypot(holeEdge.y, holeEdge.z);
  R.check('CO₂ 驱动激光轴与椭球轴共线并穿过集光镜中心孔',
    Math.abs(LASER_ORIGIN.y) < 1e-12 && Math.abs(LASER_ORIGIN.z) < 1e-12 &&
    Math.abs(LASER_AXIS.x - 1) < 1e-12 && holeR > 0.2,
    `中心孔半径 ${fmt(holeR)} unit ≈ ${fmt(holeR * MM_PER_UNIT)} mm（示意放大）`);
  R.check('驱动激光自集光镜背后射入并命中等离子体点',
    LASER_ORIGIN.x < COLLECTOR_VERTEX.x && PLASMA.x > COLLECTOR_VERTEX.x);

  // C3 锡滴射流精确穿过等离子体点
  const jetToPlasma = sub(PLASMA, DROPLET_NOZZLE);
  R.check('锡滴射流轴精确穿过等离子体点',
    Math.abs(jetToPlasma.x) < 1e-12 && Math.abs(jetToPlasma.z) < 1e-12 && jetToPlasma.y < 0,
    `喷嘴 y=${fmt(DROPLET_NOZZLE.y)} → 捕集器 y=${fmt(DROPLET_CATCHER.y)}`);
  R.check('锡滴射流与驱动激光轴正交（垂直交汇于等离子体点）',
    Math.abs(dot(norm(jetToPlasma), LASER_AXIS)) < 1e-12);

  // C4 掩模 6° 硬约束
  R.near('掩模入射角 = 6.000°', MASK_INCIDENCE_DEG, 6, 1e-6, '°');
  R.check('掩模反射主光线精确竖直向下（进入投影物镜）',
    Math.abs(POB_ENTRY_DIR.x) < 1e-12 && Math.abs(POB_ENTRY_DIR.z) < 1e-12 && POB_ENTRY_DIR.y === -1);
  const reflChk = (() => { const d = MASK_INCIDENT_DIR, n = MASK.normal; return norm(sub(d, scale(n, 2 * dot(d, n)))); })();
  R.check('反射律自洽：reflect(入射, 掩模法线) = 竖直向下',
    len(sub(reflChk, POB_ENTRY_DIR)) < 1e-12, `实得 (${fmt(reflChk.x)}, ${fmt(reflChk.y)}, ${fmt(reflChk.z)})`);
  R.check('照明末镜位于掩模左下方（入射光自左下来，读图方向正确）',
    MASK_INCIDENT_DIR.x > 0 && MASK_INCIDENT_DIR.y > 0);
  R.check('掩模位于晶圆上方（掩模在上、晶圆在下的机器拓扑正确）',
    MASK.pos.y > WAFER.pos.y, `掩模 y=${fmt(MASK.pos.y)} / 晶圆 y=${fmt(WAFER.pos.y)}`);

  // C5 ★ 折返式光路：多层膜近法向入射是硬物理约束
  //    偏转角 Δ 与入射角 θ 的关系 θ = 90° − Δ/2 —— 大角度折线光路是物理错误
  R.near('偏转/入射换算自洽 θ(Δ=156°) = 12°', incidenceFromDeviation(156), 12, 1e-9, '°');
  R.near('偏转/入射换算自洽 Δ(θ=23°) = 134°', deviationFromIncidence(23), 134, 1e-9, '°');
  const rep = incidenceReport();
  for (const m of rep) {
    const limit = m.key.startsWith('POB') ? 13 : (m.key === 'MASK' ? 6.001 : (m.key === 'COLLECTOR' ? 15 : 24));
    R.check(`${m.zh} 入射角 ${fmt(m.incidenceDeg)}° ≤ ${limit}°（多层膜近法向要求）`,
      m.incidenceDeg <= limit, `θ=${fmt(m.incidenceDeg)}° / Δ=${fmt(m.deviationDeg)}°`);
  }
  R.check('所有反射镜均为折返式（主光线偏转角 Δ ≥ 130°）',
    rep.filter((m) => m.key !== 'MASK').every((m) => Math.abs(m.deviationDeg) >= 130),
    rep.map((m) => `${m.key}:${fmt(m.deviationDeg)}°`).join(' '));
  // 集光镜代表点的角平分线法线必须等于真实椭球内法线 —— 建模与光路不是两套数据
  const collNodeNormal = rep.find((m) => m.key === 'COLLECTOR')?.normal;
  const ellipsoidInward = scale(collectorNormal(COLLECTOR_REF), -1);
  R.check('集光镜代表点：角平分线法线 = 真实椭球内法线',
    collNodeNormal && len(sub(collNodeNormal, ellipsoidInward)) < 1e-9,
    collNodeNormal ? `Δ=${(len(sub(collNodeNormal, ellipsoidInward))).toExponential(2)}` : 'missing');
  R.check('集光镜代表点确实位于椭球面上',
    Math.abs((COLLECTOR_REF.x - ELLIPSOID.center.x) ** 2 / ELLIPSOID.a ** 2
      + (COLLECTOR_REF.y ** 2 + COLLECTOR_REF.z ** 2) / ELLIPSOID.b ** 2 - 1) < 1e-12);
  R.check(`投影物镜镜片数 = ${PARAMS.pobMirrorCount.value}`, POB.length === PARAMS.pobMirrorCount.value, `实测 ${POB.length}`);
  R.check(`照明系统镜片数 = 3（场面镜 / 光瞳面镜 / 末镜）`, ILLUMINATOR.mirrors.length === 3);
  R.near('全机反射镜总数与参数表一致',
    1 + ILLUMINATOR.mirrors.length + 1 + POB.length, PARAMS.totalMirrors.value, 0, ' 片');
  R.check('晶圆为正入射（末段主光线垂直晶圆面）',
    Math.abs(dot(WAFER.incomingDir, scale(WAFER.normal, -1)) - 1) < 1e-12);
  R.check('4:1 缩比在光路上单调收缩（掩模 ×4 → 晶圆 ×1）',
    Math.abs(patternScaleAt('MASK') - 4) < 1e-9 && Math.abs(patternScaleAt('WAFER') - 1) < 1e-9);
  R.near('掩模入射主光线航向 = 90° − 2×6° = 78°', MASK_INCIDENT_HEADING, 78, 1e-9, '°');

  // C6 光路链自洽
  const segs = CHAIN.nodes.slice(1).map((n) => n.segLength);
  R.check('主光线折线无零长/负长段', segs.every((s) => s > 0.5), `最短段 ${fmt(Math.min(...segs))} unit`);
  R.check('累计弧长严格递增', CHAIN.nodes.every((n, i) => i === 0 || n.arcLength > CHAIN.nodes[i - 1].arcLength));
  R.check('归一化进度 t ∈ [0,1] 且首尾为 0 / 1',
    CHAIN.nodes[0].t === 0 && Math.abs(CHAIN.nodes.at(-1).t - 1) < 1e-12);
  R.check('净化段位于等离子体与 IF 之间（顺序 5→6 的空间自洽）',
    PURITY.gasCurtain.from.x > PLASMA.x && PURITY.spf.pos.x < IF_POINT.x + 1e-9 && PURITY.spf.pos.x > PURITY.gasCurtain.from.x);
  R.info(`主光线总长 ${fmt(CHAIN.total)} unit ≈ ${fmt(CHAIN.total * MM_PER_UNIT / 1000)} m（示意压缩）`);

  // ═══════════════════════════════════════════════════════════════
  R.group('D. 几何无相交 / 无穿模（§1.3）');
  // ═══════════════════════════════════════════════════════════════
  // D1 镜面之间不得相交
  const mirrors = CHAIN.nodes.filter((n) => n.kind === 'mirror' && n.key !== 'COLLECTOR');
  let minGap = Infinity, gapPair = '';
  for (let i = 0; i < mirrors.length; i++) {
    for (let j = i + 1; j < mirrors.length; j++) {
      const d = len(sub(mirrors[i].pos, mirrors[j].pos));
      const need = mirrorRadius(mirrors[i].key) + mirrorRadius(mirrors[j].key);
      const gap = d - need;
      if (gap < minGap) { minGap = gap; gapPair = `${mirrors[i].key}↔${mirrors[j].key}`; }
    }
  }
  R.check('任意两片反射镜均不相交', minGap > 0, `最小间隙 ${fmt(minGap)} unit @ ${gapPair}`);

  // D2 光路不得穿过与该段无关的实体（镜体 + 掩模基板 + 晶圆）
  const distPointSeg = (p, a, b) => {
    const ab = sub(b, a); const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
    return len(sub(p, add(a, scale(ab, t))));
  };
  const obstacles = [
    ...mirrors.map((m) => ({ key: m.key, pos: m.pos, r: mirrorRadius(m.key) * 0.72 })),
    { key: 'MASK_BLANK', pos: MASK.pos, r: MASK.blank.w * 0.5 },
    { key: 'WAFER_DISC', pos: WAFER.pos, r: WAFER.diameter * 0.5 * 0.35 },
  ];
  const blockers = [];
  for (let i = 1; i < CHAIN.nodes.length; i++) {
    const a = CHAIN.nodes[i - 1], b = CHAIN.nodes[i];
    for (const o of obstacles) {
      if (o.key === a.key || o.key === b.key) continue;
      if (o.key === 'MASK_BLANK' && (a.key === 'MASK' || b.key === 'MASK')) continue;
      if (o.key === 'WAFER_DISC' && (a.key === 'WAFER' || b.key === 'WAFER')) continue;
      const d = distPointSeg(o.pos, a.pos, b.pos);
      if (d < o.r) blockers.push(`${a.key}→${b.key} 被 ${o.key} 遮挡 (d=${fmt(d)} < ${fmt(o.r)})`);
    }
  }
  R.check('光路各段不被无关实体遮挡（无穿模）', blockers.length === 0, blockers.join(' | '));

  // D3 锡滴射流不得穿过集光镜实体（须在中心孔与外缘之间通过）
  const jetAtCollector = Math.abs(DROPLET_NOZZLE.x - COLLECTOR_VERTEX.x);
  R.check('锡滴射流平面与集光镜顶点保持轴向间距（射流不穿镜体）', jetAtCollector > 5,
    `轴向间距 ${fmt(jetAtCollector)} unit`);

  // D4 关键尺寸自洽
  R.near('晶圆直径 300 mm 换算正确', WAFER.diameter * MM_PER_UNIT, 300, 0.01, ' mm');
  R.near('掩模基板 152 mm 换算正确', MASK.blank.w * MM_PER_UNIT, 152, 0.01, ' mm');
  R.check('掩模图形场 = 晶圆场 × 4（几何层同样自洽）',
    Math.abs(MASK.field.w / WAFER.field.w - 4) < 1e-9 && Math.abs(MASK.field.h / WAFER.field.h - 4) < 1e-9,
    `${fmt(MASK.field.w / WAFER.field.w)}×`);

  // ═══════════════════════════════════════════════════════════════
  R.group('E. 叙事与时间轴（§1.3 完整叙事与完成感）');
  // ═══════════════════════════════════════════════════════════════
  R.near('母版帧率 = 30 fps', TIMELINE.fps, 30, 0, ' fps');
  R.check('正片时长在规格书建议区间 2–4 分钟内',
    TIMELINE.duration >= 120 && TIMELINE.duration <= 240, `实测 ${fmt(TIMELINE.duration)} s`);
  R.near('时长与配置一致', TIMELINE.duration, FILM.duration, 1e-9, ' s');
  R.near('总帧数 = 时长 × 帧率', TIMELINE.frames, TIMELINE.duration * FILM.fps, 0, ' 帧');
  R.check('镜头 id 唯一', new Set(TIMELINE.shots.map((s) => s.id)).size === TIMELINE.shots.length);
  R.check('镜头首尾相接、无空隙无重叠',
    TIMELINE.shots.every((s, i) => i === 0 || Math.abs(s.start - TIMELINE.shots[i - 1].end) < 1e-9));
  R.check('每个镜头都有名称、描述与摄影机定义',
    TIMELINE.shots.every((s) => s.name && s.desc && s.desc.length > 10 && s.camera && s.camera.from && s.camera.to));
  R.check('每个镜头的摄影机机位为有限数值（不含 NaN）',
    TIMELINE.shots.every((s) => [s.camera.from, s.camera.to, s.camera.lookFrom, s.camera.lookTo]
      .every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z))));

  const spans = stepSpans();
  R.check('时间轴覆盖全部 10 个工艺步骤', spans.length === 10, `实测 ${spans.length}`);
  R.check('时间轴中的步骤顺序与规格书 §1.1 完全一致',
    spans.map((s) => s.step).join('>') === CANONICAL_ORDER.join('>'), spans.map((s) => s.step).join('>'));
  R.check('各步骤时间区间互不重叠且严格递增',
    spans.every((s, i) => i === 0 || s.start >= spans[i - 1].end - 1e-9));
  const shortest = Math.min(...spans.map((s) => s.end - s.start));
  R.check('每个步骤时长 ≥ 6 s（观众可读）', shortest >= 6, `最短 ${fmt(shortest)} s`);
  for (const sp of spans) {
    const st = PROCESS_STEPS.find((x) => x.key === sp.step);
    R.info(`步骤 ${st.order} ${st.zh}：${fmt(sp.start)}–${fmt(sp.end)} s（${sp.shots.join(',')}）`);
  }

  const rigLike = (t) => { const { shot, local } = shotAt(t); return { shot: shot.id, local }; };
  R.check('shotAt() 为确定性纯函数（同一时间多次调用结果一致）',
    JSON.stringify(rigLike(77.3)) === JSON.stringify(rigLike(77.3)));
  R.check('shotAt() 覆盖 [0, duration] 且边界安全',
    !!shotAt(0).shot && !!shotAt(TIMELINE.duration - 1e-6).shot && !!shotAt(TIMELINE.duration).shot);
  const nanFx = [];
  for (let f = 0; f < TIMELINE.frames; f += 7) {
    const t = f / FILM.fps;
    const { shot, local } = shotAt(t);
    const fx = sampleFX(shot, local);
    for (const [k, v] of Object.entries(fx)) {
      if (typeof v === 'number' && !Number.isFinite(v)) nanFx.push(`${shot.id}.${k}@${fmt(t)}`);
    }
  }
  R.check('全片 fx 控制曲线无 NaN / Infinity（NaN 会经 Bloom 扩散毁掉整帧）',
    nanFx.length === 0, nanFx.slice(0, 6).join(' '));
  R.check('缓动函数在 [0,1] 上取值有界',
    Object.entries(EASE).every(([, f]) => {
      for (let i = 0; i <= 20; i++) { const v = f(i / 20); if (!Number.isFinite(v) || v < -0.02 || v > 1.02) return false; }
      return true;
    }));
  R.check('kf() 关键帧采样端点正确',
    kf([[0, 5], [1, 9]])(0) === 5 && kf([[0, 5], [1, 9]])(1) === 9 && kf([[0.2, 1], [0.8, 3]])(0.1) === 1);

  // ★ 镜头交界处的 fx 连续性
  //   本片是一条连续运镜（每个镜头的 from = 上一镜头的 to），没有硬切。
  //   因此交界两侧的光效控制量必须连续，否则会在交界帧出现可见闪烁（§1.3）。
  //   例外：刻意的瞬时量（白闪 flash、撞击 shake、单次脉冲）允许不连续。
  //  heroPos / heroVisible / pancake：主角锡滴是离散对象，其可见性由 heroVisible 门控，
  //  不可见期间的位置跳变不会上屏，故归入瞬时量。
  //  scan：曝光狭缝位置。在着色器中被 latent 门控（slit = exp(...) × uLatent），
  //  latent = 0 时该通道不上屏，故其跳变不可见 —— 下方另有专门断言验证该门控。
  const TRANSIENT = new Set([
    'flash', 'shake', 'prePulse', 'mainPulse',
    'heroPos', 'heroVisible', 'pancake', 'scan',
  ]);
  const CONTINUITY_TOL = 0.08;
  const jumps = [];
  for (let i = 0; i < TIMELINE.shots.length - 1; i++) {
    const a = TIMELINE.shots[i], b = TIMELINE.shots[i + 1];
    if (b.cut) continue;                                // 显式声明的硬切，允许跳变
    const fa = sampleFX(a, 1), fb = sampleFX(b, 0);
    const keys = new Set([...Object.keys(fa), ...Object.keys(fb), ...Object.keys(FX_DEFAULTS)]);
    for (const k of keys) {
      if (TRANSIENT.has(k)) continue;
      // 未声明的通道取渲染代码的真实默认值（FX_DEFAULTS），避免误报
      const dflt = FX_DEFAULTS[k] ?? 0;
      const va = typeof fa[k] === 'number' ? fa[k] : dflt;
      const vb = typeof fb[k] === 'number' ? fb[k] : dflt;
      if (Math.abs(va - vb) > CONTINUITY_TOL) {
        jumps.push(`${a.id}→${b.id} ${k}: ${fmt(va)}→${fmt(vb)} (Δ${fmt(Math.abs(va - vb))})`);
      }
    }
  }
  R.check('连续运镜的镜头交界处光效连续（无交界闪烁）', jumps.length === 0,
    jumps.slice(0, 10).join(' | '));

  // 门控验证：凡 scan 在交界处跳变，该处的 latent 必须为 0（否则狭缝会瞬移，肉眼可见）
  const gateViolations = [];
  for (let i = 0; i < TIMELINE.shots.length - 1; i++) {
    const a = TIMELINE.shots[i], b = TIMELINE.shots[i + 1];
    if (b.cut) continue;
    const fa = sampleFX(a, 1), fb = sampleFX(b, 0);
    const sa = typeof fa.scan === 'number' ? fa.scan : FX_DEFAULTS.scan;
    const sb = typeof fb.scan === 'number' ? fb.scan : FX_DEFAULTS.scan;
    if (Math.abs(sa - sb) > CONTINUITY_TOL) {
      const la = fa.latent ?? 0, lb = fb.latent ?? 0;
      if (Math.max(la, lb) > 0.02) {
        gateViolations.push(`${a.id}→${b.id} scan ${fmt(sa)}→${fmt(sb)} 但 latent=${fmt(Math.max(la, lb))}`);
      }
    }
  }
  R.check('曝光狭缝跳变处均被 latent 门控为不可见', gateViolations.length === 0,
    gateViolations.join(' | '));
  const camJumps = [];
  for (let i = 1; i < TIMELINE.shots.length; i++) {
    const p = TIMELINE.shots[i - 1], c = TIMELINE.shots[i];
    const d = Math.max(...['x', 'y', 'z'].map((k) => Math.abs((p.camera.to[k] ?? 0) - (c.camera.from[k] ?? 0))));
    if (d > 1e-6 && !c.cut) camJumps.push(`${p.id}→${c.id} Δ${fmt(d)}（未声明 cut）`);
  }
  R.check('摄影机机位连续，或该处已显式声明 cut: true', camJumps.length === 0, camJumps.join(' | '));
  const declaredCuts = TIMELINE.shots.filter((s) => s.cut).map((s) => s.id);
  R.info(`显式硬切点：${declaredCuts.length ? declaredCuts.join(', ') : '无（全片一条连续运镜）'}`);

  // ═══════════════════════════════════════════════════════════════
  R.group('F. 字幕与音画同步（§1.3 / §2）');
  // ═══════════════════════════════════════════════════════════════
  const caps = allCaptions();
  R.check('字幕条目数 > 40（叙事密度足够）', caps.length > 40, `实测 ${caps.length} 条`);
  R.check('每条字幕中英俱全', caps.every((c) => c.zh && c.en && c.zh.length > 1 && c.en.length > 3));
  R.check('字幕时间严格递增、无负时长',
    caps.every((c, i) => c.end > c.start && (i === 0 || c.start >= caps[i - 1].start - 1e-9)));
  const overlaps = caps.filter((c, i) => i > 0 && c.start < caps[i - 1].end - 1e-6);
  R.check('同一时刻不出现两条字幕（无重叠）', overlaps.length === 0,
    overlaps.slice(0, 3).map((c) => `${c.shot}@${fmt(c.start)}`).join(' '));
  const tooShort = caps.filter((c) => c.end - c.start < 1.0);
  R.check('每条字幕显示时长 ≥ 1.0 s（可读性）', tooShort.length === 0,
    tooShort.slice(0, 4).map((c) => `${c.shot} ${fmt(c.end - c.start)}s`).join(' '));
  const tooLongZh = caps.filter((c) => c.zh.length > 34);
  R.check('中文字幕单条 ≤ 34 字（行长约束）', tooLongZh.length === 0,
    tooLongZh.slice(0, 3).map((c) => `${c.shot}:${c.zh.length}字`).join(' '));
  const tooLongEn = caps.filter((c) => c.en.length > 92);
  R.check('英文字幕单条 ≤ 92 字符（行长约束）', tooLongEn.length === 0,
    tooLongEn.slice(0, 3).map((c) => `${c.shot}:${c.en.length}`).join(' '));
  R.check('字幕全部落在片长内', caps.every((c) => c.start >= 0 && c.end <= TIMELINE.duration + 1e-6));
  const capSteps = new Set(caps.filter((c) => c.step).map((c) => c.step));
  R.check('10 个工艺步骤均有字幕解说', PROCESS_STEPS.every((s) => capSteps.has(s.key)),
    PROCESS_STEPS.filter((s) => !capSteps.has(s.key)).map((s) => s.key).join(','));

  const allZh = caps.map((c) => c.zh).join(' ');
  const allEn = caps.map((c) => c.en).join(' ');
  R.check('字幕中的波长表述与参数表一致（13.5 nm / 13.5 纳米）',
    /13\.5\s*(nm|纳米)/.test(allZh) && /13\.5\s*nanometres?/.test(allEn));
  R.check('字幕未把 EUV 掩模称作透射式掩模', !/透射式掩模(?!$)/.test(allZh.replace('EUV 光刻不存在透射式掩模', '')));
  R.check('字幕未把投影物镜称作透镜或镜头组', !/投影透镜|镜头组/.test(allZh));
  R.check('字幕明示 EUV 人眼不可见（§1.2 强制）', /不可见/.test(allZh) && /invisible/i.test(allEn));
  R.check('字幕明示 4:1 缩比方向为「缩小」',
    /缩小|四分之一/.test(allZh) && /(shrink|reduction|quarter)/i.test(allEn));

  const cues = allAudioCues();
  R.check('音频提示点 > 20', cues.length > 20, `实测 ${cues.length} 个`);
  R.check('音频提示点时间递增且落在片长内',
    cues.every((c, i) => (i === 0 || c.time >= cues[i - 1].time - 1e-9) && c.time >= 0 && c.time <= TIMELINE.duration));
  const cueNames = new Set(cues.map((c) => c.cue));
  for (const need of ['prepulse_hit', 'main_impact', 'plasma_hum', 'expose', 'develop', 'finale']) {
    R.check(`关键动作音效存在：${need}`, cueNames.has(need));
  }
  const s06 = TIMELINE.shots.find((s) => s.id === 'S06');
  const s05 = TIMELINE.shots.find((s) => s.id === 'S05');
  R.near('主脉冲音效与画面冲击时刻对齐',
    cues.find((c) => c.cue === 'main_impact').time, s06.start + 0.30 * s06.dur, 0.1, ' s');
  R.near('预脉冲音效与画面命中时刻对齐',
    cues.find((c) => c.cue === 'prepulse_hit').time, s05.start + 0.36 * s05.dur, 0.1, ' s');

  // ═══════════════════════════════════════════════════════════════
  R.group('G. 交付物与品牌（§2 / §1.3）');
  // ═══════════════════════════════════════════════════════════════
  R.check('母版规格 = 4K UHD 3840×2160', FILM.master.width === 3840 && FILM.master.height === 2160);
  R.check('衍生版本包含 30s / 60s 的横版与竖版共 4 版',
    ['social60_h', 'social60_v', 'social30_h', 'social30_v'].every((id) => FILM.derivatives.some((d) => d.id === id)));
  R.check('竖版分辨率为 9:16',
    FILM.derivatives.filter((d) => d.id.endsWith('_v')).every((d) => Math.abs(d.width / d.height - 9 / 16) < 1e-6));
  R.check('横版分辨率为 16:9',
    FILM.derivatives.filter((d) => d.id.endsWith('_h')).every((d) => Math.abs(d.width / d.height - 16 / 9) < 1e-6));
  R.near('响度目标 = −14 LUFS', FILM.loudness.targetLUFS, -14, 0, ' LUFS');
  R.check('真峰值上限 ≤ −1 dBTP', FILM.loudness.truePeakDbTP <= -1);
  for (const [k, cut] of Object.entries(CUTS)) {
    const want = k.includes('60') ? 60 : 30;
    const got = cutDuration(cut);
    R.check(`${cut.label} 时长落在 ${want}±6 s`, Math.abs(got - want) <= 6, `实测 ${fmt(got)} s`);
    R.check(`${cut.label} 各片段时间有效且落在片长内`,
      cut.segments.every((s) => s.end > s.start && s.start >= 0 && s.end <= TIMELINE.duration + 1e-6));
  }
  const cutCovers = (cut) => {
    const st = new Set();
    for (const seg of cut.segments) {
      for (const sh of TIMELINE.shots) if (sh.step && seg.start < sh.end && seg.end > sh.start) st.add(sh.step);
    }
    return st;
  };
  const c60 = cutCovers(CUTS.social60), c30 = cutCovers(CUTS.social30);
  R.check('60s 版覆盖 ≥ 8 个工艺步骤', c60.size >= 8, `实测 ${c60.size}：${[...c60].join(',')}`);
  R.check('30s 版覆盖 ≥ 4 个工艺步骤', c30.size >= 4, `实测 ${c30.size}：${[...c30].join(',')}`);

  R.check('品牌配置齐备（中英名称 / 标题 / 标语 / 色板 / 字体）',
    !!(BRAND.nameZh && BRAND.nameEn && BRAND.titleZh && BRAND.titleEn && BRAND.taglineZh && BRAND.taglineEn
      && BRAND.colors.primary && BRAND.colors.accent && BRAND.fontStack));
  R.check('无 Logo 文件时有矢量字标回退（不会出现空占位）', typeof BRAND.logoUrl === 'string');
  R.check('片头与片尾镜头存在',
    TIMELINE.shots.some((s) => s.hud?.title) && TIMELINE.shots.some((s) => s.hud?.endCard));
  R.check('默认字幕语言为双语', DEFAULT_LANG === 'bi');
  for (const [k, q] of Object.entries(QUALITY)) {
    R.check(`质量档 ${k} 参数完整`,
      q.bloom && Number.isFinite(q.bloom.strength) && Number.isFinite(q.dropletCount)
      && Number.isFinite(q.beamSegments) && Number.isFinite(q.grain));
  }
  R.check('母版档启用单帧内超采样（消除闪烁的前提）', QUALITY.master.taaLevel >= 3,
    `taaLevel=${QUALITY.master.taaLevel} → 每帧 ${2 ** QUALITY.master.taaLevel} 次抖动采样`);
  R.check('母版档启用景深与阴影', QUALITY.master.dof.enabled && QUALITY.master.shadows);
  R.check('夸张倍率表齐备且均含中文说明',
    Object.values(EXAGGERATION).every((e) => e.factorZh && e.factorZh.length > 6),
    Object.keys(EXAGGERATION).join(','));
  const simNotes = TIMELINE.shots.map((s) => s.hud?.simNote).filter(Boolean);
  R.check('镜头引用的夸张说明键全部存在于 EXAGGERATION 表',
    simNotes.every((k) => !!EXAGGERATION[k]), simNotes.filter((k) => !EXAGGERATION[k]).join(','));
  const techShots = TIMELINE.shots.filter((s) => s.step);
  R.check('每个技术镜头都带工艺步骤标识（HUD 据此常驻示意角标）',
    techShots.length >= 10 && techShots.every((s) => SIM_TAGGED_STEPS.has(s.step)));

  return { lines: R.lines, passed: R.passed, failed: R.failed, total: R.total };
}
