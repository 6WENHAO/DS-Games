/* ============================================================
   STARFORGE - textures.js
   程序化像素贴图生成：16x16 图集 + 物品图标（全部原创绘制）
   ============================================================ */
'use strict';

function mulberry32(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const Tex = (() => {
  const TS = 16, COLS = 16;
  const canvas = document.createElement('canvas');
  canvas.width = TS * COLS; canvas.height = TS * COLS;
  const ctx = canvas.getContext('2d');
  const index = {}; // name -> tile index
  let cursor = 0;

  // --- 小工具 ---
  function shade(hex, f){
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return `rgb(${r},${g},${b})`;
  }
  function makePX(ox, oy){
    return (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x, oy + y, 1, 1); };
  }
  // 噪点填充
  function speckle(px, rnd, palette){
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++)
      px(x, y, palette[(rnd() * palette.length) | 0]);
  }
  // 定义一个 tile
  function tile(name, painter, seed){
    const i = cursor++;
    index[name] = i;
    const ox = (i % COLS) * TS, oy = ((i / COLS) | 0) * TS;
    ctx.clearRect(ox, oy, TS, TS);
    painter(makePX(ox, oy), mulberry32(seed || (i * 7919 + 13)), { ox, oy });
    return i;
  }
  const pal = (base, n = 4, spread = 0.16) => {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(shade(base, 1 - spread * i));
    return arr;
  };

  // ============ 基础地形 ============
  tile('grass_top', (px, r) => speckle(px, r, ['#69b23f','#5da337','#74bd48','#619f3b','#7cc44f']));
  tile('dirt',      (px, r) => speckle(px, r, ['#8a5f3c','#7d5535','#95683f','#775033','#8a6039']));
  tile('grass_side',(px, r) => {
    speckle(px, r, ['#8a5f3c','#7d5535','#95683f','#775033']);
    for (let x = 0; x < TS; x++){
      const h = 3 + ((r() * 2.4) | 0);
      for (let y = 0; y < h; y++) px(x, y, ['#69b23f','#5da337','#74bd48'][(r()*3)|0]);
    }
  });
  tile('stone', (px, r) => {
    speckle(px, r, ['#8c8c8c','#828282','#969696','#7a7a7a']);
    for (let i = 0; i < 5; i++){ const x=(r()*14)|0,y=(r()*14)|0; px(x,y,'#a3a3a3'); px(x+1,y,'#a3a3a3'); }
  });
  tile('sand', (px, r) => speckle(px, r, ['#e0d29a','#d8c98e','#e8dba6','#d0c184']));
  tile('gravel', (px, r) => speckle(px, r, ['#8f8b87','#7c7975','#a09b96','#6e6a66','#95908b']));
  tile('log_side', (px, r) => {
    for (let x = 0; x < TS; x++){
      const band = ['#6b502f','#5e4629','#755834','#634a2b'][x % 4];
      for (let y = 0; y < TS; y++) px(x, y, r() < 0.85 ? band : shade('#6b502f', 0.8 + r()*0.4));
    }
  });
  tile('log_top', (px, r) => {
    speckle(px, r, ['#b08d55','#a5854f']);
    for (let ring = 7; ring >= 1; ring -= 2)
      for (let a = 0; a < 64; a++){
        const x = 8 + Math.round(Math.cos(a/64*6.283) * ring * 0.9);
        const y = 8 + Math.round(Math.sin(a/64*6.283) * ring * 0.9);
        if (x>=0&&x<16&&y>=0&&y<16) px(x, y, '#8a6b3d');
      }
    for(let i=0;i<16;i++){px(i,0,'#6b502f');px(i,15,'#6b502f');px(0,i,'#6b502f');px(15,i,'#6b502f');}
  });
  tile('leaves', (px, r) => {
    // 镂空树叶：约1/4像素透明，可透视
    const pal = ['#3f7d2c','#357024','#488a33','#2e6420'];
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++){
      if (r() < 0.24) continue;                 // 透明孔洞
      px(x, y, pal[(r() * pal.length) | 0]);
      if (r() < 0.06) px(x, y, '#5aa93f');      // 高光叶尖
    }
  });
  tile('planks', (px, r) => {
    speckle(px, r, ['#a8824f','#9d7948','#b28a55']);
    for (let y = 3; y < TS; y += 4) for (let x = 0; x < TS; x++) px(x, y, '#7a5c35');
    px(4,1,'#7a5c35'); px(11,5,'#7a5c35'); px(2,9,'#7a5c35'); px(13,13,'#7a5c35');
  });
  tile('water', (px, r) => speckle(px, r, ['#3e6bd6','#3862c7','#4675e0','#3455b8']));
  tile('ice', (px, r) => {
    speckle(px, r, ['#a8d4f0','#9ccbeb','#b6ddf5']);
    px(3,4,'#e0f2fc'); px(4,5,'#e0f2fc'); px(10,9,'#e0f2fc'); px(11,10,'#e0f2fc'); px(12,3,'#e0f2fc');
  });
  tile('snow_top', (px, r) => speckle(px, r, ['#f2f6fa','#e8eef5','#fafcff','#e0e8f0']));
  tile('snow_side', (px, r) => {
    speckle(px, r, ['#8a5f3c','#7d5535','#95683f']);
    for (let x = 0; x < TS; x++) for (let y = 0; y < 4; y++) px(x, y, ['#f2f6fa','#e8eef5'][(r()*2)|0]);
  });
  tile('basalt', (px, r) => {
    speckle(px, r, ['#3a3a42','#33333a','#42424c','#2c2c33']);
    for (let i = 0; i < 4; i++){ const x=(r()*15)|0,y=(r()*15)|0; px(x,y,'#ff7733'); if(r()<0.5)px(x+1,y,'#c94f1e'); }
  });
  tile('alien_top', (px, r) => speckle(px, r, ['#9a5fd0','#8b52c2','#a86ddb','#7d47b3','#b078e0']));
  tile('alien_side', (px, r) => {
    speckle(px, r, ['#6e4a8a','#61407c','#7b5498']);
    for (let x = 0; x < TS; x++){ const h = 3 + ((r()*2.2)|0); for (let y = 0; y < h; y++) px(x, y, ['#9a5fd0','#a86ddb'][(r()*2)|0]); }
  });
  tile('barrier', (px, r) => {
    speckle(px, r, ['#2a2a30','#222228','#32323a']);
    for (let i = 0; i < 16; i++){ px(i, i, '#4a4a55'); px(15 - i, i, '#4a4a55'); }
  });
  // ---- 新星球类型 ----
  tile('crystal', (px, r) => {
    speckle(px, r, ['#1a4a50','#153c42','#20585e']);
    for (let i = 0; i < 5; i++){
      const x = 1 + ((r() * 12) | 0), y = 1 + ((r() * 12) | 0);
      px(x, y, '#7fe8e0'); px(x + 1, y + 1, '#aef7f2'); px(x, y + 1, '#5ec8c0');
      if (r() < 0.5) px(x + 1, y, '#ffffff');
    }
  });
  tile('mush_stem', (px, r) => {
    for (let x = 0; x < 16; x++){
      const band = ['#e8dcc8','#dccfb8','#f0e6d4'][x % 3];
      for (let y = 0; y < 16; y++) px(x, y, r() < 0.9 ? band : '#c4b8a2');
    }
    for (let i = 0; i < 16; i++){ px(0, i, '#b8ab94'); px(15, i, '#b8ab94'); }
  });
  tile('mush_cap', (px, r) => {
    speckle(px, r, ['#a04fc8','#9445ba','#ad5cd4','#8a3dad']);
    for (let i = 0; i < 5; i++){
      const x = 1 + ((r() * 12) | 0), y = 1 + ((r() * 12) | 0);
      px(x, y, '#f0e0f8'); px(x + 1, y, '#f0e0f8'); px(x, y + 1, '#f0e0f8'); px(x + 1, y + 1, '#e0c8ec');
    }
  });
  tile('ash', (px, r) => {
    speckle(px, r, ['#5c5a56','#524f4c','#66625e','#48453f']);
    for (let i = 0; i < 3; i++){
      const x = (r() * 15) | 0, y = (r() * 15) | 0;
      px(x, y, r() < 0.5 ? '#8a4a2a' : '#3a3a3a');
    }
  });
  // ---- 更多星球类型 ----
  tile('amber', (px, r) => {
    speckle(px, r, ['#e0a63a','#d49830','#ecb448','#c88a28']);
    for (let i = 0; i < 4; i++){
      const x = 1 + ((r() * 13) | 0), y = 1 + ((r() * 13) | 0);
      px(x, y, '#8a5a14'); if (r() < 0.5) px(x + 1, y, '#6e4610');   // 包裹物
      px(x - 1, y - 1, '#f8d878');                                     // 高光
    }
  });
  tile('rust', (px, r) => {
    speckle(px, r, ['#9a5a38','#8a4e30','#a86a42','#7c452a']);
    for (let i = 0; i < 5; i++){
      const x = (r() * 15) | 0, y = (r() * 15) | 0;
      px(x, y, r() < 0.5 ? '#c8875a' : '#5e3520');
      if (r() < 0.3) px(x + 1, y, '#d8d8dc');   // 金属反光
    }
  });
  tile('salt', (px, r) => {
    speckle(px, r, ['#f0f2f4','#e6e9ec','#f8fafc','#dde2e6']);
    for (let i = 0; i < 4; i++){
      const x = 1 + ((r() * 13) | 0), y = 1 + ((r() * 13) | 0);
      px(x, y, '#c2c9ce'); px(x + 1, y, '#c2c9ce'); px(x + 1, y + 1, '#c2c9ce');   // 裂纹
    }
  });
  tile('obsidian', (px, r) => {
    speckle(px, r, ['#1c1a26','#16141f','#24202e','#120f1a']);
    for (let i = 0; i < 3; i++){
      const x = 1 + ((r() * 12) | 0), y = 1 + ((r() * 12) | 0);
      px(x, y, '#6a5a9a'); px(x + 1, y + 1, '#48406e');   // 玻璃光泽
      if (r() < 0.4) px(x + 2, y + 2, '#8a7ab8');
    }
  });
  tile('redmoss_top', (px, r) => speckle(px, r, ['#b04a38','#a04230','#c05642','#943a2a','#c86a50']));
  tile('redmoss_side', (px, r) => {
    speckle(px, r, ['#8a5f3c','#7d5535','#95683f']);
    for (let x = 0; x < TS; x++){ const h = 3 + ((r() * 2.2) | 0); for (let y = 0; y < h; y++) px(x, y, ['#b04a38','#c05642'][(r() * 2) | 0]); }
  });
  tile('hive', (px, r) => {
    speckle(px, r, ['#d8862a','#c87822','#e69634']);
    // 蜂窝格纹
    for (let cy = 0; cy < 2; cy++)
      for (let cx = 0; cx < 2; cx++){
        const ox = cx * 8 + (cy % 2) * 4, oy = cy * 8;
        for (let a = 0; a < 12; a++){
          const x = (ox + 3 + Math.round(Math.cos(a / 12 * 6.283) * 2.6)) & 15;
          const y = (oy + 3 + Math.round(Math.sin(a / 12 * 6.283) * 2.6)) & 15;
          px(x, y, '#8a5210');
        }
        px((ox + 3) & 15, (oy + 3) & 15, '#5e3808');
      }
  });
  tile('murk_top', (px, r) => {
    speckle(px, r, ['#1e5a4c','#1a4f42','#246656','#16453a']);
    for (let i = 0; i < 4; i++) px((r() * 15) | 0, (r() * 15) | 0, '#4ee8b8');   // 荧光点
  });
  tile('murk_side', (px, r) => {
    speckle(px, r, ['#4a4238','#3f382f','#554c40']);
    for (let x = 0; x < TS; x++){ const h = 3 + ((r() * 2) | 0); for (let y = 0; y < h; y++) px(x, y, ['#1e5a4c','#246656'][(r() * 2) | 0]); }
  });
  tile('glow_shroom', (px, r) => {
    // 荧光蘑菇（十字面片）
    px(7, 15, '#3a5248'); px(8, 14, '#2e453c'); px(7, 13, '#3a5248'); px(8, 12, '#2e453c');
    const c = '#4ee8b8', h = '#b8ffe8', d = '#2aa882';
    px(6, 9, c); px(7, 9, c); px(8, 9, c); px(9, 9, c);
    px(5, 10, d); px(10, 10, d);
    px(6, 8, h); px(7, 7, h); px(8, 8, c); px(9, 8, d);
    px(7, 10, '#e8fff6'); px(8, 10, '#e8fff6');
  });

  // ============ 矿石（石底 + 矿斑）============
  function orePainter(color, hi, glow){
    return (px, r) => {
      speckle(px, r, ['#8c8c8c','#828282','#969696','#7a7a7a']);
      for (let i = 0; i < 5; i++){
        const x = 1 + ((r() * 12) | 0), y = 1 + ((r() * 12) | 0);
        px(x, y, color); px(x+1, y, color); px(x, y+1, color); px(x+1, y+1, hi);
        if (glow && r() < 0.7) px(x+2, y+1, glow);
      }
    };
  }
  tile('coal_ore',     orePainter('#2b2b2b', '#4a4a4a'));
  tile('iron_ore',     orePainter('#d8af93', '#e8c7ae'));
  tile('copper_ore',   orePainter('#d17f4a', '#e89a63'));
  tile('titanium_ore', orePainter('#cdd6dd', '#eef4f8'));
  tile('uranium_ore',  orePainter('#69d436', '#a2f078', '#c6ff9e'));
  tile('gold_ore',     orePainter('#f5cd3a', '#ffe98a'));

  // ============ 植物（十字面片）============
  tile('sodium_plant', (px, r) => {
    // 黄色钠晶花
    px(7,15,'#3f7d2c'); px(8,15,'#357024'); px(7,14,'#3f7d2c'); px(8,13,'#3f7d2c'); px(7,12,'#488a33');
    const cx = 7, cy = 8;
    const c = '#ffd23e', h = '#fff2ae', d = '#d9a80f';
    px(cx,cy,c);px(cx+1,cy,c);px(cx,cy+1,c);px(cx+1,cy+1,h);
    px(cx-1,cy-2,c);px(cx+3,cy-1,d);px(cx,cy-3,h);px(cx+2,cy+2,d);px(cx-2,cy+1,c);px(cx+2,cy-3,c);
  });
  tile('oxygen_plant', (px, r) => {
    // 红色氧素花
    px(8,15,'#3f7d2c'); px(8,14,'#357024'); px(7,13,'#3f7d2c'); px(8,12,'#488a33');
    const c = '#ff5a4e', h = '#ffb0a8', d = '#c22e24';
    px(7,8,c);px(8,8,c);px(7,9,c);px(8,9,h);px(6,7,d);px(9,7,c);px(6,10,c);px(9,10,d);px(7,6,h);px(8,11,c);
  });
  tile('carbon_fern', (px, r) => {
    for (let i = 0; i < 12; i++){
      const x = 3 + ((r()*10)|0), y = 4 + ((r()*11)|0);
      px(x, y, ['#2e6420','#3f7d2c','#244f19'][(r()*3)|0]);
    }
    px(7,15,'#244f19'); px(8,14,'#2e6420'); px(7,13,'#244f19'); px(8,12,'#2e6420');
  });

  // ============ 功能方块 ============
  tile('glass', (px) => {
    for (let i = 0; i < 16; i++){ px(i,0,'#cfeef5'); px(i,15,'#cfeef5'); px(0,i,'#cfeef5'); px(15,i,'#cfeef5'); }
    px(3,3,'#ffffffcc'); px(4,4,'#ffffff99'); px(5,5,'#ffffff66');
  });
  tile('lamp_on', (px, r) => {
    speckle(px, r, ['#ffe9a8','#fff3c8','#ffdf8e']);
    for (let i = 0; i < 16; i++){ px(i,0,'#8a6b2d'); px(i,15,'#8a6b2d'); px(0,i,'#8a6b2d'); px(15,i,'#8a6b2d'); }
  });
  // 金属面板（机器通用）
  tile('metal', (px, r) => {
    speckle(px, r, ['#9aa7b0','#909da6','#a4b1ba','#8a97a0']);
    for (let i = 0; i < 16; i++){ px(i,0,'#b8c5ce'); px(0,i,'#b8c5ce'); px(i,15,'#6a7780'); px(15,i,'#6a7780'); }
    px(2,2,'#5f6b73');px(13,2,'#5f6b73');px(2,13,'#5f6b73');px(13,13,'#5f6b73');
  });
  tile('metal_dark', (px, r) => {
    speckle(px, r, ['#4e5a63','#46525b','#57636c']);
    for (let i = 0; i < 16; i++){ px(i,0,'#68747d'); px(0,i,'#68747d'); px(i,15,'#333d44'); px(15,i,'#333d44'); }
  });
  tile('vent', (px, r) => {
    speckle(px, r, ['#4e5a63','#46525b']);
    for (let y = 2; y < 14; y += 3) for (let x = 2; x < 14; x++){ px(x, y, '#222a30'); px(x, y+1, '#68747d'); }
  });
  tile('furnace_front', (px, r) => {
    speckle(px, r, ['#8c8c8c','#828282','#969696']);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, '#1d1d1d');
    for (let x = 3; x < 13; x++){ px(x, 7, '#5a5a5a'); px(x, 14, '#5a5a5a'); }
  });
  tile('furnace_on', (px, r) => {
    speckle(px, r, ['#8c8c8c','#828282','#969696']);
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++)
      px(x, y, ['#ff8c1a','#ffb31a','#ff6600','#ffd21a'][(r()*4)|0]);
    for (let x = 3; x < 13; x++){ px(x, 7, '#5a5a5a'); px(x, 14, '#5a5a5a'); }
  });
  tile('belt', (px, r) => {
    speckle(px, r, ['#3a4148','#333a40','#424a52']);
    for (let x = 0; x < 16; x++){ px(x,0,'#586269'); px(x,15,'#586269'); }
    // 黄色箭头纹（滚动动画用）
    for (const oy of [2, 10]){
      for (let i = 0; i < 5; i++){ px(3+i, oy+4-i>oy? oy+i : oy, '#ffcf4d'); }
      px(3,oy,'#ffcf4d');px(4,oy+1,'#ffcf4d');px(5,oy+2,'#ffcf4d');px(4,oy+3,'#ffcf4d');px(3,oy+4,'#ffcf4d');
      px(9,oy,'#e6b23a');px(10,oy+1,'#e6b23a');px(11,oy+2,'#e6b23a');px(10,oy+3,'#e6b23a');px(9,oy+4,'#e6b23a');
    }
  });
  // 转弯传送带：入口在下边缘(-z)，出口在右边缘(+x)
  tile('belt_turn', (px, r) => {
    speckle(px, r, ['#3a4148','#333a40','#424a52']);
    for (let x = 0; x < 16; x++) px(x, 0, '#586269');
    for (let y = 0; y < 16; y++) px(0, y, '#586269');
    // 弧形导轨
    for (let a = 0; a < 26; a++){
      const t = a / 25 * Math.PI / 2;
      const x = Math.round(15 - Math.cos(t) * 12), y = Math.round(15 - Math.sin(t) * 12);
      if (x>=0&&x<16&&y>=0&&y<16){ px(x, y, '#ffcf4d'); }
      const x2 = Math.round(15 - Math.cos(t) * 6), y2 = Math.round(15 - Math.sin(t) * 6);
      if (x2>=0&&x2<16&&y2>=0&&y2<16){ px(x2, y2, '#e6b23a'); }
    }
    px(13,12,'#ffcf4d'); px(12,13,'#ffcf4d');
  });
  // 风机塔身 / 火电正面
  tile('wind_pole', (px, r) => {
    speckle(px, r, ['#c8d2d8','#bcc6cc','#d2dce2']);
    for (let i = 0; i < 16; i++){ px(0,i,'#98a2a8'); px(15,i,'#98a2a8'); }
    px(7,3,'#8a97a0');px(8,3,'#8a97a0');px(7,10,'#8a97a0');px(8,10,'#8a97a0');
  });
  tile('miner_top', (px, r) => {
    speckle(px, r, ['#9aa7b0','#909da6','#a4b1ba']);
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) px(x, y, '#333d44');
    for (let i = 5; i < 11; i++){ px(i, i, '#ffcf4d'); px(16-i, i, '#ffcf4d'); }
    for (let i = 0; i < 16; i++){ px(i,0,'#b8c5ce'); px(0,i,'#b8c5ce'); px(i,15,'#6a7780'); px(15,i,'#6a7780'); }
  });
  tile('assembler_top', (px, r) => {
    speckle(px, r, ['#9aa7b0','#909da6','#a4b1ba']);
    for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) px(x, y, '#1a2a38');
    px(7,7,'#35e0e8');px(8,7,'#35e0e8');px(7,8,'#35e0e8');px(8,8,'#7ff5fa');
    for (let i = 0; i < 16; i++){ px(i,0,'#b8c5ce'); px(0,i,'#b8c5ce'); px(i,15,'#6a7780'); px(15,i,'#6a7780'); }
  });
  tile('solar_top', (px, r) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      px(x, y, (x % 5 === 0 || y % 8 === 7) ? '#8a97a0' : ['#16294e','#1a3160','#122342'][(r()*3)|0]);
    px(3,2,'#4a6dc0'); px(8,4,'#4a6dc0'); px(12,9,'#4a6dc0');
  });
  tile('chest_side', (px, r) => {
    speckle(px, r, ['#a8824f','#9d7948','#b28a55']);
    for (let i = 0; i < 16; i++){ px(i,0,'#7a5c35'); px(i,15,'#7a5c35'); px(0,i,'#7a5c35'); px(15,i,'#7a5c35'); }
    for (let x = 0; x < 16; x++) px(x, 6, '#63482a');
    px(7,6,'#d8d8d8'); px(8,6,'#d8d8d8'); px(7,7,'#b8b8b8'); px(8,7,'#b8b8b8');
  });
  tile('refinery_side', (px, r) => {
    speckle(px, r, ['#4e5a63','#46525b','#57636c']);
    for (let y = 3; y < 13; y++){ px(4, y, '#ff8c1a'); px(5, y, '#c9641a'); px(10, y, '#35e0e8'); px(11, y, '#1a8a90'); }
    for (let i = 0; i < 16; i++){ px(i,0,'#68747d'); px(i,15,'#333d44'); }
  });
  tile('reactor_side', (px, r) => {
    speckle(px, r, ['#4e5a63','#46525b','#57636c']);
    for (let y = 4; y < 12; y++) for (let x = 6; x < 10; x++) px(x, y, ['#69d436','#a2f078','#4caf1e'][(r()*3)|0]);
    for (let i = 0; i < 16; i++){ px(i,0,'#68747d'); px(0,i,'#68747d'); px(i,15,'#333d44'); px(15,i,'#333d44'); }
  });
  tile('launchpad_top', (px, r) => {
    speckle(px, r, ['#4e5a63','#46525b']);
    for (let i = 0; i < 16; i++){
      if ((i + 0) % 4 < 2){ px(i, 0, '#ffcf4d'); px(i, 15, '#ffcf4d'); px(0, i, '#ffcf4d'); px(15, i, '#ffcf4d'); }
    }
    for (let a = 0; a < 40; a++){
      const x = 8 + Math.round(Math.cos(a/40*6.283)*5), y = 8 + Math.round(Math.sin(a/40*6.283)*5);
      if(x>=0&&x<16&&y>=0&&y<16) px(x, y, '#ffcf4d');
    }
    px(7,8,'#ffcf4d');px(8,8,'#ffcf4d');px(8,7,'#ffcf4d');px(7,7,'#ffcf4d');
  });
  tile('storage_top', (px, r) => {
    speckle(px, r, ['#a8824f','#9d7948']);
    for (let i = 0; i < 16; i++){ px(i,0,'#7a5c35'); px(i,15,'#7a5c35'); px(0,i,'#7a5c35'); px(15,i,'#7a5c35'); }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  // 提取单 tile 独立贴图（机器材质用）
  const tileTexCache = {};
  function tileTexture(name, repeatX = 1, repeatY = 1){
    const key = name + '_' + repeatX + '_' + repeatY;
    if (tileTexCache[key]) return tileTexCache[key];
    const i = index[name];
    const c = document.createElement('canvas'); c.width = TS; c.height = TS;
    c.getContext('2d').drawImage(canvas, (i % COLS) * TS, ((i / COLS) | 0) * TS, TS, TS, 0, 0, TS, TS);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY);
    tileTexCache[key] = t;
    return t;
  }
  function tileCanvas(name){
    const i = index[name];
    const c = document.createElement('canvas'); c.width = TS; c.height = TS;
    c.getContext('2d').drawImage(canvas, (i % COLS) * TS, ((i / COLS) | 0) * TS, TS, TS, 0, 0, TS, TS);
    return c;
  }

  return { canvas, ctx, TS, COLS, index, texture, tileTexture, tileCanvas, shade,
    uvRect(name){
      const i = index[name];
      const u = (i % COLS) / COLS, v = 1 - (((i / COLS) | 0) + 1) / COLS;
      return { u0: u, v0: v, u1: u + 1 / COLS, v1: v + 1 / COLS };
    }
  };
})();

/* ============================================================
   物品图标绘制（32x32 canvas，惰性生成缓存）
   ============================================================ */
const Icons = (() => {
  const cache = {};

  function newC(){ const c = document.createElement('canvas'); c.width = 32; c.height = 32; return c; }
  function P(ctx){ return (x, y, col, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }; }

  // 等距方块图标（Minecraft 风）
  function blockIcon(topName, sideName, side2Name){
    const c = newC(); const ctx = c.getContext('2d');
    const top = Tex.tileCanvas(topName), side = Tex.tileCanvas(sideName), side2 = Tex.tileCanvas(side2Name || sideName);
    ctx.imageSmoothingEnabled = false;
    // 顶面（菱形）
    ctx.save();
    ctx.translate(16, 1);
    ctx.transform(1, 0.5, -1, 0.5, 0, 0);
    ctx.drawImage(top, 0, 0, 16, 16, 0, 0, 15, 15);
    ctx.restore();
    // 左面
    ctx.save();
    ctx.translate(1, 8.5);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.drawImage(side, 0, 0, 16, 16, 0, 0, 15, 15.5);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, 16, 24);
    ctx.restore();
    // 右面
    ctx.save();
    ctx.translate(16, 16);
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.drawImage(side2, 0, 0, 16, 16, 0, 0, 15, 15.5);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, 16, 24);
    ctx.restore();
    return c;
  }
  function flatIcon(tileName){
    const c = newC(); const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(Tex.tileCanvas(tileName), 0, 0, 16, 16, 2, 2, 28, 28);
    return c;
  }
  // 锭
  function ingotIcon(c1, c2){
    const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
    const dark = Tex.shade(c1, 0.6), hi = c2;
    px(6, 16, dark, 20, 8); px(4, 14, c1, 20, 8); px(4, 12, hi, 20, 3);
    px(6, 24, Tex.shade(c1, 0.45), 20, 1);
    px(5, 13, '#ffffff88', 8, 1);
    ctx.strokeStyle = Tex.shade(c1, 0.4); ctx.lineWidth = 1;
    return c;
  }
  // 晶体
  function crystalIcon(c1, c2){
    const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
    const d = Tex.shade(c1, 0.55);
    px(14, 4, c2, 4, 4); px(12, 8, c1, 8, 10); px(10, 12, d, 4, 8); px(18, 10, c1, 6, 12);
    px(8, 18, c1, 6, 8); px(20, 6, c2, 2, 4); px(15, 9, '#ffffffaa', 2, 5);
    px(6, 26, d, 20, 2);
    return c;
  }
  // 矿石碎块
  function chunkIcon(c1){
    const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
    const d = Tex.shade(c1, 0.6), h = Tex.shade(c1, 1.35);
    px(8, 10, c1, 10, 9); px(16, 14, d, 8, 8); px(10, 18, d, 8, 6); px(12, 8, h, 4, 3);
    px(20, 12, h, 3, 2); px(7, 14, d, 3, 5);
    return c;
  }
  const painters = {
    gear(){
      const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
      const g = '#aab6bf', d = '#77848d', h = '#d5dde2';
      for (let a = 0; a < 8; a++){
        const x = 16 + Math.round(Math.cos(a / 8 * 6.283) * 11) - 2;
        const y = 16 + Math.round(Math.sin(a / 8 * 6.283) * 11) - 2;
        px(x, y, d, 5, 5);
      }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 9, 0, 7); ctx.fill();
      ctx.fillStyle = h; ctx.beginPath(); ctx.arc(14, 14, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#2c353b'; ctx.beginPath(); ctx.arc(16, 16, 4, 0, 7); ctx.fill();
      return c;
    },
    circuit(){
      const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
      px(5, 7, '#1d7a3c', 22, 18); px(5, 7, '#25914a', 22, 3);
      px(9, 12, '#ffd24d', 5, 5); px(19, 16, '#2c353b', 6, 4);
      px(7, 20, '#d17f4a', 16, 1); px(7, 10, '#d17f4a', 1, 11); px(14, 14, '#d17f4a', 8, 1);
      px(24, 9, '#d17f4a', 1, 8); px(11, 22, '#c0c0c0', 2, 3); px(17, 22, '#c0c0c0', 2, 3);
      return c;
    },
    data(){
      const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
      px(6, 6, '#122c48', 20, 20); px(6, 6, '#1a3d63', 20, 4);
      px(10, 13, '#35e0e8', 12, 2); px(10, 17, '#35e0e8', 8, 2); px(10, 21, '#2596a0', 10, 1);
      px(24, 12, '#7dff8a', 2, 2);
      for (let i = 0; i < 4; i++){ px(8 + i * 5, 3, '#8a97a0', 2, 3); px(8 + i * 5, 26, '#8a97a0', 2, 3); }
      return c;
    },
    fuel(){
      const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
      px(10, 6, '#8a97a0', 12, 4); px(8, 10, '#c0392b', 16, 16); px(8, 10, '#e74c3c', 16, 5);
      px(12, 15, '#f8d347', 8, 7); px(14, 17, '#c0392b', 4, 3);
      px(8, 26, '#7f2418', 16, 2); px(13, 3, '#5f6b73', 6, 3);
      return c;
    },
    tritium(){ return crystalIcon('#4da6ff', '#b3dbff'); },
    oxygen(){
      const c = newC(); const ctx = c.getContext('2d');
      ctx.fillStyle = '#c2392b'; ctx.beginPath(); ctx.arc(13, 14, 8, 0, 7); ctx.fill();
      ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(20, 20, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffb3ab'; ctx.beginPath(); ctx.arc(10, 11, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8a80'; ctx.beginPath(); ctx.arc(19, 18, 2, 0, 7); ctx.fill();
      return c;
    },
    carbon(){ return crystalIcon('#3a3a3a', '#6e6e6e'); },
    sodium(){ return crystalIcon('#ffd23e', '#fff2ae'); },
    uranium(){ return crystalIcon('#69d436', '#c6ff9e'); },
    coal(){ return chunkIcon('#2f2f2f'); },
    iron_ore(){ return chunkIcon('#d8af93'); },
    copper_ore(){ return chunkIcon('#d17f4a'); },
    titanium_ore(){ return chunkIcon('#cdd6dd'); },
    gold_ore(){ return chunkIcon('#f5cd3a'); },
    iron(){ return ingotIcon('#b8c4cc', '#e2eaef'); },
    copper(){ return ingotIcon('#d17f4a', '#f0a877'); },
    titanium(){ return ingotIcon('#dfe8ee', '#ffffff'); },
    gold(){ return ingotIcon('#f5cd3a', '#ffe98a'); },
    glass_item(){ return flatIcon('glass'); },
    stone_item(){ return chunkIcon('#8c8c8c'); },
    wire(){
      const c = newC(); const ctx = c.getContext('2d');
      ctx.strokeStyle = '#d17f4a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(16, 16, 9, 0.5, 5.5); ctx.stroke();
      ctx.strokeStyle = '#f0a877'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(16, 15, 9, 0.7, 5.3); ctx.stroke();
      return c;
    },
    plate(){
      const c = newC(); const ctx = c.getContext('2d'); const px = P(ctx);
      px(6, 8, '#8a97a0', 20, 16); px(6, 8, '#aab6bf', 20, 4); px(6, 22, '#5f6b73', 20, 2);
      px(9, 11, '#4a545b', 2, 2); px(21, 11, '#4a545b', 2, 2); px(9, 19, '#4a545b', 2, 2); px(21, 19, '#4a545b', 2, 2);
      return c;
    },
    warp(){
      const c = newC(); const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(16, 16, 2, 16, 16, 13);
      g.addColorStop(0, '#e0d0ff'); g.addColorStop(0.5, '#b48cff'); g.addColorStop(1, '#3a1d66');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#e0d0ffaa'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(16, 16, 13, 5, -0.6, 0, 7); ctx.stroke();
      return c;
    },
    antimatter(){
      const c = newC(); const ctx = c.getContext('2d');
      // 反物质：黑色奇点 + 紫红吸积环
      const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 12);
      g.addColorStop(0, '#000000'); g.addColorStop(0.55, '#1a0a2e'); g.addColorStop(0.8, '#e838a8'); g.addColorStop(1, '#40103080');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(16, 16, 12, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ff66ccdd'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(16, 16, 13.5, 4.5, 0.8, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(16, 16, 12.5, 3.5, 0.8, 0, 7); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(15, 15, 2, 2);
      return c;
    }
  };

  function get(itemId){
    if (cache[itemId]) return cache[itemId];
    const def = ITEMS[itemId];
    let c;
    if (!def){ c = newC(); }
    else if (def.iconBlock){
      const b = BLOCKS[def.iconBlock];
      if (b.cross) c = flatIcon(b.tiles.side || b.tiles.all);
      else c = blockIcon(b.tiles.top || b.tiles.all, b.tiles.side || b.tiles.all, b.tiles.front || b.tiles.side || b.tiles.all);
    }
    else if (def.iconFn && painters[def.iconFn]) c = painters[def.iconFn]();
    else c = crystalIcon('#888888', '#cccccc');
    cache[itemId] = c;
    return c;
  }
  function img(itemId){ // 返回克隆 canvas（用于多处插入 DOM）
    const src = get(itemId);
    const c = newC();
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }
  return { get, img };
})();
