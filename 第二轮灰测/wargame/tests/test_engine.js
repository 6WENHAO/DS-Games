/* 推演内核测试：地图完整性、指令合法性、AI 对局稳定性与平衡 */
const S = require('../src/scenario.js');
const E = require('../src/engine.js');
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); fails++; } else console.log('ok  : ' + m); };

/* 1. 地图与要点 */
{
  const { hexes, byKey } = E.MAP;
  ok(hexes.length > 100, `地图格数 ${hexes.length} > 100`);
  const seas = hexes.filter(h => h.terrain.id === 'sea' || h.terrain.id === 'strait').length;
  ok(seas > 20, `海域格 ${seas} 个`);
  let missing = S.SITES.filter(s => !byKey.has(s.c + ',' + s.r));
  ok(missing.length === 0, '所有要点都落在有效地图格上' + (missing.length ? '：' + missing.map(m => m.name).join(',') : ''));
  // 地理合理性：特拉维夫在德黑兰西侧；霍尔木兹与阿巴斯港相邻；曼德海峡靠南
  const g = id => S.SITES.find(s => s.id === id);
  ok(g('telaviv').c < g('tehran').c, '特拉维夫位于德黑兰以西');
  ok(E.hexDist(g('hormuz'), g('bandar')) <= 1, '霍尔木兹与阿巴斯港相邻');
  ok(g('mandab').r > g('haifa').r + 4, '曼德海峡远在南方');
  ok(E.hexDist(g('fordow'), g('tehran')) <= 3, '福尔多在德黑兰附近纵深');
  const nukes = S.SITES.filter(s => s.kind === 'nuke');
  ok(nukes.length >= 4 && nukes.some(s => s.hard === 3), `核设施 ${nukes.length} 处，含深埋目标`);
}

/* 2. 单位与指令 */
{
  const st = E.createGame({ seed: 7 });
  ok(st.units.length >= 25, `双方单位 ${st.units.length} 个`);
  ok(st.units.filter(u => u.side === 'blue').length >= 10 && st.units.filter(u => u.side === 'red').length >= 12, '双方兵力均衡建立');
  const b2 = st.byId('us-bomb');
  const t = E.targetsFor(st, b2, 'strike').find(x => x.id === 'fordow');
  ok(!!t, 'B-2 可打击福尔多（射程覆盖）');
  ok(E.setOrder(st, 'us-bomb', 'strike', t), '可为 B-2 下达打击指令');
  const hz = st.byId('hz-rkt');
  ok(E.targetsFor(st, hz, 'strike').some(x => x.id === 'telaviv'), '真主党火箭可覆盖特拉维夫');
  ok(!E.targetsFor(st, hz, 'strike').some(x => x.id === 'tehran'), '真主党不会把德黑兰列为目标');
  const ad = st.byId('il-arrow');
  ok(E.orderTypesFor(st, ad).every(o => ['defend', 'hold', 'move'].indexOf(o.key) >= 0), '防空单位只能防御/待机/转场（不能主动打击）');
  ok(E.targetsFor(st, st.byId('us-cvn1'), 'move').every(t => {
    const h = E.MAP.byKey.get(t.id); return h.terrain.id === 'sea' || h.terrain.id === 'strait';
  }), '航母只能在海域机动');
}

/* 3. 深埋目标必须钻地弹 */
{
  const st1 = E.createGame({ seed: 11 });
  const st2 = E.createGame({ seed: 11 });
  const fd = st1.siteById('fordow');
  // 常规空袭 vs 钻地弹，各打 12 次比较平均损伤
  let sumAir = 0, sumBunker = 0;
  for (let i = 0; i < 12; i++) {
    const a = E.createGame({ seed: 100 + i });
    E.setOrder(a, 'il-af1', 'strike', E.targetsFor(a, a.byId('il-af1'), 'strike').find(x => x.id === 'fordow'));
    E.resolveTurn(a); sumAir += a.siteById('fordow').dmg - 55;
    const b = E.createGame({ seed: 100 + i });
    E.setOrder(b, 'us-bomb', 'strike', E.targetsFor(b, b.byId('us-bomb'), 'strike').find(x => x.id === 'fordow'));
    E.resolveTurn(b); sumBunker += b.siteById('fordow').dmg - 55;   // 初始损伤 55
  }
  ok(sumBunker > sumAir * 1.8, `钻地弹对深埋目标效果显著（B-2 均增 ${(sumBunker / 12).toFixed(1)} vs 常规均增 ${(sumAir / 12).toFixed(1)}）`);
  void fd; void st2;
}

/* 4. 饱和齐射消耗拦截弹 */
{
  const st = E.createGame({ seed: 21 });
  const before = st.meters.intercept;
  const u = st.byId('ir-msl1');
  E.setOrder(st, 'ir-msl1', 'salvo', E.targetsFor(st, u, 'salvo').find(x => x.id === 'telaviv'));
  const u2 = st.byId('ir-uav');
  E.setOrder(st, 'ir-uav', 'salvo', E.targetsFor(st, u2, 'salvo').find(x => x.id === 'telaviv'));
  E.resolveTurn(st);
  ok(st.meters.intercept < before, `齐射后拦截弹库存下降 ${before} → ${st.meters.intercept}`);
  ok(st.meters.redMissiles < S.METERS.redMissiles, '红方导弹存量随之消耗');
}

/* 5. 谈判上限的结构性僵局 */
{
  const st = E.createGame({ seed: 31 });
  const cap0 = E.talksCap(st);
  E.applyPolitical(st, 'blue', 'b-halt');
  const cap1 = E.talksCap(st);
  E.applyPolitical(st, 'red', 'r-heu');
  const cap2 = E.talksCap(st);
  ok(cap1 > cap0 && cap2 > cap1, `谈判上限随双方红线让步提升：${cap0} → ${cap1} → ${cap2}`);
  for (let i = 0; i < 12; i++) E.addMeter(st, 'talks', +20);
  ok(st.meters.talks <= cap2, '谈判进度不会突破当前上限');
}

/* 6. AI 对局：稳定性、终止性、平衡性 */
{
  const N = 400;
  const tally = { blue: 0, red: 0, draw: 0, none: 0 };
  const codes = {};
  let maxTurn = 0, nanBad = 0, longest = 0, t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const st = E.autoPlay(1000 + i);
    if (!st.over) { nanBad++; continue; }
    tally[st.over.winner]++;
    codes[st.over.code] = (codes[st.over.code] || 0) + 1;
    maxTurn = Math.max(maxTurn, st.turn);
    longest = Math.max(longest, st.log.length);
    for (const k in st.meters) if (!isFinite(st.meters[k])) nanBad++;
  }
  const ms = Date.now() - t0;
  console.log(`  ${N} 局 AI 对局用时 ${ms}ms，结局分布 ` + JSON.stringify(tally) + '，判定条件 ' + JSON.stringify(codes));
  ok(nanBad === 0, '所有对局正常终止且指标无 NaN');
  ok(maxTurn <= S.meta.maxTurns + 1, `回合数不超过上限（最大 ${maxTurn}）`);
  ok(tally.blue > N * 0.05 && tally.red > N * 0.05, `双方都有可观胜率（蓝 ${tally.blue} / 红 ${tally.red} / 和 ${tally.draw} / 灾难 ${tally.none}）`);
  ok(Object.keys(codes).length >= 3, `出现 ${Object.keys(codes).length} 种不同结局类型`);
}

/* 7. 确定性：同种子同结果 */
{
  const a = E.autoPlay(4242), b = E.autoPlay(4242);
  ok(JSON.stringify(a.meters) === JSON.stringify(b.meters) && a.over.code === b.over.code,
    '相同种子得到完全相同的推演结果（可复盘）');
  const c = E.autoPlay(4243);
  ok(JSON.stringify(c.meters) !== JSON.stringify(a.meters), '不同种子产生不同走势');
}

/* 8. 代理人政治代价 */
{
  const st = E.createGame({ seed: 55 });
  const hm = st.byId('hm-gaza');
  ok(hm.status === 'ceasefire', '哈马斯初始处于停火状态');
  const talks0 = st.meters.talks, civ0 = st.meters.civ;
  E.setOrder(st, 'hm-gaza', 'raid', E.targetsFor(st, hm, 'raid')[0]);
  E.resolveTurn(st);
  ok(st.meters.talks < talks0 && st.meters.civ > civ0, '打破停火导致谈判倒退、人道压力上升');
}
console.log(fails === 0 ? '\n内核测试全部通过' : '\n失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
