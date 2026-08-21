/**
 * ui/chat.js
 * ------------------------------------------------------------------
 * The chat log, the input bar and the slash-command interpreter.
 *
 * Messages fade out after a few seconds like vanilla; opening the chat
 * bar shows the full backlog. Commands mirror the ones players expect:
 * /gamemode, /time, /tp, /give, /seed, /kill, /clear, /weather, /help.
 */

import { itemsByName, getItem } from '../game/items.js';
import { blocksByName } from '../world/blocks.js';
import { GAME_MODE } from '../player/player.js';
import { TIME_PRESETS } from '../game/daycycle.js';
import { t, entryName, modeName, mobName, weatherName } from './i18n.js';

const MAX_HISTORY = 100;
const VISIBLE_LINES = 10;
const FADE_AFTER = 8;
const FADE_TIME = 2;

export class Chat {
  constructor(game) {
    this.game = game;
    /** @type {{text: string, age: number}[]} newest last */
    this.lines = [];
    this.open = false;
    this.input = '';
    /** Previously sent messages, browsable with the arrow keys. */
    this.sentHistory = [];
    this.historyIndex = -1;
    this.scroll = 0;
  }

  /** Adds a message. Supports the vanilla section-sign colour codes. */
  add(text) {
    for (const line of String(text).split('\n')) {
      this.lines.push({ text: line, age: 0 });
    }
    while (this.lines.length > MAX_HISTORY) this.lines.shift();
  }

  info(text) { this.add(`\u00a77${text}`); }
  error(text) { this.add(`\u00a7c${text}`); }
  success(text) { this.add(`\u00a7a${text}`); }

  update(dt) {
    for (const line of this.lines) line.age += dt;
  }

  openBar(prefill = '') {
    this.open = true;
    this.input = prefill;
    this.historyIndex = -1;
    this.game.controls.startTextCapture(prefill);
  }

  closeBar() {
    this.open = false;
    this.game.controls.endTextCapture();
  }

  /** Called when the player presses Enter. */
  submit() {
    const text = this.game.controls.textBuffer.trim();
    this.closeBar();
    if (!text) return;
    this.sentHistory.push(text);
    if (text.startsWith('/')) this.runCommand(text.slice(1));
    else this.add(`\u00a7f<Player> ${text}`);
  }

  /** Simple tab completion for command names and item names. */
  complete() {
    const text = this.game.controls.textBuffer;
    if (!text.startsWith('/')) return;
    const parts = text.slice(1).split(' ');
    if (parts.length === 1) {
      const options = Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0]));
      if (options.length === 1) this.game.controls.textBuffer = `/${options[0]} `;
      else if (options.length > 1) this.info(options.join(' '));
      return;
    }
    const last = parts[parts.length - 1];
    const names = [...itemsByName.keys()].filter((n) => n.startsWith(last));
    if (names.length === 1) {
      parts[parts.length - 1] = names[0];
      this.game.controls.textBuffer = `/${parts.join(' ')}`;
    } else if (names.length > 1 && names.length < 30) {
      this.info(names.slice(0, 24).join(' '));
    }
  }

  /** Executes a command string (without the leading slash). */
  runCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const name = parts.shift().toLowerCase();
    const command = COMMANDS[name];
    if (!command) {
      this.error(t('chat.unknownCommand', { name }));
      return;
    }
    try {
      command.run(this.game, parts, this);
    } catch (err) {
      this.error(t('chat.commandFailed', { error: err.message }));
    }
  }

  /**
   * Draws the log and, when open, the input bar.
   * @param {import('../gfx/sprite-batch.js').SpriteBatch} batch
   * @param {import('./hud.js').Hud} hud
   */
  draw(batch, hud) {
    const bottom = batch.height - (this.open ? 30 : 44);
    const visible = [];
    for (let i = this.lines.length - 1; i >= 0 && visible.length < VISIBLE_LINES; i--) {
      const line = this.lines[i];
      if (!this.open && line.age > FADE_AFTER + FADE_TIME) break;
      visible.push(line);
    }

    visible.forEach((line, index) => {
      const y = bottom - index * 10;
      let alpha = 1;
      if (!this.open && line.age > FADE_AFTER) {
        alpha = Math.max(0, 1 - (line.age - FADE_AFTER) / FADE_TIME);
      }
      if (alpha <= 0.01) return;
      const width = Math.min(batch.width - 8, hud.measure(line.text) + 4);
      batch.rect(2, y - 1, width + 2, 10, 0x000000, 0.35 * alpha);
      hud.drawText(line.text, 4, y, { alpha });
    });

    if (this.open) {
      const y = batch.height - 14;
      batch.rect(2, y - 2, batch.width - 4, 12, 0x000000, 0.6);
      const text = this.game.controls.textBuffer;
      hud.drawText(`> ${text}`, 4, y, { color: 0xffffff });
      // blinking caret
      if (Math.floor(performance.now() / 400) % 2 === 0) {
        const cx = 4 + hud.measure(`> ${text}`);
        batch.rect(cx, y - 1, 1, 9, 0xffffff, 0.9);
      }
    }
  }

  /** Handles arrow-key history while the bar is open. */
  key(code) {
    if (!this.open) return false;
    if (code === 'ArrowUp' && this.sentHistory.length) {
      this.historyIndex = Math.min(this.sentHistory.length - 1, this.historyIndex + 1);
      this.game.controls.textBuffer = this.sentHistory[this.sentHistory.length - 1 - this.historyIndex];
      return true;
    }
    if (code === 'ArrowDown') {
      this.historyIndex = Math.max(-1, this.historyIndex - 1);
      this.game.controls.textBuffer = this.historyIndex < 0
        ? ''
        : this.sentHistory[this.sentHistory.length - 1 - this.historyIndex];
      return true;
    }
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* commands                                                          */
/* ------------------------------------------------------------------ */

/** Parses a coordinate that may be relative (`~`, `~5`). */
function coord(token, current) {
  if (token === undefined) return current;
  if (token.startsWith('~')) {
    const offset = token.length > 1 ? Number(token.slice(1)) : 0;
    if (Number.isNaN(offset)) throw new Error(`bad coordinate "${token}"`);
    return current + offset;
  }
  const v = Number(token);
  if (Number.isNaN(v)) throw new Error(`bad coordinate "${token}"`);
  return v;
}

export const COMMANDS = {
  help: {
    usage: '/help',
    describeKey: 'cmd.help',
    run(game, args, chat) {
      chat.info(t('chat.commands'));
      for (const [name, cmd] of Object.entries(COMMANDS)) {
        chat.info(`  ${cmd.usage} - ${t(cmd.describeKey)}`);
        void name;
      }
    },
  },

  gamemode: {
    usage: '/gamemode <survival|creative|spectator>',
    describeKey: 'cmd.gamemode',
    run(game, args, chat) {
      const mode = (args[0] ?? '').toLowerCase();
      const resolved = { s: 'survival', c: 'creative', sp: 'spectator', 0: 'survival', 1: 'creative' }[mode] ?? mode;
      if (!Object.values(GAME_MODE).includes(resolved)) {
        chat.error(t('chat.unknownMode', { mode }));
        return;
      }
      game.player.setMode(resolved);
      chat.success(t('chat.modeSet', { mode: modeName(resolved) }));
    },
  },

  time: {
    usage: '/time <set|add> <value>',
    describeKey: 'cmd.time',
    run(game, args, chat) {
      const [action, value] = args;
      if (action === 'add') {
        game.day.time += Number(value) || 0;
        chat.success(t('chat.timeAdded', { value }));
        return;
      }
      const target = value ?? action;
      const ticks = TIME_PRESETS[target] ?? Number(target);
      if (Number.isNaN(ticks)) { chat.error(t('chat.unknownTime', { value: target })); return; }
      game.day.setTime(ticks);
      chat.success(t('chat.timeSet', { value: `${target} (${Math.floor(ticks)})` }));
    },
  },

  daylight: {
    usage: '/daylight <on|off>',
    describeKey: 'cmd.daylight',
    run(game, args, chat) {
      const on = (args[0] ?? 'on') !== 'off';
      game.day.frozen = !on;
      chat.success(on ? t('chat.daylightOn') : t('chat.daylightOff'));
    },
  },

  tp: {
    usage: '/tp <x> <y> <z>',
    describeKey: 'cmd.tp',
    run(game, args, chat) {
      const p = game.player;
      const x = coord(args[0], p.x);
      const y = coord(args[1], p.y);
      const z = coord(args[2], p.z);
      p.setPosition(x, y, z);
      chat.success(t('chat.teleported', { x: x.toFixed(1), y: y.toFixed(1), z: z.toFixed(1) }));
    },
  },

  give: {
    usage: '/give <item> [count]',
    describeKey: 'cmd.give',
    run(game, args, chat) {
      const name = (args[0] ?? '').replace(/^minecraft:/, '');
      const item = itemsByName.get(name);
      if (!item) { chat.error(t('chat.unknownItem', { name })); return; }
      const count = Math.max(1, Math.min(6400, Number(args[1] ?? 1) || 1));
      const left = game.player.inventory.addItem(item.id, count);
      const itemLabel = entryName(item.name, item.displayName);
      chat.success(left
        ? t('chat.gavePartial', { n: count - left, item: itemLabel, left })
        : t('chat.gave', { n: count - left, item: itemLabel }));
    },
  },

  clear: {
    usage: '/clear',
    describeKey: 'cmd.clear',
    run(game, args, chat) {
      game.player.inventory.clear();
      chat.success(t('chat.cleared'));
    },
  },

  seed: {
    usage: '/seed',
    describeKey: 'cmd.seed',
    run(game, args, chat) {
      chat.info(t('chat.seedIs', { seed: game.world.seed, type: game.world.worldType }));
    },
  },

  kill: {
    usage: '/kill',
    describeKey: 'cmd.kill',
    run(game, args, chat) {
      game.player.health = 0;
      game.player.die();
      chat.info(t('chat.ouch'));
    },
  },

  heal: {
    usage: '/heal',
    describeKey: 'cmd.heal',
    run(game, args, chat) {
      game.player.health = 20;
      game.player.hunger = 20;
      game.player.saturation = 5;
      chat.success(t('chat.healed'));
    },
  },

  weather: {
    usage: '/weather <clear|rain|snow>',
    describeKey: 'cmd.weather',
    run(game, args, chat) {
      const kind = (args[0] ?? 'clear').toLowerCase();
      if (!['clear', 'rain', 'snow'].includes(kind)) { chat.error(t('chat.unknownWeather', { kind })); return; }
      game.setWeather(kind);
      chat.success(t('chat.weatherSet', { kind: weatherName(kind) }));
    },
  },

  fill: {
    usage: '/fill <x1 y1 z1> <x2 y2 z2> <block>',
    describeKey: 'cmd.fill',
    run(game, args, chat) {
      if (args.length < 7) { chat.error(t('chat.fillUsage')); return; }
      const p = game.player;
      const x1 = Math.floor(coord(args[0], p.x)); const y1 = Math.floor(coord(args[1], p.y)); const z1 = Math.floor(coord(args[2], p.z));
      const x2 = Math.floor(coord(args[3], p.x)); const y2 = Math.floor(coord(args[4], p.y)); const z2 = Math.floor(coord(args[5], p.z));
      const name = args[6].replace(/^minecraft:/, '');
      const block = name === 'air' ? { id: 0 } : blocksByName.get(name);
      if (!block) { chat.error(t('chat.unknownBlock', { name })); return; }
      const volume = (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1) * (Math.abs(z2 - z1) + 1);
      if (volume > 32768) { chat.error(t('chat.fillTooBig', { n: volume, limit: 32768 })); return; }
      let placed = 0;
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++) {
          for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (game.world.setBlock(x, y, z, block.id)) placed++;
          }
        }
      }
      chat.success(t('chat.filled', { n: placed, block: entryName(name) }));
    },
  },

  setblock: {
    usage: '/setblock <x> <y> <z> <block>',
    describeKey: 'cmd.setblock',
    run(game, args, chat) {
      const p = game.player;
      const x = Math.floor(coord(args[0], p.x));
      const y = Math.floor(coord(args[1], p.y));
      const z = Math.floor(coord(args[2], p.z));
      const name = (args[3] ?? '').replace(/^minecraft:/, '');
      const block = name === 'air' ? { id: 0 } : blocksByName.get(name);
      if (!block) { chat.error(t('chat.unknownBlock', { name })); return; }
      game.world.setBlock(x, y, z, block.id);
      chat.success(t('chat.setBlock', { x, y, z, block: entryName(name) }));
    },
  },

  spawn: {
    usage: '/spawn',
    describeKey: 'cmd.spawn',
    run(game, args, chat) {
      game.player.setPosition(game.spawnPoint.x, game.spawnPoint.y, game.spawnPoint.z);
      chat.success(t('chat.atSpawn'));
    },
  },

  save: {
    usage: '/save',
    describeKey: 'cmd.save',
    run(game, args, chat) {
      game.saveWorld().then(() => chat.success(t('chat.saved'))).catch((e) => chat.error(e.message));
    },
  },

  summon: {
    usage: '/summon <pig|cow|sheep|chicken|zombie|creeper|skeleton>',
    describeKey: 'cmd.summon',
    run(game, args, chat) {
      const kind = (args[0] ?? 'pig').toLowerCase();
      const ok = game.summonMob(kind);
      if (ok) chat.success(t('chat.summoned', { kind: mobName(kind) }));
      else chat.error(t('chat.unknownMob', { kind }));
    },
  },

  gamerule: {
    usage: '/gamerule <name> [value]',
    describeKey: 'cmd.gamerule',
    run(game, args, chat) {
      const [name, value] = args;
      if (!name) {
        chat.info(t('chat.rules', { list: Object.keys(game.rules).join(', ') }));
        return;
      }
      if (!(name in game.rules)) { chat.error(t('chat.unknownRule', { name })); return; }
      if (value === undefined) { chat.info(`${name} = ${game.rules[name]}`); return; }
      game.rules[name] = value === 'true' || value === '1';
      chat.success(`${name} = ${game.rules[name]}`);
    },
  },
};

export { getItem };
