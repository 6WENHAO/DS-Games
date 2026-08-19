// 支线任务数据（模块 D）。6+ 个支线，各有独立对话、目标与三态。
// 触发类型同 story.js 约定；acceptDialogue 用于接取时的分支对话。
import { node } from './story.js';

export const SIDE_QUESTS = [
  // ① 失落的宠物 —— 找 3 只走失的猫（含分支：先找哪只，影响后续台词）
  {
    id: 'side_1',
    kind: 'side',
    title: '失落的宠物',
    subtitle: '猫咪走丢了，主人很着急。',
    autoAccept: 'npc:villager_margaret',
    reward: '摩拉 ×800 + 猫粮 ×5',
    acceptDialogue: node('玛格丽特', [
      '呜呜……我的三只小猫都跑丢了，你能帮我找找吗？',
      '一只爱偷鱼，一只爱晒太阳，还有一只总往房顶爬。',
    ], {
      choices: [
        { text: '包在我身上！', next: (ctx) => { ctx.quests?.accept('side_1', { first: 'fish' }); return node('玛格丽特', ['太感谢了！它最爱在湖边偷鱼了。']); } },
        { text: '我有点忙……', next: (ctx) => { ctx.quests?.accept('side_1', { first: 'roof' }); return node('玛格丽特', ['拜托了！房顶那只最调皮……']); } },
        { text: '先给我讲讲它们的样子', next: (ctx) => { ctx.quests?.accept('side_1', { first: 'sun' }); return node('玛格丽特', ['一只橘色的，一只雪白的，还有一只虎斑。']); } },
      ],
    }),
    spots: {
      cat_fish: { x: 540, z: 360, label: '抱起偷鱼的小猫', icon: 'pickup', desc: '一只叼着鱼的橘猫' },
      cat_sun:  { x: 120, z: 80, label: '抱起晒太阳的小猫', icon: 'pickup', desc: '一只雪白的小猫' },
      cat_roof: { x: -40, z: -60, label: '抱下房顶的小猫', icon: 'pickup', desc: '一只虎斑小猫' },
    },
    steps: [
      { text: '寻找第一只走失的小猫', trigger: { type: 'interact', id: '{first}' }, },
      { text: '寻找第二只走失的小猫', trigger: { type: 'interact', id: '{second}' } },
      { text: '寻找第三只走失的小猫', trigger: { type: 'interact', id: '{third}' } },
      {
        text: '把小猫还给玛格丽特',
        trigger: { type: 'npc', id: 'villager_margaret' },
        dialogue: node('玛格丽特', ['谢谢你！这是谢礼，请务必收下！', '下次来蒙德，我请你喝下午茶。'], { portrait: 'villager' }),
      },
    ],
  },

  // ② 酿酒师的委托 —— 采集 5 个树莓
  {
    id: 'side_2',
    kind: 'side',
    title: '酿酒师的委托',
    subtitle: '晨曦酒庄需要新鲜树莓。',
    autoAccept: 'npc:villager_brewer',
    reward: '晨曦果酒 ×3 + 摩拉 ×600',
    acceptDialogue: node('酿酒师', [
      '这批新酒的配方里缺一味新鲜树莓，果园里的都用完了。',
      '能帮我摘 5 个吗？要又红又饱满的那种！',
    ], { choices: [
      { text: '乐意效劳', next: (ctx) => { ctx.quests?.accept('side_2'); return node('酿酒师', ['拜托啦！']); } },
    ] }),
    steps: [
      { text: '采集树莓（0/5）', trigger: { type: 'gather', item: 'berry', count: 5 } },
      {
        text: '把树莓交给酿酒师',
        trigger: { type: 'npc', id: 'villager_brewer' },
        dialogue: node('酿酒师', ['好样的！果香扑鼻……这酒一定大卖！', '这瓶给你，算我的谢意。'], { portrait: 'villager' }),
      },
    ],
  },

  // ③ 骑士团的巡查 —— 清理 2 个丘丘人营地
  {
    id: 'side_3',
    kind: 'side',
    title: '骑士团的巡查',
    subtitle: '城外出现了丘丘人的营地。',
    autoAccept: 'npc:kaeya',
    reward: '摩拉 ×1200 + 骑士团勋章',
    acceptDialogue: node('凯亚', [
      '哦？这不是旅行者吗。',
      '骑士团人手不足，城外有两处丘丘人营地，替我去清剿如何？',
    ], { portrait: 'kaeya', element: 'cryo', choices: [
      { text: '交给我吧', next: (ctx) => { ctx.quests?.accept('side_3'); return node('凯亚', ['干脆利落，我喜欢。']); } },
      { text: '你们骑士团自己不管吗？', next: (ctx) => { ctx.quests?.accept('side_3'); return node('凯亚', ['哈哈，这不是相信你的实力嘛。']); } },
    ] }),
    steps: [
      { text: '清理丘丘人营地（0/6）', trigger: { type: 'kill', family: 'hilichurl', count: 6 } },
      {
        text: '向凯亚复命',
        trigger: { type: 'npc', id: 'kaeya' },
        dialogue: node('凯亚', ['干得漂亮。这是骑士团的谢礼，收下吧。'], { portrait: 'kaeya', element: 'cryo' }),
      },
    ],
  },

  // ④ 诗人的灵感 —— 在 3 个风景点「拍照」（含分支：选项影响奖励）
  {
    id: 'side_4',
    kind: 'side',
    title: '诗人的灵感',
    subtitle: '吟游诗人需要一点创作的灵感。',
    autoAccept: 'npc:venti',
    reward: '灵感之诗 + 摩拉 ×1500',
    acceptDialogue: node('温迪', [
      '啊，旅行者，你来得正好。',
      '我想为风写一首新诗，却总觉得少了些什么。',
      '能否替我去三个地方，拍下那里的风景呢？',
    ], { portrait: 'venti', element: 'anemo', choices: [
      { text: '当然，乐意之至', next: (ctx) => { ctx.quests?.accept('side_4', { bonus: true }); return node('温迪', ['太棒了！灵感正在我的脑海里流淌~']); } },
      { text: '有什么好处吗？', next: (ctx) => { ctx.quests?.accept('side_4', { bonus: false }); return node('温迪', ['哈哈，风会给你最好的报酬——但摩拉也不会少哦。']); } },
    ] }),
    spots: {
      view_windrise: { x: -230, z: 210, label: '拍摄：风起地巨树', icon: 'puzzle', desc: '取景框里，巨树与天空相接' },
      view_lake:     { x: 520, z: 340, label: '拍摄：塞西莉亚湖', icon: 'puzzle', desc: '湖水如镜，倒映天光' },
      view_dragon:   { x: -260, z: -1080, label: '拍摄：龙脊雪山', icon: 'puzzle', desc: '雪峰之上，云海翻涌' },
    },
    steps: [
      { text: '在 3 个风景点拍照（0/3）', trigger: { type: 'gather', item: 'photo', count: 3 } },
      {
        text: '把照片交给温迪',
        trigger: { type: 'npc', id: 'venti' },
        dialogue: node('温迪', [
          '美极了……风把这些画面带进了我的诗里。',
          '这是谢礼。若你哪天想听，我弹给你听。',
        ], { portrait: 'venti', element: 'anemo' }),
      },
    ],
  },

  // ⑤ 宝藏猎人的地图 —— 按线索挖 3 个宝箱（含分支：选项影响奖励）
  {
    id: 'side_5',
    kind: 'side',
    title: '宝藏猎人的地图',
    subtitle: '一张泛黄的地图，三个红色的叉。',
    autoAccept: 'npc:villager_hunter',
    reward: '古代钱币 ×10 + 摩拉 ×1000',
    acceptDialogue: node('宝藏猎人', [
      '嘿嘿，你捡到了我的地图？算你运气好，这宝藏见者有份。',
      '三个红叉，各埋着一个宝箱。挖出来，我们五五分账。',
    ], { choices: [
      { text: '成交，带路！', next: (ctx) => { ctx.quests?.accept('side_5', { share: true }); return node('宝藏猎人', ['爽快！']); } },
      { text: '二八分，我八你二', next: (ctx) => { ctx.quests?.accept('side_5', { share: false }); return node('宝藏猎人', ['你……你这也太黑了吧！算了算了，就当交个朋友。']); } },
    ] }),
    spots: {
      dig_1: { x: 980, z: -400, label: '挖掘宝箱（线索 1）', icon: 'chest', desc: '泥土松软，似乎埋着什么' },
      dig_2: { x: 940, z: -460, label: '挖掘宝箱（线索 2）', icon: 'chest', desc: '石缝间露出一角木箱' },
      dig_3: { x: 1020, z: -380, label: '挖掘宝箱（线索 3）', icon: 'chest', desc: '一棵老树根旁' },
    },
    steps: [
      { text: '挖出第一个宝箱（0/3）', trigger: { type: 'interact', id: 'dig_1' } },
      { text: '挖出第二个宝箱（0/3）', trigger: { type: 'interact', id: 'dig_2' } },
      { text: '挖出第三个宝箱（0/3）', trigger: { type: 'interact', id: 'dig_3' } },
      {
        text: '与宝藏猎人分账',
        trigger: { type: 'npc', id: 'villager_hunter' },
        dialogue: node('宝藏猎人', ['不错不错，收获满满！', '这次合作愉快，下次再一起发财！'], { portrait: 'villager' }),
      },
    ],
  },

  // ⑥ 雪山遇险 —— 救出被困的冒险家
  {
    id: 'side_6',
    kind: 'side',
    title: '雪山遇险',
    subtitle: '有人在风雪中呼救。',
    autoAccept: 'region:dragonspine',
    reward: '耐寒药剂 ×2 + 摩拉 ×900',
    acceptDialogue: node('冒险家', ['救……救命！我的腿被石头压住了，好冷……'], { choices: [
      { text: '坚持住，我来了！', next: (ctx) => { ctx.quests?.accept('side_6'); return node('冒险家', ['谢、谢谢……']); } },
    ] }),
    spots: {
      trapped: { x: -320, z: -1040, label: '搬开石头救出冒险家', icon: 'talk', desc: '一位被压在碎石下的冒险家' },
    },
    steps: [
      { text: '救出被困的冒险家', trigger: { type: 'interact', id: 'trapped' }, onDone(ctx) { ctx.ui?.toast?.('冒险家获救！'); } },
      {
        text: '护送冒险家到火堆旁',
        trigger: { type: 'puzzle', id: 'snow_torch' },
        onDone(ctx) { ctx.ui?.toast?.('任务完成：雪山遇险'); },
      },
    ],
  },
];

// NPC 补充：支线里用到但不在 npcs.js 主名单中的村民 id → 名字（供 npcs 或 quest 查询）。
export const SIDE_NPC_NAMES = {
  villager_margaret: '玛格丽特',
  villager_brewer: '酿酒师',
  villager_hunter: '宝藏猎人',
};
