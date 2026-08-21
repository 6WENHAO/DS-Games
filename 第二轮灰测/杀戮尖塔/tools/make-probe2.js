/* ============================================================
   tools/make-probe2.js —— 专查「主角消失」：抓 dead 类的调用栈
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace('href="css/', 'href="../css/').replace(/src="js\//g, 'src="../js/');

const DRIVER = `
<script>
(function () {
  const REP = { events: [], hp: [] };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  /* 包装 markDead */
  const _markDead = markDead;
  markDead = function (en) {
    const node = EL.entities[en && en.uid];
    const isPlayer = node && node.parentNode && node.parentNode.id === 'player-slot';
    REP.events.push({
      fn: 'markDead', uid: String(en && en.uid), name: (en && en.name) || '?',
      hp: en && en.hp, isPlayer: !!isPlayer,
      stack: (new Error().stack || '').split('\\n').slice(1, 7).join(' | ')
    });
    return _markDead(en);
  };
  /* 包装 updateCombatant */
  const _upd = updateCombatant;
  updateCombatant = function (d, en, opts) {
    const isPlayer = d && d.parentNode && d.parentNode.id === 'player-slot';
    if (isPlayer && (en.hp <= 0 || en.escaped)) {
      REP.events.push({
        fn: 'updateCombatant(dead=true)', uid: String(en.uid), name: en.name,
        hp: en.hp, isPlayer: true, optsPlayer: !!(opts && opts.player),
        stack: (new Error().stack || '').split('\\n').slice(1, 7).join(' | ')
      });
    }
    if (isPlayer && !(opts && opts.player)) {
      REP.events.push({
        fn: '!!! 用敌人数据更新了主角节点', uid: String(en.uid), name: en.name, hp: en.hp,
        stack: (new Error().stack || '').split('\\n').slice(1, 7).join(' | ')
      });
    }
    return _upd(d, en, opts);
  };

  async function run() {
    Game.newRun();
    const node = S.map.grid[0].filter(Boolean)[0];
    Game.enterNode(node);
    for (let i = 0; i < 16; i++) {
      await sleep(100);
      const pn = document.querySelector('#player-slot .combatant');
      REP.hp.push('T+' + ((i + 1) * 100) + ' cls=' + (pn ? pn.className : '无') +
        ' playerHp=' + (CB ? CB.player.hp : '-') + ' uid=' + (CB ? CB.player.uid : '-') +
        ' entKeys=' + Object.keys(EL.entities).join('/') +
        ' enemies=' + (CB ? CB.enemies.map(e => e.uid + ':' + e.name + ':' + e.hp).join(',') : '-'));
    }
    REP.finalCls = (document.querySelector('#player-slot .combatant') || {}).className;
  }

  setTimeout(() => {
    run().catch(e => { REP.error = (e && e.stack) || String(e); }).then(() => {
      const txt = JSON.stringify(REP, null, 1);
      document.documentElement.innerHTML = '<head><meta charset="utf-8"></head><body><pre id="__report">'
        + txt.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></body>';
    });
  }, 250);
})();
</script>
`;

html = html.replace('</body>', DRIVER + '\n</body>');
fs.writeFileSync(path.join(ROOT, 'tools', '_probe2.html'), html, 'utf8');
console.log('已生成 tools/_probe2.html');
