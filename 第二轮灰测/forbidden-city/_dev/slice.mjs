import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage({viewport:{width:400,height:300}});
p.on('pageerror',e=>console.log('[pageerror] '+e.message));
await p.goto(process.argv[2],{waitUntil:'load',timeout:180000});
const args = JSON.parse(process.argv[3]);
console.log(await p.evaluate(a=>window.__slice(...a), args));
await b.close();
