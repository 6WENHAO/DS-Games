// ============================================================================
//  script.js —— 梦核事件脚本 + 全部文本
//  设计原则：场景本身完全正常，只有"不协调"是异样的
//    · 声音有，人没有（聊天声、麻将声、炒菜声、乒乓球声）
//    · 该动的不动（太阳、电子钟、挂历），不该动的自己动（电视、电话）
//    · 空间不守恒（上不完的楼梯、镜子里没有你、走廊尽头的背影）
// ============================================================================

import * as A from './audio.js';
import { setCell } from '../world/compile.js';

// ---------------------------------------------------------------------------
//  地面材质 → 脚步声
// ---------------------------------------------------------------------------
export function surfaceOf(world, x, y) {
  const f = world.floors[Math.floor(y)]?.[Math.floor(x)];
  if (!f) return 'stone';
  if (f === 'f_wood') return 'wood';
  if (f === 'f_carpet') return 'carpet';
  if (f === 'f_tile') return 'tile';
  if (f === 'f_roof') return 'concrete';
  return 'stone';
}

// ---------------------------------------------------------------------------
//  可交互物的文本。字符串数组 = 逐行显示的字幕
//  memory: true 表示这是一段"记忆"，会记进手册
// ---------------------------------------------------------------------------
export const LINES = {
  // ——— 楼道 ———
  gate: ['单元门推不开。', '门上的玻璃是白的，什么也看不见。'],
  meter: ['电表在走。', '走得比你记忆里快一点。'],
  win_stair: ['太阳挂在对面楼的第七层。', '从你进来起，它就没有再往下走过。'],
  win_landing: ['楼下有人在骑车，铃声一直响。', '你低头看，楼下没有人。'],
  door301: ['301。门上贴过春联，只剩胶。', '你听见里面在放新闻。你敲门，新闻停了。'],
  door303: ['303。门缝里透出一点橙色的光。', '门口摆着一双孩子的凉鞋，很小。'],
  door302_locked: ['302。', '这是你家。门锁着。'],
  door302_open: ['钥匙转了两圈。', '门开了。里面有饭菜的味道。'],
  pot_empty: ['一盆半死的绿萝。', '土是干的。'],
  pot_key: ['你抬起花盆。', '底下压着一把钥匙，还是温的。'],
  bike: ['一辆二八大杠，链条上锈成一片。', '后座上还夹着一张卷了边的报纸。'],

  // ——— 家 ———
  tv_on: ['你按下按钮。', '屏幕全是雪花。可你分明听见有人在念新闻，', '说着新世纪的第一天。'],
  tv_off: ['你把电视关了。', '雪花的声音停了半秒，又回来了。'],
  calendar: ['2000年1月1日。', '红头的那一页一直没有翻过去。', '妈说这是单位发的，够用一整年。'],
  picture: ['一幅十字绣的牡丹，绣了两年。', '框子是红木的，边角磕掉了一块漆。'],
  cabinet: ['黄柜子的门一开，樟脑丸的味道就出来了。', '里面叠着毛巾、旧毛衣，', '和一沓没拆过的红包。'],
  glasscab: ['玻璃柜里摆着从没用过的高脚杯，', '和一张1999年的三好学生奖状。'],
  mirror: ['镜子里的房间和这间一模一样。', '暖黄的灯，原木的柜子，', '——只是没有你。'],
  mahjong: ['牌摊了一半。', '四把椅子都是空的。', '可你分明听见有人在笑。'],
  stove: ['锅底是凉的。', '抽油烟机在响，油还在锅里炸。', '你伸手，什么也没有。'],
  phone: ['你拿起听筒。', '里面是你自己的声音，', '在很远的地方，喊一个名字。'],
  balcony: ['夕阳把整个阳台泡成蜂蜜色。', '晾着的白衬衫在动，可没有风。'],
  fishtank: ['鱼缸的灯亮着，水是干净的。', '一条鱼也没有。'],
  homedoor_locked: ['你还没准备好走。', '（还差 {n} 段记忆）'],
  homedoor_open: ['你拉开门。', '门外不是楼道。', '门外是一片很大的、很亮的地方。'],

  // ——— 大堂 ———
  banner: ['「热烈庆祝新千年」。', '金粉掉了一半，字还在。'],
  curtainwall: ['蓝绿色的玻璃幕墙。', '那时候人们觉得，这就是未来。', '玻璃外面的黄昏，从你进来起就没变过。'],
  clock: ['2000-01-01  00:00:00', '秒数不动。'],
  dougong: ['大理石柱子上架着一排斗拱，朱红，描金。', '新的。谁也不知道它托着什么。'],
  carpet: ['红地毯从大门一直铺到电梯口。', '很干净。一个脚印也没有——', '包括你刚踩的那些。'],
  darkcorner: ['这一片的灯灭了。', '灯管还在，只是不亮。'],
  elevator: ['电梯自己开了。', '里面没有人，也没有按钮。'],

  // ——— 尖塔 ———
  tower_win: ['窗很窄，只有一掌宽。', '外面是整座城市。每一栋楼顶上都有一根天线。'],
  core_closed: ['塔的中间是实心的。', '你贴上去听，里面有很轻的电流声。'],
  core_open: ['墙上多了一个门洞。', '你不记得刚才有。'],
  lasttv: ['电视里在放你刚刚走过的路。', '楼道、家、大堂、塔。', '都是空的。'],

  // ——— 天台 ———
  parapet: ['整个小区在你脚下亮起来了。', '一万台电视同时在响，有人在炒菜，', '有人在打麻将，有人在喊孩子回家吃饭。'],
  tower_far: ['水塔生了锈，铁梯还在。', '小时候你以为爬上去就能看到海。'],
  laundryline: ['三件衣服在晾衣绳上晃。', '一件白衬衫，一条蓝裤子，', '还有一件很小的，是你的。'],
  endstool: ['一把红色的塑料凳，正对着落日。', '像是有人一直坐在这里等你。'],
};

export const MEMORY_IDS = [
  'calendar', 'cabinet', 'mirror', 'mahjong', 'stove', 'phone', 'balcony', 'fishtank', 'picture', 'glasscab',
];
export const MEMORY_NEEDED = 5;

// ---------------------------------------------------------------------------
//  开场 / 转场 / 结局文本
// ---------------------------------------------------------------------------
export const OPENING = [
  '你站在单元门里。',
  '灯是灭的。',
  '往前走两步，它会亮。',
];

export const ZONE_INTRO = {
  stair: [],
  home: ['302。', '你在这里住到十二岁。'],
  lobby: ['世纪大厦。', '2000年落成，全市最高。', '你只在开业那天进来过一次。'],
  tower: ['塔里只有一圈楼梯。', '每一层都长得一样。'],
  roof: ['天台上有风。', '太阳还在对面楼的第七层。'],
};

export const ENDING = [
  '你在天台上坐下来。',
  '',
  '楼下有一万个声音。',
  '电视、炒菜、麻将、自行车铃、',
  '还有人在喊一个孩子回家吃饭。',
  '',
  '你听得清每一个。',
  '',
  '但整个小区，',
  '一盏灯也没有为你亮。',
  '',
  '—— 你记得2000年的夏天。',
  '2000年的夏天不记得你。',
  '',
  '《千禧回廊》',
];

// ---------------------------------------------------------------------------
//  各场景的逻辑
// ---------------------------------------------------------------------------

const H = {};

// ========================== 楼道 ==========================
H.stair = {
  enter(g) {
    g.set('climb', 0);
    A.addEmitter('sta_news', { x: 6.5, y: 5.6, radius: 7, kind: 'static', vol: 0.5 });
    g.say(...(g.flag('seen_opening') ? [] : OPENING));
    g.raise('seen_opening');
    // 声控灯：一开始全灭
    for (const l of g.world.lights) if (l.id?.startsWith('l_') && !l.id.startsWith('l_win')) l.on = false;
    g.set('lampTimer', 0);
  },

  tick(g, dt) {
    // —— 声控灯：只要有脚步声就亮，安静 6 秒后灭 ——
    const t = g.get('lampTimer', 0);
    if (t > 0) {
      g.set('lampTimer', t - dt);
      if (t - dt <= 0) {
        for (const l of g.world.lights) if (l.id?.startsWith('l_') && !l.id.startsWith('l_win')) l.on = false;
        A.lampClick();
        g.say('灯灭了。');
      }
    }
    // —— 楼上永远在打乒乓球 / 麻将 / 放新闻 ——
    g.every('amb_stair', 7 + Math.random() * 9, () => {
      const r = Math.random();
      if (r < 0.3) A.pingPong();
      else if (r < 0.58) A.mahjongClack(5, 0.5);
      else if (r < 0.8) A.newscast();
      else A.childCall();
    });
    // —— 走廊尽头的背影：只在你看向那边时出现，走近就没了 ——
    const gh = g.sprite('ghost1');
    if (gh && g.zoneIs('stair')) {
      const inCorridor = g.cam.y > 6.5 && g.cam.y < 10 && g.cam.x > 4;
      const dist = Math.hypot(g.cam.x - gh.x, g.cam.y - gh.y);
      if (inCorridor && dist > 5.5 && !g.flag('ghost1_gone')) {
        if (gh.hidden) { gh.hidden = false; A.babble({ pitch: 1.1, dur: 1.2, vol: 0.05, muffle: 700 }); }
      } else if (dist < 4.2 && !gh.hidden) {
        gh.hidden = true;
        g.raise('ghost1_gone');
        g.say('刚才那里站着一个人。', '你走过去，只有一扇窗。');
        A.lampClick();
      }
    }
  },

  step(g) {
    // 每一步都可能唤醒声控灯
    if (g.get('lampTimer', 0) <= 0) {
      A.lampClick();
      for (const l of g.world.lights) if (l.id?.startsWith('l_') && !l.id.startsWith('l_win')) l.on = true;
      if (!g.flag('lamp_once')) { g.raise('lamp_once'); g.say('灯亮了。', '楼道是米黄色的墙，墨绿色的墙裙。'); }
    }
    g.set('lampTimer', 6);
  },

  teleport(g, tp) {
    const n = g.get('climb', 0) + 1;
    g.set('climb', n);
    const floorNames = ['五层', '六层', '七层', '七层', '七层'];
    if (n < 3) {
      g.say(`${floorNames[n - 1] || '七层'}。`, '这一层和刚才那一层，一模一样。');
    } else if (n === 3) {
      // 第三层：楼道的口子"长"出来
      setCell(g.world, 18, 8, '.');
      g.say('七层。', '楼梯不见了。', '左边的墙上多了一个口子，', '那边的灯是亮的。');
      A.doorOpen();
    } else {
      g.say('还是七层。');
    }
  },

  interact(g, id) {
    switch (id) {
      case 'door302':
        if (g.has('key')) {
          g.say(...LINES.door302_open);
          A.doorOpen();
          g.goto('home', 1.6);
        } else {
          g.say(...LINES.door302_locked);
          if (!g.flag('hint_key')) { g.raise('hint_key'); g.say('钥匙一向压在门口的花盆下面。'); }
        }
        return true;
      case 'pot':
        if (!g.has('key')) {
          g.take('key');
          g.sprite('key') && (g.sprite('key').hidden = false);
          g.say(...LINES.pot_key);
          A.lampClick();
          setTimeout(() => { const s = g.sprite('key'); if (s) s.hidden = true; }, 2600);
        } else g.say(...LINES.pot_empty);
        return true;
      case 'door301': g.say(...LINES.door301); A.newscast(); return true;
      case 'door303': g.say(...LINES.door303); return true;
      case 'win_landing': g.say(...LINES.win_landing); A.bikeBell(); return true;
      default: return false;
    }
  },
};

// ========================== 家 ==========================
H.home = {
  enter(g) {
    A.addEmitter('h_fridge', { x: 19.6, y: 10.8, radius: 6.5, kind: 'fridge', vol: 0.9 });
    A.addEmitter('h_fan', { x: 12.2, y: 8.4, radius: 5, kind: 'fan', vol: 0.7 });
    g.say(...ZONE_INTRO.home);
    g.set('tvOn', false);
  },

  tick(g, dt) {
    // —— 客厅：两个人在聊天，沙发上没有人 ——
    g.every('chat', 6 + Math.random() * 7, () => {
      if (g.cam.x > 4 && g.cam.x < 13.5 && g.cam.y > 6.5 && g.cam.y < 14) {
        A.babble({ pitch: 0.95 + Math.random() * 0.25, dur: 1.4 + Math.random(), vol: 0.062, muffle: 1100 });
        if (Math.random() > 0.6) setTimeout(() => A.babble({ pitch: 1.35, dur: 0.7, vol: 0.05, laugh: true }), 1500);
        if (!g.flag('heard_chat')) {
          g.raise('heard_chat');
          g.say('有人在说话。', '就在沙发那边。', '沙发上没有人。');
        }
      }
    });
    // —— 厨房：炒菜声。走进去就停 ——
    const inKitchen = g.cam.x > 15.5 && g.cam.y > 9.5;
    if (!inKitchen) {
      g.every('wok', 4 + Math.random() * 4, () => {
        const d = Math.hypot(g.cam.x - 18, g.cam.y - 11.5);
        if (d < 13) A.wokBurst(Math.max(0.25, 1 - d / 14));
      });
    }
    // —— 卧室：麻将声 ——
    g.every('mj', 8 + Math.random() * 6, () => {
      const d = Math.hypot(g.cam.x - 18.6, g.cam.y - 6.2);
      if (d < 12) {
        A.mahjongClack(6, Math.max(0.3, 1 - d / 13));
        if (Math.random() > 0.5) A.babble({ pitch: 0.9, dur: 1.1, vol: 0.045, muffle: 800 });
      }
    });
    // —— 电视：你关了它，回头它又亮了 ——
    if (g.get('tvOn') && !A.hasEmitter('h_tvs')) {
      A.addEmitter('h_tvs', { x: 7.0, y: 7.55, radius: 8, kind: 'static', vol: 1 });
    }
    const tv = g.sprite('tv');
    const tvLight = g.light('h_tv');
    if (tv) tv.emit = g.get('tvOn') ? 0.55 : 0;
    if (tvLight) tvLight.i = g.get('tvOn') ? 0.75 : 0;
    if (g.get('tvOn') === false && g.flag('tv_was_on')) {
      g.after('tv_reopen', 9, () => {
        if (!g.get('tvOn')) {
          g.set('tvOn', true);
          A.lampClick();
          g.say('电视又亮了。');
        }
      });
    }
    // —— 走廊里的背影 ——
    const gh = g.sprite('ghost2');
    if (gh) {
      const inLiving = g.cam.x < 13 && g.cam.y > 7;
      const d = Math.hypot(g.cam.x - gh.x, g.cam.y - gh.y);
      if (inLiving && d > 5 && d < 11 && !g.flag('ghost2_gone') && Math.random() > 0.994) gh.hidden = false;
      if (!gh.hidden && d < 3.6) {
        gh.hidden = true; g.raise('ghost2_gone');
        g.say('走廊里有人背对着你。', '你叫了一声。', '走廊尽头是一面墙。');
      }
    }
    // —— 时间在这里不走 ——
    g.every('tick_home', 26, () => {
      if (Math.random() > 0.5) g.say('钟摆的声音停了一下，又接上了。');
    });
  },

  interact(g, id) {
    switch (id) {
      case 'tv':
        if (g.get('tvOn')) {
          g.set('tvOn', false);
          A.removeEmitter('h_tvs');
          g.say(...LINES.tv_off);
        } else {
          g.set('tvOn', true);
          g.raise('tv_was_on');
          A.lampClick();
          g.say(...LINES.tv_on);
          A.newscast();
        }
        return true;
      case 'phone':
        A.phoneRing(2);
        g.say(...LINES.phone);
        g.memory('phone');
        return true;
      case 'stove':
        A.wokBurst(1);
        g.say(...LINES.stove);
        g.memory('stove');
        return true;
      case 'mahjong':
        A.mahjongClack(8, 1);
        A.babble({ pitch: 1.3, dur: 0.8, vol: 0.055, laugh: true });
        g.say(...LINES.mahjong);
        g.memory('mahjong');
        return true;
      case 'homedoor': {
        const n = g.memoryCount();
        if (n >= MEMORY_NEEDED) {
          A.doorOpen();
          g.say(...LINES.homedoor_open);
          g.goto('lobby', 2.2);
        } else {
          g.say(LINES.homedoor_locked[0], LINES.homedoor_locked[1].replace('{n}', MEMORY_NEEDED - n));
        }
        return true;
      }
      default: return false;
    }
  },
};

// ========================== 大堂 ==========================
H.lobby = {
  enter(g) {
    g.say(...ZONE_INTRO.lobby);
    g.set('eleTimer', 0);
    A.addEmitter('lb_cooler', { x: 23.5, y: 17.5, radius: 5, kind: 'fridge', vol: 0.5 });
  },

  tick(g, dt) {
    // —— 广播：走音的欢庆曲，一遍一遍 ——
    g.every('bc', 34, () => { A.broadcastTune(); if (!g.flag('heard_bc')) { g.raise('heard_bc'); g.say('广播在放一首歌。', '调子是欢快的，音是错的。'); } });
    // —— 没有人的电梯，一直开一直关 ——
    g.every('ele', 11 + Math.random() * 7, () => {
      A.ding();
      if (!g.flag('saw_ele')) { g.raise('saw_ele'); g.say('电梯开了。', '没有人出来。', '门又关上了。'); }
    });
    // —— 大厅深处的脚步声，不是你的 ——
    g.every('steps', 13 + Math.random() * 9, () => {
      const s = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < s; i++) setTimeout(() => A.footstep('stone', 0.35), i * 480);
      if (!g.flag('heard_steps')) { g.raise('heard_steps'); g.say('有脚步声，在大理石上。', '不是你的——你站着没动。'); }
    });
    // —— 远处的背影，一个在地毯尽头，一个在灭了灯的角落 ——
    for (const [gid, fl] of [['ghost3', 'g3'], ['ghost4', 'g4']]) {
      const gh = g.sprite(gid);
      if (!gh) continue;
      const d = Math.hypot(g.cam.x - gh.x, g.cam.y - gh.y);
      if (gh.hidden && d > 9 && d < 17 && !g.flag(fl) && Math.random() > 0.993) gh.hidden = false;
      if (!gh.hidden && d < 6.5) {
        gh.hidden = true; g.raise(fl);
        g.say('那边站着一个人。', '你走过去，那里只有柱子。');
      }
    }
  },

  interact(g, id) {
    if (id === 'elevator') {
      A.ding();
      g.say(...LINES.elevator);
      g.goto('tower', 2.4);
      return true;
    }
    return false;
  },
};

// ========================== 尖塔 ==========================
H.tower = {
  enter(g) {
    g.say(...ZONE_INTRO.tower);
    g.set('floor', 0);
    g.set('cp', 'A');
  },

  tick(g, dt) {
    // —— 走完一整圈 = 上一层。三层之后，核心开了 ——
    const nearNW = Math.hypot(g.cam.x - 2.5, g.cam.y - 2.5) < 1.6;
    const nearSE = Math.hypot(g.cam.x - 13.5, g.cam.y - 13.5) < 1.6;
    if (nearNW && g.get('cp') === 'A') {
      g.set('cp', 'B');
      const f = g.get('floor', 0) + 1;
      g.set('floor', f);
      if (f === 1) g.say('你绕了一圈。', '窗外的楼矮了一点。');
      else if (f === 2) g.say('又一圈。', '窗外只剩天线了。');
      else if (f === 3) {
        setCell(g.world, 7, 5, '^'); setCell(g.world, 8, 5, '^');
        for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) setCell(g.world, x, y, '^');
        const l = g.light('tw_core'); if (l) l.i = 0.85;
        const tv = g.sprite('lasttv'); if (tv) tv.emit = 0.6;
        A.addEmitter('tw_static', { x: 7.5, y: 8.2, radius: 11, kind: 'static', vol: 1 });
        A.doorOpen();
        g.say('第三圈。', '塔的中间开了。');
      } else g.say('还是这一层。');
    }
    if (nearSE && g.get('cp') === 'B') g.set('cp', 'A');

    g.every('tw_amb', 9 + Math.random() * 8, () => {
      Math.random() > 0.5 ? A.babble({ pitch: 0.85, dur: 2.2, vol: 0.04, muffle: 520 }) : A.pingPong();
    });

    const gh = g.sprite('ghost5');
    if (gh) {
      const d = Math.hypot(g.cam.x - gh.x, g.cam.y - gh.y);
      if (gh.hidden && d > 6 && d < 12 && !g.flag('g5') && Math.random() > 0.995) gh.hidden = false;
      if (!gh.hidden && d < 4) { gh.hidden = true; g.raise('g5'); g.say('前面有人在上楼。', '你追过去，楼梯是空的。'); }
    }
  },

  interact(g, id) {
    if (id === 'core') {
      g.say(...(g.get('floor', 0) >= 3 ? LINES.core_open : LINES.core_closed));
      return true;
    }
    if (id === 'lasttv') {
      g.say(...LINES.lasttv);
      g.memory('lasttv');
      g.goto('roof', 3.0);
      return true;
    }
    return false;
  },
};

// ========================== 天台 ==========================
H.roof = {
  enter(g) {
    g.say(...ZONE_INTRO.roof);
  },

  tick(g, dt) {
    // —— 楼下一整个小区的声音，全都听得见 ——
    g.every('roof_amb', 3 + Math.random() * 4, () => {
      const r = Math.random();
      if (r < 0.22) A.newscast();
      else if (r < 0.42) A.mahjongClack(5, 0.4);
      else if (r < 0.58) A.wokBurst(0.5);
      else if (r < 0.72) A.bikeBell();
      else if (r < 0.86) A.childCall();
      else A.babble({ pitch: 0.9 + Math.random() * 0.5, dur: 1.6, vol: 0.045, muffle: 700 });
    });

    const gh = g.sprite('ghost6');
    if (gh) {
      const d = Math.hypot(g.cam.x - gh.x, g.cam.y - gh.y);
      if (gh.hidden && d > 8 && d < 16 && !g.flag('g6') && Math.random() > 0.994) gh.hidden = false;
      if (!gh.hidden && d < 5) { gh.hidden = true; g.raise('g6'); g.say('女儿墙边上站着一个人。', '你看清了——那是你，小时候。', '你再看，没有了。'); }
    }
  },

  interact(g, id) {
    if (id === 'endstool') {
      if (g.flag('ending')) return true;
      g.raise('ending');
      g.finish();
      return true;
    }
    return false;
  },
};

export const HANDLERS = H;

/** 通用交互：能查表就说，能记就记 */
export function genericInteract(g, id) {
  const txt = LINES[id];
  if (!txt) return false;
  g.say(...txt);
  if (MEMORY_IDS.includes(id)) g.memory(id);
  return true;
}
