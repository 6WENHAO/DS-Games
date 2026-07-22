const fs = require('fs');
const { execFileSync } = require('child_process');
// usage: node fetch_blobs.js <treeJson> <repo> <outDir> <pathRegex> [stripPrefixRegex]
const [, , treeFile, repo, outDir, pathRe, stripRe] = process.argv;
const tree = JSON.parse(fs.readFileSync(treeFile, 'utf8'));
const re = new RegExp(pathRe);
const items = tree.tree.filter(t => t.type === 'blob' && re.test(t.path));
if (!items.length) { console.log('NO MATCHES'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
for (const it of items) {
  let name = it.path;
  if (stripRe) name = name.replace(new RegExp(stripRe), '');
  name = name.split('/').join('_');
  const out = `${outDir}/${name}`;
  if (fs.existsSync(out) && fs.statSync(out).size === it.size) { console.log('SKIP', name); continue; }
  const url = `https://api.github.com/repos/${repo}/git/blobs/${it.sha}`;
  process.stdout.write(`GET ${name} (${(it.size/1024).toFixed(0)}KB)... `);
  try {
    execFileSync('curl.exe', ['-sL', '--fail', '-H', 'User-Agent: monki-dev', '-H', 'Accept: application/vnd.github.raw', '-o', out, url], { timeout: 280000 });
    const got = fs.statSync(out).size;
    console.log(got === it.size ? 'OK' : `SIZE MISMATCH got ${got} want ${it.size}`);
  } catch (e) { console.log('FAIL', e.message); }
}
