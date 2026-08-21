/**
 * tools/gen-docs.js — 从滤镜注册表生成 docs/filters.md（避免文档和代码不同步）
 * 用法： node tools/gen-docs.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'src/core/ns.js'));
const dir = path.join(ROOT, 'src/gl/filters');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) require(path.join(dir, f));
require(path.join(ROOT, 'src/gl/presets.js'));
const R = require(path.join(ROOT, 'src/gl/resources.js'));
const D = global.DSV4P;

const CAT = {
  pixel: '像素风', print: '印刷', grid: '网格 / 屏幕', ink: '线稿', paint: '绘画',
  display: '光学 / 显示', glitch: '故障', grade: '调色', tone: '影调', custom: '自定义'
};

const lines = [];
lines.push('# 滤镜参考（自动生成）');
lines.push('');
lines.push('> 本文件由 `node tools/gen-docs.js` 从 `src/gl/filters/*.js` 的注册表生成，请勿手改。');
lines.push('');
lines.push(`当前共 **${D.filters.length}** 个滤镜、**${D.presets.length}** 个风格预设、**${R.palettes.length}** 套调色板。`);
lines.push('');
lines.push('滤镜链自上而下执行，上一个的输出就是下一个的输入。`混合(mix)` 参数为 0 时该滤镜等于不生效，');
lines.push('因此任何滤镜都可以无损地淡入淡出。带「跟随网格」的参数会自动沿用上游 `像素化` 的格子尺寸。');
lines.push('');

const byCat = new Map();
for (const f of D.filters) {
  if (!byCat.has(f.category)) byCat.set(f.category, []);
  byCat.get(f.category).push(f);
}

lines.push('## 目录');
lines.push('');
for (const [cat, list] of byCat) {
  lines.push(`- **${CAT[cat] || cat}**：` + list.map((f) => `[${f.label}](#${f.id})`).join('、'));
}
lines.push('');

for (const [cat, list] of byCat) {
  lines.push(`## ${CAT[cat] || cat}`);
  lines.push('');
  for (const f of list) {
    lines.push(`### <a id="${f.id}"></a>${f.label}  \`${f.id}\``);
    lines.push('');
    if (f.doc) lines.push(f.doc);
    lines.push('');
    const extra = [];
    if (f.passes.length > 1) extra.push(`${f.passes.length} 个 pass`);
    if (f.gridParam) extra.push(`会把「${f.gridParam}」作为像素网格传给下游`);
    if (f.usesPalette) extra.push('使用当前调色板');
    if (f.usesGlyph) extra.push('使用当前字符集');
    if (f.dynamic) extra.push('源码可在界面里实时编辑');
    if (f.passes.some((p) => p.scale)) extra.push('含降采样 pass');
    if (extra.length) {
      lines.push('特性：' + extra.join('；'));
      lines.push('');
    }
    lines.push('| 参数 | 类型 | 范围 / 选项 | 默认 |');
    lines.push('| --- | --- | --- | --- |');
    for (const p of f.params) {
      let range = '';
      if (p.type === 'float') range = `${p.min} ~ ${p.max}（步进 ${p.step}${p.unit ? '，' + p.unit : ''}）`;
      else if (p.type === 'enum') range = p.options.map((o) => `${o.v}=${o.label}`).join(' / ');
      else if (p.type === 'bool') range = '开 / 关';
      else range = '#rrggbb';
      lines.push(`| \`${p.key}\` ${p.label} | ${p.type} | ${range} | ${p.def} |`);
    }
    lines.push('');
  }
}

lines.push('## 风格预设');
lines.push('');
lines.push('| 预设 | 说明 | 滤镜链 | 调色板 / 字符集 |');
lines.push('| --- | --- | --- | --- |');
for (const p of D.presets) {
  const chain = p.chain.map((c) => (D.getFilter(c.id) || { label: c.id }).label.split(' ')[0]).join(' → ');
  const res = [p.palette ? '调色板:' + p.palette : '', p.glyph ? '字符集:' + p.glyph : ''].filter(Boolean).join('，') || '—';
  lines.push(`| ${p.name} | ${p.desc} | ${chain} | ${res} |`);
}
lines.push('');

lines.push('## 调色板');
lines.push('');
lines.push('| id | 名称 | 色数 |');
lines.push('| --- | --- | --- |');
for (const p of R.palettes) {
  lines.push(`| \`${p.id}\` | ${p.name} | ${p.colors ? p.colors.length : '—'} |`);
}
lines.push('');

lines.push('## 自定义滤镜可用的 GLSL 接口');
lines.push('');
lines.push('写自定义着色器（或新增滤镜文件）时，引擎会自动注入下列内容，**不要重复声明**：');
lines.push('');
lines.push('```glsl');
lines.push(D.ShaderLib ? '' : '');
lines.push(require(path.join(ROOT, 'src/gl/shaderlib.js')).HEADER);
lines.push('```');
lines.push('');
lines.push('可直接调用的公共函数：');
lines.push('');
lines.push('```glsl');
lines.push(require(path.join(ROOT, 'src/gl/shaderlib.js')).HELPERS.split('\n').filter((l) => /^\w.*\{|^\w.*;/.test(l) && l.indexOf('{') > 0)
  .map((l) => l.replace(/\{.*$/, '{ … }')).join('\n'));
lines.push('```');
lines.push('');
lines.push('限制（GLSL ES 1.00 / WebGL1 兼容）：不能用位运算与 `%`，`for` 循环上界必须是常量，');
lines.push('uniform 数组只能用循环变量索引，浮点字面量必须带小数点。写完用 `node tools/lint-shaders.js` 自查。');
lines.push('');

const out = path.join(ROOT, 'docs/filters.md');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('已生成 docs/filters.md：' + D.filters.length + ' 个滤镜，' + D.presets.length + ' 个预设，' + R.palettes.length + ' 套调色板');
