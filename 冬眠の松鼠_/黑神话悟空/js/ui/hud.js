import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp } from '../core/utils.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(combat) {
    this.combat = combat;
    this.hpGhost = 1;
    this.bossGhost = 1;
    this.el = {
      hud: $('hud'),
      hpFill: $('hp-fill'),
      hpGhost: $('hp-ghost'),
      staminaFill: $('stamina-fill'),
      pips: [...document.querySelectorAll('.focus-pip')],
      gourdCount: $('gourd-count'),
      gourdSlot: $('skill-gourd'),
      stunCd: $('stun-cd'),
      stunSlot: $('skill-stun'),
      cloneCd: $('clone-cd'),
      cloneSlot: $('skill-clone'),
      guardCd: $('guard-cd'),
      guardSlot: $('skill-guard'),
      ultCd: $('ult-cd'),
      ultSlot: $('skill-ult'),
      quakeCd: $('quake-cd'),
      quakeSlot: $('skill-quake'),
      holeCd: $('hole-cd'),
      holeSlot: $('skill-hole'),
      soulNum: $('soul-num'),
      bossWrap: $('boss-bar-wrap'),
      bossFill: $('boss-fill'),
      bossGhost: $('boss-ghost'),
      bossName: $('boss-name'),
      lockon: $('lockon-marker'),
      floatLayer: $('float-layer'),
      interactTip: $('interact-tip'),
    };
    combat.on('damageNumber', (pos, num, crit) => this.damageNumber(pos, num, crit));
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  showBossBar(name) {
    this.el.bossName.textContent = name;
    this.el.bossWrap.classList.remove('hidden');
  }
  hideBossBar() { this.el.bossWrap.classList.add('hidden'); }

  damageNumber(worldPos, num, crit) {
    if (!this.camera) return;
    const sp = this.project(worldPos);
    if (!sp) return;
    const div = document.createElement('div');
    div.className = 'dmg-num' + (crit ? ' crit' : '');
    div.style.left = `${sp.x + (Math.random() - 0.5) * 40}px`;
    div.style.top = `${sp.y + (Math.random() - 0.5) * 16}px`;
    div.textContent = num;
    this.el.floatLayer.appendChild(div);
    setTimeout(() => div.remove(), 950);
  }

  playerDamageNumber(num) {
    const div = document.createElement('div');
    div.className = 'dmg-num player';
    div.style.left = `${window.innerWidth * 0.5 + (Math.random() - 0.5) * 90}px`;
    div.style.top = `${window.innerHeight * 0.62}px`;
    div.textContent = `-${num}`;
    this.el.floatLayer.appendChild(div);
    setTimeout(() => div.remove(), 950);
  }

  project(worldPos) {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return null;
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  update(dt, player, boss, camera) {
    this.camera = camera;
    const P = CONFIG.player;

    const hpK = clamp(player.hp / player.maxHp, 0, 1);
    this.el.hpFill.style.transform = `scaleX(${hpK})`;
    this.hpGhost = damp(this.hpGhost, hpK, 3.2, dt);
    if (this.hpGhost < hpK) this.hpGhost = hpK;
    this.el.hpGhost.style.transform = `scaleX(${this.hpGhost})`;

    this.el.staminaFill.style.transform = `scaleX(${clamp(player.stamina / P.stamina, 0, 1)})`;

    const focusFloor = Math.floor(player.focus + 1e-6);
    this.el.pips.forEach((pip, i) => pip.classList.toggle('full', i < focusFloor));

    this.el.gourdCount.textContent = player.gourds;
    this.el.gourdSlot.classList.toggle('disabled', player.gourds <= 0);

    const stunK = clamp(player.stunCd / P.stun.cooldown, 0, 1);
    this.el.stunCd.style.setProperty('--cd', `${stunK * 100}%`);
    this.el.stunSlot.classList.toggle('disabled', stunK > 0.001);

    const cloneK = clamp(player.cloneCd / P.clone.cooldown, 0, 1);
    this.el.cloneCd.style.setProperty('--cd', `${cloneK * 100}%`);
    this.el.cloneSlot.classList.toggle('disabled', cloneK > 0.001);

    const guardK = clamp(player.guardCd / P.guard.cooldown, 0, 1);
    this.el.guardCd.style.setProperty('--cd', `${guardK * 100}%`);
    this.el.guardSlot.classList.toggle('disabled', guardK > 0.001);
    this.el.guardSlot.classList.toggle('active', player.guardTime > 0);

    const ultK = clamp(player.ultCd / P.ult.cooldown, 0, 1);
    this.el.ultCd.style.setProperty('--cd', `${ultK * 100}%`);
    this.el.ultSlot.classList.toggle('disabled', ultK > 0.001);
    this.el.ultSlot.classList.toggle('ready', ultK <= 0.001);

    const quakeK = clamp(player.quakeCd / P.quake.cooldown, 0, 1);
    this.el.quakeCd.style.setProperty('--cd', `${quakeK * 100}%`);
    this.el.quakeSlot.classList.toggle('disabled', quakeK > 0.001);

    const holeK = clamp(player.holeCd / P.hole.cooldown, 0, 1);
    this.el.holeCd.style.setProperty('--cd', `${holeK * 100}%`);
    this.el.holeSlot.classList.toggle('disabled', holeK > 0.001);

    this.el.soulNum.textContent = player.souls;

    // boss bar
    if (boss && this.el.bossWrap && !this.el.bossWrap.classList.contains('hidden')) {
      const bK = clamp(boss.hp / boss.maxHp, 0, 1);
      this.el.bossFill.style.transform = `scaleX(${bK})`;
      this.bossGhost = damp(this.bossGhost, bK, 2.4, dt);
      if (this.bossGhost < bK) this.bossGhost = bK;
      this.el.bossGhost.style.transform = `scaleX(${this.bossGhost})`;
    }

    // lock-on marker
    const target = this.combat.lockTarget;
    if (target && target.alive) {
      const pos = target.position.clone().add(new THREE.Vector3(0, 1.9 * (target.cfg?.scale || CONFIG.boss.scale * 0.9), 0));
      const sp = this.project(pos);
      if (sp) {
        this.el.lockon.classList.remove('hidden');
        this.el.lockon.style.left = `${sp.x}px`;
        this.el.lockon.style.top = `${sp.y}px`;
      } else {
        this.el.lockon.classList.add('hidden');
      }
    } else {
      this.el.lockon.classList.add('hidden');
    }
  }

  tip(text) {
    if (!text) { this.el.interactTip.classList.add('hidden'); return; }
    this.el.interactTip.textContent = text;
    this.el.interactTip.classList.remove('hidden');
  }
}
