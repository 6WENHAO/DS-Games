// All full-screen panels: inventory, crafting, discoveries, refiner, trade, galaxy map,
// build menu, ship repair, help/options.
import { ITEMS, RECIPES, REFINE, REPAIRS, itemKeyForBlock, itemLabel } from '../data/items.js';
import { BLOCKS, BID, BUILD_GROUPS } from '../world/blocks.js';
import { HAZARD_INFO } from '../data/planets.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Panels {
  constructor(game) {
    this.game = game;
    this.selectedSlot = -1;
    this.buildCat = 0;
    this.selectedStar = null;
    this.refinerRecipe = null;
    this.refining = null;
    this._holds = new Map();
  }

  /* =================== helpers =================== */
  _head(title, sub, hint) {
    return '<div class="p-head"><div><div class="p-title">' + title + '</div><div class="p-sub">' + (sub || '') + '</div></div>' +
      '<div class="p-hint">' + (hint || '<span class="kbd">ESC</span> 关闭') + '</div></div>';
  }

  _reqList(list) {
    return list.map(([k, n]) => {
      const have = this.game.inventory.count(k);
      const ok = have >= n;
      return '<span class="req-item ' + (ok ? 'ok' : 'no') + '">' + itemLabel(k) + ' <b>' + have + '/' + n + '</b></span>';
    }).join('');
  }

  /** attach hold-to-confirm behaviour to a .craft-hold element */
  _bindHold(el, duration, onDone) {
    const g = this.game;
    let raf = null, start = 0, sfx = null;
    const stop = (done) => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      el.style.setProperty('--p', '0');
      el.classList.remove('holding');
      if (sfx) { sfx.stop(done); sfx = null; }
    };
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / (duration * 1000));
      el.style.setProperty('--p', p.toFixed(3));
      if (p >= 1) { stop(true); onDone(); return; }
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      start = performance.now();
      el.classList.add('holding');
      sfx = g.audio.startCharge();
      tick();
    });
    el.addEventListener('mouseup', () => stop(false));
    el.addEventListener('mouseleave', () => stop(false));
  }

  open(name) {
    if (name === 'inventory') this.openInventory();
    else if (name === 'craft') this.openCraft();
    else if (name === 'discovery') this.openDiscovery();
    else if (name === 'build') this.openBuild();
    else if (name === 'galaxy') this.openGalaxy();
    else if (name === 'trade') this.openTrade();
  }

  refresh() {
    const open = this.game.ui.panelOpen;
    if (!open) return;
    const keep = this.selectedSlot;
    if (open === 'inventory') this.openInventory(keep);
    else if (open === 'craft') this.openCraft();
    else if (open === 'build') this.openBuild();
    else if (open === 'trade') this.openTrade();
    else if (open === 'refiner') this.openRefiner(this._refinerHit, true);
  }

  /* =================== inventory =================== */
  openInventory(selected = -1) {
    const g = this.game;
    const inv = g.inventory;
    this.selectedSlot = selected;
    let grid = '<div class="inv-grid">';
    for (let i = 0; i < inv.size; i++) {
      const s = inv.slots[i];
      const sel = i === this.selectedSlot ? ' sel' : '';
      if (!s) { grid += '<div class="slot empty' + sel + '" data-i="' + i + '"></div>'; continue; }
      const d = ITEMS[s.key] || {};
      const pct = Math.min(1, s.count / (d.type === 'block' ? 999 : 9999));
      grid += '<div class="slot' + sel + (d.type === 'tech' ? ' tech' : '') + '" data-i="' + i + '" title="' + esc(d.cn || s.key) + '">' +
        '<img src="' + g.icons.get(s.key) + '" alt="">' +
        '<span class="s-count">' + s.count + '</span>' +
        '<span class="s-name">' + esc((d.cn || s.key).slice(0, 5)) + '</span>' +
        '<span class="slot-bar" style="width:' + (pct * 100).toFixed(1) + '%"></span>' +
        '</div>';
    }
    grid += '</div>';

    const s = this.selectedSlot >= 0 ? inv.slots[this.selectedSlot] : null;
    const d = s ? ITEMS[s.key] : null;
    const side = '<div class="inv-side">' + (d ?
      '<img class="big" src="' + g.icons.get(s.key) + '" alt="">' +
      '<div class="is-name">' + esc(d.cn) + '</div>' +
      '<div class="is-en mono">' + esc(d.name) + '</div>' +
      '<div class="tag">' + (d.type === 'block' ? '可放置方块' : d.type === 'product' ? '制成品' : '元素') + '</div>' +
      '<div class="is-desc">' + esc(d.desc || '') + '</div>' +
      '<div class="stat-row"><span>数量</span><b>' + s.count + '</b></div>' +
      '<div class="stat-row"><span>单价</span><b class="hi">' + (d.value || 0) + ' ◈</b></div>' +
      '<div class="stat-row"><span>总值</span><b class="hi">' + ((d.value || 0) * s.count).toLocaleString('en-US') + ' ◈</b></div>' +
      '<div class="divider"></div>' +
      (d.type === 'block' ? '<button class="btn primary" data-act="hotbar">分配到快捷栏</button>' : '') +
      (REFINE.some((r) => r.in.some(([k]) => k === s.key)) ? '<button class="btn" data-act="refine-hint">可精炼 →</button>' : '') +
      '<button class="btn" data-act="drop">丢弃一半</button>'
      : '<div class="dim center">选择一个格子查看详情</div>') + '</div>';

    // suit systems / repairs
    const p = g.player;
    const rep = [];
    const repRow = (key, label, ok) => {
      const r = REPAIRS[key];
      if (ok) return '<div class="trade-row"><span class="t-name">' + label + '</span><span class="t-qty ok">已就绪</span></div>';
      return '<div class="trade-row"><span class="t-name warn">' + label + ' (损坏)</span>' +
        '<span class="t-qty">' + this._reqList(r.cost) + '</span>' +
        '<button class="btn primary t-buy" data-repair="' + key + '">修复</button></div>';
    };
    rep.push(repRow('MULTITOOL_SCANNER', '扫描仪 SCANNER', p.tool.scanner));
    rep.push(repRow('MULTITOOL_VISOR', '分析镜 ANALYSIS VISOR', p.tool.visor));
    const charge = '<div class="trade-row"><span class="t-name">生命维持 ' + Math.round(p.life) + '%</span><span class="t-qty">' + this._reqList([['OXYGEN', 20]]) + '</span><button class="btn t-buy" data-charge="life">充能</button></div>' +
      '<div class="trade-row"><span class="t-name">危害防护 ' + Math.round(p.hazard) + '%</span><span class="t-qty">' + this._reqList([['SODIUM', 10]]) + '</span><button class="btn t-buy" data-charge="hazard">充能</button></div>' +
      '<div class="trade-row"><span class="t-name">护盾 ' + Math.round(p.shield) + '%</span><span class="t-qty">' + this._reqList([['SODIUM', 10]]) + '</span><button class="btn t-buy" data-charge="shield">充能</button></div>';

    const html = this._head('外骨骼 · EXOSUIT', inv.slots.filter(Boolean).length + '/' + inv.size + ' 格已使用 · 总价值 ' + inv.totalValue().toLocaleString('en-US') + ' ◈',
      '<span class="kbd">TAB</span> 关闭') +
      '<div class="p-body inv-body">' + grid + side +
      '<div class="inv-systems"><div class="p-title small">工具与系统 · SYSTEMS</div>' + rep.join('') + '<div class="divider"></div>' + charge + '</div>' +
      '</div>';

    g.ui.openPanel('inventory', html, (root) => {
      root.querySelectorAll('.slot').forEach((el) => {
        el.addEventListener('click', () => { g.audio.uiClick(); this.openInventory(parseInt(el.dataset.i, 10)); });
      });
      root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'hotbar') {
          const free = g.player.hotbar.indexOf(null);
          const idx = free >= 0 ? free : g.player.selected;
          g.player.hotbar[idx] = this.selectedSlot;
          g.audio.confirm();
          g.ui.updateHotbar();
        } else if (act === 'drop') {
          const st = g.inventory.slots[this.selectedSlot];
          if (st) { g.inventory.remove(st.key, Math.ceil(st.count / 2)); g.audio.uiBack(); this.openInventory(this.selectedSlot); }
        } else if (act === 'refine-hint') {
          this.openRefinerVirtual();
        }
      }));
      root.querySelectorAll('[data-repair]').forEach((b) => b.addEventListener('click', () => {
        const key = b.dataset.repair;
        const r = REPAIRS[key];
        if (!g.inventory.hasAll(r.cost)) { g.audio.uiError(); g.ui.toast({ kind: 'warn', name: '材料不足', amt: '' }); return; }
        g.inventory.removeAll(r.cost);
        if (key === 'MULTITOOL_SCANNER') g.player.tool.scanner = true;
        if (key === 'MULTITOOL_VISOR') g.player.tool.visor = true;
        g.audio.confirm();
        g.audio.questComplete();
        g.ui.toast({ kind: 'quest', name: r.name + ' 已修复', amt: '' });
        this.openInventory(this.selectedSlot);
      }));
      root.querySelectorAll('[data-charge]').forEach((b) => b.addEventListener('click', () => {
        const kind = b.dataset.charge;
        const p2 = g.player;
        let ok = false;
        if (kind === 'life' && g.inventory.has('OXYGEN', 20)) { g.inventory.remove('OXYGEN', 20); p2.life = Math.min(p2.maxLife, p2.life + 55); ok = true; g.flags.rechargedLife = true; }
        if (kind === 'hazard' && g.inventory.has('SODIUM', 10)) { g.inventory.remove('SODIUM', 10); p2.hazard = Math.min(p2.maxHazard, p2.hazard + 60); ok = true; }
        if (kind === 'shield' && g.inventory.has('SODIUM', 10)) { g.inventory.remove('SODIUM', 10); p2.shield = Math.min(p2.maxShield, p2.shield + 50); ok = true; }
        if (ok) { g.audio.confirm(); this.openInventory(this.selectedSlot); } else { g.audio.uiError(); }
      }));
    });
  }

  /* =================== crafting =================== */
  openCraft() {
    const g = this.game;
    const inv = g.inventory;
    const cats = {};
    for (const r of RECIPES) {
      const unlocked = g.creative || r.unlocked || g.flags['recipe_' + r.id] || (r.cat === '星际' && g.quests.index >= 9);
      (cats[r.cat] = cats[r.cat] || []).push(Object.assign({}, r, { unlocked }));
    }
    let body = '<div class="recipe-list">';
    for (const cat in cats) {
      body += '<div class="p-title small">' + cat + '</div>';
      for (const r of cats[cat]) {
        const can = inv.hasAll(r.in) && r.unlocked;
        body += '<div class="recipe' + (r.unlocked ? '' : ' locked') + '">' +
          '<img class="ticon" src="' + g.icons.get(r.out) + '" alt="">' +
          '<div class="r-main"><div class="r-name">' + esc(ITEMS[r.out]?.cn || r.out) + ' ×' + r.count + '</div>' +
          '<div class="r-desc dim">' + esc(r.desc || '') + '</div>' +
          '<div class="req">' + this._reqList(r.in) + '</div></div>' +
          (r.unlocked
            ? '<div class="craft-hold' + (can ? '' : ' disabled') + '" data-recipe="' + r.id + '"><svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="17"/><circle class="fill" cx="20" cy="20" r="17"/></svg><span>按住<br>制作</span></div>'
            : '<div class="craft-hold disabled"><span>未<br>解锁</span></div>') +
          '</div>';
      }
    }
    body += '</div>';
    const html = this._head('制作 · CRAFTING', '按住圆环制作 · 在构筑台旁可解锁更多配方', '<span class="kbd">Q</span> 关闭') +
      '<div class="p-body">' + body + '</div>';
    g.ui.openPanel('craft', html, (root) => {
      root.querySelectorAll('.craft-hold[data-recipe]').forEach((el) => {
        const r = RECIPES.find((x) => x.id === el.dataset.recipe);
        if (el.classList.contains('disabled')) {
          el.addEventListener('mousedown', () => { g.audio.uiError(); g.ui.toast({ kind: 'warn', name: '材料不足', amt: '' }); });
          return;
        }
        this._bindHold(el, 0.85, () => {
          if (!g.inventory.hasAll(r.in)) { g.audio.uiError(); return; }
          g.inventory.removeAll(r.in);
          g.inventory.add(r.out, r.count);
          g.audio.confirm();
          g.audio.itemPickup(true);
          g.ui.toast({ kind: 'get', key: r.out, amt: '+' + r.count });
          this.openCraft();
        });
      });
    });
  }

  /* =================== discoveries =================== */
  openDiscovery() {
    const g = this.game;
    const list = g.discoveries.slice().reverse();
    const tagCls = { fauna: 'fauna', flora: 'flora', mineral: 'mineral', planet: 'planet' };
    const tagCn = { fauna: '动物', flora: '植物', mineral: '矿物', planet: '行星' };
    let body = '<div class="disc-list">';
    if (!list.length) body += '<div class="dim center">尚无发现。按 <span class="kbd">V</span> 使用分析镜扫描世界。</div>';
    for (const d of list) {
      body += '<div class="disc"><span class="dtag ' + (tagCls[d.type] || 'planet') + '">' + (tagCn[d.type] || '?') + '</span>' +
        '<div><div class="d-name">' + esc(d.name) + '</div><div class="d-genus dim mono">' + esc(d.genus || '') + ' · ' + esc(d.planet) + '</div></div>' +
        '<span class="dval hi">' + (d.value || 0).toLocaleString('en-US') + ' ◈</span></div>';
    }
    body += '</div>';
    const stats = '<div class="p-foot"><span class="tag">物种 ' + g.discoveries.filter((d) => d.type === 'fauna').length + '</span>' +
      '<span class="tag">植物 ' + g.discoveries.filter((d) => d.type === 'flora').length + '</span>' +
      '<span class="tag">矿物 ' + g.discoveries.filter((d) => d.type === 'mineral').length + '</span>' +
      '<span class="tag">单位 ' + g.units.toLocaleString('en-US') + ' ◈</span>' +
      '<span class="tag">纳米簇 ' + g.nanites + ' ✦</span></div>';
    const html = this._head('发现日志 · DISCOVERIES', g.system.name + ' 星系 · ' + (g.planet ? g.planet.name : ''), '<span class="kbd">J</span> 关闭') +
      '<div class="p-body">' + body + '</div>' + stats;
    g.ui.openPanel('discovery', html);
  }

  /* =================== build menu =================== */
  openBuild() {
    const g = this.game;
    const inv = g.inventory;
    const cats = BUILD_GROUPS;
    let tabs = '<div class="build-cats">';
    cats.forEach((c, i) => { tabs += '<div class="bcat' + (i === this.buildCat ? ' on' : '') + '" data-cat="' + i + '">' + c.name + '</div>'; });
    tabs += '</div>';
    let grid = '<div class="build-grid">';
    for (const id of cats[this.buildCat].ids) {
      const key = itemKeyForBlock(id);
      const have = g.creative ? 999 : inv.realCount(key);
      const b = BLOCKS[id];
      grid += '<div class="bitem' + (have ? '' : ' dim') + '" data-key="' + key + '">' +
        '<img src="' + g.icons.get(key) + '" alt="">' +
        '<span class="bi-name">' + esc(b.cn) + '</span>' +
        '<span class="bi-cost mono">' + (g.creative ? '∞ 无限' : (have ? '×' + have : '无库存')) + '</span></div>';
    }
    grid += '</div>';
    const html = this._head('建造 · BUILD', g.creative ? '创造模式：所有方块无限供应，点击即放入快捷栏' : '选择方块放入快捷栏，右键放置 · 采集方块即可获得材料', '<span class="kbd">B</span> 关闭') +
      '<div class="p-body">' + tabs + grid +
      '<div class="p-sub dim">提示：金属板/玻璃/发光方块可在制作菜单 (Q) 中合成。基地计算机可宣告领地。</div></div>';
    g.ui.openPanel('build', html, (root) => {
      root.querySelectorAll('.bcat').forEach((el) => el.addEventListener('click', () => {
        this.buildCat = parseInt(el.dataset.cat, 10);
        g.audio.uiClick();
        this.openBuild();
      }));
      root.querySelectorAll('.bitem').forEach((el) => el.addEventListener('click', () => {
        const key = el.dataset.key;
        if (g.creative && !g.inventory.slots.some((s) => s && s.key === key)) {
          // creative mode hands you a full stack of anything
          const free = g.inventory.slots.findIndex((s) => !s);
          const idx = free >= 0 ? free : g.player.hotbar[g.player.selected] ?? 0;
          g.inventory.slots[idx] = { key, count: 999 };
          g.inventory._touch();
        }
        if (!g.inventory.realCount(key) && !g.creative) { g.audio.uiError(); g.ui.toast({ kind: 'warn', name: '没有该方块', amt: '先采集或制作' }); return; }
        const slotIdx = g.inventory.slots.findIndex((s) => s && s.key === key);
        if (slotIdx < 0) return;
        g.player.hotbar[g.player.selected] = slotIdx;
        g.audio.confirm();
        g.ui.updateHotbar();
        g.ui.toast({ kind: 'info', name: itemLabel(key) + ' 已放入快捷栏 ' + (g.player.selected + 1), amt: '' });
      }));
    });
  }

  /* =================== refiner =================== */
  openRefinerVirtual() { this.openRefiner(null); }

  openRefiner(hit, silent = false) {
    const g = this.game;
    this._refinerHit = hit;
    const inv = g.inventory;
    const avail = REFINE.filter((r) => r.in.every(([k, n]) => inv.count(k) >= n));
    let rows = '<div class="recipe-list">';
    for (const r of REFINE) {
      const can = r.in.every(([k, n]) => inv.count(k) >= n);
      rows += '<div class="recipe' + (can ? '' : ' locked') + '">' +
        '<img class="ticon" src="' + g.icons.get(r.out) + '" alt="">' +
        '<div class="r-main"><div class="r-name">' + esc(r.name) + '</div>' +
        '<div class="ref-flow"><span>' + r.in.map(([k, n]) => itemLabel(k) + ' ×' + n).join(' + ') + '</span><span class="arrow">➜</span><span class="hi">' + itemLabel(r.out) + ' ×' + r.count + '</span></div>' +
        '<div class="req">' + this._reqList(r.in) + '</div></div>' +
        '<div class="craft-hold' + (can ? '' : ' disabled') + '" data-ref="' + r.id + '"><svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="17"/><circle class="fill" cx="20" cy="20" r="17"/></svg><span>按住<br>精炼</span></div>' +
        '</div>';
    }
    rows += '</div>';
    const html = this._head('便携精炼器 · REFINER', '按住精炼一批 · 精炼可显著提升材料价值', '<span class="kbd">ESC</span> 关闭') +
      '<div class="p-body">' + rows + '</div>';
    g.ui.openPanel('refiner', html, (root) => {
      root.querySelectorAll('.craft-hold[data-ref]').forEach((el) => {
        const r = REFINE.find((x) => x.id === el.dataset.ref);
        if (el.classList.contains('disabled')) {
          el.addEventListener('mousedown', () => g.audio.uiError());
          return;
        }
        this._bindHold(el, Math.max(0.6, r.time * 0.4), () => {
          // refine as many batches as possible up to 10
          let batches = 0;
          while (batches < 10 && r.in.every(([k, n]) => g.inventory.count(k) >= n)) {
            r.in.forEach(([k, n]) => g.inventory.remove(k, n));
            g.inventory.add(r.out, r.count);
            batches++;
          }
          g.audio.refinerLoop(true);
          setTimeout(() => g.audio.refinerLoop(false), 700);
          g.audio.confirm();
          g.ui.toast({ kind: 'get', key: r.out, amt: '+' + batches * r.count });
          this.openRefiner(hit, true);
        });
      });
    });
  }

  /* =================== trade =================== */
  openTrade() {
    const g = this.game;
    const inv = g.inventory;
    const sellRows = inv.slots.map((s, i) => {
      if (!s) return '';
      const d = ITEMS[s.key];
      if (!d) return '';
      const price = Math.round((d.value || 1) * 0.92);
      return '<div class="trade-row"><img class="ticon" src="' + g.icons.get(s.key) + '"><span class="t-name">' + esc(d.cn) + '</span>' +
        '<span class="t-qty mono">×' + s.count + '</span><span class="t-price hi">' + (price * s.count).toLocaleString('en-US') + ' ◈</span>' +
        '<button class="btn t-sell" data-sell="' + i + '">出售</button></div>';
    }).join('');
    const buys = [['TRITIUM', 60], ['OXYGEN', 40], ['SODIUM', 40], ['METAL_PLATING', 3], ['CHROMATIC_METAL', 30], ['CARBON', 60], ['FERRITE_DUST', 80]];
    const buyRows = buys.map(([k, n]) => {
      const d = ITEMS[k];
      const price = Math.round((d.value || 1) * 1.35 * n);
      return '<div class="trade-row"><img class="ticon" src="' + g.icons.get(k) + '"><span class="t-name">' + esc(d.cn) + ' ×' + n + '</span>' +
        '<span class="t-price ' + (g.units >= price ? 'hi' : 'warn') + '">' + price.toLocaleString('en-US') + ' ◈</span>' +
        '<button class="btn primary t-buy" data-buy="' + k + '" data-n="' + n + '" data-price="' + price + '">购买</button></div>';
    }).join('');
    const html = this._head('交易终端 · TRADE TERMINAL', g.system.name + ' · 经济: ' + g.system.economy + ' · 单位: ' + g.units.toLocaleString('en-US') + ' ◈', '<span class="kbd">T</span> 关闭') +
      '<div class="p-body two-col">' +
      '<div><div class="p-title small">出售 · SELL</div>' + (sellRows || '<div class="dim">背包是空的</div>') + '</div>' +
      '<div><div class="p-title small">购买 · BUY</div>' + buyRows + '</div>' +
      '</div>';
    g.ui.openPanel('trade', html, (root) => {
      root.querySelectorAll('[data-sell]').forEach((b) => b.addEventListener('click', () => {
        const i = parseInt(b.dataset.sell, 10);
        const s = g.inventory.slots[i];
        if (!s) return;
        const d = ITEMS[s.key];
        const gain = Math.round((d.value || 1) * 0.92) * s.count;
        g.inventory.clearSlot(i);
        g.addUnits(gain);
        g.flags.soldSomething = true;
        g.audio.confirm();
        g.ui.toast({ kind: 'info', name: '已出售 ' + d.cn, amt: '+' + gain.toLocaleString('en-US') + ' ◈' });
        this.openTrade();
      }));
      root.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => {
        const key = b.dataset.buy, n = parseInt(b.dataset.n, 10), price = parseInt(b.dataset.price, 10);
        if (g.units < price) { g.audio.uiError(); g.ui.toast({ kind: 'warn', name: '单位不足', amt: '' }); return; }
        g.units -= price;
        g.inventory.add(key, n);
        g.audio.confirm();
        g.ui.toast({ kind: 'get', key, amt: '+' + n });
        this.openTrade();
      }));
    });
  }

  /* =================== galaxy map =================== */
  openGalaxy() {
    const g = this.game;
    if (!this._systems) this._systems = g.space.getNearbySystems(9);
    const list = this._systems;
    const sel = this.selectedStar !== null ? list[this.selectedStar] : null;
    let nodes = '<div class="gal-canvas-wrap"><div class="star-node current" style="left:50%;top:50%"><i></i><span>' + esc(g.system.name) + ' (当前)</span></div>';
    list.forEach((s, i) => {
      nodes += '<div class="star-node' + (this.selectedStar === i ? ' sel' : '') + '" data-i="' + i + '" style="left:' + (s.x * 100).toFixed(1) + '%;top:' + (s.y * 100).toFixed(1) + '%"><i></i><span>' + esc(s.name) + '</span></div>';
    });
    nodes += '</div>';
    const canWarp = g.creative || (g.ship.systems.hyper && g.inventory.has('WARP_CELL', 1));
    const info = '<div class="gal-info">' + (sel ?
      '<div class="p-title">' + esc(sel.name) + '</div>' +
      '<div class="stat-row"><span>距离</span><b>' + sel.dist + ' 光年</b></div>' +
      '<div class="stat-row"><span>恒星类型</span><b>' + sel.starClass + ' 级</b></div>' +
      '<div class="stat-row"><span>行星数</span><b>' + sel.planets + '</b></div>' +
      '<div class="stat-row"><span>经济</span><b>' + sel.economy + '</b></div>' +
      '<div class="stat-row"><span>主导种族</span><b>' + sel.race + '</b></div>' +
      '<div class="stat-row"><span>冲突等级</span><b>' + sel.conflict + '</b></div>' +
      '<div class="divider"></div>' +
      '<div class="stat-row"><span>超光速引擎</span><b class="' + (g.ship.systems.hyper ? 'ok' : 'warn') + '">' + (g.ship.systems.hyper ? '就绪' : '未安装') + '</b></div>' +
      '<div class="stat-row"><span>跃迁元件</span><b class="' + (g.inventory.has('WARP_CELL', 1) ? 'ok' : 'warn') + '">' + g.inventory.count('WARP_CELL') + '</b></div>' +
      '<button class="btn primary" data-warp="1" ' + (canWarp ? '' : 'disabled') + '>跃迁到此星系</button>'
      : '<div class="dim center">选择一个星系</div>') + '</div>';
    const html = this._head('星系地图 · GALAXY MAP', '跃迁需要超光速引擎与跃迁元件', '<span class="kbd">M</span> 关闭') +
      '<div class="p-body two-col">' + nodes + info + '</div>';
    g.ui.openPanel('galaxy', html, (root) => {
      root.querySelectorAll('.star-node[data-i]').forEach((el) => el.addEventListener('click', () => {
        this.selectedStar = parseInt(el.dataset.i, 10);
        g.audio.uiClick();
        this.openGalaxy();
      }));
      const wb = root.querySelector('[data-warp]');
      if (wb) wb.addEventListener('click', () => {
        if (!canWarp) { g.audio.uiError(); return; }
        if (!g.creative) g.inventory.remove('WARP_CELL', 1);
        g.ui.closePanel();
        g.uiBlocking = false;
        g.input.requestLock();
        this._systems = null;
        g.transition.warpTo(sel.seed);
      });
    });
  }

  /* =================== ship repair =================== */
  openShipRepair() {
    const g = this.game;
    const ship = g.ship;
    const row = (key, okIn, label) => {
      const r = REPAIRS[key];
      const ok = okIn || g.creative;
      if (ok) return '<div class="trade-row"><span class="t-name">' + label + '</span><span class="t-qty ok">已安装' + (g.creative ? ' (创造)' : '') + '</span></div>';
      return '<div class="trade-row"><span class="t-name warn">' + label + ' (损坏)</span><span class="t-qty">' + this._reqList(r.cost) + '</span>' +
        '<button class="btn primary t-buy" data-sysrep="' + key + '">安装</button></div>';
    };
    const html = this._head('飞船 · STARSHIP', '船体 ' + Math.round(ship.hull) + '% · 起飞燃料 ' + Math.round(ship.launchFuel * 100) + '% · 脉冲燃料 ' + Math.round(ship.pulseFuel * 100) + '%', '<span class="kbd">ESC</span> 关闭') +
      '<div class="p-body">' +
      '<div class="p-title small">推进系统 · PROPULSION</div>' +
      row('SHIP_LAUNCH', ship.systems.launch, '起飞推进器 LAUNCH THRUSTER') +
      row('SHIP_PULSE', ship.systems.pulse, '脉冲引擎 PULSE ENGINE') +
      row('SHIP_HYPER', ship.systems.hyper, '超光速引擎 HYPERDRIVE') +
      '<div class="divider"></div>' +
      '<div class="p-title small">燃料与维修 · FUEL</div>' +
      '<div class="trade-row"><span class="t-name">起飞燃料 ' + Math.round(ship.launchFuel * 100) + '%</span><span class="t-qty">' + this._reqList([['DIHYDROGEN_JELLY', 1]]) + '</span><button class="btn t-buy" data-fuel="launch">加注</button></div>' +
      '<div class="trade-row"><span class="t-name">起飞燃料 (直接注入二氢)</span><span class="t-qty">' + this._reqList([['DIHYDROGEN', 40]]) + '</span><button class="btn t-buy" data-fuel="launch_raw">加注</button></div>' +
      '<div class="trade-row"><span class="t-name">脉冲引擎燃料 ' + Math.round(ship.pulseFuel * 100) + '%</span><span class="t-qty">' + this._reqList([['TRITIUM', 50]]) + '</span><button class="btn t-buy" data-fuel="pulse">加注</button></div>' +
      '<div class="trade-row"><span class="t-name">船体维修 ' + Math.round(ship.hull) + '%</span><span class="t-qty">' + this._reqList([['METAL_PLATING', 1]]) + '</span><button class="btn t-buy" data-fuel="hull">维修</button></div>' +
      '</div>' +
      '<div class="p-foot dim">起飞需要：起飞推进器 + 至少 25% 燃料。脉冲引擎用于在星系内穿越，超光速引擎用于跃迁到其他星系。</div>';
    g.ui.openPanel('refiner', html, (root) => {
      root.querySelectorAll('[data-sysrep]').forEach((b) => b.addEventListener('click', () => {
        const key = b.dataset.sysrep;
        const r = REPAIRS[key];
        if (!g.inventory.hasAll(r.cost)) { g.audio.uiError(); g.ui.toast({ kind: 'warn', name: '材料不足', amt: '' }); return; }
        g.inventory.removeAll(r.cost);
        if (key === 'SHIP_LAUNCH') ship.systems.launch = true;
        if (key === 'SHIP_PULSE') ship.systems.pulse = true;
        if (key === 'SHIP_HYPER') ship.systems.hyper = true;
        ship.hull = Math.max(ship.hull, 65);
        g.audio.confirm();
        g.audio.questComplete();
        g.ui.toast({ kind: 'quest', name: r.name + ' 已安装', amt: '' });
        this.openShipRepair();
      }));
      root.querySelectorAll('[data-fuel]').forEach((b) => b.addEventListener('click', () => {
        const kind = b.dataset.fuel;
        let ok = false;
        if (kind === 'launch' && g.inventory.has('DIHYDROGEN_JELLY', 1)) { g.inventory.remove('DIHYDROGEN_JELLY', 1); ship.refuelLaunch(0.5); ok = true; }
        if (kind === 'launch_raw' && g.inventory.has('DIHYDROGEN', 40)) { g.inventory.remove('DIHYDROGEN', 40); ship.refuelLaunch(0.35); ok = true; }
        if (kind === 'pulse' && g.inventory.has('TRITIUM', 50)) { g.inventory.remove('TRITIUM', 50); ship.pulseFuel = Math.min(1, ship.pulseFuel + 0.4); ok = true; }
        if (kind === 'hull' && g.inventory.has('METAL_PLATING', 1)) { g.inventory.remove('METAL_PLATING', 1); ship.hull = Math.min(ship.maxHull, ship.hull + 40); ok = true; }
        if (ok) { g.audio.confirm(); this.openShipRepair(); } else g.audio.uiError();
      }));
    });
  }

  /* =================== title panels =================== */
  showTitlePanel(kind, inPause = false) {
    const g = this.game;
    const host = inPause ? null : document.getElementById('title-panel');
    const html = kind === 'help' ? this._helpHtml() : this._optionsHtml();
    if (inPause) {
      g.ui.openPanel('inventory', html, (root) => this._bindOptions(root));
      g.uiBlocking = true;
      return;
    }
    host.classList.remove('hidden');
    host.innerHTML = html;
    this._bindOptions(host);
    const close = host.querySelector('[data-close]');
    if (close) close.addEventListener('click', () => { host.classList.add('hidden'); g.audio.uiBack(); });
  }

  _helpHtml() {
    return this._head('操作说明 · CONTROLS', '融合了《无人深空》的玩法与《我的世界》的方块世界', '<button class="btn" data-close="1">关闭</button>') +
      '<div class="p-body two-col">' +
      '<div><div class="p-title small">地面 · ON FOOT</div>' +
      [['W A S D', '移动'], ['Shift', '疾跑'], ['Ctrl', '蹲下'], ['空格', '跳跃 / 空中长按启动喷射背包'],
       ['鼠标左键', '采矿光束 (采集/破坏方块)'], ['鼠标右键', '放置方块'], ['1-9 / 滚轮', '切换快捷栏'],
       ['E', '互动 (精炼器/构筑台/喂食生物)'], ['F', '进入飞船'], ['V', '分析镜 (扫描物种)'], ['C', '扫描脉冲 (寻找资源)'],
       ['R', '一键充能生命维持/防护'], ['L', '头灯'], ['Tab', '背包'], ['Q', '制作'], ['B', '建造'], ['J', '发现日志'],
       ['G', '创造模式开关 (无限资源/无敌/飞船全解锁)'], ['F3', '调试信息'], ['ESC', '暂停']]
        .map(([k, v]) => '<div class="stat-row"><span class="kbd">' + k + '</span><b>' + v + '</b></div>').join('') + '</div>' +
      '<div><div class="p-title small">飞行 · FLIGHT</div>' +
      [['鼠标', '控制机头'], ['W / S', '增减推力'], ['A / D', '横滚'], ['Shift', '加力'],
       ['空格 (地面)', '长按起飞'], ['空格 (高空)', '长按脱离大气层'], ['空格 (太空)', '长按进入星球/停靠空间站'],
       ['Tab (太空)', '长按脉冲引擎'], ['鼠标左键', '光子加农炮 (击碎小行星获得氚)'], ['F', '降落 / 下船'],
       ['C', '切换座舱/追尾视角'], ['M', '星系地图 (跃迁)'], ['T', '空间站交易']]
        .map(([k, v]) => '<div class="stat-row"><span class="kbd">' + k + '</span><b>' + v + '</b></div>').join('') +
      '<div class="divider"></div><div class="p-sub dim">生存要点：生命维持靠<b class="hi">氧</b>补充，危害防护靠<b class="hi">钠</b>补充，飞船起飞靠<b class="hi">二氢</b>。' +
      '过度破坏地形会引来<b class="warn">哨兵</b>。夜晚与风暴会加速消耗防护。</div>' +
      '<div class="p-sub"><b class="cy">创造模式 (标题菜单进入或随时按 G)</b>：所有资源无限、所有配方解锁、免疫伤害、' +
      '飞船三大引擎全部就绪且燃料无限 —— 可以直接起飞、脉冲穿越、跃迁星系，专心建造与观光。</div></div></div>';
  }

  _optionsHtml() {
    const g = this.game;
    const v = g.audio.volumes;
    const slider = (id, label, val, min, max, step) =>
      '<div class="stat-row"><span>' + label + '</span><input type="range" data-opt="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"><b class="mono" data-val="' + id + '">' + Number(val).toFixed(2) + '</b></div>';
    return this._head('设置 · OPTIONS', '', '<button class="btn" data-close="1">关闭</button>') +
      '<div class="p-body">' +
      '<div class="p-title small">音频 · AUDIO</div>' +
      slider('master', '主音量', v.master, 0, 1, 0.05) +
      slider('sfx', '音效', v.sfx, 0, 1, 0.05) +
      slider('ui', '界面音', v.ui, 0, 1, 0.05) +
      slider('music', '音乐', v.music, 0, 1, 0.05) +
      slider('amb', '环境音', v.amb, 0, 1, 0.05) +
      '<div class="divider"></div><div class="p-title small">画面与操作 · VIDEO</div>' +
      '<div class="stat-row"><span>画质预设</span><span>' +
        ['auto', 'high', 'med', 'low'].map((q) => '<button class="btn' + (g.settings.quality === q ? ' primary' : '') + '" data-quality="' + q + '">' +
          ({ auto: '自动', high: '高', med: '中', low: '低' })[q] + '</button>').join(' ') +
      '</span></div>' +
      slider('sens', '鼠标灵敏度', g.input.sensitivity * 1000, 0.5, 6, 0.1) +
      slider('fov', '视场角', g.settings.fov, 60, 110, 1) +
      slider('view', '视距 (区块)', g.settings.viewDist, 4, 11, 1) +
      '<div class="stat-row"><span>泛光 (Bloom)</span><input type="checkbox" data-opt="bloom" ' + (g.settings.bloom ? 'checked' : '') + '></div>' +
      '<div class="stat-row"><span>Y 轴反转</span><input type="checkbox" data-opt="invert" ' + (g.input.invertY ? 'checked' : '') + '></div>' +
      '</div>';
  }

  _bindOptions(root) {
    const g = this.game;
    root.querySelectorAll('[data-quality]').forEach((b) => b.addEventListener('click', () => {
      const q = b.dataset.quality;
      g.settings.quality = q;
      if (q === 'auto') { g.setQuality('med'); g.settings.quality = 'auto'; }
      else g.setQuality(q);
      g.audio.uiClick();
      this.showTitlePanel('options', g.mode !== 'title');
    }));
    root.querySelectorAll('[data-opt]').forEach((el) => {
      el.addEventListener('input', () => {
        const id = el.dataset.opt;
        const val = el.type === 'checkbox' ? el.checked : parseFloat(el.value);
        const lab = root.querySelector('[data-val="' + id + '"]');
        if (lab) lab.textContent = Number(val).toFixed(2);
        if (['master', 'sfx', 'ui', 'music', 'amb'].includes(id)) g.audio.setVolume(id, val);
        else if (id === 'sens') g.input.sensitivity = val / 1000;
        else if (id === 'fov') { g.settings.fov = val; g.camera.fov = val; g.camera.updateProjectionMatrix(); }
        else if (id === 'view') { g.settings.viewDist = val; if (g.world) g.world.viewDist = val; }
        else if (id === 'bloom') g.settings.bloom = val;
        else if (id === 'invert') g.input.invertY = val;
      });
    });
  }
}
