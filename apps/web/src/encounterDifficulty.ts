import type { Actor, Battle } from './battle.ts';
import { crXp } from './encounterReward.ts';

/**
 * 2024 版《城主指南》的遭遇经验预算表：每名角色每级对应「低 / 中 / 高」三档预算。
 * 遭遇的实际经验值是所有敌对单位挑战等级换算后的总和，与队伍预算总和对比较。
 */
const budgetByLevel: Record<number, { low: number; moderate: number; high: number }> = {
  1: { low: 50, moderate: 75, high: 100 },
  2: { low: 100, moderate: 150, high: 200 },
  3: { low: 150, moderate: 225, high: 400 },
  4: { low: 250, moderate: 375, high: 500 },
  5: { low: 500, moderate: 750, high: 1100 },
  6: { low: 600, moderate: 900, high: 1400 },
  7: { low: 750, moderate: 1100, high: 1700 },
  8: { low: 1000, moderate: 1400, high: 2100 },
  9: { low: 1300, moderate: 1900, high: 2600 },
  10: { low: 1600, moderate: 2400, high: 3100 },
  11: { low: 1900, moderate: 2900, high: 4100 },
  12: { low: 2200, moderate: 3400, high: 4700 },
  13: { low: 2600, moderate: 3900, high: 5400 },
  14: { low: 2900, moderate: 4400, high: 6200 },
  15: { low: 3300, moderate: 5000, high: 7800 },
  16: { low: 3800, moderate: 5700, high: 9800 },
  17: { low: 4500, moderate: 6300, high: 11300 },
  18: { low: 5000, moderate: 6800, high: 13000 },
  19: { low: 5500, moderate: 7500, high: 15000 },
  20: { low: 6000, moderate: 8200, high: 16000 },
};

export type DifficultyLabel = '低' | '中' | '高' | '致命';

export type EncounterDifficulty = {
  /** 仍存活的敌对单位换算出的经验总和。 */
  xp: number;
  /** 队伍预算总和（每名友方单位按其等级累加）。 */
  budget: { low: number; moderate: number; high: number };
  /** 参与计算的友方单位等级，按登场顺序。 */
  levels: number[];
  label: DifficultyLabel;
  /** 实测经验相对「高」档预算的比例（保留两位小数）。 */
  ratio: number;
};

function clampLevel(level: number | undefined): number {
  if (level === undefined || !Number.isFinite(level)) return 1;
  return Math.min(20, Math.max(1, Math.floor(level)));
}

/** 取某等级的预算；越界等级会被夹到 1–20。 */
export function levelBudget(level: number): { low: number; moderate: number; high: number } {
  return { ...budgetByLevel[clampLevel(level)] };
}

function partyActors(battle: Battle): Actor[] {
  return battle.actors.filter(actor => actor.side === '友方');
}

/** 友方单位的等级（角色卡上的等级，怪物按 1 级计）。 */
export function partyLevels(battle: Battle): number[] {
  return partyActors(battle).map(actor => clampLevel(actor.characterSnapshot?.sheet?.level));
}

/** 队伍的总经验预算：每名友方单位按其等级累加三档预算。 */
export function encounterBudget(battle: Battle): { low: number; moderate: number; high: number } {
  const total = { low: 0, moderate: 0, high: 0 };
  for (const level of partyLevels(battle)) {
    const budget = levelBudget(level);
    total.low += budget.low;
    total.moderate += budget.moderate;
    total.high += budget.high;
  }
  return total;
}

/** 仍存活的敌对单位换算出的经验总和（已死亡与中立单位不计）。 */
export function threatXp(battle: Battle): number {
  return battle.actors
    .filter(actor => actor.side === '敌方' && actor.combat?.status !== 'dead')
    .reduce((total, actor) => total + crXp((actor.template as { challengeRating?: string }).challengeRating), 0);
}

function labelFor(xp: number, budget: { low: number; moderate: number; high: number }): DifficultyLabel {
  if (budget.high === 0) return '低';
  if (xp <= budget.low) return '低';
  if (xp <= budget.moderate) return '中';
  if (xp <= budget.high) return '高';
  return '致命';
}

/** 评估当前遭遇的难度：经验总和对照队伍预算，给出低 / 中 / 高 / 致命。 */
export function encounterDifficulty(battle: Battle): EncounterDifficulty {
  const budget = encounterBudget(battle);
  const xp = threatXp(battle);
  const levels = partyLevels(battle);
  return {
    xp,
    budget,
    levels,
    label: labelFor(xp, budget),
    ratio: budget.high === 0 ? 0 : Math.round((xp / budget.high) * 100) / 100,
  };
}

/** 一句话描述当前遭遇难度，供界面与战报复用。 */
export function difficultyText(battle: Battle): string {
  const result = encounterDifficulty(battle);
  if (result.levels.length === 0) return '遭遇难度：暂无队伍成员，无法评估。';
  return `遭遇难度：${result.label}（${result.xp} / 高 ${result.budget.high} 经验）`;
}
