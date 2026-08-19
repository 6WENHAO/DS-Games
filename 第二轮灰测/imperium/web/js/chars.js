// CK3 层：角色、王朝、特质、婚姻、生育、死亡、继承。
import { RNG, clamp } from './rng.js';
import { maleName, femaleName, dynastyName } from './names.js';

export const TRAITS = {
  brilliant_strategist: { zh: '天才统帅', mar: 6, prestige: 0.4 },
  tough_soldier: { zh: '猛将', mar: 3 },
  skilled_tactician: { zh: '良将', mar: 4 },
  craven: { zh: '怯懦', mar: -3, dread: -0.2 },
  genius: { zh: '天才', dip: 4, mar: 3, stw: 4, int: 4, lrn: 5 },
  quick: { zh: '聪慧', dip: 2, mar: 1, stw: 2, int: 2, lrn: 3 },
  slow: { zh: '愚钝', dip: -2, mar: -1, stw: -2, int: -2, lrn: -3 },
  shrewd: { zh: '精明', int: 3, stw: 2 },
  just: { zh: '公正', stw: 2, legit: 0.15 },
  arbitrary: { zh: '专断', stw: -2, unrest: 0.1 },
  brave: { zh: '勇敢', mar: 2 },
  cruel: { zh: '残暴', int: 2, unrest: 0.15 },
  kind: { zh: '仁厚', dip: 2, unrest: -0.1 },
  greedy: { zh: '贪婪', stw: 1, corrupt: 0.15 },
  charitable: { zh: '慷慨', dip: 1, unrest: -0.1 },
  diligent: { zh: '勤勉', stw: 2, adm: 0.1 },
  lazy: { zh: '怠惰', stw: -2, adm: -0.1 },
  proud: { zh: '骄傲', prestige: 0.2, dip: -1 },
  humble: { zh: '谦逊', dip: 1, prestige: -0.1 },
  zealous: { zh: '狂热', piety: 0.3, dip: -1 },
  cynical: { zh: '犬儒', piety: -0.3, int: 2 },
  temperate: { zh: '节制', stw: 1, lrn: 1 },
  gluttonous: { zh: '饕餮', stw: -1, health: -0.15 },
  deceitful: { zh: '狡诈', int: 3, dip: -1 },
  honest: { zh: '诚实', dip: 2, int: -2 },
  ambitious: { zh: '野心勃勃', dip: 1, mar: 1, stw: 1, int: 1, aggr: 0.2 },
  content: { zh: '知足', aggr: -0.2, unrest: -0.05 },
  paranoid: { zh: '多疑', int: 2, dip: -2 },
  trusting: { zh: '轻信', dip: 1, int: -2 },
  lustful: { zh: '好色', fert: 0.25 },
  chaste: { zh: '贞洁', fert: -0.2, piety: 0.1 },
  scholar: { zh: '学者', lrn: 4 },
  poet: { zh: '诗人', dip: 2, prestige: 0.1 },
  theologian: { zh: '神学家', lrn: 3, piety: 0.2 },
  administrator: { zh: '能臣', stw: 4, adm: 0.15 },
  architect: { zh: '营造家', stw: 2, devgrow: 0.15 },
  diplomat: { zh: '外交家', dip: 4, dipTech: 0.1 },
  steward: { zh: '理财家', stw: 4, income: 0.1 },
  duelist: { zh: '决斗者', mar: 3 },
  drunkard: { zh: '酒徒', health: -0.15, dip: -1 },
  lunatic: { zh: '癫狂', health: -0.1, int: 2, dip: -3 },
  possessed: { zh: '附魔', dip: -3, piety: -0.2 },
  berserker: { zh: '狂战士', mar: 4, health: -0.1 },
  pious: { zh: '虔诚', piety: 0.25, legit: 0.1 },
  erudite: { zh: '博学', lrn: 3, int: 1 },
  gregarious: { zh: '合群', dip: 3 },
  shy: { zh: '孤僻', dip: -2, lrn: 1 },
};
const TRAIT_IDS = Object.keys(TRAITS);
const POSITIVE = ['genius', 'quick', 'shrewd', 'just', 'brave', 'kind', 'charitable', 'diligent', 'humble', 'temperate', 'honest', 'ambitious', 'scholar', 'poet', 'theologian', 'administrator', 'architect', 'diplomat', 'steward', 'duelist', 'pious', 'erudite', 'gregarious', 'skilled_tactician', 'tough_soldier', 'brilliant_strategist'];
const NEGATIVE = ['craven', 'slow', 'arbitrary', 'cruel', 'greedy', 'lazy', 'proud', 'zealous', 'cynical', 'gluttonous', 'deceitful', 'paranoid', 'trusting', 'lustful', 'drunkard', 'lunatic', 'possessed', 'shy', 'content'];

export const SUCCESSION = {
  primogeniture: { zh: '长子继承' },
  partition: { zh: '分割继承' },
  seniority: { zh: '兄终弟及' },
  elective: { zh: '选举制' },
  tanistry: { zh: '推举制' },
  appointment: { zh: '任命制' },
  ultimogeniture: { zh: '幼子继承' },
};

export function govSuccession(gov) {
  switch (gov) {
    case 'tribal': case 'clan': return 'tanistry';
    case 'nomadic': case 'khanate': return 'seniority';
    case 'feudal': return 'primogeniture';
    case 'administrative': case 'imperial': return 'primogeniture';
    case 'republic': case 'merchant_republic': case 'city_state': return 'elective';
    case 'theocracy': case 'monastic': return 'appointment';
    case 'elective': return 'elective';
    case 'caliphate': case 'sultanate': return 'seniority';
    case 'shogunate': return 'primogeniture';
    case 'confederation': return 'elective';
    default: return 'primogeniture';
  }
}

let CID = 1;
export function newCharId(tag) { return `${tag}.c${CID++}`; }

export function statsFromTraits(traits, rng) {
  const s = { dip: 4, mar: 4, stw: 4, int: 4, lrn: 4 };
  for (const k of Object.keys(s)) s[k] = clamp(Math.round(rng.gauss(5, 2.2)), 0, 12);
  for (const t of traits) {
    const d = TRAITS[t]; if (!d) continue;
    for (const k of ['dip', 'mar', 'stw', 'int', 'lrn']) if (d[k]) s[k] = clamp(s[k] + d[k], 0, 30);
  }
  return s;
}

export function traitMod(traits, key) {
  let v = 0;
  for (const t of traits) { const d = TRAITS[t]; if (d && d[key]) v += d[key]; }
  return v;
}

export function makeCharacter(world, opts) {
  const rng = opts.rng || world.rng;
  const tag = opts.tag;
  const pol = world.pol.get(tag);
  const group = opts.group || world.cultureGroup(pol?.culture) || 'other';
  const sex = opts.sex || (rng.chance(0.5) ? 'm' : 'f');
  const traits = opts.traits || [
    ...rng.picks(POSITIVE, rng.irange(1, 2)),
    ...(rng.chance(0.65) ? rng.picks(NEGATIVE, 1) : []),
  ];
  const c = {
    id: opts.id || newCharId(tag),
    name: opts.name || (sex === 'm' ? maleName(rng, group) : femaleName(rng, group)),
    dyn: opts.dyn || (pol ? pol.dynasty : dynastyName(rng, group)),
    born: opts.born ?? world.year - rng.irange(16, 45),
    died: null,
    sex, tag,
    role: opts.role || 'courtier',
    traits,
    stats: statsFromTraits(traits, rng),
    spouse: null,
    parent: opts.parent || null,
    children: [],
    prestige: opts.prestige ?? Math.round(rng.range(0, 200)),
    piety: opts.piety ?? Math.round(rng.range(0, 150)),
    health: clamp(1 + traitMod(traits, 'health') + rng.gauss(0, 0.12), 0.4, 1.6),
    claims: [],
    group,
  };
  world.chars.set(c.id, c);
  let idx = world.charsByTag.get(tag);
  if (!idx) world.charsByTag.set(tag, (idx = new Set()));
  idx.add(c.id);
  return c;
}

/** 该政权在世角色（性能关键：只遍历索引，不扫全表） */
export function charsOf(world, tag) {
  const out = [];
  const idx = world.charsByTag.get(tag);
  if (!idx) return out;
  for (const id of idx) {
    const c = world.chars.get(id);
    if (c && !c.died) out.push(c);
  }
  return out;
}

/** 回收：把死者与冗余朝臣从活跃表中移除，避免长期运行时内存与遍历膨胀 */
export function pruneChars(world, pol, keepMax = 18) {
  const idx = world.charsByTag.get(pol.tag);
  if (!idx) return;
  for (const id of [...idx]) {
    const c = world.chars.get(id);
    if (!c) { idx.delete(id); continue; }
    if (c.died) { idx.delete(id); world.chars.delete(id); continue; }
  }
  if (idx.size <= keepMax) return;
  const ruler = world.chars.get(pol.ruler);
  const protect = new Set([pol.ruler, pol.heir, ruler?.spouse, ...(ruler?.children || [])].filter(Boolean));
  const cands = [...idx].map(id => world.chars.get(id)).filter(c => c && !protect.has(c.id))
    .sort((a, b) => a.born - b.born); // 先淘汰年长的旁支
  for (const c of cands) {
    if (idx.size <= keepMax) break;
    idx.delete(c.id); world.chars.delete(c.id);
  }
}

export function age(c, year) { return year - c.born; }

/** monthly death probability */
export function deathChance(c, year, rng) {
  const a = age(c, year);
  let base;
  if (a < 1) base = 0.012;
  else if (a < 5) base = 0.0035;
  else if (a < 15) base = 0.0008;
  else if (a < 40) base = 0.0011;
  else if (a < 55) base = 0.0022;
  else if (a < 65) base = 0.0045;
  else if (a < 75) base = 0.0095;
  else if (a < 85) base = 0.02;
  else base = 0.045;
  return base / clamp(c.health, 0.4, 1.6);
}

export function spawnFamily(world, pol, ruler) {
  const rng = world.rng;
  if (!ruler.spouse && age(ruler, world.year) >= 16 && rng.chance(0.9)) {
    const sp = makeCharacter(world, {
      tag: pol.tag, sex: ruler.sex === 'm' ? 'f' : 'm', role: 'consort',
      born: ruler.born + rng.irange(-6, 10), group: ruler.group,
      dyn: dynastyName(rng, ruler.group),
    });
    sp.spouse = ruler.id; ruler.spouse = sp.id;
  }
  const nKids = rng.irange(1, 4);
  for (let i = 0; i < nKids; i++) {
    const ka = age(ruler, world.year) - rng.irange(18, 40);
    if (ka < 0) continue;
    const kid = makeCharacter(world, {
      tag: pol.tag, role: 'courtier', parent: ruler.id, group: ruler.group,
      dyn: ruler.dyn, born: world.year - ka,
    });
    ruler.children.push(kid.id);
  }
}

/** pick heir per succession law */
export function chooseHeir(world, pol) {
  const ruler = world.chars.get(pol.ruler);
  if (!ruler) return null;
  const law = pol.succession;
  const alive = id => { const c = world.chars.get(id); return c && !c.died; };
  const kids = ruler.children.filter(alive).map(id => world.chars.get(id));
  const sons = kids.filter(k => k.sex === 'm');
  const pool = sons.length ? sons : kids;
  const byAge = arr => arr.slice().sort((a, b) => a.born - b.born);
  if (law === 'primogeniture' && pool.length) return byAge(pool)[0].id;
  if (law === 'ultimogeniture' && pool.length) return byAge(pool)[pool.length - 1].id;
  if (law === 'partition' && pool.length) return byAge(pool)[0].id;
  if (law === 'seniority') {
    const dynMembers = charsOf(world, pol.tag).filter(c => c.dyn === ruler.dyn && c.id !== ruler.id && age(c, world.year) >= 16);
    if (dynMembers.length) return dynMembers.sort((a, b) => a.born - b.born)[0].id;
  }
  if (law === 'elective' || law === 'tanistry') {
    const cands = charsOf(world, pol.tag).filter(c => age(c, world.year) >= 16 && c.id !== ruler.id);
    if (cands.length) {
      cands.sort((a, b) => (b.prestige + b.stats.dip * 12 + b.stats.mar * 8) - (a.prestige + a.stats.dip * 12 + a.stats.mar * 8));
      return cands[0].id;
    }
  }
  if (law === 'appointment') {
    const cands = charsOf(world, pol.tag).filter(c => age(c, world.year) >= 20 && c.id !== ruler.id);
    if (cands.length) return cands.sort((a, b) => (b.piety + b.stats.lrn * 20) - (a.piety + a.stats.lrn * 20))[0].id;
  }
  if (pool.length) return byAge(pool)[0].id;
  return null;
}
