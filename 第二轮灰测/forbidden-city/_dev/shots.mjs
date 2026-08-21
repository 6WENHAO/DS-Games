import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:1440,height:900}, deviceScaleFactor:1});
const msgs=[]; p.on('pageerror',e=>msgs.push('[pageerror] '+e.message));
await p.goto('file:///home/asus_pyqx/B3/forbidden-city/index.html',{waitUntil:'load',timeout:300000});
await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'),{timeout:240000});
mkdirSync('/home/asus_pyqx/B3/forbidden-city/docs',{recursive:true});
const shots = [
  ['overview','()=>{ APP.labelsOn=true; APP.R.setSun(0.30); APP.god.flyTo(0,10,140,560,Math.PI,0.42); APP.god.yaw=Math.PI; APP.god.dist=560; APP.god.pitch=0.42; for(let i=0;i<60;i++)APP.god.update(0.03); }'],
  ['topview','()=>{ APP.labelsOn=false; APP.R.setSun(0.46); APP.god.flyTo(0,0,40,1250,Math.PI,1.35); APP.god.yaw=Math.PI; APP.god.dist=1250; APP.god.pitch=1.35; for(let i=0;i<60;i++)APP.god.update(0.03); }'],
  ['fps-hall','()=>{ setMode(\'fps\'); APP.walker.place(0,146); APP.walker.yaw=Math.PI; APP.walker.pitch=0.10; APP.labelsOn=false; APP.R.setSun(0.32); }'],
  ['fps-square','()=>{ setMode(\'fps\'); APP.walker.place(0,268); APP.walker.yaw=Math.PI; APP.walker.pitch=0.08; APP.labelsOn=false; APP.R.setSun(0.32); }'],
  ['dusk','()=>{ setMode(\'god\'); APP.labelsOn=true; APP.R.setSun(0.75); APP.god.flyTo(0,10,160,640,Math.PI,0.45); APP.god.yaw=Math.PI; APP.god.dist=640; APP.god.pitch=0.45; for(let i=0;i<60;i++)APP.god.update(0.03); }'],
];
for (const [name, setup] of shots) {
  await p.evaluate('(' + setup + ')()');
  await p.waitForTimeout(1800);
  await p.evaluate(()=>{ APP.freeze=true; });
  await p.waitForTimeout(400);
  try { await p.screenshot({path:'/home/asus_pyqx/B3/forbidden-city/docs/'+name+'.png', timeout:60000}); console.log('saved '+name); }
  catch(e){ console.log('shot fail '+name+': '+e.message); }
  await p.evaluate(()=>{ APP.freeze=false; });
}
if(msgs.length) console.log(msgs.slice(0,10).join('\n'));
await b.close();
