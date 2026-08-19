/* ============================================================
   case1.js — 第 1 话「逆转的深夜电波」
   ・证物与人物档案（含程序生成的图标）
   ・完整剧本：序章 → 调查 → 前厅 → 审判（三次突破）→ 尾声
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL;
  var C1 = AA.CASE1 = {};

  /* ============================================================
     证物 / 档案
     ============================================================ */
  function paper(pen, w, h, tone) {
    pen.rrect(3, 2, w - 6, h - 4, 2, tone || '#efe7cf');
    pen.rect(3, 2, w - 6, 1, '#fffaea');
    pen.rect(3, h - 3, w - 6, 1, '#c3b995');
  }
  function lines(pen, x, y, n, w, col, gap) {
    for (var i = 0; i < n; i++) pen.rect(x, y + i * (gap || 3), w - (i % 3) * 4, 1, col || '#8a8168');
  }

  C1.items = {
    badge: {
      name: '律师徽章', short: '徽章', kind: 'evi',
      sub: '辩护人的证明',
      desc: '成步堂的辩护士徽章。金色的天秤，是「相信被告」的重量。',
      draw: function (pen, w, h) {
        pen.circle(w / 2, h / 2, 13, '#8a5c14');
        pen.circle(w / 2, h / 2, 11.5, '#e0b24a');
        pen.circle(w / 2, h / 2, 8, '#c8343e');
        pen.circle(w / 2, h / 2, 6.4, '#e05460');
        pen.rect(w / 2 - 1, h / 2 - 5, 2, 10, '#f6dd94');
        pen.rect(w / 2 - 5, h / 2 - 3, 10, 1.6, '#f6dd94');
        pen.circle(w / 2 - 4.4, h / 2 - 4.4, 2.4, '#fff3cc');
      }
    },
    autopsy: {
      name: '尸检报告', short: '尸检报告', kind: 'evi',
      sub: '死亡推定时刻',
      desc: '死因：后脑受钝器重击。死亡推定时刻：[r]晚上10点～10点40分[/]之间。',
      draw: function (pen, w, h) {
        paper(pen, w, h, '#f2ecd8');
        pen.rect(6, 5, w - 12, 4, '#b03a44');
        lines(pen, 6, 12, 5, w - 12, '#8a8168');
        pen.rect(w - 17, h - 12, 11, 8, '#c8343e');
        pen.rect(w - 15, h - 10, 7, 1, '#f2ecd8');
        pen.rect(w - 15, h - 8, 7, 1, '#f2ecd8');
      }
    },
    photo: {
      name: '现场照片', short: '现场照片', kind: 'evi',
      sub: '录音室 B',
      desc: '录音室 B 的照片。遗体倒在播音桌前。[b]通向调音室的玻璃窗，遮光帘是拉下来的[/]。',
      draw: function (pen, w, h) {
        pen.rrect(2, 2, w - 4, h - 4, 1, '#f4f0e2');
        pen.rect(4, 4, w - 8, h - 12, '#2a3350');
        pen.rect(4, 4, w - 8, 5, '#3d4a70');
        pen.rect(7, 12, 12, 3, '#5c4436');
        pen.poly([[22, 20], [34, 17], [37, 22], [24, 24]], '#c8c0a8');
        pen.circle(21, 19, 2.6, '#e8cfae');
        pen.rect(26, 22, 8, 2, '#8a2028');
        pen.rect(w - 16, 6, 10, 12, '#4a5570');
        pen.rect(w - 15, 7, 8, 10, '#2c3450');
        pen.rect(6, h - 7, 16, 2, '#a89f80');
      }
    },
    stand: {
      name: '铜制麦克风支架', short: '麦架', kind: 'evi',
      sub: '凶器',
      desc: '沉重的铜制支架，底座上留有血迹。上面有[r]被告人的指纹[/]——她说自己「不小心捡了起来」。',
      draw: function (pen, w, h) {
        pen.rect(w / 2 - 1.4, 5, 2.8, h - 13, '#9a7a3c');
        pen.rect(w / 2 - 0.6, 5, 1.2, h - 13, '#d8b466');
        pen.ellipse(w / 2, h - 7, 13, 4.4, '#8a6a30');
        pen.ellipse(w / 2, h - 8, 11, 3.2, '#c9a44c');
        pen.ellipse(w / 2, 6, 5.4, 4.2, '#3a4050');
        pen.ellipse(w / 2 - 1, 5, 3, 2.4, '#5c6478');
        pen.poly([[w / 2 + 4, h - 10], [w / 2 + 10, h - 9], [w / 2 + 8, h - 6], [w / 2 + 3, h - 7]], '#8a1c24');
      }
    },
    watch: {
      name: '破碎的怀表', short: '怀表', kind: 'evi',
      sub: '停在 10:18',
      desc: '被害人随身的怀表，表面碎裂，指针停在[r]10点18分[/]。据说是他从前辈那里继承的宝物。',
      draw: function (pen, w, h) {
        pen.circle(w / 2, h / 2 + 1, 12, '#8a5c14');
        pen.circle(w / 2, h / 2 + 1, 10.4, '#e8dfc4');
        pen.rect(w / 2 - 0.8, h / 2 - 6, 1.6, 7, '#3a3020');   // 时针 10
        pen.rect(w / 2 - 6, h / 2 - 2, 7, 1.4, '#3a3020');
        pen.rect(w / 2 - 1, h / 2, 6.4, 1.4, '#7a2028');       // 分针
        pen.circle(w / 2, h / 2 + 1, 1.4, '#3a3020');
        pen.line([[w / 2 - 8, h / 2 - 5], [w / 2 - 2, h / 2 + 2], [w / 2 + 6, h / 2 + 8]], '#8a8878', 1.2, false);
        pen.line([[w / 2 + 2, h / 2 - 8], [w / 2 - 1, h / 2 + 1]], '#8a8878', 1, false);
        pen.rect(w / 2 - 2, 2, 4, 4, '#c9a44c');
      }
    },
    tape: {
      name: '预录母带', short: '母带', kind: 'evi',
      sub: '案发当日 20:00 录制',
      desc: '在录音室 B 的磁带机里发现的盒带。标签写着「[r]8/19 深夜迷航 · 完成尺[/]」，录制时间是当日晚上 8 点。',
      draw: function (pen, w, h) {
        pen.rrect(3, 4, w - 6, h - 8, 2, '#2b3040');
        pen.rrect(5, 6, w - 10, h - 12, 1, '#454d60');
        pen.rect(7, 8, w - 14, 7, '#e8e2cc');
        lines(pen, 9, 10, 2, w - 18, '#6a6250', 3);
        pen.circle(w / 2 - 8, h / 2 + 4, 5, '#1a1e2a');
        pen.circle(w / 2 - 8, h / 2 + 4, 2.6, '#7a8298');
        pen.circle(w / 2 + 8, h / 2 + 4, 5, '#1a1e2a');
        pen.circle(w / 2 + 8, h / 2 + 4, 2.6, '#7a8298');
        pen.rect(w / 2 - 8, h / 2 + 2.4, 16, 3.2, '#161a24');
      }
    },
    schedule: {
      name: '节目编成表', short: '节目表', kind: 'evi',
      sub: '星屑电台',
      desc: '「音无响的深夜迷航」播出时段为[b]22:30 ～ 23:30[/]。备注栏写着「全程现场直播」。',
      draw: function (pen, w, h) {
        paper(pen, w, h, '#efe7cf');
        pen.rect(6, 5, w - 12, 3, '#3f5db0');
        for (var i = 0; i < 4; i++) {
          pen.rect(6, 11 + i * 5, 12, 3, '#9aa4c4');
          pen.rect(21, 11 + i * 5, w - 27, 3, i === 1 ? '#c8a04a' : '#c8c2a8');
        }
      }
    },
    keylog: {
      name: '门禁记录', short: '门禁记录', kind: 'evi',
      sub: '录音室 B',
      desc: '录音室 B 的电子门禁记录。[r]22:16 黑岩龙三[/] / 23:00 白鸟花音 / 23:25 制作组三名。',
      draw: function (pen, w, h) {
        paper(pen, w, h, '#e6ecf0');
        pen.rect(5, 4, w - 10, 3, '#2c3a58');
        for (var i = 0; i < 5; i++) {
          pen.rect(6, 10 + i * 4, 9, 2, i === 0 ? '#c8343e' : '#7a8498');
          pen.rect(18, 10 + i * 4, w - 24, 2, i === 0 ? '#e05460' : '#aab2c0');
        }
      }
    },
    memo: {
      name: '音无的便条', short: '便条', kind: 'evi',
      sub: '掉在桌下',
      desc: '被害人的字迹：「今晚就在节目里全说出来。[r]赞助费的去向[/]，还有那个人的名字。」',
      draw: function (pen, w, h) {
        pen.rrect(5, 3, w - 10, h - 6, 1, '#f4e9b8');
        pen.poly([[w - 12, 3], [w - 5, 3], [w - 5, 10]], '#d8ca92');
        lines(pen, 9, 9, 4, w - 20, '#5c5238', 4);
        pen.rect(9, 25, 14, 1.6, '#b03a44');
      }
    },
    curtain: {
      name: '遮光帘的证词', short: '遮光帘', kind: 'evi',
      sub: '技术组的说明',
      desc: '调音室与录音室之间的遮光帘。技术组证实：[b]案发当晚它是拉下的[/]，而且只能从[r]录音室内侧[/]操作。',
      draw: function (pen, w, h) {
        pen.rect(4, 4, w - 8, h - 8, '#2b3352');
        for (var i = 0; i < 7; i++) {
          pen.rect(5 + i * 6, 5, 3, h - 10, i % 2 ? '#4a5578' : '#38415e');
        }
        pen.rect(4, 4, w - 8, 3, '#8b93a8');
        pen.rect(4, 6, w - 8, 1, '#5d6478');
      }
    },
    /* ---- 人物档案 ---- */
    p_kanon: {
      name: '白鸟 花音', short: '花音', kind: 'pro', char: 'kanon', pose: 'sad',
      sub: '19 岁 · 声优',
      desc: '本案被告。见习声优，当晚作为嘉宾前往电台。「我只是……去录节目而已。」'
    },
    p_hibiki: {
      name: '音无 响', short: '音无', kind: 'pro', char: 'hibiki', pose: 'normal',
      sub: '28 岁 · 电台主播',
      desc: '本案被害人。深夜节目「深夜迷航」的主播，声音是他的全部。'
    },
    p_kuroiwa: {
      name: '黑岩 龙三', short: '黑岩', kind: 'pro', char: 'kuroiwa', pose: 'smug',
      sub: '51 岁 · 节目制作人',
      desc: '「深夜迷航」的制作人。案发当晚待在调音室。总戴着墨镜，笑得很响。'
    },
    p_itonokogiri: {
      name: '糸锯 圭介', short: '糸锯', kind: 'pro', char: 'itonokogiri', pose: 'salute',
      sub: '刑警',
      desc: '负责本案的刑警。人很好，就是常常帮了倒忙。'
    },
    p_mitsurugi: {
      name: '御剑 怜侍', short: '御剑', kind: 'pro', char: 'mitsurugi', pose: 'arms',
      sub: '检察官',
      desc: '天才检察官。冷静、精准，从不接受「大概」这个词。'
    },
    p_mayoi: {
      name: '绫里 真宵', short: '真宵', kind: 'pro', char: 'mayoi', pose: 'happy',
      sub: '17 岁 · 灵媒见习',
      desc: '成步堂的助手。虽然总在吃汉堡，关键时刻却出乎意料地可靠。'
    }
  };

  /* ============================================================
     便捷构造
     ============================================================ */
  function say(who, pose, text, o) { return Object.assign({ t: 'say', who: who, pose: pose, text: text }, o || {}); }
  function nar(text) { return { t: 'nar', text: text }; }
  function think(text, pose) { return { t: 'think', who: 'naruhodo', pose: pose, text: text }; }
  var N = 'naruhodo', MY = 'mayoi', J = 'judge', E = 'mitsurugi', G = 'itonokogiri', K = 'kuroiwa', KN = 'kanon';

  /* ============================================================
     证言 1 — 糸锯圭介「事件的概要」
     ============================================================ */
  var T1 = {
    who: G,
    title: '证 人 的 证 言',
    crossTitle: '交 叉 询 问',
    hudTitle: '第 1 天 · 审判',
    bgm: 'testimony', crossBgm: 'crossExam',
    intro: [
      say(J, 'normal', '证人，请陈述你所知道的事件概要。'),
      say(G, 'salute', '是！交给我吧长官！'),
      say(E, 'smug', '……糸锯刑警。这里不是警局。')
    ],
    statements: [
      {
        text: '被害人是音无响先生。星屑电台深夜节目的主播。',
        pose: 'normal',
        press: [
          say(N, 'normal', '他是个很有名的主播吗？'),
          say(G, 'happy', '那当然！我每周都听的！那个声音啊，简直——'),
          say(E, 'arms', '……刑警的私人爱好与本案无关。'),
          say(G, 'sweat', '呜……')
        ]
      },
      {
        text: '遗体是在电台的录音室 B 里被发现的。发现者……就是被告人。',
        pose: 'normal',
        press: [
          say(N, 'normal', '被告人是发现者？'),
          say(G, 'normal', '是的。她当晚是节目的嘉宾，11点整进入录音室 B。'),
          say(N, 'think', '（也就是说，她进去的时候，音无先生已经……？）'),
          say(G, 'confused', '不对不对，那个时候音无先生还在直播呢！'),
          say(N, 'shock', '什……么？')
        ],
        present: {
          p_kanon: {
            correct: false, penalty: 0,
            script: [
              say(N, 'normal', '这位就是被告人，白鸟花音小姐。'),
              say(G, 'normal', '没错，就是她。……不过这算不上矛盾吧，长官。')
            ]
          }
        }
      },
      {
        text: '凶器是那个铜制的麦克风支架。上面清清楚楚地留着被告人的指纹！',
        pose: 'point',
        press: [
          say(N, 'normal', '只有被告人的指纹吗？'),
          say(G, 'sweat', '呃……其他的都被擦掉了……'),
          say(N, 'confident', '被[r]擦掉[/]了？'),
          say(G, 'confused', '嗯……只有底座那一圈，擦得特别干净。'),
          think('（一个惊慌失措的女孩，会记得擦掉指纹、却留下自己的吗？）'),
          say(E, 'smug', '慌乱之中擦拭不彻底，这很常见。')
        ],
        present: {
          stand: {
            correct: false, penalty: 0,
            script: [
              say(N, 'normal', '就是这个支架吧。'),
              say(G, 'salute', '正是！沉得要命，我搬的时候差点砸到脚。')
            ]
          }
        }
      },
      {
        text: '死亡时间是[r]晚上 11 点 20 分[/]。因为那个时候——直播里传出了被害人的惨叫！',
        pose: 'normal',
        press: [
          say(N, 'normal', '惨叫……是在广播里？'),
          say(G, 'normal', '是啊！全城的听众都听到了！「呜哇啊——」这样。'),
          say(MY, 'surprised', '好可怕……'),
          say(G, 'normal', '11点25分，制作组冲进录音室，看到被告人拿着凶器站在遗体旁边。'),
          think('（惨叫、时间、目击……看起来天衣无缝。）'),
          think('（可是……[r]死亡时间[/]这一点，我手上有份东西。）')
        ],
        present: {
          autopsy: {
            correct: true,
            script: [
              say(N, 'slam', '证人！你说死亡时间是 11 点 20 分——'),
              say(N, 'objection', '那么，[r]这份尸检报告[/]又该怎么解释！？'),
              { t: 'sfx', name: 'murmur' },
              say(J, 'surprise', '肃静！……辩护人，请说明。'),
              say(N, 'confident', '报告上写着：死亡推定时刻为[r]晚上 10 点到 10 点 40 分[/]之间。'),
              say(N, 'confident', '比那声惨叫，[r]早了整整四十分钟以上[/]！'),
              { t: 'sfx', name: 'gasp' },
              say(G, 'shock', '呜哇啊！？那、那份报告我明明——'),
              say(E, 'shock', '……！'),
              say(J, 'surprise', '这、这是怎么回事，检察官！？')
            ]
          },
          watch: {
            correct: false, penalty: 1,
            script: [
              say(N, 'confident', '被害人的怀表停在 10 点 18 分——'),
              say(E, 'objection', '[r]异议[/]！'),
              say(E, 'smug', '一块碎表能证明什么？表可以事先砸坏，也可以事后拨动。'),
              say(E, 'point', '在没有其他根据之前，那只是一块[r]坏掉的表[/]。'),
              say(J, 'angry', '……辩护人，请提出更有分量的东西。')
            ]
          },
          schedule: {
            correct: false, penalty: 1,
            script: [
              say(N, 'normal', '节目的播出时段是 22:30 到 23:30——'),
              say(E, 'arms', '所以呢？11 点 20 分正在这个时段之内。'),
              say(E, 'smug', '辩护人，你刚刚亲手替我加固了证词。'),
              say(J, 'angry', '真是白费工夫。')
            ]
          }
        }
      },
      {
        text: '总之，那段时间里，除了被告人以外，没有任何人进出过录音室 B！',
        pose: 'normal',
        press: [
          say(N, 'normal', '这是怎么确认的？'),
          say(G, 'normal', '制作人黑岩先生说，他一直在门口附近。'),
          say(N, 'think', '（黑岩……制作人。）'),
          say(G, 'happy', '而且门禁记录也调出来了！我这就交给辩护人！'),
          { t: 'evidence', id: 'keylog' },
          say(MY, 'happy', '哇，糸锯刑警真好人！'),
          say(E, 'angry', '……糸锯刑警。你的薪水又要减半了。'),
          say(G, 'sad', '呜、呜哇——')
        ]
      }
    ],
    afterAll: [
      say(MY, 'worried', '成步堂，绕了一圈了哦。'),
      think('（矛盾一定在某一句里。……[r]时间[/]。我总觉得，问题在时间上。）')
    ],
    wrongPresent: [
      say(N, 'normal', '请看这个！'),
      say(E, 'objection', '[r]异议[/]！'),
      say(E, 'smug', '……这份东西与刚才的证词之间，[r]没有任何矛盾[/]。'),
      say(E, 'point', '辩护人，法庭不是让你练习翻找口袋的地方。'),
      say(J, 'angry', '辩护人，请谨慎行事。')
    ],
    onSolved: [{ t: 'set', flag: 't1done' }]
  };

  /* ---- 第三阶段证言：最后的谎 ---- */
  var T2_S3 = [
    {
      text: '好吧，帘子是拉下来的。但我从[b]监听喇叭[/]里听得清清楚楚！',
      pose: 'sweat',
      press: [
        say(N, 'normal', '也就是说，你其实什么也没有「看见」。'),
        say(K, 'panic', '……听见就够了吧！声音就是证据！'),
        say(N, 'confident', '声音——如果那声音来自[r]一卷带子[/]呢？'),
        say(K, 'sweat', '呜……')
      ]
    },
    {
      text: '音无的声音、被告人的声音，全都是从喇叭里传出来的。',
      pose: 'normal',
      press: [
        say(N, 'normal', '被告人的声音，你也听到了？'),
        say(K, 'panic', '……啊。呃。听、听到了！她在喊「老师、老师」！'),
        { t: 'sfx', name: 'sting' },
        say(N, 'shock', '……'),
        say(N, 'confident', '可是审判长——被告人的声音，'),
        say(N, 'slam', '[r]从来没有出现在那晚的播出内容里[/]。'),
        say(J, 'surprise', '什、什么！？'),
        say(N, 'confident', '因为那卷带子，是晚上 8 点录的。'),
        say(N, 'confident', '录的时候，被告人还没有到电台。'),
        say(K, 'panic', '呜……哇啊……'),
        think('（露出来了。他把「带子里的声音」和「现场的声音」混成了一团。）')
      ]
    },
    {
      text: '11 点 20 分，我听到惨叫。我冲进去。我看到了那个女孩。这些都是真的！',
      pose: 'point',
      press: [
        say(N, 'normal', '你冲进去，用了多久？'),
        say(K, 'normal', '几秒！最多十秒！'),
        say(N, 'confident', '从调音室到录音室 B，要绕过整条走廊。'),
        say(N, 'confident', '警方实测——[r]最快也要二十八秒[/]。'),
        say(K, 'sweat', '那、那我记错了！人紧张的时候……'),
        think('（不是记错。是因为他[r]早就知道[/]那一刻会发生什么。）')
      ]
    },
    {
      text: '但是我，[r]一次也没有踏进过那间录音室[/]！这一点我可以对天发誓！',
      pose: 'smug',
      press: [
        say(N, 'normal', '一次也没有？'),
        say(K, 'smug', '一次也没有。我拿我这三十年的招牌保证。'),
        { t: 'sfx', name: 'sting' },
        think('（——拿到了。）'),
        think('（这句话，是你自己给自己上的锁。）')
      ],
      present: {
        keylog: {
          correct: true,
          script: [
            say(N, 'slam', '「一次也没有踏进过」——'),
            say(N, 'objection', '这句话，[r]被门禁记录亲手推翻了！[/]'),
            { t: 'fx', name: 'shockBg', args: [1.1] },
            { t: 'sfx', name: 'murmur' },
            say(N, 'confident', '录音室 B 的电子门禁，记录着三条入室数据。'),
            say(N, 'confident', '23:00 白鸟花音。23:25 制作组三人。'),
            say(N, 'slam', '以及——[r]22:16，黑岩 龙三[/]！'),
            { t: 'sfx', name: 'gasp' },
            say(K, 'shock', '呜、呜哇啊啊——！？'),
            say(J, 'surprise', '22 点 16 分！？那是[r]节目开始之前[/]啊！'),
            say(N, 'confident', '而被害人的怀表，停在[r]22 点 18 分[/]。'),
            say(N, 'confident', '证人进入录音室的，[r]两分钟之后[/]。'),
            { t: 'cam', name: 'prosecution', dur: .4 },
            say(E, 'shock', '……两分钟。'),
            { t: 'cam', name: 'defense', dur: .4 },
            say(N, 'slam', '尸检报告说他死于 10 点到 10 点 40 分之间。'),
            say(N, 'slam', '怀表说他在 10 点 18 分停止了呼吸。'),
            say(N, 'slam', '门禁说，那一刻房间里只有一个人——'),
            { t: 'bubble', kind: 'objection', who: N, pose: 'objection' },
            say(N, 'objection', '就是[r]你[/]，黑岩龙三！'),
            { t: 'sfx', name: 'shock' },
            { t: 'fx', name: 'shake', args: [8, .8] },
            { t: 'cam', name: 'witness', dur: .35 },
            say(K, 'panic', '不、不对！我是……我是去送台本的！'),
            say(N, 'confident', '送台本，顺手拉下了遮光帘，是吗？'),
            say(N, 'confident', '你不但进去过——你还从里面，把玻璃遮住了。'),
            say(N, 'slam', '为的是让别人相信，「调音室里的你」一直看着一个[r]已经倒下的人[/]。'),
            { t: 'sfx', name: 'murmur' },
            say(K, 'shock', '……'),
            say(N, 'confident', '10 点半，你按下了母带的播放键。'),
            say(N, 'confident', '于是全城的听众，都听见了一个死去的人，在夜里说话。'),
            say(N, 'confident', '11 点 20 分那声惨叫，也在带子里。'),
            say(N, 'confident', '你只要在那一刻「冲进去」，就成了第一个发现者——'),
            say(N, 'slam', '一个把[r]死亡时间整整推迟了一小时[/]的完美不在场证明！'),
            { t: 'bgmStop', fade: .3 },
            { t: 'wait', dur: .6 },
            say(K, 'breakdown', '……啊……啊啊……'),
            { t: 'sfx', name: 'breakdown' },
            { t: 'fx', name: 'shake', args: [9, 1.6, 40] },
            { t: 'fx', name: 'shockBg', args: [1.6] },
            say(K, 'breakdown', '那家伙……那家伙说要在节目里全说出来啊！！'),
            say(K, 'breakdown', '赞助费！我拿的那些！三十年！我做了三十年的节目！'),
            say(K, 'breakdown', '就为了几句话，就要把我三十年——全部——'),
            { t: 'sfx', name: 'thunder' },
            { t: 'wait', dur: .5 },
            say(K, 'breakdown', '……那声惨叫，是我让他喊的。'),
            say(K, 'sad', '录音的时候我跟他说：来，最后一段，喊得像样一点。'),
            say(K, 'sad', '他喊得真好啊……那可是，全日本最好的声音。'),
            { t: 'wait', dur: .8 },
            { t: 'set', flag: 't2done' }
          ]
        },
        watch: {
          correct: false, penalty: 1,
          script: [
            say(N, 'confident', '被害人的怀表停在 10 点 18 分！'),
            say(E, 'objection', '[r]异议[/]！'),
            say(E, 'point', '一块表，如何证明「谁进过那个房间」？'),
            say(J, 'angry', '辩护人，你需要的是[r]人[/]的记录，而不是[r]物[/]的记录。')
          ]
        }
      }
    }
  ];

  /* ---- 第二阶段证言：改口之后 ---- */
  var T2_S2 = [
    {
      text: '我承认，那卷带子是[b]备用带[/]。但那天晚上，节目确实是直播的！',
      pose: 'sweat',
      press: [
        say(N, 'normal', '备用带为什么会在磁带机里？'),
        say(K, 'sweat', '当、当然是提前放进去待命啊！'),
        say(N, 'confident', '待命的带子，需要按下[r]播放键[/]吗？'),
        say(K, 'panic', '呜……！')
      ]
    },
    {
      text: '我一直在调音室里，[b]隔着玻璃看着音无[/]。所以我知道他一直活着。',
      pose: 'normal',
      press: [
        say(N, 'normal', '那面玻璃，能看清录音室里的一切？'),
        say(K, 'smug', '一清二楚。连他手上的台本翻到第几页都看得见。'),
        say(N, 'confident', '连台本第几页都看得见。'),
        say(N, 'confident', '……请你再说一次。你[r]看见了[/]。'),
        say(K, 'normal', '我看见了。整整一小时。'),
        { t: 'sfx', name: 'sting' },
        think('（好。这句话，我要了。）')
      ],
      present: {
        curtain: {
          correct: true,
          nextTitle: '新 的 证 言',
          next: T2_S3,
          script: [
            say(N, 'slam', '你「隔着玻璃看了整整一小时」——'),
            say(N, 'objection', '可是那面玻璃上，[r]挂着拉下来的遮光帘[/]！'),
            { t: 'sfx', name: 'murmur' },
            say(N, 'confident', '技术组的书面说明在此。'),
            say(N, 'confident', '案发当晚，遮光帘是[r]拉下[/]状态。'),
            say(N, 'slam', '而且它只能从[r]录音室内侧[/]操作！'),
            say(J, 'surprise', '也、也就是说——'),
            say(N, 'confident', '调音室里的证人，[r]什么都看不见[/]。'),
            { t: 'sfx', name: 'gasp' },
            say(K, 'panic', '呜哇……！'),
            { t: 'cam', name: 'prosecution', dur: .4 },
            say(E, 'sweat', '……证人。请你解释。'),
            { t: 'cam', name: 'witness', dur: .4 },
            say(K, 'sweat', '……帘、帘子。是啊，帘子。'),
            say(K, 'panic', '我、我想起来了！那天帘子是拉下的！'),
            say(N, 'confident', '那你刚才「看见的一小时」，是什么？'),
            say(K, 'panic', '呜……'),
            say(J, 'angry', '证人！本庭要求你[r]重新作证[/]！'),
            say(K, 'sweat', '……知、知道了。')
          ]
        },
        photo: {
          correct: false, penalty: 1,
          script: [
            say(N, 'confident', '照片上，遮光帘是拉下来的！'),
            say(E, 'objection', '[r]异议[/]！'),
            say(E, 'point', '这张照片摄于[r]案发之后[/]。帘子完全可能是事后被碰到的。'),
            say(E, 'smug', '成步堂君，你需要的是能说明「[r]当时[/]」的东西。'),
            say(J, 'angry', '……辩护人，请再想想。')
          ]
        }
      }
    },
    {
      text: '11 点整，被告人走进了录音室 B。这我看得很清楚。',
      pose: 'normal',
      press: [
        say(N, 'normal', '你确定是 11 点整？'),
        say(K, 'smug', '门禁记录上写着呢，自己去查啊。'),
        say(N, 'normal', '那么在那之后呢？'),
        say(K, 'normal', '我一直守在调音室，[r]一步也没有离开[/]。直到听见惨叫。'),
        { t: 'sfx', name: 'ding' }
      ],
      add: [
        { text: '从 10 点半节目开始，到 11 点 20 分惨叫为止，我[r]一步都没离开调音室[/]。', pose: 'smug' }
      ]
    },
    {
      text: '11 点 20 分我听到惨叫，立刻冲进去——她就拿着凶器站在那里。',
      pose: 'point',
      press: [
        say(N, 'normal', '被害人的伤在哪里？'),
        say(K, 'normal', '脑袋后面。血流了一地。'),
        think('（背后。……他背对着凶手，毫无防备。）')
      ]
    }
  ];

  /* ============================================================
     证言 2 — 黑岩龙三「那一晚的直播」（三阶段）
     ============================================================ */
  var T2 = {
    who: K,
    title: '证 人 的 证 言',
    crossTitle: '交 叉 询 问',
    bgm: 'testimony', crossBgm: 'crossExam',
    intro: [
      say(J, 'normal', '证人，请说明当晚的情况。'),
      say(K, 'laugh', '哈哈，没问题！这种事我最清楚了——毕竟节目是我做的嘛！')
    ],
    statements: [
      {
        text: '那天晚上的节目，从 10 点半到 11 点半，[r]全程都是现场直播[/]。',
        pose: 'smug',
        press: [
          say(N, 'normal', '完全没有预录的部分？'),
          say(K, 'smug', '一秒都没有。「深夜迷航」的招牌就是[r]全部现场[/]，这是音无自己定的规矩。'),
          say(MY, 'think', '真是个讲究的人……'),
          think('（全程直播。也就是说，11 点 20 分的惨叫，是[r]真实发生[/]的声音。）'),
          think('（——除非，那天晚上的电波里，根本不是「现场」。）')
        ],
        present: {
          tape: {
            correct: true,
            nextTitle: '改 口 的 证 言',
            next: T2_S2,
            script: [
              say(N, 'slam', '「全程现场直播」——真的是这样吗？'),
              say(N, 'objection', '那么请你解释，[r]这卷母带[/]是什么！'),
              { t: 'sfx', name: 'murmur' },
              say(N, 'confident', '这是从录音室 B 的磁带机里取出的盒带。'),
              say(N, 'confident', '标签上写着：「8月19日 深夜迷航 · [r]完成尺[/]」——'),
              say(N, 'slam', '录制时间，[r]当晚晚上 8 点[/]！'),
              { t: 'sfx', name: 'gasp' },
              say(K, 'panic', '唔……！？'),
              say(J, 'surprise', '当、当晚 8 点就已经录好了！？'),
              say(N, 'confident', '也就是说——那天晚上从电波里传出来的声音，'),
              say(N, 'objection', '[r]根本不是现场直播！[/]'),
              { t: 'sfx', name: 'murmur' },
              { t: 'cam', name: 'prosecution', dur: .4 },
              say(E, 'shock', '……什么？'),
              { t: 'cam', name: 'witness', dur: .4 },
              say(K, 'sweat', '等、等一下！那只是[r]备用带[/]！'),
              say(K, 'smug', '直播万一出事故就得有东西垫着，这是常识吧！'),
              say(J, 'confused', '唔……听起来倒也说得通。'),
              think('（他改口了。但这一步，他已经退了。）'),
              say(J, 'normal', '证人。请你[r]重新作证[/]。'),
              say(K, 'sweat', '……哼。好啊。')
            ]
          },
          schedule: {
            correct: false, penalty: 1,
            script: [
              say(N, 'normal', '节目编成表上写着「全程现场直播」——'),
              say(E, 'objection', '[r]异议[/]！'),
              say(E, 'smug', '这不正好[r]支持[/]了证人的证词吗？'),
              say(E, 'point', '辩护人，你是来替我举证的吗？'),
              say(J, 'angry', '真是荒唐。')
            ]
          }
        }
      },
      {
        text: '我一直待在隔着玻璃的调音室里，看着音无进行直播。',
        pose: 'normal',
        press: [
          say(N, 'normal', '隔着玻璃……你能听到录音室里的声音吗？'),
          say(K, 'smug', '那面玻璃是全隔音的。声音只能从[r]监听喇叭[/]里听。'),
          think('（隔音玻璃。所以他听到的一切，都是从[r]电波[/]里来的。）'),
          say(MY, 'surprised', '那……那声惨叫也是从喇叭里？'),
          say(K, 'laugh', '当然啦，小姑娘。哈哈哈！')
        ]
      },
      {
        text: '11 点整，被告人走进了录音室 B。这我看得很清楚。',
        pose: 'normal',
        press: [
          say(N, 'normal', '你确定是 11 点整？'),
          say(K, 'smug', '门禁记录上写着呢，去查啊。'),
          say(N, 'normal', '那么，在那之后呢？'),
          say(K, 'normal', '我就一直守在调音室，一步也没离开。直到听见惨叫。')
        ]
      },
      {
        text: '11 点 20 分，我听到了惨叫，立刻冲进录音室——她就拿着凶器站在那里。',
        pose: 'point',
        press: [
          say(N, 'normal', '你冲进去的时候，看到了什么？'),
          say(K, 'normal', '音无倒在桌子前面，脑袋后面全是血。还有那个女孩。'),
          think('（脑袋[r]后面[/]……被害人是被从背后袭击的。）')
        ]
      },
      {
        text: '会杀他的只有那个女孩。整个录音室里，[r]只有他们两个人[/]。',
        pose: 'smug',
        press: [
          say(N, 'normal', '你怎么能确定「只有两个人」？'),
          say(K, 'laugh', '因为我在看着啊！从头到尾！'),
          think('（「我在看着」。……这个人，一直在重复同一句话。）'),
          think('（重复得太用力的东西，往往是[r]最脆的[/]。）')
        ]
      }
    ],
    afterAll: [
      say(MY, 'worried', '成步堂，他的话里有个地方特别硬。'),
      say(MY, 'think', '硬得像是[r]事先准备好的[/]。'),
      think('（「全程现场直播」……他为什么非要强调这一点？）'),
      think('（因为——只要那是直播，死亡时间就必须是 11 点 20 分。）')
    ],
    wrongPresent: [
      say(N, 'normal', '请看这个！'),
      say(E, 'objection', '[r]异议[/]！'),
      say(E, 'smug', '毫无关联。辩护人，你是在祈祷奇迹吗？'),
      say(J, 'angry', '辩护人，这已经是第几次了。')
    ],
    onSolved: []
  };


  /* ============================================================
     调查：录音室
     ============================================================ */
  var STUDIO = {
    location: 'studio', cam: 'main',
    title: '深夜电台 · 录音室 B',
    bgm: 'midnight',
    hint: '仔细调查现场，找出能推翻「11点20分」的东西',
    examine: [
      {
        name: '播音桌与遗体位置', cam: 'body', flag: 'ex_body',
        script: [
          nar('播音桌前的地面上，用胶带标出了人形的轮廓。'),
          think('（音无先生……就倒在这里。）'),
          say(G, 'normal', '头部后方受到重击。一击致命，长官。'),
          say(N, 'think', '后方……也就是说，他是[r]背对着凶手[/]的？'),
          say(G, 'salute', '正是！所以警方推断，凶手是被害人熟悉的人——'),
          say(G, 'sweat', '呃，或者说，是他不设防的人。'),
          think('（一个进来录节目的见习声优，会让他不设防吗……）'),
          say(N, 'normal', '糸锯刑警，尸检报告能给我看一下吗？'),
          say(G, 'happy', '当然！拿去吧！'),
          { t: 'evidence', id: 'autopsy' },
          say(N, 'shock', '……等等。这上面写的死亡时间是——'),
          say(N, 'shock', '[r]晚上 10 点到 10 点 40 分[/]！？'),
          say(G, 'confused', '啊，那个数字啊。检察官说是「误差」，让我别在意。'),
          say(MY, 'angry', '别在意！？这可差了快一个小时啊！'),
          think('（御剑……你把这份报告压下去了吗。）')
        ]
      },
      {
        name: '倒下的椅子附近', cam: 'chair', flag: 'ex_chair',
        script: [
          nar('椅子翻倒在地。旁边散落着几片金色的碎屑。'),
          say(MY, 'surprised', '成步堂，这个！'),
          nar('是一块怀表。表面碎裂，指针停住了。'),
          say(N, 'shock', '指针停在……[r]10 点 18 分[/]。'),
          say(G, 'normal', '哦，那是被害人的东西。听说是他前辈留给他的。'),
          say(N, 'confident', '碎裂的怀表，停止的指针。……糸锯刑警，我要这个。'),
          { t: 'evidence', id: 'watch' },
          say(MY, 'happy', '10点18分！和尸检报告对得上啊！'),
          think('（可惜，一块表说服不了法庭。……还需要别的东西。）')
        ]
      },
      {
        name: '磁带机', cam: 'tape', flag: 'ex_tape',
        script: [
          nar('播音桌旁的磁带机。仓门半开着，里面还卡着一卷盒带。'),
          say(N, 'think', '还有带子留在里面……'),
          nar('标签上写着——「8/19 深夜迷航 · 完成尺」。'),
          say(N, 'shock', '「完成尺」……？这不是空白带，是[r]已经录好的完整节目[/]！'),
          say(G, 'confused', '啊？可是那天是现场直播啊。'),
          say(N, 'confident', '而且你看录制时间戳：[r]当日 20:00[/]。'),
          say(MY, 'shock', '晚上8点就录完了……那10点半播出去的是什么？'),
          think('（如果那天晚上的「直播」，其实是这卷带子……）'),
          think('（那么惨叫的时刻，就完全不能当作死亡时刻了。）'),
          { t: 'evidence', id: 'tape' },
          { t: 'sfx', name: 'realize' },
          { t: 'set', flag: 'gotTape' }
        ]
      },
      {
        name: '调音室的玻璃窗', cam: 'mixer', flag: 'ex_glass',
        script: [
          nar('录音室与调音室之间，隔着一面大玻璃。'),
          nar('玻璃内侧装着厚重的遮光帘，此刻收在一侧。'),
          say(N, 'normal', '这道帘子，能从调音室那边操作吗？'),
          say(G, 'normal', '技术组说不行。[r]只能从录音室这一侧[/]拉。'),
          say(N, 'think', '（只能从里面……）'),
          say(G, 'salute', '而且他们说，案发当晚，这帘子是[r]拉下来的[/]！'),
          say(N, 'shock', '拉下来的！？'),
          say(MY, 'think', '那调音室里的人，就什么都看不见了吧？'),
          say(N, 'confident', '……糸锯刑警，麻烦你把技术组的说明写成书面。'),
          say(G, 'happy', '收到！'),
          { t: 'evidence', id: 'curtain' },
          { t: 'set', flag: 'gotCurtain' }
        ]
      },
      {
        name: '吸音棉墙面', cam: 'foam', flag: 'ex_foam',
        script: [
          nar('墙上贴满了楔形的吸音棉，一格一格，像巨大的鳞片。'),
          say(MY, 'happy', '摸起来好舒服！'),
          say(N, 'normal', '别玩了……不过，这房间的隔音真的很好。'),
          say(N, 'think', '（在里面喊得再大声，外面也听不见。）'),
          think('（反过来说——外面的人，只能通过[r]电波[/]知道里面发生了什么。）')
        ]
      },
      {
        name: '播音桌下方', cam: 'desk', flag: 'ex_desk',
        script: [
          nar('桌子底下，卡着一张被踩过的小纸片。'),
          say(N, 'read', '「今晚就在节目里全说出来。赞助费的去向，还有那个人的名字。」'),
          say(MY, 'shock', '赞助费……？'),
          say(N, 'think', '（这是音无先生的字。他打算在节目里揭发什么人。）'),
          think('（如果有人不想让他说出来……那就是[r]动机[/]。）'),
          { t: 'evidence', id: 'memo' },
          { t: 'set', flag: 'gotMemo' }
        ]
      }
    ],
    talk: [
      {
        name: '关于凶器', flag: 'tk_weapon',
        script: [
          say(G, 'normal', '凶器是铜制麦克风支架。底座上有血。'),
          say(G, 'sweat', '不过奇怪的是，底座那一圈被[r]擦得很干净[/]……'),
          say(N, 'confident', '擦干净了，却留下了被告人的指纹？'),
          say(G, 'confused', '呃……这么一说，好像不太对头？'),
          { t: 'evidence', id: 'stand' }
        ]
      },
      {
        name: '关于节目', flag: 'tk_show',
        script: [
          say(G, 'normal', '「音无响的深夜迷航」，每周五 22:30 到 23:30。'),
          say(G, 'salute', '节目编成表在这里！全程现场直播——上面是这么写的。'),
          { t: 'evidence', id: 'schedule' },
          say(N, 'think', '（现场直播……写在纸上的东西，可不一定是真的。）')
        ]
      },
      {
        name: '关于当晚的人', flag: 'tk_people',
        script: [
          say(N, 'normal', '当晚在电台的，还有谁？'),
          say(G, 'normal', '制作人黑岩龙三先生，加上制作组三个人。'),
          say(G, 'normal', '黑岩先生说，他从节目开始一直在调音室里。'),
          say(N, 'normal', '一直？'),
          say(G, 'salute', '一步也没离开——他反复强调了三次！'),
          say(N, 'think', '（反复强调三次……）'),
          { t: 'evidence', id: 'p_kuroiwa' }
        ]
      },
      {
        name: '关于现场照片', flag: 'tk_photo',
        script: [
          say(N, 'normal', '现场照片能给我一份吗？'),
          say(G, 'happy', '当然！警方的照片，拍得可漂亮呢！'),
          { t: 'evidence', id: 'photo' },
          say(MY, 'think', '……成步堂，照片上的帘子是拉下来的哦。'),
          say(N, 'normal', '嗯。可这是[r]案发之后[/]拍的。'),
          say(N, 'sweat', '御剑一定会用这一点反驳我。')
        ]
      }
    ],
    present: {
      autopsy: {
        script: [
          say(N, 'confident', '糸锯刑警，这份报告的死亡时间——'),
          say(G, 'sweat', '呜……检察官说那是仪器误差……'),
          say(N, 'confident', '四十分钟的「误差」？'),
          say(G, 'sad', '呜哇——别用那种眼神看我啊长官！')
        ]
      },
      tape: {
        script: [
          say(N, 'confident', '这卷带子，请让警方鉴定一下内容。'),
          say(G, 'salute', '明白！我一定亲自送去！'),
          say(MY, 'happy', '糸锯刑警，加油！')
        ]
      },
      badge: {
        script: [
          say(G, 'happy', '哦！辩护士徽章！亮闪闪的！'),
          say(MY, 'cheer', '成步堂可是很厉害的律师哦！'),
          say(N, 'sweat', '……真宵，别乱说。')
        ]
      }
    },
    presentWrong: [
      say(G, 'confused', '呃……这个东西，跟案子有关系吗，长官？'),
      say(N, 'sweat', '（好像问错人了。）')
    ],
    move: [
      {
        name: '前往地方法院（准备开庭）',
        to: 'lobby',
        enabled: function (G) { return !!(G.flags.gotTape && G.flags.ex_body && G.flags.gotCurtain); },
        script: []
      }
    ]
  };

  /* ============================================================
     主剧本
     ============================================================ */
  C1.script = [
    /* ---------------- 序章 ---------------- */
    { t: 'phase', title: '第 1 话', phase: '逆转的深夜电波' },
    { t: 'scene', name: 'detention', cam: 'main' },
    { t: 'bgm', name: 'sad', fadeIn: 1.2 },
    { t: 'fade', dir: 'in', dur: 1.0 },
    nar('8 月 20 日 ・ 上午 ・ 拘留所 会面室'),
    { t: 'wait', dur: .3 },
    nar('隔着一层玻璃和一排铁栏，女孩坐在那里，双手放在膝上。'),
    { t: 'cast', witness: KN },
    say(KN, 'sad', '……对不起。'),
    say(KN, 'sad', '把您叫来这种地方。'),
    say(N, 'normal', '我是辩护律师，成步堂龙一。请多指教，白鸟小姐。', { label: '成步堂' }),
    { t: 'evidence', id: 'p_kanon', silent: true },
    { t: 'evidence', id: 'badge', silent: true },
    { t: 'evidence', id: 'p_mayoi', silent: true },
    say(MY, 'happy', '我是助手绫里真宵！花音小姐，你的事我们都听说了！'),
    say(KN, 'surprised', '……你们，相信我吗？'),
    { t: 'wait', dur: .4 },
    say(N, 'confident', '我相信我的委托人。这是我唯一的规矩。'),
    { t: 'sfx', name: 'ding' },
    say(KN, 'cry', '……呜……'),
    say(KN, 'cry', '对不起……我，我一直，一直都在说，不是我……'),
    say(KN, 'cry', '可是没有人听……'),
    say(MY, 'worried', '花音小姐……'),
    { t: 'wait', dur: .5 },
    say(N, 'normal', '把那天晚上的事，告诉我吧。'),
    say(KN, 'sad', '……嗯。'),
    { t: 'bars', on: true },
    { t: 'memory', on: true },
    say(KN, 'sad', '11 点整，我按约定进了录音室 B。那天我第一次上电台。'),
    say(KN, 'sad', '我在门外练了半小时台本，手一直在抖。'),
    say(KN, 'shock', '然后我推开门……音无老师，倒在桌子前面。'),
    say(KN, 'cry', '地上好多血。我叫他，他不动。'),
    say(KN, 'cry', '旁边有个铜架子……我，我不知道为什么就把它捡起来了……'),
    say(KN, 'cry', '等我反应过来，门开了，好多人站在那里看着我。'),
    { t: 'memory', on: false },
    { t: 'bars', on: false },
    { t: 'wait', dur: .4 },
    say(N, 'think', '（11 点整进去，就已经倒下了……）'),
    say(N, 'normal', '白鸟小姐。你进去的时候，房间里有播出中的红灯亮着吗？'),
    say(KN, 'think', '……红灯？'),
    say(KN, 'surprised', '啊……没有。ON AIR 的灯，是[r]暗的[/]。'),
    say(N, 'shock', '……！'),
    say(MY, 'surprised', '成步堂，这有什么问题吗？'),
    say(N, 'think', '（如果那时正在直播，红灯不可能是暗的。）'),
    say(N, 'confident', '也就是说——那个时候，[r]录音室里没有人在直播[/]。'),
    say(KN, 'hopeful', '那……那是不是说，我说的话，有证据了？'),
    say(N, 'sweat', '（还不够。她的证词只是证词。我需要能摆在法庭上的[r]物证[/]。）'),
    say(N, 'confident', '白鸟小姐。我去现场看看。'),
    say(N, 'confident', '在那之前——请你答应我一件事。'),
    say(KN, 'normal', '……什么？'),
    say(N, 'confident', '明天在法庭上，无论听到什么，都不要低头。'),
    say(KN, 'hopeful', '……好。'),
    { t: 'bgmStop', fade: 1.0 },
    { t: 'wait', dur: .5 },
    { t: 'fade', dur: .8 },

    /* ---------------- 调查 ---------------- */
    { t: 'label', name: 'studio' },
    { t: 'checkpoint', label: 'studio' },
    { t: 'scene', name: 'studio', cam: 'main' },
    { t: 'fade', dir: 'in', dur: .8 },
    { t: 'phase', title: '录音室 B', phase: '调查' },
    { t: 'sfx', name: 'humStart', args: [58, .07] },
    nar('8 月 20 日 ・ 下午 ・ 星屑电台 录音室 B'),
    { t: 'actors', list: [] },
    say(N, 'normal', '这里就是……'),
    say(MY, 'surprised', '好安静。安静得耳朵有点疼。'),
    say(G, 'salute', '哦！辩护人！你可来了！'),
    { t: 'evidence', id: 'p_itonokogiri', silent: true },
    { t: 'evidence', id: 'p_hibiki', silent: true },
    say(N, 'normal', '糸锯刑警。现场保持原样吗？'),
    say(G, 'salute', '当然！一根头发都没动过！'),
    say(MY, 'think', '（那那卷带子……）'),
    say(N, 'confident', '那正好。让我仔细看看。'),
    { t: 'invest', data: STUDIO },

    /* ---------------- 前厅 ---------------- */
    { t: 'label', name: 'lobby' },
    { t: 'checkpoint', label: 'lobby' },
    { t: 'sfx', name: 'humStop' },
    { t: 'scene', name: 'lobby', cam: 'main' },
    { t: 'bgm', name: 'suspense', fadeIn: .8 },
    { t: 'fade', dir: 'in', dur: .7 },
    { t: 'phase', title: '地方法院 · 被告休息室', phase: '开庭前' },
    nar('8 月 21 日 ・ 上午 9 时 50 分 ・ 地方法院 被告休息室'),
    { t: 'actors', list: [] },
    say(MY, 'worried', '成步堂，紧张吗？'),
    say(N, 'sweat', '（手心全是汗。）'),
    say(N, 'normal', '……还好。'),
    say(MY, 'happy', '骗人！你耳朵红了！'),
    { t: 'wait', dur: .3 },
    say(E, 'arms', '——早上好，成步堂君。'),
    { t: 'sfx', name: 'sting' },
    { t: 'evidence', id: 'p_mitsurugi', silent: true },
    say(N, 'shock', '御剑！'),
    say(E, 'smug', '一份被压下去的尸检报告，一卷来历不明的盒带。'),
    say(E, 'smug', '你手上就这些？'),
    say(N, 'confident', '够了。'),
    say(E, 'arms', '……那份报告，我确实没有提交。'),
    say(MY, 'angry', '果然是你压下去的！'),
    say(E, 'point', '不。我只是没有采用一份[r]与所有其他证据冲突[/]的鉴定。'),
    say(E, 'arms', '惨叫、目击、指纹、门禁——全部指向 11 点 20 分。'),
    say(E, 'arms', '只有那份报告指向 10 点 18 分。'),
    say(E, 'smug', '成步堂君。一份孤立的数字，不是真相，是[r]噪音[/]。'),
    say(N, 'think', '（……他不是在掩盖。他是在等我把它变成[r]信号[/]。）'),
    say(N, 'confident', '那我就在法庭上，把噪音变成声音给你听。'),
    say(E, 'smug', '……哼。'),
    say(E, 'normal', '期待你的表演。'),
    { t: 'wait', dur: .4 },
    { t: 'sfx', name: 'doorOpen' },
    nar('走廊尽头，法庭的大门开了。'),
    say(MY, 'cheer', '上吧，成步堂！'),
    { t: 'bgmStop', fade: .6 },
    { t: 'fade', dur: .7 },

    /* ---------------- 开庭 ---------------- */
    { t: 'label', name: 'trial' },
    { t: 'checkpoint', label: 'trial' },
    { t: 'scene', name: 'court', cam: 'wide' },
    { t: 'sfx', name: 'crowdStart', args: [.14] },
    { t: 'bgm', name: 'courtStart', fadeIn: .6 },
    { t: 'fade', dir: 'in', dur: .9 },
    { t: 'phase', title: '第 1 天 · 审判', phase: '开庭' },
    { t: 'wait', dur: .8 },
    { t: 'cast', witness: null },
    { t: 'cam', name: 'judge', dur: .8 },
    { t: 'sfx', name: 'gavel', args: [3, .32] },
    { t: 'fx', name: 'shake', args: [3, .3] },
    say(J, 'normal', '现在开庭。审理白鸟花音小姐的案件。'),
    say(E, 'arms', '检察方，准备完毕。', { cam: 'prosecution', camDur: .5 }),
    say(N, 'normal', '辩护方，准备完毕。', { cam: 'defense', camDur: .5 }),
    { t: 'cam', name: 'judge', dur: .45 },
    say(J, 'normal', '检察官，请陈述案件概要。'),
    say(E, 'point', '8 月 19 日晚 11 点 20 分，星屑电台录音室 B。'),
    say(E, 'arms', '深夜节目主播音无响先生，在[r]直播过程中[/]被杀害。'),
    say(E, 'smug', '凶器上留有被告人的指纹，现场只有被告人一人。'),
    say(E, 'point', '一起再简单不过的案件。'),
    say(J, 'normal', '唔……听起来相当明确。'),
    say(N, 'slam', '异议！还有太多没有说明的地方！'),
    { t: 'sfx', name: 'slam' },
    { t: 'fx', name: 'shake', args: [4, .3] },
    say(E, 'smug', '例如？'),
    say(N, 'confident', '例如——[r]死亡时间[/]。'),
    say(E, 'arms', '……哼。'),
    say(J, 'nod', '唔。那么，先请证人出庭。'),
    say(E, 'normal', '传唤本案的负责刑警。'),
    { t: 'bgmStop', fade: .4 },
    { t: 'cast', witness: G },
    { t: 'cam', name: 'witness', dur: .7 },
    say(G, 'salute', '糸锯圭介，刑警！请多指教！'),

    /* ---------------- 证言 1 ---------------- */
    { t: 'testimony', data: T1 },

    /* ---------------- 中场 ---------------- */
    { t: 'label', name: 'mid1' },
    { t: 'checkpoint', label: 'mid1' },
    { t: 'evidence', id: 'keylog', silent: true },
    { t: 'bgm', name: 'suspense', fadeIn: .5 },
    { t: 'cam', name: 'prosecution', dur: .5 },
    say(E, 'sweat', '……那份报告的鉴定人，使用的是旧式体温推算。'),
    say(N, 'confident', '四十分钟的误差，旧式仪器也做不到。'),
    { t: 'cam', name: 'judge', dur: .45 },
    say(J, 'confused', '本庭确认一下。辩护人的主张是——'),
    say(J, 'confused', '被害人在那声惨叫之前，[r]就已经死了[/]？'),
    { t: 'cam', name: 'defenseBoth', dur: .45 },
    say(N, 'confident', '正是。'),
    say(N, 'confident', '而如果是这样，那声从电波里传出来的惨叫——'),
    say(N, 'slam', '就[r]不可能是现场发出的[/]。'),
    { t: 'sfx', name: 'murmur' },
    { t: 'cam', name: 'gallery', dur: .6 },
    { t: 'wait', dur: .6 },
    { t: 'cam', name: 'judge', dur: .5 },
    say(J, 'surprise', '肃静！肃静！'),
    say(J, 'normal', '……本庭需要听取当晚在调音室的人的证词。'),
    { t: 'cam', name: 'prosecution', dur: .45 },
    say(E, 'arms', '……好。传唤节目制作人，黑岩龙三。'),
    say(E, 'smug', '成步堂君。这一位，可不像糸锯刑警那么好说话。'),
    { t: 'cast', witness: K },
    { t: 'cam', name: 'witness', dur: .8 },
    { t: 'sfx', name: 'step', args: [0] },
    say(K, 'smug', '黑岩龙三。做了三十年节目的老头子。'),
    say(K, 'laugh', '哈哈，法庭这地方，比录音棚闷多了！'),
    { t: 'cam', name: 'defenseBoth', dur: .4 },
    say(MY, 'worried', '……成步堂，我不喜欢这个人的笑声。'),
    say(N, 'think', '（我也不喜欢。……而且，他在墨镜后面，一直在看我手上的东西。）'),
    { t: 'bgmStop', fade: .4 },

    /* ---------------- 证言 2 ---------------- */
    { t: 'testimony', data: T2 },

    /* ---------------- 判决 ---------------- */
    { t: 'label', name: 'verdict' },
    { t: 'bgm', name: 'sad', fadeIn: 1.0 },
    { t: 'cam', name: 'witness', dur: .6 },
    say(K, 'sad', '……律师先生。'),
    say(K, 'sad', '我做了三十年的节目。你知道最好的声音是什么样的吗？'),
    say(K, 'sad', '是深夜两点，一个人在被窝里，听见有人对着自己说「晚安」。'),
    say(K, 'sad', '音无有那样的声音。我什么都没有。'),
    { t: 'cam', name: 'defenseBoth', dur: .5 },
    say(N, 'sad', '所以你就让那个声音，替你说了最后一句谎。'),
    { t: 'cam', name: 'witness', dur: .5 },
    say(K, 'sad', '……'),
    say(K, 'sad', '带子第 47 分 12 秒。那里有一句我没剪掉的。'),
    say(K, 'sad', '他说：「今晚有位新人来做客，请大家一定要温柔一点。」'),
    { t: 'wait', dur: .8 },
    { t: 'cam', name: 'defenseBoth', dur: .5 },
    say(MY, 'sad', '……那是在说花音小姐吧。'),
    say(N, 'sad', '……嗯。'),
    { t: 'wait', dur: .6 },
    { t: 'bgmStop', fade: 1.2 },
    { t: 'cam', name: 'judge', dur: .8 },
    { t: 'wait', dur: .5 },
    say(J, 'normal', '……本庭已经听够了。'),
    say(J, 'normal', '黑岩龙三将以杀人嫌疑另案侦办。'),
    say(J, 'nod', '那么，本庭宣布对被告人白鸟花音的判决——'),
    { t: 'bgm', name: 'victory', fadeIn: .2 },
    { t: 'fx', name: 'flash', args: ['#ffffff', .5, .9] },
    { t: 'title', text: '无 罪' },
    { t: 'sfx', name: 'verdict' },
    { t: 'fx', name: 'confetti', args: [4.5] },
    { t: 'wait', dur: 1.0 },
    say(J, 'happy', '——[g]无 罪[/]！'),
    { t: 'sfx', name: 'cheer' },
    { t: 'cam', name: 'gallery', dur: .9 },
    { t: 'wait', dur: 1.0 },
    { t: 'cam', name: 'defenseBoth', dur: .7 },
    say(MY, 'cheer', '成功了！成步堂，我们赢了！'),
    say(N, 'happy', '（……手到现在还在抖。）'),
    say(N, 'happy', '嗯。赢了。'),
    { t: 'wait', dur: .5 },
    { t: 'fade', dur: 1.0 },

    /* ---------------- 尾声 ---------------- */
    { t: 'label', name: 'ending' },
    { t: 'sfx', name: 'crowdStop' },
    { t: 'scene', name: 'lobby', cam: 'main' },
    { t: 'bgm', name: 'investigate', fadeIn: 1.0 },
    { t: 'fade', dir: 'in', dur: .9 },
    { t: 'phase', title: '地方法院 · 被告休息室', phase: '闭庭后' },
    nar('8 月 21 日 ・ 下午 ・ 被告休息室'),
    { t: 'cast', witness: null },
    say(KN, 'cry', '成步堂律师……真宵小姐……'),
    say(KN, 'cry', '谢谢……谢谢你们……'),
    say(MY, 'happy', '别哭啦！今天该笑的呀！'),
    say(KN, 'hopeful', '……嗯。'),
    { t: 'wait', dur: .4 },
    say(KN, 'normal', '那个……我想问一件事。'),
    say(KN, 'sad', '音无老师……最后在带子里说的那句话，'),
    say(KN, 'sad', '「请大家一定要温柔一点」——'),
    say(KN, 'cry', '是在说我吗？'),
    { t: 'wait', dur: .6 },
    say(N, 'happy', '是啊。'),
    say(N, 'happy', '所以，去做一个让人听见就觉得安心的声音吧。'),
    say(N, 'happy', '那是他留给你的作业。'),
    say(KN, 'hopeful', '……好！我会的！'),
    { t: 'sfx', name: 'ding' },
    { t: 'wait', dur: .5 },
    say(E, 'arms', '……成步堂君。'),
    say(N, 'shock', '御剑！'),
    say(E, 'normal', '那份尸检报告，我会重新提交给检察厅。'),
    say(E, 'smug', '还有——你今天把噪音变成了声音。'),
    say(E, 'smug', '下一次，我不会再给你调音的机会。'),
    { t: 'sfx', name: 'whoosh', args: [1, .8] },
    nar('御剑转身走了。走廊很长，脚步声很稳。'),
    say(MY, 'think', '成步堂，他刚刚是不是……在夸你？'),
    say(N, 'happy', '（谁知道呢。）'),
    say(N, 'happy', '走吧，真宵。今天请你吃汉堡。'),
    say(MY, 'cheer', '真的！？我要三个！'),
    say(N, 'sweat', '（……我的钱包。）'),
    { t: 'wait', dur: .6 },
    { t: 'bars', on: true },
    nar('深夜两点，广播里传来一个陌生而温柔的新人声音。'),
    nar('「——晚安。今天也辛苦了。」'),
    { t: 'wait', dur: 1.2 },
    { t: 'fade', dur: 1.4 },
    { t: 'bars', on: false },
    { t: 'end', result: 'clear' }
  ];

  C1.title = '逆转的深夜电波';

})(window.AA);
