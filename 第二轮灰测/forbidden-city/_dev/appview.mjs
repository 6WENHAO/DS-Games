import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const url = 'file:///home/asus_pyqx/B3/forbidden-city/index.html';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:1280,height:768}, deviceScaleFactor:1});
const msgs=[]; p.on('console',m=>msgs.push('['+m.type()+'] '+m.text())); p.on('pageerror',e=>msgs.push('[pageerror] '+e.message));
await p.goto(url,{waitUntil:'load',timeout:300000});
await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'),{timeout:240000});
await p.addScriptTag({path:'/home/asus_pyqx/B3/forbidden-city/_dev/inspect.js'});
await p.evaluate(()=>{
  window.__insp = makeInspector(APP.R);
  window.__onFrame = ()=>{ if(window.__grabNext){ window.__insp.grab(); window.__grabNext=false; window.__grabbed=true; } };
});
const setup = process.env.SETUP;
if (setup) { await p.evaluate('(' + setup + ')()'); }
await p.waitForTimeout(+(process.env.WAIT||2500));
await p.evaluate(()=>{ window.__grabbed=false; window.__grabNext=true; });
let ok=false;
for(let i=0;i<120;i++){
  await p.waitForTimeout(250);
  const st = await p.evaluate(()=>[!!window.__grabbed, !!window.__grabNext, typeof window.__onFrame, APP && APP.stats ? Math.round(APP.stats.fps):-1]);
  if(st[0]){ ok=true; break; }
  if(i%8===7) console.log('  waiting grab', JSON.stringify(st));
}
if(!ok){ console.log('GRAB FAIL'); console.log(msgs.slice(0,25).join('\n')); await b.close(); process.exit(1); }
console.log('stats:', (await p.textContent('#stats')).replace(/\n/g,' '));
console.log(await p.evaluate(()=>window.__insp.stats()));
if(process.env.PROBE) console.log(await p.evaluate(pp=>window.__insp.probeWorld(pp), JSON.parse(process.env.PROBE)));
console.log(await p.evaluate(([c,r])=>window.__insp.ascii(c,r), [+(process.env.COLS||116), +(process.env.ROWS||44)]));
if(process.env.SHOT){ try{ await p.screenshot({path:process.env.SHOT, timeout:90000}); console.log('shot saved'); }catch(e){ console.log('shot failed: '+e.message); } }
if(msgs.length) console.log('--- console ---\n'+msgs.slice(0,20).join('\n'));
await b.close();
