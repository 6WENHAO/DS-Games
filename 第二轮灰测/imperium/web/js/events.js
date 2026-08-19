// 事件系统：CK3 风格角色事件 + EU4 风格国家事件。
import { age, traitMod, TRAITS, charsOf } from './chars.js';
import { clamp } from './rng.js';

/** 每个事件：id, zh标题, 文本(w,pol,ruler)->string, 触发条件, 选项[{zh, tip, effect}] */
export const EVENTS = [
  {
    id: 'harvest_boon', weight: 8,
    cond: (w, p) => p.provs.size > 0,
    title: '丰年',
    text: (w, p, r) => `${p.zh}境内风调雨顺，仓廪充实。${r.name}的臣属请求如何处置这笔盈余。`,
    opts: [
      { zh: '充实国库', tip: '+金钱', eff: (w, p) => { p.treasury += 10 + p.devSum * 0.05; } },
      { zh: '减免赋税', tip: '+稳定 +民心', eff: (w, p) => { p.stability = clamp(p.stability + 1, -3, 3); for (const id of p.provs) { const s = w.prov.get(id); if (s) s.unrest = Math.max(0, s.unrest - 2); } } },
      { zh: '兴修水利', tip: '+发展度', eff: (w, p) => { let n = 0; for (const id of p.provs) { const s = w.prov.get(id); if (s && n++ < 6) s.dev += 0.6; } } },
    ],
  },
  {
    id: 'plague', weight: 5,
    cond: (w, p) => p.provs.size > 2,
    title: '疫病',
    text: (w, p, r) => `瘟疫自商路传入${p.zh}，城镇十室九空。`,
    opts: [
      { zh: '封闭城门', tip: '损失经济，减轻死亡', eff: (w, p) => { p.treasury -= 8; for (const id of p.provs) { const s = w.prov.get(id); if (s) s.dev *= 0.985; } } },
      { zh: '开仓赈济', tip: '花钱换民心', eff: (w, p) => { p.treasury -= 20; p.stability = clamp(p.stability + 1, -3, 3); for (const id of p.provs) { const s = w.prov.get(id); if (s) s.dev *= 0.99; } } },
      { zh: '听天由命', tip: '发展度大损', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) { s.dev *= 0.94; s.unrest += 2; } } p.manpower *= 0.7; } },
    ],
  },
  {
    id: 'court_scholar', weight: 6,
    cond: (w, p) => p.treasury > 15,
    title: '游学之士',
    text: (w, p, r) => `一位声名远播的学者来到${p.zh}宫廷，愿以学识效力于${r.name}。`,
    opts: [
      { zh: '延为国师（-25 金）', tip: '+行政科技点', eff: (w, p) => { p.treasury -= 25; p.admPts += 60; } },
      { zh: '命其编纂典籍', tip: '+威望 +外交点', eff: (w, p) => { p.prestige += 15; p.dipPts += 40; } },
      { zh: '婉言送客', tip: '无', eff: () => {} },
    ],
  },
  {
    id: 'heresy', weight: 5,
    cond: (w, p) => [...p.provs].some(id => w.prov.get(id)?.religion !== p.religion),
    title: '异端滋长',
    text: (w, p, r) => `${p.zh}边地信仰驳杂，教士上书请求整肃。`,
    opts: [
      { zh: '铁腕镇压', tip: '强制改宗，+动乱', eff: (w, p) => { let n = 0; for (const id of p.provs) { const s = w.prov.get(id); if (s && s.religion !== p.religion && n++ < 4) { s.religion = p.religion; s.forcedReligion = true; s.unrest += 5; } } } },
      { zh: '宽容并存', tip: '-动乱 -威望', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) s.unrest = Math.max(0, s.unrest - 3); } p.prestige -= 10; } },
      { zh: '辩经论道', tip: '看学识', eff: (w, p) => { const r = w.chars.get(p.ruler); if (r && r.stats.lrn > 7) { p.prestige += 20; for (const id of p.provs) { const s = w.prov.get(id); if (s && s.religion !== p.religion && w.rng.chance(0.4)) { s.religion = p.religion; s.forcedReligion = true; } } } else p.stability = clamp(p.stability - 1, -3, 3); } },
    ],
  },
  {
    id: 'noble_faction', weight: 6,
    cond: (w, p) => p.provs.size > 4,
    title: '权贵结党',
    text: (w, p, r) => `${p.zh}的大族结成派系，要求${r.name}让出更多权柄。`,
    opts: [
      { zh: '让权求安', tip: '+自治 -收入 +稳定', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) s.autonomy = clamp(s.autonomy + 0.08, 0, 0.9); } p.stability = clamp(p.stability + 1, -3, 3); } },
      { zh: '削藩集权', tip: '-自治 +动乱', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) { s.autonomy = clamp(s.autonomy - 0.12, 0.02, 0.9); s.unrest += 3; } } } },
      { zh: '离间分化', tip: '看谋略', eff: (w, p) => { const r = w.chars.get(p.ruler); if (r && r.stats.int > 7) { p.prestige += 10; for (const id of p.provs) { const s = w.prov.get(id); if (s) s.autonomy = clamp(s.autonomy - 0.06, 0.02, 0.9); } } else { p.stability = clamp(p.stability - 1, -3, 3); } } },
    ],
  },
  {
    id: 'succession_dispute', weight: 4,
    cond: (w, p) => !!p.heir,
    title: '储位之争',
    text: (w, p, r) => { const h = w.chars.get(p.heir); return `朝中对储君${h ? h.name : '继承人'}的资格议论纷纷。`; },
    opts: [
      { zh: '明诏立嗣', tip: '+正统', eff: (w, p) => { p.legitimacy = clamp(p.legitimacy + 12, 0, 100); } },
      { zh: '另择贤者', tip: '换继承人 -正统', eff: (w, p) => { const cands = charsOf(w, p.tag).filter(c => c.id !== p.ruler && c.id !== p.heir && age(c, w.year) > 15); if (cands.length) p.heir = w.rng.pick(cands).id; p.legitimacy = clamp(p.legitimacy - 8, 0, 100); } },
      { zh: '置之不理', tip: '风险', eff: (w, p) => { if (w.rng.chance(0.5)) p.stability = clamp(p.stability - 1, -3, 3); } },
    ],
  },
  {
    id: 'trade_mission', weight: 6,
    cond: (w, p) => [...p.provs].some(id => w.map.provinces[id]?.coast),
    title: '远方商队',
    text: (w, p, r) => `一支来自远方的商队抵达${p.zh}，带来奇珍与消息。`,
    opts: [
      { zh: '开市通商', tip: '+金钱 +外交点', eff: (w, p) => { p.treasury += 15 + p.devSum * 0.03; p.dipPts += 30; } },
      { zh: '征收重税', tip: '+更多金钱 -声望', eff: (w, p) => { p.treasury += 30 + p.devSum * 0.05; p.prestige -= 8; } },
      { zh: '遣使随行', tip: '+外交科技', eff: (w, p) => { p.dipPts += 70; p.treasury -= 10; } },
    ],
  },
  {
    id: 'military_reform', weight: 5,
    cond: (w, p) => p.army > 2,
    title: '军制改革',
    text: (w, p, r) => `${r.name}的将领提出新的编制与操典。`,
    opts: [
      { zh: '推行新制（-30 金）', tip: '+军事科技点', eff: (w, p) => { p.treasury -= 30; p.milPts += 80; } },
      { zh: '扩募常备军', tip: '+军队 -金钱', eff: (w, p) => { const add = Math.min(p.forceLimit * 0.3, p.manpower * 0.5); p.army += add; p.manpower -= add; p.treasury -= add * 2; } },
      { zh: '维持旧制', tip: '+稳定', eff: (w, p) => { p.stability = clamp(p.stability + 1, -3, 3); } },
    ],
  },
  {
    id: 'dynastic_marriage', weight: 6,
    cond: (w, p) => p.provs.size > 0,
    title: '联姻之议',
    text: (w, p, r) => `邻邦提议联姻，以婚约巩固两国关系。`,
    opts: [
      { zh: '缔结婚约', tip: '+同盟机会 +正统', eff: (w, p) => { const neigh = [...w.neighborsOf(p.tag).keys()].filter(t => w.pol.get(t)?.alive); if (neigh.length) { const t = w.rng.pick(neigh); p.allies.add(t); w.pol.get(t).allies.add(p.tag); } p.legitimacy = clamp(p.legitimacy + 6, 0, 100); } },
      { zh: '索要重礼', tip: '+金钱 -关系', eff: (w, p) => { p.treasury += 20; } },
      { zh: '拒绝', tip: '+威望', eff: (w, p) => { p.prestige += 5; } },
    ],
  },
  {
    id: 'rebellion_warning', weight: 5,
    cond: (w, p) => [...p.provs].some(id => (w.prov.get(id)?.unrest || 0) > 7),
    title: '民怨沸腾',
    text: (w, p, r) => `${p.zh}数地民怨沸腾，官吏奏报恐有变乱。`,
    opts: [
      { zh: '发兵威慑', tip: '-动乱 -军力', eff: (w, p) => { p.army = Math.max(0, p.army - 1); for (const id of p.provs) { const s = w.prov.get(id); if (s && s.unrest > 5) s.unrest -= 4; } } },
      { zh: '赈灾免赋（-25 金）', tip: '-动乱 +稳定', eff: (w, p) => { p.treasury -= 25; for (const id of p.provs) { const s = w.prov.get(id); if (s) s.unrest = Math.max(0, s.unrest - 3); } p.stability = clamp(p.stability + 1, -3, 3); } },
      { zh: '严刑峻法', tip: '短期压制，长期恶化', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) { s.unrest = Math.max(0, s.unrest - 6); s.autonomy = clamp(s.autonomy - 0.05, 0.02, 0.9); } } p.prestige -= 5; } },
    ],
  },
  {
    id: 'great_builder', weight: 4,
    cond: (w, p) => p.treasury > 60,
    title: '营造大工',
    text: (w, p, r) => `${r.name}欲在都城兴建足以传世的大工程。`,
    opts: [
      { zh: '建造（-60 金）', tip: '首都+发展度 +威望', eff: (w, p) => { p.treasury -= 60; const s = w.prov.get(p.cap); if (s) s.dev += 3; p.prestige += 40; } },
      { zh: '改为修城', tip: '首都防御 +稳定', eff: (w, p) => { p.treasury -= 30; p.stability = clamp(p.stability + 1, -3, 3); } },
      { zh: '节用为民', tip: '-动乱', eff: (w, p) => { for (const id of p.provs) { const s = w.prov.get(id); if (s) s.unrest = Math.max(0, s.unrest - 1.5); } } },
    ],
  },
  {
    id: 'ruler_illness', weight: 4,
    cond: (w, p) => { const r = w.chars.get(p.ruler); return r && age(r, w.year) > 45; },
    title: '君王染疾',
    text: (w, p, r) => `${r.name}忽感沉疾，御医束手。`,
    opts: [
      { zh: '遍求名医（-30 金）', tip: '提升健康', eff: (w, p) => { p.treasury -= 30; const r = w.chars.get(p.ruler); if (r) r.health = clamp(r.health + 0.2, 0.4, 1.6); } },
      { zh: '祷于神明', tip: '+虔诚，或有奇效', eff: (w, p) => { const r = w.chars.get(p.ruler); if (r) { r.piety += 40; if (w.rng.chance(0.4)) r.health = clamp(r.health + 0.15, 0.4, 1.6); } } },
      { zh: '预备后事', tip: '+正统 +继承稳定', eff: (w, p) => { p.legitimacy = clamp(p.legitimacy + 10, 0, 100); } },
    ],
  },
];

export function pickEvent(world, pol) {
  const cands = EVENTS.filter(e => { try { return e.cond(world, pol); } catch { return false; } });
  if (!cands.length) return null;
  const total = cands.reduce((a, e) => a + e.weight, 0);
  let r = world.rng.next() * total;
  for (const e of cands) { r -= e.weight; if (r <= 0) return e; }
  return cands[0];
}

/** AI 自动选择一个选项 */
export function autoResolve(world, pol, ev) {
  const i = world.rng.int(ev.opts.length);
  try { ev.opts[i].eff(world, pol); } catch { /* ignore */ }
}
