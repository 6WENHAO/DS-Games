/**
 * hud.js —— 页面叠层信息（形态徽标 / 进度条 / 帧率 / 提示气泡）
 */
export function createHUD() {
  const $ = (id) => document.getElementById(id);
  const el = {
    badge: $('badge'), bar: $('bar-fill'), fps: $('s-fps'), tri: $('s-tri'),
    part: $('s-part'), joint: $('s-joint'), spd: $('s-spd'), prog: $('s-prog'),
    keys: $('hud-keys'), toast: $('toast'), boot: $('boot'),
  };
  let toastT = null;
  let acc = 0, frames = 0, fps = 0;

  const MODE_TXT = { robot: '机器人形态', vehicle: '载具形态 · 卡车', morph: '变形中' };

  return {
    el,
    ready() { el.boot?.classList.add('done'); },
    setStatic(parts, joints) {
      el.part.textContent = parts;
      el.joint.textContent = joints;
    },
    frame(dt, info) {
      acc += dt; frames++;
      if (acc >= 0.4) { fps = Math.round(frames / acc); acc = 0; frames = 0; el.fps.textContent = fps; }
      const p = info.progress;
      el.bar.style.width = (p * 100).toFixed(1) + '%';
      el.prog.textContent = Math.round(p * 100) + '%';
      el.spd.textContent = info.kmh.toFixed(1);
      el.tri.textContent = info.tri;
      const cls = info.mode;
      if (el.badge.dataset.mode !== cls) {
        el.badge.dataset.mode = cls;
        el.badge.className = cls;
      }
      el.badge.textContent = cls === 'morph'
        ? `${MODE_TXT.morph} ${Math.round(p * 100)}%`
        : MODE_TXT[cls];
    },
    toast(msg, ms = 1500) {
      el.toast.textContent = msg;
      el.toast.classList.add('show');
      clearTimeout(toastT);
      toastT = setTimeout(() => el.toast.classList.remove('show'), ms);
    },
    toggleKeys() { el.keys.classList.toggle('hidden'); },
    get fps() { return fps; },
  };
}
