/* =========================================================
   quests.js — 生存模式任务链与 NPC 对话（原创剧本）
   ========================================================= */
const Quests = (() => {

  /* ---------- 对话脚本 ---------- */
  const DIALOGS = {
    elder_intro: [
      '醒了？昨晚篝火边你睡得像块石头。',
      '今天是个大日子——你的飞船就停在发射台上，只差天文台的发射密码了。',
      '不过按传统，新的宇航员得先证明自己会干活。去砍几棵树，做一把木镐来看看。',
      '打开物品栏(Tab)就能合成。工作台就在篝火旁边。',
    ],
    elder_after_pick: [
      '手艺不错。工具是拓荒者的第二双手。',
      '去博物馆找管理员蕨领装备吧，宇航服、信号镜、翻译器——出门探险缺一不可。',
      '博物馆就是村里那座木屋。',
    ],
    elder_idle: ['风暴星的浪、燧沙星的沙、碎空星的裂缝……外面的世界大得很。', '篝火会一直为你烧着。'],
    curator_intro: [
      '欢迎来到博物馆！虽然只有两个箱子，但都是好东西。',
      '装备箱里是宇航服和信号镜——宇航服自带喷气背包和氧气罐。',
      '还有一台古族翻译器。古族在几十万年前就消失了，但他们的石板到处都是。',
      '都拿上吧！然后去天文台找霍恩，她有你的发射密码。',
    ],
    curator_idle: ['古族一直在追寻一个叫「深空之眼」的信号，可惜他们没等到答案。', '说不定答案会由你找到呢。'],
    astronomer_intro: [
      '来了？望远镜刚对准太阳……情况不太妙。',
      '太阳在膨胀。按我的计算，二十二分钟后它会变成超新星。',
      '别慌——古族在各个星球留下了记录，他们似乎早就预见了这一切，还造了某种「循环装置」。',
      '你的发射密码是：↑↑↓↓←→ 。好了，正式成为宇航员吧！',
      '驾驶飞船去调查古族石板。记住：就算世界毁灭，「知识」也会留在你的飞船日志里。',
    ],
    astronomer_idle: ['信号镜(Q)能找到古族信标的方向。', '三块石板，三段坐标。找齐它们，深空之眼就会出现在星图上。'],
  };

  /* ---------- 任务链 ---------- */
  // 每个任务: id, 标题, 目标行(函数返回 [{text,done}]), 完成条件, 提示
  const CHAIN = [
    {
      id: 'wake', title: '① 篝火旁醒来',
      goals: g => [{ text: '与长者·灰木对话', done: g.flags.talkedElder }],
      done: g => g.flags.talkedElder,
    },
    {
      id: 'tools', title: '② 拓荒者的手艺',
      goals: g => [
        { text: `砍伐原木 ${Math.min(UI.count('log') + g.flags.logsUsed, 3)}/3`, done: UI.count('log') + g.flags.logsUsed >= 3 },
        { text: '合成木板与木棍', done: g.flags.craftedPlanks },
        { text: '合成木镐', done: g.flags.craftedPick },
      ],
      done: g => g.flags.craftedPick,
      hintText: '对准树干按住左键砍树，Tab 打开合成界面',
    },
    {
      id: 'report', title: '③ 向长者复命',
      goals: g => [{ text: '再次与长者·灰木对话', done: g.flags.elderApproved }],
      done: g => g.flags.elderApproved,
    },
    {
      id: 'gear', title: '④ 领取探险装备',
      goals: g => [
        { text: '与博物馆管理员蕨对话', done: g.flags.talkedCurator },
        { text: '打开装备箱（宇航服/信号镜/翻译器）', done: g.flags.gotGear },
      ],
      done: g => g.flags.gotGear,
      hintText: '博物馆是村里的木屋，箱子按 E 打开',
    },
    {
      id: 'codes', title: '⑤ 发射密码',
      goals: g => [{ text: '登上天文台，与霍恩对话', done: g.flags.gotCodes }],
      done: g => g.flags.gotCodes,
      hintText: '沿着石头坡道爬上高塔，也可以自己搭方块上去',
    },
    {
      id: 'launch', title: '⑥ 升空！',
      goals: g => [{ text: '走到发射台旁按 E 登船，起飞', done: g.flags.launched }],
      done: g => g.flags.launched,
      hintText: '飞船在村庄旁的黄黑色发射台上',
    },
    {
      id: 'explore', title: '⑦ 追寻古族信标',
      goals: g => [
        { text: '燧沙星：挖开沙层，进入穹顶读取石板', done: g.knowledge.has('alpha') },
        { text: '碎空星：深入晶洞读取石板', done: g.knowledge.has('beta') },
        { text: '风暴星：登上古塔读取石板', done: g.knowledge.has('gamma') },
      ],
      done: g => g.knowledge.has('alpha') && g.knowledge.has('beta') && g.knowledge.has('gamma'),
      hintText: '着陆后用信号镜(Q)寻找古族信标，对石板按 E 使用翻译器',
    },
    {
      id: 'eye', title: '⑧ 深空之眼',
      goals: g => [{ text: '飞向星图上的新信号，见证结局', done: false }],
      done: () => false,
      hintText: '深空之眼已出现在太空中——它在很远的轨道上',
    },
  ];

  let chainIndex = 0;

  function currentQuest(g) {
    while (chainIndex < CHAIN.length - 1 && CHAIN[chainIndex].done(g)) chainIndex++;
    return CHAIN[chainIndex];
  }
  function render(g) {
    if (g.creative) { UI.setQuest('创造模式', '自由建造 · 双击空格飞行 · E 与世界互动'); return; }
    const q = currentQuest(g);
    let h = '';
    for (const goal of q.goals(g)) {
      h += `<div class="${goal.done ? 'done' : ''}">${goal.done ? '✔' : '◻'} ${goal.text}</div>`;
    }
    if (q.hintText) h += `<div style="color:#8a8fb0;margin-top:4px;font-size:12px">💡 ${q.hintText}</div>`;
    UI.setQuest(q.title, h);
  }
  function completeStep() { Audio2.SFX.quest(); }
  function reset() { chainIndex = 0; }
  function skipToExplore() { chainIndex = 6; } // 循环重生后：已有密码直接探索

  return { DIALOGS, CHAIN, render, currentQuest, completeStep, reset, skipToExplore, get chainIndex() { return chainIndex; }, set chainIndex(v) { chainIndex = v; } };
})();
