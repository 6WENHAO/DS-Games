// Mission chain — a 1:1-in-spirit recreation of the No Man's Sky opening ("Awakenings"),
// fused with Minecraft's first-day loop (gather, craft, build, survive the night).
import { ITEMS } from '../data/items.js';
import { BID } from '../world/blocks.js';

export const STAGES = [
  {
    id: 'awaken',
    title: '苏醒 · AWAKENINGS',
    obj: '环顾这颗陌生的星球',
    hint: '移动鼠标环视四周，WASD 移动',
    narration: [
      '你的护目镜重新亮起…外骨骼系统正在重启。',
      '这里不是你出发的地方。你的飞船坠毁在不远处。',
      '生命维持系统正在流失 —— 先活下去。',
    ],
    check(g) { return { prog: Math.min(1, g.stageTime / 12), done: g.stageTime > 12 }; },
    reward: {},
  },
  {
    id: 'oxygen',
    title: '生命维持 · LIFE SUPPORT',
    obj: '采集氧 (红色植物) 并为生命维持系统充能',
    hint: '瞄准红色的含氧植物，按住左键用采矿光束采集；然后按 R 充能',
    check(g) {
      const has = g.inventory.count('OXYGEN');
      const charged = g.flags.rechargedLife;
      return { prog: charged ? 1 : Math.min(0.75, has / 20 * 0.75), done: !!charged, label: '氧 ' + Math.min(has, 20) + '/20' };
    },
    reward: { units: 150 },
  },
  {
    id: 'ferrite',
    title: '修复多功能工具 · REPAIR MULTI-TOOL',
    obj: '采集铁质粉尘并修复扫描仪与分析镜',
    hint: '敲碎地表的岩石与矿床可获得铁质粉尘；在背包 (Tab) 中修复受损部件',
    check(g) {
      const done = g.player.tool.scanner && g.player.tool.visor;
      const fe = g.inventory.count('FERRITE_DUST');
      const c = g.inventory.count('CARBON');
      return { prog: done ? 1 : Math.min(0.8, (Math.min(fe, 30) / 30) * 0.5 + (Math.min(c, 25) / 25) * 0.3), done, label: '铁 ' + Math.min(fe, 30) + '/30 · 碳 ' + Math.min(c, 25) + '/25' };
    },
    reward: { units: 250, nanites: 10 },
  },
  {
    id: 'scan',
    title: '分析这个世界 · SURVEY',
    obj: '使用分析镜 (V) 分析 3 个物种或矿物',
    hint: '按 V 打开分析镜，瞄准生物 / 植物 / 矿床，按住左键分析。按 C 发送扫描脉冲寻找资源',
    check(g) {
      const n = g.discoveries.length;
      return { prog: Math.min(1, n / 3), done: n >= 3, label: '已分析 ' + Math.min(n, 3) + '/3' };
    },
    reward: { units: 400, nanites: 15 },
  },
  {
    id: 'plating',
    title: '修复飞船 · REPAIR STARSHIP',
    obj: '制作金属板 (50 铁质粉尘) 并修复起飞推进器与脉冲引擎',
    hint: '按 Q 打开制作菜单制造金属板；走到飞船旁按 F 进入座舱，在维修界面安装部件',
    check(g) {
      const done = g.ship.systems.launch && g.ship.systems.pulse;
      const mp = g.inventory.count('METAL_PLATING');
      return { prog: done ? 1 : Math.min(0.85, mp / 2 * 0.85), done, label: '金属板 ' + mp + '/2' };
    },
    reward: { units: 600, nanites: 20 },
  },
  {
    id: 'fuel',
    title: '起飞燃料 · LAUNCH FUEL',
    obj: '采集二氢晶体，合成二氢凝胶并为起飞推进器加注燃料',
    hint: '蓝色发光的晶体就是二氢。40 单位可合成 1 个二氢凝胶 (Q 制作菜单)',
    check(g) {
      const done = g.ship.launchFuel >= 0.5;
      const dh = g.inventory.count('DIHYDROGEN');
      const jelly = g.inventory.count('DIHYDROGEN_JELLY');
      return { prog: done ? 1 : Math.min(0.9, (Math.min(dh, 40) / 40) * 0.5 + Math.min(jelly, 1) * 0.4), done, label: '二氢 ' + Math.min(dh, 40) + '/40' };
    },
    reward: { units: 400 },
  },
  {
    id: 'takeoff',
    title: '第一次飞行 · FIRST FLIGHT',
    obj: '进入飞船 (F) 并起飞 (按住空格)',
    hint: '起飞后用鼠标控制机头，W 加速，Shift 加力',
    check(g) { return { prog: g.flags.tookOff ? 1 : 0, done: !!g.flags.tookOff }; },
    reward: { units: 500 },
  },
  {
    id: 'orbit',
    title: '离开大气层 · ESCAPE VELOCITY',
    obj: '爬升到大气层边缘，按住空格脱离星球引力',
    hint: '把机头拉高，飞到 240m 以上时会出现脱离提示',
    check(g) { return { prog: g.flags.inSpace ? 1 : 0, done: !!g.flags.inSpace }; },
    reward: { units: 800, nanites: 25 },
  },
  {
    id: 'station',
    title: '空间站 · SPACE STATION',
    obj: '在系统内找到空间站并降落，出售一些资源',
    hint: '空间站在星系地图上以 ◫ 标记。接近后按住空格进入。脉冲引擎 (按住 Tab) 可快速穿越太空',
    check(g) {
      const sold = g.flags.soldSomething;
      return { prog: g.flags.dockedStation ? (sold ? 1 : 0.6) : 0, done: !!sold };
    },
    reward: { units: 1000 },
  },
  {
    id: 'base',
    title: '建立据点 · A PLACE TO CALL HOME',
    obj: '在任意星球放置基地计算机，并用方块搭建一个避难所 (放置 20 个方块)',
    hint: 'Q 制作基地计算机，B 打开建造菜单。夜晚很危险，屋顶能挡住高温与严寒',
    check(g) {
      const placed = g.flags.blocksPlaced || 0;
      const comp = g.flags.baseComputer ? 0.4 : 0;
      return { prog: Math.min(1, comp + Math.min(placed, 20) / 20 * 0.6), done: !!g.flags.baseComputer && placed >= 20, label: '方块 ' + Math.min(placed, 20) + '/20' };
    },
    reward: { units: 1500, nanites: 40 },
  },
  {
    id: 'warp',
    title: '跃迁 · HYPERDRIVE',
    obj: '修复超光速引擎，合成跃迁元件并跃迁到下一个星系',
    hint: '反物质 = 25 浓缩碳 + 20 彩色金属；容器 = 1 金属板 + 30 氧；两者合成跃迁元件。彩色金属由铜精炼而来',
    check(g) {
      const done = g.flags.warped;
      const wc = g.inventory.count('WARP_CELL');
      return { prog: done ? 1 : Math.min(0.8, (g.ship.systems.hyper ? 0.4 : 0) + Math.min(wc, 1) * 0.4), done: !!done };
    },
    reward: { units: 5000, nanites: 100 },
  },
  {
    id: 'free',
    title: '无尽的方块深空 · NO BLOCK\'S SKY',
    obj: '宇宙是你的了：探索、扫描、建造、跃迁',
    hint: '每个星系都是程序生成的。J 查看发现日志，M 打开星系地图',
    check() { return { prog: 0, done: false }; },
    reward: {},
  },
];

export class Quests {
  constructor(game) {
    this.game = game;
    this.index = 0;
    this.stageTime = 0;
    this.narrationIndex = 0;
    this.narrationTimer = 2.5;
    this.completedIds = [];
  }

  get current() { return STAGES[Math.min(this.index, STAGES.length - 1)]; }

  update(dt) {
    const g = this.game;
    this.stageTime += dt;
    g.stageTime = this.stageTime;
    const stage = this.current;
    if (!stage) return;

    // narration lines
    if (stage.narration && this.narrationIndex < stage.narration.length) {
      this.narrationTimer -= dt;
      if (this.narrationTimer <= 0) {
        g.ui.subtitle(stage.narration[this.narrationIndex], 5200);
        this.narrationIndex++;
        this.narrationTimer = 6;
      }
    }

    const st = stage.check(g);
    g.ui.setMission({
      title: stage.title,
      obj: st.label ? stage.obj + '  ·  ' + st.label : stage.obj,
      prog: st.prog,
    });
    if (st.done) this.complete();
  }

  complete() {
    const g = this.game;
    const stage = this.current;
    if (!stage || this.completedIds.includes(stage.id)) return;
    this.completedIds.push(stage.id);
    const r = stage.reward || {};
    if (r.units) g.addUnits(r.units);
    if (r.nanites) g.addNanites(r.nanites);
    g.audio.questComplete();
    g.ui.toast({ kind: 'quest', name: '任务完成: ' + stage.title.split(' · ')[0], amt: r.units ? '+' + r.units + ' ◈' : '', dur: 4200 });
    g.ui.cinematic({ main: '任务完成', sub: stage.title, dur: 2600 });
    this.index = Math.min(this.index + 1, STAGES.length - 1);
    this.stageTime = 0;
    this.narrationIndex = 0;
    this.narrationTimer = 2.2;
    const next = this.current;
    if (next) {
      setTimeout(() => {
        g.ui.toast({ kind: 'info', name: '新任务: ' + next.title.split(' · ')[0], amt: '', dur: 4000 });
        g.ui.subtitle(next.hint, 7000);
      }, 2800);
    }
  }

  serialize() { return { index: this.index, completedIds: this.completedIds }; }
  load(d) {
    if (!d) return;
    this.index = d.index || 0;
    this.completedIds = d.completedIds || [];
    this.stageTime = 0;
    this.narrationIndex = 99;
  }
}
