/*!
 * src/ui/widgets.js — 通用 UI 小件：提示条、弹窗、标签页、参数控件、键值读数
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util;
  var h = U.h;
  var W = {};

  /* ---------------- 提示条 ---------------- */
  var toastHost = null;
  W.toast = function (msg, kind, ms) {
    if (!toastHost) toastHost = document.getElementById('toast-stack');
    if (!toastHost) { D.log(msg); return; }
    var el = h('div.toast' + (kind ? '.is-' + kind : ''), { text: String(msg) });
    toastHost.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, ms || (kind === 'error' ? 6000 : 2600));
    return el;
  };

  /* ---------------- 状态栏 ---------------- */
  W.status = function (msg) {
    var el = document.getElementById('status-msg');
    if (el) el.textContent = msg;
  };

  /* ---------------- 遮挡式警告（例如 WebGL 不可用） ---------------- */
  W.blocker = function (title, bodyHtml) {
    var box = document.getElementById('blocker');
    if (!box) return;
    document.getElementById('blocker-title').textContent = title;
    document.getElementById('blocker-body').innerHTML = bodyHtml;
    box.hidden = false;
  };

  W.hideBlocker = function () {
    var box = document.getElementById('blocker');
    if (box) box.hidden = true;
  };

  /* ---------------- 弹窗 ---------------- */
  W.openModal = function (id) {
    var m = document.getElementById(id);
    if (m) m.hidden = false;
  };
  W.closeModal = function (id) {
    var m = document.getElementById(id);
    if (m) m.hidden = true;
  };

  /* ---------------- 标签页 ---------------- */
  W.initTabs = function (root) {
    U.$$('.tabs', root || document).forEach(function (tabs) {
      var panes = tabs.parentNode.querySelector('.tabpanes');
      tabs.addEventListener('click', function (ev) {
        var btn = ev.target.closest ? ev.target.closest('.tab') : null;
        if (!btn || !tabs.contains(btn)) return;
        U.$$('.tab', tabs).forEach(function (t) { t.classList.toggle('is-active', t === btn); });
        if (panes) {
          U.$$('.tabpane', panes).forEach(function (p) {
            p.classList.toggle('is-active', p.getAttribute('data-pane') === btn.getAttribute('data-tab'));
          });
        }
      });
    });
  };

  /* ---------------- 键值读数 ---------------- */
  /** rows: [[key, value, className?]] */
  W.kv = function (el, rows) {
    if (!el) return;
    U.clear(el);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (!r) continue;
      el.appendChild(h('div.kv', [
        h('span.kv-k', { text: r[0] }),
        h('span.kv-v' + (r[2] ? '.' + r[2] : ''), { text: String(r[1]) })
      ]));
    }
  };

  /* ---------------- 参数控件 ---------------- */

  function fmtVal(p, v) {
    if (p.type === 'bool') return v ? '开' : '关';
    if (p.type === 'color') return String(v);
    if (p.type === 'enum') {
      for (var i = 0; i < p.options.length; i++) if (p.options[i].v === v) return p.options[i].label;
      return String(v);
    }
    var step = p.step || 0.01;
    var digits = step >= 1 ? 0 : (step >= 0.1 ? 1 : 2);
    return Number(v).toFixed(digits);
  }

  /**
   * 生成一行参数控件
   * @param {object} p 参数定义
   * @param {*} value 当前值
   * @param {function(value)} onChange
   */
  W.paramRow = function (p, value, onChange) {
    var row = h('div.param.param-' + p.type);
    var valueEl;

    function commit(v) {
      onChange(v);
      if (valueEl) valueEl.textContent = fmtVal(p, v);
    }

    var label = h('div.param-label', { text: p.label || p.key, title: (p.label || p.key) + (p.unit ? ' (' + p.unit + ')' : '') });
    row.appendChild(label);

    var control = h('div.param-control');
    if (p.type === 'float') {
      var range = h('input.range', {
        type: 'range', min: p.min, max: p.max, step: p.step, value: value,
        oninput: function () { commit(parseFloat(this.value)); }
      });
      control.appendChild(range);
      valueEl = h('span.param-value.mono', { text: fmtVal(p, value), title: '双击可直接输入' });
      valueEl.addEventListener('dblclick', function () {
        var v = prompt(p.label + '（' + p.min + ' ~ ' + p.max + '）', String(value));
        if (v == null) return;
        var n = parseFloat(v);
        if (!isFinite(n)) return;
        n = U.clamp(n, p.min, p.max);
        range.value = n;
        commit(n);
      });
      row.appendChild(control);
      row.appendChild(valueEl);
      row._set = function (v) { range.value = v; valueEl.textContent = fmtVal(p, v); };
    } else if (p.type === 'enum') {
      var sel = h('select.select.select-small', {
        onchange: function () { commit(parseFloat(this.value)); }
      });
      p.options.forEach(function (o) {
        sel.appendChild(h('option', { value: o.v, text: o.label, selected: o.v === value }));
      });
      control.appendChild(sel);
      row.appendChild(control);
      row._set = function (v) { sel.value = v; };
    } else if (p.type === 'bool') {
      var chk = h('input', {
        type: 'checkbox', checked: !!value,
        onchange: function () { commit(this.checked); }
      });
      control.appendChild(h('label.check', [chk, h('span', { text: value ? '开启' : '关闭' })]));
      row.appendChild(control);
      row._set = function (v) { chk.checked = !!v; };
    } else { // color
      var col = h('input', {
        type: 'color', value: value,
        oninput: function () { commit(this.value); if (hex) hex.value = this.value; }
      });
      var hex = h('input.input.input-num.mono', {
        type: 'text', value: value, size: 8,
        onchange: function () {
          var v = String(this.value).trim();
          if (!/^#[0-9a-fA-F]{6}$/.test(v)) { this.value = col.value; return; }
          col.value = v;
          commit(v);
        }
      });
      control.appendChild(col);
      control.appendChild(hex);
      row.appendChild(control);
      row._set = function (v) { col.value = v; hex.value = v; };
    }

    var reset = h('button.param-reset.btn.btn-icon', {
      text: '⟲', title: '恢复默认值 (' + fmtVal(p, p.def) + ')',
      onclick: function () {
        var dv = p.type === 'bool' ? !!p.def : (p.type === 'color' ? p.def : Number(p.def));
        if (row._set) row._set(dv);
        commit(dv);
      }
    });
    row.appendChild(reset);
    return row;
  };

  /** 把 min..max 的数值输入框统一处理（回车提交 / 失焦提交 / clamp） */
  W.numberField = function (input, opts) {
    opts = opts || {};
    function submit() {
      var v = parseFloat(input.value);
      if (!isFinite(v)) { if (opts.onInvalid) opts.onInvalid(); return; }
      if (opts.min != null) v = Math.max(opts.min, v);
      if (opts.max != null) v = Math.min(opts.max, v);
      if (opts.integer) v = Math.round(v);
      input.value = v;
      if (opts.onChange) opts.onChange(v);
    }
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); submit(); input.blur(); }
      ev.stopPropagation(); // 不要触发全局快捷键
    });
    input.addEventListener('change', submit);
    return { submit: submit };
  };

  /** 文本输入框：阻止快捷键冒泡 + 回车回调 */
  W.textField = function (input, onEnter) {
    input.addEventListener('keydown', function (ev) {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); onEnter(input.value); }
    });
    return input;
  };

  D.W = W;
})(typeof window !== 'undefined' ? window : globalThis);
