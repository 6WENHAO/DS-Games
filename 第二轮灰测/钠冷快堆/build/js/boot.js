/* ============================================================================
   启动：模块挂载、目录高亮、运行诊断
   ==========================================================================*/
(function () {
  'use strict';
  var S = window.SFR;

  function boot() {
    var t0 = performance.now();
    S.boot();
    var ms = performance.now() - t0;

    /* 目录滚动高亮 */
    var links = Array.prototype.slice.call(document.querySelectorAll('#toc a'));
    var secs = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    function spy() {
      var y = window.scrollY + 120, best = 0;
      secs.forEach(function (s, k) { if (s && s.offsetTop <= y) best = k; });
      links.forEach(function (a, k) { a.className = k === best ? 'on' : ''; });
    }
    var raf = 0;
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; spy(); }); }, { passive: true });
    spy();

    /* 运行诊断（页脚） */
    var ids = ['primary', 'secondary', 'xsec', 'rods', 'refuel', 'safety', 'checks'];
    var miss = ids.filter(function (i) {
      var h = document.getElementById('mount-' + i);
      return !h || h.children.length === 0;
    });
    var main = document.querySelector('main');
    var pass = document.querySelectorAll('.ok').length;
    var fail = document.querySelectorAll('#mount-checks tbody .bad').length;
    main.appendChild(S.el('footer', {
      class: 'panel', style: { marginTop: '30px', borderTop: '2px solid var(--ink)' }
    }, [
      S.el('div', { class: 'h4', text: '文件运行诊断' }),
      S.el('div', {
        class: 'note', html:
          '模块挂载：<b>' + (ids.length - miss.length) + ' / ' + ids.length + '</b>' +
          (miss.length ? '　<b class="bad">未挂载：' + miss.join(', ') + '</b>' : '　<b class="ok">全部成功</b>') +
          '　│　页内计算耗时 <b>' + ms.toFixed(0) + ' ms</b>' +
          '　│　自洽性校核 FAIL 计数 <b class="' + (fail ? 'bad' : 'ok') + '">' + fail + '</b>' +
          '<br>页内实时计算：SLBW + Faddeeva 多普勒展宽（第 4 章）· 控制棒价值与落棒 RK4 + 6 组点堆动力学（第 5 章）· ' +
          '双旋塞逆运动学与换料时序（第 6 章）· 非能动排热平衡（第 7 章）· 全部导出量闭合校核（第 8 章）。' +
          '<br>本文件为自包含单一 HTML，无外部依赖、无网络请求；可直接打印为 A4 报告（图表与表格已设置避免跨页断开）。'
      })
    ]));
    if (miss.length) console.warn('未挂载模块:', miss);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
