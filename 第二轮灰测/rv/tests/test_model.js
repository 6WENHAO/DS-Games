const MESH = require('../src/mesh.js');
const RV = require('../src/rv.js');
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); fails++; } else console.log('ok  : ' + m); };

const t0 = Date.now();
const g = RV.build();
const ms = Date.now() - t0;
console.log(`  构建耗时 ${ms}ms，三角形 ${g.triCount}，部件 ${g.parts.length}，分组 ${Object.keys(g.groupRanges).length}`);

// 1. 规模与数值健全
ok(g.triCount > 110000 && g.triCount < 900000, `三角形数量合理：${g.triCount}`);
ok([g.pos, g.nrm, g.col, g.mat].every(a => a.every(v => isFinite(v))), '所有顶点数据均为有限值');
let unit = true;
for (let i = 0; i < g.nrm.length; i += 3) { const l = Math.hypot(g.nrm[i], g.nrm[i+1], g.nrm[i+2]); if (Math.abs(l - 1) > 0.03) { unit = false; break; } }
ok(unit, '所有法线均为单位向量');
ok(ms < 4000, `构建速度可接受（${ms}ms）`);

// 2. 车体尺寸（真实 Bounder ≈ 长 7.6-8m / 宽 2.44m / 高 3.2m）
// 车体尺寸以车身壳体为准（后视镜外伸单独统计）
const bodyParts = g.parts.filter(p => ['bodyShell', 'noseCap', 'rearWall', 'roofAC'].includes(p.name));
const bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
bodyParts.forEach(p => { for (let k = 0; k < 3; k++) { bb[k] = Math.min(bb[k], p.bbox[k]); bb[k+3] = Math.max(bb[k+3], p.bbox[k+3]); } });
const vehParts = g.parts.filter(p => !['desert', 'rocks', 'tracks'].includes(p.name));
const vTop = Math.max(...vehParts.map(p => p.bbox[4]));
const L = bb[3] - bb[0], W = bb[5] - bb[2], H = vTop;      // 高度自地面量起
console.log(`  车体包围盒：长 ${L.toFixed(2)}m 宽 ${W.toFixed(2)}m 高 ${H.toFixed(2)}m`);
ok(L > 7.2 && L < 8.8, `车长 ${L.toFixed(2)}m 接近真实 25 英尺房车`);
ok(W > 2.3 && W < 2.9, `车宽 ${W.toFixed(2)}m 合理（真实 2.44m）`);
const mir = g.parts.find(p => p.name === 'mirrors');
ok(mir && mir.bbox[5] - mir.bbox[2] > 2.6, `含后视镜总宽 ${(mir.bbox[5] - mir.bbox[2]).toFixed(2)}m（外伸后视镜）`);
ok(H > 2.9 && H < 3.7, `车高 ${H.toFixed(2)}m 合理`);
ok(L / H > 2.0 && L / H < 3.0, `长高比 ${(L / H).toFixed(2)} 符合房车比例（不是方块）`);

// 3. "避免小方块堆砌"的量化自检
ok(g.stats.curvedRatio > 0.55, `曲面三角形占比 ${(g.stats.curvedRatio * 100).toFixed(1)}%（> 55%）`);
const nset = new Set();
for (let i = 0; i < g.nrm.length; i += 3) nset.add([g.nrm[i], g.nrm[i+1], g.nrm[i+2]].map(v => v.toFixed(2)).join(','));
ok(nset.size > 3000, `法线方向多样性 ${nset.size} 种（方块堆砌只会有个位数）`);
const axisAligned = (() => {
  let n = 0, tot = 0;
  for (let i = 0; i < g.nrm.length; i += 3) {
    tot++;
    const a = [Math.abs(g.nrm[i]), Math.abs(g.nrm[i+1]), Math.abs(g.nrm[i+2])].sort((x, y) => y - x);
    if (a[0] > 0.999) n++;
  }
  return n / tot;
})();
ok(axisAligned < 0.42, `轴对齐法线占比 ${(axisAligned * 100).toFixed(1)}%（越低越不像方块堆）`);

// 4. 高低错落：部件在竖直方向分层
const levels = new Set(g.parts.map(p => Math.round(((p.bbox[1] + p.bbox[4]) / 2) * 5) / 5));
ok(levels.size >= 14, `部件中心分布在 ${levels.size} 个不同高度层（高低错落）`);
const yMin = Math.min(...g.parts.map(p => p.bbox[1])), yMax = Math.max(...g.parts.map(p => p.bbox[4]));
ok(yMax - yMin > 3.0, `整体竖向跨度 ${(yMax - yMin).toFixed(2)}m`);

// 5. 内容丰富度：分组与部件
const need = ['chassis', 'shellNear', 'shellFar', 'roof', 'front', 'rear', 'glass', 'interior', 'lab', 'cab', 'props', 'ground'];
const missing = need.filter(n => !g.groupRanges[n]);
ok(missing.length === 0, '关键分组齐全' + (missing.length ? '：缺 ' + missing.join(',') : ''));
ok(g.parts.length >= 45, `部件数 ${g.parts.length} ≥ 45`);
const hots = g.parts.filter(p => p.kind === 'hot');
ok(hots.length >= 12, `可标注热点 ${hots.length} 个：` + hots.slice(0, 6).map(h => h.name).join('/') + ' …');
ok(Object.keys(RV.LABELS).length >= 15, `中文标签 ${Object.keys(RV.LABELS).length} 条`);
const labeledMissing = Object.keys(RV.LABELS).filter(k => !g.parts.some(p => p.name === k));
ok(labeledMissing.length === 0, '所有标签都能对应到实际部件' + (labeledMissing.length ? '：' + labeledMissing.join(',') : ''));

// 6. 剖切可行性：近侧壳与车顶可隐藏，且内部有足量几何
const nearTris = g.groupRanges.shellNear.count / 3, roofTris = g.groupRanges.roof.count / 3;
const innerTris = (g.groupRanges.interior.count + g.groupRanges.lab.count + g.groupRanges.cab.count + g.groupRanges.props.count) / 3;
console.log(`  近侧壳 ${nearTris} 三角形 / 车顶 ${roofTris} / 内部场景 ${innerTris}`);
ok(nearTris > 2000 && roofTris > 1000, '近侧壳与车顶均为独立分组（可剖切）');
ok(innerTris > 25000, `内部场景三角形 ${innerTris} 足够丰富`);

// 7. 关键部件的位置关系（模型自洽）
const P = n => g.parts.find(p => p.name === n);
const cx = p => (p.bbox[0] + p.bbox[3]) / 2, cy = p => (p.bbox[1] + p.bbox[4]) / 2, cz = p => (p.bbox[2] + p.bbox[5]) / 2;
ok(cx(P('steeringWheel')) > cx(P('dinette')), '方向盘在餐桌前方（车头方向）');
ok(cy(P('roofAC')) > cy(P('labBench')), '顶置空调高于实验台');
ok(cy(P('roundFlask')) > cy(P('labBench')), '烧瓶置于台面之上');
ok(Math.abs(cz(P('roundFlask')) - cz(P('condenser'))) < 0.5, '冷凝管紧邻烧瓶');
ok(cz(P('entryDoor')) > 1.0, '侧门位于车身右侧（+Z）');
ok(cy(P('wheel1')) < 1.0 && cy(P('wheel1')) > 0.1, '车轮位于底部');
const fl = P('roundFlask');
ok(fl.bbox[0] > -4 && fl.bbox[3] < 4 && fl.bbox[1] > 0.7 && fl.bbox[4] < 2.6, '烧瓶完全位于车厢内部空间');
const lamp = P('ceilingLamp');
ok(cy(lamp) > 2.2, '顶灯贴近车顶内侧');

// 8. 自发光材质（夜间模式需要）
let emis = 0;
for (let i = 2; i < g.mat.length; i += 3) if (g.mat[i] > 0.3) emis++;
ok(emis > 300, `自发光顶点 ${emis} 个（车灯/顶灯/火焰/仪表）`);

console.log(fails === 0 ? '\n模型测试全部通过' : '\n失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
