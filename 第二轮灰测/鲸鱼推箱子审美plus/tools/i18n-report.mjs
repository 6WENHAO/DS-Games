// Dev-time report: which dictionary keys are never referenced.
// Run: node tools/i18n-report.mjs
import fs from 'node:fs/promises';

const read = (p) => fs.readFile(new URL(p, import.meta.url), 'utf8');
const [i18n, html, ui, main] = await Promise.all([
  read('../src/ui/i18n.js'),
  read('../index.html'),
  read('../src/ui/ui.js'),
  read('../src/main.js'),
]);

const table = (name) => {
  const start = i18n.indexOf(`  ${name}: {`);
  const end = i18n.indexOf('\n  },', start);
  return [...i18n.slice(start, end).matchAll(/^\s{4}'([^']+)':/gm)].map((m) => m[1]);
};

const used = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-label)?="([^"]+)"/g)) used.add(m[1]);
for (const s of [ui, main, i18n]) {
  for (const m of s.matchAll(/\bt\('([^']+)'/g)) used.add(m[1]);
  for (const m of s.matchAll(/setBoot\('([^']+)'/g)) used.add(m[1]);
}
for (const m of main.matchAll(/key: '([a-z]+)',/g)) used.add(`lab.group.${m[1]}`);
for (const m of main.matchAll(/type: '(range|toggle|segment)',\s*(?:\n\s*)?id: '([\w-]+)'/g)) {
  used.add(`lab.${m[2]}`);
  if (m[1] === 'toggle') { used.add(`lab.${m[2]}.on`); used.add(`lab.${m[2]}.off`); }
}
for (const d of ['up', 'down', 'left', 'right']) used.add(`hud.dir.${d}`);
used.add('solved.next');
used.add('solved.nextLast');

const en = table('en');
const zh = table('zh');
const unused = en.filter((k) => !used.has(k));

console.log(`en keys ${en.length}   zh keys ${zh.length}   referenced ${used.size}`);
console.log(`missing zh: ${en.filter((k) => !zh.includes(k)).join(', ') || '(none)'}`);
console.log(`never referenced by a literal: ${unused.join(', ') || '(none)'}`);
console.log('(boot.step.start is reached through UI state, so it can appear here.)');
