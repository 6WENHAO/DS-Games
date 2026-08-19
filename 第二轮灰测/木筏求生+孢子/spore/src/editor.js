/* ==========================================================================
   SPORE · editor.js
   全屏生物编辑器（细胞 / 生物 / 部落装备）+ 载具与飞船外观设计器
   —— 自带独立 THREE.Scene 与轨道相机，由 game.js 在编辑器打开时代替阶段场景渲染
   ========================================================================== */
SP.Editor = (function () {
  const U = SP.U, G = SP.Genome;
  let game = null, scene = null, cam = null, model = null, platform = null;
  let open = false, kind = 'creature', onDone = null;
  let genome = null, design = null;
  let cat = 'mouth', pattern = 'none';
  let yaw = .6, pitch = .3, dist = 5, spin = true;
  let dragging = false, lastX = 0, lastY = 0;
  const E = {};

  /* ---------------------------------------------------------- 初始化 */
  function init(g) {
    game = g;
    scene = new THREE.Scene();
    scene.background = null;
    cam = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, .05, 200);

    const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x203050, 1.0); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 7, 5);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = .5; key.shadow.camera.far = 30;
    key.shadow.camera.left = -6; key.shadow.camera.right = 6; key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fd8ff, .9); rim.position.set(-5, 3, -5); scene.add(rim);
    const fill = new THREE.PointLight(0xa56cff, .8, 20); fill.position.set(0, 2, -4); scene.add(fill);

    // 编辑台
    platform = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, .22, 48),
      new THREE.MeshStandardMaterial({ color: 0x16255c, roughness: .5, metalness: .3 }));
    disc.position.y = -.11; disc.receiveShadow = true; platform.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.72, .06, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x3fe8ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = .02; platform.add(ring);
    const grid = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, .01, 48),
      new THREE.MeshBasicMaterial({ map: SP.Tex.hologram(6, 6), transparent: true, opacity: .32 }));
    grid.position.y = .015; platform.add(grid);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(2.9 + i * .3, .012, 6, 60),
        new THREE.MeshBasicMaterial({ color: 0x2a7fa8, transparent: true, opacity: .5 - i * .12 }));
      r.rotation.x = Math.PI / 2; r.position.y = .02 + i * .01;
      platform.add(r);
    }
    scene.add(platform);
    // 背景星点
    const N = 500, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * U.TAU, b = Math.acos(U.rand(-1, 1)), r = U.rand(25, 60);
      pos[i * 3] = Math.sin(b) * Math.cos(a) * r;
      pos[i * 3 + 1] = Math.cos(b) * r;
      pos[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0x9fd8ff, size: .28, sizeAttenuation: true, transparent: true, opacity: .7 })));

    cacheDom();
    bindDom();
  }

  function cacheDom() {
    E.panel = document.getElementById('panel-editor');
    E.title = document.getElementById('ed-title');
    E.sub = document.getElementById('ed-sub');
    E.dna = document.getElementById('ed-dna');
    E.done = document.getElementById('ed-done');
    E.cats = document.getElementById('ed-cats');
    E.parts = document.getElementById('ed-parts');
    E.abil = document.getElementById('ed-abil');
    E.stats = document.getElementById('ed-stats');
    E.list = document.getElementById('ed-list');
    E.pats = document.getElementById('ed-pats');
    E.len = document.getElementById('ed-len'); E.fat = document.getElementById('ed-fat');
    E.seg = document.getElementById('ed-seg'); E.arch = document.getElementById('ed-arch');
    E.h = document.getElementById('ed-h'); E.s = document.getElementById('ed-s'); E.l = document.getElementById('ed-l');
  }

  function bindDom() {
    E.done.addEventListener('click', () => finish());
    ['len', 'fat', 'seg', 'arch'].forEach(k => E[k].addEventListener('input', () => { rebuildSpine(); rebuild(); }));
    ['h', 's', 'l'].forEach(k => E[k].addEventListener('input', () => {
      if (!genome) return;
      genome.skin.h = +E.h.value; genome.skin.s = +E.s.value; genome.skin.l = +E.l.value;
      rebuild();
    }));
    const PATS = [['none', '纯色'], ['spots', '斑点'], ['stripes', '条纹'], ['gradient', '渐变'], ['scales', '鳞片']];
    E.pats.innerHTML = PATS.map(p => '<button data-p="' + p[0] + '">' + p[1] + '</button>').join('');
    E.pats.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      pattern = b.dataset.p;
      if (genome) genome.skin.pattern = pattern;
      E.pats.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      SP.Audio.play('ui_hover');
      rebuild();
    }));

    // 视角控制（拖动/滚轮）
    const cv = document.getElementById('scene');
    cv.addEventListener('mousedown', e => {
      if (!open) return;
      dragging = true; spin = false; lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (!open || !dragging) return;
      yaw -= (e.clientX - lastX) * .008;
      pitch = U.clamp(pitch + (e.clientY - lastY) * .006, -.9, 1.2);
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('wheel', e => {
      if (!open) return;
      dist = U.clamp(dist + (e.deltaY > 0 ? .45 : -.45), 2.0, 12);
    }, { passive: true });
    window.addEventListener('keydown', e => {
      if (!open) return;
      if (e.code === 'Escape' || e.code === 'Enter') finish();
      if (e.code === 'KeyR') spin = !spin;
    });
  }

  /* ---------------------------------------------------------- 打开 / 关闭 */
  const KIND_TITLE = {
    cell: ['细胞编辑器', 'DNA 换部件 —— 决定你吃什么、跑多快、怎么打'],
    creature: ['生物编辑器', '拖放部件，塑造你的物种'],
    tribe: ['部落装备编辑器', '调整外观与配色（部落成员会同步更新）'],
    city: ['载具设计器', '给你的载具选一套涂装与造型'],
    ship: ['飞船设计器', '设计你的星际飞船']
  };

  function openEditor(k, cb) {
    kind = k || 'creature';
    onDone = cb || null;
    open = true;
    E.panel.classList.remove('hidden');
    const t = KIND_TITLE[kind] || KIND_TITLE.creature;
    E.title.textContent = t[0]; E.sub.textContent = t[1];
    game.lockPointer(false);
    SP.Audio.play('ui_open');
    spin = true; yaw = .6; pitch = .3;

    if (kind === 'city' || kind === 'ship') {
      design = game.design && game.design[kind] ? JSON.parse(JSON.stringify(game.design[kind]))
        : { h: kind === 'ship' ? 200 : 30, s: 70, l: 55, style: 0, bulk: 1, wings: 1, guns: 1 };
      E.h.value = design.h; E.s.value = design.s; E.l.value = design.l;
      dist = kind === 'ship' ? 6 : 5;
      buildDesignCats();
    } else {
      genome = G.clone(kind === 'cell' ? (game.genome.kind === 'cell' ? game.genome : G.newCell())
        : (game.genome.kind === 'creature' ? game.genome : G.newCreature(game.genome)));
      pattern = genome.skin.pattern || 'none';
      E.h.value = genome.skin.h; E.s.value = genome.skin.s; E.l.value = genome.skin.l;
      // 由现有脊椎反推滑块
      const sp = genome.spine;
      const len = Math.abs(sp[sp.length - 1].z - sp[0].z);
      E.len.value = Math.round(U.clamp(len / 2.2 * 100, 40, 220));
      let maxR = 0; sp.forEach(s => maxR = Math.max(maxR, s.r));
      E.fat.value = Math.round(U.clamp(maxR / .38 * 100, 50, 200));
      E.seg.value = sp.length;
      E.arch.value = 20;
      dist = kind === 'cell' ? 2.6 : 5;
      E.pats.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.p === pattern));
      buildCats();
    }
    rebuild();
  }
  function finish() {
    if (!open) return;
    open = false;
    E.panel.classList.add('hidden');
    SP.Audio.play('confirm');
    if (kind === 'city' || kind === 'ship') {
      if (!game.design) game.design = {};
      game.design[kind] = design;
      if (onDone) onDone(design);
    } else {
      game.genome = genome;
      if (onDone) onDone(genome);
    }
    if (model) { scene.remove(model); G.dispose(model); model = null; }
    if (game.wantsPointer) game.lockPointer(true);
  }

  /* ---------------------------------------------------------- 分类与部件面板 */
  const CAT_NAME = {
    cell: '细胞', mouth: '嘴', eye: '眼', foot: '足', grasper: '手', wing: '翼', tail: '尾', weapon: '武器', detail: '装饰'
  };
  function catsFor() {
    return kind === 'cell' ? ['cell'] : ['mouth', 'eye', 'foot', 'grasper', 'wing', 'tail', 'weapon', 'detail'];
  }
  function buildCats() {
    const cs = catsFor();
    if (cs.indexOf(cat) < 0) cat = cs[0];
    E.cats.innerHTML = cs.map(c => '<button data-c="' + c + '"' + (c === cat ? ' class="on"' : '') + '>' + CAT_NAME[c] + '</button>').join('');
    E.cats.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      cat = b.dataset.c;
      SP.Audio.play('ui_hover');
      buildCats(); buildParts();
    }));
    buildParts();
  }
  function buildParts() {
    const unlocked = game.unlockedParts || {};
    const list = Object.keys(G.PARTS).filter(id => {
      const d = G.PARTS[id];
      if (cat === 'cell') return d.kind === 'cell';
      return d.kind === cat;
    });
    E.parts.innerHTML = list.map(id => {
      const d = G.PARTS[id];
      const locked = kind !== 'cell' && !unlocked[id] && SP.DB.CREATURE.starterParts.indexOf(id) < 0;
      const afford = game.dna >= d.cost;
      const ab = d.ability ? Object.keys(d.ability).map(k => G.ABILITY_NAMES[k] + ' ' + d.ability[k]).join(' · ') : '';
      return '<div class="pcell' + (locked || !afford ? ' no' : '') + '" data-id="' + id + '">' +
        '<div class="pi">' + d.ico + '</div><div class="pn">' + d.name + '</div>' +
        '<div class="pc">🧬 ' + d.cost + '</div>' +
        '<div class="pt"><b>' + d.name + '</b><br>' + d.desc +
        (ab ? '<br><em>' + ab + '</em>' : '') +
        (locked ? '<br><span style="color:#ff8fa8">未解锁：挖掘骨骸可获得</span>' : '') +
        '</div></div>';
    }).join('');
    E.parts.querySelectorAll('.pcell').forEach(c => c.addEventListener('click', () => addPart(c.dataset.id)));
  }
  function buildDesignCats() {
    E.cats.innerHTML = '<button class="on">造型</button>';
    const styles = kind === 'ship'
      ? [['碟形', 0], ['箭形', 1], ['蟹形', 2]]
      : [['轮式', 0], ['履带', 1], ['悬浮', 2]];
    E.parts.innerHTML = styles.map(s =>
      '<div class="pcell" data-style="' + s[1] + '"><div class="pi">' + (kind === 'ship' ? '🛸' : '🚙') + '</div>' +
      '<div class="pn">' + s[0] + '</div></div>').join('') +
      '<div class="pcell" data-inc="bulk"><div class="pi">➕</div><div class="pn">加粗机身</div></div>' +
      '<div class="pcell" data-dec="bulk"><div class="pi">➖</div><div class="pn">减细机身</div></div>' +
      '<div class="pcell" data-inc="wings"><div class="pi">🪽</div><div class="pn">加翼/加轮</div></div>' +
      '<div class="pcell" data-dec="wings"><div class="pi">🔻</div><div class="pn">减翼/减轮</div></div>' +
      '<div class="pcell" data-inc="guns"><div class="pi">🔫</div><div class="pn">加武器</div></div>' +
      '<div class="pcell" data-dec="guns"><div class="pi">🚫</div><div class="pn">减武器</div></div>';
    E.parts.querySelectorAll('.pcell').forEach(c => c.addEventListener('click', () => {
      SP.Audio.play('ui_click');
      if (c.dataset.style != null) design.style = +c.dataset.style;
      if (c.dataset.inc) design[c.dataset.inc] = U.clamp((design[c.dataset.inc] || 0) + 1, 0, 4);
      if (c.dataset.dec) design[c.dataset.dec] = U.clamp((design[c.dataset.dec] || 0) - 1, 0, 4);
      rebuild();
    }));
  }

  /* ---------------------------------------------------------- 部件增删 */
  function addPart(id) {
    const d = G.PARTS[id];
    if (!d) return;
    const unlocked = game.unlockedParts || {};
    if (kind !== 'cell' && !unlocked[id] && SP.DB.CREATURE.starterParts.indexOf(id) < 0) {
      game.ui.toast('🔒 该部件尚未解锁 —— 在生物阶段挖掘骨骸可以获得', 'bad');
      SP.Audio.play('deny'); return;
    }
    if (game.dna < d.cost) { game.ui.toast('🧬 DNA 不足（需要 ' + d.cost + '）', 'bad'); SP.Audio.play('deny'); return; }
    const sp = genome.spine;
    const head = sp.length - 1;
    const paired = ['eye', 'foot', 'grasper', 'wing'].indexOf(d.kind) >= 0;
    let seg = head, off = [0, 0, .26];
    if (d.kind === 'mouth') { removeKind('mouth'); seg = head; off = [0, -.04, .26]; }
    else if (d.kind === 'eye') { seg = head; off = [.15, .16, .1]; }
    else if (d.kind === 'foot') { seg = countKind('foot') >= 2 ? Math.max(2, head - 1) : 1; off = [.24, -.06, 0]; }
    else if (d.kind === 'grasper') { seg = Math.max(1, head - 1); off = [.26, .12, 0]; }
    else if (d.kind === 'wing') { seg = Math.max(1, Math.floor(head / 2)); off = [.2, .24, 0]; }
    else if (d.kind === 'tail') { removeKind('tail'); seg = 0; off = [0, .02, -.18]; }
    else if (d.kind === 'weapon' || d.kind === 'detail') { seg = Math.max(1, Math.floor(head / 2)); off = [0, .28, 0]; }
    else if (d.kind === 'cell') {
      if (id.indexOf('mouth_') === 0) { removeKind('cell', 'mouth_'); seg = sp.length - 1; off = [0, 0, .34]; }
      else if (id === 'cilia' || id === 'flagella' || id === 'jet') { removeMove(); seg = 0; off = [0, 0, -.3]; }
      else { seg = sp.length - 1; off = [0, .3, 0]; }
    }
    if (paired) {
      genome.parts.push({ id: id, seg: seg, side: -1, off: off, scale: 1, rot: [0, 0, 0] });
      genome.parts.push({ id: id, seg: seg, side: 1, off: off, scale: 1, rot: [0, 0, 0] });
      game.addDNA(-d.cost * 2 + d.cost);   // 成对只收一次基础价 + 半价
      game.addDNA(-Math.ceil(d.cost * 0));
    } else {
      genome.parts.push({ id: id, seg: seg, side: 0, off: off, scale: 1, rot: [0, 0, 0] });
    }
    game.addDNA(-d.cost);
    SP.Audio.play('dna');
    rebuild();
  }
  function countKind(k) {
    let n = 0;
    genome.parts.forEach(p => { if (G.PARTS[p.id] && G.PARTS[p.id].kind === k) n++; });
    return n;
  }
  function removeKind(k, prefix) {
    genome.parts = genome.parts.filter(p => {
      const d = G.PARTS[p.id];
      if (!d || d.kind !== k) return true;
      if (prefix && p.id.indexOf(prefix) !== 0) return true;
      return false;
    });
  }
  function removeMove() {
    genome.parts = genome.parts.filter(p => ['cilia', 'flagella', 'jet'].indexOf(p.id) < 0);
  }
  function removeAt(i) {
    const p = genome.parts[i];
    if (!p) return;
    const d = G.PARTS[p.id];
    genome.parts.splice(i, 1);
    if (d) game.addDNA(Math.floor(d.cost * .7));
    SP.Audio.play('ui_close');
    rebuild();
  }

  /* ---------------------------------------------------------- 体型 */
  function rebuildSpine() {
    if (!genome) return;
    const n = +E.seg.value;
    const len = +E.len.value / 100 * 2.2;
    const fat = +E.fat.value / 100;
    const arch = +E.arch.value / 100;
    const old = genome.spine.length;
    const sp = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? .5 : i / (n - 1);
      sp.push({
        x: 0,
        y: .1 + Math.sin(t * Math.PI) * arch * .5 + t * .1,
        z: -len / 2 + len * t,
        r: (.14 + Math.sin(t * Math.PI) * .28) * fat
      });
    }
    genome.spine = sp;
    // 把原来挂在越界节点上的部件收回来
    genome.parts.forEach(p => { if (p.seg >= n) p.seg = n - 1; });
    if (old !== n) { /* 节数变化：头尾部件位置自动重挂 */ }
  }

  /* ---------------------------------------------------------- 载具 / 飞船建模 */
  function buildDesign(d) {
    const g = new THREE.Group();
    const col = new THREE.Color(); col.setHSL(d.h / 360, U.clamp(d.s / 100, 0, 1), U.clamp(d.l / 100, .1, .9));
    const body = new THREE.MeshStandardMaterial({ color: col, roughness: .35, metalness: .55, map: SP.Tex.hull(1, 1) });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, roughness: .1, metalness: .2, transparent: true, opacity: .62 });
    const glow = new THREE.MeshBasicMaterial({ color: 0x6ff2ff });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3240, roughness: .6, metalness: .5 });
    const bulk = .7 + (d.bulk || 1) * .22;

    if (kind === 'ship') {
      if (d.style === 0) {
        const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), body);
        hull.scale.set(1.5 * bulk, .34, 1.5 * bulk); g.add(hull);
        const dome = new THREE.Mesh(new THREE.SphereGeometry(.52, 16, 10, 0, 6.3, 0, 1.6), glass);
        dome.position.y = .22; g.add(dome);
      } else if (d.style === 1) {
        const hull = new THREE.Mesh(new THREE.ConeGeometry(.62 * bulk, 2.6, 12), body);
        hull.rotation.x = Math.PI / 2; g.add(hull);
        const cock = new THREE.Mesh(new THREE.SphereGeometry(.35, 14, 10), glass);
        cock.position.set(0, .2, .45); cock.scale.set(1, .7, 1.4); g.add(cock);
      } else {
        const hull = new THREE.Mesh(new THREE.SphereGeometry(.85 * bulk, 16, 12), body);
        hull.scale.set(1.2, .6, 1); g.add(hull);
        [-1, 1].forEach(s => {
          const claw = new THREE.Mesh(new THREE.BoxGeometry(.24, .18, 1.5), body);
          claw.position.set(s * .8, 0, .6); claw.rotation.y = s * .18; g.add(claw);
        });
        const cock = new THREE.Mesh(new THREE.SphereGeometry(.4, 14, 10), glass);
        cock.position.set(0, .35, .2); g.add(cock);
      }
      for (let i = 0; i < (d.wings || 0); i++) {
        [-1, 1].forEach(s => {
          const w = new THREE.Mesh(new THREE.BoxGeometry(1.3, .07, .5), body);
          w.position.set(s * (.9 + i * .2), -.03 - i * .09, -.2 - i * .3);
          w.rotation.z = s * -.12; g.add(w);
        });
      }
      for (let i = 0; i < (d.guns || 0); i++) {
        [-1, 1].forEach(s => {
          const gun = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, .8, 8), dark);
          gun.rotation.x = Math.PI / 2;
          gun.position.set(s * (.45 + i * .18), -.12, .7); g.add(gun);
        });
      }
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, .3, 14), dark);
      eng.rotation.x = Math.PI / 2; eng.position.z = -1.1; g.add(eng);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(.26, .9, 12), glow);
      fl.rotation.x = -Math.PI / 2; fl.position.z = -1.6; g.add(fl);
      g.userData.flame = fl;
    } else {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5 * bulk, .55, 2.4), body);
      hull.position.y = .5; g.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.1 * bulk, .45, .9), glass);
      cab.position.set(0, .95, .4); g.add(cab);
      if (d.style === 0) {
        for (let i = 0; i < 2 + (d.wings || 0); i++) [-1, 1].forEach(s => {
          const wh = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .22, 14), dark);
          wh.rotation.z = Math.PI / 2;
          wh.position.set(s * .82 * bulk, .3, -.9 + i * (1.8 / Math.max(1, 1 + (d.wings || 0))));
          g.add(wh);
        });
      } else if (d.style === 1) {
        [-1, 1].forEach(s => {
          const tr = new THREE.Mesh(new THREE.BoxGeometry(.34, .44, 2.5), dark);
          tr.position.set(s * .85 * bulk, .32, 0); g.add(tr);
        });
      } else {
        [-1, 1].forEach(s => {
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(.3, .22, .18, 12), glow);
          pad.position.set(s * .8 * bulk, .16, 0); g.add(pad);
        });
      }
      for (let i = 0; i < (d.guns || 0); i++) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 1.0, 8), dark);
        t.rotation.x = Math.PI / 2;
        t.position.set(-.3 + i * .3, .85, 1.0); g.add(t);
      }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  /* ---------------------------------------------------------- 重建模型与面板 */
  function rebuild() {
    if (model) { scene.remove(model); G.dispose(model); model = null; }
    if (kind === 'city' || kind === 'ship') {
      model = buildDesign(design);
      model.position.y = kind === 'ship' ? 1.0 : 0;
      scene.add(model);
      renderDesignPanels();
      return;
    }
    model = G.build(genome, { scale: kind === 'cell' ? 1.4 : 1 });
    scene.add(model);
    renderPanels();
  }
  function renderPanels() {
    E.dna.textContent = U.fmt(game.dna);
    const ab = G.abilities(genome);
    const st = G.stats(genome);
    E.abil.innerHTML = G.COMBAT.concat(G.SOCIAL).map(k => {
      const soc = G.SOCIAL.indexOf(k) >= 0;
      let pips = '';
      for (let i = 1; i <= 5; i++) pips += '<i class="' + (soc ? 'soc ' : '') + (ab[k] >= i ? 'on' : '') + '"></i>';
      return '<div class="abrow"><span class="an">' + G.ABILITY_NAMES[k] + '</span><span class="abpips">' + pips + '</span></div>';
    }).join('');
    const diet = G.dietOf(genome);
    E.stats.innerHTML =
      '<div class="stline"><span>生命</span><b>' + st.health + '</b></div>' +
      '<div class="stline"><span>攻击</span><b>' + st.attack + '</b></div>' +
      '<div class="stline"><span>速度</span><b>×' + st.speed.toFixed(2) + '</b></div>' +
      '<div class="stline"><span>护甲</span><b>' + st.armor + '</b></div>' +
      '<div class="stline"><span>社交</span><b>' + st.social + '</b></div>' +
      '<div class="stline"><span>食性</span><b>' + SP.DB.DIET_NAME[diet] + '</b></div>' +
      (st.glide ? '<div class="stline"><span>滑翔</span><b>✔</b></div>' : '');
    E.list.innerHTML = genome.parts.map((p, i) => {
      const d = G.PARTS[p.id];
      return '<span data-i="' + i + '">' + (d ? d.ico + d.name : p.id) + (p.side ? (p.side < 0 ? '·左' : '·右') : '') + '</span>';
    }).join('');
    E.list.querySelectorAll('span').forEach(s => s.addEventListener('click', () => removeAt(+s.dataset.i)));
    buildParts();
  }
  function renderDesignPanels() {
    E.dna.textContent = U.fmt(game.money);
    E.abil.innerHTML = '<div class="stline"><span>造型</span><b>' +
      (kind === 'ship' ? ['碟形', '箭形', '蟹形'] : ['轮式', '履带', '悬浮'])[design.style || 0] + '</b></div>';
    E.stats.innerHTML =
      '<div class="stline"><span>机身</span><b>' + (design.bulk || 0) + '</b></div>' +
      '<div class="stline"><span>' + (kind === 'ship' ? '翼' : '轮组') + '</span><b>' + (design.wings || 0) + '</b></div>' +
      '<div class="stline"><span>武器</span><b>' + (design.guns || 0) + '</b></div>';
    E.list.innerHTML = '<span style="cursor:default">配色由右侧滑块控制</span>';
  }

  /* ---------------------------------------------------------- 每帧 */
  function update(dt) {
    if (!open) return;
    if (spin) yaw += dt * .35;
    const cy = Math.cos(pitch), sy = Math.sin(pitch);
    const h = kind === 'cell' ? .5 : 1.0;
    cam.position.set(Math.sin(yaw) * dist * cy, h + sy * dist, Math.cos(yaw) * dist * cy);
    cam.lookAt(0, h * .9, 0);
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    platform.rotation.y += dt * .12;
    if (model) {
      if (kind === 'city' || kind === 'ship') {
        model.rotation.y += dt * .0;
        if (model.userData.flame) {
          const s = .7 + Math.sin(game.time * 14) * .25;
          model.userData.flame.scale.set(s, 1 + Math.sin(game.time * 9) * .2, s);
        }
        model.position.y = (kind === 'ship' ? 1.0 : 0) + Math.sin(game.time * 1.3) * .06;
      } else {
        G.animate(model, game.time, { move: 0, action: Math.sin(game.time * .5) > .8 ? 'social' : null, speed: 1 });
      }
    }
  }
  function render(renderer) { renderer.render(scene, cam); }

  return {
    init, open: openEditor, close: finish, isOpen: () => open, update, render,
    get scene() { return scene; }, get camera() { return cam; }
  };
})();
