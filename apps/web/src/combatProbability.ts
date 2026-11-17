import type { AttackMode } from './combatModifiers.ts';

/** 单次 d20 命中判定的概率（含天然 20 必中、天然 1 必失）。 */
export function hitProbability(attackBonus: number, targetAc: number, mode: AttackMode = 'normal'): number {
  let hits = 0;
  for (let face = 1; face <= 20; face++) {
    const hit = face === 20 || (face !== 1 && face + attackBonus >= targetAc);
    if (hit) hits += 1;
  }
  const single = hits / 20;
  if (mode === 'advantage') return 1 - (1 - single) * (1 - single);
  if (mode === 'disadvantage') return single * single;
  return single;
}

/** 骰式的期望值，如 2d6+3 → 10。 */
export function averageDamageOf(expression: string): number {
  const match = /^\s*(\d{1,2})\s*d\s*(\d{1,3})\s*([+-]\s*\d{1,3})?\s*$/i.exec(expression);
  if (!match) return 0;
  const count = Number(match[1]);
  const faces = Number(match[2]);
  const flat = match[3] ? Number(match[3].replace(/\s/g, '')) : 0;
  return count * ((faces + 1) / 2) + flat;
}

/** 期望伤害 = 命中率 × 骰式期望，保留一位小数。 */
export function expectedDamage(attackBonus: number, targetAc: number, mode: AttackMode, expression: string): number {
  const value = hitProbability(attackBonus, targetAc, mode) * averageDamageOf(expression);
  return Math.round(value * 10) / 10;
}

/** 面向界面的百分比文案，如「60%（优势）」。 */
export function hitChanceLabel(attackBonus: number, targetAc: number, mode: AttackMode): string {
  const percent = Math.round(hitProbability(attackBonus, targetAc, mode) * 100);
  const suffix = mode === 'advantage' ? '（优势）' : mode === 'disadvantage' ? '（劣势）' : '';
  return `${percent}%${suffix}`;
}
