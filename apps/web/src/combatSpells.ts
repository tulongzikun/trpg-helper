import { appendLog, areaSave, attack, currentActorId, spendResource, startConcentration } from './combat.ts';
import type { CombatDeps } from './combat.ts';
import type { Ability } from './characters';
import type { Battle, DamageType, Position } from './battle';

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

export type SpellAreaShape = 'sphere' | 'cone' | 'line' | 'cube';

/** 依据方格战场把法术范围换算成受影响的单位 id（不含施法者，含友军）。 */
export function spellAreaTargets(battle: Battle, casterId: string, shape: SpellAreaShape, sizeFt: number, direction?: Position): string[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!battle.grid || !caster?.position) throw new Error('请先启用方格战场并把施法者放到棋盘上。');
  if (shape !== 'sphere' && shape !== 'cone' && shape !== 'line' && shape !== 'cube') throw new Error('法术范围形状无效。');
  if (!Number.isInteger(sizeFt) || sizeFt < 5 || sizeFt > 120 || sizeFt % 5 !== 0) throw new Error('范围尺寸须为 5 至 120 尺的整数。');
  const grid = battle.grid;
  const origin = caster.position;
  const cellFt = grid.cellFt;
  let dir: { dx: number; dy: number } | null = null;
  if (shape === 'cone' || shape === 'line') {
    const fallback = battle.actors.filter(item => item.id !== casterId && item.side !== caster.side && item.side !== '中立' && item.position && item.combat?.status === 'active').map(item => item.position!)[0];
    const aim = direction ?? fallback;
    if (!aim) throw new Error('锥形与线形范围需要一个方向。');
    const raw = { dx: aim.x - origin.x, dy: aim.y - origin.y };
    if (raw.dx === 0 && raw.dy === 0) throw new Error('锥形与线形范围需要一个方向。');
    dir = raw;
  }
  return battle.actors
    .filter(item => item.id !== casterId && item.combat?.status === 'active' && !!item.position)
    .filter(item => {
      const offset = { dx: item.position!.x - origin.x, dy: item.position!.y - origin.y };
      const feet = Math.hypot(offset.dx, offset.dy) * cellFt;
      if (shape === 'sphere') return feet <= sizeFt;
      if (shape === 'cube') return Math.max(Math.abs(offset.dx), Math.abs(offset.dy)) * cellFt <= sizeFt;
      if (!dir) return false;
      const length = Math.hypot(dir.dx, dir.dy);
      const projection = (offset.dx * dir.dx + offset.dy * dir.dy) / length;
      if (shape === 'line') {
        const perpendicular = Math.abs(offset.dx * dir.dy - offset.dy * dir.dx) / length;
        return projection >= 0 && projection * cellFt <= sizeFt && perpendicular <= 0.5;
      }
      const offsetLength = Math.hypot(offset.dx, offset.dy);
      if (offsetLength === 0) return false;
      const angle = (Math.acos(((offset.dx * dir.dx + offset.dy * dir.dy) / (offsetLength * length))) * 180) / Math.PI;
      return feet <= sizeFt && angle <= 45.0001;
    })
    .map(item => item.id);
}


/** 记录或更新某单位的法术位（数组索引 0 为 1 环）。传入空数组表示停止追踪。 */
export function setSpellSlots(battle: Battle, actorId: string, slots: number[], deps: CombatDeps = {}): Battle {
  const next = structuredClone(battle);
  const actor = next.actors.find(item => item.id === actorId);
  if (!actor) throw new Error('该单位不在战斗中。');
  if (!actor.combat) throw new Error('该单位还没有加入战斗。');
  if (!Array.isArray(slots) || slots.length > 9 || slots.some(item => !Number.isInteger(item) || item < 0 || item > 20)) throw new Error('法术位须为 0 至 9 个不超过 20 的非负整数。');
  if (slots.length === 0) {
    delete actor.combat.spellSlots;
    delete actor.combat.spellSlotsMax;
    return appendLog(next, `清除 ${actor.name} 的法术位记录。`, deps);
  }
  actor.combat.spellSlots = slots.slice();
  actor.combat.spellSlotsMax = slots.slice();
  const summary = slots.map((count, index) => count > 0 ? `${count} 个 ${index + 1} 环` : '').filter(Boolean).join(' / ') || '全部为空';
  return appendLog(next, `记录 ${actor.name} 的法术位：${summary}。`, deps);
}

/**
 * 施放法术：消耗动作/附赠动作，按攻击检定或豁免结算伤害，可选建立专注。
 * 若该单位已记录法术位，则会消耗对应环位；未记录时不追踪。
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
  const tracked = caster.combat?.spellSlots;
  if (options.level > 0 && tracked) {
    const remaining = tracked[options.level - 1] ?? 0;
    if (remaining <= 0) throw new Error(`${options.level} 环法术位已经用完。`);
    tracked[options.level - 1] = remaining - 1;
  }
  const start = battle.combat.log.length;
  let next = appendLog(battle, `${caster.name} 施放「${spell}」${options.level > 0 ? `（${options.level} 环）` : '（戏法）'}。`, deps);
  if (options.level > 0 && tracked) next = appendLog(next, `消耗 1 个 ${options.level} 环法术位，剩余 ${tracked[options.level - 1]} 个。`, deps);
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
