/**
 * 右侧设置面板（全部 DOM 由本模块生成）
 *
 * 分区：组件结构 / 涂装 / 光照 / 火力动作 / 显示 / 导出 / 说明
 * 与主程序的耦合只通过 ctx 回调，便于单独调试。
 */
import { CATEGORIES, DISCLAIMER, GENERAL_SPECS } from '../data/components.js';
import { SCHEMES } from '../tank/materials.js';
import { LIGHT_PRESETS } from '../scene/env.js';

/* ---------- 迷你 DOM 助手 ---------- */
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return n;
}

function section(title, icon, badge, open, body) {
  const s = el('details', { class: 'sec', ...(open ? { open: true } : {}) });
  s.appendChild(
    el('summary', {}, [
      el('span', { class: 'ico', text: icon }),
      el('span', { text: title }),
      badge ? el('span', { class: 'badge', text: badge }) : null,
      el('span', { class: 'arrow', text: '▶' }),
    ]),
  );
  const b = el('div', { class: 'sec-body' });
  for (const c of [].concat(body)) if (c) b.appendChild(c);
  s.appendChild(b);
  return s;
}

function slider({ label, min, max, step, value, format, oninput }) {
  const val = el('span', { class: 'val', text: format(value) });
  const input = el('input', {
    type: 'range',
    min,
    max,
    step,
    value,
    oninput: (e) => {
      const v = parseFloat(e.target.value);
      val.textContent = format(v);
      oninput(v);
    },
  });
  const wrap = el('div', {}, [el('div', { class: 'row' }, [el('label', { text: label }), val]), input]);
  wrap.setValue = (v) => {
    input.value = v;
    val.textContent = format(v);
  };
  return wrap;
}

function toggle({ label, checked, onchange }) {
  const input = el('input', { type: 'checkbox', ...(checked ? { checked: true } : {}) });
  input.addEventListener('change', () => onchange(input.checked));
  const l = el('label', { class: 'sw' }, [input, el('i', { class: 'track' }), el('span', { class: 'lb', text: label })]);
  l.setValue = (v) => {
    input.checked = v;
  };
  return l;
}

export class Panel {
  constructor(root, ctx) {
    this.root = root;
    this.ctx = ctx;
    this.itemButtons = new Map();
    this.currentItem = null;
    this.detailNode = null;
    this.build();
  }

  build() {
    const { ctx } = this;
    const R = this.root;
    R.innerHTML = '';

    /* ---------------- 头部 ---------------- */
    R.appendChild(
      el('div', { class: 'p-head' }, [
        el('h1', { text: '99A 结构总览 / 控制台' }),
        el('p', {
          text: '点击任意组件 → 相机自动飞向该部位，目标标红、遮挡件自动半透明。',
        }),
      ]),
    );

    /* ---------------- 1. 组件结构 ---------------- */
    const listWrap = el('div', {});
    const search = el('input', {
      type: 'text',
      placeholder: '搜索组件（如：装弹机 / 履带 / 火控）',
      oninput: (e) => this.filter(e.target.value.trim()),
    });
    let count = 0;
    for (const cat of CATEGORIES) {
      const head = el('div', { class: 'cat-h' }, [
        el('span', { text: (cat.icon || '·') + ' ' + cat.name }),
        el('i', { class: 'ln' }),
      ]);
      const box = el('div', { class: 'cat', 'data-cat': cat.id }, [head]);
      for (const item of cat.items) {
        count++;
        const btn = el('button', {
          class: 'item',
          'data-id': item.id,
          'data-key': (item.name + ' ' + (item.desc || '') + ' ' + cat.name).toLowerCase(),
          onclick: () => ctx.selectItem(item.id),
        });
        btn.appendChild(el('span', { text: item.name }));
        if (item.internal) btn.appendChild(el('span', { class: 'tag', text: '内部' }));
        box.appendChild(btn);
        this.itemButtons.set(item.id, btn);
      }
      // 折叠/展开分类
      head.addEventListener('click', () => {
        const hidden = box.dataset.collapsed === '1';
        box.dataset.collapsed = hidden ? '0' : '1';
        for (const b of box.querySelectorAll('.item')) b.style.display = hidden ? '' : 'none';
      });
      listWrap.appendChild(box);
    }
    this.listWrap = listWrap;
    R.appendChild(
      section('组件结构', '◈', count + ' 项', true, [
        el('div', { class: 'search' }, [search]),
        el('div', { class: 'grid g2' }, [
          el('button', { class: 'btn', text: '清除选择', onclick: () => ctx.selectItem(null) }),
          el('button', { class: 'btn', text: '复位视角 (R)', onclick: () => ctx.resetView() }),
        ]),
        el('div', { style: 'height:8px' }),
        listWrap,
      ]),
    );

    /* ---------------- 2. 涂装 ---------------- */
    const schemeBox = el('div', { class: 'schemes' });
    this.schemeButtons = new Map();
    for (const s of SCHEMES) {
      const bar = el('div', { class: 'sw-bar' });
      for (const c of [s.base, ...(s.patches || [])].slice(0, 4)) bar.appendChild(el('i', { style: `background:${c}` }));
      if (s.accent) bar.appendChild(el('i', { style: `background:${s.accent};flex:0.4` }));
      const b = el('div', { class: 'scheme', 'data-id': s.id, onclick: () => ctx.setScheme(s.id) }, [
        bar,
        el('span', { class: 'nm', text: s.name }),
        el('span', { class: 'ds', text: s.note }),
      ]);
      this.schemeButtons.set(s.id, b);
      schemeBox.appendChild(b);
    }
    this.weatherSlider = slider({
      label: '风化 / 泥污程度',
      min: 0,
      max: 1,
      step: 0.02,
      value: 0.5,
      format: (v) => Math.round(v * 100) + '%',
      oninput: (v) => ctx.setWeather(v),
    });
    R.appendChild(
      section('涂装贴图', '▤', SCHEMES.length + ' 套', false, [
        schemeBox,
        el('div', { style: 'height:10px' }),
        this.weatherSlider,
        el('div', { class: 'row' }, [
          el('button', {
            class: 'btn wide',
            text: '↺ 用当前涂装重新生成贴图',
            onclick: () => ctx.regenerateCamo(),
          }),
        ]),
        el('p', {
          class: 'note',
          html: '所有涂装均为 <b>程序化 Canvas 生成</b>（无外部图片），导出 GLB 时贴图会内嵌为 PNG，在 Blender 等软件中可原样显示。',
        }),
      ]),
    );

    /* ---------------- 3. 光照 ---------------- */
    const lightBox = el('div', { class: 'grid g3' });
    this.lightButtons = new Map();
    for (const p of LIGHT_PRESETS) {
      const b = el('button', { class: 'btn', text: p.name, onclick: () => ctx.setLightPreset(p.id) });
      this.lightButtons.set(p.id, b);
      lightBox.appendChild(b);
    }
    this.sunAz = slider({
      label: '太阳方位角',
      min: 0,
      max: 360,
      step: 1,
      value: 74,
      format: (v) => v + '°',
      oninput: (v) => ctx.setSun({ az: v }),
    });
    this.sunEl = slider({
      label: '太阳高度角',
      min: -10,
      max: 88,
      step: 0.5,
      value: 32,
      format: (v) => v + '°',
      oninput: (v) => ctx.setSun({ el: v }),
    });
    this.exposure = slider({
      label: '曝光 (ACES)',
      min: 0.3,
      max: 2,
      step: 0.01,
      value: 0.95,
      format: (v) => v.toFixed(2),
      oninput: (v) => ctx.setExposure(v),
    });
    this.bloomS = slider({
      label: '泛光强度',
      min: 0,
      max: 1.6,
      step: 0.01,
      value: 0.42,
      format: (v) => v.toFixed(2),
      oninput: (v) => ctx.setBloom(v),
    });
    R.appendChild(
      section('光照与光影', '☀', LIGHT_PRESETS.length + ' 预案', false, [
        lightBox,
        el('div', { style: 'height:6px' }),
        this.sunAz,
        this.sunEl,
        this.exposure,
        this.bloomS,
        el('div', { class: 'grid g2' }, [
          el('div', {}, [
            el('div', { class: 'row' }, [el('label', { text: '阴影分辨率' })]),
            el('div', { class: 'grid g3' }, [
              el('button', { class: 'btn', text: '1K', onclick: (e) => this.pickShadow(e, 1024) }),
              el('button', { class: 'btn on', text: '2K', onclick: (e) => this.pickShadow(e, 2048) }),
              el('button', { class: 'btn', text: '4K', onclick: (e) => this.pickShadow(e, 4096) }),
            ]),
          ]),
          el('div', {}, [
            el('div', { class: 'row' }, [el('label', { text: '渲染倍率' })]),
            el('div', { class: 'grid g3' }, [
              el('button', { class: 'btn', text: '1.0', onclick: (e) => this.pickDpr(e, 1) }),
              el('button', { class: 'btn on', text: '自动', onclick: (e) => this.pickDpr(e, 0) }),
              el('button', { class: 'btn', text: '2.0', onclick: (e) => this.pickDpr(e, 2) }),
            ]),
          ]),
        ]),
      ]),
    );

    /* ---------------- 4. 火力与动作 ---------------- */
    this.fireBtn = el('button', {
      class: 'btn primary wide',
      text: '⊙ 开 火',
      onclick: () => ctx.fire(),
    });
    this.turretSlider = slider({
      label: '炮塔方位（方向机）',
      min: -180,
      max: 180,
      step: 0.5,
      value: 0,
      format: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '°',
      oninput: (v) => ctx.setTurret(v),
    });
    this.gunSlider = slider({
      label: '火炮俯仰（高低机）',
      min: -6,
      max: 14,
      step: 0.1,
      value: 0,
      format: (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '°',
      oninput: (v) => ctx.setGun(v),
    });
    this.reload = slider({
      label: '装填循环时间',
      min: 2,
      max: 9,
      step: 0.1,
      value: 5,
      format: (v) => v.toFixed(1) + ' s',
      oninput: (v) => ctx.setReload(v),
    });
    this.smokeAmt = slider({
      label: '烟雾/扬尘量',
      min: 0,
      max: 2,
      step: 0.05,
      value: 1,
      format: (v) => Math.round(v * 100) + '%',
      oninput: (v) => ctx.setSmoke(v),
    });
    R.appendChild(
      section('火力与动作', '✹', null, true, [
        this.fireBtn,
        el('div', { style: 'height:4px' }),
        el('div', { class: 'grid g3' }, [
          el('button', { class: 'btn', text: '⇦ 左转 90°', onclick: () => ctx.nudgeTurret(-90) }),
          el('button', { class: 'btn', text: '归零', onclick: () => ctx.nudgeTurret(0, true) }),
          el('button', { class: 'btn', text: '右转 90° ⇨', onclick: () => ctx.nudgeTurret(90) }),
        ]),
        this.turretSlider,
        this.gunSlider,
        el('div', { class: 'grid g2' }, [
          toggle({ label: '装弹机联动', checked: true, onchange: (v) => ctx.setLoaderAnim(v) }),
          toggle({ label: '炮声（合成）', checked: true, onchange: (v) => ctx.setSound(v) }),
        ]),
        el('div', { class: 'grid g2' }, [
          toggle({ label: '炮塔连续回转', checked: false, onchange: (v) => ctx.setTurretSpin(v) }),
          toggle({ label: '舱盖开启', checked: false, onchange: (v) => ctx.setHatches(v) }),
        ]),
        this.reload,
        this.smokeAmt,
        el('p', {
          class: 'note',
          html: '开火包含：<b>炮口焰</b>（主焰 + 侧向膨胀波）、<b>火药烟与地面扬尘</b>、<b>后坐 0.30 m</b>（后坐 45 ms / 复进 0.42 s）、<b>车体俯仰振荡</b>、<b>自动装弹机全循环</b>（开闩→选弹→提弹→推弹→闭锁）。实车装填约 7～8 s/发。',
        }),
      ]),
    );

    /* ---------------- 5. 显示 ---------------- */
    this.tgInternal = toggle({ label: '显示内部结构', checked: false, onchange: (v) => ctx.setInternals(v) });
    this.tgXray = toggle({ label: '装甲透视 (X)', checked: false, onchange: (v) => ctx.setXray(v) });
    this.tgGhost = toggle({ label: '遮挡件半透明', checked: true, onchange: (v) => ctx.setGhost(v) });
    this.tgWire = toggle({ label: '线框叠加', checked: false, onchange: (v) => ctx.setWireframe(v) });
    this.tgGround = toggle({ label: '地面与环境', checked: true, onchange: (v) => ctx.setGround(v) });
    this.tgSpin = toggle({ label: '相机自动环绕', checked: false, onchange: (v) => ctx.setAutoRotate(v) });
    this.tgOutline = toggle({ label: '红色描边', checked: true, onchange: (v) => ctx.setOutline(v) });
    this.tgAxes = toggle({ label: '尺寸标尺', checked: false, onchange: (v) => ctx.setRuler(v) });
    this.ghostOpacity = slider({
      label: '半透明强度',
      min: 0.02,
      max: 0.5,
      step: 0.01,
      value: 0.11,
      format: (v) => v.toFixed(2),
      oninput: (v) => ctx.setGhostOpacity(v),
    });
    R.appendChild(
      section('显示与剖切', '◧', null, false, [
        el('div', { class: 'grid g2' }, [
          this.tgInternal,
          this.tgXray,
          this.tgGhost,
          this.tgOutline,
          this.tgWire,
          this.tgGround,
          this.tgSpin,
          this.tgAxes,
        ]),
        this.ghostOpacity,
        el('p', {
          class: 'note',
          html: '“遮挡件半透明”不是把整车变透明：程序按 <b>相机→目标包围球的视锥</b> 做几何遮挡判定，只有真正挡住视线的零件才会变透明。',
        }),
      ]),
    );

    /* ---------------- 6. 导出 ---------------- */
    this.exportStatus = el('p', { class: 'note', html: '尚未导出。' });
    this.tgExportInternal = toggle({
      label: '含内部结构（推荐）',
      checked: true,
      onchange: (v) => ctx.setExportInternal(v),
    });
    R.appendChild(
      section('模型导出', '⤓', null, false, [
        el('div', { class: 'grid g2' }, [
          el('button', { class: 'btn', text: 'GLB（推荐）', onclick: () => ctx.doExport('glb') }),
          el('button', { class: 'btn', text: 'glTF (JSON)', onclick: () => ctx.doExport('gltf') }),
          el('button', { class: 'btn', text: 'OBJ', onclick: () => ctx.doExport('obj') }),
          el('button', { class: 'btn', text: 'STL（打印）', onclick: () => ctx.doExport('stl') }),
        ]),
        el('div', { style: 'height:6px' }),
        this.tgExportInternal,
        el('div', { class: 'row' }, [el('label', { text: '截图（超采样）' })]),
        el('div', { class: 'grid g4' }, [
          el('button', { class: 'btn', text: '1×', onclick: () => ctx.doExport('png1') }),
          el('button', { class: 'btn', text: '2×', onclick: () => ctx.doExport('png2') }),
          el('button', { class: 'btn', text: '4×', onclick: () => ctx.doExport('png4') }),
          el('button', { class: 'btn', text: '透明底', onclick: () => ctx.doExport('png2t') }),
        ]),
        el('div', { style: 'height:6px' }),
        el('button', { class: 'btn wide', text: '⤓ 导出组件参数表 (JSON)', onclick: () => ctx.doExport('json') }),
        this.exportStatus,
        el('p', {
          class: 'note warn',
          html: 'GLB 保留节点层级（炮塔/火炮/后坐组各自成节点）与内嵌贴图；OBJ 仅几何 + 材质名；STL 为纯三角网格，适合 3D 打印。导出前会自动清除红色高亮与半透明覆盖。',
        }),
      ]),
    );

    /* ---------------- 7. 说明 ---------------- */
    const specTable = el('table', { class: 'spec-table' });
    for (const [k, v] of GENERAL_SPECS) specTable.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { text: v })]));
    R.appendChild(
      section('总体参数与说明', 'ℹ', null, false, [
        specTable,
        el('p', { class: 'note warn', text: DISCLAIMER }),
        el('p', {
          class: 'note',
          html: '模型统计：<b id="statLine">—</b><br/>坐标系：X 右 / Y 上 / Z 车头，单位米，1:1 实尺。',
        }),
      ]),
    );
  }

  /* ---------------- 交互状态同步 ---------------- */
  pickShadow(e, n) {
    for (const b of e.target.parentNode.children) b.classList.remove('on');
    e.target.classList.add('on');
    this.ctx.setShadowQuality(n);
  }

  pickDpr(e, n) {
    for (const b of e.target.parentNode.children) b.classList.remove('on');
    e.target.classList.add('on');
    this.ctx.setDpr(n);
  }

  filter(q) {
    const key = q.toLowerCase();
    for (const box of this.listWrap.children) {
      let shown = 0;
      for (const b of box.querySelectorAll('.item')) {
        const hit = !key || b.dataset.key.includes(key);
        b.style.display = hit ? '' : 'none';
        if (hit) shown++;
      }
      box.style.display = shown ? '' : 'none';
    }
  }

  /** 高亮当前条目并插入详情卡 */
  setActiveItem(item) {
    for (const [, b] of this.itemButtons) b.classList.remove('on');
    if (this.detailNode) {
      this.detailNode.remove();
      this.detailNode = null;
    }
    this.currentItem = item ? item.id : null;
    if (!item) return;
    const btn = this.itemButtons.get(item.id);
    if (!btn) return;
    btn.classList.add('on');
    const d = el('div', { class: 'detail' });
    d.appendChild(el('p', { text: item.desc || '' }));
    if (item.specs && item.specs.length) {
      const t = el('table');
      for (const [k, v] of item.specs) t.appendChild(el('tr', {}, [el('td', { text: k }), el('td', { text: v })]));
      d.appendChild(t);
    }
    btn.after(d);
    this.detailNode = d;
    const r = btn.getBoundingClientRect();
    if (r.top < 90 || r.bottom > window.innerHeight - 140) {
      btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  setScheme(id) {
    for (const [k, b] of this.schemeButtons) b.classList.toggle('on', k === id);
    const s = SCHEMES.find((x) => x.id === id);
    if (s && this.weatherSlider) this.weatherSlider.setValue(s.weather);
  }

  setLightPreset(id) {
    for (const [k, b] of this.lightButtons) b.classList.toggle('on', k === id);
    const p = LIGHT_PRESETS.find((x) => x.id === id);
    if (!p) return;
    this.sunAz.setValue(p.sun.az);
    this.sunEl.setValue(p.sun.el);
    this.exposure.setValue(p.exposure);
    this.bloomS.setValue(p.bloom.strength);
  }

  setTurretValue(deg) {
    this.turretSlider.setValue(+deg.toFixed(1));
  }

  setGunValue(deg) {
    this.gunSlider.setValue(+deg.toFixed(1));
  }

  setFireEnabled(on, label) {
    this.fireBtn.disabled = !on;
    this.fireBtn.textContent = label || (on ? '⊙ 开 火' : '装填中…');
  }

  setExportStatus(html) {
    this.exportStatus.innerHTML = html;
  }

  setInternalsValue(v) {
    this.tgInternal.setValue(v);
  }

  setStats(text) {
    const n = this.root.querySelector('#statLine');
    if (n) n.textContent = text;
  }
}
