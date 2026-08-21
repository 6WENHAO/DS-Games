/* ============================================================
   svg.js —— 全部美术素材（纯 SVG 程序化绘制）
   ============================================================ */
'use strict';

const SVG = (function () {

  const s = (w, h, inner, extra) =>
    `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" ${extra || ''}>${inner}</svg>`;

  /* ---------- 通用渐变定义 ---------- */
  function grad(id, c1, c2, vertical) {
    return vertical === false
      ? `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`
      : `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`;
  }
  function rgrad(id, c1, c2, cx, cy) {
    return `<radialGradient id="${id}" cx="${cx || 0.4}" cy="${cy || 0.32}" r="0.75"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
  }

  /* ============================================================
     一、玩家 —— 铁甲战士
     ============================================================ */
  function ironclad(scale) {
    const inner = `
    <defs>
      ${grad('ic-cape', '#8f2118', '#4a0d09')}
      ${grad('ic-armor', '#8d949c', '#3b4048')}
      ${grad('ic-armor2', '#b9c0c8', '#5a616b')}
      ${grad('ic-blade', '#e8eef5', '#8e97a3')}
      ${grad('ic-skin', '#c99b6e', '#8a6440')}
    </defs>
    <path d="M62 74 Q26 150 34 244 L100 256 L166 244 Q174 150 138 74 Z" fill="url(#ic-cape)"/>
    <path d="M100 82 L100 254" stroke="#3d0a07" stroke-width="3" opacity=".6"/>
    <path d="M76 168 L70 240 L92 244 L94 170 Z" fill="url(#ic-armor)"/>
    <path d="M124 168 L130 240 L108 244 L106 170 Z" fill="url(#ic-armor)"/>
    <rect x="62" y="236" width="38" height="14" rx="5" fill="#2c3038"/>
    <rect x="100" y="236" width="38" height="14" rx="5" fill="#2c3038"/>
    <rect x="70" y="156" width="60" height="16" rx="4" fill="#5b3a1e"/>
    <rect x="92" y="157" width="16" height="14" rx="3" fill="#d4af58"/>
    <path d="M66 84 Q100 70 134 84 L138 152 Q100 166 62 152 Z" fill="url(#ic-armor2)"/>
    <path d="M100 78 L100 160" stroke="#454b54" stroke-width="2.5"/>
    <path d="M74 100 Q100 112 126 100" stroke="#454b54" stroke-width="2.5" fill="none"/>
    <path d="M72 122 Q100 134 128 122" stroke="#454b54" stroke-width="2.5" fill="none"/>
    <path d="M52 82 Q64 62 84 72 L80 98 Q60 104 52 96 Z" fill="url(#ic-armor2)"/>
    <path d="M148 82 Q136 62 116 72 L120 98 Q140 104 148 96 Z" fill="url(#ic-armor2)"/>
    <path d="M56 96 L44 140 L58 146 L70 106 Z" fill="url(#ic-armor)"/>
    <path d="M144 96 L156 140 L142 146 L130 106 Z" fill="url(#ic-armor)"/>
    <circle cx="50" cy="146" r="9" fill="url(#ic-skin)"/>
    <circle cx="150" cy="146" r="9" fill="url(#ic-skin)"/>
    <path d="M78 34 Q100 18 122 34 L124 62 Q100 76 76 62 Z" fill="url(#ic-armor2)"/>
    <path d="M76 56 L124 56 L122 70 Q100 80 78 70 Z" fill="#4a5058"/>
    <rect x="84" y="44" width="14" height="7" rx="2" fill="#1a1d22"/>
    <rect x="102" y="44" width="14" height="7" rx="2" fill="#1a1d22"/>
    <rect x="86" y="45" width="10" height="5" fill="#ff7a3a" opacity=".9"/>
    <rect x="104" y="45" width="10" height="5" fill="#ff7a3a" opacity=".9"/>
    <path d="M99 30 L101 30 L101 60 L99 60 Z" fill="#7d1d16"/>
    <path d="M100 14 Q112 18 108 34 Q100 26 92 34 Q88 18 100 14Z" fill="#8f2118"/>
    <g transform="rotate(14 156 150)">
      <rect x="150" y="42" width="13" height="104" rx="3" fill="url(#ic-blade)"/>
      <path d="M150 42 L163 42 L156.5 24 Z" fill="#dfe6ee"/>
      <rect x="138" y="146" width="37" height="9" rx="3" fill="#8a6d20"/>
      <rect x="152" y="155" width="9" height="26" rx="3" fill="#4a2f18"/>
      <circle cx="156.5" cy="184" r="6" fill="#d4af58"/>
    </g>`;
    return s(200, 260, inner, scale ? `width="${scale}"` : '');
  }

  function portrait() {
    return s(60, 60, `
    <defs>${grad('p-a', '#b9c0c8', '#5a616b')}</defs>
    <rect width="60" height="60" fill="#191420"/>
    <path d="M14 56 Q30 34 46 56 Z" fill="#8f2118"/>
    <path d="M18 20 Q30 6 42 20 L43 40 Q30 50 17 40 Z" fill="url(#p-a)"/>
    <path d="M17 36 L43 36 L42 44 Q30 52 18 44 Z" fill="#4a5058"/>
    <rect x="22" y="26" width="7" height="5" rx="1.5" fill="#141317"/>
    <rect x="31" y="26" width="7" height="5" rx="1.5" fill="#141317"/>
    <rect x="23" y="27" width="5" height="3" fill="#ff7a3a"/>
    <rect x="32" y="27" width="5" height="3" fill="#ff7a3a"/>
    <path d="M30 4 Q38 8 35 20 Q30 14 25 20 Q22 8 30 4Z" fill="#8f2118"/>`);
  }

  /* ============================================================
     二、敌人
     ============================================================ */
  const ENEMY_ART = {
    jaw_worm: () => s(180, 150, `
      <defs>${rgrad('jw', '#b7773c', '#6a3d18')}${grad('jw2', '#f2e2c2', '#c4a878')}</defs>
      <ellipse cx="90" cy="120" rx="72" ry="26" fill="#5a3315"/>
      <path d="M22 118 Q16 66 58 48 Q90 34 126 50 Q166 68 158 118 Z" fill="url(#jw)"/>
      <path d="M40 112 Q90 96 140 112" stroke="#4e2a10" stroke-width="4" fill="none"/>
      <path d="M34 92 Q90 74 146 92" stroke="#4e2a10" stroke-width="3" fill="none" opacity=".7"/>
      <circle cx="66" cy="70" r="9" fill="#20140a"/><circle cx="114" cy="70" r="9" fill="#20140a"/>
      <circle cx="68" cy="68" r="3" fill="#ffcf5a"/><circle cx="116" cy="68" r="3" fill="#ffcf5a"/>
      <path d="M46 96 Q60 132 90 130 Q120 132 134 96 Q90 112 46 96Z" fill="#3c1f0c"/>
      <path d="M56 102 L62 122 L70 104 Z" fill="url(#jw2)"/>
      <path d="M76 106 L82 128 L90 106 Z" fill="url(#jw2)"/>
      <path d="M96 106 L102 128 L110 106 Z" fill="url(#jw2)"/>
      <path d="M114 102 L120 122 L126 102 Z" fill="url(#jw2)"/>
      <path d="M18 60 Q6 42 22 34" stroke="#6a3d18" stroke-width="8" fill="none" stroke-linecap="round"/>
      <path d="M162 60 Q174 42 158 34" stroke="#6a3d18" stroke-width="8" fill="none" stroke-linecap="round"/>`),

    cultist: () => s(150, 230, `
      <defs>${grad('cu', '#3f5a3a', '#1a2418')}${grad('cus', '#8a6d20', '#4a3a10')}</defs>
      <path d="M36 220 Q22 130 46 62 L104 62 Q128 130 114 220 Z" fill="url(#cu)"/>
      <path d="M75 66 L75 218" stroke="#131a12" stroke-width="2.5" opacity=".7"/>
      <path d="M46 62 Q75 30 104 62 Q94 76 75 76 Q56 76 46 62Z" fill="#2b3b28"/>
      <path d="M52 60 Q75 38 98 60 L96 84 Q75 96 54 84 Z" fill="#101610"/>
      <ellipse cx="66" cy="70" rx="5" ry="6" fill="#e8ff6b"/><ellipse cx="84" cy="70" rx="5" ry="6" fill="#e8ff6b"/>
      <path d="M30 120 Q14 150 26 178" stroke="#2b3b28" stroke-width="15" fill="none" stroke-linecap="round"/>
      <path d="M120 120 Q136 150 124 178" stroke="#2b3b28" stroke-width="15" fill="none" stroke-linecap="round"/>
      <rect x="126" y="30" width="7" height="170" rx="3" fill="url(#cus)"/>
      <path d="M129.5 12 Q146 24 129.5 44 Q113 24 129.5 12Z" fill="#c0392b"/>
      <circle cx="129.5" cy="28" r="6" fill="#ffe08a"/>`),

    louse: (c) => s(140, 110, `
      <defs>${rgrad('lo' + c.k, c.a, c.b)}</defs>
      <path d="M30 96 L14 106 M110 96 L126 106 M40 92 L26 104 M100 92 L114 104"
        stroke="#2a1c14" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="70" cy="62" rx="52" ry="40" fill="url(#lo${c.k})"/>
      <path d="M70 24 L70 100" stroke="${c.c}" stroke-width="3" opacity=".55"/>
      <ellipse cx="48" cy="46" rx="9" ry="7" fill="${c.c}" opacity=".6"/>
      <ellipse cx="92" cy="46" rx="9" ry="7" fill="${c.c}" opacity=".6"/>
      <ellipse cx="70" cy="80" rx="12" ry="8" fill="${c.c}" opacity=".5"/>
      <circle cx="52" cy="40" r="7" fill="#140d09"/><circle cx="88" cy="40" r="7" fill="#140d09"/>
      <circle cx="54" cy="38" r="2.5" fill="#fff"/><circle cx="90" cy="38" r="2.5" fill="#fff"/>
      <path d="M56 74 Q70 88 84 74 Q70 80 56 74Z" fill="#2a0f0a"/>
      <path d="M58 76 L62 84 L66 76 M74 76 L78 84 L82 76" fill="#fff2d0"/>
      <path d="M46 22 Q34 6 22 12" stroke="#2a1c14" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M94 22 Q106 6 118 12" stroke="#2a1c14" stroke-width="4" fill="none" stroke-linecap="round"/>`),

    slime: (c) => s(180, 150, `
      <defs>${rgrad('sl' + c.k, c.a, c.b, 0.38, 0.28)}</defs>
      <ellipse cx="90" cy="132" rx="76" ry="16" fill="rgba(0,0,0,.35)"/>
      <path d="M14 132 Q10 66 52 40 Q90 20 128 40 Q170 66 166 132 Q120 144 90 142 Q60 144 14 132Z"
        fill="url(#sl${c.k})"/>
      ${c.spike ? `<path d="M40 46 L30 16 L58 38 Z M90 30 L86 2 L104 30 Z M136 44 L150 16 L124 38 Z"
        fill="${c.b}"/>` : ''}
      <ellipse cx="62" cy="76" rx="12" ry="15" fill="#100c14" opacity=".85"/>
      <ellipse cx="118" cy="76" rx="12" ry="15" fill="#100c14" opacity=".85"/>
      <ellipse cx="59" cy="71" rx="4" ry="5" fill="#fff" opacity=".85"/>
      <ellipse cx="115" cy="71" rx="4" ry="5" fill="#fff" opacity=".85"/>
      <path d="M64 106 Q90 124 116 106 Q90 116 64 106Z" fill="#0e0a12" opacity=".8"/>
      <ellipse cx="66" cy="54" rx="16" ry="9" fill="#fff" opacity=".18"/>
      <path d="M22 128 Q26 148 40 142" stroke="${c.b}" stroke-width="6" fill="none" opacity=".7"/>
      <path d="M158 128 Q154 148 140 142" stroke="${c.b}" stroke-width="6" fill="none" opacity=".7"/>`),

    fungi_beast: () => s(150, 170, `
      <defs>${rgrad('fb', '#c85a5a', '#7a2222')}${grad('fb2', '#e8dcc0', '#a89a78')}</defs>
      <ellipse cx="75" cy="156" rx="52" ry="12" fill="rgba(0,0,0,.35)"/>
      <path d="M42 154 Q34 100 54 84 L96 84 Q116 100 108 154 Z" fill="url(#fb2)"/>
      <path d="M18 84 Q22 34 75 30 Q128 34 132 84 Q75 100 18 84Z" fill="url(#fb)"/>
      <circle cx="42" cy="58" r="8" fill="#f0dcc0" opacity=".8"/>
      <circle cx="75" cy="46" r="10" fill="#f0dcc0" opacity=".8"/>
      <circle cx="108" cy="58" r="8" fill="#f0dcc0" opacity=".8"/>
      <circle cx="60" cy="74" r="5" fill="#f0dcc0" opacity=".6"/>
      <circle cx="94" cy="74" r="5" fill="#f0dcc0" opacity=".6"/>
      <circle cx="60" cy="104" r="7" fill="#2a1a12"/><circle cx="90" cy="104" r="7" fill="#2a1a12"/>
      <circle cx="62" cy="102" r="2.5" fill="#ffd36b"/><circle cx="92" cy="102" r="2.5" fill="#ffd36b"/>
      <path d="M56 126 Q75 142 94 126 Q75 134 56 126Z" fill="#3a2418"/>
      <path d="M58 128 L62 138 L67 128 M83 128 L88 138 L92 128" fill="#fff2d0"/>
      <path d="M46 150 L38 164 M104 150 L112 164" stroke="#a89a78" stroke-width="9" stroke-linecap="round"/>`),

    slaver: (c) => s(160, 230, `
      <defs>${grad('sv' + c.k, c.a, c.b)}${grad('svk', '#c99b6e', '#8a6440')}</defs>
      <path d="M52 224 L46 168 L74 168 L74 224 Z" fill="#3a2f26"/>
      <path d="M108 224 L114 168 L86 168 L86 224 Z" fill="#3a2f26"/>
      <rect x="40" y="216" width="42" height="12" rx="4" fill="#211a14"/>
      <rect x="78" y="216" width="42" height="12" rx="4" fill="#211a14"/>
      <path d="M46 78 Q80 62 114 78 L120 170 Q80 182 40 170 Z" fill="url(#sv${c.k})"/>
      <path d="M44 100 Q80 114 116 100" stroke="${c.c}" stroke-width="4" fill="none"/>
      <rect x="42" y="146" width="76" height="14" rx="4" fill="#4a3a24"/>
      <path d="M36 82 L22 132 L38 138 L52 92 Z" fill="url(#sv${c.k})"/>
      <path d="M124 82 L138 132 L122 138 L108 92 Z" fill="url(#sv${c.k})"/>
      <circle cx="30" cy="140" r="9" fill="url(#svk)"/><circle cx="130" cy="140" r="9" fill="url(#svk)"/>
      <ellipse cx="80" cy="48" rx="24" ry="26" fill="url(#svk)"/>
      <path d="M56 44 Q80 22 104 44 Q80 34 56 44Z" fill="#2a1c14"/>
      <circle cx="70" cy="48" r="4" fill="#160f0a"/><circle cx="90" cy="48" r="4" fill="#160f0a"/>
      <path d="M70 62 Q80 70 90 62" stroke="#5a3a22" stroke-width="3" fill="none"/>
      <path d="M132 138 Q168 150 152 190 Q142 214 156 226" stroke="#4a3320" stroke-width="5" fill="none" stroke-linecap="round"/>`),

    looter: () => s(150, 220, `
      <defs>${grad('lt', '#4a4450', '#22202a')}${grad('ltk', '#c99b6e', '#8a6440')}</defs>
      <path d="M50 214 L44 162 L70 162 L70 214 Z" fill="#2e2a34"/>
      <path d="M100 214 L106 162 L80 162 L80 214 Z" fill="#2e2a34"/>
      <path d="M44 74 Q75 58 106 74 L112 164 Q75 176 38 164 Z" fill="url(#lt)"/>
      <path d="M75 62 L75 170" stroke="#16141c" stroke-width="2" opacity=".8"/>
      <path d="M34 78 L20 124 L36 130 L50 88 Z" fill="url(#lt)"/>
      <path d="M116 78 L130 124 L114 130 L100 88 Z" fill="url(#lt)"/>
      <circle cx="28" cy="132" r="8" fill="url(#ltk)"/><circle cx="122" cy="132" r="8" fill="url(#ltk)"/>
      <ellipse cx="75" cy="44" rx="23" ry="25" fill="url(#ltk)"/>
      <path d="M50 40 Q75 12 100 40 Q100 26 75 20 Q50 26 50 40Z" fill="#2a2632"/>
      <rect x="54" y="38" width="42" height="12" rx="4" fill="#16141c"/>
      <circle cx="65" cy="44" r="3" fill="#ffd36b"/><circle cx="85" cy="44" r="3" fill="#ffd36b"/>
      <path d="M60 62 Q75 70 90 62" stroke="#6a4a2c" stroke-width="2.5" fill="none"/>
      <ellipse cx="122" cy="150" rx="18" ry="22" fill="#6a5a30"/>
      <path d="M110 138 Q122 130 134 138" stroke="#3a3018" stroke-width="4" fill="none"/>
      <circle cx="118" cy="148" r="4" fill="#ffd76b"/><circle cx="127" cy="156" r="4" fill="#ffd76b"/>`),

    gremlin: (c) => s(130, 150, `
      <defs>${rgrad('gr' + c.k, c.a, c.b, .4, .3)}</defs>
      <ellipse cx="65" cy="142" rx="38" ry="9" fill="rgba(0,0,0,.35)"/>
      <path d="M44 138 L38 108 L54 108 L56 138 Z" fill="${c.b}"/>
      <path d="M86 138 L92 108 L76 108 L74 138 Z" fill="${c.b}"/>
      <ellipse cx="65" cy="84" rx="34" ry="32" fill="url(#gr${c.k})"/>
      <ellipse cx="65" cy="46" rx="30" ry="26" fill="url(#gr${c.k})"/>
      <path d="M36 40 Q14 18 30 12 Q40 26 44 34Z" fill="${c.b}"/>
      <path d="M94 40 Q116 18 100 12 Q90 26 86 34Z" fill="${c.b}"/>
      <circle cx="54" cy="44" r="7" fill="#140d09"/><circle cx="78" cy="44" r="7" fill="#140d09"/>
      <circle cx="55.5" cy="42" r="2.5" fill="${c.eye || '#ffe08a'}"/>
      <circle cx="79.5" cy="42" r="2.5" fill="${c.eye || '#ffe08a'}"/>
      <path d="M52 58 Q65 70 78 58 Q65 64 52 58Z" fill="#2a0f0a"/>
      <path d="M54 59 L57 66 L61 59 M70 59 L74 66 L77 59" fill="#fff2d0"/>
      ${c.weapon === 'club' ? `<g transform="rotate(-16 106 96)"><rect x="100" y="46" width="12" height="60" rx="4" fill="#6a4a28"/><ellipse cx="106" cy="44" rx="16" ry="14" fill="#8a6438"/><circle cx="100" cy="38" r="3" fill="#4a3018"/><circle cx="112" cy="46" r="3" fill="#4a3018"/></g>` : ''}
      ${c.weapon === 'dagger' ? `<g transform="rotate(28 104 100)"><rect x="100" y="52" width="7" height="46" rx="2" fill="#dfe6ee"/><path d="M100 52 L107 52 L103.5 38 Z" fill="#fff"/><rect x="96" y="98" width="15" height="7" rx="2" fill="#6a4a28"/></g>` : ''}
      ${c.weapon === 'shield' ? `<g><path d="M96 62 L128 62 L128 96 Q112 116 96 96 Z" fill="#8d949c" stroke="#5a616b" stroke-width="3"/><circle cx="112" cy="82" r="7" fill="#d4af58"/></g>` : ''}
      ${c.weapon === 'staff' ? `<g><rect x="104" y="30" width="8" height="90" rx="3" fill="#5a3a20"/><circle cx="108" cy="26" r="12" fill="#7a4ad0" opacity=".85"/><circle cx="108" cy="26" r="6" fill="#e0c4ff"/></g>` : ''}
      ${c.hat ? `<path d="M36 26 Q65 2 94 26 Q65 14 36 26Z" fill="${c.hat}"/>` : ''}`),

    gremlin_nob: () => s(200, 240, `
      <defs>${rgrad('gn', '#c26a3a', '#6e2c14', .4, .28)}${grad('gn2', '#e8b06a', '#a05a24')}</defs>
      <ellipse cx="100" cy="230" rx="66" ry="14" fill="rgba(0,0,0,.4)"/>
      <path d="M64 224 L54 168 L88 168 L90 224 Z" fill="#7a3418"/>
      <path d="M136 224 L146 168 L112 168 L110 224 Z" fill="#7a3418"/>
      <rect x="48" y="216" width="48" height="16" rx="6" fill="#3c1a0c"/>
      <rect x="104" y="216" width="48" height="16" rx="6" fill="#3c1a0c"/>
      <path d="M46 100 Q100 76 154 100 Q166 150 150 180 Q100 200 50 180 Q34 150 46 100Z" fill="url(#gn)"/>
      <path d="M70 120 Q100 138 130 120" stroke="#5c2410" stroke-width="5" fill="none"/>
      <path d="M62 148 Q100 164 138 148" stroke="#5c2410" stroke-width="4" fill="none" opacity=".8"/>
      <path d="M40 104 L18 158 L40 168 L58 116 Z" fill="url(#gn)"/>
      <path d="M160 104 L182 158 L160 168 L142 116 Z" fill="url(#gn)"/>
      <circle cx="28" cy="170" r="14" fill="url(#gn2)"/><circle cx="172" cy="170" r="14" fill="url(#gn2)"/>
      <ellipse cx="100" cy="62" rx="42" ry="38" fill="url(#gn)"/>
      <path d="M60 50 Q34 18 54 10 Q68 32 72 44Z" fill="#8e3c18"/>
      <path d="M140 50 Q166 18 146 10 Q132 32 128 44Z" fill="#8e3c18"/>
      <path d="M62 40 L78 32 M138 40 L122 32" stroke="#f0dcc0" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="84" cy="58" rx="9" ry="8" fill="#170c06"/><ellipse cx="116" cy="58" rx="9" ry="8" fill="#170c06"/>
      <circle cx="86" cy="56" r="3" fill="#ff5c2a"/><circle cx="118" cy="56" r="3" fill="#ff5c2a"/>
      <path d="M74 78 Q100 100 126 78 Q100 92 74 78Z" fill="#2a0d05"/>
      <path d="M78 80 L84 94 L90 80 M96 82 L102 98 L108 82 M112 80 L118 94 L124 80" fill="#fff2d0"/>
      <path d="M170 168 L196 96" stroke="#5a3a20" stroke-width="10" stroke-linecap="round"/>`),

    lagavulin: (awake) => s(210, 170, `
      <defs>${rgrad('lg', '#4a6a7a', '#1c2c36', .4, .3)}${grad('lg2', '#8fa8b4', '#3e5460')}</defs>
      <ellipse cx="105" cy="158" rx="82" ry="14" fill="rgba(0,0,0,.4)"/>
      <path d="M18 152 Q10 76 60 52 Q105 32 150 52 Q200 76 192 152 Z" fill="url(#lg)"/>
      <path d="M40 140 Q105 120 170 140" stroke="#16232b" stroke-width="5" fill="none"/>
      <path d="M30 116 Q105 94 180 116" stroke="#16232b" stroke-width="4" fill="none" opacity=".8"/>
      <path d="M46 60 L30 24 M164 60 L180 24" stroke="#2a3e48" stroke-width="9" stroke-linecap="round"/>
      <path d="M26 26 Q18 12 34 10 M184 26 Q192 12 176 10" stroke="#2a3e48" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M58 86 Q105 66 152 86 L148 108 Q105 96 62 108 Z" fill="url(#lg2)"/>
      ${awake
        ? `<ellipse cx="80" cy="96" rx="10" ry="9" fill="#ffdc4a"/><ellipse cx="130" cy="96" rx="10" ry="9" fill="#ffdc4a"/>
           <circle cx="80" cy="96" r="4" fill="#3a1a00"/><circle cx="130" cy="96" r="4" fill="#3a1a00"/>
           <path d="M74 124 Q105 148 136 124 Q105 138 74 124Z" fill="#0e1a20"/>
           <path d="M80 128 L86 142 L92 128 M118 128 L124 142 L130 128" fill="#dfe8ee"/>`
        : `<path d="M68 98 Q80 92 92 98" stroke="#16232b" stroke-width="4" fill="none"/>
           <path d="M118 98 Q130 92 142 98" stroke="#16232b" stroke-width="4" fill="none"/>
           <path d="M84 128 Q105 136 126 128" stroke="#16232b" stroke-width="4" fill="none"/>
           <text x="160" y="46" font-size="20" fill="#9fc4d4" opacity=".8">z</text>
           <text x="176" y="30" font-size="15" fill="#9fc4d4" opacity=".6">z</text>`}
      <path d="M14 140 L2 158 M196 140 L208 158" stroke="#2a3e48" stroke-width="8" stroke-linecap="round"/>`),

    sentry: () => s(120, 210, `
      <defs>${grad('se', '#7a6a9a', '#2c2440')}${rgrad('se2', '#ffe08a', '#b06a10', .5, .5)}</defs>
      <ellipse cx="60" cy="200" rx="34" ry="9" fill="rgba(0,0,0,.35)" />
      <path d="M60 12 L104 54 L104 150 L60 194 L16 150 L16 54 Z" fill="url(#se)" stroke="#c0b088" stroke-width="3"/>
      <path d="M60 12 L60 194 M16 54 L104 150 M104 54 L16 150" stroke="#3a3050" stroke-width="2" opacity=".6"/>
      <circle cx="60" cy="100" r="26" fill="#160f22"/>
      <circle cx="60" cy="100" r="20" fill="url(#se2)"/>
      <ellipse cx="60" cy="100" rx="7" ry="17" fill="#2a1200"/>
      <circle cx="54" cy="90" r="4" fill="#fff8d8" opacity=".9"/>
      <path d="M30 44 L46 30 M90 44 L74 30" stroke="#c0b088" stroke-width="4"/>
      <path d="M8 96 L2 100 L8 104 M112 96 L118 100 L112 104" stroke="#c0b088" stroke-width="4" fill="none"/>`),

    guardian: (mode) => s(260, 230, `
      <defs>${grad('gd', '#6a7a8a', '#26303c')}${grad('gd2', '#b0c0cc', '#5a6a78')}${rgrad('gdE', '#ff9a4a', '#8a2000', .5, .5)}</defs>
      <ellipse cx="130" cy="220" rx="100" ry="16" fill="rgba(0,0,0,.45)"/>
      <rect x="36" y="60" width="188" height="150" rx="14" fill="url(#gd)" stroke="#1a222c" stroke-width="4"/>
      <rect x="52" y="76" width="156" height="60" rx="8" fill="#1c242e"/>
      <rect x="60" y="84" width="140" height="44" rx="6" fill="url(#gd2)" opacity=".35"/>
      <circle cx="100" cy="106" r="17" fill="#0e1218"/><circle cx="160" cy="106" r="17" fill="#0e1218"/>
      <circle cx="100" cy="106" r="11" fill="url(#gdE)"/><circle cx="160" cy="106" r="11" fill="url(#gdE)"/>
      <path d="M56 152 L204 152 L196 190 L64 190 Z" fill="#1c242e"/>
      <path d="M66 156 L74 186 M86 156 L94 186 M106 156 L114 186 M126 156 L134 186
               M146 156 L154 186 M166 156 L174 186 M186 156 L194 186" stroke="#c8d4dc" stroke-width="7"/>
      <path d="M36 60 L18 30 L60 44 Z M224 60 L242 30 L200 44 Z" fill="#8fa0b0"/>
      <rect x="10" y="88" width="30" height="80" rx="8" fill="url(#gd2)"/>
      <rect x="220" y="88" width="30" height="80" rx="8" fill="url(#gd2)"/>
      <rect x="0" y="150" width="26" height="26" rx="6" fill="#8fa0b0"/>
      <rect x="234" y="150" width="26" height="26" rx="6" fill="#8fa0b0"/>
      ${mode === 'def'
        ? `<path d="M40 64 L64 40 L88 64 L112 40 L136 64 L160 40 L184 64 L208 40 L222 64"
              fill="none" stroke="#ffd76b" stroke-width="6" stroke-linejoin="round"/>`
        : ''}
      <rect x="120" y="196" width="20" height="22" rx="4" fill="#3a4550"/>`),

    slime_boss: () => s(300, 250, `
      <defs>${rgrad('sb', '#8a5ad0', '#33194e', .4, .26)}</defs>
      <ellipse cx="150" cy="238" rx="128" ry="18" fill="rgba(0,0,0,.42)"/>
      <path d="M18 232 Q6 110 76 56 Q150 8 224 56 Q294 110 282 232 Q216 250 150 246 Q84 250 18 232Z" fill="url(#sb)"/>
      <ellipse cx="106" cy="112" rx="22" ry="28" fill="#150b22"/>
      <ellipse cx="196" cy="112" rx="22" ry="28" fill="#150b22"/>
      <ellipse cx="100" cy="102" rx="7" ry="9" fill="#fff" opacity=".9"/>
      <ellipse cx="190" cy="102" rx="7" ry="9" fill="#fff" opacity=".9"/>
      <path d="M96 168 Q150 216 204 168 Q150 196 96 168Z" fill="#160c22"/>
      <path d="M108 176 L118 200 L128 178 M144 182 L154 208 L164 182 M176 176 L186 200 L196 178" fill="#e8dcff" opacity=".9"/>
      <ellipse cx="96" cy="70" rx="34" ry="16" fill="#fff" opacity=".16"/>
      <path d="M40 226 Q46 250 66 244 M260 226 Q254 250 234 244" stroke="#5c3486" stroke-width="9" fill="none"/>
      <circle cx="60" cy="150" r="9" fill="#b98cf0" opacity=".5"/>
      <circle cx="246" cy="168" r="7" fill="#b98cf0" opacity=".5"/>
      <circle cx="150" cy="60" r="6" fill="#d4b6ff" opacity=".5"/>`),

    hexaghost: () => s(240, 250, `
      <defs>${rgrad('hg', '#ff9a3a', '#7a1a00', .5, .45)}${rgrad('hg2', '#fff0b8', '#ff6a10', .5, .5)}</defs>
      <g opacity=".95">
        ${[0, 1, 2, 3, 4, 5].map(i => {
      const a = (i * 60 - 90) * Math.PI / 180;
      const x = 120 + Math.cos(a) * 88, y = 120 + Math.sin(a) * 88;
      return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">
            <path d="M0 -22 Q14 -6 10 8 Q6 20 0 22 Q-6 20 -10 8 Q-14 -6 0 -22Z" fill="url(#hg2)"/>
            <path d="M0 -10 Q6 0 4 8 Q2 14 0 15 Q-2 14 -4 8 Q-6 0 0 -10Z" fill="#fff8d0"/></g>`;
    }).join('')}
      </g>
      <path d="M120 26 L202 74 L202 166 L120 214 L38 166 L38 74 Z" fill="none"
        stroke="#ffb050" stroke-width="3" opacity=".45"/>
      <ellipse cx="120" cy="120" rx="56" ry="66" fill="url(#hg)" opacity=".95"/>
      <ellipse cx="120" cy="120" rx="40" ry="50" fill="#2a0c00" opacity=".55"/>
      <ellipse cx="104" cy="106" rx="9" ry="12" fill="#fff4c0"/>
      <ellipse cx="136" cy="106" rx="9" ry="12" fill="#fff4c0"/>
      <path d="M100 146 Q120 168 140 146 Q120 158 100 146Z" fill="#fff4c0" opacity=".9"/>
      <path d="M78 170 Q90 200 78 224 M120 176 Q132 208 120 234 M162 170 Q150 200 162 224"
        stroke="#ff8a30" stroke-width="7" fill="none" opacity=".8" stroke-linecap="round"/>`)
  };

  const SLIME_PAL = {
    acid: { k: 'ac', a: '#7dc94a', b: '#2f6a1c', spike: false },
    spike: { k: 'sp', a: '#c86ad0', b: '#5a1a66', spike: true }
  };
  const LOUSE_PAL = {
    red: { k: 'r', a: '#c95a4a', b: '#6a1f14', c: '#ff8a6b' },
    green: { k: 'g', a: '#8ab84a', b: '#3d5c16', c: '#c8e88a' }
  };
  const GREMLIN_PAL = {
    mad: { k: 'md', a: '#c9563a', b: '#6e2214', weapon: 'dagger', eye: '#ffd0a0' },
    sneaky: { k: 'sn', a: '#6a9a4a', b: '#2f5a1c', weapon: 'dagger', hat: '#3a2a5a' },
    fat: { k: 'ft', a: '#9a7ac0', b: '#4a2f6a', weapon: 'club' },
    shield: { k: 'sh', a: '#c9a44a', b: '#6e5214', weapon: 'shield' },
    wizard: { k: 'wz', a: '#4a6ac0', b: '#1f2f6a', weapon: 'staff', hat: '#2a1f4a' }
  };

  function enemy(art, param) {
    switch (art) {
      case 'jaw_worm': return ENEMY_ART.jaw_worm();
      case 'cultist': return ENEMY_ART.cultist();
      case 'louse': return ENEMY_ART.louse(LOUSE_PAL[param] || LOUSE_PAL.red);
      case 'slime': return ENEMY_ART.slime(SLIME_PAL[param] || SLIME_PAL.acid);
      case 'fungi': return ENEMY_ART.fungi_beast();
      case 'slaver': return ENEMY_ART.slaver(param === 'red'
        ? { k: 'r', a: '#a03828', b: '#4c1108', c: '#d4614a' }
        : { k: 'b', a: '#2f5a8a', b: '#132a44', c: '#5a8ac0' });
      case 'looter': return ENEMY_ART.looter();
      case 'gremlin': return ENEMY_ART.gremlin(GREMLIN_PAL[param] || GREMLIN_PAL.mad);
      case 'gremlin_nob': return ENEMY_ART.gremlin_nob();
      case 'lagavulin': return ENEMY_ART.lagavulin(param === 'awake');
      case 'sentry': return ENEMY_ART.sentry();
      case 'guardian': return ENEMY_ART.guardian(param);
      case 'slime_boss': return ENEMY_ART.slime_boss();
      case 'hexaghost': return ENEMY_ART.hexaghost();
      default: return ENEMY_ART.jaw_worm();
    }
  }

  /* ============================================================
     三、UI 图标
     ============================================================ */
  function energyOrb() {
    return s(100, 100, `
    <defs>${rgrad('eo', '#7ff5ee', '#0d5e6a', .38, .3)}
      <radialGradient id="eoG" cx=".5" cy=".5" r=".5">
        <stop offset=".6" stop-color="#3fd0c9" stop-opacity="0"/>
        <stop offset="1" stop-color="#3fd0c9" stop-opacity=".45"/></radialGradient></defs>
    <circle cx="50" cy="50" r="48" fill="url(#eoG)"/>
    <circle cx="50" cy="50" r="36" fill="url(#eo)" stroke="#b8f4ef" stroke-width="2.5"/>
    <circle cx="50" cy="50" r="36" fill="none" stroke="#0a3a42" stroke-width="6" opacity=".35"/>
    <ellipse cx="40" cy="34" rx="13" ry="8" fill="#fff" opacity=".45"/>
    <path d="M50 8 L58 18 L50 14 L42 18 Z" fill="#b8f4ef"/>
    <path d="M50 92 L58 82 L50 86 L42 82 Z" fill="#b8f4ef"/>
    <path d="M8 50 L18 42 L14 50 L18 58 Z" fill="#b8f4ef"/>
    <path d="M92 50 L82 42 L86 50 L82 58 Z" fill="#b8f4ef"/>`);
  }
  function costOrb(color) {
    return s(52, 52, `
    <defs>${rgrad('co' + (color || 'd'), color === 'x' ? '#c0a0ff' : '#7ff5ee', color === 'x' ? '#3a1a6a' : '#0d4a54', .38, .3)}</defs>
    <circle cx="26" cy="26" r="21" fill="url(#co${color || 'd'})" stroke="#e8dcc0" stroke-width="2"/>
    <ellipse cx="20" cy="17" rx="7" ry="4.5" fill="#fff" opacity=".5"/>`);
  }
  function blockShield() {
    return s(30, 30, `
    <defs>${grad('bs', '#cfe3f7', '#7fa4cc')}</defs>
    <path d="M15 1 L28 6 V15 Q28 25 15 29 Q2 25 2 15 V6 Z" fill="url(#bs)" stroke="#20364a" stroke-width="2"/>`);
  }
  function goldCoin() {
    return s(20, 20, `<circle cx="10" cy="10" r="9" fill="#d4af58" stroke="#8a6d20" stroke-width="1.5"/>
    <circle cx="7.5" cy="7.5" r="2.5" fill="#ffe89a" opacity=".8"/>`);
  }

  function intent(type) {
    const st = 'stroke-linejoin="round" stroke-linecap="round"';
    switch (type) {
      case 'attack': return s(40, 40, `
        <defs>${grad('ia', '#ffd8c0', '#b04a2a')}</defs>
        <path d="M31 5 L35 9 L16 30 L11 31 L9 29 L10 24 Z" fill="url(#ia)" stroke="#3a1206" stroke-width="2" ${st}/>
        <path d="M9 29 L5 35 L11 31" fill="#c0392b" stroke="#3a1206" stroke-width="1.6"/>
        <path d="M27 9 L31 13" stroke="#3a1206" stroke-width="1.6"/>`);
      case 'defend': return s(40, 40, `
        <defs>${grad('id', '#cfe3f7', '#5f86ae')}</defs>
        <path d="M20 4 L34 9 V20 Q34 32 20 37 Q6 32 6 20 V9 Z" fill="url(#id)" stroke="#1b2c3c" stroke-width="2.4"/>
        <path d="M20 11 V29 M13 20 H27" stroke="#1b2c3c" stroke-width="2"/>`);
      case 'buff': return s(40, 40, `
        <defs>${grad('ib', '#fff0a8', '#d09010')}</defs>
        <path d="M20 4 L32 20 H25 V34 H15 V20 H8 Z" fill="url(#ib)" stroke="#4a3200" stroke-width="2.2" ${st}/>`);
      case 'debuff': return s(40, 40, `
        <defs>${grad('idb', '#d8b0ff', '#6a2a9a')}</defs>
        <path d="M20 36 L8 20 H15 V6 H25 V20 H32 Z" fill="url(#idb)" stroke="#2a0a44" stroke-width="2.2" ${st}/>`);
      case 'attackDebuff': return s(52, 40, `
        <defs>${grad('ia2', '#ffd8c0', '#b04a2a')}${grad('idb2', '#d8b0ff', '#6a2a9a')}</defs>
        <path d="M26 5 L30 9 L11 30 L6 31 L4 29 L5 24 Z" fill="url(#ia2)" stroke="#3a1206" stroke-width="2" ${st}/>
        <path d="M4 29 L0 35 L6 31" fill="#c0392b" stroke="#3a1206" stroke-width="1.5"/>
        <path d="M40 37 L30 24 H36 V12 H44 V24 H50 Z" fill="url(#idb2)" stroke="#2a0a44" stroke-width="2" ${st}/>`);
      case 'attackBuff': return s(52, 40, `
        <defs>${grad('ia3', '#ffd8c0', '#b04a2a')}${grad('ib3', '#fff0a8', '#d09010')}</defs>
        <path d="M26 5 L30 9 L11 30 L6 31 L4 29 L5 24 Z" fill="url(#ia3)" stroke="#3a1206" stroke-width="2" ${st}/>
        <path d="M4 29 L0 35 L6 31" fill="#c0392b" stroke="#3a1206" stroke-width="1.5"/>
        <path d="M40 12 L50 25 H44 V37 H36 V25 H30 Z" fill="url(#ib3)" stroke="#4a3200" stroke-width="2" ${st}/>`);
      case 'attackDefend': return s(52, 40, `
        <defs>${grad('ia4', '#ffd8c0', '#b04a2a')}${grad('id4', '#cfe3f7', '#5f86ae')}</defs>
        <path d="M26 5 L30 9 L11 30 L6 31 L4 29 L5 24 Z" fill="url(#ia4)" stroke="#3a1206" stroke-width="2" ${st}/>
        <path d="M4 29 L0 35 L6 31" fill="#c0392b" stroke="#3a1206" stroke-width="1.5"/>
        <path d="M40 10 L50 14 V23 Q50 32 40 36 Q30 32 30 23 V14 Z" fill="url(#id4)" stroke="#1b2c3c" stroke-width="2"/>`);
      case 'sleep': return s(40, 40, `
        <text x="4" y="30" font-size="20" fill="#9fc4d4" font-family="serif">z</text>
        <text x="18" y="20" font-size="15" fill="#9fc4d4" font-family="serif">z</text>
        <text x="28" y="12" font-size="11" fill="#9fc4d4" font-family="serif">z</text>`);
      case 'stun': return s(40, 40, `
        <circle cx="20" cy="22" r="12" fill="none" stroke="#ffd76b" stroke-width="2.4"/>
        <path d="M20 6 L23 14 L31 14 L25 19 L27 27 L20 22 L13 27 L15 19 L9 14 L17 14 Z" fill="#ffd76b"/>`);
      case 'escape': return s(40, 40, `
        <path d="M8 32 L18 18 L14 12 L24 8" stroke="#e8dcc0" stroke-width="3" fill="none" ${st}/>
        <circle cx="26" cy="8" r="4" fill="#e8dcc0"/>
        <path d="M18 18 L30 24 M18 18 L12 30" stroke="#e8dcc0" stroke-width="3" ${st}/>
        <path d="M32 12 L38 8 M32 20 L38 18" stroke="#8d8271" stroke-width="2"/>`);
      default: return s(40, 40, `
        <circle cx="20" cy="20" r="15" fill="none" stroke="#cbbf9f" stroke-width="2.5"/>
        <text x="20" y="28" font-size="21" fill="#cbbf9f" text-anchor="middle" font-family="serif" font-weight="bold">?</text>`);
    }
  }

  function powerIcon(id, kind) {
    const ringA = kind === 'debuff' ? '#7a3ab0' : '#3f7a3a';
    const ringB = kind === 'debuff' ? '#2a0e44' : '#12300f';
    const base = `<defs>${rgrad('pw' + id, ringA, ringB, .4, .3)}</defs>
      <circle cx="16" cy="16" r="15" fill="url(#pw${id})" stroke="${kind === 'debuff' ? '#c090ff' : '#a8d888'}" stroke-width="1.5"/>`;
    const G = {
      strength: `<path d="M9 21 Q8 12 13 10 L13 8 Q16 5 19 8 L19 10 Q24 12 23 21 Q16 25 9 21Z" fill="#ffd0a0"/>
                 <path d="M11 14 Q16 17 21 14" stroke="#8a4a20" stroke-width="1.4" fill="none"/>`,
      dexterity: `<path d="M7 22 L16 6 L25 22 Z" fill="none" stroke="#a8f0d0" stroke-width="2.4"/>
                  <path d="M16 11 L16 22" stroke="#a8f0d0" stroke-width="1.6"/>`,
      vulnerable: `<path d="M16 6 L26 12 L26 22 L16 27 L6 22 L6 12 Z" fill="none" stroke="#ff9ac0" stroke-width="2.2"/>
                   <path d="M11 12 L21 22 M21 12 L11 22" stroke="#ff9ac0" stroke-width="2.2"/>`,
      weak: `<path d="M8 12 Q16 20 24 12" stroke="#c8b0ff" stroke-width="2.6" fill="none"/>
             <path d="M8 20 Q16 26 24 20" stroke="#c8b0ff" stroke-width="2.2" fill="none" opacity=".7"/>`,
      frail: `<path d="M16 5 L27 10 V19 Q27 26 16 29 Q5 26 5 19 V10 Z" fill="none" stroke="#d8c0ff" stroke-width="2.2"/>
              <path d="M13 8 L18 17 L12 20 L18 27" stroke="#d8c0ff" stroke-width="1.8" fill="none"/>`,
      poison: `<path d="M16 6 Q24 14 24 20 Q24 27 16 27 Q8 27 8 20 Q8 14 16 6Z" fill="#8ad84a"/>
               <circle cx="13" cy="19" r="2" fill="#1a3a08"/><circle cx="19" cy="19" r="2" fill="#1a3a08"/>
               <path d="M13 24 Q16 22 19 24" stroke="#1a3a08" stroke-width="1.4" fill="none"/>`,
      ritual: `<circle cx="16" cy="16" r="8" fill="none" stroke="#ffd76b" stroke-width="2"/>
               <path d="M16 4 L16 9 M16 23 L16 28 M4 16 L9 16 M23 16 L28 16" stroke="#ffd76b" stroke-width="2"/>
               <circle cx="16" cy="16" r="3" fill="#ffd76b"/>`,
      thorns: `<path d="M16 4 L20 14 L30 16 L20 18 L16 28 L12 18 L2 16 L12 14 Z" fill="#cfe3f7"/>`,
      metallicize: `<rect x="7" y="9" width="18" height="14" rx="3" fill="#b0bcc8"/>
               <path d="M7 14 H25 M16 9 V23" stroke="#5a6672" stroke-width="1.6"/>`,
      plated: `<path d="M16 5 L27 10 V19 Q27 26 16 29 Q5 26 5 19 V10 Z" fill="#c8b880" stroke="#6a5a20" stroke-width="1.6"/>`,
      barricade: `<rect x="5" y="12" width="22" height="12" rx="2" fill="#a0aab6"/>
               <path d="M9 12 V24 M16 12 V24 M23 12 V24" stroke="#5a6672" stroke-width="1.6"/>
               <path d="M5 9 H27" stroke="#e0e8f0" stroke-width="2.5"/>`,
      demon: `<path d="M8 26 Q6 12 16 8 Q26 12 24 26 Z" fill="#c0392b"/>
              <path d="M8 12 Q4 4 12 6 M24 12 Q28 4 20 6" stroke="#c0392b" stroke-width="2.6" fill="none"/>
              <circle cx="12" cy="18" r="2" fill="#ffd76b"/><circle cx="20" cy="18" r="2" fill="#ffd76b"/>`,
      flame: `<path d="M16 4 Q22 12 20 18 Q24 16 23 22 Q22 28 16 28 Q10 28 9 22 Q8 16 12 18 Q10 12 16 4Z" fill="#ff8a30"/>
              <path d="M16 14 Q19 19 17 24 Q15 25 14 22 Q13 18 16 14Z" fill="#ffe08a"/>`,
      block2: `<path d="M16 4 L28 9 V19 Q28 27 16 30 Q4 27 4 19 V9 Z" fill="#8fb3d9"/>`,
      draw: `<rect x="8" y="7" width="12" height="17" rx="2" fill="#e8dcc0" transform="rotate(-10 14 15)"/>
             <rect x="13" y="9" width="12" height="17" rx="2" fill="#fff8e0" stroke="#a89a78"/>`,
      energyP: `<circle cx="16" cy="16" r="9" fill="#3fd0c9"/>
                <path d="M16 4 L20 10 L16 8 L12 10Z" fill="#b8f4ef"/>`,
      heart: `<path d="M16 27 Q4 18 4 12 Q4 6 10 6 Q14 6 16 10 Q18 6 22 6 Q28 6 28 12 Q28 18 16 27Z" fill="#e05a4a"/>`,
      eye: `<path d="M3 16 Q16 6 29 16 Q16 26 3 16Z" fill="#e8dcc0"/>
            <circle cx="16" cy="16" r="5" fill="#2a1c44"/>`,
      noDraw: `<rect x="10" y="8" width="12" height="16" rx="2" fill="#8d8271"/>
               <path d="M6 6 L26 26" stroke="#ff5a4a" stroke-width="3"/>`,
      artifact: `<path d="M16 4 L26 10 V22 L16 28 L6 22 V10 Z" fill="none" stroke="#ffe08a" stroke-width="2.4"/>
                 <path d="M16 10 L21 13 V19 L16 22 L11 19 V13 Z" fill="#ffe08a"/>`,
      intangible: `<circle cx="16" cy="16" r="10" fill="#c8e0ff" opacity=".45" stroke="#e8f4ff" stroke-width="2"/>`,
      regen: `<path d="M24 16 A8 8 0 1 1 16 8" fill="none" stroke="#8ae08a" stroke-width="2.6"/>
              <path d="M16 4 L20 8 L16 12Z" fill="#8ae08a"/>
              <path d="M14 20 H18 M16 18 V22" stroke="#8ae08a" stroke-width="2"/>`,
      entangle: `<path d="M6 10 Q16 18 26 10 M6 16 Q16 24 26 16 M6 22 Q16 30 26 22" stroke="#8a6a3a" stroke-width="2.4" fill="none"/>`,
      curl: `<path d="M24 20 Q24 8 14 8 Q6 8 6 15 Q6 21 12 21 Q16 21 16 17" fill="none" stroke="#cfe3f7" stroke-width="2.6"/>`,
      mode: `<path d="M8 12 H24 L20 8 M24 20 H8 L12 24" stroke="#ffd76b" stroke-width="2.4" fill="none"/>`,
      shard: `<path d="M16 3 L22 12 L28 16 L20 20 L16 29 L12 20 L4 16 L10 12Z" fill="#ffcf8a"/>`,
      juggernaut: `<circle cx="16" cy="16" r="9" fill="none" stroke="#ffb050" stroke-width="2.6"/>
                   <path d="M16 7 V25 M7 16 H25" stroke="#ffb050" stroke-width="2.2"/>`,
      lock: `<rect x="9" y="15" width="14" height="11" rx="2" fill="#c8b880"/>
             <path d="M12 15 V11 Q16 6 20 11 V15" stroke="#c8b880" stroke-width="2.4" fill="none"/>`
    };
    const glyphMap = {
      strength: 'strength', dexterity: 'dexterity', vulnerable: 'vulnerable', weak: 'weak',
      frail: 'frail', poison: 'poison', ritual: 'ritual', thorns: 'thorns', sharpHide: 'thorns',
      metallicize: 'metallicize', platedArmor: 'plated', barricade: 'barricade',
      demonForm: 'demon', combust: 'flame', fireBreathing: 'flame', flameBarrier: 'flame',
      inflame: 'strength', feelNoPain: 'block2', darkEmbrace: 'draw', evolve: 'draw',
      rage: 'block2', juggernaut: 'juggernaut', rupture: 'heart', brutality: 'heart',
      berserk: 'energyP', corruption: 'demon', doubleTap: 'shard', noDraw: 'noDraw',
      artifact: 'artifact', intangible: 'intangible', regen: 'regen', entangled: 'entangle',
      curlUp: 'curl', angry: 'strength', modeShift: 'mode', sporeCloud: 'poison',
      enrage: 'strength', buffer: 'block2', asleep: 'lock', ritualDagger: 'shard',
      strengthDown: 'strength', dexterityDown: 'dexterity', flight: 'intangible'
    };
    return s(32, 32, base + (G[glyphMap[id]] || G.eye));
  }

  function mapNode(type) {
    const ring = (c) => `<circle cx="30" cy="30" r="27" fill="#100d16" stroke="${c}" stroke-width="2.5"/>`;
    switch (type) {
      case 'monster': return s(60, 60, ring('#a04a3a') + `
        <path d="M18 22 Q30 12 42 22 Q44 36 30 46 Q16 36 18 22Z" fill="#d8cdb4"/>
        <circle cx="24" cy="28" r="4" fill="#100d16"/><circle cx="36" cy="28" r="4" fill="#100d16"/>
        <path d="M23 38 L26 44 L29 38 L32 44 L35 38" fill="none" stroke="#100d16" stroke-width="2"/>`);
      case 'elite': return s(60, 60, ring('#c0392b') + `
        <path d="M18 24 Q30 13 42 24 Q44 37 30 47 Q16 37 18 24Z" fill="#e8dcc0"/>
        <circle cx="24" cy="30" r="4.5" fill="#c0392b"/><circle cx="36" cy="30" r="4.5" fill="#c0392b"/>
        <path d="M23 39 L26 45 L29 39 L32 45 L35 39" fill="none" stroke="#3a1206" stroke-width="2"/>
        <path d="M18 22 Q10 10 20 8 Q22 16 24 20Z" fill="#c0392b"/>
        <path d="M42 22 Q50 10 40 8 Q38 16 36 20Z" fill="#c0392b"/>
        <path d="M30 6 L33 12 L27 12Z" fill="#ffd76b"/>`);
      case 'rest': return s(60, 60, ring('#c9814a') + `
        <path d="M14 44 L46 44" stroke="#6a4a28" stroke-width="3"/>
        <path d="M18 44 L34 24 M42 44 L26 24" stroke="#6a4a28" stroke-width="4"/>
        <path d="M30 14 Q38 24 34 32 Q40 30 38 38 Q36 44 30 44 Q24 44 22 38 Q20 30 26 32 Q22 24 30 14Z" fill="#ff9a3a"/>
        <path d="M30 26 Q34 33 31 39 Q28 40 27 36 Q26 31 30 26Z" fill="#ffe08a"/>`);
      case 'shop': return s(60, 60, ring('#3aa08a') + `
        <path d="M14 26 L46 26 L44 46 L16 46 Z" fill="#d8cdb4"/>
        <path d="M14 26 L18 16 L42 16 L46 26" fill="#3aa08a"/>
        <path d="M22 26 Q22 18 30 18 Q38 18 38 26" fill="none" stroke="#6a5a30" stroke-width="2.5"/>
        <circle cx="30" cy="36" r="5" fill="#d4af58"/>`);
      case 'treasure': return s(60, 60, ring('#d4af58') + `
        <rect x="14" y="28" width="32" height="18" rx="2" fill="#8a6438"/>
        <path d="M14 28 Q14 16 30 16 Q46 16 46 28 Z" fill="#a87a48"/>
        <path d="M14 32 H46" stroke="#5a3a1a" stroke-width="2.5"/>
        <rect x="26" y="28" width="8" height="12" rx="2" fill="#d4af58"/>
        <circle cx="30" cy="34" r="2" fill="#3a2a10"/>`);
      case 'event': return s(60, 60, ring('#8a7ac0') + `
        <text x="30" y="43" font-size="34" fill="#e0d4f0" text-anchor="middle" font-family="serif" font-weight="bold">?</text>`);
      case 'boss': return s(72, 72, `<circle cx="36" cy="36" r="33" fill="#150d14" stroke="#c0392b" stroke-width="3.5"/>
        <path d="M18 30 Q36 12 54 30 Q56 48 36 60 Q16 48 18 30Z" fill="#e8dcc0"/>
        <circle cx="28" cy="34" r="6" fill="#c0392b"/><circle cx="44" cy="34" r="6" fill="#c0392b"/>
        <circle cx="28" cy="34" r="2.5" fill="#ffd76b"/><circle cx="44" cy="34" r="2.5" fill="#ffd76b"/>
        <path d="M27 46 L31 56 L36 46 L41 56 L45 46" fill="none" stroke="#3a1206" stroke-width="2.5"/>
        <path d="M18 26 Q4 8 20 4 Q24 16 26 24Z" fill="#c0392b"/>
        <path d="M54 26 Q68 8 52 4 Q48 16 46 24Z" fill="#c0392b"/>`);
      default: return s(60, 60, ring('#8d8271'));
    }
  }

  /* ============================================================
     四、卡牌
     ============================================================ */
  const TYPE_COLOR = {
    attack: ['#c05a34', '#7a2a14', '#f0a070'],
    skill: ['#4a86b0', '#1e3f5c', '#8ac0e0'],
    power: ['#8a5ac0', '#3a1f66', '#c0a0f0'],
    status: ['#6a7280', '#2a2e36', '#a0a8b4'],
    curse: ['#6a3a72', '#2a1030', '#c090d0']
  };
  const RARITY_GEM = { basic: '#8d8271', common: '#c8c0b0', uncommon: '#6ab0e0', rare: '#ffd76b', special: '#c090d0' };

  function cardFrame(type, rarity, upgraded) {
    const c = TYPE_COLOR[type] || TYPE_COLOR.skill;
    const gem = RARITY_GEM[rarity] || RARITY_GEM.common;
    const bc = upgraded ? '#7fe07f' : c[2];
    return s(190, 264, `
    <defs>
      ${grad('cf' + type, '#241d2e', '#100c16')}
      ${grad('cn' + type, c[0], c[1])}
    </defs>
    <rect x="3" y="3" width="184" height="258" rx="13" fill="url(#cf${type})" stroke="${bc}" stroke-width="3"/>
    <rect x="8" y="8" width="174" height="248" rx="10" fill="none" stroke="${c[1]}" stroke-width="1.5" opacity=".9"/>
    <rect x="15" y="22" width="160" height="104" rx="5" fill="#0b0810" stroke="${c[1]}" stroke-width="2"/>
    <path d="M12 120 L178 120 L172 148 L18 148 Z" fill="url(#cn${type})" opacity=".92"/>
    <path d="M12 120 L178 120" stroke="${c[2]}" stroke-width="1.5" opacity=".8"/>
    <path d="M18 148 L172 148" stroke="#0b0810" stroke-width="1.5" opacity=".6"/>
    <rect x="16" y="162" width="158" height="88" rx="6" fill="#0d0a14" opacity=".72"/>
    <path d="M95 250 L103 256 L95 262 L87 256 Z" fill="${gem}" stroke="#0b0810" stroke-width="1"/>
    <path d="M22 118 L34 112 L46 118" fill="none" stroke="${c[2]}" stroke-width="1.5" opacity=".55"/>
    <path d="M168 118 L156 112 L144 118" fill="none" stroke="${c[2]}" stroke-width="1.5" opacity=".55"/>`);
  }

  const MOTIF = {
    slash: (c) => `<path d="M14 78 Q60 18 148 12" stroke="${c}" stroke-width="9" fill="none" opacity=".95" stroke-linecap="round"/>
      <path d="M22 92 Q70 34 152 26" stroke="#fff" stroke-width="3" fill="none" opacity=".6"/>`,
    doubleSlash: (c) => `<path d="M10 76 Q56 20 140 10" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M18 96 Q70 40 152 30" stroke="${c}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M14 82 Q60 26 144 16" stroke="#fff" stroke-width="2" fill="none" opacity=".5"/>`,
    fan: (c) => `${[0, 1, 2].map(i => `<path d="M12 ${30 + i * 26} Q80 ${8 + i * 24} 156 ${20 + i * 26}" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round" opacity="${1 - i * .18}"/>`).join('')}`,
    sword: (c) => `<g transform="rotate(-38 80 52)"><rect x="72" y="4" width="16" height="76" rx="3" fill="#dfe6ee"/>
      <path d="M72 4 L88 4 L80 -8 Z" fill="#fff"/><rect x="56" y="80" width="48" height="10" rx="3" fill="${c}"/>
      <rect x="74" y="90" width="12" height="22" rx="3" fill="#4a2f18"/></g>`,
    swordCross: (c) => `<g transform="rotate(38 80 52)"><rect x="74" y="8" width="12" height="72" rx="3" fill="#dfe6ee"/>
      <rect x="60" y="80" width="40" height="9" rx="3" fill="${c}"/></g>
      <g transform="rotate(-38 80 52)"><rect x="74" y="8" width="12" height="72" rx="3" fill="#c8d2dc"/>
      <rect x="60" y="80" width="40" height="9" rx="3" fill="${c}"/></g>`,
    fist: (c) => `<path d="M40 88 Q34 44 62 34 L62 26 Q80 12 98 26 L98 34 Q126 44 120 88 Q80 102 40 88Z" fill="#e8b48a"/>
      <path d="M50 54 Q80 66 110 54" stroke="#a06a3a" stroke-width="4" fill="none"/>
      <path d="M46 70 Q80 82 114 70" stroke="#a06a3a" stroke-width="4" fill="none"/>
      <path d="M30 92 Q80 106 130 92" stroke="${c}" stroke-width="7" fill="none" opacity=".8"/>`,
    hammer: (c) => `<g transform="rotate(-20 80 52)"><rect x="70" y="34" width="14" height="72" rx="4" fill="#6a4a28"/>
      <rect x="38" y="12" width="80" height="34" rx="6" fill="#9aa6b2" stroke="${c}" stroke-width="3"/>
      <path d="M56 12 L56 46 M100 12 L100 46" stroke="#5a6672" stroke-width="2.5"/></g>`,
    shield: (c) => `<path d="M80 8 L136 26 V62 Q136 96 80 112 Q24 96 24 62 V26 Z" fill="#8fb3d9" stroke="#20364a" stroke-width="4"/>
      <path d="M80 22 L124 36 V62 Q124 86 80 98 Q36 86 36 62 V36 Z" fill="none" stroke="${c}" stroke-width="3"/>
      <path d="M80 34 V82 M58 58 H102" stroke="#20364a" stroke-width="5"/>`,
    shieldGlow: (c) => `<circle cx="80" cy="58" r="52" fill="${c}" opacity=".18"/>
      <path d="M80 10 L132 28 V62 Q132 94 80 110 Q28 94 28 62 V28 Z" fill="#a8cdf0" stroke="#20364a" stroke-width="4"/>
      <path d="M52 56 L74 78 L112 36" stroke="#20364a" stroke-width="7" fill="none" stroke-linecap="round"/>`,
    wall: (c) => `<rect x="16" y="30" width="128" height="76" rx="4" fill="#8a949e"/>
      <path d="M16 54 H144 M16 78 H144 M52 30 V54 M104 30 V54 M32 54 V78 M80 54 V78 M128 54 V78 M52 78 V106 M104 78 V106" stroke="#5a646e" stroke-width="3"/>
      <path d="M16 26 H144" stroke="${c}" stroke-width="6"/>`,
    flame: (c) => `<path d="M80 6 Q112 42 96 70 Q120 60 114 92 Q108 116 80 116 Q52 116 46 92 Q40 60 64 70 Q48 42 80 6Z" fill="#ff8a30"/>
      <path d="M80 44 Q96 68 86 92 Q80 100 74 92 Q64 68 80 44Z" fill="#ffe08a"/>
      <circle cx="80" cy="60" r="52" fill="${c}" opacity=".12"/>`,
    flameRing: (c) => `<circle cx="80" cy="58" r="46" fill="none" stroke="#ff8a30" stroke-width="9" opacity=".85"/>
      ${[0, 1, 2, 3, 4, 5].map(i => { const a = i * 60 * Math.PI / 180; const x = 80 + Math.cos(a) * 46, y = 58 + Math.sin(a) * 46; return `<path d="M${x.toFixed(1)} ${(y - 16).toFixed(1)} Q${(x + 10).toFixed(1)} ${(y - 2).toFixed(1)} ${x.toFixed(1)} ${(y + 10).toFixed(1)} Q${(x - 10).toFixed(1)} ${(y - 2).toFixed(1)} ${x.toFixed(1)} ${(y - 16).toFixed(1)}Z" fill="${c}"/>`; }).join('')}`,
    blood: (c) => `<path d="M80 8 Q118 56 118 78 Q118 106 80 106 Q42 106 42 78 Q42 56 80 8Z" fill="#b02a1a"/>
      <path d="M64 70 Q72 56 80 70" stroke="#ff8a7a" stroke-width="4" fill="none" opacity=".8"/>
      <circle cx="34" cy="96" r="9" fill="#8a1a0e"/><circle cx="128" cy="88" r="7" fill="#8a1a0e"/>`,
    skull: (c) => `<path d="M32 46 Q80 8 128 46 Q132 84 80 108 Q28 84 32 46Z" fill="#e8dcc0"/>
      <ellipse cx="60" cy="56" rx="13" ry="15" fill="#1a1216"/><ellipse cx="100" cy="56" rx="13" ry="15" fill="#1a1216"/>
      <path d="M72 78 L80 92 L88 78Z" fill="#1a1216"/>
      <path d="M62 100 L66 112 L72 100 L78 112 L84 100 L90 112 L96 100" fill="none" stroke="#1a1216" stroke-width="3"/>`,
    demon: (c) => `<path d="M42 108 Q34 52 80 34 Q126 52 118 108 Z" fill="#8a1a0e"/>
      <path d="M42 50 Q22 12 50 20 Q56 38 60 46Z" fill="#b02a1a"/>
      <path d="M118 50 Q138 12 110 20 Q104 38 100 46Z" fill="#b02a1a"/>
      <ellipse cx="64" cy="66" rx="9" ry="7" fill="#ffd76b"/><ellipse cx="96" cy="66" rx="9" ry="7" fill="#ffd76b"/>
      <path d="M62 88 Q80 104 98 88 Q80 96 62 88Z" fill="#2a0a06"/>
      <path d="M66 90 L70 100 L75 90 M86 90 L90 100 L95 90" fill="#fff"/>`,
    heart: (c) => `<path d="M80 108 Q26 72 26 44 Q26 18 50 18 Q70 18 80 38 Q90 18 110 18 Q134 18 134 44 Q134 72 80 108Z" fill="#c0392b"/>
      <path d="M56 34 Q46 44 48 58" stroke="#ff9a8a" stroke-width="4" fill="none" opacity=".8"/>`,
    lightning: (c) => `<path d="M92 4 L44 62 L74 62 L58 114 L120 48 L86 48 Z" fill="#ffe86b" stroke="#c09a10" stroke-width="3"/>
      <circle cx="80" cy="58" r="54" fill="${c}" opacity=".12"/>`,
    wind: (c) => `${[0, 1, 2, 3].map(i => `<path d="M${18 + i * 6} ${24 + i * 22} Q80 ${8 + i * 24} ${146 - i * 4} ${30 + i * 20}" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" opacity="${.9 - i * .15}"/>`).join('')}
      <circle cx="126" cy="46" r="16" fill="none" stroke="${c}" stroke-width="5"/>`,
    boomerang: (c) => `<path d="M30 100 Q30 20 110 20 Q66 34 62 74 Q88 66 110 76 Q60 84 30 100Z" fill="#c8a068" stroke="#6a4a28" stroke-width="3"/>
      <path d="M118 96 Q140 84 138 60" stroke="${c}" stroke-width="4" fill="none" stroke-dasharray="6 5"/>`,
    spikes: (c) => `${[0, 1, 2, 3, 4].map(i => `<path d="M${20 + i * 30} 108 L${34 + i * 30} 20 L${48 + i * 30} 108Z" fill="#cfe3f7" stroke="${c}" stroke-width="2.5"/>`).join('')}`,
    orb: (c) => `<circle cx="80" cy="58" r="42" fill="${c}" opacity=".85"/>
      <circle cx="80" cy="58" r="42" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/>
      <ellipse cx="64" cy="40" rx="16" ry="10" fill="#fff" opacity=".4"/>
      <circle cx="80" cy="58" r="14" fill="#fff" opacity=".5"/>`,
    bomb: (c) => `<circle cx="78" cy="72" r="36" fill="#2a2a32"/>
      <rect x="68" y="30" width="20" height="14" rx="3" fill="#5a5a66"/>
      <path d="M86 30 Q108 14 116 26" stroke="#c8a068" stroke-width="4" fill="none"/>
      <path d="M116 26 Q126 10 132 22 Q126 30 116 26Z" fill="${c}"/>
      <ellipse cx="64" cy="58" rx="12" ry="8" fill="#fff" opacity=".25"/>`,
    muscle: (c) => `<path d="M28 96 Q22 52 56 42 Q68 22 92 30 Q126 40 132 82 Q120 104 80 104 Q46 104 28 96Z" fill="#e8b48a"/>
      <path d="M56 56 Q84 70 116 58" stroke="#a06a3a" stroke-width="4.5" fill="none"/>
      <path d="M44 78 Q80 92 122 78" stroke="#a06a3a" stroke-width="4" fill="none"/>
      <path d="M80 6 L88 24 L104 20 L94 34" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
    chain: (c) => `${[0, 1, 2, 3].map(i => `<ellipse cx="${34 + i * 32}" cy="${34 + (i % 2) * 42}" rx="17" ry="12" fill="none" stroke="${c}" stroke-width="7"/>`).join('')}`,
    eye: (c) => `<path d="M10 58 Q80 8 150 58 Q80 108 10 58Z" fill="#e8dcc0"/>
      <circle cx="80" cy="58" r="26" fill="${c}"/><circle cx="80" cy="58" r="12" fill="#100c16"/>
      <circle cx="70" cy="46" r="6" fill="#fff" opacity=".8"/>`,
    hourglass: (c) => `<path d="M40 12 H120 L84 58 L120 104 H40 L76 58 Z" fill="#c8a068" stroke="#6a4a28" stroke-width="3"/>
      <rect x="32" y="6" width="96" height="9" rx="3" fill="#8a6438"/>
      <rect x="32" y="101" width="96" height="9" rx="3" fill="#8a6438"/>
      <path d="M60 30 H100 L82 52 Z" fill="${c}"/>`,
    book: (c) => `<path d="M22 22 Q56 12 78 22 L78 100 Q56 92 22 100Z" fill="#8a6438"/>
      <path d="M138 22 Q104 12 82 22 L82 100 Q104 92 138 100Z" fill="#a87a48"/>
      <path d="M78 22 L82 22 L82 100 L78 100Z" fill="#5a3a1a"/>
      <path d="M34 40 H68 M34 54 H68 M92 40 H126 M92 54 H126" stroke="${c}" stroke-width="3" opacity=".8"/>`,
    crown: (c) => `<path d="M26 94 L20 34 L50 58 L80 20 L110 58 L140 34 L134 94Z" fill="#d4af58" stroke="#8a6d20" stroke-width="3"/>
      <circle cx="80" cy="54" r="8" fill="${c}"/><circle cx="44" cy="72" r="6" fill="${c}"/><circle cx="116" cy="72" r="6" fill="${c}"/>`,
    gear: (c) => `<circle cx="80" cy="58" r="30" fill="none" stroke="${c}" stroke-width="12"/>
      ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * 45 * Math.PI / 180; const cx = 80 + Math.cos(a) * 42, cy = 58 + Math.sin(a) * 42; return `<rect x="${(cx - 7).toFixed(1)}" y="${(cy - 7).toFixed(1)}" width="14" height="14" rx="3" fill="${c}" transform="rotate(${i * 45} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`; }).join('')}
      <circle cx="80" cy="58" r="10" fill="#100c16"/>`,
    potionArt: (c) => `<path d="M64 16 H96 V34 L116 74 Q116 106 80 106 Q44 106 44 74 L64 34Z" fill="#cfe3f7" opacity=".35" stroke="#e8f0f8" stroke-width="3"/>
      <path d="M52 70 Q80 62 108 70 Q112 100 80 100 Q48 100 52 70Z" fill="${c}"/>
      <rect x="60" y="8" width="40" height="12" rx="4" fill="#8a6438"/>`,
    scroll: (c) => `<rect x="30" y="20" width="100" height="78" rx="6" fill="#e8dcc0"/>
      <path d="M44 40 H116 M44 56 H116 M44 72 H96" stroke="${c}" stroke-width="4"/>
      <rect x="24" y="14" width="112" height="10" rx="5" fill="#8a6438"/>
      <rect x="24" y="94" width="112" height="10" rx="5" fill="#8a6438"/>`,
    star: (c) => `<path d="M80 6 L96 44 L138 48 L106 74 L116 114 L80 92 L44 114 L54 74 L22 48 L64 44Z" fill="${c}" stroke="#fff" stroke-width="2" opacity=".95"/>`
  };
  function cardArt(motif, color) {
    const fn = MOTIF[motif] || MOTIF.slash;
    return s(160, 116, `<rect width="160" height="116" fill="#0b0810"/>
      <ellipse cx="80" cy="70" rx="86" ry="50" fill="${color}" opacity=".14"/>` + fn(color));
  }

  /* ============================================================
     五、遗物 / 药水
     ============================================================ */
  const RELIC_SHAPE = {
    orb: (c) => `<circle cx="32" cy="34" r="20" fill="${c}" stroke="#e8dcc0" stroke-width="2"/>
      <ellipse cx="25" cy="26" rx="7" ry="4" fill="#fff" opacity=".5"/>`,
    ring: (c) => `<circle cx="32" cy="36" r="17" fill="none" stroke="${c}" stroke-width="6"/>
      <path d="M32 8 L38 20 L26 20Z" fill="${c}"/>`,
    flask: (c) => `<path d="M26 10 H38 V22 L48 46 Q48 58 32 58 Q16 58 16 46 L26 22Z" fill="#cfe3f7" opacity=".4" stroke="#e8f0f8" stroke-width="2"/>
      <path d="M20 42 Q32 36 44 42 Q46 54 32 54 Q18 54 20 42Z" fill="${c}"/>`,
    bone: (c) => `<rect x="18" y="28" width="28" height="10" rx="5" fill="#e8dcc0"/>
      <circle cx="16" cy="27" r="7" fill="#e8dcc0"/><circle cx="16" cy="39" r="7" fill="#e8dcc0"/>
      <circle cx="48" cy="27" r="7" fill="#e8dcc0"/><circle cx="48" cy="39" r="7" fill="#e8dcc0"/>
      <path d="M22 30 Q32 26 42 32" stroke="${c}" stroke-width="3" fill="none"/>`,
    mask: (c) => `<path d="M14 20 Q32 8 50 20 Q52 46 32 58 Q12 46 14 20Z" fill="${c}"/>
      <ellipse cx="24" cy="30" rx="5" ry="4" fill="#100c16"/><ellipse cx="40" cy="30" rx="5" ry="4" fill="#100c16"/>
      <path d="M24 44 Q32 50 40 44" stroke="#100c16" stroke-width="2.5" fill="none"/>`,
    statue: (c) => `<path d="M22 58 L26 26 Q32 18 38 26 L42 58Z" fill="${c}"/>
      <circle cx="32" cy="18" r="9" fill="${c}"/>
      <rect x="16" y="56" width="32" height="6" rx="2" fill="#6a5a30"/>`,
    feather: (c) => `<path d="M48 10 Q22 22 16 52 Q34 50 44 34 Q52 22 48 10Z" fill="${c}"/>
      <path d="M46 14 L18 50" stroke="#fff" stroke-width="2" opacity=".6"/>`,
    blade: (c) => `<path d="M36 6 L44 12 L22 50 L14 52 L12 44Z" fill="#dfe6ee" stroke="#5a616b" stroke-width="1.5"/>
      <rect x="10" y="48" width="14" height="8" rx="3" fill="${c}" transform="rotate(-38 17 52)"/>`,
    book: (c) => `<path d="M12 14 Q32 6 32 14 L32 54 Q32 46 12 54Z" fill="${c}"/>
      <path d="M52 14 Q32 6 32 14 L32 54 Q32 46 52 54Z" fill="#a87a48"/>
      <path d="M30 12 H34 V56 H30Z" fill="#5a3a1a"/>`,
    fish: (c) => `<path d="M10 34 Q26 16 44 34 Q26 52 10 34Z" fill="${c}"/>
      <path d="M44 34 L56 22 L54 34 L56 46Z" fill="${c}"/>
      <circle cx="20" cy="31" r="3" fill="#100c16"/>`,
    flower: (c) => `${[0, 1, 2, 3, 4].map(i => { const a = (i * 72 - 90) * Math.PI / 180; const cx = 32 + Math.cos(a) * 13, cy = 28 + Math.sin(a) * 13; return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="9" ry="7" fill="${c}" transform="rotate(${i * 72} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`; }).join('')}
      <circle cx="32" cy="28" r="7" fill="#ffd76b"/>
      <path d="M32 36 Q34 50 32 60" stroke="#3f7a3a" stroke-width="3" fill="none"/>`,
    lantern: (c) => `<rect x="20" y="18" width="24" height="30" rx="4" fill="${c}"/>
      <rect x="24" y="22" width="16" height="22" rx="2" fill="#ffe08a"/>
      <rect x="16" y="14" width="32" height="6" rx="2" fill="#6a5a30"/>
      <path d="M32 14 Q32 4 40 8" stroke="#6a5a30" stroke-width="3" fill="none"/>`,
    anchor: (c) => `<circle cx="32" cy="12" r="6" fill="none" stroke="${c}" stroke-width="4"/>
      <path d="M32 18 V52" stroke="${c}" stroke-width="5"/>
      <path d="M18 26 H46" stroke="${c}" stroke-width="4"/>
      <path d="M14 40 Q18 56 32 54 Q46 56 50 40" stroke="${c}" stroke-width="5" fill="none"/>`,
    bag: (c) => `<path d="M18 26 Q32 16 46 26 L50 54 Q32 62 14 54Z" fill="${c}"/>
      <path d="M24 26 Q24 12 32 12 Q40 12 40 26" stroke="#6a5a30" stroke-width="3" fill="none"/>
      <path d="M14 38 Q32 46 50 38" stroke="#4a3a18" stroke-width="3" fill="none"/>`,
    stone: (c) => `<path d="M12 44 Q10 22 30 16 Q52 14 54 36 Q54 54 32 56 Q14 56 12 44Z" fill="${c}"/>
      <ellipse cx="24" cy="28" rx="8" ry="5" fill="#fff" opacity=".3"/>`,
    gem: (c) => `<path d="M32 6 L52 24 L32 58 L12 24Z" fill="${c}" stroke="#fff" stroke-width="1.5" opacity=".95"/>
      <path d="M12 24 H52 M32 6 L32 58" stroke="#fff" stroke-width="1" opacity=".4"/>`,
    crown: (c) => `<path d="M14 52 L10 20 L22 32 L32 12 L42 32 L54 20 L50 52Z" fill="${c}" stroke="#8a6d20" stroke-width="2"/>
      <circle cx="32" cy="30" r="4" fill="#c0392b"/>`,
    hammer: (c) => `<rect x="28" y="26" width="8" height="34" rx="3" fill="#6a4a28"/>
      <rect x="12" y="10" width="40" height="18" rx="4" fill="${c}"/>`,
    cup: (c) => `<path d="M18 14 H46 L42 34 Q32 42 22 34Z" fill="${c}"/>
      <path d="M32 42 V52 M20 54 H44" stroke="${c}" stroke-width="4"/>`,
    eye: (c) => `<path d="M8 34 Q32 14 56 34 Q32 54 8 34Z" fill="#e8dcc0"/>
      <circle cx="32" cy="34" r="11" fill="${c}"/><circle cx="32" cy="34" r="5" fill="#100c16"/>`,
    pillow: (c) => `<path d="M10 22 Q32 14 54 22 Q58 44 54 50 Q32 58 10 50 Q6 44 10 22Z" fill="${c}"/>
      <path d="M18 26 Q32 34 46 26" stroke="#fff" stroke-width="2" opacity=".4" fill="none"/>`,
    chest: (c) => `<rect x="12" y="30" width="40" height="22" rx="2" fill="#8a6438"/>
      <path d="M12 30 Q12 16 32 16 Q52 16 52 30Z" fill="${c}"/>
      <rect x="28" y="30" width="8" height="12" rx="2" fill="#d4af58"/>`,
    star: (c) => `<path d="M32 6 L39 26 L60 28 L44 41 L49 60 L32 49 L15 60 L20 41 L4 28 L25 26Z" fill="${c}"/>`,
    fan: (c) => `<path d="M32 56 Q6 34 12 14 Q32 26 52 14 Q58 34 32 56Z" fill="${c}"/>
      <path d="M32 56 L20 20 M32 56 L32 18 M32 56 L44 20" stroke="#6a5a30" stroke-width="2"/>`,
    knife: (c) => `<path d="M14 50 L44 14 L50 20 L20 56Z" fill="#dfe6ee"/>
      <rect x="8" y="44" width="14" height="9" rx="3" fill="${c}" transform="rotate(-40 15 48)"/>`,
    nunchaku: (c) => `<rect x="16" y="12" width="9" height="30" rx="3" fill="${c}"/>
      <rect x="38" y="20" width="9" height="30" rx="3" fill="${c}"/>
      <path d="M20 42 Q30 52 42 50" stroke="#c8c0b0" stroke-width="2.5" fill="none"/>`,
    dial: (c) => `<circle cx="32" cy="36" r="20" fill="${c}"/>
      <path d="M32 36 L32 20 M32 36 L44 44" stroke="#100c16" stroke-width="3"/>
      <circle cx="32" cy="36" r="3" fill="#100c16"/>`,
    egg: (c) => `<ellipse cx="32" cy="34" rx="17" ry="22" fill="${c}"/>
      <ellipse cx="26" cy="24" rx="6" ry="4" fill="#fff" opacity=".4"/>`,
    heartR: (c) => `<path d="M32 56 Q8 38 8 24 Q8 10 20 10 Q28 10 32 20 Q36 10 44 10 Q56 10 56 24 Q56 38 32 56Z" fill="${c}"/>`,
    coffee: (c) => `<path d="M14 20 H44 L42 44 Q32 52 16 44Z" fill="${c}"/>
      <path d="M44 24 Q56 28 44 38" stroke="${c}" stroke-width="4" fill="none"/>
      <path d="M22 12 Q26 6 22 2 M32 12 Q36 6 32 2" stroke="#c8c0b0" stroke-width="2" fill="none"/>`,
    pyramid: (c) => `<path d="M32 8 L58 54 H6Z" fill="${c}" stroke="#e8dcc0" stroke-width="2"/>
      <path d="M32 8 L32 54 M18 32 H46" stroke="#e8dcc0" stroke-width="1.5" opacity=".6"/>`
  };
  function relicIcon(shape, color) {
    const fn = RELIC_SHAPE[shape] || RELIC_SHAPE.orb;
    return s(64, 64, `<circle cx="32" cy="34" r="30" fill="#100c16" opacity=".55"/>` + fn(color));
  }

  function potionIcon(color, shape) {
    const body = {
      round: `<circle cx="32" cy="46" r="22" fill="#cfe3f7" opacity=".28" stroke="#e8f0f8" stroke-width="2.5"/>
              <path d="M12 48 Q32 38 52 48 Q52 66 32 66 Q12 66 12 48Z" fill="${color}"/>`,
      cone: `<path d="M24 14 H40 V26 L56 62 Q56 72 32 72 Q8 72 8 62 L24 26Z" fill="#cfe3f7" opacity=".28" stroke="#e8f0f8" stroke-width="2.5"/>
             <path d="M14 52 Q32 44 50 52 Q54 68 32 68 Q10 68 14 52Z" fill="${color}"/>`,
      tall: `<rect x="18" y="18" width="28" height="52" rx="10" fill="#cfe3f7" opacity=".28" stroke="#e8f0f8" stroke-width="2.5"/>
             <path d="M20 44 Q32 38 44 44 L44 62 Q32 68 20 62Z" fill="${color}"/>`
    };
    return s(64, 80, `${body[shape] || body.cone}
      <rect x="24" y="6" width="16" height="12" rx="4" fill="#8a6438"/>
      <rect x="21" y="4" width="22" height="6" rx="3" fill="#a87a48"/>
      <ellipse cx="24" cy="52" rx="4" ry="3" fill="#fff" opacity=".5"/>`);
  }

  /* ============================================================
     六、场景装饰
     ============================================================ */
  function campfire() {
    return s(260, 190, `
    <defs>${rgrad('cfG', '#ffb04a', 'rgba(255,140,40,0)', .5, .55)}</defs>
    <ellipse cx="130" cy="150" rx="120" ry="34" fill="url(#cfG)" opacity=".55"/>
    <ellipse cx="130" cy="160" rx="86" ry="20" fill="#2a2020"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * 45 * Math.PI / 180; return `<ellipse cx="${(130 + Math.cos(a) * 78).toFixed(1)}" cy="${(158 + Math.sin(a) * 17).toFixed(1)}" rx="15" ry="10" fill="#6a6068"/>`; }).join('')}
    <path d="M84 152 L150 108 M176 152 L110 108" stroke="#6a4a28" stroke-width="11" stroke-linecap="round"/>
    <path d="M130 34 Q170 88 148 122 Q182 108 172 152 Q160 176 130 176 Q100 176 88 152 Q78 108 112 122 Q90 88 130 34Z" fill="#ff8a30"/>
    <path d="M130 78 Q152 116 138 146 Q130 158 122 146 Q108 116 130 78Z" fill="#ffe08a"/>
    <circle cx="96" cy="60" r="4" fill="#ffb04a" opacity=".7"/>
    <circle cx="168" cy="46" r="3" fill="#ffb04a" opacity=".6"/>
    <circle cx="150" cy="22" r="2.5" fill="#ffb04a" opacity=".5"/>`);
  }
  function chestArt(size) {
    const w = size === 'large' ? 1.25 : size === 'small' ? 0.85 : 1;
    return s(240, 190, `
    <defs>${grad('chW', '#a87a48', '#6a4a28')}${rgrad('chG', '#ffe08a', 'rgba(255,224,138,0)', .5, .4)}</defs>
    <g transform="translate(120 100) scale(${w}) translate(-120 -100)">
      <ellipse cx="120" cy="176" rx="96" ry="18" fill="rgba(0,0,0,.45)"/>
      <ellipse cx="120" cy="70" rx="90" ry="60" fill="url(#chG)" opacity=".35"/>
      <rect x="34" y="86" width="172" height="82" rx="6" fill="url(#chW)" stroke="#3a2410" stroke-width="4"/>
      <path d="M34 86 Q34 30 120 30 Q206 30 206 86Z" fill="#b98a54" stroke="#3a2410" stroke-width="4"/>
      <path d="M34 96 H206" stroke="#3a2410" stroke-width="5"/>
      <rect x="56" y="30" width="14" height="138" fill="#d4af58" opacity=".85"/>
      <rect x="170" y="30" width="14" height="138" fill="#d4af58" opacity=".85"/>
      <rect x="104" y="88" width="32" height="34" rx="4" fill="#d4af58" stroke="#7a5a10" stroke-width="2"/>
      <circle cx="120" cy="106" r="5" fill="#3a2a10"/>
    </g>`);
  }
  function slashFx(color) {
    return s(150, 150, `<path d="M18 122 Q60 60 134 24" stroke="${color}" stroke-width="10" fill="none"
      stroke-linecap="round" opacity=".95"/>
      <path d="M28 132 Q72 70 142 36" stroke="#fff" stroke-width="4" fill="none" opacity=".7"/>`);
  }
  function heartIcon() {
    return s(40, 40, `<path d="M20 34 Q4 22 4 14 Q4 5 11 5 Q17 5 20 11 Q23 5 29 5 Q36 5 36 14 Q36 22 20 34Z" fill="#c0392b"/>`);
  }
  function upgradeIcon() {
    return s(40, 40, `<path d="M20 4 L34 22 H26 V34 H14 V22 H6Z" fill="#7fe07f" stroke="#1f5a1f" stroke-width="2"/>`);
  }
  function cardStackIcon() {
    return s(40, 40, `<rect x="6" y="8" width="20" height="27" rx="3" fill="#6a5a80" transform="rotate(-12 16 21)"/>
      <rect x="12" y="7" width="21" height="28" rx="3" fill="#e8dcc0" stroke="#8a7a58" stroke-width="1.5"/>
      <rect x="16" y="12" width="13" height="8" rx="2" fill="#c05a34"/>`);
  }
  function removeIcon() {
    return s(40, 40, `<rect x="10" y="7" width="21" height="27" rx="3" fill="#e8dcc0"/>
      <path d="M6 6 L34 34 M34 6 L6 34" stroke="#c0392b" stroke-width="4"/>`);
  }
  function titleArt() {
    const hero = ironclad().replace(/^<svg[^>]*>/, '<g transform="translate(52 34) scale(0.52)">').replace(/<\/svg>$/, '</g>');
    return s(210, 210, `
    <defs>${rgrad('tg', '#3a2a4a', '#0d0a12', .5, .45)}</defs>
    <circle cx="105" cy="105" r="100" fill="url(#tg)"/>
    <path d="M105 12 L150 60 L150 175 L60 175 L60 60Z" fill="#1c1826" stroke="#4a4058" stroke-width="2"/>
    <path d="M105 22 L142 66 L142 172 L68 172 L68 66Z" fill="#231d30"/>
    <path d="M78 88 H132 M78 116 H132 M78 144 H132" stroke="#3a3348" stroke-width="3" opacity=".5"/>
    ${hero}
    <circle cx="105" cy="105" r="98" fill="none" stroke="#d4af58" stroke-width="2" opacity=".5"/>`);
  }

  return {
    ironclad, portrait, enemy, energyOrb, costOrb, blockShield, goldCoin,
    intent, powerIcon, mapNode, cardFrame, cardArt, relicIcon, potionIcon,
    campfire, chestArt, slashFx, heartIcon, upgradeIcon, cardStackIcon, removeIcon, titleArt,
    TYPE_COLOR
  };
})();
