import { damageActor, rollDamage, toggleCondition } from './combat.ts';
import type { CombatDeps } from './combat.ts';
import type { Actor, Battle } from './battle';

/** 每 10 尺 1d6，最多 20d6；不足 10 尺不造成伤害。 */
export function fallDiceCount(feet: number): number {
  if (!Number.isFinite(feet) || feet < 10) return 0;
  return Math.min(20, Math.floor(feet / 10));
}

export function fallDamageExpression(feet: number): string | null {
  const count = fallDiceCount(feet);
  return count > 0 ? `${count}d6` : null;
}

function strengthScore(actor: Actor): number {
  return actor.characterSnapshot?.sheet?.abilities.str ?? actor.template.abilities?.str ?? 10;
}

function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export type JumpKind = 'long' | 'high';

/** 跳远 = 力量值尺；跳高 = 3 + 力量调整值尺；没有助跑时减半（向下取整）。 */
export function jumpDistance(actor: Actor, kind: JumpKind, runningStart = true): number {
  const strength = strengthScore(actor);
  const base = kind === 'long' ? strength : Math.max(0, 3 + abilityModifier(strength));
  return runningStart ? base : Math.floor(base / 2);
}

export type FallResult = { battle: Battle; damage: number; expression: string | null };

/** 结算坠落：掷坠落伤害、按钝击结算抗性，并让单位倒地。 */
export function applyFallDamage(battle: Battle, actorId: string, feet: number, deps: CombatDeps = {}): FallResult {
  if (!Number.isFinite(feet) || feet < 0) throw new Error('坠落高度无效。');
  const expression = fallDamageExpression(feet);
  if (!expression) return { battle, damage: 0, expression: null };
  const roll = rollDamage(expression, deps.random ?? Math.random);
  const hit = damageActor(battle, actorId, roll.total, '钝击', deps);
  const actor = hit.battle.actors.find(item => item.id === actorId);
  const prone = actor && !actor.combat?.conditions.includes('倒地') && actor.combat?.status === 'active';
  const after = prone ? toggleCondition(hit.battle, actorId, '倒地', deps) : hit.battle;
  return { battle: after, damage: roll.total, expression };
}

/** 坠落平均伤害，用于界面提示（不掷骰）。 */
export function fallAverageDamage(feet: number): number {
  const count = fallDiceCount(feet);
  return Math.round(count * 3.5);
}
