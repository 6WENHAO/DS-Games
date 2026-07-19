// ============ 前期流程任务链 ============
const Missions = (() => {
  let current = 0;
  const counters = {};

  const chain = [
    {
      id: 'awaken',
      title: '苏醒',
      desc: () => '你在陌生星球上苏醒。<br>检测到坠毁的星舰信号 —— 前往标记位置。',
      check: () => {
        const d = Player.pos.distanceTo(Ship.state.pos);
        return d < 14;
      },
      onStart() {
        UI.addMarker('ship', '坠毁的星舰', '▲', 'amber');
      },
      onDone() {
        UI.notify('发现坠毁的星舰', '船体严重受损 · 需要修复后才能起飞');
      },
    },
    {
      id: 'carbon',
      title: '基础采集 · 碳',
      desc: () => `采矿光束需要燃料。使用<b style="color:#ffcf7a">采矿光束(左键)</b>开采树木。<br>收集 碳 <span class="${Items.count('carbon') >= 20 ? 'done' : ''}">${Math.min(Items.count('carbon'), 20)}/20</span>`,
      check: () => Items.count('carbon') >= 20,
      onDone() { UI.notify('已收集足够的碳', '碳可为采矿光束与生命维持充能'); },
    },
    {
      id: 'ferrite',
      title: '基础采集 · 铁尘',
      desc: () => `星舰装甲需要金属修复。开采岩石与地表获取铁尘。<br>收集 铁尘 <span class="${Items.count('ferrite') >= 40 ? 'done' : ''}">${Math.min(Items.count('ferrite'), 40)}/40</span>`,
      check: () => Items.count('ferrite') >= 40,
      onDone() { UI.notify('已收集足够的铁尘', '打开物品栏(Tab)可合成 金属镀层'); },
    },
    {
      id: 'plate',
      title: '锻造 · 金属镀层',
      desc: () => `打开<b style="color:#ffcf7a">物品栏(Tab)</b>，在便携合成中制造 金属镀层。<br>金属镀层 <span class="${Items.count('metalplate') >= 1 || craftedSet.has('metalplate') ? 'done' : ''}">${craftedSet.has('metalplate') ? 1 : Items.count('metalplate')}/1</span>`,
      check: () => Items.count('metalplate') >= 1 || craftedSet.has('metalplate'),
      onDone() { UI.notify('金属镀层锻造完成', '还需要二氢凝胶为推进器供能'); },
    },
    {
      id: 'dihydrogen',
      title: '采集 · 二氢晶体',
      desc: () => `寻找地表发光的<b style="color:#4fa8e8">蓝色晶体</b>并开采。<br>收集 二氢 <span class="${Items.count('dihydrogen') >= 40 ? 'done' : ''}">${Math.min(Items.count('dihydrogen'), 40)}/40</span><br><span style="opacity:.6">提示: 晶体在开阔地表随机分布</span>`,
      check: () => Items.count('dihydrogen') >= 40,
      onDone() { UI.notify('二氢收集完毕', '在物品栏合成 二氢凝胶'); },
    },
    {
      id: 'gel',
      title: '合成 · 二氢凝胶',
      desc: () => `在物品栏(Tab)中合成 二氢凝胶。<br>二氢凝胶 <span class="${Items.count('dihygel') >= 1 || craftedSet.has('dihygel') ? 'done' : ''}">${craftedSet.has('dihygel') ? 1 : Items.count('dihygel')}/1</span>`,
      check: () => Items.count('dihygel') >= 1 || craftedSet.has('dihygel'),
      onDone() { UI.notify('二氢凝胶合成完毕', '前往星舰修复 起飞推进器'); },
    },
    {
      id: 'thruster',
      title: '修复 · 起飞推进器',
      desc: () => `携带材料返回星舰，按 <b style="color:#ffcf7a">E</b> 打开修复面板。<br>起飞推进器 ${Ship.repairs[0].fixed ? '<span class="done">✔ 已修复</span>' : '⚠ 损坏'}`,
      check: () => Ship.repairs[0].fixed,
      onStart() { UI.addMarker('ship', '坠毁的星舰', '▲', 'amber'); },
      onDone() { UI.notify('起飞推进器已修复', '脉冲引擎仍需修理'); },
    },
    {
      id: 'pulse',
      title: '修复 · 脉冲引擎',
      desc: () => {
        const needNano = !Ship.repairs[1].fixed;
        return `脉冲引擎需要 碳纳米管(碳×50) 与 金属镀层(铁尘×30)。<br>脉冲引擎 ${Ship.repairs[1].fixed ? '<span class="done">✔ 已修复</span>' : '⚠ 损坏'}<br><span style="opacity:.6">碳 ${Items.count('carbon')} · 铁尘 ${Items.count('ferrite')}</span>`;
      },
      check: () => Ship.repairs[1].fixed,
      onDone() { UI.notify('星舰系统全部在线', 'ALL SYSTEMS ONLINE · 可以起飞了'); },
    },
    {
      id: 'launch',
      title: '起飞',
      desc: () => `登上星舰(按 E)，飞出这颗星球。<br><span style="opacity:.6">起飞后按住 W 加速 · 拉高机头冲出大气层</span>`,
      check: () => Game.state === 'space',
      onDone() { UI.notify('抵达行星轨道', '欢迎来到深空 · 方块旅者'); },
    },
    {
      id: 'travel',
      title: '星际旅行',
      desc: () => `使用<b style="color:#b08aff">脉冲引擎(Shift)</b>前往另一颗星球。<br>靠近星球后按 <b style="color:#ffcf7a">E</b> 进入大气层。<br><span style="opacity:.6">已探索星球: ${visitedCount()}/2</span>`,
      check: () => visitedCount() >= 2,
      onDone() { UI.notify('任务链完成', '这个体素宇宙已向你敞开'); },
    },
    {
      id: 'free',
      title: '自由探索',
      desc: () => `宇宙无边无际。收集资源、探索星球、纵横星海。<br><span style="opacity:.6">已探索星球: ${visitedCount()}/4</span>`,
      check: () => false,
    },
  ];

  const craftedSet = new Set();
  const visited = new Set([0]);
  function visitedCount() { return visited.size; }

  function start(creative = false) {
    current = creative ? chain.length - 1 : 0;
    craftedSet.clear();
    visited.clear(); visited.add(0);
    chain.forEach(m => { if (m.onStart) m._started = false; });
    if (creative) chain[current]._started = true;
    activate();
  }

  function activate() {
    const m = chain[current];
    if (m.onStart && !m._started) { m._started = true; m.onStart(); }
    refresh();
  }

  function refresh() {
    const m = chain[current];
    UI.setMission(`${String(current + 1).padStart(2, '0')} · ${m.title}`, m.desc());
  }

  let checkTimer = 0;
  function update(dt) {
    checkTimer -= dt;
    if (checkTimer > 0) return;
    checkTimer = 0.4;
    const m = chain[current];
    refresh();
    if (m.check()) {
      if (m.onDone) m.onDone();
      Sfx.missionDone();
      if (current < chain.length - 1) {
        current++;
        setTimeout(activate, 600);
      }
    }
  }

  function onCollect(id) { refresh(); }
  function onCraft(id) { craftedSet.add(id); refresh(); }
  function onVisitPlanet(idx) { visited.add(idx); refresh(); }

  return { start, update, onCollect, onCraft, onVisitPlanet, get current() { return chain[current]; }, get index() { return current; } };
})();
