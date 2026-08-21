/* =========================================================================
 * GREENFALL · quests.js —— 主线 / 支线 / 笔记（世界叙事）
 * ======================================================================= */
(function (GF) {
  'use strict';

  /* ------------------------------------------------------ 手写笔记 */
  const NOTES = {
    1: { title: '营地留言', text: '如果你醒了 —— 我们往北去了苔痕镇。\n\n三件事，记牢：\n一、别徒手碰木头和石头，你会先弄断自己的手。\n二、营地南边有片碎石滩，砂砾里能敲出燧石。燧石 + 木棍 + 搓好的草绳 = 斧子。有了斧子才有一切。\n三、水一定要煮。空罐头架在火上就行。\n\n——J' },
    2: { title: '第一条规则', text: '第一条规则：天黑之前找到屋顶。\n第二条规则：篝火能救命，也能招来它们。想活久一点，就在墙里点火。\n第三条规则：安静地走路，比跑得快更重要。' },
    3: { title: '物理实验室便条', text: '我把发射机的电子管拆下来藏在工具箱里。四件东西缺一不可：电子管、调谐主板、定向天线、稳压模块。\n塔在东北，很远。别一个人去。' },
    4: { title: '教堂长椅上的信', text: '第十四天。绿色的东西从排水沟里长出来，两天就爬上了三楼。\n它不是植物。它在呼吸。\n如果你读到这个 —— 别去研究站。' },
    5: { title: '被水泡烂的日记', text: '水位每天涨两厘米。屋顶上还有六个人，粮食还有两天。\n我们把名字刻在烟囱上了。' },
    6: { title: '高架上的喷漆', text: '往西不通！桥断了！\n往南有检查站，士兵早就走了，弹药箱还在。\n往北是采石场，能挖到铁。' },
    7: { title: '瞭望塔记录', text: '连续十一天没有看到活人。\n倒是看见一群鹿，往西河去了。\n它们还知道哪里的水是干净的。' },
    8: { title: '交接班记录', text: '库存：罐头 12，净水 8，抗生素 2。\n注意：任何被咬伤的人必须立刻上报。不要隐瞒。上一个隐瞒的人让我们损失了六个。' },
    9: { title: 'GV-2 实验记录 #7', text: '孢子体在 34℃ 以上活性骤降，低温则近乎休眠。\n宿主的中枢神经在感染 72 小时后被完全接管，此前有效窗口约 40 小时。\n血清能压制，但不能清除。' },
    10: { title: '巢穴边缘的字条', text: '我进去过。中央有一个……我不知道该叫它什么。\n它在往地下长。\n如果要烧，得从根上烧。' },
    11: { title: '观测站日志', text: '昨夜西南方有火光，持续了四十分钟，规律地明灭三短三长。\n有人还在发信号。\n如果我的电台还能用……' },
    12: { title: 'D-9 值班表', text: '第二区封闭，权限：黄。\n第三区（深层）通风失效，禁止进入。\n提醒：疫苗原型只有一支，除非确认接触，不要使用。' },
    13: { title: '手写的处方', text: '如果你找到了疫苗原型：不要空腹注射。\n需要血清 ×2、低温样本、以及一份研究笔记 —— 化学台上能合成第二支。\n祝你好运，随便哪个还活着的人。' },
    14: { title: '塔下的最后一页', text: '天线接好了，但稳压模块烧了。我去风电场找一个。\n如果我没回来 —— 把四件东西都装上，打开电台，按下发送。\n有人会听见的。一定会。' },
  };

  /* ---------------------------------------------------------- 任务 */
  // check(ctx) -> {done:boolean, cur:number, max:number}
  const DEFS = [
    {
      id: 'wake', name: '睁开眼', main: true,
      desc: '做一把石斧（燧石 ×3、木棍 ×2、纤维绳 ×2），并喝一次干净的水。',
      hint: '徒手只能采集草、藤、浆果和松散杂物。砂砾里能敲出燧石。',
      check(c) {
        const a = c.flags.craftedAxe ? 1 : 0, b = c.flags.drankClean ? 1 : 0;
        return { cur: a + b, max: 2, done: a + b >= 2 };
      },
    },
    {
      id: 'firstnight', name: '第一夜', main: true, needs: 'wake',
      desc: '搭一堆篝火，并撑过第一个夜晚。',
      hint: '篝火：树枝 ×4、碎石 ×4、落叶 ×2。火光会吸引游荡者，尽量放在墙内。',
      check(c) {
        const a = c.flags.litFire ? 1 : 0, b = c.world.day >= 2 ? 1 : 0;
        return { cur: a + b, max: 2, done: a + b >= 2 };
      },
    },
    {
      id: 'toolage', name: '工具时代', main: true, needs: 'firstnight',
      desc: '造出工作台与石镐，让你能挖开石头。',
      check(c) {
        const a = c.flags.builtBench ? 1 : 0;
        const b = c.inv.count('pick_stone') + c.inv.count('pick_iron') + c.inv.count('pick_steel') > 0 ? 1 : 0;
        return { cur: a + b, max: 2, done: a + b >= 2 };
      },
    },
    {
      id: 'ironfire', name: '铁与火', main: true, needs: 'toolage',
      desc: '建起锻炉并炼出第一块铁锭。',
      hint: '锻炉需要红砖 ×16 —— 先用土窑把黏土烧成砖。',
      check(c) {
        const a = c.flags.builtForge ? 1 : 0;
        const b = c.flags.gotIron ? 1 : 0;
        return { cur: a + b, max: 2, done: a + b >= 2 };
      },
    },
    {
      id: 'shelter', name: '一个家', main: false,
      desc: '放下一张床，把它变成你的重生点。',
      check(c) { return { cur: c.flags.bedSet ? 1 : 0, max: 1, done: !!c.flags.bedSet }; },
    },
    {
      id: 'farmer', name: '重新种地', main: false,
      desc: '耕地、播种，并收获 8 份作物。',
      hint: '用铲子把草地变成耕地，旁边有水会长得更快。',
      check(c) { return { cur: Math.min(8, c.flags.harvested || 0), max: 8, done: (c.flags.harvested || 0) >= 8 }; },
    },
    {
      id: 'explorer', name: '绘制这片土地', main: false,
      desc: '发现 8 处地标。',
      check(c) { return { cur: Math.min(8, c.discovered.size), max: 8, done: c.discovered.size >= 8 }; },
    },
    {
      id: 'archivist', name: '拼凑真相', main: true, needs: 'ironfire',
      desc: '收集 5 张手写笔记。',
      check(c) { return { cur: Math.min(5, c.notes.size), max: 5, done: c.notes.size >= 5 }; },
    },
    {
      id: 'keys', name: '权限', main: true, needs: 'archivist',
      desc: '拿到任意一张钥匙卡。',
      hint: '蓝卡在民用与办公区域，红卡在医院院长室的保险柜，黄卡在军事哨所军械库。',
      check(c) {
        const n = ['keycard_blue', 'keycard_red', 'keycard_yellow'].filter((k) => c.inv.count(k) > 0 || c.flags['used_' + k]).length;
        return { cur: n, max: 1, done: n >= 1 };
      },
    },
    {
      id: 'parts', name: '四个零件', main: true, needs: 'keys',
      desc: '找到功放电子管、调谐主板、定向天线、稳压模块。',
      hint: '学校物理室、汽车墓场、军事哨所、风电场与大坝机房 —— 每处都有一件。',
      check(c) {
        const ks = ['radio_part_tube', 'radio_part_board', 'radio_part_ant', 'radio_part_gen'];
        const n = ks.filter((k) => c.inv.count(k) > 0 || c.flags['installed_' + k]).length;
        return { cur: n, max: 4, done: n >= 4 };
      },
    },
    {
      id: 'cure', name: '一线希望', main: true, needs: 'archivist',
      desc: '获得试验疫苗（在掩体 D-9 找到，或在化学台合成）。',
      hint: '合成需要：抗孢血清 ×2、低温样本管、研究笔记。',
      check(c) {
        const done = c.inv.count('vaccine_proto') > 0 || c.flags.usedVaccine;
        return { cur: done ? 1 : 0, max: 1, done };
      },
    },
    {
      id: 'signal', name: '把信号发出去', main: true, needs: 'parts',
      desc: '在长风电波塔装好四个零件，并启动无线电台。',
      hint: '电台需要供电：旁边的柴油发电机要加柴油或汽油。',
      check(c) { return { cur: c.flags.signalSent ? 1 : 0, max: 1, done: !!c.flags.signalSent }; },
    },
    {
      id: 'hunter', name: '猎手', main: false,
      desc: '击杀 12 个敌对生物。',
      check(c) { return { cur: Math.min(12, c.flags.kills || 0), max: 12, done: (c.flags.kills || 0) >= 12 }; },
    },
    {
      id: 'smith', name: '钢的时代', main: false,
      desc: '解锁炼钢图纸并锻造一件钢制工具。',
      check(c) {
        const has = ['axe_steel', 'pick_steel', 'sledge', 'crowbar_heavy', 'saw_hack', 'spear_steel'].some((k) => c.inv.count(k) > 0);
        return { cur: has ? 1 : 0, max: 1, done: has };
      },
    },
  ];

  class Quests {
    constructor(ctx) {
      this.ctx = ctx;                  // {inv, world, flags, notes:Set, discovered:Set, unlocks}
      this.state = {};                 // id -> {done, cur, max, seen}
      for (const d of DEFS) this.state[d.id] = { done: false, cur: 0, max: 1, seen: false };
    }
    available(d) { return !d.needs || (this.state[d.needs] && this.state[d.needs].done); }
    evaluate() {
      const changed = [];
      for (const d of DEFS) {
        const st = this.state[d.id];
        if (st.done) continue;
        if (!this.available(d)) continue;
        let r;
        try { r = d.check(this.ctx); } catch (e) { continue; }
        if (!r) continue;
        const prevCur = st.cur;
        st.cur = r.cur; st.max = r.max;
        if (r.done) { st.done = true; changed.push({ d, kind: 'done' }); }
        else if (r.cur > prevCur) changed.push({ d, kind: 'progress' });
        if (!st.seen) { st.seen = true; if (!r.done) changed.push({ d, kind: 'new' }); }
      }
      return changed;
    }
    list() {
      const out = [];
      for (const d of DEFS) {
        if (!this.available(d)) continue;
        out.push({ def: d, st: this.state[d.id] });
      }
      return out;
    }
    activeMain() {
      for (const d of DEFS) {
        if (!d.main) continue;
        if (!this.available(d)) continue;
        if (!this.state[d.id].done) return { def: d, st: this.state[d.id] };
      }
      return null;
    }
    serialize() { return this.state; }
    deserialize(s) { if (s) for (const k of Object.keys(s)) if (this.state[k]) this.state[k] = s[k]; }
  }

  GF.NOTES = NOTES;
  GF.QUEST_DEFS = DEFS;
  GF.Quests = Quests;
})(globalThis.GF = globalThis.GF || {});
