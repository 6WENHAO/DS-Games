/*
 * Runtime check of the locale switch, driven against a minimal DOM.
 * Called from tools/smoke.mjs; kept separate so that file stays readable.
 */
export async function checkLocaleRuntime({ check, levels, i18nUrl }) {
  const makeNode = (attrs = {}) => ({
    dataset: attrs,
    textContent: '',
    innerHTML: '',
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return this.attributes[k]; },
  });
  const labelNode = makeNode({ i18n: 'hud.pushes' });
  const htmlNode = makeNode({ i18nHtml: 'credits.libs.three' });
  const langZh = makeNode({ lang: 'zh' });
  const langEn = makeNode({ lang: 'en' });

  const store = new Map();
  const priorDocument = globalThis.document;
  // Node 24 ships a read-only `navigator`, so it has to be redefined.
  const priorNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { languages: ['en-GB', 'en'], language: 'en-GB' },
    configurable: true,
    writable: true,
  });
  globalThis.document = {
    documentElement: { lang: 'zh-CN' },
    title: '',
    querySelector: () => null,
    querySelectorAll: (sel) => {
      if (sel === '[data-i18n]') return [labelNode];
      if (sel === '[data-i18n-html]') return [htmlNode];
      if (sel === '[data-i18n-label]') return [];
      if (sel === '[data-lang]') return [langZh, langEn];
      return [];
    },
  };

  const i18n = await import(i18nUrl);
  const level = levels[0];

  /* --- the default --- */
  check('the interface declares Chinese as its default', i18n.DEFAULT_LOCALE === 'zh');
  check('an empty store opens in Chinese even on an English browser',
    i18n.initLocale() === 'zh', `navigator reports ${globalThis.navigator.language}`);
  check('the document language is set to zh-CN', globalThis.document.documentElement.lang === 'zh-CN');
  check('Chinese copy resolves', i18n.t('hud.pushes') === '推动次数', i18n.t('hud.pushes'));
  check('placeholders interpolate in Chinese',
    i18n.t('hud.index', { n: 3, total: 10 }) === '第 3 关 / 共 10 关',
    i18n.t('hud.index', { n: 3, total: 10 }));

  const zhText = i18n.levelText(level);
  check('level text resolves in Chinese',
    zhText.name !== level.name && zhText.name.length > 0, `${level.name} -> ${zhText.name}`);
  check('every board resolves in Chinese',
    levels.every((l) => {
      const txt = i18n.levelText(l);
      return txt.name !== l.name && txt.concept !== l.concept && txt.hint !== l.hint;
    }));
  check('the DOM pass fills text nodes with Chinese', labelNode.textContent === '推动次数', labelNode.textContent);
  check('the switch marks Chinese as pressed',
    langZh.getAttribute('aria-pressed') === 'true' && langEn.getAttribute('aria-pressed') === 'false');

  /* --- switching to English --- */
  let notified = null;
  i18n.onLocaleChange((l) => { notified = l; });
  i18n.setLocale('en');

  check('switching notifies listeners', notified === 'en');
  check('switching sets the document language', globalThis.document.documentElement.lang === 'en');
  check('English copy resolves after the switch', i18n.t('hud.pushes') === 'Pushes');
  check('placeholders interpolate in English',
    i18n.t('hud.index', { n: 3, total: 10 }) === 'Puzzle 3 of 10');
  const enText = i18n.levelText(level);
  check('English level text comes from the puzzle data',
    enText.name === level.name && enText.hint === level.hint);
  check('the DOM pass fills rich nodes', htmlNode.innerHTML.includes('three.js r180'));
  check('the choice is persisted', store.get('tallgrass.locale') === 'en');
  check('an unknown locale is refused', i18n.setLocale('de') === 'en');

  /* --- a stored choice outranks the default on the next visit --- */
  const fresh = await import(`${i18nUrl}?reload=1`);
  check('a stored English choice survives a reload', fresh.initLocale() === 'en',
    `store holds ${store.get('tallgrass.locale')}`);
  store.clear();
  const clean = await import(`${i18nUrl}?reload=2`);
  check('clearing the store returns to Chinese', clean.initLocale() === 'zh');

  globalThis.document = priorDocument;
  delete globalThis.localStorage;
  if (priorNavigator) Object.defineProperty(globalThis, 'navigator', priorNavigator);
  else delete globalThis.navigator;
}
