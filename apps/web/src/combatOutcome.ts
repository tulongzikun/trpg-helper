import type { Battle, Side } from './battle.ts';

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat' | 'draw';

function aliveOn(battle: Battle, side: Side): number {
  return battle.actors.filter(actor => actor.side === side && (actor.combat?.status ?? 'active') !== 'dead' && actor.combat?.fled !== true && actor.combat?.surrendered !== true && actor.currentHp > 0).length;
}

function standingOn(battle: Battle, side: Side): number {
  return battle.actors.filter(actor => actor.side === side && (actor.combat?.status ?? 'active') === 'active' && actor.combat?.fled !== true && actor.combat?.surrendered !== true && actor.currentHp > 0).length;
}

/** 判断战斗走向：一方全部阵亡即分出胜负；双方都在场视为进行中。 */
export function battleOutcome(battle: Battle): BattleOutcome {
  const enemyAlive = aliveOn(battle, '敌方');
  const allyAlive = aliveOn(battle, '友方');
  if (enemyAlive === 0 && allyAlive === 0) return 'draw';
  if (enemyAlive === 0) return 'victory';
  if (allyAlive === 0) return 'defeat';
  return 'ongoing';
}

export function outcomeLabel(outcome: BattleOutcome): string {
  if (outcome === 'victory') return '战斗结束：敌方已全部倒下。';
  if (outcome === 'defeat') return '战斗结束：友方已全部倒下。';
  if (outcome === 'draw') return '战斗结束：双方同归于尽。';
  return '战斗进行中。';
}

/** 是否还有单位可以行动（用于自动推进的终止条件）。 */
export function hasActingSide(battle: Battle, side: Side): boolean {
  return standingOn(battle, side) > 0;
}
