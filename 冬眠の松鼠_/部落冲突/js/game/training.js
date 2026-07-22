/* ============ 训练系统：兵营队列 / 实验室 / 法术 ============ */
COC.Training = (function () {
  'use strict';
  var U = COC.U;

  /* ---------- 队列 ---------- */
  function queuedHousing() {
    var S = COC.State.get(), n = 0;
    for (var i = 0; i < S.queue.length; i++) {
      n += COC.TroopDefs.get(S.queue[i].troop).housing;
    }
    return n;
  }

  function canTrain(troop) {
    var S = COC.State.get();
    var def = COC.TroopDefs.get(troop);
    if (COC.State.maxBarracksLv() < def.barracksLv) {
      return { ok: false, why: '需要 ' + def.barracksLv + ' 级兵营' };
    }
    var used = COC.State.armyHousing() + queuedHousing();
    if (used + def.housing > COC.State.campCap()) {
      return { ok: false, why: '兵营驻地已满' };
    }
    if (S.elixir < def.cost) return { ok: false, why: '圣水不足' };
    return { ok: true };
  }

  function train(troop) {
    var S = COC.State.get();
    var chk = canTrain(troop);
    if (!chk.ok) { COC.UI.toast(chk.why); COC.Audio.play('error'); return false; }
    var def = COC.TroopDefs.get(troop);
    S.elixir -= def.cost;
    S.queue.push({ troop: troop, time: def.trainTime, start: S.queue.length === 0 ? U.now() : 0 });
    COC.Audio.play('train');
    COC.State.markDirty();
    U.emit('hud'); U.emit('army');
    return true;
  }

  function cancelQueued(idx) {
    var S = COC.State.get();
    var item = S.queue[idx];
    if (!item) return;
    var def = COC.TroopDefs.get(item.troop);
    S.elixir = Math.min(COC.State.storageCap('elixir'), S.elixir + def.cost);
    S.queue.splice(idx, 1);
    if (idx === 0 && S.queue.length) S.queue[0].start = U.now();
    COC.Audio.play('close');
    U.emit('hud'); U.emit('army');
  }

  /* 推进训练队列（每帧/离线调用） */
  function advanceQueue(offline) {
    var S = COC.State.get();
    if (!S) return;
    var changed = false;
    var guard = 200;
    while (S.queue.length > 0 && guard-- > 0) {
      var head = S.queue[0];
      if (!head.start) head.start = U.now();
      var doneAt = head.start + head.time * 1000;
      if (U.now() >= doneAt) {
        /* 完成一个 */
        var def = COC.TroopDefs.get(head.troop);
        if (COC.State.armyHousing() + def.housing <= COC.State.campCap()) {
          S.army[head.troop] = (S.army[head.troop] || 0) + 1;
          S.queue.shift();
          if (S.queue.length) S.queue[0].start = doneAt; // 无缝衔接
          changed = true;
          if (!offline) COC.Audio.play('bell', 0.5);
        } else {
          /* 驻地满，暂停队列 */
          head.start = U.now();
          break;
        }
      } else break;
    }
    if (changed) { U.emit('army'); U.emit('hud'); COC.State.markDirty(); }
  }

  function queueProgress() {
    var S = COC.State.get();
    if (!S.queue.length) return null;
    var head = S.queue[0];
    if (!head.start) return { pct: 0, remain: head.time };
    var elapsed = (U.now() - head.start) / 1000;
    return {
      pct: U.clamp(elapsed / head.time, 0, 1),
      remain: Math.max(0, head.time - elapsed),
      troop: head.troop
    };
  }

  /* ---------- 实验室 ---------- */
  function labInfo(troop) {
    var S = COC.State.get();
    var def = COC.TroopDefs.get(troop);
    var lv = S.troopLv[troop] || 1;
    var maxLv = (def.upCost ? def.upCost.length : 0) + 1;
    var labLv = COC.State.labLevel();
    return {
      lv: lv, maxLv: maxLv,
      canResearch: lv < maxLv && labLv >= lv && !S.labBusy,
      needLabLv: lv,
      cost: lv < maxLv ? def.upCost[lv - 1] : 0,
      time: lv < maxLv ? def.upTime[lv - 1] : 0
    };
  }

  function research(troop) {
    var S = COC.State.get();
    var info = labInfo(troop);
    if (S.labBusy) { COC.UI.toast('实验室正在研究中'); COC.Audio.play('error'); return false; }
    if (info.lv >= info.maxLv) { COC.UI.toast('已达最高等级'); return false; }
    if (COC.State.labLevel() < info.needLabLv) { COC.UI.toast('需要 ' + info.needLabLv + ' 级实验室'); COC.Audio.play('error'); return false; }
    if (S.elixir < info.cost) { COC.UI.toast('圣水不足'); COC.Audio.play('error'); return false; }
    S.elixir -= info.cost;
    S.labBusy = { troop: troop, start: U.now(), time: info.time };
    COC.Audio.play('magic');
    COC.UI.toast('开始研究 ' + COC.TroopDefs.get(troop).name + ' Lv.' + (info.lv + 1));
    COC.State.markDirty();
    U.emit('hud'); U.emit('army');
    return true;
  }

  /* ---------- 法术 ---------- */
  function brewSpell(id) {
    var S = COC.State.get();
    var def = COC.TroopDefs.spell(id);
    if (COC.State.spellCap() <= 0) { COC.UI.toast('需要先建造法术工厂'); COC.Audio.play('error'); return false; }
    if (S.brewing) { COC.UI.toast('法术正在酿造中'); COC.Audio.play('error'); return false; }
    if (COC.State.spellCount() >= COC.State.spellCap()) { COC.UI.toast('法术库已满'); COC.Audio.play('error'); return false; }
    if (S.elixir < def.cost) { COC.UI.toast('圣水不足'); COC.Audio.play('error'); return false; }
    S.elixir -= def.cost;
    S.brewing = { spell: id, start: U.now(), time: def.brewTime };
    COC.Audio.play('magic');
    COC.State.markDirty();
    U.emit('hud'); U.emit('army');
    return true;
  }

  function tick() {
    var S = COC.State.get();
    if (!S) return;
    advanceQueue(false);
    if (S.brewing && U.now() >= S.brewing.start + S.brewing.time * 1000) {
      S.spells[S.brewing.spell] = (S.spells[S.brewing.spell] || 0) + 1;
      S.brewing = null;
      COC.UI.toast('⚡ 法术酿造完成！');
      COC.Audio.play('magic');
      U.emit('army'); U.emit('hud');
    }
    if (S.labBusy && U.now() >= S.labBusy.start + S.labBusy.time * 1000) {
      var t = S.labBusy.troop;
      S.troopLv[t] = (S.troopLv[t] || 1) + 1;
      S.labBusy = null;
      COC.UI.toast('🧪 研究完成：' + COC.TroopDefs.get(t).name + ' Lv.' + S.troopLv[t] + '！');
      COC.Audio.play('levelup');
      U.emit('army'); U.emit('hud');
    }
  }

  return {
    canTrain: canTrain, train: train, cancelQueued: cancelQueued,
    advanceQueue: advanceQueue, queueProgress: queueProgress, queuedHousing: queuedHousing,
    labInfo: labInfo, research: research, brewSpell: brewSpell,
    tick: tick
  };
})();
