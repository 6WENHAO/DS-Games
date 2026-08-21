/**
 * 材质调色板（风格化、克制的色域）
 * 每个材质：sRGB 颜色 + 自发光强度。
 * 自发光 > 0 的材质在夜间成为城市的“毛细血管”。
 */

export const MAT = [];
export const M = {};

function def(name, hex, emissive = 0, opts = {}) {
  const id = MAT.length;
  MAT.push({
    id,
    name,
    hex,
    emissive,
    // 夜间自发光倍率（窗户夜里更亮，霓虹更炸）
    nightGain: opts.nightGain ?? (emissive > 0 ? 1.0 : 0),
    label: opts.label || name,
  });
  M[name] = id;
  return id;
}

def('AIR', 0x000000, 0);

// —— 混凝土 / 巨构的“肉身” ——
def('CONC_1', 0x9aa0a6);
def('CONC_2', 0x82888f);
def('CONC_3', 0x6c7178);
def('CONC_4', 0x585d64);
def('CONC_5', 0x474b51);
def('CONC_WARM', 0x9c9384);
def('CONC_STAIN', 0x6a6357);

// —— 钢 / 骨架 ——
def('STEEL_D', 0x35393f);
def('STEEL_M', 0x4a5058);
def('STEEL_L', 0x6f7884);
def('STEEL_BLUE', 0x3d4d61);
def('IRON_BLACK', 0x22252a);
def('ALUM', 0xb0b7bf);

// —— 锈 / 岁月 ——
def('RUST', 0x7d4a2c);
def('RUST_D', 0x572f1c);
def('COPPER_OX', 0x3f6a5c);

// —— 涂装 / 警示 ——
def('PAINT_YEL', 0xc9a227);
def('PAINT_RED', 0x8f2b25);
def('PAINT_WHITE', 0xc6cbd1);
def('PAINT_TEAL', 0x22636b);
def('PAINT_BLUE', 0x27456e);
def('PAINT_ORANGE', 0xa8552a);

// —— 玻璃 / 幕墙（不透明但深邃）——
def('GLASS_D', 0x1b262d);
def('GLASS_T', 0x24424a);
def('GLASS_B', 0x1f3348);

// —— 窗（自发光多档，制造密度感）——
def('WIN_WARM', 0xffc178, 1.15, { nightGain: 1.7 });
def('WIN_WARM_DIM', 0xd99a5a, 0.5, { nightGain: 1.5 });
def('WIN_COOL', 0xa9d8ff, 0.95, { nightGain: 1.6 });
def('WIN_PALE', 0xe8f0f6, 0.75, { nightGain: 1.5 });
def('WIN_DEAD', 0x141a1f, 0);

// —— 霓虹 / 标识 / 结构灯 ——
def('NEON_CYAN', 0x46f0ff, 2.1, { nightGain: 1.8 });
def('NEON_MAG', 0xff3f9f, 2.1, { nightGain: 1.8 });
def('NEON_AMB', 0xff9a2e, 2.0, { nightGain: 1.8 });
def('NEON_GRN', 0x6bff8f, 1.9, { nightGain: 1.8 });
def('NEON_RED', 0xff2f26, 2.3, { nightGain: 1.7 });
def('STRIP_W', 0xdfeeff, 1.5, { nightGain: 1.6 });
def('STRIP_COOL', 0x9fd6ff, 1.3, { nightGain: 1.7 });
def('LAMP_SODIUM', 0xffb14a, 1.8, { nightGain: 1.9 });

// —— 地面 / 场地 ——
def('ASPHALT', 0x2f3237);
def('ASPHALT_2', 0x393d43);
def('ROAD_LINE', 0x9a9276);
def('DECK_PANEL', 0x545a61);
def('DIRT', 0x4a4238);
def('VOID_ROCK', 0x1b1d21);

export const MAT_COUNT = MAT.length;

/** 供 shader 使用的调色板数据（线性化在 shader 里做，这里给 sRGB 0-255） */
export function paletteBytes() {
  const a = new Uint8Array(MAT_COUNT * 4);
  for (let i = 0; i < MAT_COUNT; i++) {
    const m = MAT[i];
    a[i * 4 + 0] = (m.hex >> 16) & 255;
    a[i * 4 + 1] = (m.hex >> 8) & 255;
    a[i * 4 + 2] = m.hex & 255;
    a[i * 4 + 3] = Math.min(255, Math.round(m.emissive * 80));
  }
  return a;
}
