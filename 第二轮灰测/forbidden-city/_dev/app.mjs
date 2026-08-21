import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const url = process.argv[2] || 'file:///home/asus_pyqx/B3/forbidden-city/index.html';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:1280,height:760}, deviceScaleFactor:1});
const msgs=[]; p.on('console',m=>msgs.push('['+m.type()+'] '+m.text())); p.on('pageerror',e=>msgs.push('[pageerror] '+e.message+'\n'+(e.stack||'')));
await p.goto(url,{waitUntil:'load',timeout:300000});
// 等加载完成
try{ await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'), {timeout:240000}); }
catch(e){ console.log('LOADING TIMEOUT'); }
console.log('loading text:', await p.textContent('#ltxt'), '| err:', await p.textContent('#lerr'));
await p.waitForTimeout(+(process.env.WAIT||4000));
console.log('stats:', (await p.textContent('#stats')).replace(/\n/g,' '));
console.log('labels shown:', await p.evaluate(()=>document.querySelectorAll('.lab[style*="display: block"]').length));
if(process.env.SCRIPT) console.log(await p.evaluate(process.env.SCRIPT));
await p.screenshot({path: process.env.SHOT || 'app.png'});
if(msgs.length) console.log('--- console ---\n'+msgs.slice(0,25).join('\n'));
await b.close();
