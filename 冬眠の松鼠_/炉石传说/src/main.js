// ==== 入口：装配各模块 ====
// 后续步骤将逐个接入：core / data / ui / ai / audio
import { boot } from './ui/bootstrap.js';

window.addEventListener('DOMContentLoaded', () => {
  boot();
});
