(async () => {
  const out = [];
  const P = (k, v) => out.push(k.padEnd(10) + ' ' + v);
  const $$ = (id) => document.getElementById(id);
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const frames = async (n) => { for (let i = 0; i < n; i++) await frame(); };
  const num = (id) => parseFloat(($$(id).textContent || '').replace(/[^-\d.]/g, ''));
  const st = $$('sTravel'), ss = $$('sSteer');
  try {
    let boot = 0;
    while (boot < 600 && (!/THREE r/.test($$('stVer').textContent) || num('tCamber') === 0)) { await frame(); boot++; }
    P('boot', 'frames=' + boot + ' ' + $$('stVer').textContent.trim() + ' 一致性残差=' + $$('stRes').textContent + 'mm 约束=' + $$('stRes2').textContent);
    P('static', 'camber=' + num('tCamber').toFixed(3) + ' caster=' + num('tCaster').toFixed(3) + ' kpi=' + num('tKpi').toFixed(3) + ' rc=' + num('tRc') + 'mm');
    // 轮跳扫掠
    for (const v of [50, 25, -25, -50]) {
      st.value = String(v); st.dispatchEvent(new Event('input')); await frames(3);
      P('travel' + v, 'h=' + num('tTravel').toFixed(1) + ' camber=' + num('tCamber').toFixed(3) + ' toe=' + num('tToe').toFixed(3) +
        ' dTrack=' + num('tTrack').toFixed(2) + ' spring=' + num('tSpring').toFixed(1) + ' res=' + $$('stRes').textContent);
    }
    st.value = '0'; st.dispatchEvent(new Event('input')); await frames(2);
    // 转向扫掠
    for (const v of [30, -30]) {
      ss.value = String(v); ss.dispatchEvent(new Event('input')); await frames(8);
      P('steer' + v, 'toe=' + num('tToe').toFixed(2) + ' camber=' + num('tCamber').toFixed(2) + ' res=' + $$('stRes').textContent);
    }
    ss.value = '15'; ss.dispatchEvent(new Event('input')); await frames(8);
    st.value = '45'; st.dispatchEvent(new Event('input')); await frames(3);
    P('coupled', '15° + 45mm -> toe=' + num('tToe').toFixed(3) + ' camber=' + num('tCamber').toFixed(3) + ' res=' + $$('stRes').textContent);
    ss.value = '0'; ss.dispatchEvent(new Event('input')); await frames(8);
    st.value = '0'; st.dispatchEvent(new Event('input')); await frames(2);
    // 颠簸冲击（二阶欠阻尼）
    const t0 = performance.now();
    $$('btnBump').click();
    let peak = 0, cross = 0, prev = 0, n = 0; const wave = [];
    while (n < 1200) {
      await frame(); n++;
      const v = num('tTravel');
      if (n % 5 === 0 && wave.length < 24) wave.push(Math.round(v));
      if (Math.abs(v) > peak) peak = Math.abs(v);
      if (prev !== 0 && v !== 0 && Math.sign(v) !== Math.sign(prev)) cross++;
      prev = v;
      if ($$('stMode').textContent.trim() === 'IDLE' && n > 20) break;
    }
    P('bump', 'peak=' + peak.toFixed(1) + 'mm 过零=' + cross + ' 帧=' + n + ' 时长=' + ((performance.now() - t0) / 1000).toFixed(2) + 's 末值=' + num('tTravel').toFixed(2) + 'mm mode=' + $$('stMode').textContent.trim());
    P('waveform', wave.join(','));
    // 图表是否真的画上了像素
    const kc = $$('kinChart'), g = kc.getContext('2d');
    const d = g.getImageData(0, 0, kc.width, kc.height).data;
    let lit = 0, cy = 0, am = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
      if (d[i + 2] > 120 && d[i + 2] > d[i] + 30) cy++;
      if (d[i] > 150 && d[i + 1] > 90 && d[i + 2] < 110) am++;
    }
    P('kinChart', kc.width + 'x' + kc.height + ' 着色像素=' + lit + ' 青色曲线=' + cy + ' 琥珀标记=' + am);
    const tc = $$('timeChart'), g2 = tc.getContext('2d');
    const d2 = g2.getImageData(0, 0, tc.width, tc.height).data;
    let lit2 = 0, gr = 0;
    for (let i = 0; i < d2.length; i += 4) { if (d2[i] + d2[i + 1] + d2[i + 2] > 60) lit2++; if (d2[i + 1] > 120 && d2[i + 1] > d2[i] + 40) gr++; }
    P('timeChart', tc.width + 'x' + tc.height + ' 着色像素=' + lit2 + ' 绿色波形=' + gr);
    // 视图 / 开关 / 复位
    document.querySelector('[data-view="front"]').click(); await frames(2);
    P('viewBtn', document.querySelector('[data-view="front"]').className.trim());
    for (const id of ['cbWheel', 'cbTrace', 'cbPoints', 'cbAxis', 'cbGrid', 'cbPatch']) {
      const c = $$(id); c.checked = !c.checked; c.dispatchEvent(new Event('change')); await frame();
      c.checked = !c.checked; c.dispatchEvent(new Event('change')); await frame();
    }
    P('toggles', 'all 6 toggled twice, no throw');
    $$('sZeta').value = '0.08'; $$('sZeta').dispatchEvent(new Event('input'));
    $$('sRate').value = '80'; $$('sRate').dispatchEvent(new Event('input'));
    $$('sMass').value = '250'; $$('sMass').dispatchEvent(new Event('input')); await frames(2);
    P('dynParam', 'fn=' + $$('dFn').textContent + ' fd=' + $$('dFd').textContent + ' c=' + $$('dC').textContent + ' δ=' + $$('dDec').textContent);
    $$('btnReset').click(); await frames(3);
    P('reset', 'h=' + num('tTravel').toFixed(2) + ' camber=' + num('tCamber').toFixed(3) + ' mode=' + $$('stMode').textContent.trim());
    P('fps', $$('stFps').textContent);
    P('layout', 'stage=' + Math.round(document.getElementById('stage').clientWidth / innerWidth * 100) + '% panel=' +
      Math.round(document.getElementById('panel').clientWidth / innerWidth * 100) + '% glCanvas=' + document.querySelector('#viewport canvas').width + 'x' + document.querySelector('#viewport canvas').height);
    P('DONE', 'ok');
  } catch (e) { P('EXCEPTION', (e && e.stack ? e.stack.split('\n').slice(0, 2).join(' | ') : String(e))); }
  return out;
})()