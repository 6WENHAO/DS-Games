/* ============================================================
   map.js —— 地图生成 & 地图界面
   15 层 + BOSS，7 列，6 条路径（仿照原作规则）
   ============================================================ */
'use strict';

const MAP_ROWS = 15, MAP_COLS = 7, MAP_PATHS = 6;
const NODE_TYPES = {
  monster: '普通敌人', elite: '精英', rest: '休息处',
  shop: '商店', treasure: '宝箱', event: '未知', boss: 'BOSS'
};

function genMap() {
  const grid = [];
  for (let r = 0; r < MAP_ROWS; r++) grid.push(new Array(MAP_COLS).fill(null));

  const node = (r, c) => {
    if (!grid[r][c]) grid[r][c] = { r: r, c: c, type: null, next: [], prev: [], id: r + '_' + c };
    return grid[r][c];
  };
  const link = (a, b) => {
    if (!a.next.includes(b)) a.next.push(b);
    if (!b.prev.includes(a)) b.prev.push(a);
  };
  /* 防止路径交叉：若存在 (r,c+1)->(r+1,c') 且 c' <= c，则 (r,c)->(r+1,c+1) 会交叉 */
  const crosses = (r, from, to) => {
    if (to > from) {
      const rn = grid[r][from + 1];
      if (rn && rn.next.some(n => n.c <= from)) return true;
    }
    if (to < from) {
      const ln = grid[r][from - 1];
      if (ln && ln.next.some(n => n.c >= from)) return true;
    }
    return false;
  };

  const firstCols = [];
  for (let p = 0; p < MAP_PATHS; p++) {
    let c = ri(0, MAP_COLS - 1);
    if (p === 1) { let t = 0; while (c === firstCols[0] && t++ < 20) c = ri(0, MAP_COLS - 1); }
    firstCols.push(c);
    let cur = c;
    node(0, cur);
    for (let r = 0; r < MAP_ROWS - 1; r++) {
      let opts = [cur - 1, cur, cur + 1].filter(x => x >= 0 && x < MAP_COLS && !crosses(r, cur, x));
      if (!opts.length) opts = [cur];
      const nxt = pick(opts);
      link(node(r, cur), node(r + 1, nxt));
      cur = nxt;
    }
  }

  /* ---------- 分配房间类型 ---------- */
  const table = [['monster', 45], ['event', 22], ['elite', 16], ['rest', 12], ['shop', 5]];
  const forbid = (n, type) => {
    /* 前 5 层不出现精英/休息处/商店 */
    if (n.r < 5 && (type === 'elite' || type === 'rest' || type === 'shop')) return true;
    /* 倒数第二层不出现休息处（最后一层固定休息处） */
    if (n.r === MAP_ROWS - 2 && type === 'rest') return true;
    /* 路径上不能连续出现同种特殊房间 */
    if (['rest', 'shop', 'elite'].includes(type)) {
      if (n.prev.some(p => p.type === type)) return true;
      if (n.next.some(x => x.type === type)) return true;
    }
    /* 同一父节点的兄弟节点不重复特殊房间 */
    if (['rest', 'shop', 'elite'].includes(type)) {
      for (const p of n.prev) if (p.next.some(sib => sib !== n && sib.type === type)) return true;
    }
    return false;
  };

  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const n = grid[r][c];
      if (!n) continue;
      if (r === 0) { n.type = 'monster'; continue; }
      if (r === 8) { n.type = 'treasure'; continue; }
      if (r === MAP_ROWS - 1) { n.type = 'rest'; continue; }
      let t = null, tries = 0;
      do { t = weighted(table); tries++; } while (forbid(n, t) && tries < 40);
      if (forbid(n, t)) t = 'monster';
      n.type = t;
    }
  }

  /* BOSS 节点 */
  const boss = { r: MAP_ROWS, c: 3, type: 'boss', next: [], prev: [], id: 'boss' };
  for (let c = 0; c < MAP_COLS; c++) {
    const n = grid[MAP_ROWS - 1][c];
    if (n) link(n, boss);
  }

  const all = [];
  for (let r = 0; r < MAP_ROWS; r++) for (let c = 0; c < MAP_COLS; c++) if (grid[r][c]) all.push(grid[r][c]);
  all.push(boss);

  return { grid: grid, nodes: all, boss: boss, current: null, visited: [] };
}

/* ---------- 地图界面 ---------- */
const NODE_X = (c) => 92 + c * 119;
const ROW_H = 112;
const MAP_H = MAP_ROWS * ROW_H + 210;
const NODE_Y = (r) => MAP_H - 92 - r * ROW_H;

function availableNodes() {
  const m = S.map;
  if (!m.current) return m.grid[0].filter(Boolean);
  return m.current.next.slice();
}

function renderMap() {
  const scr = $('#screen-map');
  clear(scr);

  const title = el('div', '', '');
  title.id = 'map-title';
  title.innerHTML = `<div class="act-label">第一章 · 遗迹</div>
    <div class="tiny dim" style="margin-top:2px">选择一条前进的道路</div>`;
  scr.appendChild(title);

  const wrap = el('div');
  wrap.id = 'map-scroll';
  const inner = el('div');
  inner.id = 'map-inner';
  inner.style.height = MAP_H + 'px';
  wrap.appendChild(inner);
  scr.appendChild(wrap);

  const m = S.map;
  const avail = availableNodes();

  /* 连线 */
  const paths = [];
  m.nodes.forEach(n => {
    n.next.forEach(t => {
      const x1 = NODE_X(n.c), y1 = NODE_Y(n.r) - 22;
      const x2 = t.type === 'boss' ? 450 : NODE_X(t.c);
      const y2 = (t.type === 'boss' ? NODE_Y(MAP_ROWS) : NODE_Y(t.r)) + 22;
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      const onRoute = m.visited.includes(n.id) && (m.visited.includes(t.id) || (m.current && m.current.id === t.id));
      const nextStep = m.current === n && avail.includes(t);
      const cls = onRoute ? 'taken' : (nextStep ? 'next' : 'idle');
      paths.push(`<path d="M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}" class="mp-${cls}"/>`);
    });
  });
  const svg = `<svg id="map-svg" viewBox="0 0 900 ${MAP_H}" preserveAspectRatio="none">
    <style>
      .mp-idle{fill:none;stroke:#4a4058;stroke-width:3;stroke-dasharray:7 7}
      .mp-taken{fill:none;stroke:#d4af58;stroke-width:4}
      .mp-next{fill:none;stroke:#fff3c4;stroke-width:4;stroke-dasharray:9 6;animation:dash 1s linear infinite}
      @keyframes dash{to{stroke-dashoffset:-30}}
    </style>${paths.join('')}</svg>`;
  inner.insertAdjacentHTML('afterbegin', svg);

  /* 节点 */
  m.nodes.forEach(n => {
    const d = el('div', 'map-node');
    const isBoss = n.type === 'boss';
    d.style.left = (isBoss ? 450 : NODE_X(n.c)) + 'px';
    d.style.top = (isBoss ? NODE_Y(MAP_ROWS) : NODE_Y(n.r)) + 'px';
    if (isBoss) { d.style.width = '78px'; d.style.height = '78px'; }
    d.innerHTML = SVG.mapNode(n.type) + '<div class="node-ring"></div>';
    if (isBoss) d.querySelector('svg').style.width = '72px', d.querySelector('svg').style.height = '72px';

    const isAvail = avail.includes(n);
    const isHere = m.current === n;
    if (isHere) d.classList.add('here', 'done');
    else if (isAvail) d.classList.add('avail');
    else if (m.visited.includes(n.id)) d.classList.add('done');
    else d.classList.add('dim');

    const floorNo = isBoss ? MAP_ROWS + 1 : n.r + 1;
    bindTip(d, () => `<div class="tt-title">${NODE_TYPES[n.type]}</div>
      <div class="tt-sub">第 ${floorNo} 层</div>${nodeHint(n.type)}`, { anchor: 'rightside' });

    if (isAvail) d.addEventListener('click', () => Game.enterNode(n));
    inner.appendChild(d);
  });

  /* 图例 */
  const lg = el('div', 'map-legend');
  lg.innerHTML = ['monster', 'elite', 'event', 'rest', 'shop', 'treasure', 'boss']
    .map(t => `<div class="lg">${SVG.mapNode(t)}<span>${NODE_TYPES[t]}</span></div>`).join('');
  scr.appendChild(lg);

  /* 滚动到当前位置 */
  requestAnimationFrame(() => {
    const target = m.current ? NODE_Y(m.current.r) : MAP_H;
    wrap.scrollTop = clamp(target - 480, 0, MAP_H);
  });
}

function nodeHint(t) {
  switch (t) {
    case 'monster': return '与怪物战斗，获得金币与卡牌奖励。';
    case 'elite': return '强大的敌人，掉落遗物。';
    case 'rest': return '休息（回复 30% 生命）或打铁（升级一张卡牌）。';
    case 'shop': return '用金币购买卡牌、遗物与药水，或移除卡牌。';
    case 'treasure': return '免费的遗物。';
    case 'event': return '可能是好事，也可能不是。';
    case 'boss': return '本章的守关者。击败它即可通关。';
  }
  return '';
}
