// 主线剧情数据 + 对话树（模块 D 生产，模块 E 消费）。
// 纯数据 + 少量辅助函数，不 import three，保持轻量。
// 对话节点结构见 CONTRACT.md §4。

// ---- 对话辅助 ----

/** 快捷构造对话节点。 */
export function node(speaker, lines, extra = {}) {
  return { speaker, lines, ...extra };
}

/**
 * 顺序推进一棵对话树（含 choices 分支）。
 * 必须容错：ctx.ui?.dialogue 不存在时仅打印并 resolve 0。
 * @returns Promise<number> 最后选择的分支索引
 */
export async function speak(ctx, root) {
  if (!root) return 0;
  if (!ctx.ui?.dialogue) {
    console.log('[dialogue]', root.speaker, '::', (root.lines ?? []).join(' / '));
    return 0;
  }
  let cur = root, guard = 0, idx = 0;
  while (cur && guard++ < 64) {
    try { idx = await ctx.ui.dialogue.start(cur); } catch (e) { console.log('[dialogue] err', e); return idx; }
    const nxt = cur.choices?.[idx]?.next;
    if (typeof nxt === 'function') { const r = nxt(ctx); cur = (r && typeof r === 'object') ? r : null; }
    else if (nxt && typeof nxt === 'object') cur = nxt;
    else break;
  }
  return idx;
}

// ---- 主线：7 个章节（复刻原神开场脉络） ----

// 触发类型约定（QuestSystem 解释）：
//   {type:'auto', delay}        自动（延时后完成）
//   {type:'region', region}     进入地标
//   {type:'location', x,z,r}    到达坐标附近
//   {type:'interact', id}       与交互点互动（spots 注册）
//   {type:'npc', id}            与指定 NPC 对话
//   {type:'kill', family, count}击杀数
//   {type:'puzzle', id}         解谜完成
//   {type:'gather', item, count}采集数

export const MAIN_QUESTS = [
  {
    id: 'main_1',
    kind: 'main',
    title: '序章·风起之时',
    subtitle: '陌生的海岸，陌生的天空。',
    autoAccept: true,
    requires: null,
    spots: {
      rescue_paimon: { x: 250, z: 1188, label: '救起派蒙', icon: 'talk', desc: '水里有个小家伙在扑腾！' },
    },
    reward: '摩拉 ×1000',
    steps: [
      {
        text: '在南风海岸醒来',
        trigger: { type: 'auto', delay: 0.25 },
        dialogue: node('旁白', ['你睁开眼，咸湿的海风拂过脸颊。', '这里是……南风海岸。'], { cinematic: true }),
      },
      {
        text: '救起在水里挣扎的派蒙',
        trigger: { type: 'interact', id: 'rescue_paimon' },
        dialogue: node('派蒙', [
          '呜哇——！救命呀！派蒙要被海水冲走啦！',
          '你这个木头人！别光看着，快把派蒙捞上来！',
        ], { portrait: 'paimon' }),
      },
      {
        text: '与派蒙对话',
        trigger: { type: 'auto', delay: 0.4 },
        dialogue: node('派蒙', [
          '呼——得救了！谢谢你呀，旅行者！',
          '派蒙可是为了找食物才掉进水里的……嘿嘿。',
          '对了对了，你会不会很饿？派蒙已经饿得前胸贴后背啦！',
          '作为报答，派蒙就大发慈悲地当你的向导吧！走，我们去找点好吃的！',
        ], { portrait: 'paimon' }),
      },
      {
        text: '学习移动与冲刺（教学）',
        trigger: { type: 'auto', delay: 0.8 },
        onEnter(ctx) {
          ctx.ui?.subtitle?.('用 W/A/S/D 移动，按住 Shift 冲刺', 4000);
          ctx.ui?.toast?.('提示：双击方向键可翻滚躲避');
          ctx.ui?.toast?.('提示：靠近岩壁可攀爬，空中按住空格可滑翔');
        },
        reward: '摩拉 ×1000',
      },
    ],
  },

  {
    id: 'main_2',
    kind: 'main',
    title: '风起地的低语',
    subtitle: '巨树之下，风的低语最为清晰。',
    autoAccept: true,
    requires: 'main_1',
    spots: {
      great_tree: { x: -230, z: 210, label: '触摸巨树', icon: 'puzzle', desc: '感受风的共鸣' },
    },
    reward: '风之翼（解锁滑翔）',
    steps: [
      {
        text: '前往风起地巨树',
        trigger: { type: 'region', region: 'windrise' },
        onEnter(ctx) { ctx.ui?.toast?.('任务：风起地的低语'); },
      },
      {
        text: '击退路上的史莱姆（0/3）',
        trigger: { type: 'kill', family: 'slime', count: 3 },
        onEnter(ctx) {
          ctx.ui?.subtitle?.('史莱姆挡住了去路！用普攻和元素战技击败它们', 4000);
          ctx.enemies?.spawnCamp?.('slime_water', { x: -260, y: 18, z: 230 }, 3, 12);
        },
      },
      {
        text: '在巨树下触发风元素共鸣',
        trigger: { type: 'interact', id: 'great_tree' },
        dialogue: node('派蒙', [
          '哇——好大的树！风吹过来的声音，像在唱歌一样……',
          '旅行者，快把手贴上去试试！',
        ], { portrait: 'paimon' }),
        onDone(ctx) {
          ctx.events?.emit('unlock:glider');
          ctx.ui?.toast?.('获得 风之翼！解锁滑翔能力');
          ctx.ui?.subtitle?.('空中按住空格展开风之翼滑翔', 4000);
        },
      },
    ],
  },

  {
    id: 'main_3',
    kind: 'main',
    title: '蒙德城',
    subtitle: '自由之城，风神巴巴托斯的居所。',
    autoAccept: true,
    requires: 'main_2',
    spots: {
      statue_seven: { x: 0, z: 0, label: '激活七天神像', icon: 'waypoint', desc: '点亮这片土地的地图' },
    },
    reward: '地图解锁 + 传送锚点',
    steps: [
      {
        text: '进入蒙德城',
        trigger: { type: 'region', region: 'mondstadt' },
        onEnter(ctx) { ctx.ui?.hud?.setRegion?.('蒙德城'); },
      },
      {
        text: '激活七天神像',
        trigger: { type: 'interact', id: 'statue_seven' },
        onDone(ctx) {
          ctx.ui?.toast?.('已解锁蒙德地区地图与传送锚点');
          ctx.events?.emit('waypoint:unlocked', { id: 'statue_seven' });
        },
      },
      {
        text: '与代理团长·琴对话',
        trigger: { type: 'npc', id: 'jean' },
        dialogue: node('琴', [
          '旅行者，欢迎来到蒙德。我是西风骑士团代理团长，琴·古恩希尔德。',
          '如今风魔龙特瓦林肆虐，蒙德的天空蒙上了阴影，百姓人心惶惶。',
          '我以骑士团的名义，正式向你发出委托：协助我们平息风魔龙的威胁。',
        ], { portrait: 'jean', element: 'anemo' }),
      },
      {
        text: '与侦察骑士·安柏对话',
        trigger: { type: 'npc', id: 'amber' },
        dialogue: node('安柏', [
          '哈喽——！你就是那个旅行者吧？我是西风骑士团的侦察骑士，安柏！',
          '以后有我在，谁也别想欺负你！骑扫帚……啊不是，我可是用风之翼的高手哦！',
          '委托的事就拜托啦，我们一起去把天空变回蓝色吧！',
        ], { portrait: 'amber', element: 'pyro' }),
      },
      {
        text: '接受「风魔龙威胁」委托',
        trigger: { type: 'auto', delay: 0.6 },
        onEnter(ctx) { ctx.ui?.quest?.flash?.('接受委托：风魔龙威胁'); },
      },
    ],
  },

  {
    id: 'main_4',
    kind: 'main',
    title: '失落的手记',
    subtitle: '被腐蚀的古老要塞，藏着谁的记忆？',
    autoAccept: true,
    requires: 'main_3',
    spots: {
      stone_door: { x: -1080, z: -420, label: '打开石门', icon: 'puzzle', desc: '沉重的石门上刻着元素纹路' },
      handnote: { x: -1095, z: -435, label: '取得古老的手记', icon: 'pickup', desc: '一本泛黄的手记' },
    },
    reward: '古老的手记 + 摩拉 ×2000',
    steps: [
      {
        text: '前往风龙废墟',
        trigger: { type: 'region', region: 'ruins' },
        onEnter(ctx) { ctx.ui?.toast?.('任务：失落的手记'); },
      },
      {
        text: '按顺序点亮三座元素方碑',
        trigger: { type: 'puzzle', id: 'ruins_monument' },
        onEnter(ctx) { ctx.ui?.subtitle?.('石碑上刻着顺序：风 → 火 → 冰', 4000); },
      },
      {
        text: '打开石门',
        trigger: { type: 'interact', id: 'stone_door' },
        dialogue: node('派蒙', ['石门缓缓打开，扬起陈年的灰尘……咳、咳咳！'], { portrait: 'paimon' }),
      },
      {
        text: '取得「古老的手记」',
        trigger: { type: 'interact', id: 'handnote' },
        dialogue: node('旁白', [
          '手记上的字迹已经模糊，但你依稀辨认出：',
          '“特瓦林不是敌人……它在等一个能听懂风的人。”',
        ], { cinematic: true }),
        onDone(ctx) { ctx.ui?.toast?.('获得 古老的手记'); },
      },
      {
        text: '击退丘丘人营地（0/6）',
        trigger: { type: 'kill', family: 'hilichurl', count: 6 },
        onEnter(ctx) { ctx.enemies?.spawnCamp?.('hilichurl', { x: -1060, y: 40, z: -400 }, 3, 18); },
      },
    ],
  },

  {
    id: 'main_5',
    kind: 'main',
    title: '雪山的低温',
    subtitle: '终年不化的雪，掩埋着古国的秘密。',
    autoAccept: true,
    requires: 'main_4',
    reward: '耐寒食谱 + 摩拉 ×3000',
    steps: [
      {
        text: '前往龙脊雪山',
        trigger: { type: 'region', region: 'dragonspine' },
        onEnter(ctx) {
          ctx.ui?.subtitle?.('严寒机制：长时间暴露在风雪中会持续损失生命，靠近火源可取暖', 5000);
          ctx.ui?.toast?.('提示：找到火种并点燃它们取暖');
        },
      },
      {
        text: '点燃三处火种取暖',
        trigger: { type: 'puzzle', id: 'snow_torch' },
        onEnter(ctx) { ctx.ui?.subtitle?.('用火元素点亮三座火盆', 4000); },
      },
      {
        text: '解开冰封方碑',
        trigger: { type: 'puzzle', id: 'snow_monument' },
        onEnter(ctx) { ctx.ui?.subtitle?.('冰封方碑需要火元素来解冻', 4000); },
      },
      {
        text: '击败遗迹守卫',
        trigger: { type: 'kill', family: 'ruinguard', count: 1 },
        onEnter(ctx) { ctx.enemies?.spawn?.('ruinguard', { x: -260, y: 90, z: -1080 }); },
      },
    ],
  },

  {
    id: 'main_6',
    kind: 'main',
    title: '石门的试炼',
    subtitle: '风蚀的岩柱之间，藏着古老的试炼。',
    autoAccept: true,
    requires: 'main_5',
    reward: '试炼宝箱 + 摩拉 ×5000',
    steps: [
      {
        text: '前往石门峡谷',
        trigger: { type: 'region', region: 'stonegate' },
        onEnter(ctx) { ctx.ui?.toast?.('任务：石门的试炼'); },
      },
      {
        text: '限时挑战：60 秒内击败 6 只怪',
        trigger: { type: 'puzzle', id: 'stonegate_trial' },
        onEnter(ctx) { ctx.ui?.subtitle?.('进入挑战区域即开始倒计时！', 4000); },
      },
    ],
  },

  {
    id: 'main_7',
    kind: 'main',
    title: '终章·风魔龙',
    subtitle: '天空终将回归澄澈。',
    autoAccept: true,
    requires: 'main_6',
    reward: '冒险的证明 + 摩拉 ×10000',
    steps: [
      {
        text: '回到蒙德城',
        trigger: { type: 'region', region: 'mondstadt' },
        onEnter(ctx) { ctx.ui?.toast?.('任务：终章·风魔龙'); },
      },
      {
        text: '温迪出现了',
        trigger: { type: 'npc', id: 'venti' },
        dialogue: node('温迪', [
          '啊呀呀，别来无恙呀，旅行者。',
          '风从远方带来消息：特瓦林的心，早已被孤独与毒血浸染。',
          '它并非恶龙，它只是……忘了如何被温柔以待。',
          '去吧，去塞西莉亚湖。那里的风会为你引路。',
        ], { portrait: 'venti', element: 'anemo' }),
      },
      {
        text: '前往塞西莉亚湖',
        trigger: { type: 'region', region: 'lake' },
        onEnter(ctx) { ctx.ui?.subtitle?.('湖面上，狂风骤起……', 4000); },
      },
      {
        text: '决战风魔龙·特瓦林',
        trigger: { type: 'kill', family: 'boss_dvalin', count: 1 },
        onEnter(ctx) {
          ctx.ui?.hud?.setBoss?.('风魔龙·特瓦林', 1, 1);
          ctx.audio?.music?.('boss', { fade: 2 });
          let boss = null;
          try { boss = ctx.enemies?.spawn?.('boss_dvalin', { x: 520, y: 20, z: 340 }); } catch {}
          // 容错：敌人模块未就绪（spawn 返回 null）时不卡剧情，提示后直接判定通过
          if (!boss) {
            ctx.ui?.toast?.('敌人模块未就绪：跳过风魔龙战斗，直接推进剧情');
            setTimeout(() => ctx.events?.emit('enemy:died', { type: 'boss_dvalin', pos: { x: 520, y: 20, z: 340 } }), 1500);
          }
        },
        onDone(ctx) { ctx.ui?.hud?.clearBoss?.(); },
      },
      {
        text: '尾声',
        trigger: { type: 'auto', delay: 0.6 },
        dialogue: node('温迪', [
          '谢谢你，旅行者。天空的颜色，又回来了。',
          '愿风指引你的方向，愿自由与你的旅途同在。',
          '——好了，庆功宴上，可别忘了给派蒙多留几份苹果派哦！',
        ], { portrait: 'venti', element: 'anemo', cinematic: true }),
        onDone(ctx) {
          ctx.ui?.cinematic?.(true);
          if (ctx.ui?.credits) ctx.ui.credits();
          else ctx.ui?.subtitle?.('—— 感谢游玩 · 提瓦特 Demo ——', 8000);
          ctx.ui?.cinematic?.(false);
        },
      },
    ],
  },
];
