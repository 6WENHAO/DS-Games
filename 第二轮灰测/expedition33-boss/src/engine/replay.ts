import { BattleEngine, type BattleLogFile } from './battle';

/**
 * 用导出的战斗日志重放同一场战斗。
 * 相同种子 + 相同输入时间 => 相同 AI 选择、暴击、伤害浮动。
 */
export function replayFromLog(log: BattleLogFile): BattleEngine {
  const e = new BattleEngine({ difficulty: log.difficulty, seed: log.seed });
  e.start();
  for (const inp of log.inputs) {
    e.advanceTo(inp.t);
    const d = (inp.data || {}) as Record<string, string | null>;
    switch (inp.kind) {
      case 'command':
        e.chooseCommand(d.kind as 'attack' | 'skill' | 'aim' | 'item');
        break;
      case 'skill':
        e.chooseSkill(d.skillId as string);
        break;
      case 'item':
        e.chooseItem(d.itemId as string);
        break;
      case 'target':
        e.chooseTarget(d.targetId as string);
        break;
      case 'press':
        e.pressSpace();
        break;
      case 'back':
        e.back();
        break;
      case 'aimShot':
        e.aimShot((d.weakPointId as string) || null);
        break;
      case 'aimEnd':
        e.exitAim();
        break;
      default:
        break;
    }
  }
  let guard = 0;
  while (e.state.outcome === 'none' && guard++ < 20000) e.advance(100);
  return e;
}

export function serializeLog(log: BattleLogFile): string {
  return JSON.stringify(log);
}

export function parseLog(text: string): BattleLogFile {
  const parsed = JSON.parse(text) as BattleLogFile;
  if (!parsed || typeof parsed.seed !== 'number' || !Array.isArray(parsed.inputs)) {
    throw new Error('战斗日志格式不正确');
  }
  return parsed;
}
