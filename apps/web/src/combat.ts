import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { getBackground } from './backgrounds.ts';
import { gloomStalkerState } from './rangerSubclasses.ts';
import type { Ability } from './characters';
import type { Actor, Battle, CombatLogEntry, CombatStatus, DamageType, GridConfig, OpportunityPrompt, Position, ReadyAction, Side } from './battle';
import type { Card } from './catalog';
import { damageTypes } from './battle.ts';
import { actionBlocker, actionSurgeMax, attackerAdjustment, attacksPerAction, combineAttackModes, coverAcBonus, coverNote, coverTypes, hasSecondWind, isAutomaticCritical, targetAdjustment } from './combatModifiers.ts';
import { attackSources, type AttackSource } from './attackSources.ts';
import type { AttackRange, CoverType, ModeAdjustment } from './combatModifiers.ts';

export type Random = () => number;
export type CombatDeps = { random?: Random; makeId?: () => string };
export type AttackCost = 'action' | 'bonus' | 'reaction';
export type AttackMode = 'normal' | 'advantage' | 'disadvantage';
export type AttackOptions = {
  attackerId: string;
  targetId: string;
  attackBonus: number;
  damageExpression: string;
  damageType: DamageType;
  mode?: AttackMode;
  cost?: AttackCost;
  criticalRange?: number;
  /** 近战或远程；影响倒地目标的检定与自动重击判定，默认近战。 */
  range?: AttackRange;
  /** 与目标的距离（尺），用于 5 尺内对麻痹／昏迷目标的自动重击，默认近战 5、远程 30。 */
  distanceFt?: number;
  /** 近战攻击的触及范围（尺），默认 5；远程忽略。 */
  reachFt?: number;
  /** 目标所处的掩体，影响 AC。 */
  cover?: CoverType;
  autoCover?: boolean;
  /** 借机攻击等场合：跳过方格距离与触及校验（触发时机在离开触及范围的瞬间）。 */
  ignoreDistanceCheck?: boolean;
  /** 使用的攻击来源 id（来自 attackSources），用于武器特性等规则。 */
  weaponId?: string;
  /** 两用武器改用双手持用时的伤害骰（需要 weaponId 指向一把两用武器）。 */
  twoHanded?: boolean;
  /** 附带的额外伤害骰（如猎人印记、至圣斩），随重击一起翻倍。 */
  extraDamageExpression?: string;
  extraDamageType?: DamageType;
  /** 额外伤害骰是否随重击翻倍，默认是（如至圣斩）；猎人印记等亦然。 */
  extraDamageCritical?: boolean;
  /** 一次攻击动作内的攻击次数，默认 1，不能超过该单位的额外攻击次数。 */
  attacks?: number;
};
export type AttackOutcome = {
  natural: number;
  total: number;
  targetAc: number;
  hit: boolean;
  critical: boolean;
  damage: number;
  tempAbsorbed: number;
  targetHp: number;
  status: CombatStatus;
  defense: string;
  mode: AttackMode;
  notes: string[];
  /** 其中来自额外伤害骰（如猎人印记）的部分。 */
  extraDamage: number;
};
export type DamageOutcome = { damage: number; tempAbsorbed: number; status: CombatStatus };
export type DeathSaveOutcome = { natural: number; successes: number; failures: number; status: CombatStatus; revived: boolean };

export const conditions = ['目盲', '魅惑', '耳聋', '力竭', '恐慌', '擒抱', '失能', '隐形', '麻痹', '石化', '中毒', '倒地', '束缚', '昏迷', '稳定'] as const;

const randomOf = (deps: CombatDeps): Random => deps.random ?? Math.random;
const makeIdOf = (deps: CombatDeps): (() => string) => deps.makeId ?? (() => crypto.randomUUID());
const clampRandom = (value: number) => Math.min(Math.max(value, 0), 0.999999999);
export function rollDie(sides: number, random: Random = Math.random): number {
  if (!Number.isInteger(sides) || sides < 2 || sides > 100) throw new Error('骰子面数须为 2 至 100 的整数。');
  return 1 + Math.floor(clampRandom(random()) * sides);
}
type Dice = { count: number; sides: number; modifier: number };
export function parseDice(expression: string): Dice {
  const match = /^\s*(\d{1,2})\s*d\s*(\d{1,3})\s*(?:([+-])\s*(\d{1,3}))?\s*$/i.exec(expression);
  if (!match) throw new Error('伤害骰格式无效，请使用如 2d6+3 的写法。');
  const count = Number(match[1]);
  const sides = Number(match[2]);
  if (count < 1 || count > 20 || sides < 2 || sides > 100) throw new Error('伤害骰超出支持范围（1–20 颗、2–100 面）。');
  const modifier = match[3] ? Number(match[3] + match[4]) : 0;
  return { count, sides, modifier };
}
export function rollDamage(expression: string, random: Random = Math.random, critical = false): { total: number; rolls: number[]; modifier: number } {
  const dice = parseDice(expression);
  const count = critical ? dice.count * 2 : dice.count;
  const rolls = Array.from({ length: count }, () => rollDie(dice.sides, random));
  return { total: rolls.reduce((sum, value) => sum + value, 0) + dice.modifier, rolls, modifier: dice.modifier };
}

function requireCombat(battle: Battle) {
  if (!battle.combat) throw new Error('战斗尚未开始。');
  return battle.combat;
}
function actorOf(battle: Battle, actorId: string): Actor {
  const actor = battle.actors.find(a => a.id === actorId);
  if (!actor) throw new Error('未找到战斗单位。');
  return actor;
}
function combatantOf(actor: Actor) {
  if (!actor.combat) throw new Error('该单位还没有先攻记录，请先开始战斗。');
  return actor.combat;
}
export function currentActorId(battle: Battle): string | null {
  const combat = battle.combat;
  if (!combat) return null;
  return combat.order[combat.turnIndex] ?? null;
}
export function currentActor(battle: Battle): Actor | null {
  const id = currentActorId(battle);
  return id ? battle.actors.find(a => a.id === id) ?? null : null;
}
function addLog(battle: Battle, text: string, deps: CombatDeps, detail?: string) {
  const combat = battle.combat;
  if (!combat) return;
  const entry: CombatLogEntry = { id: makeIdOf(deps)(), round: combat.round, text };
  if (detail) entry.detail = detail;
  combat.log.push(entry);
  if (combat.log.length > 200) combat.log = combat.log.slice(-200);
}
function recordUndo(battle: Battle): Battle {
  const copy = structuredClone(battle);
  if (copy.combat) copy.combat.undo = [];
  if (battle.combat) battle.combat.undo = [...battle.combat.undo, copy].slice(-20);
  return battle;
}
function actorDexModifier(actor: Actor): number {
  const abilities = actor.characterSnapshot?.sheet.abilities ?? actor.template.abilities;
  return typeof abilities?.dex === 'number' ? abilityModifier(abilities.dex) : 0;
}
export function actorLabel(battle: Battle, actor: Actor): string {
  const sameName = battle.actors.filter(item => item.name === actor.name);
  return sameName.length > 1 ? `${actor.name} #${sameName.indexOf(actor) + 1}` : actor.name;
}
export function actorInitiativeBonus(actor: Actor): number {
  const sheet = actor.characterSnapshot?.sheet;
  if (sheet) {
    const config = sheet.details?.fighterCalculator;
    let bonus = abilityModifier(sheet.abilities.dex);
    const backgroundFeat = getBackground(sheet.details?.background)?.feat;
    if (backgroundFeat === '警觉' || config?.humanOriginFeat === '警觉') bonus += proficiencyBonus(sheet.level);
    const gloom = gloomStalkerState(sheet);
    if (gloom) bonus += gloom.initiativeBonus;
    return bonus;
  }
  if (typeof actor.template.initiativeBonus === 'number') return actor.template.initiativeBonus;
  const dex = actor.template.abilities?.dex;
  return typeof dex === 'number' ? abilityModifier(dex) : 0;
}
export function initiativeAdvantage(actor: Actor): boolean {
  const sheet = actor.characterSnapshot?.sheet;
  if (!sheet) return false;
  const config = sheet.details?.fighterCalculator;
  if (sheet.level < 3) return false;
  return (config?.characterClass === '战士' && config.subclass === 'champion') || (config?.characterClass === '游荡者' && config.subclass === 'assassin');
}
export function actorSpeed(actor: Actor): number {
  return actor.characterSnapshot?.sheet.speedFt ?? actor.template.speedFt?.walk ?? 30;
}
export function actorAttackProfile(actor: Actor): { attackBonus: number; damage: string; damageType: DamageType } {
  const abilities = actor.characterSnapshot?.sheet.abilities ?? actor.template.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const level = actor.characterSnapshot?.sheet.level;
  const bonus = level === undefined ? (actor.template.proficiencyBonus ?? 2) : proficiencyBonus(level);
  const str = abilityModifier(abilities.str ?? 10);
  const dex = abilityModifier(abilities.dex ?? 10);
  const best = str >= dex ? str : dex;
  const modifier = best >= 0 ? `+${best}` : `${best}`;
  return { attackBonus: best + bonus, damage: `1d8${modifier}`, damageType: '挥砍' };
}

/** 方格距离：2024 规则中斜向移动同样只算一格。 */
export function cellDistance(from: Position, to: Position): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}
export function positionOf(battle: Battle, actorId: string): Position | undefined {
  return battle.actors.find(actor => actor.id === actorId)?.position;
}
/** 两个单位之间的方格距离（尺）；缺方格或缺位置时返回 undefined。 */
export function actorDistance(battle: Battle, fromId: string, toId: string): number | undefined {
  const grid = battle.grid;
  const from = positionOf(battle, fromId);
  const to = positionOf(battle, toId);
  if (!grid || !from || !to) return undefined;
  return cellDistance(from, to) * grid.cellFt;
}
/** 单位的近战触及范围（尺）：取攻击来源中最远的近战距离，至少 5 尺。 */
export function actorReach(actor: Actor): number {
  const distances = attackSources(actor).filter(source => source.range === 'melee').map(source => source.distanceFt);
  return distances.length ? Math.max(5, ...distances) : 5;
}
/** 移动离开哪些敌对单位的触及范围（用于借机攻击提示）。 */
function threatPrompts(battle: Battle, mover: Actor, from: Position, to: Position): OpportunityPrompt[] {
  const grid = battle.grid;
  if (!grid || mover.side === '中立' || mover.combat?.disengaged) return [];
  return battle.actors
    .filter(other => other.id !== mover.id && other.side !== '中立' && other.side !== mover.side && other.position && other.combat?.status === 'active')
    .filter(other => {
      const reach = actorReach(other);
      const before = cellDistance(other.position!, from) * grid.cellFt;
      const after = cellDistance(other.position!, to) * grid.cellFt;
      return before <= reach && after > reach;
    })
    .map(other => ({ reactorId: other.id, targetId: mover.id }));
}
/** 当前待结算的借机攻击。 */
export function pendingOpportunities(battle: Battle): OpportunityPrompt[] {
  return battle.combat?.pendingOpportunity ?? [];
}
/** 标记为困难地形的格子。 */
export function difficultCells(battle: Battle): Position[] {
  return battle.difficult ?? [];
}
/** 判断某个格子是否困难地形。 */
export function isDifficultCell(battle: Battle, x: number, y: number): boolean {
  return (battle.difficult ?? []).some(cell => cell.x === x && cell.y === y);
}
/** 在方格战场上切换某格的困难地形标记（进入该格移动消耗翻倍）。 */
export function toggleDifficultCell(battle: Battle, x: number, y: number, deps: CombatDeps = {}): Battle {
  const grid = battle.grid;
  if (!grid) throw new Error('请先启用方格战场。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('格子坐标须为整数。');
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) throw new Error('目标格子超出战场范围。');
  const next = recordUndo(structuredClone(battle));
  const list = [...(next.difficult ?? [])];
  const index = list.findIndex(cell => cell.x === x && cell.y === y);
  if (index >= 0) {
    list.splice(index, 1);
    addLog(next, `取消 (${x}, ${y}) 的困难地形。`, deps);
  } else {
    list.push({ x, y });
    addLog(next, `(${x}, ${y}) 标为困难地形。`, deps);
  }
  if (list.length) next.difficult = list;
  else delete next.difficult;
  return next;
}
/** 墙体格子。 */
export function wallCells(battle: Battle): Position[] {
  return battle.walls ?? [];
}
/** 判断某个格子是否为墙体。 */
export function isWallCell(battle: Battle, x: number, y: number): boolean {
  return (battle.walls ?? []).some(cell => cell.x === x && cell.y === y);
}
/** 两点之间（不含端点）经过的格子，按 Chebyshev 距离逐格取整。 */
function lineCells(from: Position, to: Position): Position[] {
  const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  const cells: Position[] = [];
  for (let step = 1; step < steps; step += 1) {
    cells.push({ x: from.x + Math.round((to.x - from.x) * step / steps), y: from.y + Math.round((to.y - from.y) * step / steps) });
  }
  return cells;
}
/** 两格之间是否没有被墙体阻挡的直线视线。 */
export function hasLineOfSight(battle: Battle, from: Position, to: Position): boolean {
  if (!battle.grid) return true;
  return !lineCells(from, to).some(cell => isWallCell(battle, cell.x, cell.y));
}
/** 由墙体与射击线上相邻的遮挡推算掩体等级：贴着一道墙为半掩体，被两处以上夹住为四分之三掩体。 */
export function coverFromWalls(battle: Battle, from: Position, to: Position): CoverType {
  if (!battle.grid) return '无';
  const walls = battle.walls ?? [];
  if (!walls.length) return '无';
  const path = lineCells(from, to);
  const neighbours: Position[] = [...path, from, to];
  const touching = walls.filter(wall => neighbours.some(cell => Math.max(Math.abs(cell.x - wall.x), Math.abs(cell.y - wall.y)) <= 1));
  if (touching.length >= 2) return '四分之三掩体';
  if (touching.length === 1) return '半掩体';
  return '无';
}
/** 在方格战场上切换某格的墙体标记（阻挡移动与远程视线）。 */
export function toggleWallCell(battle: Battle, x: number, y: number, deps: CombatDeps = {}): Battle {
  const grid = battle.grid;
  if (!grid) throw new Error('请先启用方格战场。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('格子坐标须为整数。');
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) throw new Error('目标格子超出战场范围。');
  const next = recordUndo(structuredClone(battle));
  const list = [...(next.walls ?? [])];
  const index = list.findIndex(cell => cell.x === x && cell.y === y);
  if (index >= 0) {
    list.splice(index, 1);
    addLog(next, `拆除 (${x}, ${y}) 的墙体。`, deps);
  } else {
    const occupant = next.actors.find(actor => actor.position?.x === x && actor.position?.y === y);
    if (occupant) throw new Error(`该格已有单位：${occupant.name}，无法设为墙体。`);
    list.push({ x, y });
    addLog(next, `(${x}, ${y}) 设为墙体。`, deps);
  }
  if (list.length) next.walls = list;
  else delete next.walls;
  return next;
}
/** 启用、调整或关闭方格战场；关闭时清除所有位置。 */
export function configureGrid(battle: Battle, grid: GridConfig | null, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  if (grid === null) {
    delete next.grid;
    delete next.difficult;
    delete next.walls;
    next.actors.forEach(actor => { delete actor.position; });
    addLog(next, '关闭方格战场，清除所有单位位置。', deps);
    return next;
  }
  const { width, height, cellFt } = grid;
  if (!Number.isInteger(width) || width < 1 || width > 60) throw new Error('方格宽度须为 1 至 60 的整数。');
  if (!Number.isInteger(height) || height < 1 || height > 60) throw new Error('方格高度须为 1 至 60 的整数。');
  if (!Number.isInteger(cellFt) || cellFt < 5 || cellFt > 30) throw new Error('每格尺数须为 5 至 30 的整数。');
  next.grid = { width, height, cellFt };
  next.actors.forEach(actor => {
    if (actor.position && (actor.position.x >= width || actor.position.y >= height)) delete actor.position;
  });
  if (next.difficult) {
    const kept = next.difficult.filter(cell => cell.x < width && cell.y < height);
    if (kept.length) next.difficult = kept;
    else delete next.difficult;
  }
  if (next.walls) {
    const kept = next.walls.filter(cell => cell.x < width && cell.y < height);
    if (kept.length) next.walls = kept;
    else delete next.walls;
  }
  addLog(next, `方格战场设为 ${width}×${height}，每格 ${cellFt} 尺。`, deps);
  return next;
}
/**
 * 把单位放到格子上；已放置的单位会按移动消耗处理。
 * 未开始战斗时只能放置，不消耗移动。
 */
export function moveActorToCell(battle: Battle, actorId: string, x: number, y: number, deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('格子坐标须为整数。');
  if (x < 0 || y < 0 || x >= battle.grid.width || y >= battle.grid.height) throw new Error('目标格子超出战场范围。');
  const from = positionOf(battle, actorId);
  if (from && from.x === x && from.y === y) throw new Error('单位已经在该格。');
  const occupied = battle.actors.find(actor => actor.id !== actorId && actor.position?.x === x && actor.position?.y === y);
  if (occupied) throw new Error(`该格已有单位：${occupied.name}。`);
  if (isWallCell(battle, x, y)) throw new Error('不能移动到墙体格子。');
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  if (!from) {
    actor.position = { x, y };
    addLog(next, `${actorLabel(next, actor)} 放置在 (${x}, ${y})。`, deps);
    return next;
  }
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以移动。');
  const state = combatantOf(actor);
  if (actor.combat?.conditions.includes('擒抱')) throw new Error('被擒抱的单位无法移动。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (lineCells(from, { x, y }).some(cell => isWallCell(next, cell.x, cell.y))) throw new Error('移动路径被墙体阻挡。');
  const rough = isDifficultCell(next, x, y);
  const cost = cellDistance(from, { x, y }) * next.grid!.cellFt * (rough ? 2 : 1);
  const speed = actorSpeed(actor);
  if (state.movementUsed + cost > speed) throw new Error(`移动距离超出速度上限（${speed} 尺）。`);
  state.movementUsed += cost;
  actor.position = { x, y };
  addLog(next, `${actorLabel(next, actor)} 移动到 (${x}, ${y})，消耗 ${cost} 尺（共 ${state.movementUsed}/${speed} 尺）${rough ? '，困难地形使消耗翻倍' : ''}。`, deps);
  const triggered = threatPrompts(next, actor, from, { x, y });
  if (triggered.length) {
    const combat = requireCombat(next);
    const list = [...(combat.pendingOpportunity ?? [])];
    for (const prompt of triggered) {
      if (list.some(item => item.reactorId === prompt.reactorId && item.targetId === prompt.targetId)) continue;
      list.push(prompt);
      const reactor = actorOf(next, prompt.reactorId);
      addLog(next, `${actorLabel(next, actor)} 离开 ${actorLabel(next, reactor)} 的触及范围，${actorLabel(next, reactor)} 可以借机攻击。`, deps);
    }
    combat.pendingOpportunity = list.slice(-8);
  }
  return next;
}

/** 结算一次借机攻击：消耗反应、按触发时的触及关系出刀，并移除提示。 */
export function opportunityAttack(battle: Battle, reactorId: string, overrides: Partial<AttackOptions> = {}, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const prompt = (combat.pendingOpportunity ?? []).find(item => item.reactorId === reactorId);
  if (!prompt) throw new Error('该单位没有待结算的借机攻击。');
  const reactor = actorOf(next, reactorId);
  const source = attackSources(reactor)[0];
  const merged: AttackOptions = {
    attackerId: reactorId,
    targetId: prompt.targetId,
    attackBonus: source?.attackBonus ?? 0,
    damageExpression: source?.damageExpression ?? '1d8',
    damageType: source?.damageType ?? '挥砍',
    range: 'melee',
    ...overrides,
    cost: 'reaction',
    ignoreDistanceCheck: true,
  };
  const context = validateAttackOptions(next, merged);
  const outcome = resolveOneAttack(next, merged, context, deps, true);
  const rest = (combat.pendingOpportunity ?? []).filter(item => item !== prompt);
  if (rest.length) combat.pendingOpportunity = rest;
  else delete combat.pendingOpportunity;
  return { battle: next, outcome };
}

/** 放弃一次借机攻击。 */
export function declineOpportunity(battle: Battle, reactorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const prompt = (combat.pendingOpportunity ?? []).find(item => item.reactorId === reactorId);
  if (!prompt) throw new Error('该单位没有待结算的借机攻击。');
  const rest = (combat.pendingOpportunity ?? []).filter(item => item !== prompt);
  if (rest.length) combat.pendingOpportunity = rest;
  else delete combat.pendingOpportunity;
  addLog(next, `${actorLabel(next, actorOf(next, reactorId))} 放弃借机攻击。`, deps);
  return next;
}

/** 撤离：消耗动作，本回合移动不引发借机攻击。 */
export function disengage(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以撤离。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以撤离。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  state.disengaged = true;
  addLog(next, `${actorLabel(next, actor)} 使用撤离，本回合移动不会引发借机攻击。`, deps);
  return next;
}

function resetTurnResources(battle: Battle, actorId: string) {
  const combat = battle.actors.find(a => a.id === actorId)?.combat;
  if (!combat) return;
  combat.actionUsed = false;
  combat.bonusUsed = false;
  combat.reactionUsed = false;
  combat.movementUsed = 0;
  combat.disengaged = false;
}
function nextTurnIndex(battle: Battle) {
  const combat = requireCombat(battle);
  combat.turnIndex += 1;
  if (combat.turnIndex >= combat.order.length) {
    combat.turnIndex = 0;
    combat.round += 1;
  }
  for (let guard = 0; guard <= combat.order.length; guard++) {
    const actor = battle.actors.find(a => a.id === combat.order[combat.turnIndex]);
    if (actor && actor.combat?.status !== 'dead') return actor;
    combat.turnIndex += 1;
    if (combat.turnIndex >= combat.order.length) { combat.turnIndex = 0; combat.round += 1; }
  }
  throw new Error('战斗中没有可行动的单位。');
}
export function startCombat(battle: Battle, initiatives: Record<string, number> = {}, deps: CombatDeps = {}): Battle {
  if (battle.combat) throw new Error('战斗已经开始了。');
  const alive = battle.actors.filter(a => a.currentHp > 0);
  if (!alive.length) throw new Error('战场上没有可行动的单位，请先添加单位。');
  const next = structuredClone(battle);
  const random = randomOf(deps);
  const combat = { round: 1, turnIndex: 0, order: [] as string[], log: [] as CombatLogEntry[], undo: [] as Battle[] };
  next.combat = combat;
  for (const actor of next.actors) {
    const manual = initiatives[actor.id];
    let initiative: number;
    if (manual !== undefined) {
      if (!Number.isInteger(manual) || manual < -20 || manual > 60) throw new Error('先攻值须为 -20 至 60 的整数。');
      initiative = manual;
    } else {
      const bonus = actorInitiativeBonus(actor);
      initiative = rollDie(20, random) + bonus;
      if (initiativeAdvantage(actor)) initiative = Math.max(initiative, rollDie(20, random) + bonus);
    }
    actor.combat = {
      initiative,
      tempHp: actor.combat?.tempHp ?? 0,
      conditions: actor.combat?.conditions ?? [],
      actionUsed: false,
      bonusUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      status: actor.currentHp > 0 ? 'active' : (actor.characterSnapshot ? 'down' : 'dead'),
      deathSaves: { successes: 0, failures: 0 },
    };
  }
  combat.order = next.actors
    .filter(a => a.currentHp > 0)
    .sort((a, b) => (combatantOf(b).initiative - combatantOf(a).initiative) || (actorDexModifier(b) - actorDexModifier(a)) || a.name.localeCompare(b.name, 'zh-CN'))
    .map(a => a.id);
  if (!combat.order.length) throw new Error('战场上没有可行动的单位，请先添加单位。');
  const first = actorOf(next, combat.order[0]);
  resetTurnResources(next, first.id);
  addLog(next, `战斗开始：第 1 轮，${actorLabel(next, first)} 先攻 ${combatantOf(first).initiative}。`, deps);
  return next;
}
export function endTurn(battle: Battle, deps: CombatDeps = {}): Battle {
  requireCombat(battle);
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const endingId = combat.order[combat.turnIndex];
  if (endingId) applyOngoingDamage(next, deps, 'end', endingId);
  const actor = nextTurnIndex(next);
  resetTurnResources(next, actor.id);
  addLog(next, `第 ${combat.round} 轮 · 轮到 ${actorLabel(next, actor)}（先攻 ${combatantOf(actor).initiative}）。`, deps);
  if (actor.combat?.ready) { delete actor.combat.ready; addLog(next, `${actorLabel(next, actor)} 的准备动作在回合开始时失效。`, deps); }
  applyOngoingDamage(next, deps);
  syncSummonsInPlace(next, deps);
  tickSummonDurations(next, deps);
  delete combat.pendingOpportunity;
  return next;
}
/** 准备动作：用本回合的动作换一个「满足触发条件时用反应执行」的承诺。 */
export function readyAction(battle: Battle, actorId: string, input: ReadyAction, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (currentActorId(next) !== actor.id) throw new Error('只有当前回合的单位可以准备动作。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.ready) throw new Error('该单位已经有准备好的动作。');
  const action = (input.action ?? '').trim();
  const trigger = (input.trigger ?? '').trim();
  if (!action) throw new Error('请填写准备执行的动作。');
  if (!trigger) throw new Error('请填写触发条件。');
  if (action.length > 120 || trigger.length > 120) throw new Error('动作与触发条件各不能超过 120 个字符。');
  state.actionUsed = true;
  state.ready = { action, trigger };
  addLog(next, `${actorLabel(next, actor)} 准备「${action}」，触发条件：${trigger}。`, deps);
  return next;
}
/** 触发准备好的动作：消耗反应并清空准备。 */
export function triggerReadyAction(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (!state.ready) throw new Error('该单位没有准备好的动作。');
  if (state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以执行准备好的动作。');
  const ready = state.ready;
  delete state.ready;
  state.reactionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 用反应执行准备好的「${ready.action}」。`, deps);
  return next;
}
/** 放弃准备好的动作（动作不返还）。 */
export function cancelReadyAction(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (!state.ready) throw new Error('该单位没有准备好的动作。');
  const action = state.ready.action;
  delete state.ready;
  addLog(next, `${actorLabel(next, actor)} 放弃准备好的「${action}」。`, deps);
  return next;
}
export function spendResource(battle: Battle, actorId: string, kind: AttackCost, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (kind !== 'reaction' && currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用动作或附赠动作。');
  if (kind === 'action' && state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (kind === 'bonus' && state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  if (kind === 'reaction' && state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  if (kind === 'action') state.actionUsed = true;
  if (kind === 'bonus') state.bonusUsed = true;
  if (kind === 'reaction') state.reactionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 使用了${kind === 'action' ? '动作' : kind === 'bonus' ? '附赠动作' : '反应'}。`, deps);
  return next;
}
export function spendMovement(battle: Battle, actorId: string, feet: number, deps: CombatDeps = {}): Battle {
  if (!Number.isInteger(feet) || feet < 0) throw new Error('移动距离须为非负整数。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以移动。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (actor.combat?.conditions.includes('擒抱')) throw new Error('被擒抱的单位无法移动。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  const speed = actorSpeed(actor);
  if (state.movementUsed + feet > speed) throw new Error(`移动距离超出速度上限（${speed} 尺）。`);
  state.movementUsed += feet;
  addLog(next, `${actorLabel(next, actor)} 移动了 ${feet} 尺（共 ${state.movementUsed}/${speed} 尺）。`, deps);
  return next;
}
function defenseOf(actor: Actor, type: DamageType): { multiplier: number; label: string } {
  const normalize = (value: string) => value.replace(/伤害$/, '').trim();
  const has = (list?: string[]) => list?.some(item => normalize(item) === type) ?? false;
  const template = actor.template;
  if (has(template.damageImmunities)) return { multiplier: 0, label: '免疫' };
  const resistant = has(template.damageResistances);
  const vulnerable = has(template.damageVulnerabilities);
  if (resistant && vulnerable) return { multiplier: 1, label: '抗性与易伤抵消' };
  if (resistant) return { multiplier: 0.5, label: '抗性' };
  if (vulnerable) return { multiplier: 2, label: '易伤' };
  return { multiplier: 1, label: '' };
}
function applyDamageToActor(actor: Actor, amount: number, type: DamageType): DamageOutcome {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('伤害须为非负整数。');
  const state = combatantOf(actor);
  const defense = defenseOf(actor, type);
  const adjusted = Math.floor(amount * defense.multiplier);
  const absorbed = Math.min(state.tempHp, adjusted);
  state.tempHp -= absorbed;
  const remaining = adjusted - absorbed;
  if (actor.currentHp === 0 && state.status === 'down') {
    if (remaining > 0) state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 1);
    if (state.deathSaves.failures >= 3) state.status = 'dead';
    return { damage: adjusted, tempAbsorbed: absorbed, status: state.status };
  }
  const before = actor.currentHp;
  actor.currentHp = Math.max(0, before - remaining);
  if (actor.currentHp === 0) {
    const overflow = Math.max(0, remaining - before);
    state.status = actor.characterSnapshot && overflow < actor.maxHp ? 'down' : 'dead';
    state.deathSaves = { successes: 0, failures: 0 };
  }
  return { damage: adjusted, tempAbsorbed: absorbed, status: state.status };
}
export function damageActor(battle: Battle, actorId: string, amount: number, type: DamageType, deps: CombatDeps = {}): { battle: Battle; outcome: DamageOutcome } {
  if (!damageTypes.includes(type)) throw new Error('请选择有效的伤害类型。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const wasDown = state.status === 'down';
  const outcome = applyDamageToActor(actor, amount, type);
  const notes: string[] = [];
  if (outcome.tempAbsorbed) notes.push(`临时生命吸收 ${outcome.tempAbsorbed}`);
  if (wasDown && outcome.damage > outcome.tempAbsorbed) notes.push('倒地受击：死亡豁免失败 +1（是否重击按距离人工裁定）');
  if (state.status === 'down') notes.push('倒地，需要死亡豁免');
  if (state.status === 'dead') notes.push('死亡');
  const concentration = concentrationCheck(next, actor, outcome.damage, randomOf(deps), deps);
  if (concentration) notes.push(concentration.text);
  addLog(next, `${actorLabel(next, actor)} 受到 ${outcome.damage} 点${type}伤害，剩余 ${actor.currentHp}/${actor.maxHp}。`, deps, notes.length ? notes.join('；') : undefined);
  return { battle: next, outcome };
}
export function healActor(battle: Battle, actorId: string, amount: number, deps: CombatDeps = {}): Battle {
  if (!Number.isInteger(amount) || amount < 1) throw new Error('治疗量须为正整数。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('已死亡的单位无法通过治疗恢复。');
  const healed = Math.min(actor.maxHp - actor.currentHp, amount);
  actor.currentHp += healed;
  if (state.status === 'down' && actor.currentHp > 0) {
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
  }
  addLog(next, `${actorLabel(next, actor)} 恢复 ${healed} 点生命值，当前 ${actor.currentHp}/${actor.maxHp}。`, deps);
  return next;
}
export function setActorHp(battle: Battle, actorId: string, hp: number, deps: CombatDeps = {}): Battle {
  if (!battle.combat) {
    const next = structuredClone(battle);
    const actor = actorOf(next, actorId);
    if (!Number.isInteger(hp) || hp < 0 || hp > actor.maxHp) throw new Error('生命值须为 0 至最大生命值之间的整数。');
    actor.currentHp = hp;
    return next;
  }
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  if (!Number.isInteger(hp) || hp < 0 || hp > actor.maxHp) throw new Error('生命值须为 0 至最大生命值之间的整数。');
  const state = combatantOf(actor);
  const previous = actor.currentHp;
  if (hp === previous) return next;
  actor.currentHp = hp;
  if (hp === 0) {
    state.status = actor.characterSnapshot ? 'down' : 'dead';
    state.deathSaves = { successes: 0, failures: 0 };
  } else if (state.status !== 'dead') {
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
  }
  addLog(next, `${actorLabel(next, actor)} 的生命值手动调整为 ${hp}/${actor.maxHp}。`, deps);
  return next;
}
export function setTempHp(battle: Battle, actorId: string, tempHp: number, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (!Number.isInteger(tempHp) || tempHp < 0) throw new Error('临时生命值须为非负整数。');
  combatantOf(actor).tempHp = tempHp;
  addLog(next, `${actorLabel(next, actor)} 的临时生命值设为 ${tempHp}。`, deps);
  return next;
}
export function toggleCondition(battle: Battle, actorId: string, condition: string, deps: CombatDeps = {}): Battle {
  if (!conditions.includes(condition as typeof conditions[number])) throw new Error('请选择有效的状态。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const active = state.conditions.includes(condition);
  state.conditions = active ? state.conditions.filter(item => item !== condition) : [...state.conditions, condition];
  addLog(next, `${actorLabel(next, actor)} ${active ? '移除' : '获得'}状态：${condition}。`, deps);
  return next;
}
type AttackContext = { attacker: Actor; target: Actor; cost: AttackCost; criticalRange: number; range: AttackRange; distanceFt: number; measured: boolean; cover?: CoverType };

function validateAttackOptions(battle: Battle, options: AttackOptions): AttackContext {
  requireCombat(battle);
  const attacker = actorOf(battle, options.attackerId);
  const target = actorOf(battle, options.targetId);
  if (options.attackerId === options.targetId) throw new Error('不能以自己为攻击目标。');
  const blocker = actionBlocker(attacker);
  if (blocker) throw new Error(blocker);
  if (target.combat?.status === 'dead') throw new Error('目标已经死亡。');
  parseDice(options.damageExpression);
  if (options.extraDamageExpression !== undefined) {
    if (!options.extraDamageExpression.trim()) throw new Error('请填写额外伤害的骰式。');
    parseDice(options.extraDamageExpression);
    if (!options.extraDamageType || !damageTypes.includes(options.extraDamageType)) throw new Error('请选择额外伤害的类型。');
  }
  if (!Number.isInteger(options.attackBonus) || options.attackBonus < -20 || options.attackBonus > 40) throw new Error('攻击加值须为 -20 至 40 的整数。');
  if (!damageTypes.includes(options.damageType)) throw new Error('请选择有效的伤害类型。');
  const cost: AttackCost = options.cost ?? 'action';
  if (cost !== 'reaction' && currentActorId(battle) !== attacker.id) throw new Error('只有当前回合的单位可以攻击。');
  const state = combatantOf(attacker);
  if (cost === 'action' && state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (cost === 'bonus' && state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  if (cost === 'reaction' && state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  const criticalRange = options.criticalRange ?? 20;
  if (!Number.isInteger(criticalRange) || criticalRange < 15 || criticalRange > 20) throw new Error('重击范围须为 15 至 20。');
  const range: AttackRange = options.range ?? 'melee';
  if (range !== 'melee' && range !== 'ranged') throw new Error('请选择近战或远程攻击。');
  const reachFt = options.reachFt ?? 5;
  if (!Number.isInteger(reachFt) || reachFt < 5 || reachFt > 30) throw new Error('近战触及范围须为 5 至 30 尺的整数。');
  if (options.cover !== undefined && !coverTypes.includes(options.cover)) throw new Error('掩体取值无效。');
  if (options.weaponId !== undefined && !attackSources(attacker).some(item => item.id === options.weaponId)) throw new Error('攻击来源无效。');
  if (options.weaponId !== undefined) {
    const weapon = attackSources(attacker).find(item => item.id === options.weaponId);
    if (weapon?.properties?.includes('装填') && (options.attacks ?? 1) > 1) throw new Error('装填武器每个动作只能射击一次。');
  }
  if (options.twoHanded) {
    const versatile = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId)?.versatileDamage : undefined;
    if (!versatile) throw new Error('该武器没有两用形态，无法双手持用。');
  }
  const measured = actorDistance(battle, attacker.id, target.id);
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'melee' && measured > reachFt) throw new Error(`目标距离 ${measured} 尺，超出近战触及范围（${reachFt} 尺）。`);
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'ranged' && measured > 600) throw new Error('目标距离超出远程攻击范围（600 尺）。');
  if (options.weaponId) {
    const source = attackSources(attacker).find(item => item.id === options.weaponId);
    if (source?.longRangeFt && range === 'ranged') {
      const distance = measured ?? options.distanceFt ?? 30;
      if (distance > source.longRangeFt) throw new Error('目标距离超出该武器的最大射程（' + source.longRangeFt + ' 尺）。');
    }
  }
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'ranged' && attacker.position && target.position && !hasLineOfSight(battle, attacker.position, target.position)) throw new Error('视线被墙体阻挡，无法进行远程攻击。');
  const distanceFt = options.ignoreDistanceCheck ? (options.distanceFt ?? reachFt) : (measured ?? options.distanceFt ?? (range === 'melee' ? reachFt : 30));
  if (!Number.isInteger(distanceFt) || distanceFt < 0 || distanceFt > 600) throw new Error('距离须为 0 至 600 尺的整数。');
  const cover = options.cover ?? (options.autoCover && attacker.position && target.position ? coverFromWalls(battle, attacker.position, target.position) : undefined);
  return { attacker, target, cost, criticalRange, range, distanceFt, measured: measured !== undefined, cover };
}

function heavyWeaponAdjustment(actor: Actor, weaponId?: string): ModeAdjustment | null {
  if (!weaponId) return null;
  const source = attackSources(actor).find(item => item.id === weaponId);
  if (!source?.properties?.includes('重型')) return null;
  const strength = actor.characterSnapshot?.sheet.abilities.str ?? actor.template.abilities?.str ?? 10;
  if (strength >= 13) return null;
  return { mode: 'disadvantage', notes: [`力量 ${strength} 低于重型武器要求的 13：攻击检定劣势`] };
}

function effectiveDamageExpression(actor: Actor, options: AttackOptions): string {
  if (!options.twoHanded || !options.weaponId) return options.damageExpression;
  const versatile = attackSources(actor).find(item => item.id === options.weaponId)?.versatileDamage;
  if (!versatile) return options.damageExpression;
  return options.damageExpression.replace(/^\s*\d{1,2}\s*d\s*\d{1,3}/, versatile);
}

function longRangeAdjustment(actor: Actor, options: AttackOptions, distanceFt: number): ModeAdjustment | null {
  if (!options.weaponId || options.range === 'melee') return null;
  const source = attackSources(actor).find(item => item.id === options.weaponId);
  if (!source?.longRangeFt || distanceFt <= source.distanceFt) return null;
  return { mode: 'disadvantage', notes: [`距离 ${distanceFt} 尺超出常规射程 ${source.distanceFt} 尺：攻击检定劣势`] };
}

function resolveOneAttack(battle: Battle, options: AttackOptions, context: AttackContext, deps: CombatDeps, consumeCost: boolean): AttackOutcome {
  const attacker = actorOf(battle, options.attackerId);
  const target = actorOf(battle, options.targetId);
  const state = combatantOf(attacker);
  const targetWasDown = combatantOf(target).status === 'down';
  const random = randomOf(deps);
  const heavy = heavyWeaponAdjustment(attacker, options.weaponId);
  const far = longRangeAdjustment(attacker, options, context.distanceFt);
  const combined = combineAttackModes(options.mode ?? 'normal', [attackerAdjustment(attacker), targetAdjustment(target, context.range), ...(heavy ? [heavy] : []), ...(far ? [far] : [])]);
  const mode = combined.mode;
  const notes = [...combined.notes];
  const first = rollDie(20, random);
  const second = mode === 'normal' ? first : rollDie(20, random);
  const natural = mode === 'advantage' ? Math.max(first, second) : mode === 'disadvantage' ? Math.min(first, second) : first;
  const total = natural + options.attackBonus;
  const targetAc = target.template.armorClass + (context.cover ? coverAcBonus(context.cover) : 0);
  const hit = natural === 20 || (natural !== 1 && total >= targetAc);
  const automaticCritical = hit && isAutomaticCritical(target, context.range, context.distanceFt);
  const critical = hit && (natural >= context.criticalRange || automaticCritical);
  if (automaticCritical) notes.push('目标麻痹或昏迷且在 5 尺内：命中即重击');
  let damage = 0;
  let tempAbsorbed = 0;
  let status: CombatStatus = combatantOf(target).status;
  let defense = '';
  let concentration = '';
  let extraDamage = 0;
  let extraNote = '';
  const damageExpression = effectiveDamageExpression(attacker, options);
  if (hit) {
    const rolled = rollDamage(damageExpression, random, critical);
    const defenseResult = defenseOf(target, options.damageType);
    defense = defenseResult.label;
    const result = applyDamageToActor(target, rolled.total, options.damageType);
    damage = result.damage;
    tempAbsorbed = result.tempAbsorbed;
    status = result.status;
    if (options.extraDamageExpression && options.extraDamageType) {
      const extraRoll = rollDamage(options.extraDamageExpression, random, critical && options.extraDamageCritical !== false);
      const extraDefense = defenseOf(target, options.extraDamageType);
      const extraResult = applyDamageToActor(target, extraRoll.total, options.extraDamageType);
      extraDamage = extraResult.damage;
      damage += extraDamage;
      tempAbsorbed += extraResult.tempAbsorbed;
      status = extraResult.status;
      extraNote = `额外 ${extraRoll.total} 点${options.extraDamageType}伤害${extraDefense.label ? `（${extraDefense.label}）` : ''}`;
    }
    concentration = concentrationCheck(battle, target, damage, random, deps)?.text ?? '';
  }
  if (consumeCost) {
    if (context.cost === 'action') state.actionUsed = true;
    if (context.cost === 'bonus') state.bonusUsed = true;
    if (context.cost === 'reaction') state.reactionUsed = true;
  }
  const rollText = mode === 'normal' ? `d20(${natural})` : `${mode === 'advantage' ? '优势' : '劣势'} d20(${first},${second})→${natural}`;
  const damageText = hit ? `${damage} 点${options.damageType}伤害` : '未造成伤害';
  const detail = [
    `${actorLabel(battle, attacker)} → ${actorLabel(battle, target)}`,
    `攻击检定 ${rollText}${options.attackBonus >= 0 ? '+' : ''}${options.attackBonus} = ${total} vs AC ${targetAc}`,
    context.measured ? `方格距离 ${context.distanceFt} 尺` : '',
    context.cover ? coverNote(context.cover) : '',
    hit ? (critical ? '重击' : '命中') : (natural === 1 ? '大失败' : '未命中'),
    damageText,
    options.twoHanded && damageExpression !== options.damageExpression ? `双手持用：${damageExpression}` : '',
    extraNote,
    defense,
    `目标剩余 ${target.currentHp}/${target.maxHp}`,
    tempAbsorbed ? `临时生命吸收 ${tempAbsorbed}` : '',
    targetWasDown && damage > tempAbsorbed ? '倒地受击：死亡豁免失败 +1（是否重击按距离人工裁定）' : '',
    status === 'down' ? '目标倒地' : status === 'dead' ? '目标死亡' : '',
    concentration,
    notes.join('；'),
  ].filter(Boolean).join(' · ');
  addLog(battle, `${actorLabel(battle, attacker)} 攻击 ${actorLabel(battle, target)}：${hit ? `命中，造成 ${damage} 点伤害${extraDamage > 0 ? `（含额外 ${extraDamage} 点${options.extraDamageType}伤害）` : ''}` : '未命中'}。`, deps, detail);
  return { natural, total, targetAc, hit, critical, damage, tempAbsorbed, targetHp: target.currentHp, status, defense, mode, notes, extraDamage };
}

export function attack(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const next = recordUndo(structuredClone(battle));
  const context = validateAttackOptions(next, options);
  const outcome = resolveOneAttack(next, options, context, deps, true);
  return { battle: next, outcome };
}

export function attackSequence(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcomes: AttackOutcome[] } {
  const next = recordUndo(structuredClone(battle));
  const context = validateAttackOptions(next, options);
  const requested = options.attacks ?? 1;
  if (!Number.isInteger(requested) || requested < 1) throw new Error('攻击次数须为正整数。');
  const limit = attacksPerAction(context.attacker);
  if (requested > limit) throw new Error(`该单位一次攻击动作最多攻击 ${limit} 次。`);
  if (requested > 1 && context.cost !== 'action') throw new Error('只有使用动作的攻击才能连续攻击多次。');
  const outcomes: AttackOutcome[] = [];
  for (let index = 0; index < requested; index++) {
    if (actorOf(next, options.targetId).combat?.status === 'dead') break;
    outcomes.push(resolveOneAttack(next, options, context, deps, index === 0));
  }
  const attacker = actorOf(next, options.attackerId);
  const target = actorOf(next, options.targetId);
  addLog(next, `${actorLabel(next, attacker)} 对 ${actorLabel(next, target)} 完成攻击动作：${outcomes.length} 次攻击，命中 ${outcomes.filter(item => item.hit).length} 次。`, deps,
    outcomes.map((item, index) => `第 ${index + 1} 击：${item.hit ? `${item.critical ? '重击' : '命中'} ${item.damage} 点` : '未命中'}（d20 ${item.natural} vs AC ${item.targetAc}）`).join(' · '));
  return { battle: next, outcomes };
}

function lightProperty(source: AttackSource): boolean {
  return source.properties?.includes('轻型') === true;
}

function offhandDamageExpression(source: AttackSource): string {
  return source.damageExpression.replace(/\s*([+-])\s*(\d+)\s*$/, (_match: string, sign: string, value: string) => (sign === '-' ? `-${value}` : ''));
}

function hasTwoWeaponFighting(actor: Actor): boolean {
  const details = actor.characterSnapshot?.sheet?.details as { fighterCalculator?: { fightingStyle?: string; fightingStyles?: string[] } } | undefined;
  const config = details?.fighterCalculator;
  if (!config) return false;
  return config.fightingStyle === '双武器战斗' || (Array.isArray(config.fightingStyles) && config.fightingStyles.includes('双武器战斗'));
}

export function offhandAttack(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const next = recordUndo(structuredClone(battle));
  const attacker = actorOf(next, options.attackerId);
  const state = combatantOf(attacker);
  const blocker = actionBlocker(attacker);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== options.attackerId) throw new Error('只有当前回合的单位可以副手攻击。');
  if (state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  if (!state.actionUsed) throw new Error('副手攻击需要在用动作攻击之后进行。');
  const source = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
  if (!source) throw new Error('请选择副手武器。');
  if (!lightProperty(source)) throw new Error('只有轻型武器可以进行副手攻击。');
  const style = hasTwoWeaponFighting(attacker);
  const offhandOptions: AttackOptions = { ...options, weaponId: source.id, damageExpression: style ? source.damageExpression : offhandDamageExpression(source), cost: 'bonus', range: source.range };
  const context = validateAttackOptions(next, offhandOptions);
  const outcome = resolveOneAttack(next, offhandOptions, context, deps, true);
  addLog(next, style
    ? `${actorLabel(next, attacker)} 用副手武器「${source.label}」进行附赠动作攻击，双武器战斗风格把属性调整值加入伤害。`
    : `${actorLabel(next, attacker)} 用副手武器「${source.label}」进行附赠动作攻击，伤害不使用属性调整值。`, deps);
  return { battle: next, outcome };
}

export type ContestOptions = { attackerId: string; targetId: string };
export type ContestOutcome = { attackerTotal: number; targetTotal: number; attackerNatural: number; targetNatural: number; success: boolean };
export type ShoveEffect = 'prone' | 'push';

function abilityCheckBonus(actor: Actor, ability: Ability, skill: string): number {
  const sheet = actor.characterSnapshot?.sheet;
  const abilities = sheet?.abilities ?? actor.template.abilities;
  const score = abilities?.[ability] ?? 10;
  const proficient = (sheet?.details?.skillProficiencies ?? []).includes(skill);
  const level = sheet?.level ?? 1;
  return abilityModifier(score) + (proficient ? proficiencyBonus(level) : 0);
}

function contestRoll(bonus: number, random: Random): { natural: number; total: number } {
  const natural = 1 + Math.floor(random() * 20);
  return { natural, total: natural + bonus };
}

function grappleContest(next: Battle, attacker: Actor, target: Actor, deps: CombatDeps): ContestOutcome {
  const random = deps.random ?? Math.random;
  const attackerBonus = abilityCheckBonus(attacker, 'str', '运动');
  const targetStrength = abilityCheckBonus(target, 'str', '运动');
  const targetDexterity = abilityCheckBonus(target, 'dex', '体操');
  const targetBonus = Math.max(targetStrength, targetDexterity);
  const attackerRoll = contestRoll(attackerBonus, random);
  const targetRoll = contestRoll(targetBonus, random);
  const success = attackerRoll.total > targetRoll.total;
  addLog(next, success
    ? `${actorLabel(next, attacker)} 擒抱或推撞 ${actorLabel(next, target)} 成功（${attackerRoll.natural}+${attackerBonus} 对 ${targetRoll.natural}+${targetBonus}）。`
    : `${actorLabel(next, attacker)} 擒抱或推撞 ${actorLabel(next, target)} 失败（${attackerRoll.natural}+${attackerBonus} 对 ${targetRoll.natural}+${targetBonus}）。`, deps,
    `力量（运动）对抗目标的力量（运动）或敏捷（体操）：${attackerRoll.total} 对 ${targetRoll.total}`);
  return { attackerTotal: attackerRoll.total, targetTotal: targetRoll.total, attackerNatural: attackerRoll.natural, targetNatural: targetRoll.natural, success };
}

function contestSetup(battle: Battle, options: ContestOptions): { next: Battle; attacker: Actor; target: Actor } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const attacker = actorOf(next, options.attackerId);
  const target = actorOf(next, options.targetId);
  if (attacker.id === target.id) throw new Error('不能对自己进行擒抱或推撞。');
  const blocker = actionBlocker(attacker);
  if (blocker) throw new Error(blocker);
  if (actionBlocker(target)) throw new Error('目标无法被擒抱或推撞。');
  if (currentActorId(next) !== attacker.id) throw new Error('只有当前回合的单位可以擒抱或推撞。');
  if (combatantOf(attacker).actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const distance = actorDistance(next, attacker.id, target.id);
  const reach = Math.max(5, actorReach(attacker));
  if (distance !== undefined && distance > reach) throw new Error(`目标距离 ${distance} 尺，超出擒抱范围（${reach} 尺）。`);
  return { next, attacker, target };
}

export function grapple(battle: Battle, options: ContestOptions, deps: CombatDeps = {}): { battle: Battle; outcome: ContestOutcome } {
  const { next, attacker, target } = contestSetup(battle, options);
  if (target.combat?.conditions.includes('擒抱')) throw new Error('目标已经被擒抱。');
  const outcome = grappleContest(next, attacker, target, deps);
  const state = combatantOf(attacker);
  state.actionUsed = true;
  if (outcome.success) {
    if (!target.combat) throw new Error('目标不在战斗中。');
    if (!target.combat.conditions.includes('擒抱')) target.combat.conditions.push('擒抱');
  }
  return { battle: next, outcome };
}

export function shove(battle: Battle, options: ContestOptions & { effect: ShoveEffect }, deps: CombatDeps = {}): { battle: Battle; outcome: ContestOutcome } {
  const { next, attacker, target } = contestSetup(battle, options);
  if (options.effect !== 'prone' && options.effect !== 'push') throw new Error('推撞效果无效。');
  const outcome = grappleContest(next, attacker, target, deps);
  const state = combatantOf(attacker);
  state.actionUsed = true;
  if (!outcome.success) return { battle: next, outcome };
  if (!target.combat) throw new Error('目标不在战斗中。');
  if (options.effect === 'prone') {
    if (!target.combat.conditions.includes('倒地')) target.combat.conditions.push('倒地');
    addLog(next, `${actorLabel(next, target)} 被推倒在地。`, deps);
    return { battle: next, outcome };
  }
  const grid = next.grid;
  const attackerPosition = attacker.position;
  const targetPosition = target.position;
  if (!grid || !attackerPosition || !targetPosition) {
    addLog(next, `${actorLabel(next, target)} 被推开 5 尺（未启用方格，需手动调整位置）。`, deps);
    return { battle: next, outcome };
  }
  const dx = targetPosition.x - attackerPosition.x;
  const dy = targetPosition.y - attackerPosition.y;
  const stepX = dx === 0 ? 0 : Math.sign(dx);
  const stepY = dy === 0 ? 0 : Math.sign(dy);
  if (stepX === 0 && stepY === 0) throw new Error('无法判断推撞方向。');
  const toX = targetPosition.x + stepX;
  const toY = targetPosition.y + stepY;
  if (toX < 0 || toY < 0 || toX >= grid.width || toY >= grid.height) throw new Error('推撞方向超出战场边界。');
  const occupied = next.actors.find(actor => actor.id !== target.id && actor.position?.x === toX && actor.position?.y === toY);
  if (occupied) throw new Error(`推撞方向已有单位：${actorLabel(next, occupied)}。`);
  if (isWallCell(next, toX, toY)) throw new Error('推撞方向是墙体。');
  target.position = { x: toX, y: toY };
  addLog(next, `${actorLabel(next, target)} 被推开 5 尺到 (${toX}, ${toY})。`, deps);
  return { battle: next, outcome };
}

export function useActionSurge(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用动作如潮。');
  const maximum = actionSurgeMax(actor);
  if (!maximum) throw new Error('只有 2 级及以上的战士可以使用动作如潮。');
  const used = state.actionSurgeUsed ?? 0;
  if (used >= maximum) throw new Error('本场战斗的动作如潮已经用完，短休或长休后恢复。');
  state.actionSurgeUsed = used + 1;
  state.actionUsed = false;
  addLog(next, `${actorLabel(next, actor)} 使用动作如潮，额外获得一个动作（${used + 1}/${maximum}）。`, deps);
  return next;
}

export function secondWind(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; healed: number } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用回气。');
  if (!hasSecondWind(actor)) throw new Error('只有战士可以使用回气。');
  if (state.secondWindUsed) throw new Error('本场战斗已经使用过回气，短休或长休后恢复。');
  if (state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  const level = actor.characterSnapshot?.sheet.level ?? 1;
  const rolled = rollDie(10, randomOf(deps));
  const healed = Math.min(actor.maxHp - actor.currentHp, rolled + level);
  actor.currentHp += healed;
  if (state.status === 'down' && actor.currentHp > 0) {
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
  }
  state.bonusUsed = true;
  state.secondWindUsed = true;
  addLog(next, `${actorLabel(next, actor)} 使用回气，恢复 ${healed} 点生命值（d10 ${rolled} + ${level} 级），当前 ${actor.currentHp}/${actor.maxHp}。`, deps);
  return { battle: next, healed };
}
export function recoverClassResources(battle: Battle, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  for (const actor of next.actors) {
    if (!actor.combat) continue;
    actor.combat.actionSurgeUsed = 0;
    actor.combat.secondWindUsed = false;
    actor.combat.actionUsed = false;
    actor.combat.bonusUsed = false;
    actor.combat.reactionUsed = false;
    actor.combat.movementUsed = 0;
  }
  addLog(next, '短休：所有单位的动作、附赠动作、反应、移动，以及动作如潮与回气均已恢复（生命值不变）。', deps);
  return next;
}

export type SaveOptions = { actorId: string; ability: Ability; dc: number; bonus?: number; mode?: AttackMode };
export type SaveOutcome = { natural: number; total: number; dc: number; success: boolean; mode: AttackMode; notes: string[]; automaticFailure: boolean };
export type AreaSaveOptions = {
  targetIds: string[];
  ability: Ability;
  dc: number;
  damageExpression: string;
  damageType: DamageType;
  /** 豁免成功时伤害减半，默认 true。 */
  halfOnSuccess?: boolean;
  /** 逐目标的豁免加值，缺省为 0。 */
  bonuses?: Record<string, number>;
  mode?: AttackMode;
};
export type AreaSaveResult = { actorId: string; save: SaveOutcome; damage: number; tempAbsorbed: number; status: CombatStatus };

const saveNames: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

/** 单位的默认豁免加值：属性调整值 + 角色快照中已熟练的豁免。 */
export function defaultSaveBonus(actor: Actor, ability: Ability): number {
  const sheet = actor.characterSnapshot?.sheet;
  const abilities = sheet?.abilities ?? actor.template.abilities;
  const modifier = typeof abilities?.[ability] === 'number' ? abilityModifier(abilities[ability]) : 0;
  const proficient = (sheet?.details?.saveProficiencies ?? []).includes(ability);
  if (!proficient) return modifier;
  const level = sheet?.level ?? 1;
  return modifier + proficiencyBonus(Math.min(20, Math.max(1, level)));
}

function resolveSave(actor: Actor, options: SaveOptions, random: Random): SaveOutcome {
  const conditions = actor.combat?.conditions ?? [];
  const bonus = options.bonus ?? defaultSaveBonus(actor, options.ability);
  const automaticFailure = (options.ability === 'str' || options.ability === 'dex') && ['麻痹', '昏迷', '石化'].some(condition => conditions.includes(condition));
  const adjustments: ModeAdjustment[] = [];
  if (options.ability === 'dex' && conditions.includes('束缚')) adjustments.push({ mode: 'disadvantage', notes: ['目标束缚：敏捷豁免劣势'] });
  const combined = combineAttackModes(options.mode ?? 'normal', adjustments);
  if (automaticFailure) {
    return { natural: 0, total: 0, dc: options.dc, success: false, mode: 'normal', automaticFailure: true, notes: [...combined.notes, '麻痹、昏迷或石化：力量／敏捷豁免自动失败'] };
  }
  const mode = combined.mode;
  const first = rollDie(20, random);
  const second = mode === 'normal' ? first : rollDie(20, random);
  const natural = mode === 'advantage' ? Math.max(first, second) : mode === 'disadvantage' ? Math.min(first, second) : first;
  const total = natural + bonus;
  const success = natural === 20 || (natural !== 1 && total >= options.dc);
  return { natural, total, dc: options.dc, success, mode, automaticFailure: false, notes: combined.notes };
}

function saveDetail(actor: Actor, battle: Battle, options: SaveOptions, outcome: SaveOutcome): string {
  const bonus = options.bonus ?? defaultSaveBonus(actor, options.ability);
  const rollText = outcome.automaticFailure ? '自动失败' : outcome.mode === 'normal' ? `d20(${outcome.natural})` : `${outcome.mode === 'advantage' ? '优势' : '劣势'} d20→${outcome.natural}`;
  return [
    `${actorLabel(battle, actor)} 的${saveNames[options.ability]}豁免`,
    `DC ${outcome.dc}`,
    outcome.automaticFailure ? '自动失败' : `${rollText}${bonus >= 0 ? '+' : ''}${bonus} = ${outcome.total}`,
    outcome.success ? '成功' : '失败',
    outcome.notes.join('；'),
  ].filter(Boolean).join(' · ');
}

export function savingThrow(battle: Battle, options: SaveOptions, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, options.actorId);
  if (!Number.isInteger(options.dc) || options.dc < 1 || options.dc > 40) throw new Error('豁免 DC 须为 1 至 40 的整数。');
  const bonus = options.bonus ?? 0;
  if (!Number.isInteger(bonus) || bonus < -10 || bonus > 30) throw new Error('豁免加值须为 -10 至 30 的整数。');
  const outcome = resolveSave(actor, options, randomOf(deps));
  addLog(next, `${actorLabel(next, actor)} 的${saveNames[options.ability]}豁免${outcome.success ? '成功' : '失败'}。`, deps, saveDetail(actor, next, options, outcome));
  return { battle: next, outcome };
}

export function areaSave(battle: Battle, options: AreaSaveOptions, deps: CombatDeps = {}): { battle: Battle; results: AreaSaveResult[] } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  parseDice(options.damageExpression);
  if (!damageTypes.includes(options.damageType)) throw new Error('请选择有效的伤害类型。');
  if (!Number.isInteger(options.dc) || options.dc < 1 || options.dc > 40) throw new Error('豁免 DC 须为 1 至 40 的整数。');
  const targetIds = [...new Set(options.targetIds)];
  if (!targetIds.length) throw new Error('请至少选择一个目标。');
  if (targetIds.length > 20) throw new Error('一次最多结算 20 个目标。');
  const random = randomOf(deps);
  const raw = rollDamage(options.damageExpression, random, false);
  const results: AreaSaveResult[] = [];
  for (const targetId of targetIds) {
    const actor = actorOf(next, targetId);
    if (actor.combat?.status === 'dead') continue;
    const targetBonus = options.bonuses?.[targetId];
    const save = resolveSave(actor, { actorId: targetId, ability: options.ability, dc: options.dc, bonus: targetBonus, mode: options.mode }, random);
    const amount = save.success ? (options.halfOnSuccess === false ? 0 : Math.floor(raw.total / 2)) : raw.total;
    const defense = defenseOf(actor, options.damageType);
    const damage = amount > 0 ? applyDamageToActor(actor, amount, options.damageType) : { damage: 0, tempAbsorbed: 0, status: actor.combat?.status ?? 'active' };
    const concentration = damage.damage > 0 ? concentrationCheck(next, actor, damage.damage, random, deps) : null;
    results.push({ actorId: targetId, save, damage: damage.damage, tempAbsorbed: damage.tempAbsorbed, status: damage.status });
    addLog(next, `${actorLabel(next, actor)} 的${saveNames[options.ability]}豁免${save.success ? '成功' : '失败'}，承受 ${damage.damage} 点${options.damageType}伤害。`, deps,
      [saveDetail(actor, next, { actorId: targetId, ability: options.ability, dc: options.dc, bonus: targetBonus }, save), `伤害 ${raw.total}${save.success ? `（减半 ${amount}）` : ''}`, defense.label, `剩余 ${actor.currentHp}/${actor.maxHp}`, concentration?.text].filter(Boolean).join(' · '));
  }
  addLog(next, `范围效果结算：${results.length} 个目标，${results.filter(item => item.save.success).length} 个豁免成功。`, deps,
    `${saveNames[options.ability]}豁免 DC ${options.dc} · ${options.damageExpression} ${options.damageType}${options.halfOnSuccess === false ? '' : '（成功减半）'}`);
  return { battle: next, results };
}

export type OngoingInput = { name: string; damageExpression: string; damageType: DamageType; saveEnds?: { ability: Ability; dc: number }; timing?: 'start' | 'end' };
export type ConcentrationCheck = { lost: boolean; dc: number; natural: number; total: number; text: string };

export type SummonInput = { ownerId: string; spell?: string; rounds?: number };

/** 从战斗里移除一个单位，并修正行动顺序。 */
function dropActorFromBattle(battle: Battle, actorId: string): void {
  const combat = battle.combat;
  battle.actors = battle.actors.filter(actor => actor.id !== actorId);
  if (!combat) return;
  const removedIndex = combat.order.indexOf(actorId);
  combat.order = combat.order.filter(id => id !== actorId);
  if (removedIndex >= 0 && removedIndex < combat.turnIndex) combat.turnIndex -= 1;
  if (combat.turnIndex >= combat.order.length) combat.turnIndex = 0;
  if (!combat.order.length) {
    delete battle.combat;
    for (const actor of battle.actors) delete actor.combat;
  }
}

function dismissSummonsOf(battle: Battle, ownerId: string, reason: string, deps: CombatDeps): void {
  const summons = battle.actors.filter(actor => actor.summon?.ownerId === ownerId);
  for (const summon of summons) {
    addLog(battle, `${actorLabel(battle, summon)} 消散了。`, deps, reason);
    dropActorFromBattle(battle, summon.id);
  }
}

/** 当前由某位施法者维持的召唤物。 */
export function summonsOf(battle: Battle, ownerId: string): Actor[] {
  return battle.actors.filter(actor => actor.summon?.ownerId === ownerId);
}

export function markSummon(battle: Battle, actorId: string, input: SummonInput, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const owner = actorOf(next, input.ownerId);
  if (actor.id === owner.id) throw new Error('不能把单位标记为自己的召唤物。');
  const concentration = owner.combat?.concentration;
  if (!concentration) throw new Error('只有维持专注的单位可以召唤单位。');
  if (actor.combat?.status === 'dead') throw new Error('已经死亡的单位不能成为召唤物。');
  if (input.rounds !== undefined && (!Number.isInteger(input.rounds) || input.rounds < 1 || input.rounds > 99)) throw new Error('召唤持续轮数须为 1 至 99 的整数。');
  const spell = (input.spell ?? concentration.spell).trim();
  if (!spell) throw new Error('请填写召唤法术的名称。');
  actor.summon = { ownerId: owner.id, spell, rounds: input.rounds };
  addLog(next, `${actorLabel(next, actor)} 成为 ${actorLabel(next, owner)} 的召唤物。`, deps,
    `来源法术「${spell}」${input.rounds === undefined ? '' : ` · 持续 ${input.rounds} 轮`}`);
  return next;
}

export function dismissSummon(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const summon = actor.summon;
  if (!summon) throw new Error('该单位不是召唤物。');
  delete actor.summon;
  const owner = next.actors.find(item => item.id === summon.ownerId);
  addLog(next, `${actorLabel(next, actor)} 不再是召唤物。`, deps, owner ? `原属 ${actorLabel(next, owner)} 的「${summon.spell}」` : undefined);
  return next;
}

/** 召唤物随施法者失去专注、倒地或死亡而消散。 */
export function syncSummons(battle: Battle, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  syncSummonsInPlace(next, deps);
  return next;
}

function syncSummonsInPlace(battle: Battle, deps: CombatDeps): void {
  for (const summon of [...battle.actors]) {
    const binding = summon.summon;
    if (!binding) continue;
    const owner = battle.actors.find(actor => actor.id === binding.ownerId);
    if (!owner) {
      dropActorFromBattle(battle, summon.id);
      continue;
    }
    if (owner.combat?.status !== 'active' || !owner.combat?.concentration) {
      addLog(battle, `${actorLabel(battle, summon)} 消散了。`, deps, `施法者 ${actorLabel(battle, owner)} 已无法维持「${binding.spell}」`);
      dropActorFromBattle(battle, summon.id);
    }
  }
}

/** 每轮开始时扣减召唤持续轮数，到期即消散。 */
function tickSummonDurations(battle: Battle, deps: CombatDeps): void {
  const ownerId = currentActorId(battle);
  if (!ownerId) return;
  const summons = battle.actors.filter(actor => actor.summon?.ownerId === ownerId && actor.summon.rounds !== undefined);
  for (const summon of summons) {
    const binding = summon.summon!;
    const left = (binding.rounds ?? 1) - 1;
    if (left <= 0) {
      addLog(battle, `${actorLabel(battle, summon)} 的召唤持续时间结束，消散。`, deps, `来源法术「${binding.spell}」`);
      dropActorFromBattle(battle, summon.id);
    } else {
      binding.rounds = left;
    }
  }
}

function concentrationCheck(battle: Battle, actor: Actor, damage: number, random: Random, deps: CombatDeps = {}): ConcentrationCheck | null {
  const concentration = actor.combat?.concentration;
  if (!concentration) return null;
  const dc = Math.max(10, Math.floor(damage / 2));
  if (actor.combat?.status !== 'active' || damage <= 0) {
    delete actor.combat!.concentration;
    dismissSummonsOf(battle, actor.id, `施法者失去专注「${concentration.spell}」`, deps);
    return { lost: true, dc, natural: 0, total: 0, text: `失去对「${concentration.spell}」的专注` };
  }
  const outcome = resolveSave(actor, { actorId: actor.id, ability: 'con', dc }, random);
  if (outcome.success) return { lost: false, dc, natural: outcome.natural, total: outcome.total, text: `专注检定 DC ${dc}：d20(${outcome.natural}) + ${outcome.total - outcome.natural} = ${outcome.total}，维持「${concentration.spell}」` };
  delete actor.combat!.concentration;
  dismissSummonsOf(battle, actor.id, `施法者失去专注「${concentration.spell}」`, deps);
  return { lost: true, dc, natural: outcome.natural, total: outcome.total, text: `专注检定 DC ${dc}：d20(${outcome.natural}) + ${outcome.total - outcome.natural} = ${outcome.total}，失去对「${concentration.spell}」的专注` };
}

function validateOngoing(input: OngoingInput): void {
  if (!input.name || !input.name.trim()) throw new Error('请填写持续效果名称。');
  parseDice(input.damageExpression);
  if (!damageTypes.includes(input.damageType)) throw new Error('请选择有效的伤害类型。');
  if (input.saveEnds && (!Number.isInteger(input.saveEnds.dc) || input.saveEnds.dc < 1 || input.saveEnds.dc > 40)) throw new Error('持续效果的豁免 DC 须为 1 至 40 的整数。');
  if (input.timing !== undefined && input.timing !== 'start' && input.timing !== 'end') throw new Error('持续效果的结算时机无效。');
}

export function addOngoingEffect(battle: Battle, targetId: string, input: OngoingInput, deps: CombatDeps = {}): { battle: Battle; effectId: string } {
  validateOngoing(input);
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, targetId);
  const state = combatantOf(actor);
  if (state.ongoing && state.ongoing.length >= 8) throw new Error('单个单位最多记录 8 个持续效果。');
  const effectId = makeIdOf(deps)();
  state.ongoing = [...(state.ongoing ?? []), { id: effectId, name: input.name.trim(), damageExpression: input.damageExpression, damageType: input.damageType, saveEnds: input.saveEnds, timing: input.timing ?? 'start' }];
  const timingLabel = (input.timing ?? 'start') === 'start' ? '回合开始' : '回合结束';
  addLog(next, `${actorLabel(next, actor)} 受到持续效果「${input.name.trim()}」影响。`, deps,
    `${timingLabel}承受 ${input.damageExpression} 点${input.damageType}伤害${input.saveEnds ? `；${timingLabel}进行${saveNames[input.saveEnds.ability]}豁免 DC ${input.saveEnds.dc}，成功则移除` : ''}`);
  return { battle: next, effectId };
}

export function removeOngoingEffect(battle: Battle, targetId: string, effectId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, targetId);
  const state = combatantOf(actor);
  const effect = state.ongoing?.find(item => item.id === effectId);
  if (!effect) throw new Error('该单位没有这个持续效果。');
  state.ongoing = state.ongoing!.filter(item => item.id !== effectId);
  addLog(next, `${actorLabel(next, actor)} 的持续效果「${effect.name}」已结束。`, deps);
  return next;
}

export function startConcentration(battle: Battle, actorId: string, spell: string, deps: CombatDeps = {}): Battle {
  if (!spell.trim()) throw new Error('请填写专注的法术名称。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以维持专注。');
  const replaced = state.concentration?.spell;
  state.concentration = { spell: spell.trim() };
  if (replaced && replaced !== spell.trim()) dismissSummonsOf(next, actor.id, `施法者改用「${spell.trim()}」专注`, deps);
  addLog(next, `${actorLabel(next, actor)} 开始专注「${spell.trim()}」。`, deps, replaced ? `替换了原先的「${replaced}」` : undefined);
  return next;
}

export function endConcentration(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (!state.concentration) throw new Error('该单位当前没有维持专注。');
  const spell = state.concentration.spell;
  delete state.concentration;
  dismissSummonsOf(next, actor.id, `施法者结束专注「${spell}」`, deps);
  addLog(next, `${actorLabel(next, actor)} 结束了对「${spell}」的专注。`, deps);
  return next;
}

function applyOngoingDamage(battle: Battle, deps: CombatDeps, timing: 'start' | 'end' = 'start', actorId?: string): void {
  const id = actorId ?? currentActorId(battle);
  if (!id) return;
  const actor = battle.actors.find(item => item.id === id);
  const state = actor?.combat;
  if (!actor || !state?.ongoing?.length) return;
  if (state.status === 'dead') return;
  const random = randomOf(deps);
  const survivors: typeof state.ongoing = [];
  const statusNow = (): CombatStatus => actor.combat?.status ?? 'active';
  for (const effect of state.ongoing) {
    if ((effect.timing ?? 'start') !== timing) { survivors.push(effect); continue; }
    let ended = false;
    if (effect.saveEnds) {
      const save = resolveSave(actor, { actorId: actor.id, ability: effect.saveEnds.ability, dc: effect.saveEnds.dc }, random);
      if (save.success) {
        ended = true;
        addLog(battle, `${actorLabel(battle, actor)} 通过${saveNames[effect.saveEnds.ability]}豁免，结束「${effect.name}」。`, deps, `d20(${save.natural}) = ${save.total}，DC ${effect.saveEnds.dc}`);
      }
    }
    if (!ended) {
      const rolled = rollDamage(effect.damageExpression, random, false);
      const outcome = applyDamageToActor(actor, rolled.total, effect.damageType);
      const concentration = concentrationCheck(battle, actor, outcome.damage, random, deps);
      addLog(battle, `${timing === 'start' ? '回合开始' : '回合结束'}：「${effect.name}」对 ${actorLabel(battle, actor)} 造成 ${outcome.damage} 点${effect.damageType}伤害，剩余 ${actor.currentHp}/${actor.maxHp}。`, deps,
        [`${effect.damageExpression} → ${rolled.total}`, concentration?.text, statusNow() === 'down' ? '倒地，需要死亡豁免' : statusNow() === 'dead' ? '死亡' : ''].filter(Boolean).join('；'));
      survivors.push(effect);
    }
    if (statusNow() === 'dead') { addLog(battle, `${actorLabel(battle, actor)} 已死亡，其余持续效果清除。`, deps); return; }
  }
  state.ongoing = survivors;
}

export function tickTurnStart(battle: Battle, deps: CombatDeps = {}): Battle {
  requireCombat(battle);
  const next = recordUndo(structuredClone(battle));
  applyOngoingDamage(next, deps);
  return next;
}

export function rollDeathSave(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; outcome: DeathSaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'down') throw new Error('只有在 0 点生命值倒地的角色才需要死亡豁免。');
  if (!actor.characterSnapshot) throw new Error('怪物在 0 点生命值时直接死亡，不需要死亡豁免。');
  const natural = rollDie(20, randomOf(deps));
  if (natural === 20) {
    actor.currentHp = 1;
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
    addLog(next, `${actorLabel(next, actor)} 死亡豁免掷出 20，恢复 1 点生命值。`, deps);
    return { battle: next, outcome: { natural, successes: 0, failures: 0, status: 'active', revived: true } };
  }
  if (natural === 1) state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 2);
  else if (natural >= 10) state.deathSaves.successes = Math.min(3, state.deathSaves.successes + 1);
  else state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 1);
  if (state.deathSaves.failures >= 3) state.status = 'dead';
  addLog(next, `${actorLabel(next, actor)} 死亡豁免 d20(${natural})：${state.deathSaves.successes} 成功 / ${state.deathSaves.failures} 失败${state.status === 'dead' ? '，死亡' : state.deathSaves.successes >= 3 ? '，稳定' : ''}。`, deps);
  return { battle: next, outcome: { natural, successes: state.deathSaves.successes, failures: state.deathSaves.failures, status: state.status, revived: false } };
}
export function undoCombat(battle: Battle): Battle {
  const combat = requireCombat(battle);
  const previous = combat.undo.at(-1);
  if (!previous) throw new Error('没有可以撤销的战斗操作。');
  const restored = structuredClone(previous);
  if (restored.combat) restored.combat.undo = combat.undo.slice(0, -1).map(entry => structuredClone(entry));
  return restored;
}
export function resetCombat(battle: Battle): Battle {
  if (!battle.combat) throw new Error('战斗尚未开始。');
  const next = structuredClone(battle);
  delete next.combat;
  for (const actor of next.actors) delete actor.combat;
  return next;
}
export function availableTargets(battle: Battle, attackerId: string): Actor[] {
  return battle.actors.filter(actor => actor.id !== attackerId && actor.combat?.status !== 'dead');
}
export function combatantSummary(actor: Actor): string {
  const state = actor.combat;
  if (!state) return '未记录先攻';
  if (state.status === 'dead') return '死亡';
  if (state.status === 'down') return state.deathSaves.successes >= 3 ? '倒地（稳定）' : `倒地（${state.deathSaves.successes} 成功 / ${state.deathSaves.failures} 失败）`;
  return `先攻 ${state.initiative}`;
}




export type ReinforcementInput = { side: Side; initiative?: number; position?: Position; name?: string };

/** 战斗进行中把新单位插入先攻序列；插入点位于当前行动者之前时，当前行动者保持不变。 */
export function addReinforcement(battle: Battle, card: Card, input: ReinforcementInput, deps: CombatDeps = {}): { battle: Battle; actorId: string; initiative: number } {
  if (!battle.combat) throw new Error('请先开始战斗再加入增援。');
  const name = input.name?.trim() || card.block.name;
  if (!name) throw new Error('请填写增援单位的名称。');
  const maxHp = card.block.hitPoints.average;
  if (!Number.isInteger(maxHp) || maxHp < 1) throw new Error('增援单位的生命值无效。');
  if (input.position && !battle.grid) throw new Error('请先启用方格战场。');
  if (input.initiative !== undefined && (!Number.isInteger(input.initiative) || input.initiative < -20 || input.initiative > 60)) throw new Error('先攻值须为 -20 至 60 的整数。');
  const next = recordUndo(structuredClone(battle));
  const combat = next.combat!;
  if (input.position) {
    const { x, y } = input.position;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= next.grid!.width || y >= next.grid!.height) throw new Error('目标格子超出战场范围。');
    const occupied = next.actors.find(actor => actor.position && actor.position.x === x && actor.position.y === y);
    if (occupied) throw new Error(`该格已有单位：${occupied.name}。`);
  }
  const random = randomOf(deps);
  const actor: Actor = {
    id: makeIdOf(deps)(),
    name,
    side: input.side,
    currentHp: maxHp,
    maxHp,
    source: { entryId: card.entry.id, blockId: card.block.id, entryName: card.entry.name, source: structuredClone(card.entry.source), revision: card.entry.revision },
    template: structuredClone(card.block),
    combat: {
      initiative: 0,
      tempHp: 0,
      conditions: [],
      actionUsed: false,
      bonusUsed: false,
      reactionUsed: false,
      movementUsed: 0,
      status: 'active',
      deathSaves: { successes: 0, failures: 0 },
    },
    ...(input.position ? { position: { x: input.position.x, y: input.position.y } } : {}),
  };
  const initiative = input.initiative ?? rollDie(20, random) + actorInitiativeBonus(actor);
  actor.combat!.initiative = initiative;
  next.actors.push(actor);
  const insertAt = combat.order.findIndex(id => (next.actors.find(a => a.id === id)?.combat?.initiative ?? 0) < initiative);
  const index = insertAt < 0 ? combat.order.length : insertAt;
  combat.order.splice(index, 0, actor.id);
  if (index <= combat.turnIndex) combat.turnIndex += 1;
  addLog(next, `${name} 以先攻 ${initiative} 加入战斗。`, deps);
  return { battle: next, actorId: actor.id, initiative };
}


/** 起身：消耗一半速度的移动力，移除倒地状态。 */
export function standUp(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (currentActorId(next) !== actor.id) throw new Error('只有当前回合的单位可以起身。');
  if (!state.conditions.includes('倒地')) throw new Error('该单位没有倒地。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以起身。');
  const speed = actorSpeed(actor);
  const cost = Math.floor(speed / 2);
  const remaining = Math.max(0, speed - state.movementUsed);
  if (remaining < cost) throw new Error(`剩余移动力不足，起身需要 ${cost} 尺。`);
  state.movementUsed += cost;
  state.conditions = state.conditions.filter(item => item !== '倒地');
  addLog(next, `${actorLabel(next, actor)} 起身，消耗 ${cost} 尺移动力。`, deps);
  return next;
}









