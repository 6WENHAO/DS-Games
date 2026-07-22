const fs = require('fs');
const file = process.argv[2];
const re = new RegExp(process.argv[3], 'g');
const s = fs.readFileSync(file, 'utf8');
const out = new Set();
let m;
while ((m = re.exec(s)) !== null) out.add(m[1] !== undefined ? m[1] : m[0]);
console.log([...out].join('\n') || 'NO_MATCH');
