/* 铁幕1994 — 各屏幕：主菜单 / 战役与战略层 / 简报 / 结果与结局 / 设定集 / 遭遇战 */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, R = IC.Rules, UI = IC.UI;
  var S = IC.Screens = {};
  var L = function () { return window.DATA_LORE; };

  /* ===================== 主菜单 ===================== */
  S.menu = function () {
    var lore = L();
    UI.show('screen-menu');
    U.byId('m-title').textContent = lore.title || '铁幕1994';
    U.byId('m-tagline').textContent = lore.tagline || '';
    /* 模式 */
    var host = U.clear(U.byId('m-modes'));
    ['standard91', 'advanced94', 'endless94'].forEach(function (id) {
      var m = R.MODES[id];
      var lm = (lore.modes || {})[id === 'standard91' ? 'standard91' : id === 'advanced94' ? 'advanced94' : 'endless94'] || {};
      var el = U.el('div', 'mode-card' + (IC.Game.mode === id ? ' sel' : ''));
      el.innerHTML = '<div class="mt"><span>' + m.name + '</span><span class="tag gold">' + m.short + '</span></div>' +
        '<div class="md">' + U.esc(m.desc) + '</div>' +
        (lm.paragraphs ? '<div class="md" style="font-family:var(--serif);font-style:italic;color:#8fa0b0">' + U.esc(lm.paragraphs[0]) + '</div>' : '');
      el.onclick = function () { IC.Game.mode = id; IC.Game.persist(); S.menu(); };
      host.appendChild(el);
    });
    /* 阵营 */
    var sh = U.clear(U.byId('m-sides'));
    ['NATO', 'WP'].forEach(function (side) {
      var camp = window.DATA_CAMPAIGN[side];
      var lc = (lore.campaigns || {})[side] || {};
      var el = U.el('div', 'side-card ' + (side === 'NATO' ? 'nato' : 'wp') + (IC.Game.side === side ? ' sel' : ''));
      var prog = IC.Game.save.campaigns[side].progress;
      el.innerHTML = '<div class="sc-t">' + (side === 'NATO' ? '北约' : '华约') + '</div>' +
        '<div class="sc-s">' + U.esc((lc.name || camp.name).replace(/^[^·]*·\s*/, '')) + '</div>' +
        '<div class="sc-s" style="margin-top:6px;color:var(--gold)">进度 ' + prog + ' / 7</div>';
      el.onclick = function () { IC.Game.side = side; IC.Game.persist(); S.menu(); };
      sh.appendChild(el);
    });
    /* 背景 */
    var intro = U.clear(U.byId('m-intro'));
    intro.innerHTML = '<h3>' + U.esc((lore.intro || {}).heading || '战局') + '</h3>' + UI.paras((lore.intro || {}).paragraphs);
    /* 超限战简述 */
    var doc = U.clear(U.byId('m-doctrine'));
    var dm = window.DATA_HYBRID.domains;
    doc.innerHTML = Object.keys(dm).map(function (k) {
      return '<div style="margin-bottom:5px"><b style="color:' + dm[k].color + '">' + dm[k].icon + ' ' + dm[k].name + '</b> ' +
        '<span class="dim">' + U.esc(dm[k].desc) + '</span></div>';
    }).join('');
    var info = U.byId('m-save-info');
    var sv = IC.Game.save;
    info.innerHTML = '存档：北约 ' + sv.campaigns.NATO.progress + '/7 · 华约 ' + sv.campaigns.WP.progress + '/7 · 战略行动点 ' +
      sv.campaigns.NATO.sp + '/' + sv.campaigns.WP.sp;
  };

  /* ===================== 战役 + 战略层 ===================== */
  S.campaign = function (side) {
    IC.Game.side = side || IC.Game.side;
    var side2 = IC.Game.side;
    var camp = window.DATA_CAMPAIGN[side2];
    var lc = (L().campaigns || {})[side2] || {};
    var cs = IC.Game.save.campaigns[side2];
    UI.show('screen-campaign');
    U.byId('c-name').textContent = lc.name || camp.name;
    U.byId('c-back').onclick = function () { S.menu(); };
    U.byId('c-sp').innerHTML = '战略行动点 <b style="color:var(--gold)">' + cs.sp + '</b> · 政治资本 <b style="color:var(--gold)">' + cs.pc + '</b>';

    /* 任务列表 */
    var host = U.clear(U.byId('c-missions'));
    host.appendChild(U.el('div', 'dim', U.esc((lc.commander || '')) ));
    host.appendChild(U.el('div', 'hr'));
    camp.missions.forEach(function (m, i) {
      var lm = (lc.missions || {})[m.id] || {};
      var done = i < cs.progress;
      var locked = i > cs.progress;
      var el = U.el('div', 'mission-item' + (done ? ' done' : '') + (locked ? ' locked' : '') + (i === cs.progress ? ' cur' : ''));
      el.innerHTML = '<div class="mi-n">' + (i + 1) + '. ' + U.esc(lm.name || m.id) + '</div>' +
        '<div class="mi-p">' + U.esc(lm.place || '') + ' · ' + U.esc(lm.date || '') + ' · ' +
        ({ attack: '进攻', defend: '防御', finale: '决战', meeting: '遭遇' })[m.role] + ' · ' + m.turns + ' 回合</div>' +
        '<div class="mi-s">' + (done ? '<span class="tag good">已完成</span>' : locked ? '<span class="tag">未解锁</span>' : '<span class="tag gold">当前</span>') + '</div>';
      if (!locked) el.onclick = function () { S.briefing(side2, i); };
      host.appendChild(el);
    });

    /* 战略层 */
    var strat = U.clear(U.byId('c-strat'));
    U.byId('c-strat-hint').innerHTML = '用战略行动点购买非常规作战能力，效果将带入本战役之后的所有战斗。' +
      '<b style="color:var(--gold)">核决心</b>类投资会推高末日指数——升级失控会导致相互确保毁灭结局。';
    var doms = window.DATA_HYBRID.domains;
    Object.keys(doms).forEach(function (dk) {
      var box = U.el('div', 'strat-dom');
      box.appendChild(U.el('div', 'sd-h', '<span style="color:' + doms[dk].color + '">' + doms[dk].icon + '</span> ' + doms[dk].name));
      window.DATA_HYBRID.strategic.filter(function (o) { return o.domain === dk; }).forEach(function (op) {
        var owned = cs.strategic.indexOf(op.id) >= 0;
        var reqOk = (op.requires || []).every(function (r) { return cs.strategic.indexOf(r) >= 0; });
        var afford = cs.sp >= op.cost;
        var el = U.el('div', 'strat-op' + (owned ? ' owned' : (!reqOk || !afford ? ' locked' : '')));
        el.innerHTML = '<div class="so-t"><span>T' + op.tier + ' ' + U.esc(op.name) + '</span><span style="color:var(--gold)">' +
          (owned ? '已获得' : op.cost + ' SP') + '</span></div>' +
          '<div class="so-d">' + U.esc(op.desc) + '</div>' +
          '<div class="so-e">▸ ' + U.esc(op.text) + '</div>' +
          (!reqOk ? '<div class="so-d" style="color:#c25b52">需先完成：' + (op.requires || []).map(function (r) {
            var pr = window.DATA_HYBRID.strategic.filter(function (x) { return x.id === r; })[0];
            return pr ? pr.name : r;
          }).join('、') + '</div>' : '');
        if (!owned && reqOk && afford) {
          el.onclick = function () {
            UI.confirm('确认投入战略资源', '将花费 ' + op.cost + ' 点战略行动点执行「' + op.name + '」。' +
              ((op.effects.doomsdayMod || 0) > 0 ? '<br><br><span style="color:#d9d24a">警告：此举将使末日指数 +' + op.effects.doomsdayMod + '。</span>' : ''), function () {
              cs.sp -= op.cost;
              cs.strategic.push(op.id);
              if (op.effects.doomsdayMod) cs.doomsday = (cs.doomsday || 0) + op.effects.doomsdayMod;
              IC.Game.persist();
              S.campaign(side2);
              UI.toast('「' + op.name + '」已开始执行。');
            }, '执行');
          };
        }
        box.appendChild(el);
      });
      strat.appendChild(box);
    });

    /* 状态 */
    var status = U.clear(U.byId('c-status'));
    var eff = IC.Game.stratEffects(side2);
    status.appendChild(U.el('div', '',
      '<div class="kv"><span class="dim">战役进度</span><b>' + cs.progress + ' / 7</b></div>' +
      '<div class="kv"><span class="dim">战略行动点</span><b style="color:var(--gold)">' + cs.sp + '</b></div>' +
      '<div class="kv"><span class="dim">政治资本</span><b style="color:var(--gold)">' + cs.pc + '</b></div>' +
      '<div class="kv"><span class="dim">累计核使用</span><b>' + (cs.nukes || 0) + ' 次</b></div>'));
    var dd = U.el('div', 'meter');
    var dots = '';
    for (var i = 1; i <= 10; i++) dots += '<i class="' + ((cs.doomsday || 0) >= i ? (i >= 7 ? 'hot' : 'on') : '') + '"></i>';
    dd.innerHTML = '<span class="dim">末日指数</span><span class="mv"><span class="doom-dots">' + dots + '</span></span><b>' + (cs.doomsday || 0) + '/10</b>';
    status.appendChild(dd);
    status.appendChild(U.el('div', 'dim', '末日指数达到 10 将触发相互确保毁灭结局，战役立即终止。'));
    status.appendChild(U.el('div', 'hr'));
    status.appendChild(U.el('h4', '', '已生效的战略加成'));
    var lines = [];
    if (eff.incomeMult && eff.incomeMult !== 1) lines.push('本方分值收入 ×' + eff.incomeMult.toFixed(2));
    if (eff.enemyIncomeMult && eff.enemyIncomeMult !== 1) lines.push('敌方分值收入 ×' + eff.enemyIncomeMult.toFixed(2));
    if (eff.deployBonus) lines.push('每场战斗初始分值 +' + eff.deployBonus);
    if (eff.availMod) lines.push('每张卡可用数量 +' + eff.availMod);
    if (eff.deckSlots) lines.push('卡组槽位 +' + eff.deckSlots);
    if (eff.enemyCohesion) lines.push('敌军初始凝聚力 ' + eff.enemyCohesion);
    if (eff.enemyAvailMod) lines.push('敌方可用数量 ' + eff.enemyAvailMod);
    if (eff.enemyReserveDelay) lines.push('敌方增援延迟 ' + eff.enemyReserveDelay + ' 回合');
    if (eff.enemyAaAcc) lines.push('敌方防空命中 ' + Math.round(eff.enemyAaAcc * 100) + '%');
    if (eff.enemyOpticsMod) lines.push('敌方观测 ' + eff.enemyOpticsMod);
    if (eff.enemyArtyScatter) lines.push('敌方间瞄散布 +' + eff.enemyArtyScatter + ' 格');
    if (eff.enemyStartLoss) lines.push('战斗开始时敌方损失 ' + eff.enemyStartLoss + ' 支部队');
    if (eff.initialIntel) lines.push('开局获得电子侦察情报');
    if (eff.nukeAuthBonus) lines.push('核授权申请成功率 +' + Math.round(eff.nukeAuthBonus * 100) + '%');
    if (eff.nukePreAuth) lines.push('所有战斗开局即持有核释放权限');
    if (eff.chemAuth) lines.push('化学武器已获授权');
    if (eff.nbcTraining) lines.push('本方部队具备三防训练');
    if (eff.unlockOps && eff.unlockOps.length) lines.push('解锁战场指令：' + eff.unlockOps.map(function (id) {
      var o = window.DATA_HYBRID.battleOps.filter(function (x) { return x.id === id; })[0];
      return o ? o.name : id;
    }).join('、'));
    status.appendChild(U.el('div', 'dim', lines.length ? lines.join('<br>') : '尚未投入任何战略资源。'));
    status.appendChild(U.el('div', 'hr'));
    var bDeck = U.el('button', 'btn block', '编辑作战卡组');
    bDeck.onclick = function () { S.deck(side2, function () { S.campaign(side2); }); };
    status.appendChild(bDeck);
    var bNext = U.el('button', 'btn block primary', cs.progress >= 7 ? '战役已结束 · 查看结局' : '进入当前任务');
    bNext.style.marginTop = '6px';
    bNext.onclick = function () {
      if (cs.progress >= 7) S.ending(side2, cs.lastEnding || 'victory');
      else S.briefing(side2, cs.progress);
    };
    status.appendChild(bNext);
  };

  /* ===================== 简报 ===================== */
  S.briefing = function (side, idx) {
    var camp = window.DATA_CAMPAIGN[side];
    var m = camp.missions[idx];
    var lc = (L().campaigns || {})[side] || {};
    var lm = (lc.missions || {})[m.id] || {};
    IC.Game.ctx = { kind: 'campaign', side: side, index: idx };
    UI.show('screen-briefing');
    var doc = U.byId('b-doc');
    doc.innerHTML =
      '<div class="stamp">绝密</div>' +
      '<h2>' + U.esc(lm.name || m.id) + '</h2>' +
      '<div class="meta"><span>地点：' + U.esc(lm.place || '') + '</span><span>时间：' + U.esc(lm.date || '') + '</span>' +
      '<span>任务性质：' + ({ attack: '进攻', defend: '防御', finale: '决战', meeting: '遭遇' })[m.role] + '</span>' +
      '<span>时限：' + m.turns + ' 回合</span></div>' +
      UI.paras(lm.brief) +
      '<div class="field"><b>作战目标：</b>' + U.esc(lm.objective || '') + '</div>' +
      '<div class="field"><b>情报摘要：</b>' + U.esc(lm.intel || '') + '</div>' +
      '<div class="field"><b>战术建议：</b>' + U.esc(lm.hint || '') + '</div>' +
      '<h3>作战资源</h3>' +
      '<p>初始召唤分值 <b>' + Math.round(m.budget * ((m.role === 'attack' || m.role === 'finale') ? 1.22 : 1)) + '</b>，每回合基础收入 <b>' + m.income + '</b>；' +
      '敌军初始 <b>' + m.enemyBudget + '</b>，指挥水平 <b>' + m.aiSkill + '/5</b>。' +
      '胜利分门槛 <b>' + m.vpTarget + '</b>。' +
      (m.specials && m.specials.bothNukeAuth ? '<br><b style="color:#8a2f1c">本次作战双方均已持有战区核释放权限。</b>' : '') +
      (m.holdObjectives && m.holdObjectives.length ? '<br>必须死守目标点：' + m.holdObjectives.join('、') : '') + '</p>';
    U.byId('b-back').onclick = function () { S.campaign(side); };
    U.byId('b-deck').onclick = function () { S.deck(side, function () { S.briefing(side, idx); }); };
    U.byId('b-start').onclick = function () { S.startCampaignBattle(side, idx); };
  };

  /* ===================== 卡组 ===================== */
  S.deck = function (side, back) {
    var eff = IC.Game.stratEffects(side);
    IC.Deck.open({
      side: side, mode: IC.Game.mode,
      deck: IC.Game.getDeck(side, IC.Game.mode),
      slots: IC.DeckRules.maxSlots + (eff.deckSlots || 0),
      extraOps: eff.unlockOps || [],
      onSave: function (d) { IC.Game.setDeck(side, IC.Game.mode, d); },
      onBack: back
    });
  };

  /* ===================== 开始战斗 ===================== */
  S.startCampaignBattle = function (side, idx) {
    var camp = window.DATA_CAMPAIGN[side];
    var m = camp.missions[idx];
    var cs = IC.Game.save.campaigns[side];
    var eff = IC.Game.stratEffects(side);
    var enemySide = camp.enemy;
    var seed = (m.map.seed || 1234) + cs.progress * 7 + (IC.Game.mode === 'endless94' ? 99 : 0);
    var map = IC.MapGen.generate(Object.assign({ id: m.id, seed: seed }, m.map));
    var deck = IC.Game.getDeck(side, IC.Game.mode);
    if (!deck.cards.length) {
      deck = IC.AI.buildDeck(side, IC.Game.mode, null, new IC.RNG(seed + 3), { slots: IC.DeckRules.maxSlots + (eff.deckSlots || 0) });
      IC.Game.setDeck(side, IC.Game.mode, deck);
      UI.toast('尚未编辑卡组，已自动生成一份均衡编成。');
    }
    var enemyDeck = IC.AI.buildDeck(enemySide, IC.Game.mode, m.enemyDoctrine, new IC.RNG(seed + 11),
      { nukeDeck: (m.specials && (m.specials.bothNukeAuth || m.specials.enemyNukeChance > 0.15)) });
    /* 敌方也在打超限战：随战役推进逐步加码（这些 enemy* 字段作用于玩家一方） */
    var eStrat = { unlockOps: [] };
    if (idx >= 1) { eStrat.enemyIncomeMult = 0.96; }
    if (idx >= 2) { eStrat.enemyCohesion = -4; eStrat.unlockOps.push('op_jam'); }
    if (idx >= 3) { eStrat.enemyReserveDelay = 1; eStrat.unlockOps.push('op_psyops'); }
    if (idx >= 4) { eStrat.enemyIncomeMult = 0.90; eStrat.unlockOps.push('op_finance_raid'); }
    if (idx >= 5) { eStrat.nukeAuthBonus = 0.18; eStrat.unlockOps.push('op_sabotage'); }
    if (idx >= 6) { eStrat.nukePreAuth = true; eStrat.enemyOpticsMod = -1; }
    var st = IC.Battle.create({
      mode: IC.Game.mode, playerSide: side, mission: m, map: map,
      playerDeck: deck, enemyDeck: enemyDeck, seed: seed,
      strategic: eff, enemyStrategic: eStrat, doomsday: 0
    });
    IC.Battle.beginBattle(st);
    IC.BattleUI.start(st, function (res, state) { S.result(res, state, { kind: 'campaign', side: side, index: idx }); });
  };

  /* ===================== 遭遇战 ===================== */
  S.skirmish = function () {
    var maps = IC.SkirmishMaps;
    var cfg = { mapIdx: 0, side: IC.Game.side, mode: IC.Game.mode, budget: 1400, turns: 16, skill: 3, role: 'meeting' };
    var body = U.el('div');
    function rebuild() {
      body.innerHTML = '';
      var mh = U.el('div');
      mh.appendChild(U.el('h4', '', '战场'));
      var mr = U.el('div', 'vet-row'); mr.style.flexWrap = 'wrap';
      maps.forEach(function (mp, i) {
        var chip = U.el('span', 'chip' + (cfg.mapIdx === i ? ' on' : ''), mp.name);
        chip.onclick = function () { cfg.mapIdx = i; rebuild(); };
        mr.appendChild(chip);
      });
      mh.appendChild(mr);
      mh.appendChild(U.el('h4', '', '阵营'));
      var sr = U.el('div', 'vet-row');
      ['NATO', 'WP'].forEach(function (sd) {
        var chip = U.el('span', 'chip' + (cfg.side === sd ? ' on' : ''), UI.sideFull(sd));
        chip.onclick = function () { cfg.side = sd; rebuild(); };
        sr.appendChild(chip);
      });
      mh.appendChild(sr);
      mh.appendChild(U.el('h4', '', '模式'));
      var mo = U.el('div', 'vet-row');
      ['standard91', 'advanced94', 'endless94'].forEach(function (md) {
        var chip = U.el('span', 'chip' + (cfg.mode === md ? ' on' : ''), R.MODES[md].name);
        chip.onclick = function () { cfg.mode = md; rebuild(); };
        mo.appendChild(chip);
      });
      mh.appendChild(mo);
      mh.appendChild(U.el('h4', '', '兵力规模'));
      var br = U.el('div', 'vet-row');
      [['营级 900', 900], ['加强营 1400', 1400], ['战术群 2000', 2000], ['集群 3000', 3000]].forEach(function (b) {
        var chip = U.el('span', 'chip' + (cfg.budget === b[1] ? ' on' : ''), b[0]);
        chip.onclick = function () { cfg.budget = b[1]; rebuild(); };
        br.appendChild(chip);
      });
      mh.appendChild(br);
      mh.appendChild(U.el('h4', '', '敌军指挥水平'));
      var kr = U.el('div', 'vet-row');
      [1, 2, 3, 4, 5].forEach(function (k) {
        var chip = U.el('span', 'chip' + (cfg.skill === k ? ' on' : ''), '' + k);
        chip.onclick = function () { cfg.skill = k; rebuild(); };
        kr.appendChild(chip);
      });
      mh.appendChild(kr);
      mh.appendChild(U.el('h4', '', '作战性质'));
      var rr = U.el('div', 'vet-row');
      [['遭遇战', 'meeting'], ['我方进攻', 'attack'], ['我方防御', 'defend']].forEach(function (rl) {
        var chip = U.el('span', 'chip' + (cfg.role === rl[1] ? ' on' : ''), rl[0]);
        chip.onclick = function () { cfg.role = rl[1]; rebuild(); };
        rr.appendChild(chip);
      });
      mh.appendChild(rr);
      mh.appendChild(U.el('div', 'dim', '<br>遭遇战不计入战役进度，但会使用你为该阵营与模式保存的卡组。'));
      body.appendChild(mh);
    }
    rebuild();
    UI.modal('自由遭遇战', body, [
      { label: '取消' },
      { label: '编辑卡组', fn: function () { S.deck(cfg.side, function () { S.menu(); }); } },
      {
        label: '开始作战', cls: 'primary', fn: function () {
          var mp = maps[cfg.mapIdx];
          var seed = (mp.seed || 1) + Math.floor(Math.random() * 9999);
          var mission = {
            id: 'sk_' + mp.id, role: cfg.role, turns: cfg.turns,
            budget: cfg.budget, income: 60 + cfg.budget / 40,
            enemyBudget: Math.round(cfg.budget * (0.9 + cfg.skill * 0.06)),
            enemyIncome: Math.round((60 + cfg.budget / 40) * (0.92 + cfg.skill * 0.05)),
            aiSkill: cfg.skill, vpTarget: 70, holdObjectives: [],
            specials: { enemyNukeChance: 0.12 + cfg.skill * 0.04, escalationStart: 1 },
            enemyDoctrine: null
          };
          var map = IC.MapGen.generate({
            id: mp.id, profile: mp.profile, w: mp.w, h: mp.h, seed: seed,
            objectives: mp.objectives, westSide: 'NATO', deployWidth: 3
          });
          var deck = IC.Game.getDeck(cfg.side, cfg.mode);
          if (!deck.cards.length) {
            deck = IC.AI.buildDeck(cfg.side, cfg.mode, null, new IC.RNG(seed + 3), {});
            IC.Game.setDeck(cfg.side, cfg.mode, deck);
          }
          var foe = cfg.side === 'NATO' ? 'WP' : 'NATO';
          var enemyDeck = IC.AI.buildDeck(foe, cfg.mode, null, new IC.RNG(seed + 5), { nukeDeck: cfg.skill >= 3 });
          var st = IC.Battle.create({
            mode: cfg.mode, playerSide: cfg.side, mission: mission, map: map,
            playerDeck: deck, enemyDeck: enemyDeck, seed: seed, strategic: {}, enemyStrategic: {}
          });
          IC.Battle.beginBattle(st);
          IC.BattleUI.start(st, function (res, state) { S.result(res, state, { kind: 'skirmish', side: cfg.side }); });
        }
      }
    ]);
  };

  /* ===================== 战斗结果 ===================== */
  S.result = function (res, st, ctx) {
    UI.show('screen-result');
    var side = ctx.side;
    var win = res.kind === 'win';
    var lc = (L().campaigns || {})[side] || {};
    var lm = ctx.kind === 'campaign' ? ((lc.missions || {})[window.DATA_CAMPAIGN[side].missions[ctx.index].id] || {}) : {};
    var doc = U.byId('r-doc');
    var titleMap = { win: '战斗胜利', lose: '战斗失利', draw: '态势僵持', doomsday: '相互确保毁灭' };
    var stampMap = { win: '达成', lose: '失败', draw: '僵持', doomsday: '末日' };
    doc.innerHTML = '<div class="stamp">' + stampMap[res.kind] + '</div>' +
      '<h2>' + titleMap[res.kind] + '</h2>' +
      '<div class="meta"><span>' + U.esc(st.map.name) + '</span><span>' + st.turn + ' 回合</span><span>' + R.MODES[st.modeId].name + '</span></div>' +
      '<p>' + U.esc(res.why) + '</p>' +
      (res.kind === 'doomsday' ? UI.paras((L().escalation.doomsday || {}).paragraphs) :
        UI.paras(win ? lm.success : lm.failure)) +
      '<div class="result-grid">' +
      stat('胜利分', Math.round(res.vp) + ' : ' + Math.round(res.enemyVp)) +
      stat('歼灭敌军', res.killed + ' 支') +
      stat('本方损失', res.lost + ' 支') +
      stat('编制损耗', res.strengthLost) +
      stat('核使用（我/敌）', res.nukesUsed + ' / ' + res.enemyNukes) +
      stat('升级阶梯', res.escalation + ' 级') +
      '</div>';

    /* 战役推进 */
    var acts = U.clear(U.byId('r-actions'));
    if (ctx.kind === 'campaign') {
      var cs = IC.Game.save.campaigns[side];
      var m = window.DATA_CAMPAIGN[side].missions[ctx.index];
      if (!cs.log) cs.log = [];
      cs.nukes = (cs.nukes || 0) + res.nukesUsed;
      cs.doomsday = (cs.doomsday || 0) + Math.min(4, res.doomsday);
      if (win && ctx.index === cs.progress) {
        cs.progress++;
        cs.sp += m.rewardSP || 0;
        cs.pc += m.rewardPC || 0;
        doc.innerHTML += '<h3>战役推进</h3><p>获得战略行动点 <b>+' + (m.rewardSP || 0) + '</b>，政治资本 <b>+' + (m.rewardPC || 0) + '</b>。</p>';
      }
      cs.log.push({ id: m.id, kind: res.kind, vp: res.vp, turn: st.turn });
      IC.Game.persist();

      var doom = (cs.doomsday || 0) >= 10 || res.kind === 'doomsday';
      if (doom) {
        var bd = U.el('button', 'btn primary', '查看结局');
        bd.onclick = function () { S.ending(side, 'doomsday'); };
        acts.appendChild(bd);
      } else if (cs.progress >= 7) {
        var kind = (cs.nukes || 0) >= 3 ? 'pyrrhic' : 'victory';
        cs.lastEnding = kind;
        IC.Game.persist();
        var be = U.el('button', 'btn primary', '查看战役结局');
        be.onclick = function () { S.ending(side, kind); };
        acts.appendChild(be);
      } else {
        var bn = U.el('button', 'btn primary', win ? '继续下一任务' : '重新尝试本任务');
        bn.onclick = function () { S.briefing(side, win ? Math.min(6, cs.progress) : ctx.index); };
        acts.appendChild(bn);
      }
      var bc = U.el('button', 'btn', '返回战役地图');
      bc.onclick = function () { S.campaign(side); };
      acts.appendChild(bc);
      if (!win) {
        var bl = U.el('button', 'btn', '查看失败结局');
        bl.onclick = function () { S.ending(side, 'defeat'); };
        acts.appendChild(bl);
      }
    } else {
      var b1 = U.el('button', 'btn primary', '再打一场');
      b1.onclick = function () { S.menu(); S.skirmish(); };
      acts.appendChild(b1);
      var b2 = U.el('button', 'btn', '返回主菜单');
      b2.onclick = function () { S.menu(); };
      acts.appendChild(b2);
    }
    function stat(l, v) {
      return '<div class="result-stat"><div class="rs-l">' + l + '</div><div class="rs-v">' + v + '</div></div>';
    }
  };

  /* ===================== 结局 ===================== */
  S.ending = function (side, kind) {
    var lc = (L().campaigns || {})[side] || {};
    var e = (lc.endings || {})[kind];
    if (kind === 'doomsday') e = L().escalation.doomsday;
    if (!e) e = { title: '战役结束', paragraphs: ['战线沉寂下来。'] };
    UI.show('screen-result');
    var doc = U.byId('r-doc');
    doc.innerHTML = '<div class="stamp">' + (kind === 'victory' ? '胜利' : kind === 'defeat' ? '失败' : kind === 'pyrrhic' ? '焦土' : '末日') + '</div>' +
      '<h2>' + U.esc(e.title) + '</h2>' +
      '<div class="meta"><span>' + U.esc(lc.name || '') + '</span><span>1994 — 1995</span></div>' +
      UI.paras(e.paragraphs);
    var acts = U.clear(U.byId('r-actions'));
    var b1 = U.el('button', 'btn primary', '返回主菜单');
    b1.onclick = function () { S.menu(); };
    acts.appendChild(b1);
    var b2 = U.el('button', 'btn', '打另一条战线');
    b2.onclick = function () { IC.Game.side = side === 'NATO' ? 'WP' : 'NATO'; S.campaign(IC.Game.side); };
    acts.appendChild(b2);
  };

  /* ===================== 设定集 / 帮助 ===================== */
  S.showLore = function () {
    var lore = L();
    UI.show('screen-lore');
    U.byId('l-title').textContent = '设定集 · 时间线 · 学说';
    U.byId('l-back').onclick = function () { S.menu(); };
    var host = U.clear(U.byId('l-body'));
    host.innerHTML = '<h3>' + U.esc((lore.intro || {}).heading || '') + '</h3>' + UI.paras((lore.intro || {}).paragraphs) +
      '<h3>时间线</h3>' +
      (lore.timeline || []).map(function (t) {
        return '<div class="tl-item"><span class="d">' + U.esc(t.date) + '</span><span>' + U.esc(t.text) + '</span></div>';
      }).join('') +
      '<h3 style="margin-top:18px">超限战 · 混合战争学说</h3>' +
      Object.keys(lore.doctrine || {}).map(function (k) {
        var d = lore.doctrine[k];
        return '<h4 style="color:var(--gold);margin-top:12px">' + U.esc(d.name) + '</h4>' + UI.paras(d.paragraphs);
      }).join('') +
      '<h3 style="margin-top:18px">升级阶梯</h3>' +
      (lore.escalation.levels || []).map(function (l, i) {
        return '<div class="kv"><span><b>' + i + ' · ' + U.esc(l.name) + '</b></span><span class="dim">' + U.esc(l.text) + '</span></div>';
      }).join('');
  };

  S.showHelp = function (inModal) {
    var html =
      '<h3>核心循环</h3><p>每回合你会获得<b>召唤分值</b>（基础收入 + 控制目标点）。分值用于：从场外召唤卡组中的部队、' +
      '呼叫场外支援打击、执行超限战指令。部队在<b>部署区</b>（地图两侧高亮带）进入战场。</p>' +
      '<h3>行动点与射击</h3><p>每支部队每回合有 6 点行动点（AP）。移动按地形消耗，直射射击 2 AP，反坦克导弹 3 AP，' +
      '间瞄火力 3 AP。移动时经过敌军火力范围会遭到<b>警戒射击</b>——先侦察、再机动。</p>' +
      '<h3>装甲面与穿深</h3><p>命中后按<b>着弹面</b>（正面/侧面/后方/顶部）比较穿深与装甲。绕到侧后、或用集束弹药与攻顶导弹' +
      '打顶装甲，是击毁重型坦克的正确方式。动能弹穿深随距离衰减，反坦克导弹几乎不衰减但有最小射程。</p>' +
      '<h3>凝聚力与压制</h3><p>被火力覆盖会降低<b>凝聚力</b>：低于 38 进入「被压制」（命中与机动下降），低于 14 直接「溃散」并自动后撤。' +
      '炮兵的真正价值是压制而非杀伤。「就地整顿」可恢复凝聚力，指挥与后勤单位附近恢复更快。</p>' +
      '<h3>侦察与迷雾</h3><p>敌军只有被侦察到才可见、才可被射击。观测 vs 隐蔽 + 地形决定发现距离；' +
      '开火与移动会暴露自己。侦察单位、电子侦察指令与侦察机通场都能撕开迷雾。</p>' +
      '<h3>超限战（《超限战》/混合战争）</h3><p>战役间用<b>战略行动点</b>投资六大领域：电子战（干扰、雷达压制、数据链攻击）、' +
      '信息战（心理战、电台欺骗、舆论工程）、金融战（汇率狙击、油价操盘 → 直接削减敌方每回合分值收入）、' +
      '外交战（过境权、盟军增派、策动倒戈）、特种破袭（桥梁、雷达站、斩首）、核决心。' +
      '战场上这些能力表现为消耗<b>指挥点</b>的指令。</p>' +
      '<h3>核门槛与作战决心</h3><p>核与化学打击需要战区授权。在「超限战」面板<b>下达作战决心</b>可申请核释放权限，' +
      '成功率取决于已满足的升级条件（战斗持续、损失比例、丢失死守目标、敌方先行使用核化武器、升级阶梯、被突入纵深）' +
      '以及战略层的核决心投资。获批后升级阶梯与末日指数上升，<b>敌方也很可能获得核报复授权</b>。' +
      '末日指数在战役层累积到 10 会触发相互确保毁灭结局。无尽模式取消一切限制。</p>' +
      '<h3>三种模式</h3><p><b>标准 1991</b>：双方实际装备与实际编制数量。<b>推演 1994</b>：加入现实中因冷战结束而取消的进阶装备。' +
      '<b>无尽</b>：全部武器解禁、预备队无限、分值收入大幅提高。</p>' +
      '<h3>操作</h3><p>左键选择/移动/攻击 · 右键或 ESC 取消 · 滚轮缩放 · Shift+拖动平移 · 空格结束回合 · Tab 循环可行动部队 · D 构筑 · R 整顿。</p>';
    if (inModal) { UI.modal('规则与操作', '<div style="font-size:12.5px">' + html + '</div>', [{ label: '返回战场' }]); return; }
    UI.show('screen-lore');
    U.byId('l-title').textContent = '规则与操作';
    U.byId('l-back').onclick = function () { S.menu(); };
    U.byId('l-body').innerHTML = html;
  };
})();
