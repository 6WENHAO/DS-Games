// ============ 事件导演系统 ============
const Events = (() => {
  let stage = 0;
  // 阶段: 0 苏醒探索 → 1 拿到手电 → 2 找到铜铃 → 3 灯灭/纸符门开启
  //      → 4 隐藏回廊 → 5 放铃后追逐 → 6 结局
  let flags = {};
  let subQueue = [];
  let subTimer = 0;
  let ambientTimer = 18;

  // ---------- 纸条内容 ----------
  const NOTES = [
    '管理组合 通知\n\n近期 201 号住户反映\n深夜走廊有脚步声徘徊。\n经查，本栋除 201 外\n早已无人居住。\n\n请各位住户安心。\n—— 管理人',
    '（潦草的字迹）\n\n铃声能让"它"停下来。\n佛坛的铃，不要摇。\n带到里面的祭坛去。\n\n只有把铃还回去，\n走廊才会有尽头。',
    '（日记的残页）\n\n又是同一个梦。\n走廊越走越长，\n门后还是走廊。\n电视里的雪花声\n和那个站在尽头的人影。\n\n他不动。\n只是看着。\n\n明天就搬走。\n明天，一定。',
  ];
  const notesRead = [false, false, false];

  // ---------- 字幕 ----------
  function sub(text, dur = 3.2) {
    subQueue.push({ text, dur });
  }
  function updateSubtitles(dt) {
    const el = document.getElementById('subtitle');
    if (subTimer > 0) {
      subTimer -= dt;
      if (subTimer <= 0) el.classList.remove('show');
      return;
    }
    if (subQueue.length) {
      const s = subQueue.shift();
      el.textContent = s.text;
      el.classList.add('show');
      subTimer = s.dur;
    }
  }

  function objective(text) {
    document.getElementById('objective-text').textContent = text;
  }

  // ---------- 开场 ----------
  function start() {
    stage = 0;
    flags = {};
    objective('调查这栋公寓');
    setTimeout(() => {
      sub('……又是这里。', 3);
      sub('这栋楼，我明明搬走很多年了。', 3.5);
      sub('（找找有没有开着的门）', 3);
    }, 2200);
  }

  // ---------- 交互回调 ----------
  function onSealedDoor() {
    Sfx.doorLocked();
    if (stage >= 5) {
      sub('钉死了！从里面根本打不开！', 3);
    } else {
      sub('大门被木板钉死了。是谁钉的……从外面？还是里面？', 4);
    }
  }

  function onElevator() {
    Sfx.uiSelect();
    if (!flags.elevatorTried) {
      flags.elevatorTried = true;
      sub('按钮没有反应。楼层显示停在「4」。', 4);
      sub('……这栋楼只有两层。', 3.5);
      setTimeout(() => Sfx.distantThud(0.1), 4500);
    } else {
      sub('依旧没有反应。', 2.5);
    }
  }

  function onRoomOpened(id) {
    if (id === '201' && !flags.room201) {
      flags.room201 = true;
      sub('榻榻米的味道……混着霉味。', 3);
    }
    if (id === '204' && !flags.room204) {
      flags.room204 = true;
      sub('儿童房……积木还散落着。', 3);
      setTimeout(() => Sfx.woodCreak(0.05), 2000);
    }
    if (id === '205' && !flags.room205) {
      flags.room205 = true;
      sub('佛坛的蜡烛……还是温的。', 3.5);
      if (World.candleLight) World.candleLight.intensity = 0.5;
      Sfx.stinger(0.4);
    }
  }

  function onLockedDoor(door) {
    if (door.plateText === '203' && !flags.knock203) {
      flags.knock203 = true;
      sub('锁住了。', 2);
      setTimeout(() => {
        Sfx.pipeKnock();
        sub('……里面有敲击声。', 3);
      }, 1600);
    } else if (door.plateText === '202') {
      sub(door.lockedMsg, 3);
      if (stage >= 1 && !flags.tvUnlocked) {
        flags.tvUnlocked = true;
        setTimeout(() => {
          door.locked = false;
          Sfx.doorCreak(true);
          door.open = true; door.targetAngle = -1.9;
          sub('门……自己开了。', 3);
          Sfx.stinger(0.7);
          Player.fear = Math.min(1, Player.fear + 0.25);
        }, 2400);
      }
    } else if (door.plateText === '???') {
      sub(door.lockedMsg, 3.5);
      if (stage === 2 && flags.hasBell) {
        // 铃在手, 纸符门可开
        setTimeout(() => openFudaDoor(), 1500);
      }
    } else {
      sub(door.lockedMsg, 2.5);
    }
  }

  // ---------- 手电筒 (201 衣柜边) ----------
  function placeTorchPickup() {
    // 在入口厅鞋柜上
    const it = { pos: new THREE.Vector3(3.4, 0.9, -3), radius: 1.6, label: '手电筒', enabled: true };
    it.onUse = () => {
      it.enabled = false;
      if (it.mesh) it.mesh.visible = false;
      Player.giveTorch();
      Sfx.itemGet();
      stage = Math.max(stage, 1);
      objective('探索每一个房间');
      sub('还能亮。电池不多了。', 3);
      // 拿手电后: 全楼荧光灯闪烁一轮
      setTimeout(() => {
        World.flickerLights.forEach((f, i) => {
          setTimeout(() => {
            f.light.intensity = 0.04;
            setTimeout(() => { if (!f.broken) f.light.intensity = f.base; }, 300 + Math.random() * 500);
          }, i * 120);
        });
        Sfx.buzzFlicker();
      }, 3000);
    };
    World.interactables.push(it);
  }

  function readNote(i) {
    Sfx.paperRustle();
    notesRead[i] = true;
    Game.showNote(NOTES[i]);
    if (i === 1 && !flags.bellHint) {
      flags.bellHint = true;
      setTimeout(() => sub('祭坛……在哪？', 2.5), 800);
    }
  }

  // ---------- 玩偶 ----------
  function onDoll() {
    Sfx.uiSelect();
    if (!flags.dollTouched) {
      flags.dollTouched = true;
      sub('这个玩偶……眼睛是画上去的。', 3);
      // 转头事件: 玩家离开后玩偶朝向门口
      flags.dollWatch = true;
    } else {
      sub('它的头……刚才是朝这边的吗？', 3);
      Player.fear = Math.min(1, Player.fear + 0.1);
    }
  }

  // ---------- 电视 ----------
  function onTV() {
    if (!flags.tvOff) {
      flags.tvOff = true;
      World.tvOn = false;
      World.tvScreen.material = new THREE.MeshBasicMaterial({ color: 0x0a0c0b });
      Sfx.staticBurst(0.3, 0.15);
      sub('……关掉了。', 2);
      setTimeout(() => {
        // 身后走廊传来铃声
        Sfx.bellToll();
        sub('铃声？从走廊尽头……', 3.5);
        objective('查看走廊尽头 (205 与拐角)');
      }, 2600);
    } else {
      sub('屏幕是黑的。映着我身后的……', 3);
      Player.fear = Math.min(1, Player.fear + 0.15);
      Sfx.whisper();
    }
  }

  // ---------- 铜铃 ----------
  function onBell() {
    if (flags.hasBell) return;
    flags.hasBell = true;
    if (World.bellMesh) World.bellMesh.visible = false;
    Sfx.itemGet();
    Sfx.bellToll();
    stage = Math.max(stage, 2);
    sub('铜铃到手了。冰凉得不像金属。', 3.5);
    objective('把铜铃带到「祭坛」— 纸符门在走廊尽头拐角');
    // 拿铃瞬间: 首次目击 — 怪物在走廊尽头站立
    setTimeout(() => {
      Sfx.droneRise(2.5);
      Monster.appearAt(0, -38.5, 0);
      Player.fear = Math.min(1, Player.fear + 0.4);
      flags.firstSight = true;
    }, 2000);
  }

  // ---------- 纸符门 ----------
  function openFudaDoor() {
    const door = World.fudaDoor;
    if (!door || !door.locked) return;
    door.locked = false;
    // 纸符飘落
    if (World.fudaPapers) World.fudaPapers.forEach((p, i) => {
      setTimeout(() => { p.visible = false; Sfx.paperRustle(); }, i * 300);
    });
    Sfx.whisper();
    sub('纸符……一张张剥落了。', 3.5);
    stage = 3;
  }

  function onFudaDoorOpen() {
    if (flags.enteredHidden) return;
    flags.enteredHidden = true;
    stage = 4;
    Sfx.droneRise(3);
    Sfx.setAmbLevel(1.4, 3);
    sub('这条走廊……不该存在的。', 3.5);
    objective('把铜铃放上祭坛');
    // 隐藏回廊中: 怪物开始缓慢追踪
    setTimeout(() => {
      Monster.appearAt(12.5, -46, 0);
      Monster.startStalk();
      sub('（不要回头，一直走）', 3);
    }, 5000);
  }

  // ---------- 祭坛 ----------
  function onAltar() {
    if (!flags.hasBell) {
      sub('祭坛上空空如也。似乎缺了什么。', 3);
      return;
    }
    if (flags.bellPlaced) return;
    flags.bellPlaced = true;
    stage = 5;
    Sfx.bellToll();
    Monster.vanish();
    if (World.altarLight) World.altarLight.intensity = 0.9;
    sub('铃，归位了。', 3);
    setTimeout(() => {
      Sfx.stinger(1);
      Sfx.heartbeatLoop(1.8);
      sub('——快跑！！', 2.5);
      objective('逃出去！！大门开了！！');
      // 追逐战: 怪物从祭坛后出现
      if (World.altarCollider) {
        World.altarCollider.minX = 9999; World.altarCollider.maxX = 9999;
        World.altarCollider.minZ = 9999; World.altarCollider.maxZ = 9999;
      }
      Monster.appearAt(12.5, -86.5, 0);
      Monster.startChase(() => Game.onCaught());
      // 入口大门此刻"打开"了 — 出口
      if (World.sealedDoorInteract) World.sealedDoorInteract.enabled = false;
      const exitIt = { pos: new THREE.Vector3(0, 1.2, 2.3), radius: 2.2, label: '冲出大门！', enabled: true };
      exitIt.onUse = () => { if (stage === 5) Game.onEscape(); };
      World.interactables.push(exitIt);
      flags.exitOpen = true;
    }, 3200);
  }

  // ---------- 随机环境事件 ----------
  function randomAmbient(dt, playerPos) {
    ambientTimer -= dt;
    if (ambientTimer > 0) return;
    ambientTimer = 16 + Math.random() * 22;
    if (stage >= 5) return; // 追逐时不打扰
    const r = Math.random();
    if (r < 0.3) {
      Sfx.buzzFlicker();
      Player.torchFlicker(0.8);
    } else if (r < 0.5) {
      Sfx.distantThud(0.07);
    } else if (r < 0.68 && stage >= 1) {
      Sfx.whisper();
      Player.fear = Math.min(1, Player.fear + 0.08);
    } else if (r < 0.8 && stage >= 2) {
      // 身后关门声
      Sfx.doorCreak(false);
      sub('……刚才有门关上了。', 2.5);
    } else if (stage >= 1) {
      Sfx.woodCreak(0.06);
    }
  }

  // ---------- 每帧检查 ----------
  const _v = new THREE.Vector3();
  function update(dt, playerPos, camera) {
    updateSubtitles(dt);
    randomAmbient(dt, playerPos);

    // 首次目击的怪物: 玩家看到过它之后, 移开视线才会消失
    if (flags.firstSight && Monster.state === 'standing') {
      const d = playerPos.distanceTo(Monster.position);
      if (d < 26) {
        Player.fear = Math.min(1, Player.fear + dt * 0.15);
        Sfx.heartbeatLoop(1.1);
      }
      if (!flags.monsterSeen) {
        if (d < 30 && Monster.isInView(camera)) {
          flags.monsterSeen = true;
          Sfx.stinger(0.8);
        }
      } else if (d < 6 || Monster.vanishIfUnseen(camera)) {
        if (d < 6) Monster.vanish();
        if (Monster.state === 'hidden') {
          flags.firstSight = false;
          Sfx.stopHeartbeat();
          Sfx.stinger(0.5);
          sub('……消失了。', 2.5);
        }
      }
    }

    // 玩偶转头 (离开儿童房后触发)
    if (flags.dollWatch && World.doll && playerPos.z > -24) {
      flags.dollWatch = false;
      World.doll.rotation.y = Math.atan2(
        playerPos.x - World.doll.position.x,
        playerPos.z - World.doll.position.z
      );
    }

    // 恐惧自然衰减
    Player.fear = Math.max(0, Player.fear - dt * 0.02);

    // 隐藏回廊内的心跳与压迫
    if (stage === 4 && Monster.state === 'stalking') {
      const d = playerPos.distanceTo(Monster.position);
      Player.fear = Math.max(Player.fear, Math.min(1, 1.6 - d / 12));
    }
    if (stage === 5 && Monster.state === 'chasing') {
      const d = playerPos.distanceTo(Monster.position);
      Player.fear = Math.max(Player.fear, Math.min(1, 1.8 - d / 10));
    }
  }

  return {
    start, update, readNote, placeTorchPickup,
    onSealedDoor, onElevator, onRoomOpened, onLockedDoor,
    onDoll, onTV, onBell, onAltar, onFudaDoorOpen,
    get stage() { return stage; },
    get flags() { return flags; },
    NOTES,
  };
})();
