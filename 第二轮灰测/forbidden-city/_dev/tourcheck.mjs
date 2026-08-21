import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:800,height:500}});
p.on('pageerror',e=>console.log('[pageerror] '+e.message));
await p.goto('file:///home/asus_pyqx/B3/forbidden-city/index.html',{waitUntil:'load',timeout:300000});
await p.waitForFunction(()=>document.getElementById('loading').classList.contains('done'),{timeout:240000});
const res = await p.evaluate(()=>{
  const q = APP.q, out=[];
  for(const w of TOUR){
    let y = w.y!==undefined? w.y : Math.max(0,q.groundTop(w.x,w.z));
    let ok=false;
    for(let t=0;t<30;t++){ if(!q.solid(w.x,y,w.z)&&!q.solid(w.x,y+1,w.z)){ok=true;break;} y++; }
    out.push({cap:w.cap, x:w.x, z:w.z, y, ok, ground:q.groundTop(w.x,w.z), mat:APP.ground.matAt(w.x,w.z)});
  }
  // 殿内 / 城墙顶
  out.push({cap:'太和殿内宝座前', x:0, z:132, y:11, inside:!q.solid(0,11,132)});
  out.push({cap:'南城墙马道顶', x:-360, z:430, y:10, inside:!q.solid(-360,10,430)});
  return out;
});
for(const r of res) console.log((r.ok===false?'✗':'✓'), r.cap, 'y='+r.y, r.ground!==undefined?'ground='+r.ground:'', r.mat!==undefined?'mat='+r.mat:'');
await b.close();
