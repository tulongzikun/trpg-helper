import type { Actor, Battle } from './battle.ts';
import type { AttackSource } from './attackSources.ts';
import { attackSources } from './attackSources.ts';
import { actorDistance, hasLineOfSight } from './combat.ts';

export type AttackSuggestion = {
  targetId: string;
  targetName: string;
  source: AttackSource;
  distanceFt: number | null;
  inRange: boolean;
  score: number;
  reason: string;
};

/** 平均伤害：取骰子期望值加固定加值，用于给建议排序。 */
export function averageDamage(expression: string): number {
  const match = /^\s*(\d{1,2})\s*d\s*(\d{1,3})\s*([+-]\s*\d{1,3})?\s*$/i.exec(expression);
  if (!match) return 0;
  const count = Number(match[1]);
  const faces = Number(match[2]);
  const flat = match[3] ? Number(match[3].replace(/\s+/g, '')) : 0;
  return Math.round((count * (faces + 1)) / 2 + flat);
}

/** 给当前行动者列出可执行的攻击建议，按「能打、血少、伤害高、距离近」排序。 */
export function suggestAttacks(battle: Battle, actorId: string, limit = 3): AttackSuggestion[] {
  const actor = battle.actors.find(item => item.id === actorId);
  if (!actor?.combat || actor.combat.status !== 'active') return [];
  const sources = attackSources(actor);
  const enemies = battle.actors.filter(item => item.id !== actor.id && item.combat?.status === 'active' && item.side !== '中立' && item.side !== actor.side);
  const suggestions: AttackSuggestion[] = [];
  for (const enemy of enemies) {
    for (const source of sources) {
      const distanceFt = actorDistance(battle, actor.id, enemy.id) ?? null;
      const average = averageDamage(source.damageExpression);
      let inRange: boolean;
      let reason: string;
      if (distanceFt === null) {
        inRange = true;
        reason = `未启用方格：按手工距离使用「${source.label}」，平均 ${average} 点伤害。`;
      } else if (source.range === 'melee') {
        inRange = distanceFt <= source.distanceFt;
        reason = inRange
          ? `距离 ${distanceFt} 尺，在「${source.label}」的触及范围（${source.distanceFt} 尺）内，平均 ${average} 点伤害。`
          : `距离 ${distanceFt} 尺，需要再靠近 ${distanceFt - source.distanceFt} 尺才能触及。`;
      } else {
        const sight = actor.position && enemy.position ? hasLineOfSight(battle, actor.position, enemy.position) : true;
        inRange = sight && distanceFt <= 600;
        reason = !sight
          ? `距离 ${distanceFt} 尺，但视线被墙体阻挡。`
          : inRange
            ? `距离 ${distanceFt} 尺，在「${source.label}」的射程内，平均 ${average} 点伤害。`
            : `距离 ${distanceFt} 尺，超出「${source.label}」的射程。`;
      }
      const hpRatio = enemy.maxHp > 0 ? enemy.currentHp / enemy.maxHp : 0;
      // 能一击打掉的残血目标优先：命中期望 ≥ 剩余生命值时额外加权。
      const finisher = inRange && average >= enemy.currentHp;
      const score = Math.round(((inRange ? 1000 : 0) + (1 - hpRatio) * 100 + average * 2 - (distanceFt ?? 0) * 0.2 + (finisher ? 300 : 0)) * 10) / 10;
      suggestions.push({ targetId: enemy.id, targetName: enemy.name, source, distanceFt, inRange, score, reason });
    }
  }
  return suggestions.sort((left, right) => right.score - left.score || left.targetName.localeCompare(right.targetName)).slice(0, Math.max(1, limit));
}

/** 当前行动者是否有能立即执行（无需先移动）的攻击。 */
export function hasImmediateAttack(battle: Battle, actorId: string): boolean {
  return suggestAttacks(battle, actorId, 50).some(item => item.inRange);
}

export type { Actor };
