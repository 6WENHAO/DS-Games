// Per-planet palette helper: block particle colours + THREE colours.
import * as THREE from 'three';
import { BID } from '../world/blocks.js';

const toCss = (c) => '#' + [c[0], c[1], c[2]].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');

export class Palette {
  constructor(pal) { this.set(pal); }

  set(pal) {
    this.pal = pal;
    this.css = {};
    for (const k in pal) if (Array.isArray(pal[k])) this.css[k] = toCss(pal[k]);
    this.three = {};
    for (const k in pal) if (Array.isArray(pal[k])) this.three[k] = new THREE.Color(pal[k][0] / 255, pal[k][1] / 255, pal[k][2] / 255);
  }

  blockColor(id) {
    const P = this.css;
    switch (id) {
      case BID.GRASS: case BID.TUFT: return P.grass;
      case BID.DIRT: return P.dirt;
      case BID.STONE: case BID.COBBLE: case BID.BRICK: case BID.GRAVEL: return P.stone;
      case BID.SAND: case BID.SANDSTONE: return P.sand;
      case BID.LOG: case BID.PLANKS: case BID.TABLE: return P.wood;
      case BID.LEAVES: case BID.BUSH: return P.leaf;
      case BID.WATER: return P.water;
      case BID.ALIEN_ROCK: case BID.PARAFFIN: return P.rock;
      case BID.CRYSTAL: case BID.FROST_CRYSTAL: return P.crystal;
      case BID.OXY: return P.floraRed;
      case BID.SODIUM: return P.floraYellow;
      case BID.MOSS: case BID.LUMEN: return P.glow;
      case BID.MUSH_CAP: return P.floraRed;
      case BID.MUSH_STEM: return P.wood;
      case BID.SNOW: return '#f2f6fc';
      case BID.ICE: return '#9fd4f5';
      case BID.FERRITE: return '#b98b5a';
      case BID.COPPER: return '#d2762e';
      case BID.GOLD: return '#f2c53d';
      case BID.COBALT: return '#3f6ee0';
      case BID.SALT: return '#e8e8f0';
      case BID.BASALT: return '#3b3a40';
      case BID.METAL_PANEL: case BID.METAL_FLOOR: return '#8e9aa8';
      case BID.GLASS: return '#cde8f0';
      case BID.CACTUS: return P.leaf;
      case BID.CRATE: return '#8a6a44';
      case BID.REFINER: return '#6f7c8a';
      case BID.COMPUTER: return '#2ee6c0';
      case BID.BEACON: return '#ffb02e';
      default: return P.stone || '#8a8f96';
    }
  }
}
