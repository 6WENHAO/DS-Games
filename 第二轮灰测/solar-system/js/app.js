/* =======================================================================
 *  app.js  —  启动与主循环
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const $ = (id) => document.getElementById(id);

  let gl = null, canvas = null, running = false;
  let last = 0, fpsAcc = 0, fpsN = 0, fpsShown = 0;

  function fail(msg) {
    SS.diag.push('error', msg);
    const l = $('loading-txt');
    if (l) l.textContent = msg;
    $('loading').classList.remove('hide');
  }

  window.addEventListener('error', (e) => {
    SS.diag.push('error', '运行时错误：' + (e.message || e.error) +
      (e.filename ? ' @ ' + e.filename.split('/').pop() + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', (e) => {
    SS.diag.push('error', '未处理的 Promise 拒绝：' + (e.reason && e.reason.message ? e.reason.message : e.reason));
  });

  function init() {
    canvas = $('gl');
    gl = SS.GL.createContext(canvas);
    if (!gl) { fail('无法创建 WebGL2 上下文'); return; }

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      running = false;
      fail('WebGL 上下文丢失（可能是显卡驱动重置）。刷新页面即可恢复。');
    });

    // URL 参数：?q=low|mid|high|ultra 强制画质（低端设备 / 无头测试用）
    const qs = new URLSearchParams(location.search);
    const q = qs.get('q');
    if (q && SS.R.QUALITY[q]) {
      SS.R.quality = q;
      const sel = $('opt-quality');
      if (sel) sel.value = q;
    }

    SS.World.init();
    SS.Cam.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    if (!SS.R.init(gl, canvas)) { fail('着色器初始化失败，详见下方诊断信息'); return; }
    SS.R.resize(window.innerWidth, window.innerHeight, true);
    SS.Cam.setFocus(SS.World.byId.earth, true);
    SS.Cam.update(0);
    SS.UI.init();
    applyQueryParams(qs);

    window.addEventListener('resize', () => {
      SS.R.resize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('visibilitychange', () => { last = performance.now(); });

    running = true;
    last = performance.now();
    requestAnimationFrame(loop);

    setTimeout(() => {
      $('loading').classList.add('hide');
      SS.UI.toast('欢迎。左侧选择天体，在星球表面点击选定撞击点，然后投放陨石。');
    }, 260);
  }

  /* ---------------------------------------------------------------- *
   *  URL 参数：便于做确定性截图 / 演示 / 无头回归测试
   *  ?ui=0 隐藏界面   ?focus=<id> 锁定天体   ?dist=<倍半径>
   *  ?yaw ?pitch      ?t=<自 J2000 天数>     ?pause=1
   *  ?d=<米> ?mat=<id> ?v=<km/s> ?ang=<度> ?az=<度> ?ocean=0|1 ?fire=1
   * ---------------------------------------------------------------- */
  function applyQueryParams(qs) {
    const UI = SS.UI, Cam = SS.Cam, W = SS.World;
    const num = (k, d) => (qs.has(k) ? parseFloat(qs.get(k)) : d);
    if (qs.get('ui') === '0') document.body.classList.add('noui');
    if (qs.has('t')) { W.simDays = num('t', W.simDays); W.update(0); }
    const fid = qs.get('focus');
    if (fid && W.byId[fid]) {
      Cam.setFocus(W.byId[fid], true);
      UI.setTarget(W.byId[fid], true);
    }
    if (qs.has('dist')) {
      const b = Cam.focus;
      Cam.distTarget = Math.max(b.radius * num('dist', 3.4), b.radius * 1.02);
      Cam.dist = Cam.distTarget;
    }
    if (qs.has('yaw')) Cam.yaw = num('yaw', Cam.yaw);
    if (qs.has('pitch')) Cam.pitch = num('pitch', Cam.pitch);
    if (qs.has('boost')) SS.R.settings.sizeBoost = Math.max(1, num('boost', 1));
    if (qs.has('relief')) SS.R.settings.reliefGain = Math.max(1, num('relief', 1));
    if (qs.has('d')) UI.diameter = num('d', UI.diameter);
    if (qs.has('mat')) {
      const m = SS.DATA.IMPACTORS.find((x) => x.id === qs.get('mat'));
      if (m) UI.mat = m;
    }
    if (qs.has('v')) UI.velocity = num('v', UI.velocity);
    if (qs.has('ang')) UI.angle = num('ang', UI.angle);
    if (qs.has('az')) UI.azimuth = num('az', 0) * Math.PI / 180;
    if (qs.has('ocean')) UI.ocean = qs.get('ocean') === '1';
    if (qs.has('aimlat') || qs.has('aimlon')) {
      const la = num('aimlat', 12) * Math.PI / 180, lo = num('aimlon', 0) * Math.PI / 180;
      UI.aim = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
    }
    UI.refreshPreview();
    Cam.update(0);
    if (qs.get('pause') === '1') UI.timeScale = 0;
    if (qs.get('dbg') === '1') SS.debugHUD = true;
    // ?impact=N：不走飞行过程，直接把 N 次撞击后果写入（确定性截图 / 回归测试用）
    const nImp = parseInt(qs.get('impact') || '0', 10);
    if (nImp > 0 && UI.preview && UI.target && UI.aim) {
      for (let i = 0; i < Math.min(nImp, 24); i++) {
        let dir = UI.aim;
        if (i > 0) {
          // 沿目标点周围铺开，用于验证伤痕图烘焙（超过 4 个解析槽位）
          const a = i * 2.399963, r = 0.25 + 0.12 * i;
          const t1 = SS.M.v3.perp(UI.aim);
          const t2 = SS.M.v3.cross(UI.aim, t1);
          dir = SS.M.v3.norm([
            UI.aim[0] * Math.cos(r) + (t1[0] * Math.cos(a) + t2[0] * Math.sin(a)) * Math.sin(r),
            UI.aim[1] * Math.cos(r) + (t1[1] * Math.cos(a) + t2[1] * Math.sin(a)) * Math.sin(r),
            UI.aim[2] * Math.cos(r) + (t1[2] * Math.cos(a) + t2[2] * Math.sin(a)) * Math.sin(r),
          ]);
        }
        SS.World.applyImpact(UI.target, dir, UI.preview, UI.mat);
        if (qs.get('fx') === '1') {
          SS.FX.spawnImpact(UI.target, dir, UI.preview,
            { sizeBoost: SS.R.settings.sizeBoost, vDirLocal: SS.M.v3.negate(dir) });
        }
      }
    }
    if (qs.get('fire') === '1') setTimeout(() => SS.UI.fire(), 60);
  }

  function loop(now) {
    if (!running) return;
    const dtRaw = (now - last) / 1000;
    last = now;
    const dt = Math.min(Math.max(dtRaw, 0), 0.06);

    const UI = SS.UI;
    const dDays = dt * UI.timeScale;
    // 统一的物理时钟：所有演化（公转、自转、进入积分、弹道、尘幕沉降、
    // 熔体冷却、波前扩散）都用同一段模拟时间，倍率显示在顶栏
    const dtSim = dDays * 86400;

    SS.World.update(dDays);
    SS.World.evolve(dtSim, dDays);
    SS.FX.update(dtSim, SS.R.settings.sizeBoost);
    SS.Cam.update(dt);
    const info = SS.R.frame(dt);
    SS.UI.updateOverlay();

    // 顶栏信息
    fpsAcc += dtRaw; fpsN++;
    if (fpsAcc > 0.4) {
      fpsShown = fpsN / fpsAcc;
      fpsAcc = 0; fpsN = 0;
      const p = SS.FX.P.count;
      $('fps').textContent = fpsShown.toFixed(0) + ' fps · ' +
        (SS.R.stats.tris / 1000).toFixed(0) + 'k tri · ' + p + ' 粒子';
    }
    const scale = UI.timeScale;
    const accel = scale * 86400;                 // 模拟秒 / 真实秒
    let rate;
    if (scale === 0) rate = '已暂停';
    else if (accel < 0.95) rate = '慢放 ×' + accel.toFixed(2);
    else if (accel < 1.6) rate = '实时 ×1';
    else if (accel < 3600) rate = '×' + accel.toFixed(accel < 20 ? 1 : 0) + ' 实时';
    else if (scale < 1) rate = (scale * 24).toFixed(0) + ' 时/秒';
    else if (scale < 30) rate = scale.toFixed(0) + ' 天/秒';
    else if (scale < 300) rate = (scale / 30).toFixed(0) + ' 月/秒';
    else rate = (scale / 365.25).toFixed(0) + ' 年/秒';
    $('date-line').textContent = SS.World.dateString() + ' · ' + rate;

    if (SS.debugHUD) {
      const f = SS.Cam.focus;
      let probe = '';
      try {
        const g2 = gl;
        const px = new Uint8Array(4);
        const pts = [[0.5, 0.5], [0.5, 0.75], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.06, 0.94]];
        probe = ' px[' + pts.map((p) => {
          g2.readPixels(Math.floor(p[0] * SS.R.RW), Math.floor(p[1] * SS.R.RH), 1, 1,
            g2.RGBA, g2.UNSIGNED_BYTE, px);
          return px[0] + ',' + px[1] + ',' + px[2];
        }).join(' | ') + ']';
      } catch (e) { probe = ' px-err:' + e.message; }
      $('status-line').textContent = 'DBG focus=' + (f ? f.id : '-') +
        ' dist=' + SS.Cam.dist.toFixed(3) + 'u r=' + (f ? f.radius.toFixed(3) : '-') +
        'u sr=' + (f ? f.screenSize.toFixed(1) : '-') + 'px' +
        ' exp=' + (info ? info.exposure.toFixed(3) : '-') +
        ' irr=' + (info ? info.irrFocus.toExponential(2) : '-') +
        ' RW=' + SS.R.RW + 'x' + SS.R.RH +
        ' draws=' + SS.R.stats.draws + ' tris=' + SS.R.stats.tris +
        ' part=' + SS.FX.P.count + ' met=' + SS.FX.meteors.length +
        ' alive=' + SS.FX.P.alive.reduce((a, b) => a + b, 0) +
        ' flash=' + SS.FX.flashes.length +
        ' kill=' + JSON.stringify(SS.FX.dbgKill) + probe;
    }

    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
