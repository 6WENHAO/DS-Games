/*!
 * src/ui/filters-ui.js — 左侧面板：滤镜链编辑器、风格预设、资源（调色板/字符集）
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var U = D.util, W = D.W, h = U.h;

  var CAT_NAMES = {
    pixel: '像素风', print: '印刷', grid: '网格/屏幕', ink: '线稿',
    paint: '绘画', display: '光学/显示', glitch: '故障', grade: '调色',
    tone: '影调', custom: '自定义', misc: '其他'
  };

  function FiltersUI(app) {
    this.app = app;
    this.pipeline = app.pipeline;
    this.els = {
      picker: document.getElementById('filter-picker'),
      addBtn: document.getElementById('btn-add-filter'),
      list: document.getElementById('chain-list'),
      clearBtn: document.getElementById('btn-chain-clear'),
      bypassBtn: document.getElementById('btn-chain-bypass'),
      presetList: document.getElementById('preset-list'),
      userPresetList: document.getElementById('user-preset-list'),
      presetName: document.getElementById('preset-name'),
      presetSave: document.getElementById('btn-preset-save'),
      paletteSelect: document.getElementById('palette-select'),
      swatches: document.getElementById('palette-swatches'),
      paletteCustomField: document.getElementById('palette-custom-field'),
      paletteCustom: document.getElementById('palette-custom'),
      paletteApply: document.getElementById('btn-palette-apply'),
      glyphSelect: document.getElementById('glyph-select'),
      glyphPreview: document.getElementById('glyph-preview'),
      renderScale: document.getElementById('render-scale'),
      renderScaleOut: document.getElementById('render-scale-out'),
      glInfo: document.getElementById('gl-info')
    };
    this.folded = Object.create(null);
    this._build();
  }

  FiltersUI.prototype._build = function () {
    var self = this;
    var e = this.els;

    /* ---- 滤镜选择器 ---- */
    var groups = Object.create(null);
    D.filters.forEach(function (def) {
      (groups[def.category] || (groups[def.category] = [])).push(def);
    });
    Object.keys(groups).forEach(function (cat) {
      var og = h('optgroup', { label: CAT_NAMES[cat] || cat });
      groups[cat].forEach(function (def) {
        og.appendChild(h('option', { value: def.id, text: def.label }));
      });
      e.picker.appendChild(og);
    });

    e.addBtn.addEventListener('click', function () {
      var inst = self.pipeline.addFilter(e.picker.value);
      if (inst) {
        self.app.toast('已添加：' + D.getFilter(inst.id).label, 'ok');
        self.app.requestRender();
      }
    });
    e.picker.addEventListener('dblclick', function () { e.addBtn.click(); });

    e.clearBtn.addEventListener('click', function () {
      if (!self.pipeline.chain.length) return;
      self.pipeline.clearChain();
      self.app.requestRender();
    });

    e.bypassBtn.addEventListener('click', function () {
      self.pipeline.bypass = !self.pipeline.bypass;
      this.classList.toggle('is-active', self.pipeline.bypass);
      self.app.toast(self.pipeline.bypass ? '滤镜已全部旁通（B 键切回）' : '滤镜已恢复');
      self.app.requestRender();
    });

    /* ---- 预设 ---- */
    D.presets.forEach(function (p) {
      e.presetList.appendChild(h('div.preset', {
        onclick: function () { self.app.applyPreset(p.id); }
      }, [
        h('div.preset-title', { text: p.name }),
        h('div.preset-desc', { text: p.desc })
      ]));
    });

    e.presetSave.addEventListener('click', function () {
      var name = (e.presetName.value || '').trim();
      if (!name) { self.app.toast('请先填预设名称', 'error'); return; }
      var list = U.store.get('userPresets', []);
      list = list.filter(function (x) { return x.name !== name; });
      list.push({
        id: 'user:' + name, name: name, desc: '自定义预设',
        palette: self.pipeline.paletteId,
        paletteColors: self.pipeline.paletteId === 'custom' ? self.pipeline.paletteColors : null,
        glyph: self.pipeline.glyphRampId,
        chain: self.pipeline.serializeChain()
      });
      U.store.set('userPresets', list);
      e.presetName.value = '';
      self.renderUserPresets();
      self.app.toast('已保存预设：' + name, 'ok');
    });
    W.textField(e.presetName, function () { e.presetSave.click(); });

    /* ---- 资源：调色板 ---- */
    D.Resources.palettes.forEach(function (p) {
      e.paletteSelect.appendChild(h('option', { value: p.id, text: p.name }));
    });
    e.paletteSelect.value = this.pipeline.paletteId;
    e.paletteSelect.addEventListener('change', function () {
      self.setPalette(this.value);
    });
    e.paletteApply.addEventListener('click', function () {
      var colors = (e.paletteCustom.value || '').split(/\s|,|;/).map(function (s) { return s.trim(); })
        .filter(function (s) { return /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(s); })
        .map(function (s) { return s[0] === '#' ? s : '#' + s; });
      if (colors.length < 2) { self.app.toast('至少需要 2 个合法颜色', 'error'); return; }
      self.pipeline.setPalette('custom', colors);
      self.renderSwatches();
      self.app.requestRender();
      self.app.toast('已应用 ' + colors.length + ' 色自定义调色板', 'ok');
    });

    /* ---- 资源：字符集 ---- */
    var rampNames = { ascii: 'ASCII 渐变', blocks: '方块渐变 ░▒▓█', dots: '盲文点阵', digits: '数字', kana: '片假名', hanzi: '汉字笔画' };
    Object.keys(D.Resources.RAMPS).forEach(function (k) {
      e.glyphSelect.appendChild(h('option', { value: k, text: rampNames[k] || k }));
    });
    e.glyphSelect.value = this.pipeline.glyphRampId;
    e.glyphSelect.addEventListener('change', function () {
      self.pipeline.setGlyphRamp(this.value);
      self.renderGlyphPreview();
      self.app.requestRender();
    });

    /* ---- 资源：处理分辨率 ---- */
    e.renderScale.addEventListener('input', function () {
      var v = parseFloat(this.value);
      self.pipeline.renderScale = v;
      e.renderScaleOut.textContent = Math.round(v * 100) + '%';
      self.app.requestRender();
    });

    /* ---- 事件联动 ---- */
    this.pipeline.on('chain', function () { self.renderChain(); });
    this.pipeline.on('shadererror', function (ev) { self.renderChain(); self.app.toast('着色器编译失败：' + ev.id, 'error'); });
    this.pipeline.on('shaderok', function () { self.renderChain(); });

    this.renderChain();
    this.renderUserPresets();
    this.renderSwatches();
    this.renderGlyphPreview();
    this.renderGlInfo();
  };

  FiltersUI.prototype.setPalette = function (id, colors) {
    this.pipeline.setPalette(id, colors);
    this.els.paletteSelect.value = id;
    this.els.paletteCustomField.hidden = (id !== 'custom');
    if (id === 'custom' && !this.els.paletteCustom.value.trim()) {
      this.els.paletteCustom.value = (this.pipeline.paletteColors || []).join('\n');
    }
    this.renderSwatches();
    this.app.requestRender();
  };

  FiltersUI.prototype.renderSwatches = function () {
    var el = this.els.swatches;
    U.clear(el);
    var colors = this.pipeline.paletteColors || [];
    colors.forEach(function (c) {
      el.appendChild(h('span.swatch', { style: { background: c }, title: c }));
    });
    el.appendChild(h('span.small', { text: ' ' + colors.length + ' 色' }));
  };

  FiltersUI.prototype.renderGlyphPreview = function () {
    var g = this.pipeline.glyph;
    this.els.glyphPreview.textContent = g ? ('暗 → 亮：' + g.order) : '';
  };

  FiltersUI.prototype.renderGlInfo = function () {
    var gl = this.app.gl;
    var info = gl.rendererInfo || {};
    W.kv(this.els.glInfo, [
      ['上下文', gl.isWebGL2 ? 'WebGL 2' : 'WebGL 1'],
      ['厂商', info.vendor || '-'],
      ['渲染器', String(info.renderer || '-').slice(0, 48)],
      ['最大纹理', gl.maxTexture || '-'],
      ['纹理单元', gl.maxUnits || '-']
    ]);
  };

  FiltersUI.prototype.renderUserPresets = function () {
    var self = this;
    var el = this.els.userPresetList;
    U.clear(el);
    var list = U.store.get('userPresets', []);
    if (!list.length) {
      el.appendChild(h('div.hint', { text: '还没有自定义预设。' }));
      return;
    }
    list.forEach(function (p) {
      var card = h('div.preset', [
        h('div.preset-title', { text: p.name }),
        h('div.preset-desc', { text: (p.chain || []).length + ' 个滤镜' }),
        h('button.preset-del.btn.btn-icon', {
          text: '✕', title: '删除预设',
          onclick: function (ev) {
            ev.stopPropagation();
            var rest = U.store.get('userPresets', []).filter(function (x) { return x.name !== p.name; });
            U.store.set('userPresets', rest);
            self.renderUserPresets();
          }
        })
      ]);
      card.addEventListener('click', function () { self.app.applyPresetObject(p); });
      el.appendChild(card);
    });
  };

  /* ------------------------------------------------------------------ *
   * 滤镜链渲染
   * ------------------------------------------------------------------ */

  FiltersUI.prototype.renderChain = function () {
    var self = this;
    var el = this.els.list;
    U.clear(el);
    var chain = this.pipeline.chain;

    if (!chain.length) {
      el.appendChild(h('div.hint', { text: '滤镜链为空：上面选一个滤镜点「添加」，或去「风格预设」直接套用。' }));
      return;
    }

    chain.forEach(function (inst, index) {
      var def = D.getFilter(inst.id);
      var err = self.pipeline.errors[inst.uid];
      var folded = !!self.folded[inst.uid];

      var item = h('div.chain-item' + (inst.enabled ? '' : '.is-disabled') + (err ? '.is-error' : ''), {
        draggable: 'true', dataset: { uid: inst.uid, index: index }
      });

      var toggle = h('input.chain-toggle', {
        type: 'checkbox', checked: inst.enabled, title: '启用/停用',
        onclick: function (ev) { ev.stopPropagation(); },
        onchange: function () {
          inst.enabled = this.checked;
          item.classList.toggle('is-disabled', !inst.enabled);
          self.app.requestRender();
        }
      });

      var actions = h('div.chain-actions', [
        h('button.btn.btn-icon', { text: '↑', title: '上移', onclick: function (ev) { ev.stopPropagation(); self.pipeline.move(inst.uid, -1); self.app.requestRender(); } }),
        h('button.btn.btn-icon', { text: '↓', title: '下移', onclick: function (ev) { ev.stopPropagation(); self.pipeline.move(inst.uid, 1); self.app.requestRender(); } }),
        h('button.btn.btn-icon', { text: 'S', title: '独奏（只留这一个）', onclick: function (ev) { ev.stopPropagation(); self.solo(inst.uid); } }),
        h('button.btn.btn-icon', { text: '⧉', title: '复制一份', onclick: function (ev) {
          ev.stopPropagation();
          var copy = self.pipeline.addFilter(inst.id, inst.params, self.pipeline.indexOf(inst.uid) + 1);
          if (copy && inst.code) copy.code = inst.code;
          self.app.requestRender();
        } }),
        h('button.btn.btn-icon', { text: '✕', title: '删除', onclick: function (ev) { ev.stopPropagation(); self.pipeline.remove(inst.uid); self.app.requestRender(); } })
      ]);

      var head = h('div.chain-head', {
        onclick: function () {
          self.folded[inst.uid] = !self.folded[inst.uid];
          body.hidden = !!self.folded[inst.uid];
          fold.textContent = self.folded[inst.uid] ? '▸' : '▾';
        }
      }, [
        h('span.chain-drag', { text: '⠿', title: '拖动排序' }),
        toggle,
        h('span.chain-title', { text: (index + 1) + '. ' + def.label }),
        h('span.chain-cat', { text: CAT_NAMES[def.category] || def.category }),
        actions
      ]);
      var fold = h('span.chain-fold', { text: folded ? '▸' : '▾' });
      head.insertBefore(fold, head.firstChild);

      var body = h('div.chain-body', { hidden: folded });
      if (def.doc) body.appendChild(h('div.chain-doc', { text: def.doc }));

      def.params.forEach(function (p) {
        body.appendChild(W.paramRow(p, inst.params[p.key], function (v) {
          self.pipeline.setParam(inst.uid, p.key, v);
          self.app.requestRender();
        }));
      });

      // 自定义着色器：代码编辑器
      if (def.dynamic) {
        var ta = h('textarea.code-editor.mono', { spellcheck: 'false', value: inst.code || def.defaultCode });
        ta.addEventListener('keydown', function (ev) {
          ev.stopPropagation();
          if (ev.key === 'Tab') {
            ev.preventDefault();
            var s = this.selectionStart;
            this.value = this.value.slice(0, s) + '  ' + this.value.slice(this.selectionEnd);
            this.selectionStart = this.selectionEnd = s + 2;
          }
          if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') apply();
        });
        function apply() {
          self.pipeline.setCode(inst.uid, ta.value);
          self.app.requestRender();
          setTimeout(function () {
            var e2 = self.pipeline.errors[inst.uid];
            self.app.toast(e2 ? '编译失败，看下面的报错' : '编译成功', e2 ? 'error' : 'ok');
            self.renderChain();
          }, 60);
        }
        body.appendChild(ta);
        body.appendChild(h('div.code-actions', [
          h('button.btn.btn-small.btn-primary', { text: '编译 (Ctrl+Enter)', onclick: apply }),
          h('button.btn.btn-small', { text: '恢复示例', onclick: function () { ta.value = def.defaultCode; apply(); } })
        ]));
      }

      if (err) body.appendChild(h('pre.chain-error', { text: err }));

      item.appendChild(head);
      item.appendChild(body);
      self._dnd(item, inst);
      el.appendChild(item);
    });
  };

  FiltersUI.prototype.solo = function (uid) {
    var chain = this.pipeline.chain;
    var others = chain.filter(function (x) { return x.uid !== uid; });
    var anyOn = others.some(function (x) { return x.enabled; });
    others.forEach(function (x) { x.enabled = !anyOn; });
    var me = this.pipeline.find(uid);
    if (me) me.enabled = true;
    this.renderChain();
    this.app.requestRender();
  };

  /** 原生 HTML5 拖放排序 */
  FiltersUI.prototype._dnd = function (item, inst) {
    var self = this;
    item.addEventListener('dragstart', function (ev) {
      ev.dataTransfer.setData('text/plain', inst.uid);
      ev.dataTransfer.effectAllowed = 'move';
      item.classList.add('is-dragging');
    });
    item.addEventListener('dragend', function () {
      item.classList.remove('is-dragging');
      U.$$('.chain-item', self.els.list).forEach(function (n) {
        n.classList.remove('drop-before', 'drop-after');
      });
    });
    item.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      var r = item.getBoundingClientRect();
      var after = (ev.clientY - r.top) > r.height / 2;
      item.classList.toggle('drop-after', after);
      item.classList.toggle('drop-before', !after);
    });
    item.addEventListener('dragleave', function () {
      item.classList.remove('drop-before', 'drop-after');
    });
    item.addEventListener('drop', function (ev) {
      ev.preventDefault();
      var srcUid = ev.dataTransfer.getData('text/plain');
      if (!srcUid || srcUid === inst.uid) return;
      var r = item.getBoundingClientRect();
      var after = (ev.clientY - r.top) > r.height / 2;
      var target = self.pipeline.indexOf(inst.uid);
      var from = self.pipeline.indexOf(srcUid);
      var to = target + (after ? 1 : 0);
      if (from < to) to--;
      self.pipeline.moveTo(srcUid, to);
      self.app.requestRender();
    });
  };

  D.FiltersUI = FiltersUI;
})(typeof window !== 'undefined' ? window : globalThis);
