import { actorDistance, attack, currentActorId, drinkHealingPotion, endTurn, moveActorToCell, offhandAttack, secondWind } from './combat.ts';
import { hasSecondWind } from './combatModifiers.ts';
import { attackSources } from './attackSources.ts';
import type { CombatDeps } from './combat.ts';
import { suggestAttacks } from './combatAi.ts';
import type { Battle, Position, Side } from './battle';

export type AutoActionKind = 'attack' | 'move' | 'wait';
export type AutoAction = { battle: Battle; kind: AutoActionKind; text: string };
export type AutoTurn = AutoAction & { steps: string[] };

function neighbors(position: Position): Position[] {
  const list: Position[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      list.push({ x: position.x + dx, y: position.y + dy });
    }
  }
  return list;
}

/** 动作攻击结束后，如果附赠动作还在且有「轻型」武器，追加一次副手攻击。 */
function offhandFollowUp(battle: Battle, actorId: string, targetId: string, deps: CombatDeps): { battle: Battle } | null {
  const attacker = battle.actors.find(item => item.id === actorId);
  const target = battle.actors.find(item => item.id === targetId);
  if (!attacker || !target) return null;
  const state = attacker.combat;
  if (!state || !state.actionUsed || state.bonusUsed) return null;
  if (target.combat?.status !== 'active') return null;
  const source = attackSources(attacker).find(item => item.properties?.includes('轻型'));
  if (!source) return null;
  try {
    const result = offhandAttack(battle, {
      attackerId: actorId,
      targetId,
      attackBonus: source.attackBonus,
      damageExpression: source.damageExpression,
      damageType: source.damageType,
      range: 'melee',
      weaponId: source.id,
    }, deps);
    return { battle: result.battle };
  } catch {
    return null;
  }
}

/** 生命值低于三分之一时先自救：战士用回气，其他人喝治疗药水。 */
function selfCare(battle: Battle, actorId: string, deps: CombatDeps): AutoAction | null {
  const actor = battle.actors.find(item => item.id === actorId);
  if (!actor || actor.combat?.status !== 'active') return null;
  if (actor.currentHp > Math.floor(actor.maxHp / 3)) return null;
  if (hasSecondWind(actor) && actor.combat?.secondWindUsed !== true) {
    try {
      const result = secondWind(battle, actorId, deps);
      return { battle: result.battle, kind: 'attack', text: `自动行动：生命值偏低，使用回气恢复 ${result.healed} 点生命值。` };
    } catch {
      /* 回气不可用时继续尝试药水 */
    }
  }
  if (actor.combat?.actionUsed) return null;
  try {
    const result = drinkHealingPotion(battle, actorId, deps);
    return { battle: result.battle, kind: 'attack', text: `自动行动：生命值偏低，饮下治疗药水恢复 ${result.healed} 点生命值。` };
  } catch {
    return null;
  }
}

export function autoAct(battle: Battle, actorId: string, deps: CombatDeps = {}): AutoAction {
  if (currentActorId(battle) !== actorId) throw new Error('只有当前回合的单位可以自动行动。');
  const care = selfCare(battle, actorId, deps);
  if (care) return care;
  const suggestions = suggestAttacks(battle, actorId, 6);
  if (!suggestions.length) return { battle, kind: 'wait', text: '自动行动：没有可攻击的敌人，原地待命。' };
  const ready = suggestions.find(item => item.inRange);
  if (ready) {
    const result = attack(battle, {
      attackerId: actorId,
      targetId: ready.targetId,
      attackBonus: ready.source.attackBonus,
      damageExpression: ready.source.damageExpression,
      damageType: ready.source.damageType,
      range: ready.source.range,
      distanceFt: ready.distanceFt ?? ready.source.distanceFt,
      weaponId: ready.source.id,
    }, deps);
    const followUp = offhandFollowUp(result.battle, actorId, ready.targetId, deps);
    return {
      battle: followUp?.battle ?? result.battle,
      kind: 'attack',
      text: followUp
        ? `自动行动：攻击 ${ready.targetName}（${ready.source.label}），并用副手武器追加一次攻击。`
        : `自动行动：攻击 ${ready.targetName}（${ready.source.label}）。`,
    };
  }
  const best = suggestions[0];
  const actor = battle.actors.find(item => item.id === actorId);
  const target = battle.actors.find(item => item.id === best.targetId);
  if (!battle.grid || !actor?.position || !target?.position) {
    return { battle, kind: 'wait', text: `自动行动：${best.targetName} 不在射程内，且没有方格战场可移动，原地待命。` };
  }
  const current = actorDistance(battle, actorId, best.targetId) ?? Number.POSITIVE_INFINITY;
  const candidates = neighbors(actor.position)
    .filter(cell => cell.x >= 0 && cell.y >= 0 && cell.x < battle.grid!.width && cell.y < battle.grid!.height)
    .filter(cell => !battle.actors.some(item => item.id !== actorId && item.position?.x === cell.x && item.position?.y === cell.y))
    .filter(cell => !(battle.walls ?? []).some(wall => wall.x === cell.x && wall.y === cell.y))
    .map(cell => ({ cell, distance: Math.max(Math.abs(cell.x - target.position!.x), Math.abs(cell.y - target.position!.y)) * battle.grid!.cellFt }))
    .filter(entry => entry.distance < current)
    .sort((a, b) => a.distance - b.distance);
  if (!candidates.length) return { battle, kind: 'wait', text: `自动行动：无法靠近 ${best.targetName}，原地待命。` };
  for (const candidate of candidates) {
    try {
      const moved = moveActorToCell(battle, actorId, candidate.cell.x, candidate.cell.y, deps);
      return { battle: moved, kind: 'move', text: `自动行动：向 ${best.targetName} 移动到 (${candidate.cell.x}, ${candidate.cell.y})。` };
    } catch {
      continue;
    }
  }
  return { battle, kind: 'wait', text: `自动行动：移动力不足，无法靠近 ${best.targetName}。` };
}

export type AutoTurnOptions = { endTurn?: boolean; maxSteps?: number };

/** 自动完成一整轮：先靠近再攻击，必要时结束回合。 */
export function autoTurn(battle: Battle, actorId: string, deps: CombatDeps = {}, options: AutoTurnOptions = {}): AutoTurn {
  if (currentActorId(battle) !== actorId) throw new Error('只有当前回合的单位可以自动行动。');
  const steps: string[] = [];
  let current = battle;
  let kind: AutoActionKind = 'wait';
  const maxSteps = Math.max(1, Math.min(12, options.maxSteps ?? 8));
  for (let index = 0; index < maxSteps; index++) {
    const actor = current.actors.find(item => item.id === actorId);
    if (!actor || actor.combat?.actionUsed) break;
    if (currentActorId(current) !== actorId) break;
    const step = autoAct(current, actorId, deps);
    steps.push(step.text);
    current = step.battle;
    kind = step.kind;
    if (step.kind === 'wait') break;
  }
  if (!steps.length) steps.push('自动行动：没有可执行的动作，原地待命。');
  if (options.endTurn !== false && currentActorId(current) === actorId) {
    current = endTurn(current, deps);
    steps.push('自动行动：结束回合。');
  }
  return { battle: current, kind, text: steps.join(' '), steps };
}

export type AutoSideOptions = { maxTurns?: number };

/** 连续推进同一阵营的回合，直到轮到其他阵营或达到上限。 */
export function autoSide(battle: Battle, side: Side, deps: CombatDeps = {}, options: AutoSideOptions = {}): { battle: Battle; turns: string[] } {
  if (!battle.combat) throw new Error('战斗尚未开始。');
  const turns: string[] = [];
  let current = battle;
  const maxTurns = Math.max(1, Math.min(30, options.maxTurns ?? 10));
  for (let index = 0; index < maxTurns; index++) {
    const actorId = currentActorId(current);
    if (!actorId) break;
    const actor = current.actors.find(item => item.id === actorId);
    if (!actor || actor.side !== side || actor.combat?.status !== 'active') break;
    const result = autoTurn(current, actorId, deps);
    turns.push(`${actor.name}：${result.text}`);
    current = result.battle;
    if (currentActorId(current) === actorId) break;
  }
  return { battle: current, turns };
}
