'use strict';

/* ============================================================================
   冷光 COLD LIGHT —— 后朋克轻音乐
   ----------------------------------------------------------------------------
   本文件包含三部分:
     1. 乐曲数据   —— 用乐理写成的"乐谱"(和弦 / 贝斯音型 / 鼓型 / 曲式)
     2. 合成引擎   —— Web Audio API 实时合成所有音色,无采样
     3. 可视化     —— 频谱驱动的"脉冲星山脉"(致敬 Unknown Pleasures 封面)

   乐理要点:
     · 调性: A 自然小调 (Aeolian),全曲回避导音 G#,拒绝属功能强解决
     · 主歌: i–i–VI–VII (Am–Am–F–G)   副歌: VI–VII–i   桥段: 转向 iv (Dm)
     · 贝斯: Peter Hook 式八分音符旋律贝斯,是全曲真正的"主唱"
     · 节奏: 132 BPM 4/4,主歌 Motorik 直线律动,副歌四踩,桥段半速
   ============================================================================ */


/* ============================== 一、乐曲数据 ============================== */

/* ---------- 基础时值 ---------- */
const TEMPO = 132;            // 后朋克典型行进速度:紧张,但不狂躁
const BEAT  = 60 / TEMPO;     // 一拍的时长(秒)
const STEP  = BEAT / 2;       // 八分音符 —— 全曲最小律动单位,每小节 8 步

/* ---------- 音高工具:音名("A2")→ 频率(Hz) ---------- */
const NOTE_IDX = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
const freq = n => {
  const m = n.match(/^([A-G]#?)(\d)$/);
  // MIDI 编号 → 频率:A4(69 号)= 440Hz,每半音差 2^(1/12) 倍
  return 440 * Math.pow(2, (12 * (+m[2] + 1) + NOTE_IDX[m[1]] - 69) / 12);
};

/* ---------- 和弦库 ----------
   每个和弦记录: 显示名 / 罗马级数 / 铺底配置音 / 吉他刺三和弦
   角色注解见 README:Am=家, F=避风港, G=永远不进去的门, Em=拒绝解决, Dm=水面之下 */
const CHORDS = {
  Am:{ label:'Am', roman:'i',   pad:['A2','E3','A3','C4'], stab:['A3','C4','E4'] },
  F :{ label:'F',  roman:'VI',  pad:['F2','C3','A3','C4'], stab:['A3','C4','F4'] },
  G :{ label:'G',  roman:'VII', pad:['G2','D3','B3','D4'], stab:['G3','B3','D4'] },
  Em:{ label:'Em', roman:'v',   pad:['E2','B2','G3','B3'], stab:['G3','B3','E4'] },
  Dm:{ label:'Dm', roman:'iv',  pad:['D2','A2','F3','A3'], stab:['F3','A3','D4'] }
};

/* ---------- 贝斯音型(每小节 8 个八分音符,null=休止) ----------
   写法:前 5 步钉在根音上"匀速行走",后 3 步爬三度/五度做旋律填充。
   vers* = 主歌型   chor* = 副歌型(根音-高五音往返,心跳加速)
   br*   = 桥段型(四分音符,半速呼吸)   outAm = 终止音 */
const BASS = {
  versAm1:['A2','A2','A2','A2','A2','C3','E3','C3'],
  versAm2:['A2','A2','A2','A2','A2','G2','E2','G2'],
  versF  :['F2','F2','F2','F2','F2','A2','C3','A2'],
  versG  :['G2','G2','G2','G2','G2','B2','D3','B2'],
  chorF  :['F2','C3','F2','C3','F2','A2','C3','D3'],
  chorG  :['G2','D3','G2','D3','G2','B2','D3','E3'],
  chorAm :['A2','E3','A2','E3','A2','C3','E3','G3'],
  chorAm2:['A2','E3','A2','E3','A2','C3','B2','G2'],  // 尾音 G2 顺滑接回 F2
  chorEm :['E2','B2','E2','B2','E2','G2','B2','D3'],
  brDm   :['D2',null,'D2',null,'A2',null,'F2',null],
  brAm   :['A2',null,'A2',null,'E3',null,'C3',null],
  brEm   :['E2',null,'E2',null,'B2',null,'G2',null],
  brG    :['G2',null,'G2',null,'D3',null,'B2','D3'],
  outAm  :['A2',null,null,null,null,null,null,null]
};
const drive = r => [r,r,r,r,r,r,r,r];   // 前奏用:一整小节死踩根音的传送带

/* ---------- 吉他音型 ----------
   Am1/Am2/F/G:主歌流动分解和弦(合唱音色+延迟)
   *S:桥段稀疏型,音符落在 0/3/6 步 —— 3-3-2 切分的骨架,交给延迟去填空 */
const ARP = {
  Am1:['A3','C4','E4','C4','A3','C4','E4','C4'],
  Am2:['A3','C4','E4','A4','E4','C4','E4','C4'],
  F  :['F3','A3','C4','A3','F3','A3','C4','A3'],
  G  :['G3','B3','D4','B3','G3','B3','D4','B3'],
  DmS:['D3',null,null,'A3',null,null,'F3',null],
  AmS:['A3',null,null,'E4',null,null,'C4',null],
  EmS:['E3',null,null,'B3',null,null,'G3',null],
  GS :['G3',null,null,'D4',null,null,'B3',null]
};

/* ---------- 鼓型 ----------
   k=底鼓 s=军鼓 h=闭镲 oh=开镲 toms=通鼓 hv=镲片音量系数
   步序:0 2 4 6 = 正拍 1/2/3/4,奇数步 = 反拍
   intro  = 只有底鼓+镲,世界尚未醒来
   verse  = Motorik:军鼓钉死 2/4 拍,第 7 步补一脚底鼓推进下一小节
   chorus = 四踩底鼓,chorusA 额外在段落头加开镲(=画面白闪)
   bridge = 半速:军鼓只落在第 3 拍,留出呼吸
   fillS  = 军鼓推子过门   fillB = 坠落式通鼓过门(F3→D3→C3→A2) */
const H8 = [0,1,2,3,4,5,6,7];
const DR = {
  intro  :{ k:[0,4],     s:[],      h:H8, hv:0.55 },
  verse  :{ k:[0,4,7],   s:[2,6],   h:H8 },
  chorus :{ k:[0,2,4,6], s:[2,6],   h:H8 },
  chorusA:{ k:[0,2,4,6], s:[2,6],   h:H8, oh:[0] },
  bridge :{ k:[0],       s:[4],     h:[0,2,4,6], hv:0.5 },
  fillS  :{ k:[0,4],     s:[2,6,7], h:[0,1,2,3,4,5,6] },
  fillB  :{ k:[0],       s:[2,4],   h:[0,1,2,3], toms:[[4,'F3'],[5,'D3'],[6,'C3'],[7,'A2']] },
  end    :{ k:[0],       s:[],      h:[], oh:[0] }
};

/* ---------- 曲式构建 ----------
   B() 生成一小节:{ c:和弦, bass, dr, arp, stab, pad, lead, ... }
   section() 顺序拼接,并记录段落名/起点/长度/可视化情绪色 */
const SONG = [];
const SECTIONS = [];
const B = (c, o) => Object.assign({ c }, o);
function section(name, col, bars){
  SECTIONS.push({ name, col, start: SONG.length, len: bars.length });
  bars.forEach(b => SONG.push(b));
}

/* 前奏(8 小节):出门。前 4 小节贝斯死踩根音,后 4 小节军鼓进场 —— 冷灰 */
section('前奏 INTRO', '#a9adb4', [
  B('Am',{ bass:drive('A2'), dr:DR.intro }),
  B('Am',{ bass:drive('A2'), dr:DR.intro }),
  B('F', { bass:drive('F2'), dr:DR.intro }),
  B('G', { bass:drive('G2'), dr:DR.intro }),
  B('Am',{ bass:BASS.versAm1, dr:DR.verse }),
  B('Am',{ bass:BASS.versAm2, dr:DR.verse }),
  B('F', { bass:BASS.versF,  dr:DR.verse }),
  B('G', { bass:BASS.versG,  dr:DR.fillS })
]);

/* 主歌(8 小节 ×2 次使用):i–i–VI–VII 循环,匀速行走。
   pad=1 时加入铺底(第二遍主歌才有 —— 同一条街,多了记忆的重量) */
function verse(pad){
  return [
    B('Am',{ bass:BASS.versAm1, dr:DR.verse, arp:ARP.Am1, pad }),
    B('Am',{ bass:BASS.versAm2, dr:DR.verse, arp:ARP.Am2, pad }),
    B('F', { bass:BASS.versF,  dr:DR.verse, arp:ARP.F,   pad }),
    B('G', { bass:BASS.versG,  dr:DR.verse, arp:ARP.G,   pad }),
    B('Am',{ bass:BASS.versAm1, dr:DR.verse, arp:ARP.Am1, pad }),
    B('Am',{ bass:BASS.versAm2, dr:DR.verse, arp:ARP.Am2, pad }),
    B('F', { bass:BASS.versF,  dr:DR.verse, arp:ARP.F,   pad }),
    B('G', { bass:BASS.versG,  dr:DR.fillS, arp:ARP.G,   pad })
  ];
}
section('主歌 VERSE I', '#d43a35', verse(0));

/* 副歌(8 小节 ×3 次使用):VI–VII–i 反转进行,四踩底鼓 + 3-3-2 和弦刺 + 主音线。
   lead 音符均为和弦内音或九音/七音级进,全部落在 A 小调音阶内。
   bigOut=true 时结尾用坠落式通鼓(副歌 II → 桥段的"下沉"入口) */
function chorus(bigOut){
  return [
    B('F', { bass:BASS.chorF,  dr:DR.chorusA, stab:1, pad:1, lead:[{s:0,n:'A4',d:4},{s:4,n:'G4',d:4}] }),
    B('G', { bass:BASS.chorG,  dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'B4',d:6},{s:6,n:'D5',d:2}] }),
    B('Am',{ bass:BASS.chorAm, dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'C5',d:8}] }),
    B('Am',{ bass:BASS.chorAm2,dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'C5',d:4},{s:4,n:'B4',d:2},{s:6,n:'G4',d:2}] }),
    B('F', { bass:BASS.chorF,  dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'A4',d:4},{s:4,n:'C5',d:4}] }),
    B('G', { bass:BASS.chorG,  dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'B4',d:4},{s:4,n:'D5',d:4}] }),
    B('Em',{ bass:BASS.chorEm, dr:DR.chorus,  stab:1, pad:1, lead:[{s:0,n:'E5',d:6},{s:6,n:'D5',d:2}] }),
    B('Am',{ bass:BASS.chorAm, dr:bigOut?DR.fillB:DR.fillS, stab:1, pad:1, lead:[{s:0,n:'E5',d:4},{s:4,n:'C5',d:4}] })
  ];
}
section('副歌 CHORUS', '#ff4d45', chorus(false));
section('主歌 VERSE II', '#d43a35', verse(1));
section('副歌 CHORUS II', '#ff4d45', chorus(true));

/* 桥段(8 小节):转向 iv 级 Dm,半速,织体抽空 —— 全曲最冷处,寒蓝。
   arpDur 拉长吉他音符,让延迟回声占据被抽空的空间 */
const BR_DUR = STEP * 1.8;
section('桥段 BRIDGE', '#6f9db8', [
  B('Dm',{ bass:BASS.brDm, dr:DR.bridge, arp:ARP.DmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'F4',d:8}] }),
  B('Dm',{ bass:BASS.brDm, dr:DR.bridge, arp:ARP.DmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'E4',d:4},{s:4,n:'D4',d:4}] }),
  B('Am',{ bass:BASS.brAm, dr:DR.bridge, arp:ARP.AmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'E4',d:8}] }),
  B('Am',{ bass:BASS.brAm, dr:DR.bridge, arp:ARP.AmS, arpDur:BR_DUR, pad:1 }),
  B('Dm',{ bass:BASS.brDm, dr:DR.bridge, arp:ARP.DmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'A4',d:8}] }),
  B('Dm',{ bass:BASS.brDm, dr:DR.bridge, arp:ARP.DmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'G4',d:4},{s:4,n:'F4',d:4}] }),
  B('Em',{ bass:BASS.brEm, dr:DR.bridge, arp:ARP.EmS, arpDur:BR_DUR, pad:1, lead:[{s:0,n:'E4',d:8}] }),
  B('G', { bass:BASS.brG,  dr:DR.fillB,  arp:ARP.GS,  arpDur:BR_DUR, pad:1, lead:[{s:0,n:'B4',d:4},{s:4,n:'D5',d:4}] })
]);

/* 终章副歌(8 小节):从水底浮上来吸到的那口气 —— 橙红 */
section('终章 FINAL CHORUS', '#ff5a3c', chorus(false));

/* 尾奏(4 小节):元素逐层退场,终止于开放的 Am + 长音 E5 余响 —— 灰 */
section('尾奏 OUTRO', '#8b8985', [
  B('Am',{ bass:BASS.versAm1, dr:DR.verse, arp:ARP.Am1, pad:1 }),
  B('F', { bass:BASS.versF,  dr:DR.verse, arp:ARP.F,   pad:1 }),
  B('G', { bass:BASS.versG,  dr:DR.fillS, arp:ARP.G,   pad:1 }),
  B('Am',{ bass:BASS.outAm,  dr:DR.end, pad:1, hold:1, lead:[{s:0,n:'E5',d:8}] })
]);

const TOTAL_STEPS = SONG.length * 8;   // 60 小节 × 8 步 = 480 步


/* ============================== 二、合成引擎 ============================== */

/* 音频节点全局引用。声部总线 chan.* 支持独立静音(页面上的 STEMS 按钮) */
let AC = null, bus, comp, volGain, analyser, verb, dlyNode, noiseBuf, fd = null, maxBin = 0;
const chan = {};
const muteState = { drums:true, bass:true, gtr:true, synth:true };
let volume = 0.8;

/* 程序生成混响脉冲响应:指数衰减的白噪声(立体声)。
   sec=尾长(秒), decay 越大衰减越快 */
function makeIR(sec, decay){
  const rate = AC.sampleRate, len = Math.floor(rate * sec);
  const buf = AC.createBuffer(2, len, rate);
  for(let c = 0; c < 2; c++){
    const d = buf.getChannelData(c);
    for(let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

/* 搭建全局信号链:
   声部总线 ─► 混音总线 ─► 压缩 ─► 音量 ─► 扬声器
   混响/延迟为发送式效果,返送回混音总线;分析器从压缩后取样供可视化 */
function initAudio(){
  AC = new (window.AudioContext || window.webkitAudioContext)();

  bus = AC.createGain(); bus.gain.value = 0.9;

  comp = AC.createDynamicsCompressor();          // 总线压缩:把鼓和贝斯"粘"在一起
  comp.threshold.value = -16; comp.knee.value = 20; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.2;

  volGain = AC.createGain(); volGain.gain.value = volume;

  analyser = AC.createAnalyser();
  analyser.fftSize = 2048;                        // 1024 个频点
  analyser.smoothingTimeConstant = 0.6;           // 偏快的响应,可视化自己再做平滑
  fd = new Uint8Array(analyser.frequencyBinCount);
  // 只用 0~6kHz:音乐能量集中区,高频噪声不参与画面
  maxBin = Math.min(analyser.frequencyBinCount - 1,
    Math.floor(6000 / (AC.sampleRate / 2) * analyser.frequencyBinCount));

  bus.connect(comp); comp.connect(volGain); volGain.connect(AC.destination);
  comp.connect(analyser);                         // 旁路取样,不在主链上

  Object.keys(muteState).forEach(k => {
    chan[k] = AC.createGain();
    chan[k].gain.value = muteState[k] ? 1 : 0;
    chan[k].connect(bus);
  });

  /* 卷积混响(2.6 秒尾巴):军鼓、铺底、主音的"房间" */
  verb = AC.createConvolver(); verb.buffer = makeIR(2.6, 2.8);
  const vret = AC.createGain(); vret.gain.value = 0.35;
  verb.connect(vret); vret.connect(bus);

  /* 点八分反馈延迟(0.75 拍):后朋克吉他的招牌空间。
     反馈环内低通 2.4kHz,回声一次比一次更暗更远 */
  dlyNode = AC.createDelay(2); dlyNode.delayTime.value = BEAT * 0.75;
  const fb = AC.createGain(); fb.gain.value = 0.34;
  const df = AC.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 2400;
  dlyNode.connect(df); df.connect(fb); fb.connect(dlyNode);
  const dret = AC.createGain(); dret.gain.value = 0.5;
  df.connect(dret); dret.connect(bus);

  /* 共享白噪声源(1 秒),鼓组按需切片使用 */
  noiseBuf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for(let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

function noiseSrc(){
  const s = AC.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}
/* 发送式效果的快捷接线:node ──(amt)──► dest */
function sendTo(node, dest, amt){
  const g = AC.createGain(); g.gain.value = amt;
  node.connect(g); g.connect(dest);
}

/* ---------- 鼓组:全部由正弦扫频 + 噪声塑形合成 ---------- */

/* 底鼓:正弦波 150Hz→44Hz 快速下扫(拳头感)+ 高通噪声敲击头(结实的"哒") */
function playKick(t, v){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
  o.connect(g); g.connect(chan.drums);
  o.start(t); o.stop(t + 0.5);
  const n = noiseSrc(), hp = AC.createBiquadFilter(), ng = AC.createGain();
  hp.type = 'highpass'; hp.frequency.value = 1200;
  ng.gain.setValueAtTime(v * 0.25, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  n.connect(hp); hp.connect(ng); ng.connect(chan.drums);
  n.start(t); n.stop(t + 0.03);
}

/* 军鼓:带通噪声(1.7kHz 沙沙)+ 三角波鼓皮音,干燥致密,少量混响发送 */
function playSnare(t, v){
  const n = noiseSrc(), bp = AC.createBiquadFilter(), g = AC.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.8;
  g.gain.setValueAtTime(v * 0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  n.connect(bp); bp.connect(g); g.connect(chan.drums);
  sendTo(g, verb, 0.4);
  n.start(t); n.stop(t + 0.2);
  const o = AC.createOscillator(), og = AC.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(210, t);
  o.frequency.exponentialRampToValueAtTime(150, t + 0.06);
  og.gain.setValueAtTime(v * 0.5, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(og); og.connect(chan.drums);
  o.start(t); o.stop(t + 0.12);
}

/* 镲片:高通噪声(7.8kHz 以上)。闭镲 45ms,开镲 320ms */
function playHat(t, v, open){
  const n = noiseSrc(), hp = AC.createBiquadFilter(), g = AC.createGain();
  hp.type = 'highpass'; hp.frequency.value = 7800;
  const d = open ? 0.32 : 0.045;
  g.gain.setValueAtTime(v * 0.28, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(hp); hp.connect(g); g.connect(chan.drums);
  n.start(t); n.stop(t + d + 0.02);
}

/* 通鼓:正弦波 1.4 倍频率下滑到本音,用于坠落式过门 */
function playTom(t, f, v){
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  g.gain.setValueAtTime(v * 0.7, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g); g.connect(chan.drums);
  sendTo(g, verb, 0.3);
  o.start(t); o.stop(t + 0.35);
}

/* ---------- 旋律声部 ---------- */

/* 贝斯(主唱):锯齿波本音 + 方波次八度垫底,
   低通滤波 1600→520Hz 快速关闭 = 拨片啃弦的"咬字" */
function playBass(t, note, v){
  const f = freq(note), dur = STEP * 0.92;
  const o1 = AC.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f;
  const o2 = AC.createOscillator(); o2.type = 'square';   o2.frequency.value = f / 2;
  const o2g = AC.createGain(); o2g.gain.value = 0.4;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  lp.frequency.setValueAtTime(1600, t);
  lp.frequency.exponentialRampToValueAtTime(520, t + 0.12);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * 0.5, t + 0.006);
  g.gain.exponentialRampToValueAtTime(v * 0.3, t + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o1.connect(lp); o2.connect(o2g); o2g.connect(lp);
  lp.connect(g); g.connect(chan.bass);
  o1.start(t); o2.start(t);
  o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
}

/* 吉他:三个互相失谐(-7/0/+6 音分)的锯齿波 = 合唱效果的宽度,
   高通 260Hz 让出贝斯的位置,发送到延迟(0.5)与混响(0.22) */
function playGtr(t, note, v, dur){
  const f = freq(note);
  const g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.005);
  g.gain.exponentialRampToValueAtTime(v * 0.12, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
  const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.7;
  [-7, 0, 6].forEach(cents => {
    const o = AC.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
    const og = AC.createGain(); og.gain.value = 0.33;
    o.connect(og); og.connect(hp);
    o.start(t); o.stop(t + dur + 0.1);
  });
  hp.connect(lp); lp.connect(g); g.connect(chan.gtr);
  sendTo(g, dlyNode, 0.5);
  sendTo(g, verb, 0.22);
}

/* 铺底 Pad:每个和弦音两只失谐锯齿波,0.4 秒慢起音 + 0.9 秒长释音,
   相邻小节的余音互相交叠成"城市的环境光"。重混响发送(0.55) */
function playPad(t, notes, dur){
  notes.forEach(nn => {
    const f = freq(nn);
    const g = AC.createGain();
    const peak = 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.4);
    g.gain.setValueAtTime(peak, t + Math.max(0.4, dur - 0.1));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.9);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1150;
    [-6, 5].forEach(c => {
      const o = AC.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c;
      const og = AC.createGain(); og.gain.value = 0.5;
      o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 1);
    });
    lp.connect(g); g.connect(chan.synth);
    sendTo(g, verb, 0.55);
  });
}

/* 主音合成器("人声替身"):锯齿+方波双振荡,5.4Hz 慢颤音(±6 音分),
   低通 2kHz 保持哑光质感,同时发送延迟与混响 */
function playLead(t, note, dSteps){
  const f = freq(note), dur = dSteps * STEP;
  const g = AC.createGain(), lp = AC.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2000; lp.Q.value = 1;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.17, t + 0.03);
  g.gain.setValueAtTime(0.17, t + Math.max(0.03, dur - 0.05));
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
  const vib = AC.createOscillator(), vg = AC.createGain();
  vib.frequency.value = 5.4; vg.gain.value = 6;
  vib.connect(vg);
  [['sawtooth', 0], ['square', -10]].forEach(([w, c]) => {
    const o = AC.createOscillator();
    o.type = w; o.frequency.value = f; o.detune.value = c;
    vg.connect(o.detune);
    const og = AC.createGain(); og.gain.value = 0.5;
    o.connect(og); og.connect(lp);
    o.start(t); o.stop(t + dur + 0.4);
  });
  vib.start(t); vib.stop(t + dur + 0.4);
  lp.connect(g); g.connect(chan.synth);
  sendTo(g, dlyNode, 0.35);
  sendTo(g, verb, 0.4);
}

/* ---------- 音序器:lookahead 调度 ----------
   每 25ms 醒来一次,把未来 120ms 内的音符按精确时间写入音频时间线。
   UI 卡顿不会影响节拍稳定(经典 "A Tale of Two Clocks" 方案) */
let playing = false, started = false, current8th = 0, nextNoteTime = 0, timerID = null;
const stepEvents = [];   // 已调度步 → 供 UI 按时间同步小节/和弦显示
const vizEvents  = [];   // 已调度鼓事件 → 供可视化做精确同步的脉冲

function scheduleStep(step, t){
  const barIdx = Math.floor(step / 8), sb = step % 8, bar = SONG[barIdx];

  /* 鼓:按鼓型触发;镲片做 ±2ms 微抖动与强弱交替,避免机器感过头 */
  const dr = bar.dr;
  if(dr){
    if(dr.k.includes(sb)){ playKick(t, 0.95); vizEvents.push({ time:t, kind:'kick' }); }
    if(dr.s.includes(sb)){ playSnare(t, 0.9); vizEvents.push({ time:t, kind:'snare' }); }
    if(dr.h.includes(sb)) playHat(t + (Math.random() - 0.5) * 0.004, (sb % 2 ? 0.45 : 0.75) * (dr.hv || 1), false);
    if(dr.oh && dr.oh.includes(sb)){ playHat(t, 0.7, true); vizEvents.push({ time:t, kind:'crash' }); }
    if(dr.toms) dr.toms.forEach(([ts, tn]) => {
      if(ts === sb){ playTom(t, freq(tn), 0.85); vizEvents.push({ time:t, kind:'snare' }); }
    });
  }

  /* 贝斯:正拍(0/4 步)重音,其余稍轻 —— 行走的重心 */
  if(bar.bass && bar.bass[sb]) playBass(t, bar.bass[sb], sb % 4 === 0 ? 1 : 0.84);

  /* 吉他分解和弦:反拍轻、正拍重 */
  if(bar.arp && bar.arp[sb]) playGtr(t, bar.arp[sb], sb % 2 ? 0.42 : 0.55, bar.arpDur || STEP * 0.92);

  /* 副歌和弦刺:固定落在 0/3/6 步 = 3-3-2 切分,秩序内部的不安 */
  if(bar.stab && (sb === 0 || sb === 3 || sb === 6)){
    CHORDS[bar.c].stab.forEach(n => playGtr(t, n, 0.5, STEP * 0.7));
  }

  /* 铺底:小节头触发一次,时值一小节(尾奏最后一小节 hold 两小节) */
  if(bar.pad && sb === 0) playPad(t, CHORDS[bar.c].pad, (bar.hold ? 16 : 8) * STEP);

  /* 主音线:按 {s:起始步, n:音名, d:时值(步)} 触发 */
  if(bar.lead) bar.lead.forEach(ev => { if(ev.s === sb) playLead(t, ev.n, ev.d); });

  stepEvents.push({ step, time: t });
}

function scheduler(){
  while(nextNoteTime < AC.currentTime + 0.12){
    scheduleStep(current8th, nextNoteTime);
    nextNoteTime += STEP;
    current8th = (current8th + 1) % TOTAL_STEPS;   // 尾奏结束后无缝循环
  }
}


/* ============================== 三、UI 与走带 ============================== */

const playBtn     = document.getElementById('playBtn');
const restartBtn  = document.getElementById('restartBtn');
const hint        = document.getElementById('hint');
const beatDot     = document.getElementById('beatDot');
const sectionName = document.getElementById('sectionName');
const barInfo     = document.getElementById('barInfo');
const progFill    = document.getElementById('progFill');
const chordName   = document.getElementById('chordName');
const chordRoman  = document.getElementById('chordRoman');
const volSlider   = document.getElementById('vol');

/* 播放/暂停:暂停 = 挂起整个 AudioContext,恢复时从同一采样点继续 */
async function togglePlay(){
  if(!AC) initAudio();
  if(!playing){
    await AC.resume();
    if(!started){
      nextNoteTime = AC.currentTime + 0.08;
      started = true;
    }
    timerID = setInterval(scheduler, 25);
    playing = true;
  } else {
    clearInterval(timerID); timerID = null;
    playing = false;
    await AC.suspend();
  }
  playBtn.innerHTML = playing ? '&#9646;&#9646; 暂停 PAUSE' : '&#9654; 播放 PLAY';
  hint.classList.add('gone');
}

function restart(){
  if(!AC){ togglePlay(); return; }
  current8th = 0;
  stepEvents.length = 0;
  vizEvents.length = 0;
  kickPulse = snarePulse = crashPulse = 0;
  shownStep = -1; shownBar = -1;
  nextNoteTime = AC.currentTime + 0.08;
  if(!playing) togglePlay();
}

playBtn.addEventListener('click', togglePlay);
restartBtn.addEventListener('click', restart);
document.addEventListener('keydown', e => {
  if(e.code === 'Space' && e.target === document.body){
    e.preventDefault();
    togglePlay();
  }
});

/* 声部静音(拆解聆听):20ms 平滑过渡避免咔哒声 */
document.querySelectorAll('.ch').forEach(btn => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.ch;
    const on = btn.classList.toggle('on');
    muteState[name] = on;
    if(AC && chan[name]) chan[name].gain.setTargetAtTime(on ? 1 : 0, AC.currentTime, 0.02);
  });
});

volSlider.addEventListener('input', () => {
  volume = volSlider.value / 100;
  if(volGain) volGain.gain.setTargetAtTime(volume, AC.currentTime, 0.02);
});

/* 走带显示:消费 stepEvents(带时间戳),让画面与听到的声音严格对齐 */
let shownStep = -1, shownBar = -1, shownSec = null, shownChord = '';
function syncTransport(){
  if(!AC) return;
  let s = null;
  while(stepEvents.length && stepEvents[0].time <= AC.currentTime){
    s = stepEvents.shift().step;
  }
  if(s === null || s === shownStep) return;
  shownStep = s;
  progFill.style.width = ((s + 1) / TOTAL_STEPS * 100) + '%';
  beatDot.style.opacity = s % 2 === 0 ? '1' : '0.15';   // 四分音符红点脉搏
  const bar = Math.floor(s / 8);
  if(bar !== shownBar){
    shownBar = bar;
    shownSec = SECTIONS.find(x => bar >= x.start && bar < x.start + x.len);
    sectionName.textContent = shownSec.name;
    barInfo.textContent = '小节 ' + String(bar + 1).padStart(2, '0') + ' / ' + SONG.length;
    const ch = CHORDS[SONG[bar].c];
    shownChord = ch.label;
    chordName.textContent = ch.label;
    chordRoman.textContent = ch.roman + ' 级 · A小调';
  }
}


/* ============================== 四、可视化 ==============================
   "脉冲星山脉" —— 致敬 Unknown Pleasures 封面(脉冲星 CP 1919)。

   · 形状:实时频谱做对数映射后左右对称折叠 —— 低频在中央。
           底鼓每踩一下,山脉的心脏就隆起一次。
   · 历史:前排是"现在",往上逐行是过去(每 2 帧凝固一行,共 52 行),
           带景深:越远越窄、越矮、越暗。
   · 同步:音序器推送的鼓事件(精确时间戳)驱动画面 ——
           底鼓 = 震动 + 前排光晕   军鼓 = 全体线条增亮   开镲 = 整幅白闪
   · 情绪:前排亮线颜色 = 当前段落的情绪色(SECTIONS.col)。
   · 待机:未播放时,山脉以慢速正弦轻微起伏,像睡着的仪器。
   ======================================================================== */

const cv = document.getElementById('viz');
const cx = cv.getContext('2d');

const ROWS = 52;              // 历史行数(含前排活动行)
const PTS  = 128;             // 每行采样点数
const SPAWN_EVERY = 2;        // 每 2 帧把活动行凝固为历史

/* 钟形窗:把山峰约束在画面中部,两侧自然消失(封面的留白感) */
const bell = new Float32Array(PTS);
for(let p = 0; p < PTS; p++){
  const x = (p - (PTS - 1) / 2) / (PTS * 0.26);
  bell[p] = Math.exp(-x * x);
}
/* 待机呼吸的每点相位差,让波纹看起来在缓慢流动 */
const idlePhase = new Float32Array(PTS);
for(let p = 0; p < PTS; p++) idlePhase[p] = Math.random() * Math.PI * 2;

const live = new Float32Array(PTS);          // 前排活动行(逐帧插值逼近目标)
const scratch = new Float32Array(PTS);       // 目标形状缓存
const hist = [live];                         // hist[0] 永远指向活动行
for(let i = 1; i < ROWS; i++) hist.push(new Float32Array(PTS));

/* 鼓事件驱动的脉冲量(每帧指数衰减) */
let kickPulse = 0, snarePulse = 0, crashPulse = 0;
let frameN = 0;

let W = 0, Hh = 0, vignette = null;
function resize(){
  const dpr = window.devicePixelRatio || 1;
  W = cv.clientWidth; Hh = cv.clientHeight;
  cv.width = W * dpr; cv.height = Hh * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  /* 暗角:让视线聚焦画面中央,重建于每次改变尺寸时 */
  vignette = cx.createRadialGradient(W / 2, Hh * 0.45, Math.min(W, Hh) * 0.3,
                                     W / 2, Hh * 0.45, Math.max(W, Hh) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
}
window.addEventListener('resize', resize);
resize();

/* 消费音序器推来的鼓事件:只有到了"该响的时刻"才触发画面脉冲 */
function pumpVizEvents(){
  if(!AC) return;
  while(vizEvents.length && vizEvents[0].time <= AC.currentTime){
    const e = vizEvents.shift();
    if(e.kind === 'kick')       kickPulse  = 1;
    else if(e.kind === 'snare') snarePulse = 1;
    else                        crashPulse = 1;
  }
  kickPulse  *= 0.88;
  snarePulse *= 0.86;
  crashPulse *= 0.96;
}

/* 计算目标形状:频谱 → 对称山峰。
   cd = 距中心的归一化距离(0 中心 → 1 边缘);
   频点按 cd^1.7 取样:低频折叠到中央,高频甩向两侧 */
function buildTarget(now){
  const hasData = playing && analyser;
  if(hasData) analyser.getByteFrequencyData(fd);
  for(let p = 0; p < PTS; p++){
    const cd = Math.abs(p - (PTS - 1) / 2) / ((PTS - 1) / 2);
    let a;
    if(hasData){
      const idx = 2 + Math.floor(Math.pow(cd, 1.7) * (maxBin - 4));
      const v = fd[idx] / 255;
      a = Math.pow(v, 1.5) * (1.55 + kickPulse * 0.75);   // 底鼓瞬间抬高整座山
    } else {
      a = 0.05 + 0.04 * Math.sin(now * 1.3 - cd * 4 + idlePhase[p]);  // 待机呼吸
      if(a < 0) a = 0;
    }
    scratch[p] = a * bell[p] + Math.random() * 0.006;      // 一点噪声 = 手绘感
  }
  /* 空间平滑(3 点核),随后活动行向目标插值(时间平滑) */
  for(let p = 0; p < PTS; p++){
    const a = p > 0 ? scratch[p - 1] : scratch[p];
    const b = p < PTS - 1 ? scratch[p + 1] : scratch[p];
    const target = (a + 2 * scratch[p] + b) / 4;
    live[p] += (target - live[p]) * 0.5;
  }
}

function draw(){
  requestAnimationFrame(draw);
  syncTransport();
  pumpVizEvents();
  frameN++;

  buildTarget(performance.now() / 1000);
  /* 每 SPAWN_EVERY 帧把活动行凝固成历史,山脉缓缓向上漂移 */
  if(frameN % SPAWN_EVERY === 0){
    hist.splice(1, 0, Float32Array.from(live));
    hist.length = ROWS;
  }

  /* 背景 */
  cx.fillStyle = '#0b0b0d';
  cx.fillRect(0, 0, W, Hh);

  /* 底鼓震动:整个场景做微小随机位移 */
  cx.save();
  if(kickPulse > 0.02){
    cx.translate((Math.random() - 0.5) * kickPulse * 4.5,
                 (Math.random() - 0.5) * kickPulse * 2.5);
  }

  /* 山脉背后的巨大和弦符号 —— 音乐结构的"幽灵字幕" */
  const glyph = playing || started ? shownChord || 'Am' : 'COLD LIGHT';
  const gSize = playing || started ? Hh * 0.5 : Hh * 0.14;
  cx.font = '700 ' + Math.floor(gSize) + 'px "Arial Narrow","Microsoft YaHei",sans-serif';
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = 'rgba(232,230,225,' + (0.035 + snarePulse * 0.03) + ')';
  cx.fillText(glyph, W / 2, Hh * 0.46);

  /* 山脉:从最远(顶部)画到最前排(底部),
     每行先用背景色填充轮廓下方 → 前排自然遮挡后排(封面的关键效果) */
  const top = 26, bottom = 34;
  const sp = (Hh - top - bottom) / (ROWS - 1);
  const baseAmp = sp * 4.6;
  const frontCol = shownSec ? shownSec.col : '#d43a35';

  for(let j = ROWS - 1; j >= 0; j--){
    const row = hist[j];
    const age = j / (ROWS - 1);                       // 0 = 前排,1 = 最远
    const y0 = top + (ROWS - 1 - j) * sp;
    const plotW = W * 0.68 * (1 - 0.12 * age);        // 景深:越远越窄
    const xL = (W - plotW) / 2;
    const amp = baseAmp * (1 - 0.38 * age);           // 景深:越远越矮

    const curve = new Path2D();
    curve.moveTo(xL, y0 - row[0] * amp);
    for(let p = 1; p < PTS; p++){
      curve.lineTo(xL + p / (PTS - 1) * plotW, y0 - row[p] * amp);
    }
    const fillP = new Path2D(curve);
    fillP.lineTo(xL + plotW, y0 + 2);
    fillP.lineTo(xL, y0 + 2);
    fillP.closePath();
    cx.fillStyle = '#0b0b0d';
    cx.fill(fillP);

    cx.lineWidth = j === 0 ? 1.6 : 1;
    if(j === 0){
      /* 前排:当前段落的情绪色 + 底鼓光晕 */
      cx.strokeStyle = frontCol;
      cx.shadowColor = frontCol;
      cx.shadowBlur = 8 + kickPulse * 26;
    } else {
      /* 后排:随距离变暗;军鼓瞬间提亮全体 */
      const a = Math.max(0, Math.min(1, 0.9 - 0.62 * age + snarePulse * 0.18));
      cx.strokeStyle = 'rgba(232,230,225,' + a.toFixed(3) + ')';
      cx.shadowBlur = 0;
    }
    cx.stroke(curve);
    cx.shadowBlur = 0;
  }
  cx.restore();

  /* 开镲白闪(段落开头的那口气) */
  if(crashPulse > 0.01){
    cx.fillStyle = 'rgba(245,244,240,' + (crashPulse * 0.06).toFixed(3) + ')';
    cx.fillRect(0, 0, W, Hh);
  }

  /* 暗角 */
  cx.fillStyle = vignette;
  cx.fillRect(0, 0, W, Hh);
}
draw();
