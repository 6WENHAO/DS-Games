/* shots/verify.js - Phase 1 逻辑自检（无需 WebGL） */
const fs = require('fs');
const vm = require('vm');

global.GEN_MODULE = function () {};
global.MESHER_MODULE = function () {};
global.LOD_MODULE = function () {};

const src = fs.readFileSync(__dirname + '/../js/room.js', 'utf-8');
const sandbox = vm.createContext({ console, GEN_MODULE, MESHER_MODULE, LOD_MODULE });
vm.runInContext(src, sandbox);
const RoomBuilder = vm.runInContext('RoomBuilder', sandbox);

const C = RoomBuilder.ROOM_CONFIG;
console.log('=== Phase 1 Logic Verification ===');
console.log('Room size:', C.sizeX + 'x' + C.sizeZ + 'x' + C.sizeY);
console.log('Window wall:', C.windowWall.wall);
console.log('Doorway:', C.doorway.wall, C.doorway.width + 'w x' + C.doorway.height + 'h');
console.log('Furniture count:', C.furniture.length);
console.log('Wall material:', C.wallMaterial);

let blockCount = 0;
const stats = { glass: 0, air: 0, floor: 0, shelf: 0, sofa: 0, plant: 0, light: 0 };
const mockWorld = {
  stampBlocks(list) {
    blockCount = list.length;
    for (const b of list) {
      if (b.id === 63) stats.glass++;
      if (b.id === 0) stats.air++;
      if (b.id === 31 && b.y === 64) stats.floor++;
      if (b.id === 49) stats.shelf++;
      if (b.id === 78) stats.sofa++;
      if (b.id === 81 || b.id === 83) stats.plant++;
      if (b.id === 48) stats.light++;
    }
    return blockCount;
  }
};

RoomBuilder.buildRoom(mockWorld, 0, 64, 0);
console.log('\nGenerated blocks:', blockCount);
console.log('  Glass:', stats.glass, '| Air:', stats.air, '| Floor:', stats.floor);
console.log('  Bookshelf:', stats.shelf, '| Sofa(wool):', stats.sofa, '| Plants:', stats.plant, '| Lights:', stats.light);

const checks = [
  ['glass wall exists', stats.glass >= 50],
  ['door gap (air)', stats.air >= 100],
  ['floor planks', stats.floor >= 100],
  ['bookshelf', stats.shelf >= 3],
  ['sofa', stats.sofa >= 2],
  ['plants', stats.plant >= 2],
  ['ceiling lights', stats.light >= 4],
];

let allOk = true;
for (const [desc, ok] of checks) {
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + desc);
  if (!ok) allOk = false;
}

console.log(allOk ? '\n[PASS] Phase 1 logic verified' : '\n[FAIL] Missing elements');
process.exit(allOk ? 0 : 1);
