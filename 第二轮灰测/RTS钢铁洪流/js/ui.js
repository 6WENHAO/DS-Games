/* ===================================================================
   ui.js — DOM 界面：侧边栏建造面板 / 资源 / 选中信息 / 各种全屏界面

   与游戏的关系：只读 game 状态 + 调用 game 的公开命令方法。
   侧边栏卡片只在"可造列表发生变化"时重建 DOM；每帧只改已有节点的
   宽度/文字/class —— 否则每帧 innerHTML 会让 GC 抽风、按钮闪烁。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const U = R.U;

  const $ = (id) => document.getElementById(id);

  R.UI = class UI {
    constructor() {
      this.g = null; this.r = null; this.input = null;
      this.tab = 'base';
      this.cards = new Map();       // defId → {el, ...refs}
      this.cardOrder = [];
      this.lastSig = '';
      this.refreshT = 0;
      this.selSig = '';

      /* 开局设置 */
      this.setup = {
        faction: 'guard',
        difficulty: 'normal',
        mapSize: 'medium',
        fog: true,
      };

      this.dom = {
        credits: $('credits'),
        pwFill: $('pw-fill'), pwMark: $('pw-mark'), pwText: $('pw-text'),
        tabs: $('tabs'), list: $('buildlist'),
        tools: $('tools'),
        toasts: $('toasts'),
        selbar: $('selbar'), selIcon: $('sel-icon'), selName: $('sel-name'),
        selDetail: $('sel-detail'), selList: $('sel-list'),
        tbTime: $('tb-time'), tbUnits: $('tb-units'), tbEnemy: $('tb-enemy'), tbDiff: $('tb-diff'),
        modehint: $('modehint'),
        swbar: $('swbar'), swBtn: $('sw-btn'),
        minimap: $('minimap'),
      };

      this.buildSetupOptions();
      this.wireScreens();
      this.wireTools();
      this.buildTechScreen();
    }

    /* ================= 开局设置界面 ================= */
    buildSetupOptions() {
      const mk = (host, items, key, render) => {
        host.innerHTML = '';
        for (const it of items) {
          const b = document.createElement('button');
          b.className = 'opt' + (this.setup[key] === it.v ? ' on' : '');
          b.innerHTML = render(it);
          b.addEventListener('click', () => {
            this.setup[key] = it.v;
            for (const c of host.children) c.classList.remove('on');
            b.classList.add('on');
            if (R.Audio) R.Audio.ui('click');
          });
          host.appendChild(b);
        }
      };

      mk($('opt-faction'),
        Object.keys(R.FACTIONS).map((k) => ({ v: k, d: R.FACTIONS[k] })),
        'faction',
        (it) => '<span style="color:' + it.d.color + '">' + it.d.name + '</span><small>' + it.d.desc + '</small>');

      mk($('opt-diff'),
        [{ v: 'easy' }, { v: 'normal' }, { v: 'hard' }],
        'difficulty',
        (it) => {
          const d = R.AI_DIFF[it.v];
          return d.name + '<small>首波约 ' + d.attackSize + ' 单位</small>';
        });

      mk($('opt-size'),
        Object.keys(R.MAP_SIZES).map((k) => ({ v: k, d: R.MAP_SIZES[k] })),
        'mapSize',
        (it) => it.d.name.split(' · ')[1] + '<small>' + it.d.w + '×' + it.d.h + ' 格</small>');

      mk($('opt-fog'),
        [{ v: true, n: '开启' }, { v: false, n: '关闭' }],
        'fog',
        (it) => it.n + '<small>' + (it.v ? '需侦察' : '全图可见') + '</small>');
    }

    /* ================= 全屏界面按钮 ================= */
    wireScreens() {
      const self = this;
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const act = btn.getAttribute('data-act');
        if (R.Audio) { R.Audio.init(); R.Audio.ui('click'); }
        switch (act) {
          case 'start': R.App.start(self.setup); break;
          case 'help': self.prevScreen = self.currentScreen; self.showScreen('scr-help'); break;
          case 'tech': self.prevScreen = self.currentScreen; self.showScreen('scr-tech'); break;
          case 'back': self.showScreen(self.prevScreen || 'scr-title'); break;
          case 'resume': self.setPaused(false); break;
          case 'restart': R.App.start(self.setup); break;
          case 'title': R.App.toTitle(); break;
          default: break;
        }
      });

      // 暂停面板选项
      const sp = $('opt-speed');
      if (sp) sp.addEventListener('input', () => {
        if (this.g) this.g.speed = parseInt(sp.value, 10) / 100;
      });
      const vol = $('opt-vol');
      if (vol) vol.addEventListener('input', () => {
        const v = parseInt(vol.value, 10) / 100;
        if (R.Audio) R.Audio.setVolume(v, 1, 1);
      });
      const edge = $('opt-edge');
      if (edge) edge.addEventListener('change', () => {
        if (this.input) this.input.edgeScroll = edge.checked;
      });
      const shake = $('opt-shake');
      if (shake) shake.addEventListener('change', () => {
        this.shakeOn = shake.checked;
      });
      this.shakeOn = true;
    }

    wireTools() {
      const self = this;
      this.dom.tools.addEventListener('click', (e) => {
        const b = e.target.closest('.tool');
        if (!b) return;
        const t = b.getAttribute('data-tool');
        if (R.Audio) R.Audio.ui('click');
        if (!self.g) return;
        switch (t) {
          case 'repair':
            self.input.mode = self.input.mode === 'repair' ? null : 'repair';
            break;
          case 'sell':
            self.input.mode = self.input.mode === 'sell' ? null : 'sell';
            break;
          case 'pause': self.togglePause(); break;
          case 'menu': self.setPaused(true); break;
          default: break;
        }
      });

      if (this.dom.swBtn) {
        this.dom.swBtn.addEventListener('click', () => {
          if (!this.g) return;
          const sw = this.g.superWeaponState(this.g.me);
          if (sw && sw.ready) { this.input.mode = 'super'; this.r.superTargeting = true; }
          else if (R.Audio) R.Audio.ui('deny');
        });
      }
    }

    /* ================= 界面切换 ================= */
    showScreen(id) {
      for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
      if (id) {
        const el = $(id);
        if (el) el.classList.remove('hidden');
      }
      this.currentScreen = id;
    }
    hideScreens() { this.showScreen(null); }

    togglePause() { this.setPaused(!(this.g && this.g.paused)); }
    setPaused(v) {
      if (!this.g || this.g.over) return;
      this.g.paused = v;
      if (v) { this.fillPauseStats(); this.showScreen('scr-pause'); }
      else this.hideScreens();
    }

    /* ================= 对局接入 ================= */
    attach(game, renderer, input) {
      this.g = game; this.r = renderer; this.input = input;
      this.cards.clear();
      this.lastSig = '';
      this.tab = 'base';
      this.buildTabs();
      this.buildCards();
      this.dom.tbDiff.textContent = (R.AI_DIFF[game.difficulty] || R.AI_DIFF.normal).name;
      this.dom.selbar.classList.add('hidden');
      game.onGameOver = (res) => this.showOver(res);
      this.toastEls = [];
      this.dom.toasts.innerHTML = '';
    }

    /* ---------------- 页签 ---------------- */
    buildTabs() {
      const host = this.dom.tabs;
      host.innerHTML = '';
      this.tabEls = {};
      for (const t of R.TABS) {
        const el = document.createElement('div');
        el.className = 'tab';
        el.textContent = t.name;
        el.addEventListener('click', () => {
          if (el.classList.contains('locked')) { if (R.Audio) R.Audio.ui('deny'); return; }
          this.tab = t.id;
          this.buildCards();
          if (R.Audio) R.Audio.ui('tab');
        });
        host.appendChild(el);
        this.tabEls[t.id] = el;
      }
      this.syncTabs();
    }

    syncTabs() {
      if (!this.g) return;
      const me = this.g.me;
      for (const t of R.TABS) {
        const el = this.tabEls[t.id];
        if (!el) continue;
        const locked = !!(t.from && !me.has(t.from));
        el.classList.toggle('locked', locked);
        el.classList.toggle('active', this.tab === t.id);
      }
      // 当前页签被锁（产线被拆）→ 自动回到建筑页
      const cur = R.TABS.find((t) => t.id === this.tab);
      if (cur && cur.from && !me.has(cur.from)) {
        this.tab = 'base';
        this.buildCards();
      }
    }

    /* ---------------- 建造卡片 ---------------- */
    itemsForTab() {
      const me = this.g.me;
      const out = [];
      if (this.tab === 'base' || this.tab === 'def') {
        for (const k in R.BUILDINGS) {
          const d = R.BUILDINGS[k];
          if (d.tab !== this.tab) continue;
          if (d.faction && d.faction !== me.faction) continue;
          if (d.id === 'conyard' && me.has('conyard')) continue;   // 已有基地就不列
          out.push(d);
        }
      } else {
        const tabDef = R.TABS.find((t) => t.id === this.tab);
        for (const k in R.UNITS) {
          const d = R.UNITS[k];
          if (d.tab !== this.tab) continue;
          if (d.faction && d.faction !== me.faction) continue;
          if (tabDef && tabDef.from && d.from !== tabDef.from) continue;
          out.push(d);
        }
      }
      out.sort((a, b) => a.cost - b.cost);
      return out;
    }

    buildCards() {
      const host = this.dom.list;
      host.innerHTML = '';
      this.cards.clear();
      this.cardOrder = [];
      const items = this.itemsForTab();
      const art = (R.Art && R.Art.ready) ? R.Art : null;

      for (const def of items) {
        const el = document.createElement('div');
        el.className = 'bcard';
        el.title = def.name + '　' + def.cost + ' 信用点\n' + (def.desc || '');

        const icon = document.createElement('div');
        icon.className = 'bcard-icon';
        let img = null;
        if (art && art.icon) {
          try { img = art.icon(def.id); } catch (err) { img = null; }
        }
        if (img) icon.appendChild(img);
        else { icon.classList.add('fb'); icon.textContent = def.name; }

        const name = document.createElement('div');
        name.className = 'bcard-name';
        name.textContent = def.name;

        const cost = document.createElement('div');
        cost.className = 'bcard-cost';
        const costV = document.createElement('span');
        costV.textContent = '$' + def.cost;
        const timeV = document.createElement('span');
        timeV.textContent = def.build.toFixed(0) + 's';
        cost.appendChild(costV); cost.appendChild(timeV);

        const key = document.createElement('div');
        key.className = 'bcard-key';
        key.textContent = def.key || '';

        const mask = document.createElement('div');
        mask.className = 'bcard-mask';
        const prog = document.createElement('div');
        prog.className = 'bcard-prog';
        const badge = document.createElement('div');
        badge.className = 'bcard-badge hidden';
        const state = document.createElement('div');
        state.className = 'bcard-state hidden';

        el.appendChild(icon); el.appendChild(name); el.appendChild(cost);
        el.appendChild(key); el.appendChild(mask); el.appendChild(prog);
        el.appendChild(badge); el.appendChild(state);

        el.addEventListener('click', (e) => this.onCardClick(def, e));
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.g.queueCancel(this.g.me, def.id, e.shiftKey);
        });

        host.appendChild(el);
        const rec = { def, el, costV, mask, prog, badge, state };
        this.cards.set(def.id, rec);
        this.cardOrder.push(rec);
      }
      this.refreshCards(true);
    }

    onCardClick(def, e) {
      const g = this.g, me = g.me;
      if (!me.canBuild(def)) {
        const miss = me.missingReq(def);
        g.notify(me, '需要：' + (miss.join(' / ') || '前置建筑'), 'deny');
        if (R.Audio) R.Audio.ui('deny');
        return;
      }
      // 已经造好待放置 → 直接进入放置模式
      if (R.isBuilding(def.id) && me.pendingBuild === def.id) {
        me.pendingBuildHold = false;
        this.input.mode = 'place';
        this.input.syncPlacement();
        return;
      }
      const n = e.shiftKey ? 5 : 1;
      g.queueAdd(me, def.id, n);
    }

    /** 每帧（限频）刷新卡片状态 */
    refreshCards(force) {
      if (!this.g) return;
      const g = this.g, me = g.me;
      // 可造列表签名变了就重建（科技解锁 / 产线被拆）
      let sig = this.tab + '|';
      for (const rec of this.cardOrder) sig += (me.canBuild(rec.def) ? '1' : '0');
      const items = this.itemsForTab();
      sig += '|' + items.length;
      if (sig !== this.lastSig) {
        this.lastSig = sig;
        if (!force && items.length !== this.cardOrder.length) { this.buildCards(); return; }
      }

      for (const rec of this.cardOrder) {
        const def = rec.def;
        const can = me.canBuild(def);
        rec.el.classList.toggle('locked', !can);
        const afford = me.credits >= def.cost;
        rec.costV.className = afford ? 'afford' : 'no';

        // 队列状态
        const q = me.queueOf(def);
        let count = 0, first = null;
        for (const it of q) {
          if (it.id !== def.id) continue;
          count++;
          if (!first) first = it;
        }
        const activeItem = (q.length && q[0].id === def.id) ? q[0] : null;

        if (count > 1) { rec.badge.textContent = '×' + count; rec.badge.classList.remove('hidden'); }
        else rec.badge.classList.add('hidden');

        let prog = 0, stateTxt = '', stateCls = '';
        if (activeItem) {
          prog = activeItem.progress;
          if (activeItem.ready) { stateTxt = '选择位置'; stateCls = 'ready'; }
          else if (activeItem.held) { stateTxt = '产线离线'; stateCls = 'hold'; }
          else if (activeItem.starved) { stateTxt = '资金不足'; stateCls = 'hold'; }
        } else if (count > 0) {
          stateTxt = '排队中';
        }
        rec.prog.style.width = (prog * 100).toFixed(1) + '%';
        rec.mask.style.height = ((1 - prog) * 100).toFixed(1) + '%';
        rec.el.classList.toggle('active', !!activeItem && !activeItem.ready);
        rec.el.classList.toggle('ready', !!(activeItem && activeItem.ready));
        if (stateTxt) {
          rec.state.textContent = stateTxt;
          rec.state.className = 'bcard-state ' + stateCls;
        } else {
          rec.state.className = 'bcard-state hidden';
        }
      }
    }

    /* ================= 侧栏资源 ================= */
    refreshRes() {
      const me = this.g.me;
      this.dom.credits.textContent = U.comma(me.credits);
      const made = me.powerMade, used = me.powerUsed;
      const cap = Math.max(made, used, 100);
      const fill = this.dom.pwFill;
      fill.style.width = (Math.min(1, used / cap) * 100).toFixed(1) + '%';
      fill.classList.toggle('low', me.lowPower);
      this.dom.pwMark.style.left = (Math.min(1, made / cap) * 100).toFixed(1) + '%';
      this.dom.pwText.textContent = '电力 ' + Math.round(used) + ' / ' + Math.round(made) +
        (me.lowPower ? '　效率 ' + Math.round(me.powerEff * 100) + '%' : '');
      this.dom.pwText.classList.toggle('low', me.lowPower);
    }

    refreshTop() {
      const g = this.g;
      this.dom.tbTime.textContent = U.mmss(g.time);
      this.dom.tbUnits.textContent = g.me.units.length + ' / ' + R.RULES.unitCap;
      const enemy = g.players[1];
      if (g.fogEnabled) {
        // 只报已探明的
        this.dom.tbEnemy.textContent = enemy.knownEnemy ? String(g.me.knownEnemy.size) + ' 建筑' : '?';
      } else {
        this.dom.tbEnemy.textContent = enemy.buildings.length + ' 建筑';
      }
    }

    refreshSuper() {
      const g = this.g;
      const sw = g.superWeaponState(g.me);
      if (!sw) { this.dom.swbar.classList.add('hidden'); return; }
      this.dom.swbar.classList.remove('hidden');
      const btn = this.dom.swBtn;
      btn.classList.toggle('ready', sw.ready);
      btn.querySelector('.sw-state').textContent = sw.ready ? '就绪（Q）' : '充能 ' + Math.round(sw.frac * 100) + '%';
      btn.querySelector('.sw-fill').style.width = (sw.frac * 100).toFixed(1) + '%';
    }

    /* ================= 选中信息 ================= */
    onSelectionChanged() { this.selSig = ''; this.refreshSel(); }

    refreshSel() {
      const g = this.g;
      if (!g) return;
      const sel = g.selection.filter((e) => !e.dead);
      if (!sel.length) { this.dom.selbar.classList.add('hidden'); this.selSig = ''; return; }
      this.dom.selbar.classList.remove('hidden');

      // 分组统计
      const groups = new Map();
      for (const e of sel) {
        const k = e.def.id;
        groups.set(k, (groups.get(k) || 0) + 1);
      }
      let sig = '';
      for (const [k, v] of groups) sig += k + v + ',';
      const lead = sel[0];

      if (sig !== this.selSig) {
        this.selSig = sig;
        // 图标
        this.dom.selIcon.innerHTML = '';
        const art = (R.Art && R.Art.ready) ? R.Art : null;
        if (art && art.icon) {
          try {
            const img = art.icon(lead.def.id);
            if (img) this.dom.selIcon.appendChild(img);
          } catch (err) { /* 忽略 */ }
        }
        // 名称
        const mine = lead.owner === g.me;
        this.dom.selName.textContent = lead.def.name + (sel.length > 1 ? '　等 ' + sel.length + ' 个单位' : '') +
          (mine ? '' : '　[' + lead.owner.name + ']');
        this.dom.selName.style.color = mine ? '' : lead.owner.color;
        // 分组芯片
        this.dom.selList.innerHTML = '';
        if (groups.size > 1 || sel.length > 1) {
          for (const [k, v] of groups) {
            const d = R.def(k);
            const chip = document.createElement('span');
            chip.className = 'sel-chip';
            chip.innerHTML = (d ? d.name : k) + ' <b>' + v + '</b>';
            this.dom.selList.appendChild(chip);
          }
        }
      }

      // 详情每帧更新
      const parts = [];
      parts.push('生命 ' + Math.ceil(lead.hp) + ' / ' + lead.maxHp);
      if (lead.weapon) {
        parts.push(lead.weapon.name + '　伤害 ' + lead.weapon.dmg + '　射程 ' + lead.weapon.range.toFixed(1) + '格');
      }
      if (lead.def.harvester) {
        parts.push('载矿 ' + Math.round(lead.cargo) + ' / ' + lead.def.harvester.capacity +
          '　状态 ' + this.harvStateName(lead.harvState));
      }
      if (lead.isAir) parts.push('弹药 ' + lead.ammo + ' / ' + lead.def.ammo);
      if (lead.isBuilding) {
        const p = lead.def.power || 0;
        if (p > 0) parts.push('发电 +' + p);
        else if (p < 0) parts.push('耗电 ' + p);
        if (lead.repairing) parts.push('修理中');
        if (lead.def.produces) parts.push('产线：' + lead.def.produces);
      }
      if (lead.veteran) parts.push('老兵 ' + lead.veteran + ' 级');
      if (!lead.isBuilding && lead.order) parts.push('指令：' + this.orderName(lead.order.type));
      this.dom.selDetail.innerHTML = parts.join('　·　');
    }

    harvStateName(s) {
      return ({ seek: '寻矿', toOre: '前往矿区', mining: '采集中', toRef: '返回精炼厂', unload: '卸载中' })[s] || s;
    }
    orderName(t) {
      return ({
        idle: '待机', move: '移动', attack: '攻击', attackMove: '攻击移动',
        guard: '警戒', harvest: '采矿', deploy: '展开', capture: '占领',
        rearm: '返航补弹', scatter: '散开',
      })[t] || t;
    }

    /* ================= 提示条 ================= */
    refreshToasts() {
      const g = this.g;
      const host = this.dom.toasts;
      // 简单同步：数量不一致就重画（提示条很少，代价可忽略）
      if (host.childElementCount !== g.toasts.length) {
        host.innerHTML = '';
        for (const t of g.toasts) {
          const el = document.createElement('div');
          el.className = 'toast' + (/不足|攻击|摧毁|损失|占领/.test(t.text) ? ' warn' : '');
          el.textContent = t.text;
          host.appendChild(el);
        }
      }
    }

    /* ================= 模式提示 ================= */
    refreshModeHint() {
      const m = this.input ? this.input.mode : null;
      const map = {
        place: '左键放置建筑　·　右键取消',
        attackMove: '攻击移动：左键点击目标区域',
        sell: '出售模式：点击己方建筑（Shift 连续）',
        repair: '修理模式：点击己方建筑切换修理',
        super: '离子炮：左键指定打击坐标',
      };
      const txt = m ? map[m] : null;
      const el = this.dom.modehint;
      if (txt) { el.textContent = txt; el.classList.remove('hidden'); }
      else el.classList.add('hidden');
      // 工具按钮高亮
      for (const b of this.dom.tools.children) {
        const t = b.getAttribute('data-tool');
        b.classList.toggle('on', (t === 'sell' && m === 'sell') || (t === 'repair' && m === 'repair') ||
          (t === 'pause' && this.g && this.g.paused));
      }
    }

    /* ================= 侧边栏快捷键 ================= */
    onHotkey(e) {
      if (!this.g || e.ctrlKey || e.altKey) return;
      // 只在当前页签内匹配 key 字段
      const k = e.key ? e.key.toUpperCase() : '';
      if (!k) return;
      for (const rec of this.cardOrder) {
        if ((rec.def.key || '').toUpperCase() === k) {
          this.onCardClick(rec.def, { shiftKey: e.shiftKey });
          return;
        }
      }
    }

    /* ================= 每帧 ================= */
    update(dt) {
      if (!this.g) return;
      this.refreshT -= dt;
      this.refreshSel();
      this.refreshModeHint();
      if (this.refreshT > 0) return;
      this.refreshT = 0.1;
      this.refreshRes();
      this.refreshTop();
      this.refreshSuper();
      this.syncTabs();
      this.refreshCards();
      this.refreshToasts();
    }

    /* ================= 统计面板 ================= */
    statRows(rows) {
      return rows.map((r) => '<div class="stat-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
    }

    fillPauseStats() {
      const g = this.g, me = g.me, en = g.players[1];
      $('pause-stats').innerHTML = this.statRows([
        ['作战时间', U.mmss(g.time)],
        ['当前资金', U.comma(me.credits)],
        ['累计采矿', U.comma(me.stats.harvested)],
        ['累计支出', U.comma(me.stats.spent)],
        ['我方单位', me.units.length + ' 个'],
        ['我方建筑', me.buildings.length + ' 座'],
        ['击毁敌军', me.stats.kills + ' 个'],
        ['我方损失', me.stats.unitsLost + ' 个'],
        ['电力', Math.round(me.powerUsed) + ' / ' + Math.round(me.powerMade)],
        ['敌军建筑（已探明）', me.knownEnemy.size + ' 座'],
      ]);
    }

    showOver(res) {
      const g = this.g, me = g.me;
      const win = res === 'win';
      const t = $('over-title');
      t.textContent = win ? '胜 利' : '战 败';
      t.className = 'scr-title ' + (win ? 'win' : 'lose');
      $('over-sub').textContent = win
        ? '敌军基地已被彻底清除。钢铁洪流不可阻挡。'
        : '我方最后一处据点陷落了。下一次，记得先造发电厂。';
      $('over-stats').innerHTML = this.statRows([
        ['作战时间', U.mmss(g.time)],
        ['累计采矿', U.comma(me.stats.harvested)],
        ['生产单位', me.stats.unitsBuilt + ' 个'],
        ['建造建筑', me.stats.buildingsBuilt + ' 座'],
        ['击毁敌军', me.stats.kills + ' 个'],
        ['我方损失', me.stats.unitsLost + ' 个'],
        ['最大同时在场', g.stats.peakUnits + ' 个'],
        ['难度', (R.AI_DIFF[g.difficulty] || R.AI_DIFF.normal).name],
      ]);
      this.showScreen('scr-over');
    }

    /* ================= 科技树界面 ================= */
    buildTechScreen() {
      const host = $('tech-body');
      if (!host) return;
      const tiers = [
        { name: '一级 · 起步（只需建造厂）', test: (d) => (d.req || []).length === 0 },
        { name: '二级 · 需要发电厂 / 精炼厂', test: (d) => (d.req || []).some((r) => r === 'power' || r === 'refinery') },
        { name: '三级 · 需要雷达站', test: (d) => (d.req || []).includes('radar') },
        { name: '四级 · 需要科技中心', test: (d) => (d.req || []).includes('tech') },
      ];
      const all = [];
      for (const k in R.BUILDINGS) all.push(R.BUILDINGS[k]);
      for (const k in R.UNITS) all.push(R.UNITS[k]);

      let html = '';
      const used = new Set();
      for (let i = tiers.length - 1; i >= 0; i--) {
        // 从高到低分配，保证每项只出现一次（取最高前置）
        const tier = tiers[i];
        tier.items = all.filter((d) => !used.has(d.id) && tier.test(d));
        for (const d of tier.items) used.add(d.id);
      }
      for (const tier of tiers) {
        if (!tier.items || !tier.items.length) continue;
        tier.items.sort((a, b) => a.cost - b.cost);
        html += '<div class="tech-tier"><h4>' + tier.name + '</h4><div class="tech-grid">';
        for (const d of tier.items) {
          const isB = R.isBuilding(d.id);
          const extra = [];
          if (d.faction) extra.push(R.FACTIONS[d.faction].short + '专属');
          if (isB && d.power > 0) extra.push('发电 +' + d.power);
          else if (isB && d.power < 0) extra.push('耗电 ' + d.power);
          if (d.weapon) {
            const w = R.WEAPONS[d.weapon];
            extra.push(w.name + ' 伤害' + w.dmg + ' 射程' + w.range);
          }
          if (!isB) extra.push('生命 ' + d.hp + ' · ' + R.ARMOR[d.armor]);
          html += '<div class="tech-item"><b>' + d.name + '</b>' +
            '<i>$' + d.cost + ' · ' + d.build + 's' + (isB ? ' · ' + d.size.w + '×' + d.size.h : '') + '</i>' +
            '<em>' + (d.desc || '') + (extra.length ? '<br>' + extra.join('　') : '') + '</em></div>';
        }
        html += '</div></div>';
      }
      host.innerHTML = html;
    }
  };

})();
