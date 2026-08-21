(async () => {
  const out = [];
  const P = (k, v) => out.push(String(k).padEnd(11) + ' ' + v);
  const $$ = (id) => document.getElementById(id);
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const wait = async (s) => { const t0 = performance.now(); while (performance.now() - t0 < s * 1000) await frame(); };
  const num = (id) => parseFloat(($$(id).textContent || '').replace(/[^-\d.]/g, ''));
  try {
    let boot = 0;
    while (boot < 900 && !window.__DBG) { await frame(); boot++; }
    if (!window.__DBG) { P('FATAL', 'no __DBG'); return out; }
    const D = window.__DBG, C = D.CAR, W = D.wheels;
    const sum = () => W[0].force + W[1].force + W[2].force + W[3].force;
    const trav = () => W.map((w) => ((0.42 - w.susLen) * 1000).toFixed(0)).join('/');
    const forces = () => W.map((w) => w.force.toFixed(0)).join('/');
    P('boot', 'frames=' + boot + '  K=' + D.K.toFixed(0) + ' N/m  C=' + D.C.toFixed(0) + ' N·s/m  amp=' + D.amp);

    /* 1. 静止平衡 */
    D.reset(); await wait(3.0);
    const Wt = 1400 * 9.81;
    P('静置', '接地=' + D.grounded + '/4  |v|=' + C.vel.length().toFixed(4) + ' m/s  行程mm=' + trav());
    P('力平衡', 'ΣN=' + sum().toFixed(0) + ' N  mg=' + Wt.toFixed(0) + ' N  ΣN/mg=' + (sum() / Wt).toFixed(4) + '  各轮N=' + forces());
    P('静沉量', '理论mg/4K=' + (Wt / 4 / D.K * 1000).toFixed(1) + 'mm  四轮实测=' +
      W.map((w) => ((0.32 - w.susLen) * 1000).toFixed(1)).join('/') + 'mm');
    P('姿态', 'pitch=' + $$('sPitch').textContent + ' roll=' + $$('sRoll').textContent + ' 离地=' + $$('sAlt').textContent);

    /* 2. 加速 + 轮胎滚动一致性 */
    const z0 = C.pos.z, spin0 = W[0].spinA, t0 = performance.now();
    D.setKey('w', true);
    const samp = [];
    for (let i = 0; i < 10; i++) { await wait(0.5); samp.push(num('dSpeed')); }
    P('加速', 'km/h=' + samp.join(',') + '  RPM=' + num('dRpm') + ' 挡=' + $$('dGear').textContent);
    P('滚动匹配', '位移=' + (C.pos.z - z0).toFixed(2) + 'm  轮转=' + (W[0].spinA - spin0).toFixed(1) + 'rad  ωR/v=' +
      (((W[0].spinA - spin0) * 0.40) / Math.max(0.01, C.pos.z - z0)).toFixed(3));
    /* 3. 转向 / 载荷转移 */
    D.setKey('d', true); await wait(1.2);
    let lr = 0, rollMax = 0, samples = 0;
    for (let i = 0; i < 40; i++) {
      await frame();
      if (D.grounded === 4) { lr += (W[0].force - W[1].force); samples++; }
      rollMax = Math.max(rollMax, Math.abs(num('sRoll')));
    }
    P('转向', '转向角=' + $$('sSteer').textContent + ' 横摆率=' + C.omega.y.toFixed(2) + 'rad/s 最大侧倾=' + rollMax.toFixed(1) + '°');
    P('载荷转移', '四轮着地样本=' + samples + '  左前-右前平均差=' + (samples ? (lr / samples).toFixed(0) : 'n/a') + ' N  当前各轮N=' + forces());
    D.setKey('d', false);
    /* 4. 制动 */
    const vB = num('dSpeed');
    D.setKey('w', false); D.setKey('s', true); await wait(2.2);
    P('制动', vB.toFixed(0) + ' -> ' + num('dSpeed') + ' km/h');
    D.setKey('s', false); await wait(0.6);
    D.reset(); await wait(2.5);
    P('驻车', '静止 3s 后 |v|=' + C.vel.length().toFixed(4) + ' m/s（驻车阻力抑制坡道蠕动）');

    /* 5. 坡道起跳 */
    D.reset(); D.teleport(0, -4); C.quat.set(0, 1, 0, 0); await wait(1.0);
    D.setKey('w', true);
    let air = 0, maxAir = 0, maxPitch = 0, maxH = 0, airTotal = 0, vTop = 0;
    const tA = performance.now();
    while (performance.now() - tA < 6500) {
      await frame();
      if (D.grounded === 0) { air++; airTotal++; maxAir = Math.max(maxAir, air); } else air = 0;
      maxPitch = Math.max(maxPitch, Math.abs(num('sPitch')));
      maxH = Math.max(maxH, num('sAlt'));
      vTop = Math.max(vTop, num('dSpeed'));
    }
    D.setKey('w', false);
    P('坡道飞跃', '最长连续离地=' + maxAir + '帧  离地总帧=' + airTotal + '  最大俯仰=' + maxPitch.toFixed(1) + '°  最大离地=' +
      maxH.toFixed(2) + 'm  峰值车速=' + vTop.toFixed(0) + 'km/h  z=' + C.pos.z.toFixed(1));
    /* 6. 水坑 + 粒子 */
    D.reset(); D.teleport(D.dip.x, D.dip.z - 11); C.quat.set(0, 0, 0, 1); await wait(1.0);
    D.setKey('w', true);
    let maxP = 0, wetF = 0, gripSeen = '', slipMax = 0;
    const tW = performance.now();
    while (performance.now() - tW < 5500) {
      await frame();
      maxP = Math.max(maxP, D.parts.live);
      if (C.wet > 0) { wetF++; gripSeen = $$('sGrip').textContent; }
      slipMax = Math.max(slipMax, W[2].slip, W[3].slip);
    }
    D.setKey('w', false);
    P('水坑涉水', '涉水帧=' + wetF + '  峰值粒子=' + maxP + '/320  附着显示=' + (gripSeen || '未涉水') +
      '  最大滑移=' + slipMax.toFixed(2) + '  水面y=' + D.waterY.toFixed(2) + '  HUD=' + $$('dParts').textContent);
    D.teleport(0, 6); await wait(2.2);
    P('粒子回收', '离开水坑后存活=' + D.parts.live + ' （生命周期结束应归零）');

    /* 7. 滑块 */
    D.reset(); await wait(2.0);
    const rec = [];
    for (const k of ['1', '55', '100']) {
      $$('sldK').value = k; $$('sldK').dispatchEvent(new Event('input')); await wait(2.0);
      rec.push('K' + k + ':' + D.K.toFixed(0) + 'N/m 行程' + ((0.42 - W[0].susLen) * 1000).toFixed(0) + 'mm ' + $$('vFn').textContent);
    }
    P('刚度K', rec.join(' | '));
    const zr = [];
    for (const c of ['1', '42', '100']) { $$('sldC').value = c; $$('sldC').dispatchEvent(new Event('input')); await frame(); zr.push('C' + c + ':' + D.C.toFixed(0) + ' ζ=' + $$('vZeta').textContent.split(' ')[0]); }
    P('阻尼C', zr.join(' | '));
    $$('sldK').value = '55'; $$('sldK').dispatchEvent(new Event('input'));
    $$('sldC').value = '42'; $$('sldC').dispatchEvent(new Event('input'));
    const hs = [];
    for (const a of ['0.5', '1', '2']) { $$('sldA').value = a; $$('sldA').dispatchEvent(new Event('input')); await wait(0.5); hs.push('amp' + a + ':h=' + D.hAt(6, -4).toFixed(3)); }
    $$('sldA').value = '1'; $$('sldA').dispatchEvent(new Event('input')); await wait(0.4);
    P('地形幅度', hs.join('  ') + '  (采样点 x=6,z=-4)');
    P('地形特征', '坡道顶 h(0,-25)=' + D.hAt(0, -25).toFixed(2) + 'm  水坑底 h(18,11)=' + D.hAt(18, 11).toFixed(2) + 'm');

    /* 8. 昼夜 / 大灯 */
    D.tod = 0.78; await wait(0.6);
    const nightVal = D.night, li = D.lights[0].intensity, bo = D.beams[0].material.opacity;
    D.tod = 0.30; await wait(0.5);
    P('昼夜循环', 'tod=0.78 -> night=' + nightVal.toFixed(2) + ' 大灯强度=' + li.toFixed(2) + ' 光锥不透明度=' + bo.toFixed(3) +
      '  白天 night=' + D.night.toFixed(2));
    /* 9. 图表 / 渲染 / 性能 */
    const cv = $$('forceChart'), g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0, cyan = 0, amber = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      if (d[i + 2] > 140 && d[i + 2] > d[i] + 40) cyan++;
      if (d[i] > 150 && d[i + 1] > 90 && d[i + 2] < 120) amber++;
    }
    P('受力柱状图', cv.width + 'x' + cv.height + ' 着色像素=' + lit + ' 青柱=' + cyan + ' 琥珀=' + amber);
    const info = D.renderer.info;
    P('渲染统计', '三角面=' + info.render.triangles + ' 绘制调用=' + info.render.calls + ' 纹理=' + info.memory.textures + ' 几何=' + info.memory.geometries);
    P('性能', $$('dFps').textContent + '  阴影=' + D.renderer.shadowMap.enabled + '  像素比=' + D.renderer.getPixelRatio());
    P('DOM', '滑块=' + document.querySelectorAll('input[type=range]').length + ' 面板=' + document.querySelectorAll('.panel').length +
      ' canvas=' + document.querySelectorAll('canvas').length + ' 全屏=' + (document.querySelector('#app canvas').width > 0));
    /* 10. 模型自检：按材质统计构件 + 车轮可视位置与物理一致性 */
    const cnt = {};
    D.scene.traverse((o) => { if (o.isMesh) { for (const k in D.mats) if (o.material === D.mats[k]) cnt[k] = (cnt[k] || 0) + 1; } });
    P('构件统计', Object.keys(cnt).map((k) => k + '=' + cnt[k]).join(' '));
    let werr = 0, wy = [];
    for (const w of W) {
      const p = w.pivot.getWorldPosition(D.V3(0, 0, 0));
      wy.push((p.y - D.hAt(p.x, p.z)).toFixed(3));
      werr = Math.max(werr, Math.abs(p.y - D.hAt(p.x, p.z) - 0.40));
    }
    P('车轮定位', '轮心离地=' + wy.join('/') + 'm （胎半径0.40）  最大偏差=' + (werr * 1000).toFixed(0) + 'mm');
    const cl = W.map((w) => w.coil.geometry.attributes.position.array[1].toFixed(3)).join('/');
    P('弹簧网格', '四条螺旋弹簧首点y=' + cl + '  顶点数=' + W[0].coil.geometry.attributes.position.count);
    P('errs', window.__errs && window.__errs.length ? window.__errs.join('|') : 'none');
    P('DONE', 'ok');
  } catch (e) { out.push('EXCEPTION ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e))); }
  return out;
})()