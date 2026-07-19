/* ===== UI：菜单 / HUD / 地图 / 结算 / 黑市 ===== */
"use strict";

const UI = {
  el(id) { return document.getElementById(id); },
  menuLayer() { return this.el("menu-layer"); },

  toast(msg, dur) {
    const t = this.el("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.remove("show"), dur || 1800);
  },

  /* ================= 主菜单 ================= */
  showMainMenu() {
    const p = Profile.data;
    this.menuLayer().innerHTML = `
    <div class="screen">
      <div class="coin-tag">哈夫币 ${fmtCoin(p.coins)}</div>
      <div class="title-wrap">
        <div class="game-title">三角洲行动<span class="df-red">▲</span></div>
        <div class="game-sub">DELTA FORCE · WEB</div>
        <div class="fan-note">非官方粉丝同人复刻 · 灵感来自琳琅天上《三角洲行动》</div>
      </div>
      <div class="menu-btns">
        <button class="menu-btn primary" data-act="prep">烽火地带<span class="btn-sub">HAZARD OPERATION · 搜打撤</span></button>
        <button class="menu-btn" data-act="stash">仓库 / 黑市<span class="btn-sub">管理装备 · 买卖物资</span></button>
        <button class="menu-btn" data-act="settings">设置<span class="btn-sub">灵敏度 · 视野 · 音量</span></button>
        <button class="menu-btn" data-act="help">行动手册<span class="btn-sub">操作说明 · 玩法介绍</span></button>
      </div>
      <div class="menu-foot">战绩：出击 ${p.raids} ｜ 撤离 ${p.extracts} ｜ 击杀 ${p.kills} ｜ 阵亡 ${p.deaths}
        &nbsp;&nbsp;<a href="#" id="reset-save" style="color:#54707f">重置存档</a>
        <br><span style="font-size:11px;color:#3d5260">PBR 材质：ambientCG.com ｜ 3D 模型：Quaternius (poly.pizza)（均为 CC0 公共领域授权）</span></div>
    </div>`;
    this.menuLayer().querySelectorAll(".menu-btn").forEach(b => {
      b.onclick = () => {
        AudioSys.init(); AudioSys.resume(); AudioSys.ui();
        const act = b.dataset.act;
        if (act === "prep") this.showPrep();
        else if (act === "stash") this.showStash();
        else if (act === "settings") this.showSettings();
        else if (act === "help") this.showHelp();
      };
    });
    this.el("reset-save").onclick = (e) => {
      e.preventDefault();
      if (confirm("确定重置所有存档进度？")) { Profile.reset(); this.showMainMenu(); }
    };
  },

  /* ================= 行动准备 ================= */
  showPrep() {
    const p = Profile.data;
    const lo = p.loadout;
    const opCards = OPERATORS.map(o => `
      <div class="op-card ${lo.operator === o.id ? "sel" : ""}" data-op="${o.id}">
        <div class="op-avatar" style="background:${o.color}">${o.name[0]}</div>
        <span class="op-name">${o.name}</span><span class="op-en">${o.en}</span>
        <div><span class="op-class-tag">${o.cls}</span></div>
        <div class="op-desc">${o.desc}</div>
        <div class="op-skill">Q · ${o.ability.name}<small>${o.ability.tip}｜被动：${o.passive}</small></div>
      </div>`).join("");
    const mapCards = MAPS.map(m => `
      <div class="map-card ${m.unlocked ? (m.id === "zerodam" ? "sel" : "") : "locked"}">
        <div class="map-pic" style="background:linear-gradient(160deg,${m.grad[0]},${m.grad[1]})">${m.name}</div>
        <div class="map-meta">${m.en}<br>${m.desc}</div>
      </div>`).join("");

    this.menuLayer().innerHTML = `
    <div class="screen sub-screen">
      <button class="back-btn" id="back-main">返回</button>
      <div class="coin-tag" style="right:150px">哈夫币 ${fmtCoin(p.coins)}</div>
      <div class="sub-title">烽火地带 · 行动准备<small>选择干员与装备，随后出击</small></div>
      <div style="display:flex;gap:30px;flex-wrap:wrap">
        <div style="flex:1;min-width:500px">
          <div class="panel-head" style="margin-top:14px">选择干员</div>
          <div class="op-row">${opCards}</div>
          <div class="panel-head">作战地图</div>
          <div class="map-row">${mapCards}</div>
        </div>
        <div style="flex:1;min-width:420px">
          <div class="panel-head" style="margin-top:14px">装备配置（从仓库点击装备）</div>
          <div class="loadout-wrap">
            <div class="loadout-col">
              <div id="loadout-slots"></div>
            </div>
            <div class="loadout-col">
              <div class="sb-label" style="font-size:12px;color:#6f8898;margin-bottom:4px">仓库物品（点击装备 / 携带）</div>
              <div class="stash-list" id="prep-stash"></div>
            </div>
          </div>
        </div>
      </div>
      <button class="deploy-btn" id="deploy-btn">出 击</button>
      <div style="text-align:center;font-size:12px;color:#54707f;margin-bottom:20px" id="loadout-value"></div>
    </div>`;

    this.menuLayer().querySelectorAll(".op-card").forEach(c => {
      c.onclick = () => {
        lo.operator = c.dataset.op;
        Profile.save();
        this.menuLayer().querySelectorAll(".op-card").forEach(cc => cc.classList.remove("sel"));
        c.classList.add("sel");
        AudioSys.ui();
      };
    });
    this.el("back-main").onclick = () => { AudioSys.ui(); this.showMainMenu(); };
    this.el("deploy-btn").onclick = () => {
      AudioSys.ui();
      App.startRaid();
    };
    this.renderLoadout();
  },

  renderLoadout() {
    const p = Profile.data, lo = p.loadout;
    const slotEl = this.el("loadout-slots");
    if (!slotEl) return;
    const slotDef = [
      ["primary", "主武器"], ["secondary", "副武器"], ["helmet", "头盔"],
      ["armor", "护甲"], ["rig", "胸挂"], ["bag", "背包"]
    ];
    let html = "";
    for (const [k, label] of slotDef) {
      const uid = lo[k];
      const it = uid ? Profile.findItem(uid) : null;
      const d = it ? DEF(it.id) : null;
      html += `<div class="slot-box"><div class="sb-label">${label}</div>
        <div class="sb-item ${d ? "" : "empty"}">${d ? `<span style="color:${RARITY[d.rarity].color}">${d.name}</span>` : "未装备"}
        ${it ? `<button data-unequip="${uid}">卸下</button>` : ""}</div></div>`;
    }
    const pouchItems = lo.pouch.map(uid => {
      const it = Profile.findItem(uid);
      if (!it) return "";
      const d = DEF(it.id);
      return `<span style="color:${RARITY[d.rarity].color};margin-right:8px">${d.name}
        <button data-unequip="${uid}" style="font-size:10px">×</button></span>`;
    }).join("");
    html += `<div class="slot-box"><div class="sb-label">携行物资（弹药/医疗，容量 ${Profile.pouchUsed()}/${Profile.pouchCapacity()}）</div>
      <div class="sb-item ${lo.pouch.length ? "" : "empty"}">${pouchItems || "空"}</div></div>`;
    slotEl.innerHTML = html;
    slotEl.querySelectorAll("[data-unequip]").forEach(b => {
      b.onclick = () => { Profile.unequip(parseInt(b.dataset.unequip)); AudioSys.ui(); this.renderLoadout(); };
    });

    /* 仓库列表 */
    const stashEl = this.el("prep-stash");
    const items = p.stash.filter(it => !Profile.isEquipped(it.uid));
    items.sort((a, b) => DEF(b.id).value - DEF(a.id).value);
    stashEl.innerHTML = items.length ? "" : '<div style="color:#54707f;padding:10px">仓库空空如也，去黑市采购吧</div>';
    for (const it of items) {
      const d = DEF(it.id);
      const kindTxt = { weapon: "武器", armor: "护甲", helmet: "头盔", bag: "背包", rig: "胸挂", med: "医疗", ammo: "弹药", loot: "战利品" }[d.kind];
      const row = document.createElement("div");
      row.className = "stash-item";
      const canEquip = ["weapon", "armor", "helmet", "bag", "rig", "med", "ammo"].includes(d.kind);
      row.innerHTML = `<div><span class="si-name" style="color:${RARITY[d.rarity].color}">${d.name}</span>
        <div class="si-meta">${kindTxt} ｜ ${fmtCoin(d.value)} 哈夫币</div></div>
        <div class="si-actions">${canEquip ? `<button data-eq="${it.uid}">${d.kind === "med" || d.kind === "ammo" ? "携带" : "装备"}</button>` : ""}</div>`;
      stashEl.appendChild(row);
    }
    stashEl.querySelectorAll("[data-eq]").forEach(b => {
      b.onclick = () => {
        const r = Profile.equip(parseInt(b.dataset.eq));
        if (r === "full") this.toast("携行容量不足（换更大的胸挂）");
        AudioSys.ui();
        this.renderLoadout();
      };
    });
    const lv = this.el("loadout-value");
    if (lv) lv.textContent = `当前装备价值：${fmtCoin(Profile.loadoutValue())} 哈夫币（阵亡将全部损失，安全箱内物品除外）`;
  },
  /* ================= 仓库 / 黑市 ================= */
  showStash(tab) {
    const p = Profile.data;
    tab = tab || "仓库";
    const tabs = ["仓库"].concat(Object.keys(SHOP_STOCK));
    this.menuLayer().innerHTML = `
    <div class="screen sub-screen">
      <button class="back-btn" id="back-main">返回</button>
      <div class="coin-tag" style="right:150px">哈夫币 <span id="coin-num">${fmtCoin(p.coins)}</span></div>
      <div class="sub-title">仓库 / 黑市交易行<small>出售战利品换取哈夫币，或采购新装备</small></div>
      <div class="shop-tabs">${tabs.map(t => `<div class="shop-tab ${t === tab ? "sel" : ""}" data-tab="${t}">${t}</div>`).join("")}</div>
      <div id="stash-body"></div>
    </div>`;
    this.el("back-main").onclick = () => { AudioSys.ui(); this.showMainMenu(); };
    this.menuLayer().querySelectorAll(".shop-tab").forEach(t => {
      t.onclick = () => { AudioSys.ui(); this.showStash(t.dataset.tab); };
    });
    const body = this.el("stash-body");
    if (tab === "仓库") {
      const items = p.stash.slice().sort((a, b) => DEF(b.id).value - DEF(a.id).value);
      if (!items.length) { body.innerHTML = '<div style="color:#54707f;padding:20px">仓库为空</div>'; return; }
      const list = document.createElement("div");
      list.className = "stash-list";
      list.style.maxHeight = "60vh";
      for (const it of items) {
        const d = DEF(it.id);
        const equipped = Profile.isEquipped(it.uid);
        const row = document.createElement("div");
        row.className = "stash-item";
        row.innerHTML = `<div><span class="si-name" style="color:${RARITY[d.rarity].color}">${d.name}</span>
          ${equipped ? '<span style="font-size:10px;color:#7bed9f;margin-left:6px">[已装备]</span>' : ""}
          <div class="si-meta">${fmtCoin(d.value)} 哈夫币</div></div>
          <div class="si-actions"><button class="sell" data-sell="${it.uid}">出售</button></div>`;
        list.appendChild(row);
      }
      body.appendChild(list);
      body.querySelectorAll("[data-sell]").forEach(b => {
        b.onclick = () => {
          const v = Profile.sellItem(parseInt(b.dataset.sell));
          this.toast(`出售成功 +${fmtCoin(v)} 哈夫币`);
          AudioSys.pickup();
          this.showStash("仓库");
        };
      });
    } else {
      const grid = document.createElement("div");
      grid.className = "shop-grid";
      for (const id of SHOP_STOCK[tab]) {
        const d = DEF(id);
        const price = shopPrice(d);
        let desc = "";
        if (d.kind === "weapon") desc = `伤害${d.dmg} 射速${d.rpm} 弹匣${d.mag}${d.pellets ? " 霰弹" : ""}`;
        else if (d.kind === "armor" || d.kind === "helmet") desc = `耐久${d.durability} 减伤${Math.round(d.reduce * 100)}%`;
        else if (d.kind === "bag" || d.kind === "rig") desc = `容量 ${d.cols}×${d.rows}`;
        else if (d.kind === "med") desc = `恢复${d.heal >= 200 ? "全部" : d.heal}，耗时${d.useTime}s`;
        else if (d.kind === "ammo") desc = `${d.count}发`;
        const card = document.createElement("div");
        card.className = "shop-card";
        card.innerHTML = `<div class="sc-name" style="color:${RARITY[d.rarity].color}">${d.name}</div>
          <div class="sc-desc">${desc}</div>
          <div class="sc-buy"><span class="sc-price">${fmtCoin(price)}</span>
          <button data-buy="${id}" ${p.coins < price ? "disabled" : ""}>购买</button></div>`;
        grid.appendChild(card);
      }
      body.appendChild(grid);
      body.querySelectorAll("[data-buy]").forEach(b => {
        b.onclick = () => {
          if (Profile.buyItem(b.dataset.buy)) {
            this.toast("购买成功，已放入仓库");
            AudioSys.pickup();
            this.showStash(tab);
          } else this.toast("哈夫币不足");
        };
      });
    }
  },

  /* ================= 设置 ================= */
  showSettings() {
    const s = App.settings;
    this.menuLayer().innerHTML = `
    <div class="screen sub-screen">
      <button class="back-btn" id="back-main">返回</button>
      <div class="sub-title">设置</div>
      <div class="settings-box">
        <div class="set-row"><span>鼠标灵敏度</span><input type="range" id="set-sens" min="0.2" max="3" step="0.1" value="${s.sens}"><span class="set-val" id="v-sens">${s.sens.toFixed(1)}</span></div>
        <div class="set-row"><span>视野 FOV</span><input type="range" id="set-fov" min="60" max="110" step="1" value="${s.fov}"><span class="set-val" id="v-fov">${s.fov}</span></div>
        <div class="set-row"><span>音量</span><input type="range" id="set-vol" min="0" max="1" step="0.05" value="${s.volume}"><span class="set-val" id="v-vol">${Math.round(s.volume * 100)}%</span></div>
        <div class="set-row"><span>阴影（重开局生效）</span><input type="checkbox" id="set-shadow" ${s.shadows ? "checked" : ""}></div>
      </div>
    </div>`;
    this.el("back-main").onclick = () => { App.saveSettings(); AudioSys.ui(); this.showMainMenu(); };
    this.el("set-sens").oninput = (e) => { s.sens = parseFloat(e.target.value); this.el("v-sens").textContent = s.sens.toFixed(1); };
    this.el("set-fov").oninput = (e) => { s.fov = parseInt(e.target.value); this.el("v-fov").textContent = s.fov; };
    this.el("set-vol").oninput = (e) => { s.volume = parseFloat(e.target.value); this.el("v-vol").textContent = Math.round(s.volume * 100) + "%"; AudioSys.setVolume(s.volume); };
    this.el("set-shadow").onchange = (e) => { s.shadows = e.target.checked; };
  },

  /* ================= 行动手册 ================= */
  showHelp() {
    this.menuLayer().innerHTML = `
    <div class="screen sub-screen">
      <button class="back-btn" id="back-main">返回</button>
      <div class="sub-title">行动手册<small>烽火地带规则</small></div>
      <div class="help-cols">
        <div class="help-block">
          <h3>基础操作</h3>
          <table>
            <tr><td class="k">W A S D</td><td>移动</td></tr>
            <tr><td class="k">Shift</td><td>疾跑</td></tr>
            <tr><td class="k">Ctrl / C</td><td>蹲伏（降低被发现概率）</td></tr>
            <tr><td class="k">空格</td><td>跳跃</td></tr>
            <tr><td class="k">鼠标左键</td><td>开火</td></tr>
            <tr><td class="k">鼠标右键</td><td>机瞄 / 开镜</td></tr>
            <tr><td class="k">R</td><td>换弹</td></tr>
            <tr><td class="k">1 / 2</td><td>切换主/副武器</td></tr>
            <tr><td class="k">4</td><td>快速使用医疗</td></tr>
            <tr><td class="k">Q</td><td>干员战术技能</td></tr>
            <tr><td class="k">F</td><td>搜索容器 / 交互</td></tr>
            <tr><td class="k">Tab</td><td>背包</td></tr>
            <tr><td class="k">M</td><td>战术地图</td></tr>
            <tr><td class="k">Esc</td><td>释放鼠标</td></tr>
          </table>
        </div>
        <div class="help-block">
          <h3>搜打撤流程</h3>
          <table>
            <tr><td>1.</td><td>在准备界面配置武器、护甲与携行物资后出击</td></tr>
            <tr><td>2.</td><td>搜索地图中的收纳箱、保险柜、武器箱获取战利品</td></tr>
            <tr><td>3.</td><td>击败游荡者与厂房头目，搜刮其遗物</td></tr>
            <tr><td>4.</td><td>在时限内抵达绿色撤离点，站立数秒完成撤离</td></tr>
            <tr><td>5.</td><td>撤离成功则物资入库；阵亡损失一切（安全箱除外）</td></tr>
            <tr><td>6.</td><td>在黑市出售战利品，换取哈夫币升级装备</td></tr>
          </table>
        </div>
        <div class="help-block">
          <h3>提示</h3>
          <table>
            <tr><td>·</td><td>安全箱容量 3×3，珍贵物品优先放入</td></tr>
            <tr><td>·</td><td>枪声和奔跑会暴露位置，蹲伏接近更安全</td></tr>
            <tr><td>·</td><td>水电站厂房藏有头目与保险柜，高风险高回报</td></tr>
            <tr><td>·</td><td>大坝顶部有高级物资箱，可从东侧坡道上坝</td></tr>
            <tr><td>·</td><td>红色品质"曼德尔砖"价值百万哈夫币</td></tr>
          </table>
        </div>
      </div>
    </div>`;
    this.el("back-main").onclick = () => { AudioSys.ui(); this.showMainMenu(); };
  },

  /* ================= 结算 ================= */
  showSettlement(result) {
    const p = Profile.data;
    const cls = result.success ? "ok" : "dead";
    const title = result.success ? "撤离成功" : (result.reason === "timeout" ? "任务失败 · 失踪" : "阵亡");
    const lootRows = result.loot.map(id => {
      const d = DEF(id);
      return `<div class="sl-row"><span style="color:${RARITY[d.rarity].color}">${d.name}</span><span>${fmtCoin(d.value)}</span></div>`;
    }).join("") || '<div class="sl-row"><span style="color:#54707f">没有带出任何物资</span></div>';
    const total = result.loot.reduce((s, id) => s + DEF(id).value, 0);
    const mins = Math.floor(result.time / 60), secs = Math.floor(result.time % 60);
    this.menuLayer().innerHTML = `
    <div class="screen">
      <div class="settle-box">
        <div class="settle-result ${cls}">${title}</div>
        <div class="settle-sub">${result.success ? "撤离点：" + result.extractName : (result.reason === "timeout" ? "行动超时，信号消失" : "被 " + (result.killer || "游荡者") + " 击杀")}</div>
        <div class="settle-stats">
          <div><div class="st-v">${result.kills}</div><div class="st-k">击杀</div></div>
          <div><div class="st-v">${mins}:${String(secs).padStart(2, "0")}</div><div class="st-k">存活时间</div></div>
          <div><div class="st-v">${result.loot.length}</div><div class="st-k">带出物品</div></div>
        </div>
        <div class="settle-loot">${lootRows}</div>
        <div class="settle-total">物资总值 ${fmtCoin(total)} 哈夫币${result.success ? "（已入库）" : "（安全箱物品已入库）"}</div>
        <button class="deploy-btn" id="settle-ok" style="width:100%;margin:0">确 认</button>
      </div>
    </div>`;
    this.el("settle-ok").onclick = () => { AudioSys.ui(); this.showMainMenu(); };
  },
  /* ================= HUD ================= */
  showHud(show) {
    this.el("hud").classList.toggle("hidden", !show);
    if (show) {
      this.el("killfeed").innerHTML = "";
      this.el("dmg-numbers").innerHTML = "";
      this._dmgNums = [];
      this.updateHealthHud();
      this.updateWeaponHud();
      this.updateAbilityHud();
      const op = Player.operator;
      this.el("op-name").textContent = op.name;
      this.el("op-class").textContent = op.cls;
      this.el("ability-name").textContent = op.ability.name;
    }
  },

  updateHealthHud() {
    const pct = Math.max(0, Player.hp / Player.maxHp * 100);
    const fill = this.el("hp-fill");
    fill.style.width = pct + "%";
    fill.classList.toggle("low", pct < 35);
    this.el("hp-text").textContent = Math.ceil(Player.hp);
    this.el("lowhp-vignette").style.opacity = Player.hp < 35 ? (1 - Player.hp / 35) * 0.9 : 0;
    this.el("armor-info").textContent = Player.armor ?
      `${DEF(Player.armor.defId).name.slice(0, 2)} ${Math.ceil(Player.armor.dur)}` : "无护甲";
    this.el("helmet-info").textContent = Player.helmet ?
      `${DEF(Player.helmet.defId).name.slice(0, 2)} ${Math.ceil(Player.helmet.dur)}` : "无头盔";
  },

  updateWeaponHud() {
    const w = Player.curWeapon();
    const d = Player.curDef();
    this.el("weapon-name").textContent = d ? d.name : "徒手";
    this.el("ammo-mag").textContent = w ? w.mag : 0;
    this.el("ammo-mag").classList.toggle("empty", !w || w.mag === 0);
    this.el("ammo-reserve").textContent = d ? (Player.reserve[d.ammo] || 0) : 0;
    this.el("fire-mode").textContent = d ? (d.pellets ? "泵动" : d.auto ? "全自动" : "半自动") : "";
  },

  updateAbilityHud() {
    const slot = this.el("ability-slot");
    const cdEl = this.el("ability-cd");
    const cd = Player.abilityCd, max = Player.operator.ability.cd;
    cdEl.style.width = (cd / max * 100) + "%";
    slot.classList.toggle("ready", cd <= 0);
  },

  updateTimerHud(remain) {
    const m = Math.floor(remain / 60), s = Math.floor(remain % 60);
    const el = this.el("raid-timer");
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    el.style.color = remain < 120 ? "#ff5340" : "#ffd44d";
  },

  crosshairPulse() {
    this._chSpread = 16;
  },

  updateCrosshair(dt) {
    const base = 6 + Player.currentSpread() * 5;
    this._chSpread = Math.max(base, (this._chSpread || base) - dt * 60);
    const s = this._chSpread;
    const ch = this.el("crosshair");
    ch.style.opacity = Player.adsTarget > 0.5 ? 0.25 : 1;
    ch.querySelector(".ch-t").style.top = (-s - 8) + "px";
    ch.querySelector(".ch-b").style.top = s + "px";
    ch.querySelector(".ch-l").style.left = (-s - 8) + "px";
    ch.querySelector(".ch-r").style.left = s + "px";
  },

  showHitmarker(kill) {
    const hm = this.el("hitmarker");
    hm.classList.toggle("kill", !!kill);
    hm.classList.add("show");
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => hm.classList.remove("show"), 90);
  },

  damageFlash() {
    const v = this.el("damage-vignette");
    v.style.opacity = 1;
    clearTimeout(this._dvT);
    this._dvT = setTimeout(() => v.style.opacity = 0, 160);
  },

  addKillfeed(name) {
    const kf = this.el("killfeed");
    const row = document.createElement("div");
    row.className = "kf";
    row.innerHTML = `<b>${Player.operator.name}</b> 击倒 ${name}`;
    kf.prepend(row);
    setTimeout(() => row.remove(), 5000);
  },

  spawnDamageNumber(worldPos, dmg, isHead) {
    if (!this._dmgNums) this._dmgNums = [];
    const el = document.createElement("div");
    el.className = "dmg-num" + (isHead ? " head" : "");
    el.textContent = dmg;
    this.el("dmg-numbers").appendChild(el);
    this._dmgNums.push({ el, pos: worldPos.clone(), t: 0.7, rise: 0 });
  },

  updateDamageNumbers(dt) {
    if (!this._dmgNums) return;
    const half = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    for (let i = this._dmgNums.length - 1; i >= 0; i--) {
      const d = this._dmgNums[i];
      d.t -= dt; d.rise += dt * 40;
      if (d.t <= 0) { d.el.remove(); this._dmgNums.splice(i, 1); continue; }
      const p = d.pos.clone().project(World.camera);
      if (p.z > 1) { d.el.style.display = "none"; continue; }
      d.el.style.display = "";
      d.el.style.left = (p.x * half.x + half.x) + "px";
      d.el.style.top = (-p.y * half.y + half.y - d.rise) + "px";
      d.el.style.opacity = Math.min(1, d.t * 2);
    }
  },

  showInteract(text) {
    const el = this.el("interact-tip");
    if (!text) { el.classList.add("hidden"); return; }
    el.innerHTML = text;
    el.classList.remove("hidden");
  },

  showProgress(label, pct) {
    const w = this.el("progress-wrap");
    w.classList.remove("hidden");
    this.el("progress-label").textContent = label;
    this.el("progress-fill").style.width = Math.min(100, pct * 100) + "%";
  },
  hideProgress() { this.el("progress-wrap").classList.add("hidden"); },

  showExtractBanner(text) {
    const el = this.el("extract-banner");
    if (!text) { el.classList.add("hidden"); return; }
    el.textContent = text;
    el.classList.remove("hidden");
  },

  showRevealTip(dur) {
    const el = this.el("reveal-tip");
    el.classList.remove("hidden");
    clearTimeout(this._revT);
    this._revT = setTimeout(() => el.classList.add("hidden"), dur * 1000);
  },

  /* 罗盘 */
  drawCompass() {
    const cv = this.el("compass-canvas");
    const ctx = cv.getContext("2d");
    ctx.clearRect(0, 0, cv.width, cv.height);
    const yawDeg = ((-Player.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const pxPerDeg = 3.4;
    const cx = cv.width / 2;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    const marks = [[0, "北"], [45, "东北"], [90, "东"], [135, "东南"], [180, "南"], [225, "西南"], [270, "西"], [315, "西北"]];
    for (let d = -90; d <= 90; d += 5) {
      let deg = ((yawDeg + d) % 360 + 360) % 360;
      const x = cx + d * pxPerDeg;
      const major = deg % 45 === 0;
      ctx.fillStyle = "rgba(255,255,255,.5)";
      ctx.fillRect(x, major ? 20 : 25, 1, major ? 10 : 5);
      if (major) {
        const label = marks.find(m => m[0] === deg);
        ctx.fillStyle = deg === 0 ? "#ff6b5a" : "#dfe6ea";
        ctx.fillText(label ? label[1] : deg + "°", x, 15);
      }
    }
    /* 撤离点方位标记 */
    for (const e of World.extracts) {
      const ang = Math.atan2(e.x - Player.pos.x, -(e.z - Player.pos.z)) * 180 / Math.PI;
      let rel = ((ang - yawDeg) % 360 + 360) % 360;
      if (rel > 180) rel -= 360;
      if (Math.abs(rel) <= 90) {
        ctx.fillStyle = "#39d977";
        ctx.beginPath();
        const x = cx + rel * pxPerDeg;
        ctx.moveTo(x, 30); ctx.lineTo(x - 4, 24); ctx.lineTo(x + 4, 24);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ffd44d";
    ctx.fillRect(cx - 1, 18, 2, 14);
  },

  /* 全屏地图 */
  drawMap() {
    const cv = this.el("map-canvas");
    const ctx = cv.getContext("2d");
    const B = World.mapBounds;
    const scale = cv.width / (B.max - B.min);
    const toPx = (x, z) => [(x - B.min) * scale, (z - B.min) * scale];
    ctx.fillStyle = "#0b1116";
    ctx.fillRect(0, 0, cv.width, cv.height);
    /* 碰撞体块 */
    ctx.fillStyle = "#2a3742";
    for (const c of World.colliders) {
      const [x1, z1] = toPx(c.min.x, c.min.z);
      const w = (c.max.x - c.min.x) * scale, h = (c.max.z - c.min.z) * scale;
      if (w > cv.width * 0.95) continue;
      ctx.fillRect(x1, z1, Math.max(w, 2), Math.max(h, 2));
    }
    /* 撤离点 */
    for (const e of World.extracts) {
      const [x, z] = toPx(e.x, e.z);
      ctx.fillStyle = "rgba(57,217,119,.25)";
      ctx.beginPath(); ctx.arc(x, z, e.r * scale + 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#39d977";
      ctx.beginPath(); ctx.arc(x, z, 4, 0, Math.PI * 2); ctx.fill();
      ctx.font = "12px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(e.name, x, z - 10);
    }
    /* 被标记的敌人 */
    for (const e of AI.enemies) {
      if (e.dead || e.revealed <= 0) continue;
      const [x, z] = toPx(e.pos.x, e.pos.z);
      ctx.fillStyle = "#ff4b3a";
      ctx.beginPath(); ctx.arc(x, z, 3, 0, Math.PI * 2); ctx.fill();
    }
    /* 玩家 */
    const [px, pz] = toPx(Player.pos.x, Player.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-Player.yaw);
    ctx.fillStyle = "#ffd44d";
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(-5, 6); ctx.lineTo(5, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  /*__UI_END__*/
};
