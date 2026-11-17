import { appendLog, areaSave, attack, currentActorId, spendResource, startConcentration } from './combat.ts';
import type { CombatDeps } from './combat.ts';
import type { Ability } from './characters';
import type { Battle, DamageType } from './battle';

export type SpellAttackPlan = {
  targetId: string;
  attackBonus: number;
  damageExpression: string;
  damageType: DamageType;
};

export type SpellSavePlan = {
  ability: Ability;
  dc: number;
  targetIds: string[];
  damageExpression: string;
  damageType: DamageType;
  halfOnSuccess?: boolean;
};

export type SpellCastOptions = {
  casterId: string;
  spell: string;
  level: number;
  cost?: 'action' | 'bonus';
  concentration?: boolean;
  attack?: SpellAttackPlan;
  save?: SpellSavePlan;
};

export type SpellCastResult = { battle: Battle; results: string[] };

/**
 * 施放法术：消耗动作/附赠动作，按攻击检定或豁免结算伤害，可选建立专注。
 * 法术位与已知法术不在引擎内校验，由上层界面负责。
 */
export function castSpell(battle: Battle, options: SpellCastOptions, deps: CombatDeps = {}): SpellCastResult {
  const spell = options.spell?.trim() ?? '';
  if (!spell) throw new Error('请填写法术名称。');
  if (!Number.isInteger(options.level) || options.level < 0 || options.level > 9) throw new Error('法术环阶须为 0 至 9 的整数。');
  const caster = battle.actors.find(actor => actor.id === options.casterId);
  if (!caster) throw new Error('施法者不存在。');
  if (!battle.combat) throw new Error('战斗尚未开始。');
  if (caster.combat?.status !== 'active') throw new Error('只有在场的单位可以施法。');
  if (currentActorId(battle) !== options.casterId) throw new Error('只有当前回合的单位可以施法。');
  const hasAttack = Boolean(options.attack);
  const hasSave = Boolean(options.save);
  if (hasAttack === hasSave) throw new Error('请选择法术的结算方式（攻击检定或豁免）。');
  const cost = options.cost ?? 'action';
  const start = battle.combat.log.length;
  let next = appendLog(battle, `${caster.name} 施放「${spell}」${options.level > 0 ? `（${options.level} 环）` : '（戏法）'}。`, deps);
  if (options.attack) {
    next = attack(next, {
      attackerId: options.casterId,
      targetId: options.attack.targetId,
      attackBonus: options.attack.attackBonus,
      damageExpression: options.attack.damageExpression,
      damageType: options.attack.damageType,
      cost,
    }, deps).battle;
  } else if (options.save) {
    next = spendResource(next, options.casterId, cost, deps);
    next = areaSave(next, {
      targetIds: options.save.targetIds,
      ability: options.save.ability,
      dc: options.save.dc,
      damageExpression: options.save.damageExpression,
      damageType: options.save.damageType,
      ...(options.save.halfOnSuccess === false ? { halfOnSuccess: false } : {}),
    }, deps).battle;
  }
  if (options.concentration) {
    next = startConcentration(next, options.casterId, spell, deps);
  }
  const results = (next.combat?.log ?? []).slice(start).map(entry => entry.text);
  return { battle: next, results };
}
