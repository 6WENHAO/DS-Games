// ---------------------------------------------------------------------------
// 界面：视角列表 / 构造开关 / 分层与拆解滑块 / 说明卡
// ---------------------------------------------------------------------------

export function initUI(o) {
  const { state, info, views, joints, flyTo, cai } = o;
  const $ = (id) => document.getElementById(id);
  const statEl = $('stats');
  const viewsEl = $('views');
  const ctrlEl = $('controls');
  const docEl = $('doc');

  /* ------------------------------ 视角 ------------------------------ */
  const vbtns = [];
  views.forEach((v) => {
    if (v.sep) {
      const d = document.createElement('div');
      d.className = 'vsep';
      viewsEl.appendChild(d);
      return;
    }
    const b = document.createElement('button');
    b.innerHTML = `<i>${v.key}</i><span>${v.name}</span>`;
    b.addEventListener('click', () => go(v));
    viewsEl.appendChild(b);
    vbtns.push({ v, b });
  });
  function go(v) {
    flyTo(v.pos, v.target, v.dur ?? 1.5);
    vbtns.forEach((x) => x.b.classList.toggle('active', x.v === v));
    if (v.labels !== undefined) {
      state.labels = v.labels;
      chk.labels.checked = v.labels;
      o.onLabels(v.labels);
    }
    o.onView?.(v);
  }

  /* ------------------------------ 控件 ------------------------------ */
  ctrlEl.innerHTML = `
    <div class="chks">
      <label class="chk"><input type="checkbox" id="c-xray"> 半透明</label>
      <label class="chk"><input type="checkbox" id="c-section"> 剖视</label>
      <label class="chk"><input type="checkbox" id="c-joints"> 榫卯高亮</label>
      <label class="chk"><input type="checkbox" id="c-walls" checked> 墙体门窗</label>
      <label class="chk"><input type="checkbox" id="c-labels"> 构件名牌</label>
      <label class="chk"><input type="checkbox" id="c-demo"> 示教件常显</label>
    </div>
    <div class="row"><label class="t">分层显示</label>
      <input type="range" id="c-layer" min="0" max="6" step="1" value="0">
      <span class="v" id="v-layer">全部</span></div>
    <div class="row"><label class="t">榫卯拆解</label>
      <input type="range" id="c-explode" min="0" max="100" step="1" value="0">
      <span class="v" id="v-explode">0%</span></div>`;

  const chk = {
    xray: $('c-xray'),
    section: $('c-section'),
    joints: $('c-joints'),
    walls: $('c-walls'),
    labels: $('c-labels'),
    demo: $('c-demo'),
  };
  chk.xray.onchange = () => {
    state.xray = chk.xray.checked;
    o.onXray(state.xray);
  };
  chk.section.onchange = () => {
    state.section = chk.section.checked;
    o.onSection(state.section);
  };
  chk.joints.onchange = () => {
    state.joints = chk.joints.checked;
    o.onJoints(state.joints);
  };
  chk.walls.onchange = () => {
    state.walls = chk.walls.checked;
    o.onWalls(state.walls);
  };
  chk.labels.onchange = () => {
    state.labels = chk.labels.checked;
    o.onLabels(state.labels);
  };
  chk.demo.onchange = () => {
    state.demoAlways = chk.demo.checked;
    o.onView?.({ show: null });
  };

  const layerEl = $('c-layer');
  const layerV = $('v-layer');
  const LAYER_NAME = ['全部', '一层 + 副阶', '二层 + 平坐', '三层 + 平坐', '四层 + 平坐', '五层 + 平坐', '屋顶 + 塔刹'];
  layerEl.oninput = () => {
    state.layer = +layerEl.value;
    layerV.textContent = LAYER_NAME[state.layer];
    o.onLayer(state.layer);
  };
  const expEl = $('c-explode');
  const expV = $('v-explode');
  expEl.oninput = () => {
    state.explode = +expEl.value / 100;
    expV.textContent = expEl.value + '%';
    o.onExplode(state.explode);
  };

  /* ----------------------------- 说明卡 ----------------------------- */
  const OVERVIEW = {
    name: '大木作总说',
    sub: '五层六檐 · 八角 · 双层套筒',
    html: `
      <p>塔身平面八角，外观五层六檐（底层副阶周匝，故多一檐）。每层「明层」之上都藏一个
      <b>暗层</b>，共 <b>5 明 4 暗</b> 九层结构。每层内槽 8 柱、外槽 24 柱，两圈之间以乳栿相连，
      形成刚劲的<b>双层套筒</b>；暗层内密布斜撑，成为一道八边形刚性箍。</p>
      <p>全塔<b>不用一根铁钉</b>：竖向靠柱与斗拱层层承压，水平靠阑额、普拍枋与榫卯拉结。
      节点可微动耗能，暗层箍保证整体不散 —— 这是它历经四十余次地震仍屹立近千年的原因。</p>
      <ul>
        <li>用材：材广 ${(cai.CAI * 100).toFixed(1)} cm、材厚 17 cm（《营造法式》二等材），1 分° = ${(cai.FEN * 100).toFixed(2)} cm</li>
        <li>柱作：侧脚（向内倾 1%）、生起（角柱加高）、收分（上细下粗）、逐层内收</li>
        <li>铺作：外檐柱头七铺作双抄双下昂，平坐五铺作卷头造，共 ${info.puzuoCount} 朵</li>
      </ul>
      <div class="tags"><span class="tag">榫卯 7 类</span><span class="tag">斗拱 ${info.puzuoCount} 朵</span>
      <span class="tag">构件 ${info.pieces.toLocaleString()}</span></div>
      <p style="color:#bdae97;font-size:12px">点击右下角滑块可拆解榫卯；点画面里的榫卯示教件可查看该节点说明。</p>`,
  };

  function renderDoc(spec) {
    if (!spec) {
      docEl.innerHTML = `<h3>${OVERVIEW.name}</h3><div class="sub2">${OVERVIEW.sub}</div>${OVERVIEW.html}${jointBar(-1)}`;
      bindBar();
      return;
    }
    docEl.innerHTML = `
      <h3>${spec.name}</h3>
      <div class="sub2">${spec.sub}</div>
      <p>${spec.desc}</p>
      <ul>${spec.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <div class="row"><label class="t">拆解</label>
        <input type="range" id="c-exp2" min="0" max="100" step="1" value="${Math.round(state.explode * 100)}">
        <span class="v" id="v-exp2">${Math.round(state.explode * 100)}%</span></div>
      ${jointBar(joints.indexOf(spec))}
      <div class="note">此件按真实用材尺寸放样（材广 ${(cai.CAI * 100).toFixed(1)} cm），
      拆解方向即施工时的入榫方向。</div>`;
    const e2 = $('c-exp2');
    const v2 = $('v-exp2');
    e2.oninput = () => {
      state.explode = +e2.value / 100;
      v2.textContent = e2.value + '%';
      expEl.value = e2.value;
      expV.textContent = e2.value + '%';
      o.onExplode(state.explode);
    };
    bindBar();
  }

  const jointBar = (cur) =>
    `<div class="jbtns"><button data-j="-1" class="${cur < 0 ? 'on' : ''}">总说</button>` +
    joints.map((j, i) => `<button data-j="${i}" class="${i === cur ? 'on' : ''}">${j.name}</button>`).join('') +
    `</div>`;

  function bindBar() {
    docEl.querySelectorAll('[data-j]').forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.j;
        if (i < 0) {
          state.jointIndex = -1;
          renderDoc(null);
        } else selectJoint(i);
      };
    });
  }

  function selectJoint(i) {
    state.jointIndex = i;
    renderDoc(joints[i]);
    o.onJointFocus(i);
    if (state.explode < 0.15) {
      state.explode = 0.55;
      expEl.value = '55';
      expV.textContent = '55%';
      const e2 = $('c-exp2');
      if (e2) {
        e2.value = '55';
        $('v-exp2').textContent = '55%';
      }
      o.onExplode(state.explode);
    }
  }

  renderDoc(null);

  /* ----------------------------- 状态栏 ----------------------------- */
  function tick(st) {
    statEl.innerHTML = `
      <span>总高 <b>${info.totalHeight.toFixed(2)}</b> m</span>
      <span>层 <b>5明4暗</b></span>
      <span>铺作 <b>${info.puzuoCount}</b> 朵</span>
      <span>构件 <b>${info.pieces.toLocaleString()}</b></span>
      <span>网格 <b>${info.instMeshes + 14}</b></span>
      <span><b>${st.fps}</b> FPS</span>`;
  }
  tick(state);

  return {
    tick,
    selectJoint,
    toggle(k) {
      if (!chk[k]) return;
      chk[k].checked = !chk[k].checked;
      chk[k].onchange();
    },
    gotoByKey(k) {
      const hit = vbtns.find((x) => x.v.key === k);
      if (hit) go(hit.v);
    },
    gotoByName(n) {
      const hit = vbtns.find((x) => x.v.name === n || x.v.name.includes(n));
      if (hit) go(hit.v);
    },
  };
}
