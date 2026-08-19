// 入口：载入数据 → 开始界面 → 游戏循环 → UI。
import { World, RANK_ZH, timelineAt, devAt, techTarget } from './engine.js';
import { MapView, MAP_MODES } from './mapview.js';
import { TRAITS, SUCCESSION, age, charsOf } from './chars.js';
import { pickEvent, autoResolve } from './events.js';

const $ = s => document.querySelector(s);
const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = n => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10).toLocaleString('zh-CN');
/** 显隐：同时设置 hidden 与 style.display —— 作者样式里的 display 会压过 [hidden]，必须双保险 */
function show(sel, on, display = 'flex') {
  const e = typeof sel === 'string' ? $(sel) : sel;
  if (!e) return;
  e.hidden = !on;
  e.style.display = on ? display : 'none';
}

let VOCAB, MAP, world, view, ui = { tab: 'realm', speed: 2, paused: true, sel: null };

/* ================= 载入 ================= */
async function boot() {
  const q = new URLSearchParams(location.search);
  const mapFile = q.get('map') === 'stub' ? 'data/mapdata.stub.json' : 'data/mapdata.json';
  try {
    [VOCAB, MAP] = await Promise.all([
      fetch('data/vocab.json').then(r => r.json()),
      fetch(mapFile).then(r => { if (!r.ok) throw new Error(mapFile + ' 缺失'); return r.json(); }),
    ]);
  } catch (e) {
    $('#loading').innerHTML = `载入失败：${e.message}<br><span class="dim">请先运行 <code>node tools/buildmap.mjs</code> 与 <code>node tools/buildbookmarks.mjs</code> 生成 web/data/mapdata.json</span>`;
    return;
  }
  if (!MAP.bookmarks || !Object.keys(MAP.bookmarks).length) {
    $('#loading').innerHTML = '地图已载入，但没有历史书签数据（bookmarks 为空）。<br><span class="dim">请运行 node tools/buildbookmarks.mjs</span>';
    return;
  }
  show('#loading', false);
  show('#startBody', true, 'block');
  buildStart();
}

/* ================= 开始界面 ================= */
const ERA_NAMES = {
  1: '罗马与汉的世界', 200: '三国与帝国危机', 400: '民族大迁徙', 600: '伊斯兰前夜',
  800: '查理曼与阿拔斯', 1000: '千年之交', 1100: '十字军时代', 1200: '蒙古风暴',
  1300: '黑死病与危机', 1400: '帖木儿与明', 1500: '大航海与火药', 1600: '近世帝国',
};
let startYear = null, startTag = null;

function buildStart() {
  const years = Object.keys(MAP.bookmarks).map(Number).sort((a, b) => a - b);
  const box = $('#bookmarks');
  box.innerHTML = '';
  for (const y of years) {
    const b = el('div', 'bm');
    b.innerHTML = `<div class="y">${y}</div><div class="n">${ERA_NAMES[y] || ''}</div>`;
    b.onclick = () => { startYear = y; startTag = null; renderBookmarks(); renderPolList(); $('#polInfo').textContent = '在左侧选择一个政权。'; $('#startBtn').disabled = true; };
    box.appendChild(b);
  }
  startYear = years[0];
  renderBookmarks(); renderPolList();
  $('#polSearch').oninput = renderPolList;
  $('#startBtn').onclick = () => startGame(startYear, startTag);
  const obs = document.getElementById('observeBtn');
  if (obs) obs.onclick = () => startGame(startYear, null);
  const ld = document.getElementById('loadBtn');
  if (ld) {
    const has = !!localStorage.getItem('imperium.save');
    ld.disabled = !has;
    ld.textContent = has ? '读取存档' : '（无存档）';
    ld.onclick = () => loadGame();
  }
}
function renderBookmarks() {
  const years = Object.keys(MAP.bookmarks).map(Number).sort((a, b) => a - b);
  [...$('#bookmarks').children].forEach((c, i) => c.classList.toggle('on', years[i] === startYear));
}
function renderPolList() {
  const bm = MAP.bookmarks[String(startYear)];
  const q = ($('#polSearch').value || '').trim().toLowerCase();
  const list = bm.polities.slice().sort((a, b) => (b.rank - a.rank) || a.zh.localeCompare(b.zh, 'zh'));
  const box = $('#polList'); box.innerHTML = '';
  $('#polCount').textContent = `（本时代 ${bm.polities.length} 个政权）`;
  let n = 0;
  for (const p of list) {
    if (q && !(p.zh.toLowerCase().includes(q) || p.en.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q))) continue;
    if (n++ > 400) break;
    const row = el('div', 'pol-row');
    const sw = el('span', 'sw'); sw.style.background = p.color || '#888';
    row.appendChild(sw);
    row.appendChild(el('span', null, `${p.zh}`));
    row.appendChild(el('span', 'dim', `${RANK_ZH[p.rank]}·${p.tag}`));
    row.onclick = () => { startTag = p.tag; [...box.children].forEach(c => c.classList.remove('on')); row.classList.add('on'); showPolInfo(p); };
    box.appendChild(row);
  }
}
function showPolInfo(p) {
  const bm = MAP.bookmarks[String(startYear)];
  const ruler = (bm.characters || []).find(c => c.tag === p.tag && c.role === 'ruler');
  const provCount = countProvs(p);
  $('#polInfo').innerHTML = `
    <div style="font-size:19px;color:var(--gold2)">${p.zh} <span class="dim" style="font-size:13px">${p.en}</span></div>
    <div class="kv"><span>政体</span><span>${VOCAB.governments[p.gov]?.zh || p.gov} · ${RANK_ZH[p.rank]}</span></div>
    <div class="kv"><span>首都</span><span>${MAP.provinces[p.cap]?.zh || p.cap}</span></div>
    <div class="kv"><span>宗教 / 文化</span><span>${VOCAB.religions[p.religion]?.zh || p.religion} / ${cultureName(p.culture)}</span></div>
    <div class="kv"><span>科技组</span><span>${VOCAB.techGroups[p.tech_group]?.zh || p.tech_group}（行${p.adm} 外${p.dip} 军${p.mil}）</span></div>
    <div class="kv"><span>疆域</span><span>约 ${provCount} 省</span></div>
    ${ruler ? `<div class="kv"><span>统治者</span><span>${ruler.name}（${ruler.dyn}，${startYear - ruler.born} 岁）</span></div>` : ''}
    ${ruler?.traits?.length ? `<div>${ruler.traits.map(t => `<span class="chip">${TRAITS[t]?.zh || t}</span>`).join('')}</div>` : ''}
    <div class="dim" style="margin-top:6px">${p.desc || ''}</div>`;
  $('#startBtn').disabled = false;
}
function countProvs(p) {
  if (p.provs) return p.provs.length;
  let n = (p.ownProv || []).length;
  const areaSet = new Set(p.ownArea || []);
  const regSet = new Set(p.own || []);
  for (const id of Object.keys(MAP.provinces)) {
    const a = MAP.provinces[id].area, r = MAP.areas[a]?.region;
    if (areaSet.has(a) || regSet.has(r)) n++;
  }
  return n;
}
function cultureName(cid) { return MAP.cultures?.[cid]?.zh || VOCAB.cultureGroups[cid]?.zh || cid; }

/* ================= 存档 ================= */
function saveGame() {
  if (!world) return;
  const data = {
    v: 1, year: world.year, month: world.month, player: world.player, mode: view.mode,
    prov: [...world.prov.entries()].map(([id, s]) => [id, s.owner, s.controller, Math.round(s.dev * 10) / 10,
      s.culture, s.religion, Math.round(s.unrest * 10) / 10, Math.round(s.autonomy * 100) / 100,
      Math.round(s.devastation * 100) / 100, s.forcedCulture ? 1 : 0, s.forcedReligion ? 1 : 0]),
    pol: [...world.pol.values()].map(p => ({
      ...p,
      provs: [...p.provs], vassals: [...p.vassals], tributaries: [...p.tributaries],
      allies: [...p.allies], truces: [...p.truces.entries()], opinions: [],
    })),
    chars: [...world.chars.values()],
    charsByTag: [...world.charsByTag.entries()].map(([t, s]) => [t, [...s]]),
    wars: world.wars.map(w => ({ ...w, att: [...w.att], def: [...w.def], occupied: [...w.occupied.entries()] })),
    log: world.log.slice(-200), chronicle: world.chronicle.slice(-500),
  };
  try {
    localStorage.setItem('imperium.save', JSON.stringify(data));
    world.addLog('已保存进度（浏览器本地存档）。', 'player');
    renderLog();
  } catch (e) { alert('保存失败：' + e.message); }
}

function loadGame() {
  const raw = localStorage.getItem('imperium.save');
  if (!raw) return;
  const d = JSON.parse(raw);
  show('#start', false);
  show('#game', true);
  world = new World(MAP, VOCAB);
  world.loadBookmark(d.year >= 1 && MAP.bookmarks[String(d.year)] ? d.year : Number(Object.keys(MAP.bookmarks)[0]), d.player);
  // 覆盖为存档状态
  world.year = d.year; world.month = d.month; world.player = d.player;
  world.pol.clear(); world.chars.clear(); world.charsByTag.clear();
  for (const p of d.pol) {
    world.pol.set(p.tag, {
      ...p, provs: new Set(p.provs), vassals: new Set(p.vassals), tributaries: new Set(p.tributaries),
      allies: new Set(p.allies), truces: new Map(p.truces), opinions: new Map(),
    });
  }
  for (const c of d.chars) world.chars.set(c.id, c);
  for (const [t, ids] of d.charsByTag) world.charsByTag.set(t, new Set(ids));
  for (const [id, owner, controller, dev, culture, religion, unrest, autonomy, devastation, fc, fr] of d.prov) {
    const st = world.prov.get(id); if (!st) continue;
    Object.assign(st, { owner, controller, dev, culture, religion, unrest, autonomy, devastation,
      forcedCulture: !!fc, forcedReligion: !!fr });
  }
  world.wars = d.wars.map(w => ({ ...w, att: new Set(w.att), def: new Set(w.def), occupied: new Map(w.occupied) }));
  world.log = d.log || []; world.chronicle = d.chronicle || [];
  for (const p of world.pol.values()) world.recalc(p);
  view = new MapView($('#map'), world);
  view.mode = d.mode || 'political';
  view.onSelect = id => { ui.sel = id; renderProv(); };
  view.onHover = (id, x, y) => showTooltip(id, x, y);
  buildModeBar();
  bindUI();
  if (world.player) view.centerOn(world.pol.get(world.player).cap);
  renderAll();
  requestAnimationFrame(loop);
}

/* ================= 游戏启动 ================= */
function startGame(year, tag) {
  show('#start', false);
  show('#game', true);
  world = new World(MAP, VOCAB);
  world.loadBookmark(year, tag);
  view = new MapView($('#map'), world);
  view.onSelect = id => { ui.sel = id; renderProv(); };
  view.onHover = (id, x, y) => showTooltip(id, x, y);
  buildModeBar();
  bindUI();
  if (tag) view.centerOn(world.pol.get(tag).cap);
  renderAll();
  requestAnimationFrame(loop);
}

function buildModeBar() {
  const bar = $('#modebar'); bar.innerHTML = '';
  for (const m of MAP_MODES) {
    const b = el('button', view.mode === m.id ? 'on' : null, m.zh);
    b.onclick = () => { view.mode = m.id; view.markDirty(); [...bar.children].forEach(c => c.classList.remove('on')); b.classList.add('on'); };
    bar.appendChild(b);
  }
  const sep = el('span', 'dim', ' | ');
  bar.appendChild(sep);
  const bl = el('button', 'on', '国界');
  bl.onclick = () => { view.showBorders = !view.showBorders; bl.classList.toggle('on', view.showBorders); view.markDirty(); };
  bar.appendChild(bl);
  const lb = el('button', 'on', '标签');
  lb.onclick = () => { view.labels = !view.labels; lb.classList.toggle('on', view.labels); };
  bar.appendChild(lb);
}

function bindUI() {
  $('#btnPause').onclick = togglePause;
  document.querySelectorAll('.speeds button').forEach(b => {
    b.onclick = () => { ui.speed = Number(b.dataset.sp); syncSpeed(); };
  });
  document.querySelectorAll('.tabs button').forEach(b => {
    b.onclick = () => { ui.tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b)); renderTab(); };
  });
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $('#' + b.dataset.close).style.display = 'none'; });
  $('#logToggle').onclick = () => {
    const b = $('#logBody'); b.style.display = b.style.display === 'none' ? 'block' : 'none';
  };
  window.addEventListener('keydown', e => {
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.key >= '1' && e.key <= '5') { ui.speed = Number(e.key); syncSpeed(); }
    if (e.key === 'Escape') { show('#modal', false); pendingEvent = null; }
    if (e.key === 's' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveGame(); }
  });
  const sb = document.getElementById('saveBtn');
  if (sb) sb.onclick = saveGame;
  syncSpeed();
}
function togglePause() { ui.paused = !ui.paused; $('#btnPause').textContent = ui.paused ? '▶' : '❚❚'; }
function syncSpeed() {
  document.querySelectorAll('.speeds button').forEach(b => b.classList.toggle('on', Number(b.dataset.sp) === ui.speed));
}

/* ================= 主循环 ================= */
const SPEED_MS = { 1: 1400, 2: 800, 3: 420, 4: 190, 5: 70 };
let lastTick = 0, lastDirty = 0, pendingEvent = null;
function loop(ts) {
  requestAnimationFrame(loop);
  if (!ui.paused && !pendingEvent && ts - lastTick > SPEED_MS[ui.speed]) {
    lastTick = ts;
    const ok = world.tick();
    if (!ok) { ui.paused = true; $('#btnPause').textContent = '▶'; world.addLog('—— 1600 年，纪元终章 ——', 'era'); }
    maybeEvent();
    if (ts - lastDirty > 250) { view.syncOwnership(); lastDirty = ts; }
    renderAll();
  }
  view.draw();
}

function maybeEvent() {
  if (!world.player) return;
  const pol = world.pol.get(world.player);
  if (!pol?.alive) return;
  if (world.rng.chance(0.02)) {
    const ev = pickEvent(world, pol);
    if (ev) showEvent(ev, pol);
  }
  // 少量 AI 事件，制造历史噪声
  const list = [...world.pol.values()].filter(p => p.alive && p.tag !== world.player);
  for (let i = 0; i < 3 && list.length; i++) {
    const p = list[world.rng.int(list.length)];
    if (world.rng.chance(0.02)) { const ev = pickEvent(world, p); if (ev) autoResolve(world, p, ev); }
  }
}

function showEvent(ev, pol) {
  pendingEvent = ev;
  const r = world.chars.get(pol.ruler);
  $('#mTitle').textContent = ev.title;
  $('#mText').textContent = ev.text(world, pol, r);
  const box = $('#mOpts'); box.innerHTML = '';
  for (const o of ev.opts) {
    const b = el('button');
    b.innerHTML = `${o.zh}<span class="opt-tip">${o.tip || ''}</span>`;
    b.onclick = () => {
      try { o.eff(world, pol); } catch (e) { console.warn(e); }
      world.addLog(`【${ev.title}】${o.zh}`, 'player');
      show('#modal', false); pendingEvent = null; view.markDirty(); renderAll();
    };
    box.appendChild(b);
  }
  show('#modal', true);
}

/* ================= 渲染 ================= */
function renderAll() { renderTop(); renderTab(); renderLog(); if (ui.sel) renderProv(); }

function renderTop() {
  $('#date').textContent = world.dateStr();
  const p = world.player ? world.pol.get(world.player) : null;
  if (!p) {
    $('#realmName').textContent = '观察者模式';
    $('#realmRuler').textContent = `世界现存 ${world.aliveCount()} 个政权`;
    return;
  }
  const r = world.chars.get(p.ruler);
  $('#realmFlag').style.background = p.color;
  $('#realmName').textContent = `${p.zh}`;
  $('#realmRuler').textContent = r ? `${r.name}（${r.dyn}，${age(r, world.year)}岁） · ${VOCAB.governments[p.gov]?.zh || p.gov}` : '—';
  $('#rTreasury').textContent = fmt(p.treasury);
  $('#rIncome').textContent = `(${p.income - p.expense >= 0 ? '+' : ''}${fmt(p.income - p.expense)})`;
  $('#rManpower').textContent = `${fmt(p.manpower)}/${fmt(p.maxManpower)}`;
  $('#rArmy').textContent = `${fmt(p.army)}/${fmt(p.forceLimit)}`;
  $('#rStability').textContent = p.stability;
  $('#rLegit').textContent = Math.round(p.legitimacy);
  $('#rPrestige').textContent = Math.round(p.prestige);
  $('#rTech').textContent = `${p.adm}/${p.dip}/${p.mil}`;
}

function renderProv() {
  const id = ui.sel;
  const box = $('#provBody');
  $('#left').style.display = 'flex';
  if (!id) { $('#provTitle').textContent = '未选择省份'; box.innerHTML = ''; return; }
  const d = MAP.provinces[id], st = world.prov.get(id);
  const owner = st.owner ? world.pol.get(st.owner) : null;
  const ctrl = st.controller && st.controller !== st.owner ? world.pol.get(st.controller) : null;
  $('#provTitle').textContent = `${d.zh}`;
  const areaZh = MAP.areas[d.area]?.zh || d.area, regZh = MAP.regions[MAP.areas[d.area]?.region]?.zh || '';
  box.innerHTML = `
    <div class="dim">${d.en} · ${areaZh} / ${regZh}</div>
    <h4>归属</h4>
    <div class="kv"><span>领主</span><span>${owner ? owner.zh : '无主之地'}</span></div>
    ${ctrl ? `<div class="kv"><span>占领者</span><span class="bad">${ctrl.zh}</span></div>` : ''}
    ${owner?.vassalOf ? `<div class="kv"><span>宗主</span><span>${world.pol.get(owner.vassalOf)?.zh || '—'}</span></div>` : ''}
    <h4>地理</h4>
    <div class="kv"><span>地形</span><span>${VOCAB.terrain[d.terrain]?.zh || d.terrain}${d.port ? ' · 港口' : ''}${d.river ? ' · 临水' : ''}</span></div>
    <div class="kv"><span>特产</span><span>${VOCAB.goods[d.goods]?.zh || d.goods}</span></div>
    <div class="kv"><span>坐标</span><span>${d.lat.toFixed(1)}°, ${d.lon.toFixed(1)}°</span></div>
    <h4>人文</h4>
    <div class="kv"><span>文化</span><span>${cultureName(st.culture)}</span></div>
    <div class="kv"><span>宗教</span><span>${VOCAB.religions[st.religion]?.zh || st.religion}</span></div>
    <h4>数值</h4>
    <div class="kv"><span>发展度</span><span>${st.dev.toFixed(1)} <span class="dim">（史实轨道 ${devAt(d.dev, world.year).toFixed(1)}）</span></span></div>
    <div class="kv"><span>自治度</span><span>${Math.round(st.autonomy * 100)}%</span></div>
    <div class="kv"><span>动乱</span><span class="${st.unrest > 6 ? 'bad' : ''}">${st.unrest.toFixed(1)}</span></div>
    <div class="kv"><span>荒废</span><span>${Math.round(st.devastation * 100)}%</span></div>
    <h4>邻接（${(d.neigh || []).length}）</h4>
    <div>${(d.neigh || []).slice(0, 14).map(n => {
      const o = world.prov.get(n)?.owner; const op = o ? world.pol.get(o) : null;
      return `<span class="chip">${MAP.provinces[n]?.zh || n}${op ? `<span class="dim"> ${op.zh}</span>` : ''}</span>`;
    }).join('')}</div>`;
}

function renderTab() {
  const box = $('#tabBody');
  const p = world.player ? world.pol.get(world.player) : null;
  switch (ui.tab) {
    case 'realm': box.innerHTML = tabRealm(p); break;
    case 'court': box.innerHTML = tabCourt(p); break;
    case 'tech': box.innerHTML = tabTech(p); break;
    case 'diplo': box.innerHTML = tabDiplo(p); break;
    case 'wars': box.innerHTML = tabWars(p); break;
    case 'rank': box.innerHTML = tabRank(); break;
    case 'world': box.innerHTML = tabWorld(); break;
  }
  box.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => {
    const t = b.dataset.goto; const pol = world.pol.get(t);
    if (pol) { view.centerOn(pol.cap); ui.sel = pol.cap; renderProv(); }
  });
}

function tabRealm(p) {
  if (!p) return '<div class="dim">观察者模式：你在旁观世界演化。</div>' + tabWorld();
  const r = world.chars.get(p.ruler);
  const cap = MAP.provinces[p.cap];
  return `
    <h4>${p.zh} · ${RANK_ZH[p.rank]}</h4>
    <div class="kv"><span>政体</span><span>${VOCAB.governments[p.gov]?.zh || p.gov}（${SUCCESSION[p.succession]?.zh || p.succession}）</span></div>
    <div class="kv"><span>首都</span><span>${cap?.zh || p.cap}</span></div>
    <div class="kv"><span>国教 / 主体文化</span><span>${VOCAB.religions[p.religion]?.zh} / ${cultureName(p.culture)}</span></div>
    <div class="kv"><span>省份 / 行政上限</span><span class="${p.provs.size > p.adminCap ? 'bad' : ''}">${p.provs.size} / ${p.adminCap}</span></div>
    <div class="kv"><span>总发展度</span><span>${Math.round(p.devSum)}</span></div>
    <div class="kv"><span>月收入 / 支出</span><span>${fmt(p.income)} / ${fmt(p.expense)}</span></div>
    <div class="kv"><span>腐败</span><span>${Math.round(p.corruption * 100)}%</span></div>
    <div class="kv"><span>战争疲惫</span><span>${p.warExhaustion.toFixed(1)}</span></div>
    <h4>统治者</h4>
    <div class="kv"><span>${r?.name || '—'}</span><span>${r?.dyn || ''} · ${r ? age(r, world.year) : '?'}岁</span></div>
    <div class="kv"><span>外交/军事/管理/谋略/学识</span><span>${r ? `${r.stats.dip}/${r.stats.mar}/${r.stats.stw}/${r.stats.int}/${r.stats.lrn}` : '—'}</span></div>
    <div>${(r?.traits || []).map(t => `<span class="chip">${TRAITS[t]?.zh || t}</span>`).join('')}</div>
    <h4>快捷</h4>
    <button class="row-btn" data-goto="${p.tag}">定位首都</button>`;
}

function tabCourt(p) {
  if (!p) return '<div class="dim">无宫廷。</div>';
  const r = world.chars.get(p.ruler);
  const heir = p.heir ? world.chars.get(p.heir) : null;
  const fam = charsOf(world, p.tag).slice(0, 40);
  const row = c => `<tr><td>${c.name}</td><td class="dim">${c.dyn}</td><td>${age(c, world.year)}</td><td>${c.id === p.ruler ? '君主' : c.id === p.heir ? '储君' : c.role === 'consort' ? '配偶' : '宗室'}</td>
    <td>${c.stats.dip}/${c.stats.mar}/${c.stats.stw}/${c.stats.int}/${c.stats.lrn}</td></tr>`;
  return `
    <h4>君主</h4>
    <div>${r ? `${r.name}（${r.dyn}），${age(r, world.year)}岁　健康 ${(r.health * 100).toFixed(0)}%` : '—'}</div>
    <div>${(r?.traits || []).map(t => `<span class="chip">${TRAITS[t]?.zh || t}</span>`).join('')}</div>
    <h4>继承（${SUCCESSION[p.succession]?.zh}）</h4>
    <div>${heir ? `${heir.name}（${heir.dyn}），${age(heir, world.year)}岁` : '<span class="bad">无继承人——绝嗣风险</span>'}</div>
    <div>${(heir?.traits || []).map(t => `<span class="chip">${TRAITS[t]?.zh || t}</span>`).join('')}</div>
    <div class="kv"><span>正统性</span><span>${Math.round(p.legitimacy)}</span></div>
    <h4>宗室与朝臣（${fam.length}）</h4>
    <table class="mini"><tr><th>姓名</th><th>王朝</th><th>年龄</th><th>身份</th><th>能力</th></tr>${fam.map(row).join('')}</table>`;
}

function tabTech(p) {
  if (!p) return '<div class="dim">—</div>';
  const t = techTarget(world.year, p.techGroup);
  const bar = (lvl, pts, cost) => `<div class="bar"><i style="width:${Math.min(100, 100 * pts / cost)}%"></i></div>`;
  const cost = k => 24 + p[k] * 16;
  return `
    <h4>科技组：${VOCAB.techGroups[p.techGroup]?.zh || p.techGroup}</h4>
    <div class="dim">同时代史实水平约 ${t.toFixed(1)} 级；落后可加速追赶，超前代价陡增。</div>
    <h4>行政 ${p.adm} <span class="dim">/ 史实 ${t.toFixed(1)}</span></h4>
    ${bar('adm', p.admPts, cost('adm'))}
    <h4>外交 ${p.dip} <span class="dim">/ 史实 ${t.toFixed(1)}</span></h4>
    ${bar('dip', p.dipPts, cost('dip'))}
    <h4>军事 ${p.mil} <span class="dim">/ 史实 ${t.toFixed(1)}</span></h4>
    ${bar('mil', p.milPts, cost('mil'))}
    <h4>说明</h4>
    <div class="dim">科技点由总发展度、君主能力、腐败与战争状态决定。行政科技提高税收与行政上限，外交科技提高外交关系与航海，军事科技提高部队质量与人力。</div>`;
}

function tabDiplo(p) {
  if (!p) return '<div class="dim">—</div>';
  const neigh = [...world.neighborsOf(p.tag).entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const list = (set, label) => {
    const arr = [...set].map(t => world.pol.get(t)).filter(x => x?.alive);
    return `<h4>${label}（${arr.length}）</h4>` + (arr.length ? arr.map(x => `<button class="row-btn" data-goto="${x.tag}">${x.zh} <span class="dim">${RANK_ZH[x.rank]} 军${fmt(x.army)}</span></button>`).join('') : '<div class="dim">无</div>');
  };
  return `
    ${p.vassalOf ? `<h4>宗主</h4><button class="row-btn" data-goto="${p.vassalOf}">${world.pol.get(p.vassalOf)?.zh}</button>` : ''}
    ${list(p.allies, '同盟')}
    ${list(p.vassals, '附庸')}
    ${list(p.tributaries, '朝贡国')}
    <h4>接壤邻邦</h4>
    ${neigh.map(([t, n]) => {
      const o = world.pol.get(t); if (!o) return '';
      const w = world.warBetween(p.tag, t);
      return `<button class="row-btn" data-goto="${t}">${o.zh} <span class="dim">${n} 段边界 · 军${fmt(o.army)} · ${VOCAB.religions[o.religion]?.zh || ''}</span>${w ? ' <span class="bad">交战</span>' : ''}</button>`;
    }).join('')}`;
}

function tabWars(p) {
  const ws = world.wars;
  if (!ws.length) return '<div class="dim">天下暂无战事。</div>';
  const mine = p ? ws.filter(w => w.att.has(p.tag) || w.def.has(p.tag)) : [];
  const render = w => {
    const A = [...w.att].map(t => world.pol.get(t)?.zh).filter(Boolean);
    const D = [...w.def].map(t => world.pol.get(t)?.zh).filter(Boolean);
    const my = p && (w.att.has(p.tag) ? 1 : w.def.has(p.tag) ? -1 : 0);
    const sc = my ? w.score * my : w.score;
    return `<div style="border-bottom:1px solid #242c3a;padding:4px 0">
      <div>${A.join('、')} <span class="dim">vs</span> ${D.join('、')}</div>
      <div class="dim">${w.cb} · ${w.started} 年起 · 战果 <span class="${sc > 0 ? 'good' : 'bad'}">${Math.round(sc)}</span> · 占领 ${w.occupied.size} 省 · 会战 ${w.battles}</div>
    </div>`;
  };
  return `${mine.length ? `<h4>我方战争</h4>${mine.map(render).join('')}` : ''}
    <h4>天下战事（${ws.length}）</h4>${ws.slice(0, 25).map(render).join('')}`;
}

function tabRank() {
  const r = world.ranking().slice(0, 40);
  return `<h4>列国实力（按总发展度）</h4>
  <table class="mini"><tr><th>#</th><th>政权</th><th>省</th><th>发展</th><th>军</th><th>科技</th></tr>
  ${r.map((x, i) => `<tr><td>${i + 1}</td><td><button class="row-btn" data-goto="${x.tag}" style="padding:0;border:none;background:none">${x.zh}</button></td><td>${x.provs}</td><td>${x.dev}</td><td>${fmt(x.army)}</td><td>${x.tech}</td></tr>`).join('')}
  </table>`;
}

function tabWorld() {
  const byRel = new Map(), byCul = new Map(), byGov = new Map();
  let owned = 0;
  for (const id of world.provIds) {
    const st = world.prov.get(id);
    if (!st) continue;
    if (st.owner) owned++;
    byRel.set(st.religion, (byRel.get(st.religion) || 0) + 1);
    const g = world.cultureGroup(st.culture);
    byCul.set(g, (byCul.get(g) || 0) + 1);
  }
  for (const p of world.pol.values()) if (p.alive) byGov.set(p.gov, (byGov.get(p.gov) || 0) + 1);
  const top = (m, name) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([k, v]) => `<div class="kv"><span>${name(k)}</span><span>${v}</span></div>`).join('');
  return `
    <h4>世界概览 · ${world.year} 年</h4>
    <div class="kv"><span>现存政权</span><span>${world.aliveCount()}</span></div>
    <div class="kv"><span>省份 / 有主</span><span>${world.provIds.length} / ${owned}</span></div>
    <div class="kv"><span>进行中的战争</span><span>${world.wars.length}</span></div>
    <div class="kv"><span>在世角色</span><span>${[...world.chars.values()].filter(c => !c.died).length}</span></div>
    <h4>宗教分布（省数）</h4>${top(byRel, k => VOCAB.religions[k]?.zh || k)}
    <h4>文化组分布（省数）</h4>${top(byCul, k => VOCAB.cultureGroups[k]?.zh || k)}
    <h4>政体分布（政权数）</h4>${top(byGov, k => VOCAB.governments[k]?.zh || k)}`;
}

function renderLog() {
  const box = $('#logBody');
  const items = world.log.slice(-60).reverse();
  box.innerHTML = items.map(l => `<div class="l ${l.kind}"><span class="y">${l.y}</span>${l.text}</div>`).join('');
}

function showTooltip(id, x, y) {
  const tt = $('#tooltip');
  if (!id) { show(tt, false); return; }
  const d = MAP.provinces[id], st = world.prov.get(id);
  const owner = st?.owner ? world.pol.get(st.owner) : null;
  tt.innerHTML = `<b>${d.zh}</b> <span class="dim">${d.en}</span><br>
    ${owner ? owner.zh : '无主'} · 发展 ${st.dev.toFixed(0)}<br>
    <span class="dim">${VOCAB.terrain[d.terrain]?.zh} · ${VOCAB.goods[d.goods]?.zh} · ${VOCAB.religions[st.religion]?.zh} · ${cultureName(st.culture)}</span>`;
  tt.style.left = Math.min(window.innerWidth - 280, x + 14) + 'px';
  tt.style.top = (y + 16) + 'px';
  show(tt, true, 'block');
}

boot();
