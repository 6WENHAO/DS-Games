import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:1360,height:820}, deviceScaleFactor:1});
const msgs=[]; p.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') msgs.push('['+m.type()+'] '+m.text()); });
p.on('pageerror',e=>msgs.push('[pageerror] '+e.message));
await p.goto('file:///home/asus_pyqx/B3/forbidden-city/index.html',{waitUntil:'load',timeout:300000});
await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'),{timeout:240000});
await p.waitForTimeout(3000);
const r = await p.evaluate(()=>{
  const out = {};
  out.built = { voxels: APP.vol.total, quads: APP.quadCount, labels: APP.labels.length };
  out.labelsVisible = document.querySelectorAll('.lab').length;
  showCard(APP.labelById.get(APP.labels.find(l=>l.name==='太和殿').id));
  out.card = { shown: document.getElementById('card').classList.contains('show'), name: document.getElementById('cardName').textContent, descLen: document.getElementById('cardDesc').textContent.length };
  document.getElementById('card').classList.remove('show');
  // 模式切换
  setMode('fps'); out.fpsMode = APP.mode==='fps';
  APP.walker.move(0.05, {fwd:0,back:0,left:0,right:0,run:0,up:0,down:0});
  setMode('god'); out.godMode = APP.mode==='god';
  // 索引
  out.indexItems = document.querySelectorAll('.item').length;
  out.minimap = !!APP.map && APP.map.w + 'x' + APP.map.h;
  // 每个标签都有 el 元素池
  out.labelPool = APP.labels.filter(l=>l.el).length;
  // 小地图点击
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('fps stats:', (await p.textContent('#stats')).replace(/\n/g,' '));
console.log('console issues:', msgs.length ? msgs.slice(0,10).join(' | ') : 'none');
await b.close();
