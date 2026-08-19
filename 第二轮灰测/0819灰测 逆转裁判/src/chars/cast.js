/* ============================================================
   cast.js — 角色登记检查与预热
   若某个角色文件缺失，用占位角色兜底，保证游戏仍可运行
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var CAST = AA.CAST = {};

  var NEEDED = [
    ['naruhodo', '成步堂', '成步堂 龙一', 'm', '#33488c'],
    ['mayoi', '真宵', '绫里 真宵', 'f', '#6c4a9c'],
    ['judge', '审判长', '审判长', 'm', '#23252f'],
    ['mitsurugi', '御剑', '御剑 怜侍', 'm', '#8e2f52'],
    ['itonokogiri', '糸锯', '糸锯 圭介', 'm', '#8c7a56'],
    ['kuroiwa', '黑岩', '黑岩 龙三', 'm', '#ded4bc'],
    ['kanon', '花音', '白鸟 花音', 'f', '#efc8cf'],
    ['hibiki', '音无', '音无 响', 'm', '#333644']
  ];

  var POSES = ['normal', 'happy', 'sad', 'angry', 'think', 'shock', 'sweat',
    'surprised', 'surprise', 'confident', 'point', 'slam', 'objection', 'damage',
    'smug', 'laugh', 'panic', 'breakdown', 'salute', 'confused', 'arms', 'nod',
    'gavel', 'cheer', 'worried', 'hopeful', 'cry', 'read', 'smile', 'talk2', 'serious'];

  /* 占位角色（简单的人形，仍然遵守骨架基准） */
  function placeholder(id, label, full, gender, col) {
    var SK = P.skin;
    function draw(pen, s) {
      var CX = 74, hip = 152 + (s.bob || 0), shy = 100 + (s.bob || 0);
      RIG.leg(pen, CX - 13, hip + 2, -2, 2, 36, 30, 20, 14, U.shadow(col, .25), U.shadow(col, .45), '#2a2a30', -1);
      RIG.leg(pen, CX + 13, hip + 2, 2, -2, 36, 30, 20, 14, U.shadow(col, .25), U.shadow(col, .45), '#2a2a30', 1);
      pen.blob([[CX - 30, shy], [CX - 33, shy + 20], [CX - 28, hip + 8], [CX, hip + 12],
      [CX + 28, hip + 8], [CX + 33, shy + 20], [CX + 30, shy], [CX, shy - 7]], col, .92);
      RIG.armTo(pen, CX - 30, shy + 6, CX - 37, shy + 66, 32, 28, 19, 15, 11, col, U.hilite(col, .16), -1, U.shadow(col, .5));
      RIG.armTo(pen, CX + 30, shy + 6, CX + 37, shy + 66, 32, 28, 19, 15, 11, U.shadow(col, .18), null, 1, U.shadow(col, .5));
      pen.taper([[CX, shy - 3], [CX, 84]], 15, 13, SK.lo);
      RIG.head(pen, CX, 62, 24, 25, SK, {});
      pen.blob([[CX - 25, 58], [CX - 22, 38], [CX, 32], [CX + 22, 38], [CX + 25, 58], [CX + 20, 48], [CX, 54], [CX - 20, 48]], '#2b2c36', .85);
      RIG.brow(pen, CX, 54, 20, 4.2, s.brow, '#2b2c36');
      RIG.eyes(pen, CX, 64, 19, 4.6, s.eyes, { pupil: s.pupil });
      RIG.mouth(pen, CX, 78, 11, s.mouth, SK.line, '#93414a');
      if (s.sweat) RIG.sweat(pen, CX + 26, 48, 4.6, s.sweat, 0);
    }
    var poses = {};
    POSES.forEach(function (p) {
      poses[p] = function (f, talk) {
        return RIG.base({
          bob: f % 2 ? 0 : -1,
          eyes: (p === 'shock' || p === 'surprised' || p === 'surprise') ? 'wide' : (p === 'angry' ? 'angry' : (p === 'sad' || p === 'cry' ? 'sad' : 'normal')),
          brow: (p === 'angry' ? 'angry' : (p === 'sad' ? 'sad' : 'normal')),
          mouth: talk ? (f % 2 ? 'open' : 'closed') : (p === 'happy' || p === 'smile' ? 'smile' : (p === 'sad' ? 'frown' : 'closed')),
          sweat: (p === 'sweat' || p === 'panic') ? 2 : 0
        });
      };
    });
    RIG.define(id, {
      label: label, full: full, gender: gender, outline: '#241a16',
      draw: draw, poses: poses, frames: { normal: 2 }, placeholder: true
    });
  }

  CAST.missing = [];
  CAST.ensure = function () {
    CAST.missing = [];
    for (var i = 0; i < NEEDED.length; i++) {
      var n = NEEDED[i];
      if (!RIG.has(n[0])) {
        CAST.missing.push(n[0]);
        placeholder(n[0], n[1], n[2], n[3], n[4]);
      }
    }
    return CAST.missing;
  };

  /** 补齐缺失的姿势（用 normal 兜底），避免剧本里写了角色没有的姿势 */
  CAST.fillPoses = function () {
    var names = RIG.list();
    for (var i = 0; i < names.length; i++) {
      var d = RIG.get(names[i]);
      if (!d.poses.normal) continue;
      var ALIAS = {
        surprised: ['surprise', 'shock'], surprise: ['surprised', 'shock'],
        shock: ['surprised', 'surprise'], happy: ['smile', 'cheer'],
        smile: ['happy'], cheer: ['happy'], hopeful: ['happy'],
        confident: ['smug', 'point', 'normal'], smug: ['confident'],
        objection: ['point', 'slam', 'angry'], slam: ['angry', 'point'],
        point: ['confident'], damage: ['shock', 'sweat'], panic: ['sweat', 'shock'],
        breakdown: ['panic', 'shock'], cry: ['sad'], worried: ['sad'],
        arms: ['normal'], nod: ['normal'], gavel: ['normal'], salute: ['normal'],
        confused: ['think'], think: ['normal'], read: ['normal'],
        laugh: ['happy'], talk2: ['normal'], serious: ['normal'], sweat: ['sad']
      };
      for (var p = 0; p < POSES.length; p++) {
        var name = POSES[p];
        if (d.poses[name]) continue;
        var alt = ALIAS[name] || [];
        var found = null;
        for (var a = 0; a < alt.length; a++) if (d.poses[alt[a]]) { found = alt[a]; break; }
        d.poses[name] = d.poses[found || 'normal'];
        if (!d.frames[name]) d.frames[name] = d.frames[found || 'normal'] || 2;
      }
    }
  };

  /** 后台分批预热精灵，避免首次出场卡顿 */
  CAST.warm = function (list, onDone) {
    var jobs = [];
    (list || RIG.list()).forEach(function (n) {
      var d = RIG.get(n);
      if (!d) return;
      Object.keys(d.poses).forEach(function (p) { jobs.push([n, p]); });
    });
    var i = 0;
    function tick() {
      var t0 = performance.now();
      while (i < jobs.length && performance.now() - t0 < 9) {
        var j = jobs[i++];
        try { RIG.sprite(j[0], j[1], 0, false); } catch (e) { }
      }
      if (i < jobs.length) requestAnimationFrame(tick);
      else if (onDone) onDone(jobs.length);
    }
    requestAnimationFrame(tick);
    return jobs.length;
  };

})(window.AA);
