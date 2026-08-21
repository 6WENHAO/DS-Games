import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');
const info = await p.evaluate(() => {
  const c = document.getElementById('c');
  const gl = c.getContext('webgl2');
  if (!gl) return { ok:false };
  const d = gl.getExtension('WEBGL_debug_renderer_info');
  return { ok:true, ver: gl.getParameter(gl.VERSION), renderer: d? gl.getParameter(d.UNMASKED_RENDERER_WEBGL):'?', maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
});
console.log(JSON.stringify(info));
await b.close();
