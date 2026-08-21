/* look.js — 用本地 ollama qwen3-vl 看截图并回答问题
   用法: node tools/look.js shots/xx.png "问题" */
const fs = require('fs');
const file = process.argv[2];
const q = process.argv[3] || '这是一张游戏截图。请描述你看到的内容：天空、云、地平线、地表、颜色、是否有 HUD 文字。如果画面几乎全黑或全是单色，请直接说"空白"。100 字以内。';
const img = fs.readFileSync(file).toString('base64');
const body = JSON.stringify({
  model: 'qwen3-vl:4b', prompt: q, images: [img], stream: false, think: false,
  options: { temperature: 0.05, num_predict: 700 }
});
fetch('http://127.0.0.1:11434/api/generate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body
}).then(r => r.json()).then(j => {
  console.log('=== ' + file + ' ===');
  let t = (j.response || '').trim();
  if (!t) t = '(thinking) ' + (j.thinking || JSON.stringify(j)).replace(/\s+/g, ' ').trim();
  console.log(t);
}).catch(e => console.log('ollama error: ' + e.message));
