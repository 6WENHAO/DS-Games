/* ============================================================
 * 真·三國無雙 WEB —— HUD / 小地图 / 横幅 / 界面
 * ============================================================ */
'use strict';

var UI = (function () {
  var U = {};
  var $ = function (id) { return document.getElementById(id); };

  var els = {};
  var dmgPool = [];
  var msgTimer = {};

  U.init = function () {
    ['hudTop', 'hpFill', 'hpText', 'musouFill', 'musouBar', 'koCount', 'comboBox', 'comboNum',
      'timeText', 'moraleAlly', 'msgLog', 'banner', 'bannerSub', 'targetBar', 'targetName',
      'targetFill', 'minimap', 'objText', 'buffIcons', 'dmgLayer', 'screenTitle', 'screenSelect',
      'screenIntro', 'screenResult', 'screenPause', 'heroCards', 'introText', 'resultTitle',
      'resultSub', 'resultStats', 'pauseInfo', 'controlsHint', 'musouCut', 'musouCutText',
      'vignette', 'playerName', 'sorceryOverlay', 'bossBar', 'bossName', 'bossFill'
    ].forEach(function (id) { els[id] = $(id); });

    // 伤害数字池
    for (var i = 0; i < 40; i++) {
      var d = document.createElement('div');
      d.className = 'dmgNum';
      d.style.display = 'none';
      els.dmgLayer.appendChild(d);
      dmgPool.push({ el: d, t: 0 });
    }
  };

  /* ---------------- 界面切换 ---------------- */
  U.show = function (id) { els[id].style.display = ''; };
  U.hide = function (id) { els[id].style.display = 'none'; };

  /* ---------------- HUD ---------------- */
  U.setPlayerName = function (hero) {
    els.playerName.innerHTML = hero.name + ' <span class="pTitle">' + hero.title + '</span>';
  };

  U.updateHUD = function (p, game) {
    var hpFrac = Math.max(0, p.hp / p.maxHp);
    els.hpFill.style.width = (hpFrac * 100) + '%';
    els.hpFill.className = 'hpFill' + (hpFrac < 0.25 ? ' hpLow' : '');
    els.hpText.textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + p.maxHp;

    var mFrac = Math.min(1, p.musou / 100);
    els.musouFill.style.width = (mFrac * 100) + '%';
    els.musouBar.className = 'musouBar' + (mFrac >= 1 ? ' musouFull' : '');

    els.koCount.textContent = p.kills;

    var t = Math.max(0, game.timeLeft);
    var mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    els.timeText.textContent = (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss;

    els.moraleAlly.style.width = game.morale + '%';

    var buffs = '';
    if (p.atkBuff > 0) buffs += '<span class="buff buffAtk">攻×2 ' + Math.ceil(p.atkBuff) + '</span>';
    if (p.defBuff > 0) buffs += '<span class="buff buffDef">防×2 ' + Math.ceil(p.defBuff) + '</span>';
    els.buffIcons.innerHTML = buffs;
  };

  U.setCombo = function (hits, frac) {
    if (hits > 1) {
      els.comboBox.style.display = '';
      els.comboNum.textContent = hits;
      els.comboBox.style.opacity = Math.min(1, frac * 3);
      els.comboNum.style.transform = 'scale(' + (1 + Math.min(0.5, hits * 0.004)) + ')';
    } else {
      els.comboBox.style.display = 'none';
    }
  };

  U.setObjective = function (txt) {
    els.objText.innerHTML = txt;
  };

  /* ---------------- 战场信息 ---------------- */
  U.addMsg = function (html, cls) {
    var d = document.createElement('div');
    d.className = 'msg ' + (cls || '');
    d.innerHTML = html;
    els.msgLog.appendChild(d);
    while (els.msgLog.children.length > 6) els.msgLog.removeChild(els.msgLog.firstChild);
    setTimeout(function () { d.classList.add('msgFade'); }, 5200);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 6200);
  };

  /* ---------------- 中央横幅 ---------------- */
  var bannerTimeout = null;
  U.banner = function (text, sub, cls, dur) {
    els.banner.innerHTML = text;
    els.bannerSub.textContent = sub || '';
    els.banner.parentNode.className = 'bannerWrap ' + (cls || '');
    els.banner.parentNode.style.display = '';
    if (bannerTimeout) clearTimeout(bannerTimeout);
    bannerTimeout = setTimeout(function () {
      els.banner.parentNode.style.display = 'none';
    }, dur || 2600);
  };

  /* ---------------- 无双演出 ---------------- */
  U.musouCutIn = function (name, musouName) {
    els.musouCutText.innerHTML = '<span class="mcName">' + name + '</span><span class="mcSkill">' + musouName + '</span>';
    els.musouCut.style.display = '';
    els.musouCut.classList.remove('mcAnim');
    void els.musouCut.offsetWidth;
    els.musouCut.classList.add('mcAnim');
    setTimeout(function () { els.musouCut.style.display = 'none'; }, 1200);
  };
  U.setMusouActive = function (on, trueMusou) {
    els.vignette.className = on ? (trueMusou ? 'vigFire' : 'vigMusou') : '';
  };
  U.setSorcery = function (on) {
    els.sorceryOverlay.style.display = on ? '' : 'none';
  };
  U.setLowHp = function (on) {
    var c = els.vignette.className;
    if (c === 'vigMusou' || c === 'vigFire') return;
    els.vignette.className = on ? 'vigLow' : '';
  };

  /* ---------------- 交战武将血条 ---------------- */
  U.showTarget = function (name, title, frac, isBoss) {
    els.targetBar.style.display = '';
    els.targetName.innerHTML = (title ? '<span class="tTitle">' + title + '</span>' : '') + name;
    els.targetFill.style.width = (frac * 100) + '%';
    els.targetBar.className = 'targetBar' + (isBoss ? ' bossTarget' : '');
  };
  U.hideTarget = function () { els.targetBar.style.display = 'none'; };

  /* ---------------- 伤害数字 ---------------- */
  U.spawnDmg = function (sx, sy, text, cls) {
    for (var i = 0; i < dmgPool.length; i++) {
      if (dmgPool[i].t <= 0) {
        var p = dmgPool[i];
        p.t = 0.7;
        p.el.style.display = '';
        p.el.style.left = sx + 'px';
        p.el.style.top = sy + 'px';
        p.el.textContent = text;
        p.el.className = 'dmgNum ' + (cls || '');
        p.sy = sy;
        return;
      }
    }
  };
  U.updateDmg = function (dt) {
    for (var i = 0; i < dmgPool.length; i++) {
      var p = dmgPool[i];
      if (p.t > 0) {
        p.t -= dt;
        p.sy -= dt * 55;
        p.el.style.top = p.sy + 'px';
        p.el.style.opacity = Math.min(1, p.t * 3);
        if (p.t <= 0) p.el.style.display = 'none';
      }
    }
  };

  /* ---------------- 小地图 ---------------- */
  var mmCtx = null, mmSize = 176;
  U.drawMinimap = function (game) {
    if (!mmCtx) {
      els.minimap.width = mmSize; els.minimap.height = mmSize;
      mmCtx = els.minimap.getContext('2d');
    }
    var g = mmCtx;
    var world = game.stage.size;
    var sc = mmSize / world;
    var half = world / 2;
    function mx(x) { return (x + half) * sc; }
    function mz(z) { return (z + half) * sc; }

    g.fillStyle = 'rgba(18,22,14,0.82)';
    g.fillRect(0, 0, mmSize, mmSize);
    g.strokeStyle = 'rgba(200,180,120,0.5)';
    g.strokeRect(0.5, 0.5, mmSize - 1, mmSize - 1);

    // 据点
    game.bases.forEach(function (b) {
      g.fillStyle = b.side === 1 ? '#3d6dd8' : '#d8b53d';
      g.fillRect(mx(b.x) - 5, mz(b.z) - 5, 10, 10);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.strokeRect(mx(b.x) - 5, mz(b.z) - 5, 10, 10);
    });

    // 小兵（隔个采样）
    for (var i = 0; i < game.mobs.length; i += 2) {
      var m = game.mobs[i];
      if (m.dead) continue;
      g.fillStyle = m.side === 1 ? 'rgba(90,140,255,0.8)' : 'rgba(230,60,50,0.8)';
      g.fillRect(mx(m.pos.x) - 1, mz(m.pos.z) - 1, 2.5, 2.5);
    }

    // 武将
    game.officers.forEach(function (o) {
      if (o.dead) return;
      g.beginPath();
      g.arc(mx(o.pos.x), mz(o.pos.z), o.boss ? 5 : 3.6, 0, Math.PI * 2);
      g.fillStyle = o.side === 1 ? '#5a8cff' : '#ff4433';
      g.fill();
      g.lineWidth = 1.2;
      g.strokeStyle = '#fff';
      g.stroke();
      if (o.boss === 'jiao') {
        g.fillStyle = '#ffe066';
        g.font = 'bold 9px sans-serif';
        g.textAlign = 'center';
        g.fillText('角', mx(o.pos.x), mz(o.pos.z) - 7);
      }
    });

    // 道具
    g.fillStyle = '#7dff9a';
    game.groundItems.forEach(function (it) {
      g.fillRect(mx(it.pos.x) - 1.5, mz(it.pos.z) - 1.5, 3, 3);
    });

    // 玩家（带方向三角）
    var p = game.player;
    g.save();
    g.translate(mx(p.pos.x), mz(p.pos.z));
    g.rotate(-p.facing + Math.PI);
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 4); g.lineTo(-4, 4);
    g.closePath();
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = '#000';
    g.stroke();
    g.restore();

    // 指北
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '10px sans-serif';
    g.textAlign = 'left';
    g.fillText('北', 4, 12);
  };

  /* ---------------- BOSS血条(总大将) ---------------- */
  U.showBoss = function (name, frac) {
    els.bossBar.style.display = '';
    els.bossName.textContent = name;
    els.bossFill.style.width = (Math.max(0, frac) * 100) + '%';
  };
  U.hideBoss = function () { els.bossBar.style.display = 'none'; };

  /* ---------------- 选将界面 ---------------- */
  U.buildHeroCards = function (onPick) {
    els.heroCards.innerHTML = '';
    DATA.heroes.forEach(function (h, i) {
      var card = document.createElement('div');
      card.className = 'heroCard';
      card.innerHTML =
        '<div class="hcGlyph" style="border-color:#' + h.color.toString(16).padStart(6, '0') + '">' + h.name.charAt(0) + '</div>' +
        '<div class="hcName">' + h.name + '<span class="hcZi">字 ' + h.zi + '</span></div>' +
        '<div class="hcTitle">' + h.title + '</div>' +
        '<div class="hcWeapon">武器：' + h.weapon + '</div>' +
        '<div class="hcStats">' +
        stat('体力', h.hp / 300) + stat('攻击', h.atk / 1.4) + stat('防御', h.def / 1.4) + stat('速度', h.spd / 1.2) +
        '</div>' +
        '<div class="hcDesc">' + h.desc + '</div>';
      card.onmouseenter = function () { SFX.init(); SFX.cursor(); };
      card.onclick = function () { SFX.select(); onPick(h); };
      els.heroCards.appendChild(card);
    });
    function stat(name, frac) {
      var bars = '';
      var n = Math.round(frac * 10);
      for (var i = 0; i < 10; i++) bars += '<i class="' + (i < n ? 'on' : '') + '"></i>';
      return '<div class="hcStat"><em>' + name + '</em>' + bars + '</div>';
    }
  };

  /* ---------------- 剧情介绍 ---------------- */
  U.showIntro = function (onDone) {
    els.introText.innerHTML =
      '<h2>' + DATA.stage.name + '</h2><h3>' + DATA.stage.subtitle + '</h3>' +
      DATA.stage.intro.map(function (l) { return '<p>' + (l || '&nbsp;') + '</p>'; }).join('') +
      '<div class="introHint">按 回车 / 点击 出阵</div>';
    U.show('screenIntro');
    var done = false;
    function go() {
      if (done) return; done = true;
      U.hide('screenIntro');
      document.removeEventListener('keydown', onKey);
      onDone();
    }
    function onKey(e) { if (e.key === 'Enter' || e.key === ' ') go(); }
    document.addEventListener('keydown', onKey);
    els.screenIntro.onclick = go;
  };

  /* ---------------- 结算 ---------------- */
  U.showResult = function (win, p, game) {
    var score = p.kills + p.officerKills * 50 + Math.floor(game.timeLeft / 10) + game.basesTaken * 30;
    var rank = DATA.text.ranks.find(function (r) { return score >= r.min; });
    els.resultTitle.textContent = win ? DATA.text.victory : DATA.text.defeat;
    els.resultTitle.className = win ? 'win' : 'lose';
    els.resultSub.textContent = win ? DATA.text.victorySub : DATA.text.defeatSub;
    var used = game.stage.timeLimit - game.timeLeft;
    var mm = Math.floor(used / 60), ss = Math.floor(used % 60);
    els.resultStats.innerHTML =
      row('击破数', p.kills + ' 人') +
      row('讨取敌将', p.officerKills + ' 名') +
      row('最大连击', p.maxCombo + ' Hits') +
      row('占领据点', game.basesTaken + ' 处') +
      row('所用时间', mm + '分' + ss + '秒') +
      (win ? row('战功评价', '<span class="rankTxt">' + rank.rank + '</span>') +
        '<div class="rankComment">' + rank.comment + '</div>' : '') +
      '<div class="introHint">按 回车 / 点击 返回标题</div>';
    U.show('screenResult');
    function row(k, v) { return '<div class="rRow"><span>' + k + '</span><b>' + v + '</b></div>'; }
  };

  /* ---------------- 暂停 ---------------- */
  U.showPause = function (game) {
    var html = '<h3>─ 作战目标 ─</h3><p class="pObj">' + game.objective + '</p><h3>─ 战况 ─</h3><div class="pOfficers">';
    game.officers.forEach(function (o) {
      html += '<span class="' + (o.side === 1 ? 'pAlly' : 'pEnemy') + (o.dead ? ' pDead' : '') + '">' + o.name + '</span>';
    });
    html += '</div><h3>─ 操作 ─</h3>' +
      '<p class="pCtrl">WASD 移动 ｜ J 普通攻击 ｜ K 蓄力攻击 ｜ L 无双乱舞<br>' +
      '空格 跳跃 ｜ Shift/U 防御 ｜ R 上马/下马 ｜ Q/E 旋转视角<br>' +
      'M 音乐开关 ｜ Esc 继续游戏</p>';
    els.pauseInfo.innerHTML = html;
    U.show('screenPause');
  };

  return U;
})();
