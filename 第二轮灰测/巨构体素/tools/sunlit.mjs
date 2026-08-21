// CPU 光线步进：统计屋顶/地面有多少比例真的被太阳照到（验证渲染里的阴影是否合理）
import { createGenerator, CFG } from '../src/generator.js';

const gen = createGenerator(861204);
for (const [, run] of gen.steps) run();
const w = gen.world;

function sunDir(elDeg, azDeg) {
  const el = (elDeg * Math.PI) / 180, az = (azDeg * Math.PI) / 180;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

function lit(x, y, z, d) {
  // 从表面往太阳方向步进
  for (let t = 1.5; t < 2600; t += 1.0) {
    const px = Math.floor(x + d[0] * t), py = Math.floor(y + d[1] * t), pz = Math.floor(z + d[2] * t);
    if (py > CFG.MAST_TOP + 8) return true;
    if (Math.abs(px) > 300 || Math.abs(pz) > 300) return py > 200 ? true : true;
    if (w.get(px, py, pz) !== 0) return false;
  }
  return true;
}

const azs = [250];
for (const el of [6, 13, 24, 34, 46, 58, 75]) {
  for (const az of azs) {
    const d = sunDir(el, az);
    let roofTot = 0, roofLit = 0, wallTot = 0, wallLit = 0;
    for (let x = -240; x <= 240; x += 7) {
      for (let z = -240; z <= 240; z += 7) {
        // 找最高的实体顶面
        let top = null;
        for (let y = 240; y >= -30; y--) if (w.get(x, y, z) !== 0) { top = y; break; }
        if (top === null) continue;
        roofTot++;
        if (lit(x + 0.5, top + 1.05, z + 0.5, d)) roofLit++;
        // 朝西的立面（法线 -x）
        for (let y = top; y > Math.max(2, top - 60); y -= 11) {
          if (w.get(x, y, z) !== 0 && w.get(x - 1, y, z) === 0) {
            wallTot++;
            if (lit(x - 1.05, y + 0.5, z + 0.5, d)) wallLit++;
            break;
          }
        }
      }
    }
    console.log(`el=${String(el).padStart(2)}° az=${az}°  屋顶受光 ${(roofLit / roofTot * 100).toFixed(1)}% (${roofLit}/${roofTot})   西立面受光 ${(wallLit / Math.max(1, wallTot) * 100).toFixed(1)}% (${wallLit}/${wallTot})`);
  }
}
