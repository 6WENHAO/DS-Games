/*
 * The markup ships the default locale's copy inline, so the very first paint —
 * before any module has executed — is already in the right language. This audit
 * keeps those inline fallbacks from drifting away from the dictionary.
 *
 * Called from tools/smoke.mjs.
 */
export function checkMarkupDefaults({ check, i18nSrc, htmlSrc }) {
  const zhTable = (() => {
    const start = i18nSrc.indexOf('  zh: {');
    const end = i18nSrc.indexOf('\n  },', start);
    const body = i18nSrc.slice(start, end);
    const map = new Map();
    for (const m of body.matchAll(/^ {4}'([^']+)': '((?:[^'\\]|\\.)*)',$/gm)) {
      map.set(m[1], m[2].replace(/\\'/g, "'"));
    }
    return map;
  })();

  check('the Chinese table parses for the markup audit', zhTable.size > 100, `${zhTable.size} strings`);

  const squash = (s) => s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const drift = [];
  let compared = 0;
  for (const m of htmlSrc.matchAll(/data-i18n="([^"]+)"[^>]*>([^<]*)</g)) {
    const expected = zhTable.get(m[1]);
    if (expected === undefined) continue;
    compared += 1;
    if (squash(m[2]) !== squash(expected)) drift.push(m[1]);
  }

  check('markup fallbacks match the default locale', drift.length === 0,
    drift.length ? drift.join(', ') : `${compared} inline strings agree with the dictionary`);
  check('the document element declares the default locale', /<html lang="zh-CN">/.test(htmlSrc));
  check('the static title matches the default locale',
    htmlSrc.includes(`<title>${zhTable.get('doc.title')}</title>`));
  check('the static description matches the default locale',
    htmlSrc.includes(zhTable.get('doc.description')));
  check('the language switch lists the default first',
    htmlSrc.indexOf('data-lang="zh"') < htmlSrc.indexOf('data-lang="en"'));
}
