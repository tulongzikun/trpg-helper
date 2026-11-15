import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { getBackground } from './backgrounds.ts';
import { gloomStalkerState } from './rangerSubclasses.ts';
import type { Actor, Battle, CombatLogEntry, CombatStatus, DamageType } from './battle';
import { damageTypes } from './battle.ts';

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

function resetTurnResources(battle: Battle, actorId: string) {
  const combat = battle.actors.find(a => a.id === actorId)?.combat;
  if (!combat) return;
  combat.actionUsed = false;
  combat.bonusUsed = false;
  combat.reactionUsed = false;
  combat.movementUsed = 0;
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
  const actor = nextTurnIndex(next);
  resetTurnResources(next, actor.id);
  addLog(next, `第 ${combat.round} 轮 · 轮到 ${actorLabel(next, actor)}（先攻 ${combatantOf(actor).initiative}）。`, deps);
  return next;
}
export function spendResource(battle: Battle, actorId: string, kind: AttackCost, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error(state.status === 'dead' ? '已死亡的单位无法行动。' : '倒地的单位无法行动。');
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
  if (state.status !== 'active') throw new Error(state.status === 'dead' ? '已死亡的单位无法移动。' : '倒地的单位无法移动。');
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
export function attack(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const attacker = actorOf(next, options.attackerId);
  const target = actorOf(next, options.targetId);
  if (options.attackerId === options.targetId) throw new Error('不能以自己为攻击目标。');
  if (attacker.combat?.status === 'dead') throw new Error('已死亡的单位无法行动。');
  if (attacker.combat?.status === 'down') throw new Error('倒地的单位无法攻击。');
  if (target.combat?.status === 'dead') throw new Error('目标已经死亡。');
  parseDice(options.damageExpression);
  if (!Number.isInteger(options.attackBonus) || options.attackBonus < -20 || options.attackBonus > 40) throw new Error('攻击加值须为 -20 至 40 的整数。');
  if (!damageTypes.includes(options.damageType)) throw new Error('请选择有效的伤害类型。');
  const cost: AttackCost = options.cost ?? 'action';
  if (cost !== 'reaction' && currentActorId(next) !== attacker.id) throw new Error('只有当前回合的单位可以攻击。');
  const state = combatantOf(attacker);
  if (cost === 'action' && state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (cost === 'bonus' && state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  if (cost === 'reaction' && state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  const criticalRange = options.criticalRange ?? 20;
  if (!Number.isInteger(criticalRange) || criticalRange < 15 || criticalRange > 20) throw new Error('重击范围须为 15 至 20。');
  const targetWasDown = combatantOf(target).status === 'down';
  const random = randomOf(deps);
  const mode: AttackMode = options.mode ?? 'normal';
  const first = rollDie(20, random);
  const second = mode === 'normal' ? first : rollDie(20, random);
  const natural = mode === 'advantage' ? Math.max(first, second) : mode === 'disadvantage' ? Math.min(first, second) : first;
  const total = natural + options.attackBonus;
  const targetAc = target.template.armorClass;
  const hit = natural === 20 || (natural !== 1 && total >= targetAc);
  const critical = hit && natural >= criticalRange;
  let damage = 0;
  let tempAbsorbed = 0;
  let status: CombatStatus = combatantOf(target).status;
  let defense = '';
  if (hit) {
    const rolled = rollDamage(options.damageExpression, random, critical);
    const defenseResult = defenseOf(target, options.damageType);
    defense = defenseResult.label;
    const result = applyDamageToActor(target, rolled.total, options.damageType);
    damage = result.damage;
    tempAbsorbed = result.tempAbsorbed;
    status = result.status;
  }
  if (cost === 'action') state.actionUsed = true;
  if (cost === 'bonus') state.bonusUsed = true;
  if (cost === 'reaction') state.reactionUsed = true;
  const rollText = mode === 'normal' ? `d20(${natural})` : `${mode === 'advantage' ? '优势' : '劣势'} d20(${first},${second})→${natural}`;
  const damageText = hit ? `${damage} 点${options.damageType}伤害` : '未造成伤害';
  const detail = [
    `${actorLabel(next, attacker)} → ${actorLabel(next, target)}`,
    `攻击检定 ${rollText}${options.attackBonus >= 0 ? '+' : ''}${options.attackBonus} = ${total} vs AC ${targetAc}`,
    hit ? (critical ? '重击' : '命中') : (natural === 1 ? '大失败' : '未命中'),
    damageText,
    defense,
    `目标剩余 ${target.currentHp}/${target.maxHp}`,
    tempAbsorbed ? `临时生命吸收 ${tempAbsorbed}` : '',
    targetWasDown && damage > tempAbsorbed ? '倒地受击：死亡豁免失败 +1（是否重击按距离人工裁定）' : '',
    status === 'down' ? '目标倒地' : status === 'dead' ? '目标死亡' : '',
  ].filter(Boolean).join(' · ');
  addLog(next, `${actorLabel(next, attacker)} 攻击 ${actorLabel(next, target)}：${hit ? `命中，造成 ${damage} 点${options.damageType}伤害` : '未命中'}。`, deps, detail);
  return { battle: next, outcome: { natural, total, targetAc, hit, critical, damage, tempAbsorbed, targetHp: target.currentHp, status, defense } };
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
