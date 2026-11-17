import type { Actor, Battle } from './battle';

/** 2024 版挑战等级对应的经验值。 */
const xpByCr: Record<string, number> = {
  '0': 10,
  '1/8': 25,
  '1/4': 50,
  '1/2': 100,
  '1': 200,
  '2': 450,
  '3': 700,
  '4': 1100,
  '5': 1800,
  '6': 2300,
  '7': 2900,
  '8': 3900,
  '9': 5000,
  '10': 5900,
  '11': 7200,
  '12': 8400,
  '13': 10000,
  '14': 11500,
  '15': 13000,
  '16': 15000,
  '17': 18000,
  '18': 20000,
  '19': 22000,
  '20': 25000,
  '21': 33000,
  '22': 41000,
  '23': 50000,
  '24': 62000,
  '25': 75000,
  '26': 90000,
  '27': 105000,
  '28': 120000,
  '29': 135000,
  '30': 155000,
};

function normalizeCr(value: string | number | undefined): string {
  if (value === undefined) return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    const fraction = value === 0 ? '0' : value === 0.125 ? '1/8' : value === 0.25 ? '1/4' : value === 0.5 ? '1/2' : String(value);
    return fraction;
  }
  const text = value.trim();
  if (!text) return '';
  if (text.includes('/')) {
    const [numerator, denominator] = text.split('/').map(Number);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return '';
    return normalizeCr(numerator / denominator);
  }
  const numeric = Number(text);
  return Number.isFinite(numeric) ? normalizeCr(numeric) : '';
}

/** 挑战等级换算经验值；无法识别时返回 0。 */
export function crXp(cr: string | number | undefined): number {
  const key = normalizeCr(cr);
  return key ? (xpByCr[key] ?? 0) : 0;
}

export function defeatedActors(battle: Battle): Actor[] {
  return battle.actors.filter(actor => actor.combat?.status === 'dead' || actor.combat?.surrendered === true);
}

/** 已击败单位的经验总和（同一怪物多只分别计算）。 */
export function encounterXp(battle: Battle): number {
  return defeatedActors(battle).reduce((total, actor) => total + crXp((actor.template as { challengeRating?: string }).challengeRating), 0);
}

/** 敌方仍存活（未死亡）的单位。 */
function survivors(battle: Battle): Actor[] {
  return battle.actors.filter(actor => actor.side === '敌方' && actor.combat?.status !== 'dead' && actor.combat?.surrendered !== true && actor.combat?.fled !== true && actor.currentHp > 0);
}

export type EncounterReward = { xp: number; defeated: number; remaining: number; completed: boolean };

export function encounterReward(battle: Battle): EncounterReward {
  const remaining = survivors(battle).length;
  return { xp: encounterXp(battle), defeated: defeatedActors(battle).length, remaining, completed: remaining === 0 };
}

/** 给界面与战报用的一句话战果说明。 */
export function rewardSummary(battle: Battle): string {
  const reward = encounterReward(battle);
  if (!reward.defeated) return reward.remaining ? `尚未击败任何单位，仍有 ${reward.remaining} 个敌方单位在场。` : '战场上没有敌方单位。';
  if (reward.completed) return `战斗结束：击败 ${reward.defeated} 个单位，共 ${reward.xp} 点经验。`;
  return `已击败 ${reward.defeated} 个单位，获得 ${reward.xp} 点经验；仍有 ${reward.remaining} 个敌方单位在场。`;
}
