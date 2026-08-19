// test/run-tests.js — Node 端引擎逻辑测试运行器
// 用法：node test/run-tests.js
'use strict';
const path = require('path');

// 注入浏览器全局（纯逻辑文件无 DOM 依赖）
global.PAL = require('../js/palette.js').PAL;
Object.assign(global, require('../js/noise.js'));
Object.assign(global, require('../js/data.js'));
Object.assign(global, require('../js/engine.js'));

const { RUN_TESTS } = require('../js/tests.js');

const r = RUN_TESTS();
let failed = 0;
for (const res of r.results) {
  const tag = res.pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${res.name}${res.pass ? '' : '  -> ' + res.err}`);
  if (!res.pass) failed++;
}
console.log(`\n${r.results.length - failed}/${r.results.length} passed`);
process.exit(failed > 0 ? 1 : 0);
