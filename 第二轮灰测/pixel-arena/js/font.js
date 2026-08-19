// ============================================================
// font.js — 像素字体加载（CDN + 本地回退）
// CJK：Fusion Pixel 12px（TakWolf 开源，OFL-1.1，经 @fontpkg 镜像）
// 标题：Press Start 2P（CodeMan38，OFL-1.1）
// 字体加载失败时回退系统等宽字体，游戏仍可运行。
// ============================================================
'use strict';

const Fonts = {
  cjk: { name: '"Fusion Pixel"', loaded: false, size: 12 },
  title: { name: '"Press Start 2P"', loaded: false, size: 16 },
  started: false,
};

Fonts.cjkStack = function (px) {
  return (px || Fonts.cjk.size) + 'px "Fusion Pixel", "Zfull-GB", "Microsoft YaHei", monospace';
};
Fonts.titleStack = function (px) {
  return (px || Fonts.title.size) + 'px "Press Start 2P", monospace';
};

Fonts.load = function (done) {
  if (Fonts.started) return;
  Fonts.started = true;
  if (!document.fonts || !document.fonts.load) {
    if (done) done();
    return;
  }
  let pending = 2;
  const finish = function () {
    pending--;
    if (pending <= 0 && done) done();
  };
  // 各 3.5s 超时保护
  const cjkTimer = setTimeout(function () { Fonts.cjk.loaded = false; finish(); }, 3500);
  document.fonts.load(Fonts.cjkStack(), '像素竞技场精灵对战天气').then(function (fs) {
    clearTimeout(cjkTimer);
    Fonts.cjk.loaded = fs.length > 0 && fs.some(function (f) { return f.family.indexOf('Fusion Pixel') >= 0; });
    finish();
  }).catch(function () {
    clearTimeout(cjkTimer);
    Fonts.cjk.loaded = false;
    finish();
  });
  const tTimer = setTimeout(function () { Fonts.title.loaded = false; finish(); }, 3500);
  document.fonts.load(Fonts.titleStack(), 'POCKET ARENA').then(function (fs) {
    clearTimeout(tTimer);
    Fonts.title.loaded = fs.length > 0 && fs.some(function (f) { return f.family.indexOf('Press Start') >= 0; });
    finish();
  }).catch(function () {
    clearTimeout(tTimer);
    Fonts.title.loaded = false;
    finish();
  });
};

Fonts.draw = function (ctx, text, x, y, colorIdx, pxSize, opts) {
  opts = opts || {};
  ctx.save();
  ctx.font = opts.title ? Fonts.titleStack(pxSize) : Fonts.cjkStack(pxSize);
  ctx.textBaseline = 'top';
  ctx.textAlign = opts.align || 'left';
  ctx.fillStyle = PAL[colorIdx === undefined ? 1 : colorIdx];
  const sx = Math.round(x), sy = Math.round(y);
  if (opts.shadow) {
    ctx.fillStyle = PAL[opts.shadow];
    ctx.fillText(text, sx + 1, sy + 1);
    ctx.fillText(text, sx - 1, sy + 1);
    ctx.fillText(text, sx + 1, sy - 1);
    ctx.fillText(text, sx - 1, sy - 1);
    ctx.fillStyle = PAL[colorIdx === undefined ? 1 : colorIdx];
  }
  ctx.fillText(text, sx, sy);
  ctx.restore();
};

// 文本换行（按像素宽度）
Fonts.wrap = function (ctx, text, maxW, pxSize) {
  ctx.save();
  ctx.font = Fonts.cjkStack(pxSize);
  const lines = [];
  let cur = '';
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW && cur.length > 0) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  ctx.restore();
  return lines;
};

Fonts.textW = function (ctx, text, pxSize) {
  ctx.save();
  ctx.font = Fonts.cjkStack(pxSize);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
};
