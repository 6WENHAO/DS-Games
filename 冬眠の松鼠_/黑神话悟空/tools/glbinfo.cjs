const fs = require('fs');
const buf = fs.readFileSync(process.argv[2]);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
const out = {
  animations: (json.animations || []).map(a => a.name),
  meshes: (json.meshes || []).map(m => m.name).slice(0, 80),
  nodes: (json.nodes || []).map(n => n.name).slice(0, 120),
  images: (json.images || []).map(i => i.name || i.mimeType),
  materials: (json.materials || []).map(m => m.name),
};
const key = process.argv[3];
console.log(JSON.stringify(key ? out[key] : out, null, 1));
