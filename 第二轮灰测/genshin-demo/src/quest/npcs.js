// NPC 放置与游荡行为（模块 D）。
// 契约：export class NPCSystem { constructor(ctx); update(dt); }
// 用 ctx.characters.createCharacter 造模型，容错：没有就用胶囊占位。
import * as THREE from 'three';
import { makeNPCPlaceholder, makeBubble, groundY, InteractRegistrar } from './worldobjects.js';
import { speak } from './story.js';

const NPC_DEFS = [
  { id: 'jean', name: '琴', charId: 'jean', color: '#c8d4e4', element: 'anemo', portrait: 'jean',
    lines: ['骑士团的职责，就是守护蒙德的安宁。', '若有困难，随时可以来西风骑士团找我。', '风魔龙的阴影仍在，请务必小心。'] },
  { id: 'amber', name: '安柏', charId: 'amber', color: '#e05848', element: 'pyro', portrait: 'amber',
    lines: ['嘿！今天也要元气满满哦！', '要不要比赛谁先跑到风起地？', '侦察骑士安柏，随时待命！'] },
  { id: 'kaeya', name: '凯亚', charId: 'kaeya', color: '#4a6a8a', element: 'cryo', portrait: 'kaeya',
    lines: ['哦？看来你遇到了有趣的事。', '骑士团里可不全是老实人哦。', '需要帮忙的话，代价是一杯好酒。'] },
  { id: 'venti', name: '温迪', charId: 'venti', color: '#5aa88a', element: 'anemo', portrait: 'venti',
    lines: ['风啊，请为这位旅人捎去祝福。', '苹果酒的香气，最配午后的风。', '要听我弹一曲吗？三杯苹果酒一首哦。'] },
  { id: 'villager_inn', name: '旅店老板', charId: 'villager', color: '#c8a878', portrait: 'villager',
    lines: ['欢迎光临，远方的旅人。', '楼上的房间能看见风神像。', '今天的特供是松茸炖肉。'] },
  { id: 'villager_baker', name: '面包师', charId: 'villager', color: '#d8b890', portrait: 'villager',
    lines: ['刚出炉的蒙德烤面包，香不香？', '派蒙那小家伙总爱来蹭吃的。', '面粉要趁新鲜揉才劲道。'] },
  { id: 'villager_fish', name: '渔夫', charId: 'villager', color: '#b8a078', portrait: 'villager',
    lines: ['塞西莉亚湖的鱼可肥了。', '嘘——别把鱼吓跑。', '今天又钓了个寂寞。'] },
  { id: 'villager_flower', name: '花商', charId: 'villager', color: '#e0a8b8', portrait: 'villager',
    lines: ['甜甜花最适合送给喜欢的人啦。', '我的花，都是清晨刚采的。', '要不要带一束走？'] },
  { id: 'villager_sister', name: '修女', charId: 'villager', color: '#e8e0f0', portrait: 'villager',
    lines: ['愿风神护佑你的旅途。', '风雪虽冷，人心向暖。', '教堂的钟声，总能让人安心。'] },
  { id: 'villager_margaret', name: '玛格丽特', charId: 'villager', color: '#d8b8a0', portrait: 'villager',
    lines: ['我的小猫们又跑哪去了……', '谢谢你帮我找猫。', '它们最爱吃的就是鱼干了。'] },
  { id: 'villager_brewer', name: '酿酒师', charId: 'villager', color: '#c8a868', portrait: 'villager',
    lines: ['晨曦酒庄的葡萄，酿得出最好的酒。', '这坛新酒，保证让你难忘。', '好酒需要时间，也需要好果子。'] },
  { id: 'villager_hunter', name: '宝藏猎人', charId: 'villager', color: '#a88a68', portrait: 'villager',
    lines: ['嘿嘿，这附近的地图我熟得很。', '宝藏？什么宝藏？我没听说过。', '发财的路子，说来话长咯。'] },
];

export class NPCSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group(); this.group.name = 'npcs';
    ctx.scene.add(this.group);
    this.registrar = new InteractRegistrar(ctx);
    this.npcs = [];
    this._listeners = [];
    if (ctx.dev) this._buildDemo(); else this._buildWorld();
  }

  _buildWorld() {
    const spots = {
      jean: [10, 8], amber: [22, -10], kaeya: [-15, 12], venti: [5, -22],
      villager_inn: [-30, -5], villager_baker: [26, 20], villager_fish: [-10, -26],
      villager_flower: [36, -6], villager_sister: [-26, 16], villager_margaret: [0, 30],
      villager_brewer: [-6, -30], villager_hunter: [32, 16],
    };
    for (const def of NPC_DEFS) {
      const [x, z] = spots[def.id] ?? [0, 0];
      this._addNPC(def, x, z, 9);
    }
  }

  _buildDemo() {
    // 一排 NPC，展示游荡与气泡
    NPC_DEFS.forEach((def, i) => this._addNPC(def, -7.5 + i * 1.35, 8.5, 1.8));
  }

  _addNPC(def, x, z, wanderRadius) {
    const ctx = this.ctx;
    let ch = null, root = null;
    try { ch = ctx.characters?.createCharacter?.(ctx, def.charId, { scale: 1 }); } catch {}
    if (ch?.root) root = ch.root;
    const y = groundY(ctx, x, z);
    if (!root) { root = makeNPCPlaceholder(ctx, def.color); }
    root.position.set(x, y, z);
    this.group.add(root);

    // 游荡路径
    const waypoints = [[x, z]];
    for (let k = 0; k < 3; k++) {
      waypoints.push([x + (Math.random() * 2 - 1) * wanderRadius, z + (Math.random() * 2 - 1) * wanderRadius]);
    }
    // 气泡
    const bubble = makeBubble(ctx, '…');
    bubble.visible = false;
    root.add(bubble);

    const npc = {
      id: def.id, def, ch, root, height: ch?.height ?? 1.7,
      anim: ch?.anim ?? null, waypoints, target: 0, wait: 1 + Math.random() * 2,
      bubble, bubbleTimer: 3 + Math.random() * 6, talkTimer: 0, handle: null,
    };
    try { npc.anim?.play?.('idle', { loop: true }); } catch {}
    npc.handle = this.registrar.register({
      pos: root.position, radius: 2.4, label: '与 ' + def.name + ' 交谈', icon: 'talk', once: false,
      onInteract: () => this._talk(npc),
    });
    this.npcs.push(npc);
    return npc;
  }

  _talk(npc) {
    const ctx = this.ctx;
    ctx.events?.emit('npc:talk', { id: npc.id, npc });
    // 任务系统若需要这个 NPC（接取或推进），则隐藏闲聊，避免双重对话
    if (ctx.quests?.wantsNPC?.(npc.id) || ctx.quests?.hasAcceptNPC?.(npc.id)) return;
    const lines = this._pick(npc.def.lines);
    speak(ctx, { speaker: npc.def.name, portrait: npc.def.portrait ?? 'villager', element: npc.def.element, lines });
  }
  _pick(lines) {
    const a = lines.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, 2);
  }

  _setAnim(npc, clip) {
    try {
      if (npc.anim && !npc.anim.isPlaying?.(clip)) npc.anim.play?.(clip, { loop: true, fade: 0.2 });
    } catch {}
  }

  update(dt) {
    const ctx = this.ctx;
    this.registrar.flush();
    for (const npc of this.npcs) {
      try { npc.ch?.update?.(dt); } catch {}
      const wp = npc.waypoints[npc.target];
      const dx = wp[0] - npc.root.position.x, dz = wp[1] - npc.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.3) {
        const speed = 1.15;
        npc.root.position.x += (dx / d) * speed * dt;
        npc.root.position.z += (dz / d) * speed * dt;
        npc.root.rotation.y = Math.atan2(dx, dz);
        this._setAnim(npc, 'walk');
      } else {
        npc.wait -= dt;
        this._setAnim(npc, 'idle');
        if (npc.wait <= 0) { npc.target = (npc.target + 1) % npc.waypoints.length; npc.wait = 1.5 + Math.random() * 3; }
      }
      // 闲聊气泡
      npc.bubbleTimer -= dt;
      if (npc.bubbleTimer <= 0) {
        npc.bubble.visible = true;
        npc.talkTimer = 2.4;
        npc.bubbleTimer = 7 + Math.random() * 8;
        const line = npc.def.lines[Math.floor(Math.random() * npc.def.lines.length)];
        ctx.ui?.subtitle?.(npc.def.name + '：' + line, 2600);
      }
      if (npc.talkTimer > 0) { npc.talkTimer -= dt; if (npc.talkTimer <= 0) npc.bubble.visible = false; }
      // 保持交互点跟随
      if (npc.handle?.pos) { npc.handle.pos.x = npc.root.position.x; npc.handle.pos.y = npc.root.position.y; npc.handle.pos.z = npc.root.position.z; }
    }
  }

  dispose() {
    this.registrar.clear();
    this.ctx.scene.remove(this.group);
  }
}
