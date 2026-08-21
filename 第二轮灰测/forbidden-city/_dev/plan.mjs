import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({args:['--no-sandbox','--js-flags=--max-old-space-size=4096']});
const p = await b.newPage();
p.on('pageerror',e=>console.log('[pageerror] '+e.message));
await p.goto(process.argv[2],{waitUntil:'load',timeout:300000});
console.log(await p.evaluate(()=>window.__log.join('\n')));
if(process.argv[3]) console.log(await p.evaluate(a=>window.__plan(...a), JSON.parse(process.argv[3])));
if(process.env.LABELS) console.log(await p.evaluate(()=>window.__labels()));
await b.close();
