import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { getBackground } from './backgrounds.ts';
import { gloomStalkerState } from './rangerSubclasses.ts';
import type { Terrain, Weather } from './battle.ts';
import type { Ability } from './characters';
import type { Actor, Aura, Battle, CombatLogEntry, CombatStats, CombatStatus, CombatantState, DamageType, GridConfig, Hazard, OpportunityPrompt, Position, ReadyAction, Side, AttackPreset } from './battle';
import type { Card } from './catalog';
import { damageTypes } from './battle.ts';
import { applyFallDamage, jumpDistance } from './combatMovement.ts';
import { actionBlocker, actionSurgeMax, attackerAdjustment, attacksPerAction, combineAttackModes, coverAcBonus, coverNote, coverTypes, criticalThreshold, hasCunningAction, hasEvasion, hasRecklessAttack, hasSecondWind, isAutomaticCritical, sneakAttackDice, targetAdjustment } from './combatModifiers.ts';
import { attackSources, type AttackSource } from './attackSources.ts';
import type { AttackRange, CoverType, ModeAdjustment } from './combatModifiers.ts';

export type Random = () => number;
export type CombatDeps = { random?: Random; makeId?: () => string };
export type AttackCost = 'action' | 'bonus' | 'reaction';
export type AttackMode = 'normal' | 'advantage' | 'disadvantage';
export type AttackOptions = {
  nonLethal?: boolean;
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
  /** 强力攻击（重武器专长）：攻击检定 -5，命中伤害 +10；需要 weaponId 指向带「重型」的武器。 */
  powerAttack?: boolean;
  /** 神射手：忽略半掩体／四分之三掩体，且远程超出常规射程时不承受劣势；需要 weaponId 指向远程或投掷武器。 */
  sharpshooter?: boolean;
  nick?: boolean;
  ignoreCostCheck?: boolean;
  /** 附带的额外伤害骰（如猎人印记、至圣斩），随重击一起翻倍。 */
  extraDamageExpression?: string;
  extraDamageType?: DamageType;
  /** 额外伤害骰是否随重击翻倍，默认是（如至圣斩）；猎人印记等亦然。 */
  extraDamageCritical?: boolean;
  /** 一次攻击动作内的攻击次数，默认 1，不能超过该单位的额外攻击次数。 */
  attacks?: number;
  /** 连续攻击时可以分散到多个目标（按顺序轮流分配），未提供时只用 targetId。 */
  targets?: string[];
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

export const defaultAmmo = 20;
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

/** 巨武器战斗：伤害骰掷出 1 或 2 时可以重掷一次并采用新结果。 */
export function rollGreatWeaponDamage(expression: string, random: Random = Math.random, critical = false): { total: number; rolls: number[]; modifier: number } {
  const dice = parseDice(expression);
  const count = critical ? dice.count * 2 : dice.count;
  const rolls: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const first = rollDie(dice.sides, random);
    rolls.push(first <= 2 ? rollDie(dice.sides, random) : first);
  }
  return { total: rolls.reduce((sum, value) => sum + value, 0) + dice.modifier, rolls, modifier: dice.modifier };
}

/** 巨武器战斗风格是否适用于这次攻击（双手近战武器）。 */
function greatWeaponFighting(actor: Actor, options: AttackOptions): boolean {
  if (!fightingStylesOf(actor).includes('巨武器战斗')) return false;
  const source = options.weaponId ? attackSources(actor).find(item => item.id === options.weaponId) : undefined;
  if (!source || source.range !== 'melee') return false;
  return source.properties?.includes('双手') === true || source.properties?.includes('重型') === true || options.twoHanded === true;
}

/** 防御风格：穿着护甲时 AC +1。 */
function defenseBonus(actor: Actor): number {
  return fightingStylesOf(actor).includes('防御') ? 1 : 0;
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
export function aurasOf(battle: Battle): Aura[] {
  return battle.auras ?? [];
}

/** 影响该单位的灵光：施放者在场、阵营相同（或自己）、且在半径内。 */
export function activeAuras(battle: Battle, actorId: string): Aura[] {
  const actor = battle.actors.find(item => item.id === actorId);
  if (!actor || actor.combat?.status !== 'active') return [];
  return aurasOf(battle).filter(aura => {
    const owner = battle.actors.find(item => item.id === aura.ownerId);
    if (!owner || owner.combat?.status !== 'active') return false;
    if (owner.id === actor.id) return true;
    if (owner.side === '中立' || actor.side === '中立') return false;
    if (owner.side !== actor.side) return false;
    const distance = actorDistance(battle, owner.id, actor.id);
    return distance !== undefined && distance <= aura.radiusFt;
  });
}

export function auraBonus(battle: Battle, actorId: string, kind: Aura['kind']): number {
  return activeAuras(battle, actorId).filter(aura => aura.kind === kind).reduce((sum, aura) => sum + aura.bonus, 0);
}

export type AuraInput = { name: string; ownerId: string; radiusFt: number; bonus: number; kind: Aura['kind'] };

export function addAura(battle: Battle, input: AuraInput, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const name = input.name?.trim() ?? '';
  if (!name) throw new Error('请填写灵光名称。');
  const owner = next.actors.find(actor => actor.id === input.ownerId);
  if (!owner) throw new Error('灵光的来源单位不存在。');
  if (owner.combat?.status !== 'active') throw new Error('只有在场的单位可以产生灵光。');
  if (!Number.isInteger(input.radiusFt) || input.radiusFt < 5 || input.radiusFt > 60) throw new Error('灵光半径须为 5 至 60 尺的整数。');
  if (!Number.isInteger(input.bonus) || input.bonus < 1 || input.bonus > 5) throw new Error('灵光加值须为 1 至 5 的整数。');
  if (input.kind !== 'ac' && input.kind !== 'saves') throw new Error('灵光效果只能是 AC 或豁免。');
  if (aurasOf(next).length >= 8) throw new Error('一场战斗最多维持 8 个灵光。');
  const aura: Aura = { id: makeIdOf(deps)(), name, ownerId: owner.id, radiusFt: input.radiusFt, bonus: input.bonus, kind: input.kind };
  next.auras = [...aurasOf(next), aura];
  addLog(next, `${actorLabel(next, owner)} 的「${name}」开始生效（半径 ${aura.radiusFt} 尺，${aura.kind === 'ac' ? 'AC' : '豁免'} +${aura.bonus}）。`, deps);
  return next;
}

export function removeAura(battle: Battle, auraId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const aura = aurasOf(next).find(item => item.id === auraId);
  if (!aura) throw new Error('灵光不存在。');
  next.auras = aurasOf(next).filter(item => item.id !== auraId);
  addLog(next, `「${aura.name}」的灵光结束。`, deps);
  return next;
}
export function reloadAmmo(battle: Battle, actorId: string, count: number = defaultAmmo, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (!Number.isInteger(count) || count < 1 || count > 999) throw new Error('弹药数量须为 1 至 999 的整数。');
  if (actor.combat?.status !== 'active') throw new Error('只有在场的单位可以补充弹药。');
  combatantOf(actor).ammo = count;
  addLog(next, `${actorLabel(next, actor)} 补充弹药至 ${count} 发。`, deps);
  return next;
}

/** 常用攻击的输入：名称 + 一套攻击参数。 */
export type AttackPresetInput = { name: string; attackerId: string; targetId: string; attackBonus: number; damageExpression: string; damageType: DamageType; range: AttackRange; weaponId?: string; sharpshooter?: boolean; powerAttack?: boolean; twoHanded?: boolean };

/** 保存一套常用攻击（同名同攻击者会覆盖）。 */
export function saveAttackPreset(battle: Battle, input: AttackPresetInput, deps: CombatDeps = {}): { battle: Battle; presetId: string } {
  const next = recordUndo(structuredClone(battle));
  const name = input.name.trim();
  if (!name) throw new Error('请填写常用攻击的名称。');
  if (name.length > 30) throw new Error('常用攻击的名称不能超过 30 个字符。');
  const attacker = actorOf(next, input.attackerId);
  actorOf(next, input.targetId);
  if (!Number.isInteger(input.attackBonus) || input.attackBonus < -10 || input.attackBonus > 30) throw new Error('攻击加值须为 -10 至 30 的整数。');
  parseDice(input.damageExpression);
  if (!damageTypes.includes(input.damageType)) throw new Error('伤害类型无效。');
  if (input.range !== 'melee' && input.range !== 'ranged') throw new Error('攻击距离类型无效。');
  if (input.weaponId !== undefined && !attackSources(attacker).some(item => item.id === input.weaponId)) throw new Error('常用攻击的武器无效。');
  const list = [...(next.attackPresets ?? [])];
  const existing = list.find(item => item.attackerId === input.attackerId && item.name === name);
  const presetId = existing?.id ?? makeIdOf(deps)();
  const preset: AttackPreset = { id: presetId, name, attackerId: input.attackerId, targetId: input.targetId, attackBonus: input.attackBonus, damageExpression: input.damageExpression, damageType: input.damageType, range: input.range, ...(input.weaponId ? { weaponId: input.weaponId } : {}), ...(input.sharpshooter ? { sharpshooter: true } : {}), ...(input.powerAttack ? { powerAttack: true } : {}), ...(input.twoHanded ? { twoHanded: true } : {}) };
  if (existing) list[list.indexOf(existing)] = preset;
  else {
    if (list.length >= 10) throw new Error('最多保存 10 个常用攻击。');
    list.push(preset);
  }
  next.attackPresets = list;
  addLog(next, `${actorLabel(next, attacker)} 保存了常用攻击「${name}」。`, deps);
  return { battle: next, presetId };
}

/** 删除一个常用攻击。 */
export function removeAttackPreset(battle: Battle, presetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const list = [...(next.attackPresets ?? [])];
  const target = list.find(item => item.id === presetId);
  if (!target) throw new Error('该常用攻击不存在。');
  const rest = list.filter(item => item !== target);
  if (rest.length) next.attackPresets = rest;
  else delete next.attackPresets;
  addLog(next, `删除了常用攻击「${target.name}」。`, deps);
  return next;
}

/** 用保存好的常用攻击直接结算一次攻击。 */
export function attackWithPreset(battle: Battle, presetId: string, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome; targetId: string } {
  const preset = (battle.attackPresets ?? []).find(item => item.id === presetId);
  if (!preset) throw new Error('该常用攻击不存在。');
  const attacker = battle.actors.find(item => item.id === preset.attackerId);
  if (!attacker) throw new Error('该常用攻击的攻击者不在战斗中。');
  const targetId = presetTarget(battle, preset, attacker);
  const result = attack(battle, { attackerId: preset.attackerId, targetId, attackBonus: preset.attackBonus, damageExpression: preset.damageExpression, damageType: preset.damageType, range: preset.range, ...(preset.weaponId ? { weaponId: preset.weaponId } : {}), ...(preset.sharpshooter ? { sharpshooter: true } : {}), ...(preset.powerAttack ? { powerAttack: true } : {}), ...(preset.twoHanded ? { twoHanded: true } : {}) }, deps);
  return { ...result, targetId };
}

/** 常用攻击的目标已倒下或离场时，改打最近的敌对单位。 */
function presetTarget(battle: Battle, preset: AttackPreset, attacker: Actor): string {
  const original = battle.actors.find(item => item.id === preset.targetId);
  const usable = !!original && original.combat?.status === 'active' && original.side !== attacker.side;
  if (usable) return preset.targetId;
  const candidates = battle.actors.filter(item => item.id !== attacker.id && item.side !== attacker.side && item.side !== '中立' && item.combat?.status === 'active');
  if (!candidates.length) throw new Error('没有可以攻击的目标。');
  if (!battle.grid || !attacker.position) return candidates[0].id;
  const sorted = candidates.slice().sort((left, right) => {
    const leftDistance = left.position ? cellDistance(attacker.position!, left.position) : Number.MAX_SAFE_INTEGER;
    const rightDistance = right.position ? cellDistance(attacker.position!, right.position) : Number.MAX_SAFE_INTEGER;
    return leftDistance - rightDistance;
  });
  return sorted[0].id;
}

export function appendLog(battle: Battle, text: string, deps: CombatDeps = {}, detail?: string): Battle {
  addLog(battle, text, deps, detail);
  return battle;
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
/** 先攻相同时的稳定裁决：敏捷调整值高的在前，再按名称排序。 */
function initiativeTiebreak(left: Actor, right: Actor): number {
  return actorDexModifier(right) - actorDexModifier(left) || left.name.localeCompare(right.name, 'zh-CN');
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
/** 力竭惩罚：每级 -2（攻击、豁免、属性检定）与 -5 尺速度。 */
function exhaustionPenalty(actor: Actor): number {
  return 2 * (actor.combat?.exhaustion ?? 0);
}
function exhaustionSpeedPenalty(actor: Actor): number {
  return 5 * (actor.combat?.exhaustion ?? 0);
}
/** 本回合可用的移动力：基础速度加上疾跑带来的额外移动力，并扣除减速与力竭。 */
function movementAllowance(actor: Actor): number {
  const mountSpeed = actor.combat?.mountSpeedFt ?? 0;
  const mountBase = mountSpeed > actorSpeed(actor) ? mountSpeed : actorSpeed(actor);
  const base = actor.combat?.hasted ? mountBase * 2 : mountBase;
  const paced = actor.combat?.slowed ? Math.floor(base / 2) : base;
  const shaped = actor.combat?.polymorphed ? Math.min(base, 25) : base;
  return Math.max(0, Math.min(paced, shaped) - (actor.combat?.speedPenaltyFt ?? 0) - exhaustionSpeedPenalty(actor)) + (actor.combat?.dashMovement ?? 0);
}
/** 骑手可以骑上 5 尺内的同阵营坐骑，并继承它的速度。 */
export function mountUp(battle: Battle, riderId: string, mountId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (riderId === mountId) throw new Error('单位不能骑乘自己。');
  const rider = actorOf(next, riderId);
  const mount = actorOf(next, mountId);
  if (combatantOf(rider).status !== 'active') throw new Error('只有处于战斗中的单位可以骑乘。');
  if (combatantOf(mount).status !== 'active') throw new Error('只能骑乘在场的坐骑。');
  if (rider.combat?.mountedOn) throw new Error('该单位已经骑乘在坐骑上。');
  if (mount.combat?.riderId) throw new Error('这匹坐骑上已经有骑手了。');
  if (rider.side !== mount.side) throw new Error('只能骑乘同阵营的坐骑。');
  const distance = actorDistance(next, riderId, mountId);
  if (distance !== undefined && distance > 5) throw new Error('骑乘需要与坐骑相邻（5 尺内）。');
  const riderState = combatantOf(rider);
  const mountState = combatantOf(mount);
  riderState.mountedOn = mount.id;
  riderState.mountSpeedFt = actorSpeed(mount);
  mountState.riderId = rider.id;
  addLog(next, `${actorLabel(next, rider)} 骑上了 ${actorLabel(next, mount)}（速度 ${actorSpeed(mount)} 尺）。`, deps);
  return next;
}

/** 主动下马：清除骑乘关系，速度恢复为自身速度。 */
export function dismount(battle: Battle, riderId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const rider = actorOf(next, riderId);
  const mountedOn = rider.combat?.mountedOn;
  if (!mountedOn) throw new Error('该单位没有骑乘坐骑。');
  const mount = next.actors.find(item => item.id === mountedOn);
  delete rider.combat?.mountedOn;
  delete rider.combat?.mountSpeedFt;
  if (mount?.combat) delete mount.combat.riderId;
  addLog(next, `${actorLabel(next, rider)} 从 ${mount ? actorLabel(next, mount) : '坐骑'} 上下来。`, deps);
  return next;
}

/** 与骑手相邻、可以骑乘的同阵营单位。 */
export function mountCandidates(battle: Battle, riderId: string): Actor[] {
  const rider = battle.actors.find(item => item.id === riderId);
  if (!rider) return [];
  return battle.actors.filter(item =>
    item.id !== riderId
    && item.side === rider.side
    && item.combat?.status === 'active'
    && !item.combat?.riderId
    && (actorDistance(battle, riderId, item.id) ?? 0) <= 5);
}

/** 缓慢术：受影响期间无法使用反应。 */
function requireReactionAllowed(actor: Actor): void {
  if (actor.combat?.slowed) throw new Error('缓慢术的影响下无法使用反应。');
}
/** 长武器大师：用长武器的柄端作附赠动作攻击，造成 1d4 + 力量调整值的钝击伤害。 */
export function buttEndAttack(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const next = structuredClone(battle);
  const attacker = actorOf(next, options.attackerId);
  const source = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
  if (!source) throw new Error('请选择长武器。');
  const polearm = source.properties?.includes('长武器') || ['戟', '长棍', '长矛'].some(name => source.label.includes(name));
  if (!polearm) throw new Error('只有长武器可以用柄端攻击。');
  const strength = attacker.characterSnapshot?.sheet.abilities.str ?? attacker.template.abilities?.str ?? 10;
  const modifier = abilityModifier(strength);
  const buttOptions: AttackOptions = {
    ...options,
    cost: 'bonus',
    weaponId: undefined,
    range: 'melee',
    damageType: '钝击',
    damageExpression: `1d4${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`,
  };
  return attack(next, buttOptions, deps);
}

/** 哨兵：被长武器打中的敌人本回合剩余移动力清零。 */
function sentinelSlowdown(target: Actor, source: AttackSource | undefined): void {
  if (!source) return;
  const polearm = source.properties?.includes('长武器') || ['戟', '长棍', '长矛'].some(name => source.label.includes(name));
  if (!polearm) return;
  const state = combatantOf(target);
  const allowance = movementAllowance(target);
  state.movementUsed = Math.max(state.movementUsed, allowance);
}

/** 切换「哨兵」专长标记：被长武器打中的目标本回合移动力清零，且邻近敌人攻击他人时会被盯上。 */
export function setSentinel(battle: Battle, actorId: string, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = structuredClone(battle);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (enabled) {
    state.sentinel = true;
    addLog(next, `${actorLabel(next, actor)} 启用哨兵专长。`, deps);
  } else {
    delete state.sentinel;
    addLog(next, `${actorLabel(next, actor)} 停用哨兵专长。`, deps);
  }
  return next;
}

/** 俯冲攻击：从 10 尺以上高空扑向目标，攻击检定获得优势，命中后落地。 */
export function diveAttack(battle: Battle, options: AttackOptions, deps: CombatDeps = {}): { battle: Battle; outcome: AttackOutcome } {
  const probe = structuredClone(battle);
  requireCombat(probe);
  const attacker = actorOf(probe, options.attackerId);
  if (combatantOf(attacker).flying !== true) throw new Error('只有飞行中的单位可以俯冲攻击。');
  if ((attacker.elevation ?? 0) < 10) throw new Error('俯冲需要至少 10 尺的高度。');
  const result = attack(probe, { ...options, mode: options.mode ?? 'advantage' }, deps);
  const diver = actorOf(result.battle, options.attackerId);
  if (diver.combat) diver.combat.flying = false;
  delete diver.elevation;
  addLog(result.battle, `${actorLabel(result.battle, diver)} 俯冲落地。`, deps);
  return { battle: result.battle, outcome: { ...result.outcome, notes: [...result.outcome.notes, '俯冲攻击：攻击检定优势，落地后失去飞行'] } };
}
/** 设置单位高度（尺），用于高低差判定：远程攻击从 10 尺以上高处射击有优势，仰射则有劣势。 */
export function setElevation(battle: Battle, actorId: string, feet: number, deps: CombatDeps = {}): Battle {
  if (!Number.isInteger(feet) || feet < 0 || feet > 500) throw new Error('高度须为 0 至 500 尺的整数。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (feet === 0) delete actor.elevation;
  else actor.elevation = feet;
  addLog(next, feet === 0 ? `${actorLabel(next, actor)} 回到地面。` : `${actorLabel(next, actor)} 的高度设为 ${feet} 尺。`, deps);
  return next;
}
/** 从当前高度跳下：按坠落规则结算伤害（每 10 尺 1d6），并清除高度。 */
export function dropDown(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; fallen: number } {
  const probe = structuredClone(battle);
  requireCombat(probe);
  const actor = actorOf(probe, actorId);
  const feet = actor.elevation ?? 0;
  if (feet <= 0) throw new Error('该单位没有高度，无法跳下。');
  if (combatantOf(actor).status !== 'active') throw new Error('只有在场的单位可以跳下。');
  const fall = feet >= 10 ? applyFallDamage(probe, actorId, feet, deps) : null;
  const next = fall ? fall.battle : recordUndo(probe);
  const diver = actorOf(next, actorId);
  delete diver.elevation;
  addLog(next, `${actorLabel(next, diver)} 从 ${feet} 尺高处跳下。`, deps);
  if (diver.combat) diver.combat.flying = false;
  return { battle: next, fallen: feet };
}

/** 切换「战地施法者」专长：开启后专注检定具有优势。 */
export function setWarCaster(battle: Battle, actorId: string, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (enabled) state.warCaster = true; else delete state.warCaster;
  addLog(next, enabled ? `${actorLabel(next, actor)} 使用战地施法者：专注检定具有优势。` : `${actorLabel(next, actor)} 不再享受战地施法者的专注优势。`, deps);
  return next;
}

/** 切换「防守决斗」专长标记。 */
export function setDefensiveDuelist(battle: Battle, actorId: string, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (enabled) state.defensiveDuelist = true;
  else {
    delete state.defensiveDuelist;
    delete state.parryBonus;
  }
  addLog(next, enabled ? `${actorLabel(next, actor)} 启用防守决斗：可用反应让自己 AC 加上熟练加值。` : `${actorLabel(next, actor)} 不再使用防守决斗。`, deps);
  return next;
}

/** 防守决斗：消耗反应，让 AC 加上熟练加值，直到自己下个回合开始。 */
export function parry(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以格挡。');
  if (state.defensiveDuelist !== true) throw new Error('只有持有防守决斗专长的单位可以格挡。');
  requireReactionAllowed(actor);
  if (state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  const melee = attackSources(actor).find(item => item.range === 'melee');
  if (!melee) throw new Error('需要持有近战武器才能使用防守决斗。');
  const bonus = proficiencyBonus(actor.characterSnapshot?.sheet.level ?? 1);
  state.reactionUsed = true;
  state.parryBonus = bonus;
  addLog(next, `${actorLabel(next, actor)} 用「${melee.label}」格挡，AC +${bonus} 直到下个回合开始。`, deps);
  return next;
}

/** 祝福术的合法目标：30 尺内的友方（不含施法者自己），没有方格战场时不限距离。 */
export function blessTargets(battle: Battle, casterId: string): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => item.side === caster.side
    && item.side !== '中立'
    && item.id !== casterId
    && (item.combat?.status ?? 'active') === 'active'
    && (!battle.grid || !caster.position || !item.position || (actorDistance(battle, casterId, item.id) ?? 0) <= 30));
}

const GREASE_DC = 13;

/** 该格是否被油腻术覆盖。 */
export function greaseAt(battle: Battle, x: number, y: number): boolean {
  return (battle.grease ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 站在油污上的单位做 DC 13 敏捷豁免，失败倒地；飞行单位不受影响。 */
function greaseFall(battle: Battle, actor: Actor, deps: CombatDeps): boolean {
  const state = combatantOf(actor);
  if (state.flying === true) return false;
  const position = actor.position;
  if (!position || !greaseAt(battle, position.x, position.y)) return false;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'dex', dc: GREASE_DC, bonus: defaultSaveBonus(actor, 'dex') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 在油污上稳住了脚（敏捷豁免 DC ${GREASE_DC} 成功）。`, deps);
    return false;
  }
  if (!state.conditions.includes('倒地')) state.conditions.push('倒地');
  addLog(battle, `${actorLabel(battle, actor)} 在油污上滑倒，倒地。`, deps);
  return true;
}

const HOLD_DC = 13;
const HOLD_RANGE_FT = 60;

/** 敌对目标：敌方阵营、在场、且在给定距离内（无位置时不限距）。 */
export function hostileTargets(battle: Battle, casterId: string, rangeFt = HOLD_RANGE_FT): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => {
    if (item.id === casterId || item.side === caster.side || item.side === '中立') return false;
    if ((item.combat?.status ?? 'active') !== 'active') return false;
    const feet = actorDistance(battle, casterId, item.id);
    return feet === undefined || feet <= rangeFt;
  });
}

function clearParalysis(battle: Battle, actor: Actor, note: string, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state || state.paralyzed === undefined) return;
  delete state.paralyzed;
  delete state.paralyzedBy;
  state.conditions = state.conditions.filter(condition => condition !== '麻痹');
  addLog(battle, `${actorLabel(battle, actor)} ${note}`, deps);
}

/** 定身术：目标每回合开始时重新掷感知豁免，成功或持续轮数耗尽即解除。 */
function holdRecover(battle: Battle, actor: Actor, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state?.paralyzed) return;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'wis', dc: HOLD_DC }, randomOf(deps));
  if (save.success) {
    clearParalysis(battle, actor, `挣脱了定身术（感知 ${save.natural} → ${save.total}，DC ${HOLD_DC}）。`, deps);
    return;
  }
  state.paralyzed -= 1;
  if (state.paralyzed <= 0) clearParalysis(battle, actor, '身上的定身术结束了。', deps);
  else addLog(battle, `${actorLabel(battle, actor)} 没能挣脱定身术（感知 ${save.natural} → ${save.total}，DC ${HOLD_DC}），还剩 ${state.paralyzed} 轮。`, deps);
}

/** 定身术：动作施放 + 专注，60 尺内单体感知豁免 DC 13，失败则麻痹 10 轮。 */
export function castHoldPerson(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放定身术。');
  const target = actorOf(next, targetId);
  const targetState = combatantOf(target);
  if (targetState.status !== 'active') throw new Error('只能对在场的单位施放定身术。');
  if (target.id === casterId) throw new Error('定身术不能对自己施放。');
  if (caster.position && target.position) {
    const feet = actorDistance(next, casterId, targetId) ?? 0;
    if (feet > HOLD_RANGE_FT) throw new Error('定身术只能影响 60 尺内的单位。');
  }
  if (targetState.conditions.includes('麻痹')) throw new Error('目标已经处于麻痹状态。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '定身术' };
  const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: HOLD_DC }, randomOf(deps));
  if (save.success) {
    addLog(next, `${actorLabel(next, caster)} 施放定身术，${actorLabel(next, target)} 抵抗住了（感知 ${save.natural} → ${save.total}，DC ${HOLD_DC}）。`, deps);
    return next;
  }
  targetState.conditions = [...targetState.conditions, '麻痹'];
  targetState.paralyzed = 10;
  targetState.paralyzedBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放定身术，${actorLabel(next, target)} 被定住：麻痹 10 轮（感知 ${save.natural} → ${save.total}，DC ${HOLD_DC}）。`, deps);
  return next;
}

export type CommandKind = 'drop' | 'halt';

const COMMAND_DC = 13;
const COMMAND_RANGE_FT = 60;
const COMMAND_LABEL: Record<CommandKind, string> = { drop: '落地', halt: '停止' };

/** 命令术：动作施放，60 尺内单体感知豁免 DC 13；失败则立刻倒地或失去下一个回合。 */
export function castCommand(battle: Battle, casterId: string, targetId: string, command: CommandKind, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放命令术。');
  if (command !== 'drop' && command !== 'halt') throw new Error('命令术的指令无效，只能是「落地」或「停止」。');
  const target = actorOf(next, targetId);
  const targetState = combatantOf(target);
  if (targetState.status !== 'active') throw new Error('只能对在场的单位施放命令术。');
  if (target.id === casterId) throw new Error('命令术不能对自己施放。');
  if (caster.position && target.position) {
    const feet = actorDistance(next, casterId, targetId) ?? 0;
    if (feet > COMMAND_RANGE_FT) throw new Error('命令术只能影响 60 尺内的单位。');
  }
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: COMMAND_DC }, randomOf(deps));
  const label = COMMAND_LABEL[command];
  if (save.success) {
    addLog(next, `${actorLabel(next, caster)} 施放命令术「${label}」，${actorLabel(next, target)} 抵抗住了（感知 ${save.natural} → ${save.total}，DC ${COMMAND_DC}）。`, deps);
    return next;
  }
  if (command === 'drop') {
    if (!targetState.conditions.includes('倒地')) targetState.conditions = [...targetState.conditions, '倒地'];
    addLog(next, `${actorLabel(next, caster)} 施放命令术「落地」，${actorLabel(next, target)} 应声倒地（感知 ${save.natural} → ${save.total}，DC ${COMMAND_DC}）。`, deps);
    return next;
  }
  targetState.commanded = 'halt';
  addLog(next, `${actorLabel(next, caster)} 施放命令术「停止」，${actorLabel(next, target)} 的下一个回合无法行动（感知 ${save.natural} → ${save.total}，DC ${COMMAND_DC}）。`, deps);
  return next;
}

const SILENCE_MAX_CELLS = 20;

/** 该格是否被沉默术覆盖。 */
export function silenceAt(battle: Battle, x: number, y: number): boolean {
  return (battle.silence ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 施法者是否站在沉默区域内：区域内无法施放需要言语成分的法术。 */
export function silenceBlocks(battle: Battle, actorId: string): boolean {
  const cells = battle.silence ?? [];
  if (!cells.length) return false;
  const actor = battle.actors.find(item => item.id === actorId);
  if (!actor?.position) return false;
  return silenceAt(battle, actor.position.x, actor.position.y);
}

/** 所有已实现的法术都含言语成分：站在沉默区域时必须先离开。 */
function requireVoice(battle: Battle, casterId: string): void {
  if (silenceBlocks(battle, casterId)) throw new Error('处于沉默区域，无法施放需要言语成分的法术。');
}

/** 沉默术：动作施放 + 专注，1–20 格内无法施放需要言语成分的法术。 */
export function castSilence(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('沉默术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('沉默术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择沉默术覆盖的格子。');
  if (unique.size > SILENCE_MAX_CELLS) throw new Error('沉默术最多覆盖 20 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放沉默术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '沉默术' };
  next.silence = [...unique.values()];
  next.silenceBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放沉默术：${next.silence.length} 格内无法施放需要言语成分的法术，持续 10 轮。`, deps);
  return next;
}

const SLEEP_CLOUD_DC = 13;
const SLEEP_CLOUD_MAX_CELLS = 12;

/** 该格是否在睡眠云范围内。 */
export function sleepCloudAt(battle: Battle, x: number, y: number): boolean {
  return (battle.sleepCloud ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 站在睡眠云里：感知豁免 DC 13，失败立刻陷入沉睡（失能 + 倒地）。 */
function sleepDust(battle: Battle, actor: Actor, deps: CombatDeps): boolean {
  if (!battle.sleepCloud?.length || !actor.position) return false;
  const state = combatantOf(actor);
  if (state.status !== 'active' || state.sleeping === true) return false;
  if (!sleepCloudAt(battle, actor.position.x, actor.position.y)) return false;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'wis', dc: SLEEP_CLOUD_DC, bonus: defaultSaveBonus(actor, 'wis') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 在睡眠云中屏住呼吸，没有陷入沉睡（感知 ${save.natural} → ${save.total}，DC ${SLEEP_CLOUD_DC}）。`, deps);
    return false;
  }
  state.sleeping = true;
  if (!state.conditions.includes('失能')) state.conditions.push('失能');
  if (!state.conditions.includes('倒地')) state.conditions.push('倒地');
  addLog(battle, `${actorLabel(battle, actor)} 吸入睡眠粉尘，陷入沉睡（感知 ${save.natural} → ${save.total}，DC ${SLEEP_CLOUD_DC}）。`, deps);
  return true;
}

/** 睡眠云：动作 + 专注；区域内单位每回合开始或进入时做感知豁免 DC 13，失败即沉睡。 */
export function castSleepCloud(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放睡眠云。');
  if (!next.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('睡眠云的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= next.grid.width || cell.y >= next.grid.height) throw new Error('睡眠云的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择睡眠云覆盖的格子。');
  if (unique.size > SLEEP_CLOUD_MAX_CELLS) throw new Error(`睡眠云最多覆盖 ${SLEEP_CLOUD_MAX_CELLS} 格。`);
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '睡眠云' };
  next.sleepCloud = [...unique.values()];
  next.sleepCloudBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放睡眠云：${next.sleepCloud.length} 格内每回合开始需做感知豁免 DC ${SLEEP_CLOUD_DC}，持续 10 轮。`, deps);
  for (const target of [...next.actors]) {
    if (target.id === casterId) continue;
    sleepDust(next, target, deps);
  }
  return next;
}
const SLEEP_DICE = '5d8';
const SLEEP_RANGE_FT = 20;

/** 沉睡术：动作施放，掷 5d8 得到生命值池，按当前生命值由低到高让 20 尺内目标陷入沉睡（失能 + 倒地），直到池子耗尽。 */
export function castSleep(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): { battle: Battle; pool: number; slept: string[] } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放沉睡术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const ids = [...new Set(targetIds)].filter(id => id !== casterId);
  if (!ids.length) throw new Error('请选择沉睡术的目标。');
  for (const id of ids) {
    const target = actorOf(next, id);
    if (combatantOf(target).status !== 'active') throw new Error('沉睡术只能影响在场的单位。');
    if (caster.position && target.position) {
      const feet = actorDistance(next, casterId, id) ?? 0;
      if (feet > SLEEP_RANGE_FT) throw new Error(`沉睡术只能影响 ${SLEEP_RANGE_FT} 尺内的单位。`);
    }
  }
  const rolled = rollDamage(SLEEP_DICE, randomOf(deps));
  let pool = rolled.total;
  state.actionUsed = true;
  const slept: string[] = [];
  const ordered = [...ids].sort((left, right) => actorOf(next, left).currentHp - actorOf(next, right).currentHp);
  for (const id of ordered) {
    const target = actorOf(next, id);
    const targetState = combatantOf(target);
    if (targetState.sleeping === true) continue;
    if (target.currentHp > pool) continue;
    pool -= target.currentHp;
    targetState.sleeping = true;
    if (!targetState.conditions.includes('失能')) targetState.conditions.push('失能');
    if (!targetState.conditions.includes('倒地')) targetState.conditions.push('倒地');
    slept.push(id);
  }
  const names = slept.map(id => actorLabel(next, actorOf(next, id))).join('、');
  addLog(next, slept.length
    ? `${actorLabel(next, caster)} 施放沉睡术：${SLEEP_DICE} → ${rolled.total}，${names} 陷入沉睡（消耗 ${rolled.total - pool} 点生命值池）。`
    : `${actorLabel(next, caster)} 施放沉睡术：${SLEEP_DICE} → ${rolled.total}，没有目标的生命值低于剩余池子，无人陷入沉睡。`, deps);
  return { battle: next, pool, slept };
}

/** 唤醒：动作叫醒 5 尺内的沉睡者，移除失能与倒地。 */
export function wakeUp(battle: Battle, actorId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以唤醒同伴。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const target = actorOf(next, targetId);
  const targetState = combatantOf(target);
  if (targetState.sleeping !== true) throw new Error('该单位没有处于沉睡。');
  if (actor.position && target.position && (actorDistance(next, actorId, targetId) ?? 0) > 5) throw new Error('只能唤醒 5 尺内的沉睡者。');
  state.actionUsed = true;
  delete targetState.sleeping;
  targetState.conditions = targetState.conditions.filter(condition => condition !== '失能' && condition !== '倒地');
  addLog(next, `${actorLabel(next, actor)} 叫醒了 ${actorLabel(next, target)}。`, deps);
  return next;
}

const DARKNESS_MAX_CELLS = 12;

/** 该格是否处于魔法黑暗。 */
export function darknessAt(battle: Battle, x: number, y: number): boolean {
  return (battle.darkness ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 该单位是否站在魔法黑暗中。 */
export function inDarkness(battle: Battle, actorId: string): boolean {
  const actor = battle.actors.find(item => item.id === actorId);
  if (!actor?.position) return false;
  return darknessAt(battle, actor.position.x, actor.position.y);
}

/** 黑暗术：动作施放 + 专注，1–12 格成为魔法黑暗；看不清对方时攻击检定劣势，也无法借机攻击。 */
export function castDarkness(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('黑暗术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('黑暗术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择黑暗术覆盖的格子。');
  if (unique.size > DARKNESS_MAX_CELLS) throw new Error('黑暗术最多覆盖 12 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  requireVoice(next, casterId);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放黑暗术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '黑暗术' };
  next.darkness = [...unique.values()];
  next.darknessBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放黑暗术：魔法黑暗覆盖 ${next.darkness.length} 格，持续 10 轮。`, deps);
  return next;
}

const FOG_MAX_CELLS = 24;

/** 雾云术：动作施放 + 专注，1–24 格内成为重度遮蔽；攻击者与目标分处雾内外时攻击检定劣势。 */
export function castFogCloud(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('雾云术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('雾云术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择雾云术覆盖的格子。');
  if (unique.size > FOG_MAX_CELLS) throw new Error('雾云术最多覆盖 24 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  requireVoice(next, casterId);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放雾云术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '雾云术' };
  next.fog = [...unique.values()];
  next.fogBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放雾云术：迷雾覆盖 ${next.fog.length} 格，雾内为重度遮蔽，持续 10 轮。`, deps);
  return next;
}

/** 油腻术：动作施放，指定若干格（最多 12 格）；进入或回合开始时需通过 DC 13 敏捷豁免，失败倒地。 */
export function castGrease(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('油腻术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('油腻术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择油腻术覆盖的格子。');
  if (unique.size > 12) throw new Error('油腻术最多覆盖 12 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  requireVoice(next, casterId);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放油腻术。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  const list = [...unique.values()];
  const keys = new Set(list.map(cell => `${cell.x},${cell.y}`));
  next.grease = [...(next.grease ?? []).filter(cell => !keys.has(`${cell.x},${cell.y}`)), ...list];
  addLog(next, `${actorLabel(next, caster)} 施放油腻术：油污覆盖 ${list.length} 格，进入或回合开始时需通过 DC ${GREASE_DC} 敏捷豁免，失败倒地。`, deps);
  return next;
}

const ENTANGLE_DC = 13;
const ENTANGLE_MAX_CELLS = 16;

/** 该格是否被纠缠术的藤蔓覆盖。 */
export function entangleAt(battle: Battle, x: number, y: number): boolean {
  return (battle.entangle ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 踏入或停留在藤蔓中的单位做 DC 13 力量豁免：失败被「束缚」，挣脱后不会再次被同一片藤蔓缠住。 */
function entangleSnare(battle: Battle, actor: Actor, deps: CombatDeps): boolean {
  const state = combatantOf(actor);
  if (state.flying === true) return false;
  const position = actor.position;
  if (!position || !entangleAt(battle, position.x, position.y)) return false;
  const held = state.entangled === true;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'str', dc: ENTANGLE_DC, bonus: defaultSaveBonus(actor, 'str') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (save.success) {
    if (held) {
      delete state.entangled;
      state.conditions = state.conditions.filter(condition => condition !== '束缚');
      addLog(battle, `${actorLabel(battle, actor)} 挣脱了藤蔓的缠绕（力量 ${save.total} ≥ DC ${ENTANGLE_DC}）。`, deps);
    }
    return false;
  }
  if (held) {
    addLog(battle, `${actorLabel(battle, actor)} 仍被藤蔓缠住（力量 ${save.total} < DC ${ENTANGLE_DC}）。`, deps);
    return false;
  }
  if (state.conditions.includes('束缚')) return false;
  state.conditions.push('束缚');
  state.entangled = true;
  addLog(battle, `${actorLabel(battle, actor)} 被藤蔓缠住，束缚（力量 ${save.total} < DC ${ENTANGLE_DC}）。`, deps);
  return true;
}

/** 施放纠缠术：覆盖 1–16 格，藤蔓区域移动消耗翻倍，进入或停留在其中的单位需通过力量豁免，失败被束缚。 */
export function castEntangle(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('纠缠术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('纠缠术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择纠缠术覆盖的格子。');
  if (unique.size > ENTANGLE_MAX_CELLS) throw new Error('纠缠术最多覆盖 16 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  requireVoice(next, casterId);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放纠缠术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '纠缠术' };
  const list = [...unique.values()];
  next.entangle = list;
  next.entangleBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放纠缠术：藤蔓覆盖 ${list.length} 格，移动消耗翻倍，进入需通过 DC ${ENTANGLE_DC} 力量豁免。`, deps);
  for (const actor of next.actors) {
    if ((actor.combat?.status ?? 'active') !== 'active' || actor.id === casterId) continue;
    entangleSnare(next, actor, deps);
  }
  return next;
}

const WEB_DC = 12;

/** 该格是否被蛛网覆盖。 */
export function webAt(battle: Battle, x: number, y: number): boolean {
  return (battle.webs ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 进入或停留在蛛网上的单位做 DC 12 敏捷豁免，失败被「束缚」；飞行单位不受影响。 */
function webStuck(battle: Battle, actor: Actor, deps: CombatDeps): boolean {
  const state = combatantOf(actor);
  if (state.flying === true) return false;
  const position = actor.position;
  if (!position || !webAt(battle, position.x, position.y)) return false;
  if (state.conditions.includes('束缚')) return false;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'dex', dc: WEB_DC, bonus: defaultSaveBonus(actor, 'dex') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 在蛛网上稳住身形（敏捷豁免 DC ${WEB_DC} 成功）。`, deps);
    return false;
  }
  state.conditions.push('束缚');
  addLog(battle, `${actorLabel(battle, actor)} 被蛛网缠住，束缚（移动速度归零，需用动作挣脱）。`, deps);
  return true;
}

/** 蛛网术：动作施放，指定若干格（最多 12 格）；这些格子移动消耗翻倍，进入或回合开始时需通过 DC 12 敏捷豁免，失败被束缚。 */
export function castWeb(battle: Battle, casterId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('蛛网术的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('蛛网术的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择蛛网覆盖的格子。');
  if (unique.size > 12) throw new Error('蛛网术最多覆盖 12 格。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  requireVoice(next, casterId);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放蛛网术。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  const list = [...unique.values()];
  const keys = new Set(list.map(cell => `${cell.x},${cell.y}`));
  next.webs = [...(next.webs ?? []).filter(cell => !keys.has(`${cell.x},${cell.y}`)), ...list];
  addLog(next, `${actorLabel(next, caster)} 施放蛛网术：蛛网覆盖 ${list.length} 格，移动消耗翻倍，进入需通过 DC ${WEB_DC} 敏捷豁免。`, deps);
  return next;
}

/** 挣脱蛛网：用动作对 DC 12 做力量豁免，成功移除「束缚」。 */
export function escapeWeb(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以挣脱蛛网。');
  const state = combatantOf(actor);
  if (!state.conditions.includes('束缚')) throw new Error('该单位没有被蛛网束缚。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const save = resolveSave(actor, { actorId, ability: 'str', dc: WEB_DC, bonus: defaultSaveBonus(actor, 'str') }, randomOf(deps));
  state.actionUsed = true;
  if (save.success) state.conditions = state.conditions.filter(condition => condition !== '束缚');
  addLog(next, save.success
    ? `${actorLabel(next, actor)} 挣脱了蛛网（d20 ${save.natural} → ${save.total} 对 DC ${WEB_DC}）。`
    : `${actorLabel(next, actor)} 没能挣脱蛛网（d20 ${save.natural} → ${save.total} 对 DC ${WEB_DC}）。`, deps);
  return { battle: next, outcome: save };
}

/** 用动作强行挣脱藤蔓：力量豁免 DC 13，成败都消耗动作。 */
export function escapeEntangle(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以挣脱藤蔓。');
  const state = combatantOf(actor);
  if (state.entangled !== true) throw new Error('该单位没有被藤蔓缠住。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const save = resolveSave(actor, { actorId, ability: 'str', dc: ENTANGLE_DC, bonus: defaultSaveBonus(actor, 'str') + auraBonus(next, actorId, 'saves') }, randomOf(deps));
  state.actionUsed = true;
  if (save.success) {
    delete state.entangled;
    state.conditions = state.conditions.filter(condition => condition !== '束缚');
  }
  addLog(next, save.success
    ? `${actorLabel(next, actor)} 用动作挣脱了藤蔓（力量 ${save.natural} → ${save.total} 对 DC ${ENTANGLE_DC}）。`
    : `${actorLabel(next, actor)} 没能挣脱藤蔓（力量 ${save.natural} → ${save.total} 对 DC ${ENTANGLE_DC}）。`, deps);
  return { battle: next, outcome: save };
}

/** 施法者可选的法术目标：同阵营、非自身、在场、默认 30 尺内。 */
export function spellTargets(battle: Battle, casterId: string, rangeFt = 30): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => {
    if (item.id === casterId || item.side !== caster.side || item.side === '中立') return false;
    if ((item.combat?.status ?? 'active') !== 'active') return false;
    if (actorDistance(battle, casterId, item.id) === undefined) return true;
    return (actorDistance(battle, casterId, item.id) ?? 0) <= rangeFt;
  });
}

const AID_BONUS = 5;
const AID_RANGE_FT = 30;
const AID_MAX_TARGETS = 3;

/** 援助术目标：同阵营（含自己）、未死亡、30 尺内的单位。 */
export function aidTargets(battle: Battle, casterId: string, rangeFt = AID_RANGE_FT): Actor[] {
  const caster = battle.actors.find(actor => actor.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => {
    if (item.side !== caster.side || item.side === '中立') return false;
    if ((item.combat?.status ?? 'active') !== 'active') return false;
    if (actorDistance(battle, casterId, item.id) === undefined) return true;
    return (actorDistance(battle, casterId, item.id) ?? 0) <= rangeFt;
  });
}

/** 援助术：动作，最多 3 个 30 尺内的友方各自获得 5 点额外生命上限与当前生命，持续到长休。 */
export function castAid(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  if ((caster.combat?.status ?? 'active') !== 'active') throw new Error('只有在场的单位可以施放援助术。');
  requireVoice(next, casterId);
  const unique = [...new Set(targetIds)].filter(id => id);
  if (!unique.length) throw new Error('请选择援助术的目标。');
  if (unique.length > AID_MAX_TARGETS) throw new Error(`援助术最多影响 ${AID_MAX_TARGETS} 名单位。`);
  for (const id of unique) {
    const target = actorOf(next, id);
    if ((target.combat?.status ?? 'active') !== 'active') throw new Error('只能援助还在场的单位。');
    if (target.combat?.aided) throw new Error('该单位已经受到援助术的影响。');
    const distance = actorDistance(next, casterId, id);
    if (distance !== undefined && distance > AID_RANGE_FT) throw new Error(`援助术的射程是 ${AID_RANGE_FT} 尺。`);
  }
  const state = combatantOf(next.actors.find(item => item.id === casterId)!);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  const names: string[] = [];
  for (const id of unique) {
    const target = next.actors.find(item => item.id === id)!;
    target.maxHp += AID_BONUS;
    target.currentHp += AID_BONUS;
    combatantOf(target).aided = AID_BONUS;
    names.push(actorLabel(next, target));
  }
  addLog(next, `${actorLabel(next, caster)} 施放援助术：${names.join('、')} 的生命上限提高 ${AID_BONUS} 点。`, deps);
  return next;
}

const BARKSKIN_AC = 17;
const BARKSKIN_ROUNDS = 10;
const BARKSKIN_RANGE_FT = 5;

/** 树肤术的目标：同阵营（含自己）、在场、5 尺内的单位。 */
export function barkskinTargets(battle: Battle, casterId: string): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => {
    if (item.side !== caster.side || item.side === '中立') return false;
    if ((item.combat?.status ?? 'active') !== 'active') return false;
    if (actorDistance(battle, casterId, item.id) === undefined) return true;
    return (actorDistance(battle, casterId, item.id) ?? 0) <= BARKSKIN_RANGE_FT;
  });
}

/** 树肤术：动作 + 专注，把目标 AC 抬到不低于 17，持续 10 轮。 */
export function castBarkskin(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  if ((caster.combat?.status ?? 'active') !== 'active') throw new Error('只有在场的单位可以施放树肤术。');
  requireVoice(next, casterId);
  if (!targetId) throw new Error('请选择树肤术的目标。');
  const target = actorOf(next, targetId);
  if ((target.combat?.status ?? 'active') !== 'active') throw new Error('只能对在场的单位施放树肤术。');
  if (target.combat?.barkskin) throw new Error('目标已经受到树肤术的影响。');
  const distance = actorDistance(next, casterId, targetId);
  if (distance !== undefined && distance > BARKSKIN_RANGE_FT) throw new Error(`树肤术只能影响 ${BARKSKIN_RANGE_FT} 尺内的单位。`);
  const state = combatantOf(caster);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const existing = state.concentration?.spell;
  if (existing && existing !== '树肤术') throw new Error('施法者已经在维持其他专注。');
  state.actionUsed = true;
  state.concentration = { spell: '树肤术' };
  const targetState = combatantOf(target);
  targetState.barkskin = BARKSKIN_ROUNDS;
  targetState.barkskinBy = casterId;
  addLog(next, `${actorLabel(next, caster)} 施放树肤术：${actorLabel(next, target)} 的 AC 变为不低于 ${BARKSKIN_AC}，持续 ${BARKSKIN_ROUNDS} 轮。`, deps);
  return next;
}

const MASS_HEAL_RANGE_FT = 60;
const MASS_HEAL_MAX_TARGETS = 6;

/** 治疗目标：同阵营（含自己）、未死亡、60 尺内的单位。 */
export function healTargets(battle: Battle, casterId: string, rangeFt = MASS_HEAL_RANGE_FT): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => {
    if (item.side !== caster.side || item.side === '中立') return false;
    if ((item.combat?.status ?? 'active') === 'dead') return false;
    if (actorDistance(battle, casterId, item.id) === undefined) return true;
    return (actorDistance(battle, casterId, item.id) ?? 0) <= rangeFt;
  });
}

export function spellcastingBonus(actor: Actor): number {
  const abilities = actor.template.abilities ?? actor.characterSnapshot?.sheet.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const mod = (score: number) => Math.floor((score - 10) / 2);
  return Math.max(0, mod(abilities.int), mod(abilities.wis), mod(abilities.cha));
}

/** 群体治疗术：附赠动作，60 尺内至多 6 个同阵营单位各恢复 1d4 + 施法属性加值。 */
export function castMassHealingWord(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): { battle: Battle; healed: { id: string; amount: number }[] } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放群体治疗术。');
  requireVoice(next, casterId);
  if (currentActorId(next) !== casterId) throw new Error('只有当前回合的单位可以施放群体治疗术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  if (!targetIds.length) throw new Error('请选择群体治疗术的目标。');
  const unique = [...new Set(targetIds)];
  if (unique.length > MASS_HEAL_MAX_TARGETS) throw new Error(`群体治疗术最多影响 ${MASS_HEAL_MAX_TARGETS} 名单位。`);
  const allowed = new Set(healTargets(next, casterId).map(item => item.id));
  const targets = unique.map(id => {
    const target = next.actors.find(item => item.id === id);
    if (!target) throw new Error('群体治疗术的目标不存在。');
    if (!allowed.has(id)) throw new Error('群体治疗术只能影响 60 尺内的同阵营单位。');
    return target;
  });
  const bonus = spellcastingBonus(caster);
  const random = randomOf(deps);
  state.bonusUsed = true;
  const healed: { id: string; amount: number }[] = [];
  for (const target of targets) {
    const targetState = combatantOf(target);
    const amount = rollDie(4, random) + bonus;
    const restored = Math.min(target.maxHp - target.currentHp, amount);
    target.currentHp += restored;
    const rose = targetState.status === 'down' && target.currentHp > 0;
    if (rose) {
      targetState.status = 'active';
      targetState.deathSaves = { successes: 0, failures: 0 };
      delete targetState.stable;
    }
    healed.push({ id: target.id, amount: restored });
    addLog(next, `${actorLabel(next, target)} 被群体治疗术治愈，恢复 ${restored} 点生命值（1d4+${bonus} 掷出 ${amount}）${rose ? '并重新站起' : ''}，当前 ${target.currentHp}/${target.maxHp}。`, deps);
  }
  return { battle: next, healed };
}

/** 加速术：动作施放，单体，10 轮内速度翻倍、AC +2、敏捷豁免优势，需维持专注。 */
export function castHaste(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放加速术。');
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  const target = actorOf(next, targetId);
  if (combatantOf(target).status !== 'active') throw new Error('目标必须处于在场状态。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '加速术' };
  const targetState = combatantOf(target);
  targetState.hasted = 10;
  targetState.hastedBy = casterId;
  addLog(next, `${actorLabel(next, target)} 受到加速术影响：速度翻倍、AC +2、敏捷豁免优势，持续 10 轮。`, deps);
  return next;
}

/** 隐形术：动作施放，单体，10 轮内攻击者对其攻击检定劣势、它自己的攻击检定优势。 */
export function castInvisible(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放隐形术。');
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  const target = actorOf(next, targetId);
  if (combatantOf(target).status !== 'active') throw new Error('目标必须处于在场状态。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '隐形术' };
  const targetState = combatantOf(target);
  targetState.invisible = 10;
  targetState.invisibleBy = casterId;
  addLog(next, `${actorLabel(next, target)} 隐形了：针对它的攻击检定劣势，持续 10 轮。`, deps);
  return next;
}

const CHARM_DC = 13;
const CHARM_RANGE_FT = 30;
/** 魅惑术：动作施放，30 尺内单体感知豁免 DC 13，失败者 10 轮内无法攻击施法者，每到自己回合可再豁免一次。 */
export function castCharmPerson(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放魅惑术。');
  const target = actorOf(next, targetId);
  if (target.id === casterId) throw new Error('魅惑术不能对自己施放。');
  if (combatantOf(target).status !== 'active') throw new Error('只能对在场的单位施放魅惑术。');
  if (target.side === caster.side) throw new Error('魅惑术只能影响敌对单位。');
  const distance = actorDistance(next, casterId, target.id);
  if (distance !== undefined && distance > CHARM_RANGE_FT) throw new Error('魅惑术只能影响 30 尺内的单位。');
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '魅惑术' };
  const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: CHARM_DC }, randomOf(deps));
  if (save.success) {
    addLog(next, `${actorLabel(next, target)} 抵抗了魅惑术（感知 ${save.natural} → ${save.total}，DC ${CHARM_DC}）。`, deps);
    return next;
  }
  const targetState = combatantOf(target);
  targetState.charmed = 10;
  targetState.charmedBy = casterId;
  if (!targetState.conditions.includes('魅惑')) targetState.conditions.push('魅惑');
  addLog(next, `${actorLabel(next, target)} 被魅惑：无法攻击 ${actorLabel(next, caster)}，持续 10 轮。`, deps);
  return next;
}

/** 魅惑术的每轮解除：受影响单位在自己回合开始时做感知豁免，成功即摆脱。 */
function charmRecover(battle: Battle, actor: Actor, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state || state.charmed === undefined || state.charmed <= 0) return;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'wis', dc: CHARM_DC }, randomOf(deps));
  if (!save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 仍被魅惑束缚（感知 ${save.natural} → ${save.total}，DC ${CHARM_DC}）。`, deps);
    return;
  }
  delete state.charmed;
  delete state.charmedBy;
  state.conditions = state.conditions.filter(condition => condition !== '魅惑');
  addLog(battle, `${actorLabel(battle, actor)} 摆脱了魅惑术（感知 ${save.natural} → ${save.total}，DC ${CHARM_DC}）。`, deps);
}

const SLOW_DC = 13;
const SLOW_RANGE_FT = 40;
const SLOW_MAX_TARGETS = 6;
/** 缓慢术：动作施放，40 尺内最多 6 个敌对单位各做一次感知豁免，失败者 10 轮内速度减半、AC -2、无法使用反应。 */
export function castSlow(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放缓慢术。');
  const wanted = [...new Set(targetIds)];
  if (!wanted.length) throw new Error('请选择缓慢术的目标。');
  if (wanted.length > SLOW_MAX_TARGETS) throw new Error('缓慢术最多影响 6 名单位。');
  const targets = wanted.map(id => actorOf(next, id));
  for (const target of targets) {
    if (target.id === casterId) throw new Error('缓慢术不能对自己施放。');
    if (combatantOf(target).status !== 'active') throw new Error('只能对在场的单位施放缓慢术。');
    if (target.side === caster.side) throw new Error('缓慢术只能影响敌对单位。');
    const distance = actorDistance(next, casterId, target.id);
    if (distance !== undefined && distance > SLOW_RANGE_FT) throw new Error('缓慢术只能影响 40 尺内的单位。');
  }
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '缓慢术' };
  const affected: string[] = [];
  for (const target of targets) {
    const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: SLOW_DC }, randomOf(deps));
    if (save.success) {
      addLog(next, `${actorLabel(next, target)} 抵抗了缓慢术（感知 ${save.natural} → ${save.total}，DC ${SLOW_DC}）。`, deps);
      continue;
    }
    const targetState = combatantOf(target);
    targetState.slowed = 10;
    targetState.slowedBy = casterId;
    affected.push(actorLabel(next, target));
  }
  addLog(next, affected.length
    ? `${affected.join('、')} 被缓慢术影响：速度减半、AC -2、无法使用反应，持续 10 轮。`
    : '缓慢术没有影响到任何单位。', deps);
  return next;
}

/** 突袭：把指定单位标记为措手不及，它们的第一回合直接跳过。 */
export function markSurprised(battle: Battle, actorIds: string[], deps: CombatDeps = {}): Battle {
  requireCombat(battle);
  const unique = [...new Set(actorIds)];
  if (!unique.length) throw new Error('请选择要标记为措手不及的单位。');
  const next = recordUndo(structuredClone(battle));
  const marked: string[] = [];
  for (const id of unique) {
    const actor = actorOf(next, id);
    if (actor.combat?.status !== 'active') throw new Error('只有在场的单位可以被标记为突袭。');
    const state = combatantOf(actor);
    if (state.surprised === true) continue;
    state.surprised = true;
    marked.push(actorLabel(next, actor));
  }
  if (!marked.length) throw new Error('这些单位已经处于突袭状态。');
  addLog(next, `${marked.join('、')} 遭到突袭：第一回合措手不及，无法行动。`, deps);
  return next;
}

const SUPPRESS_DC = 15;
const SUPPRESS_RANGE_FT = 60;

const FEAR_DC = 13;
const FEAR_RANGE_FT = 30;
const FEAR_MAX_TARGETS = 3;
/** 掩护射击：用一轮火力压制 60 尺内的敌人，压制期间对方攻击检定劣势。 */
export function suppressingFire(battle: Battle, actorId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; outcome: CheckOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const target = actorOf(next, targetId);
  if (actorId === targetId) throw new Error('不能压制自己。');
  if (combatantOf(actor).status !== 'active') throw new Error('只有处于战斗中的单位可以进行掩护射击。');
  if (target.side === actor.side || target.side === '中立') throw new Error('只能压制敌对单位。');
  if (combatantOf(target).status !== 'active') throw new Error('目标已经无法行动。');
  if (currentActorId(next) !== actor.id) throw new Error('只有当前回合的单位可以行动。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  const state = combatantOf(actor);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const distance = actorDistance(next, actorId, targetId);
  if (distance !== undefined && distance > SUPPRESS_RANGE_FT) throw new Error(`掩护射击的射程是 ${SUPPRESS_RANGE_FT} 尺。`);
  const rolled = abilityCheck(next, { actorId, ability: 'dex', dc: SUPPRESS_DC }, deps);
  const result = rolled.battle;
  const check = rolled.outcome;
  const attacker = actorOf(result, actorId);
  const victim = actorOf(result, targetId);
  combatantOf(attacker).actionUsed = true;
  if (check.success) {
    combatantOf(victim).suppressed = true;
    addLog(result, `${actorLabel(result, attacker)} 为 ${actorLabel(result, victim)} 提供掩护射击（敏捷 ${check.total} ≥ DC ${SUPPRESS_DC}）：对方攻击检定劣势，直到它的下回合开始。`, deps);
  } else {
    addLog(result, `${actorLabel(result, attacker)} 的掩护射击没有奏效（敏捷 ${check.total} < DC ${SUPPRESS_DC}）。`, deps);
  }
  return { battle: result, outcome: check };
}

/** 恐惧术：动作施放，30 尺内最多 3 个敌对单位各做一次感知豁免，失败者 10 轮内无法靠近施法者且对其攻击劣势。 */
export function castFear(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放恐惧术。');
  const wanted = [...new Set(targetIds)];
  if (!wanted.length) throw new Error('请选择恐惧术的目标。');
  if (wanted.length > FEAR_MAX_TARGETS) throw new Error('恐惧术最多影响 3 名单位。');
  const targets = wanted.map(id => actorOf(next, id));
  for (const target of targets) {
    if (target.id === casterId) throw new Error('恐惧术不能对自己施放。');
    if (combatantOf(target).status !== 'active') throw new Error('只能对在场的单位施放恐惧术。');
    if (target.side === caster.side) throw new Error('恐惧术只能影响敌对单位。');
    const distance = actorDistance(next, casterId, target.id);
    if (distance !== undefined && distance > FEAR_RANGE_FT) throw new Error('恐惧术只能影响 30 尺内的单位。');
  }
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '恐惧术' };
  const affected: string[] = [];
  for (const target of targets) {
    const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: FEAR_DC }, randomOf(deps));
    if (save.success) {
      addLog(next, `${actorLabel(next, target)} 抵抗了恐惧术（感知 ${save.natural} → ${save.total}，DC ${FEAR_DC}）。`, deps);
      continue;
    }
    const targetState = combatantOf(target);
    targetState.frightened = 10;
    targetState.frightenedBy = casterId;
    if (!targetState.conditions.includes('恐慌')) targetState.conditions.push('恐慌');
    affected.push(actorLabel(next, target));
  }
  addLog(next, affected.length
    ? `${affected.join('、')} 陷入恐慌：无法靠近 ${actorLabel(next, caster)}，对其攻击劣势，持续 10 轮。`
    : '恐惧术没有影响到任何单位。', deps);
  return next;
}

/** 恐惧术的每轮解除：受影响单位在自己回合开始时做感知豁免，成功即摆脱。 */
function fearRecover(battle: Battle, actor: Actor, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state || state.frightened === undefined || state.frightened <= 0) return;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'wis', dc: FEAR_DC }, randomOf(deps));
  if (!save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 仍处于恐慌（感知 ${save.natural} → ${save.total}，DC ${FEAR_DC}）。`, deps);
    return;
  }
  delete state.frightened;
  delete state.frightenedBy;
  state.conditions = state.conditions.filter(condition => condition !== '恐慌');
  addLog(battle, `${actorLabel(battle, actor)} 克服了恐惧术（感知 ${save.natural} → ${save.total}，DC ${FEAR_DC}）。`, deps);
}

const DISPEL_DC = 13;
const DISPEL_RANGE_FT = 120;

/** 驱散魔法用的施法属性加值：取智力、感知、魅力中最高者。 */
function dispelBonus(actor: Actor): number {
  const abilities = actor.characterSnapshot?.sheet.abilities ?? actor.template.abilities ?? { int: 10, wis: 10, cha: 10 };
  const mod = (score: number) => Math.floor((score - 10) / 2);
  return Math.max(mod(abilities.int ?? 10), mod(abilities.wis ?? 10), mod(abilities.cha ?? 10));
}

/**
 * 驱散魔法：消耗动作，对 120 尺内一个单位做一次施法属性检定（DC 13）。
 * 成功时解除该单位身上由法术带来的增益与减益（祝福术、加速术、隐形术、缓慢术、恐惧术、魅惑术、定身术）。
 */
export function castDispelMagic(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): {
  battle: Battle;
  outcome: { success: boolean; natural: number; total: number; dc: number; dispelled: string[] };
} {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放驱散魔法。');
  requireVoice(next, casterId);
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== casterId) throw new Error('只有当前回合的单位可以施放驱散魔法。');
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const target = actorOf(next, targetId);
  if (target.combat?.status === 'dead') throw new Error('无法以已经死亡的单位为目标。');
  const distance = actorDistance(next, casterId, targetId);
  if (distance !== undefined && distance > DISPEL_RANGE_FT) throw new Error(`驱散魔法只能影响 ${DISPEL_RANGE_FT} 尺内的单位。`);

  const targetState = combatantOf(target);
  const dispelled: string[] = [];
  const strip = (field: 'blessed' | 'hasted' | 'invisible' | 'slowed' | 'charmed' | 'frightened' | 'paralyzed', byField: 'blessedBy' | 'hastedBy' | 'invisibleBy' | 'slowedBy' | 'charmedBy' | 'frightenedBy' | 'paralyzedBy', name: string, condition?: string) => {
    if (targetState[field] === undefined && targetState[byField] === undefined) return;
    delete targetState[field];
    delete targetState[byField];
    if (condition) targetState.conditions = targetState.conditions.filter(item => item !== condition);
    dispelled.push(name);
  };

  const random = randomOf(deps);
  const natural = rollDie(20, random);
  const bonus = dispelBonus(caster);
  const total = natural + bonus;

  casterState.actionUsed = true;
  if (total < DISPEL_DC) {
    addLog(next, `${actorLabel(next, caster)} 对 ${actorLabel(next, target)} 施放驱散魔法：施法属性检定 ${natural}+${bonus}=${total} vs DC ${DISPEL_DC}，未能驱散任何效果。`, deps);
    return { battle: next, outcome: { success: false, natural, total, dc: DISPEL_DC, dispelled } };
  }
  strip('blessed', 'blessedBy', '祝福术');
  strip('hasted', 'hastedBy', '加速术');
  strip('invisible', 'invisibleBy', '隐形术');
  strip('slowed', 'slowedBy', '缓慢术');
  strip('frightened', 'frightenedBy', '恐惧术', '恐慌');
  strip('charmed', 'charmedBy', '魅惑术', '魅惑');
  strip('paralyzed', 'paralyzedBy', '定身术', '麻痹');
  const detail = dispelled.length > 0 ? `驱散了${dispelled.join('、')}` : '目标身上没有可驱散的法术效果';
  addLog(next, `${actorLabel(next, caster)} 对 ${actorLabel(next, target)} 施放驱散魔法：施法属性检定 ${natural}+${bonus}=${total} vs DC ${DISPEL_DC}，${detail}。`, deps);
  return { battle: next, outcome: { success: true, natural, total, dc: DISPEL_DC, dispelled } };
}

const POLYMORPH_DC = 13;
const POLYMORPH_RANGE_FT = 60;

/** 变形术：动作施放、需维持专注，60 尺内一个单位做感知豁免，失败变成小兽（失能、AC 10、速度 25 尺），持续 10 轮。 */
export function castPolymorph(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放变形术。');
  if (targetId === casterId) throw new Error('无法对自己施放变形术。');
  const target = actorOf(next, targetId);
  const targetState = combatantOf(target);
  if (targetState.status === 'dead') throw new Error('无法以已经死亡的单位为目标。');
  if (targetState.polymorphed) throw new Error('目标已经处于变形术的影响下。');
  const distance = actorDistance(next, casterId, targetId);
  if (distance !== undefined && distance > POLYMORPH_RANGE_FT) throw new Error(`变形术只能影响 ${POLYMORPH_RANGE_FT} 尺内的单位。`);
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration) throw new Error('施法者已经在维持其他专注。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '变形术' };
  const save = resolveSave(target, { actorId: target.id, ability: 'wis', dc: POLYMORPH_DC, bonus: defaultSaveBonus(target, 'wis') + auraBonus(next, target.id, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(next, `${actorLabel(next, caster)} 对 ${actorLabel(next, target)} 施放变形术：感知豁免 ${save.natural} → ${save.total}，DC ${POLYMORPH_DC}，抵抗了变形。`, deps);
    return { battle: next, outcome: save };
  }
  targetState.polymorphed = 10;
  targetState.polymorphedBy = casterId;
  if (!targetState.conditions.includes('失能')) targetState.conditions.push('失能');
  addLog(next, `${actorLabel(next, caster)} 对 ${actorLabel(next, target)} 施放变形术：感知豁免 ${save.natural} → ${save.total}，DC ${POLYMORPH_DC}，目标变成小兽——失能、AC 10、速度 25 尺，持续 10 轮。`, deps);
  return { battle: next, outcome: save };
}

/** 设置天气：传 null 表示放晴。暴雨让远程攻击劣势且火焰伤害减半；强风让远程攻击劣势，并会吹落飞行单位。 */
export function setWeather(battle: Battle, weather: Weather | null, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  if (weather === null) {
    if (!next.weather) throw new Error('当前没有特殊天气。');
    delete next.weather;
    addLog(next, '天气放晴了。', deps);
    return next;
  }
  if (weather !== 'rain' && weather !== 'wind') throw new Error('请选择有效的天气。');
  next.weather = weather;
  addLog(next, weather === 'rain'
    ? '天气转为暴雨：远程攻击检定劣势，火焰伤害减半。'
    : '天气转为强风：远程攻击检定劣势，飞行单位每回合开始时需通过 DC 10 力量豁免，否则被吹落。', deps);
  return next;
}

/** 强风：飞行单位回合开始时做 DC 10 力量豁免，失败则失去飞行并按坠落结算。 */
function windGust(battle: Battle, actor: Actor, deps: CombatDeps): Battle {
  if (battle.weather !== 'wind') return battle;
  const state = actor.combat;
  if (!state || state.flying !== true || state.status !== 'active') return battle;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'str', dc: 10, bonus: defaultSaveBonus(actor, 'str') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 在强风中稳住身形（力量 ${save.natural} → ${save.total}，DC 10）。`, deps);
    return battle;
  }
  const feet = actor.elevation ?? 0;
  delete state.flying;
  if (feet < 10) {
    delete actor.elevation;
    addLog(battle, `${actorLabel(battle, actor)} 被强风压回地面，失去了飞行。`, deps);
    return battle;
  }
  const fall = applyFallDamage(battle, actor.id, feet, deps);
  const fallen = fall.battle.actors.find(item => item.id === actor.id);
  if (fallen) {
    delete fallen.elevation;
    if (fallen.combat) fallen.combat.flying = false;
    addLog(fall.battle, `${actorLabel(fall.battle, fallen)} 在强风中被吹落，从 ${feet} 尺坠落（${fall.expression ?? '0'}）。`, deps);
  }
  return fall.battle;
}

const POISON_DC = 13;

/**
 * 施加毒素：目标做一次体质豁免 DC 13，失败则陷入「中毒」（攻击检定劣势，持续 rounds 轮，默认 10 轮）。
 * 由怪物毒液或陷阱调用，不消耗动作。
 */
export function applyPoison(battle: Battle, actorId: string, deps: CombatDeps = {}, rounds = 10): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('无法对已经死亡的单位施加毒素。');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100) throw new Error('中毒轮数须为 1 至 100 的整数。');
  const save = resolveSave(actor, { actorId, ability: 'con', dc: POISON_DC, bonus: defaultSaveBonus(actor, 'con') + auraBonus(next, actorId, 'saves') }, randomOf(deps));
  if (save.success) {
    addLog(next, `${actorLabel(next, actor)} 抵抗了毒素（体质 ${save.natural} → ${save.total}，DC ${POISON_DC}）。`, deps);
    return { battle: next, outcome: save };
  }
  if (!state.conditions.includes('中毒')) state.conditions.push('中毒');
  state.poisoned = rounds;
  addLog(next, `${actorLabel(next, actor)} 中毒了：攻击检定劣势，持续 ${rounds} 轮（体质 ${save.natural} → ${save.total}，DC ${POISON_DC}）。`, deps);
  return { battle: next, outcome: save };
}

/** 使用解毒剂：消耗动作与背包里的一瓶解毒剂，立刻解除中毒。 */
export function drinkAntitoxin(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('已经死亡的单位无法使用解毒剂。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用解毒剂。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (!state.conditions.includes('中毒')) throw new Error('该单位没有中毒。');
  const items = state.items ?? [];
  const index = items.findIndex(item => item.name === '解毒剂' && item.quantity > 0);
  if (index < 0) throw new Error('背包里没有解毒剂。');
  const picked = items[index];
  if (picked.quantity > 1) picked.quantity -= 1;
  else items.splice(index, 1);
  state.conditions = state.conditions.filter(condition => condition !== '中毒');
  delete state.poisoned;
  state.actionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 喝下解毒剂，解除了中毒。`, deps);
  return next;
}

const BLIND_DC = 13;
const BLIND_RANGE_FT = 30;

/** 致盲术的候选目标：30 尺内的敌对单位。 */
export function blindTargets(battle: Battle, casterId: string, rangeFt = BLIND_RANGE_FT): Actor[] {
  const caster = battle.actors.find(item => item.id === casterId);
  if (!caster) return [];
  return battle.actors.filter(item => item.side !== caster.side && item.side !== '中立'
    && item.id !== casterId && item.combat?.status === 'active'
    && (actorDistance(battle, casterId, item.id) ?? 0) <= rangeFt);
}

/** 目标回合开始时重复体质豁免，成功即恢复视力。 */
function blindRecover(battle: Battle, actor: Actor, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state || state.blinded === undefined || state.blinded <= 0) return;
  const save = resolveSave(actor, { actorId: actor.id, ability: 'con', dc: BLIND_DC }, randomOf(deps));
  if (!save.success) {
    addLog(battle, `${actorLabel(battle, actor)} 仍然看不见（体质 ${save.natural} → ${save.total}，DC ${BLIND_DC}）。`, deps);
    return;
  }
  delete state.blinded;
  delete state.blindedBy;
  state.conditions = state.conditions.filter(condition => condition !== '目盲');
  addLog(battle, `${actorLabel(battle, actor)} 恢复了视力（体质 ${save.natural} → ${save.total}，DC ${BLIND_DC}）。`, deps);
}

/** 致盲术：动作 + 专注，30 尺内单体体质豁免，失败目盲 10 轮。 */
export function castBlindness(battle: Battle, casterId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const casterState = combatantOf(caster);
  if (casterState.status !== 'active') throw new Error('只有在场的单位可以施放致盲术。');
  const target = actorOf(next, targetId);
  if (target.id === casterId) throw new Error('致盲术不能对自己施放。');
  if (target.side === caster.side) throw new Error('致盲术只能影响敌对单位。');
  const targetState = combatantOf(target);
  if (targetState.status !== 'active') throw new Error('只能对在场的单位施放致盲术。');
  const distance = actorDistance(next, casterId, target.id);
  if (distance !== undefined && distance > BLIND_RANGE_FT) throw new Error(`致盲术的射程是 ${BLIND_RANGE_FT} 尺。`);
  const blocked = actionBlocker(caster);
  if (blocked) throw new Error(blocked);
  if (casterState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (casterState.concentration && casterState.concentration.spell !== '致盲术') throw new Error('施法者已经在维持其他专注。');
  casterState.actionUsed = true;
  casterState.concentration = { spell: '致盲术' };
  const save = resolveSave(target, { actorId: target.id, ability: 'con', dc: BLIND_DC }, randomOf(deps));
  if (!save.success) {
    targetState.blinded = 10;
    targetState.blindedBy = casterId;
    if (!targetState.conditions.includes('目盲')) targetState.conditions.push('目盲');
    addLog(next, `${actorLabel(next, target)} 被致盲（体质 ${save.natural} → ${save.total}，DC ${BLIND_DC}），持续 10 轮。`, deps);
  } else {
    addLog(next, `${actorLabel(next, target)} 抵抗了致盲术（体质 ${save.natural} → ${save.total}，DC ${BLIND_DC}）。`, deps);
  }
  return { battle: next, outcome: save };
}

/** 施法者失去专注（或改用别的专注法术）时，立即结束其施加的祝福。 */
function clearFocusBuffs(battle: Battle, casterId: string, reason: string, deps: CombatDeps = {}): void {
  for (const [field, byField, name] of [['blessed', 'blessedBy', '祝福术'], ['hasted', 'hastedBy', '加速术'], ['invisible', 'invisibleBy', '隐形术'], ['slowed', 'slowedBy', '缓慢术'], ['frightened', 'frightenedBy', '恐惧术'], ['barkskin', 'barkskinBy', '树肤术']] as const) {
    const affected = battle.actors.filter(item => item.combat?.[byField] === casterId);
    if (!affected.length) continue;
    for (const item of affected) {
      delete item.combat![field];
      delete item.combat![byField];
    }
    addLog(battle, `${reason}，${affected.map(item => actorLabel(battle, item)).join('、')} 的${name}结束了。`, deps);
  }
  if (battle.fog && battle.fogBy === casterId) {
    delete battle.fog;
    delete battle.fogBy;
    addLog(battle, `${reason}，迷雾消散了。`, deps);
  }
  if (battle.darkness && battle.darknessBy === casterId) {
    delete battle.darkness;
    delete battle.darknessBy;
    addLog(battle, `${reason}，魔法黑暗消散了。`, deps);
  }
  if (battle.sleepCloud && battle.sleepCloudBy === casterId) {
    delete battle.sleepCloud;
    delete battle.sleepCloudBy;
    addLog(battle, `${reason}，睡眠粉尘消散了。`, deps);
  }
  if (battle.entangle && battle.entangleBy === casterId) {
    delete battle.entangle;
    delete battle.entangleBy;
    const trapped = battle.actors.filter(item => item.combat?.entangled === true);
    for (const item of trapped) {
      delete item.combat!.entangled;
      item.combat!.conditions = item.combat!.conditions.filter(condition => condition !== '束缚');
    }
    addLog(battle, `${reason}，藤蔓枯萎了${trapped.length ? `，${trapped.map(item => actorLabel(battle, item)).join('、')} 摆脱了纠缠` : ''}。`, deps);
  }
  const charmedOnes = battle.actors.filter(item => item.combat?.charmedBy === casterId);
  if (charmedOnes.length) {
    for (const item of charmedOnes) {
      delete item.combat!.charmed;
      delete item.combat!.charmedBy;
      item.combat!.conditions = item.combat!.conditions.filter(condition => condition !== '魅惑');
    }
    addLog(battle, `${reason}，${charmedOnes.map(item => actorLabel(battle, item)).join('、')} 的魅惑术结束了。`, deps);
  }
  const held = battle.actors.filter(item => item.combat?.paralyzedBy === casterId);
  if (held.length) {
    for (const item of held) {
      delete item.combat!.paralyzed;
      delete item.combat!.paralyzedBy;
      item.combat!.conditions = item.combat!.conditions.filter(condition => condition !== '麻痹');
    }
    addLog(battle, `${reason}，${held.map(item => actorLabel(battle, item)).join('、')} 的定身术结束了。`, deps);
  }
  const blindedOnes = battle.actors.filter(item => item.combat?.blindedBy === casterId);
  if (blindedOnes.length) {
    for (const item of blindedOnes) {
      delete item.combat!.blinded;
      delete item.combat!.blindedBy;
      item.combat!.conditions = item.combat!.conditions.filter(condition => condition !== '目盲');
    }
    addLog(battle, `${reason}，${blindedOnes.map(item => actorLabel(battle, item)).join('、')} 的致盲术结束了。`, deps);
  }
  const shaped = battle.actors.filter(item => item.combat?.polymorphedBy === casterId);
  if (shaped.length) {
    for (const item of shaped) {
      delete item.combat!.polymorphed;
      delete item.combat!.polymorphedBy;
      item.combat!.conditions = item.combat!.conditions.filter(condition => condition !== '失能');
    }
    addLog(battle, `${reason}，${shaped.map(item => actorLabel(battle, item)).join('、')} 的变形术结束了。`, deps);
  }
  if (battle.silence && battle.silenceBy === casterId) {
    delete battle.silence;
    delete battle.silenceBy;
    addLog(battle, `${reason}，沉默区域恢复了声音。`, deps);
  }
}

/** 祝福术：动作施放，最多 3 名友方在 10 轮内攻击检定与豁免 +1d4，施法者需维持专注。 */
export function castBless(battle: Battle, casterId: string, targetIds: string[], deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const caster = actorOf(next, casterId);
  requireVoice(next, casterId);
  const state = combatantOf(caster);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放祝福术。');
  const blocker = actionBlocker(caster);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (state.concentration) throw new Error('施法者已经在维持其他专注。');
  const ids = [...new Set(targetIds)];
  if (!ids.length) throw new Error('请选择祝福的目标。');
  if (ids.length > 3) throw new Error('祝福术最多影响 3 名单位。');
  for (const id of ids) {
    if (combatantOf(actorOf(next, id)).status !== 'active') throw new Error('只能祝福在场的单位。');
  }
  state.actionUsed = true;
  state.concentration = { spell: '祝福术' };
  for (const id of ids) {
    const targetState = combatantOf(actorOf(next, id));
    targetState.blessed = 10;
    targetState.blessedBy = casterId;
  }
  addLog(next, `${actorLabel(next, caster)} 施放祝福术：${ids.map(id => actorLabel(next, actorOf(next, id))).join('、')} 的攻击检定与豁免 +1d4，持续 10 轮。`, deps);
  return next;
}

/** 护盾术：反应触发，自己的 AC +5 直到下个回合开始。 */
export function castShieldReaction(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  requireVoice(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以施放护盾术。');
  requireReactionAllowed(actor);
  if (state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  state.reactionUsed = true;
  state.shield = 5;
  addLog(next, `${actorLabel(next, actor)} 施放护盾术，AC +5 直到自己下个回合开始。`, deps);
  return next;
}

/** 切换「双持战斗者」专长：AC +1，且副手攻击不再要求轻型武器。 */
export function setDualWielder(battle: Battle, actorId: string, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (enabled) state.dualWielder = true;
  else delete state.dualWielder;
  addLog(next, enabled ? `${actorLabel(next, actor)} 使用双持战斗者：AC +1，副手可用非轻型武器。` : `${actorLabel(next, actor)} 不再享受双持战斗者的加值。`, deps);
  return next;
}

/** 设置某单位的力竭等级（0 表示没有力竭）。 */
export function setExhaustion(battle: Battle, actorId: string, level: number, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (!Number.isInteger(level) || level < 0 || level > 6) throw new Error('力竭等级须为 0 至 6 的整数。');
  if (level === 0) delete state.exhaustion;
  else state.exhaustion = level;
  addLog(next, level === 0 ? `${actorLabel(next, actor)} 的力竭解除。` : `${actorLabel(next, actor)} 的力竭等级为 ${level}：攻击、豁免与属性检定 -${2 * level}，速度 -${5 * level} 尺。`, deps);
  return next;
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

/** 长武器借机：敌对单位「进入」持长武器者的触及范围时也可以借机攻击。 */
function enteringReachPrompts(battle: Battle, mover: Actor, from: Position, to: Position): OpportunityPrompt[] {
  const grid = battle.grid;
  if (!grid || !battle.enterReachOpportunity || mover.side === '中立' || mover.combat?.disengaged) return [];
  return battle.actors
    .filter(other => other.id !== mover.id && other.side !== '中立' && other.side !== mover.side && other.position && other.combat?.status === 'active')
    .filter(other => attackSources(other).some(item => item.range === 'melee' && item.properties?.includes('长武器')))
    .filter(other => {
      const reach = actorReach(other);
      const before = cellDistance(other.position!, from) * grid.cellFt;
      const after = cellDistance(other.position!, to) * grid.cellFt;
      return before > reach && after <= reach;
    })
    .map(other => ({ reactorId: other.id, targetId: mover.id }));
}
/** 准备好的「攻击」动作：敌对单位进入触及范围时自动排入待结算提示。 */
function readyPrompts(battle: Battle, mover: Actor, from: Position, to: Position): OpportunityPrompt[] {
  const grid = battle.grid;
  if (!grid || mover.side === '中立' || mover.combat?.disengaged) return [];
  return battle.actors
    .filter(other => other.id !== mover.id && other.side !== '中立' && other.side !== mover.side && other.position && other.combat?.status === 'active')
    .filter(other => other.combat?.ready && other.combat.reactionUsed !== true)
    .filter(other => /攻击/.test(other.combat?.ready?.action ?? ''))
    .filter(other => {
      const reach = actorReach(other);
      const before = cellDistance(other.position!, from) * grid.cellFt;
      const after = cellDistance(other.position!, to) * grid.cellFt;
      return before > reach && after <= reach;
    })
    .map(other => ({ reactorId: other.id, targetId: mover.id, kind: 'ready' as const }));
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
/** 远程连线中间是否站着其他在场单位：提供半掩体（AC +2）。 */
export function creatureCover(battle: Battle, attackerId: string, targetId: string): Actor | null {
  const attacker = battle.actors.find(item => item.id === attackerId);
  const target = battle.actors.find(item => item.id === targetId);
  if (!attacker?.position || !target?.position) return null;
  const cells = lineCells(attacker.position, target.position);
  if (!cells.length) return null;
  return battle.actors.find(item => item.id !== attackerId
    && item.id !== targetId
    && (item.combat?.status ?? 'active') === 'active'
    && !!item.position
    && cells.some(cell => cell.x === item.position!.x && cell.y === item.position!.y)) ?? null;
}

/** 两格之间是否没有被墙体阻挡的直线视线。 */
export function hasLineOfSight(battle: Battle, from: Position, to: Position): boolean {
  if (!battle.grid) return true;
  return !lineCells(from, to).some(cell => isWallCell(battle, cell.x, cell.y));
}
/** 战场上由工事形成的掩体格。 */
export function coverAt(battle: Battle, x: number, y: number): boolean {
  return (battle.cover ?? []).some(cell => cell.x === x && cell.y === y);
}

/** 架设掩体：动作，在方格战场放置最多 4 格工事，占据其中可获得半掩体。 */
export function buildCover(battle: Battle, actorId: string, cells: Position[], deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const unique = new Map<string, Position>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error('掩体的格子坐标须为整数。');
    if (cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height) throw new Error('掩体的格子超出战场范围。');
    unique.set(`${cell.x},${cell.y}`, { x: cell.x, y: cell.y });
  }
  if (!unique.size) throw new Error('请选择要架设掩体的格子。');
  if (unique.size > 4) throw new Error('一次最多架设 4 格掩体。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以架设掩体。');
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以架设掩体。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  const list = [...unique.values()];
  const keys = new Set(list.map(cell => `${cell.x},${cell.y}`));
  next.cover = [...(next.cover ?? []).filter(cell => !keys.has(`${cell.x},${cell.y}`)), ...list];
  addLog(next, `${actorLabel(next, actor)} 架设掩体：${list.length} 格（占据其中可获得半掩体）。`, deps);
  return next;
}
/** 由墙体与射击线上相邻的遮挡推算掩体等级：贴着一道墙为半掩体，被两处以上夹住为四分之三掩体。 */
export function coverFromWalls(battle: Battle, from: Position, to: Position): CoverType {
  if (!battle.grid) return '无';
  const walls = battle.walls ?? [];
  const sheltered = coverAt(battle, to.x, to.y);
  if (!walls.length) return sheltered ? '半掩体' : '无';
  const path = lineCells(from, to);
  const neighbours: Position[] = [...path, from, to];
  const touching = walls.filter(wall => neighbours.some(cell => Math.max(Math.abs(cell.x - wall.x), Math.abs(cell.y - wall.y)) <= 1));
  if (touching.length >= 3) return '全掩体';
  if (touching.length === 2) return '四分之三掩体';
  if (touching.length === 1) return '半掩体';
  if (coverAt(battle, to.x, to.y)) return '半掩体';
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

/** 危险地形：进入该格时立即受到伤害。 */
export type HazardInput = { x: number; y: number; damageExpression: string; damageType: DamageType };

export function hazardAt(battle: Battle, x: number, y: number): Hazard | undefined {
  return (battle.hazards ?? []).find(cell => cell.x === x && cell.y === y);
}

export function hazardsOf(battle: Battle): Hazard[] {
  return battle.hazards ?? [];
}

/** 标记或覆盖一格的危险地形。 */
export function addHazard(battle: Battle, input: HazardInput, deps: CombatDeps = {}): Battle {
  const grid = battle.grid;
  if (!grid) throw new Error('请先启用方格战场。');
  if (!Number.isInteger(input.x) || !Number.isInteger(input.y)) throw new Error('格子坐标须为整数。');
  if (input.x < 0 || input.y < 0 || input.x >= grid.width || input.y >= grid.height) throw new Error('目标格子超出战场范围。');
  const expression = (input.damageExpression ?? '').trim();
  if (!expression) throw new Error('请填写危险地形的伤害骰。');
  parseDice(expression);
  if (!(damageTypes as readonly DamageType[]).includes(input.damageType)) throw new Error('危险地形的伤害类型无效。');
  const next = recordUndo(structuredClone(battle));
  const list = [...(next.hazards ?? [])];
  const index = list.findIndex(cell => cell.x === input.x && cell.y === input.y);
  const hazard: Hazard = { x: input.x, y: input.y, damageExpression: expression, damageType: input.damageType };
  if (index >= 0) list[index] = hazard;
  else list.push(hazard);
  next.hazards = list.slice(-200);
  addLog(next, `(${input.x}, ${input.y}) 设为危险地形（${expression} ${input.damageType}）。`, deps);
  return next;
}

/** 清除一格的危险地形。 */
export function removeHazard(battle: Battle, x: number, y: number, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const before = next.hazards ?? [];
  const list = before.filter(cell => !(cell.x === x && cell.y === y));
  if (list.length === before.length) throw new Error('该格没有危险地形。');
  if (list.length) next.hazards = list;
  else delete next.hazards;
  addLog(next, `(${x}, ${y}) 的危险地形已清除。`, deps);
  return next;
}

function applyHazardAt(battle: Battle, actor: Actor, x: number, y: number, deps: CombatDeps, phase: '踏入' | '回合开始' = '踏入'): void {
  const hazard = hazardAt(battle, x, y);
  if (!hazard) return;
  if (combatantOf(actor).status === 'dead') return;
  const rolled = rollDamage(hazard.damageExpression, deps.random ?? Math.random, false);
  const result = applyDamageToActor(actor, rolled.total, hazard.damageType, battle);
  addLog(battle, phase === '回合开始'
    ? `${actorLabel(battle, actor)} 在危险地形 (${x}, ${y}) 中开始回合，受到 ${result.damage} 点${hazard.damageType}伤害。`
    : `${actorLabel(battle, actor)} 踏入危险地形 (${x}, ${y})，受到 ${result.damage} 点${hazard.damageType}伤害。`, deps);
}
/** 启用、调整或关闭方格战场；关闭时清除所有位置。 */
export function setTerrain(battle: Battle, terrain: Terrain, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (terrain !== 'normal' && terrain !== 'underwater' && terrain !== 'climbing' && terrain !== 'ice' && terrain !== 'lava' && terrain !== 'brambles' && terrain !== 'mud') throw new Error('战场地形取值无效。');
  if (terrain === 'normal') delete next.terrain;
  else next.terrain = terrain;
  addLog(next, terrain === 'underwater'
    ? '战场进入水下环境：远程攻击检定劣势，超出常规射程自动失手。'
    : terrain === 'climbing'
      ? '战场进入攀爬环境：移动消耗翻倍。'
      : terrain === 'ice'
        ? '战场进入冰面：移动消耗翻倍，移动后需通过敏捷豁免（DC 10），失败倒地。'
        : terrain === 'lava'
          ? '战场进入岩浆：站在其中的单位在踏入与回合开始时受到 1d10 点火焰伤害，移动消耗翻倍。'
          : terrain === 'brambles'
            ? '战场进入荆棘：移动消耗翻倍，每次移动每 5 尺受到 1 点穿刺伤害。'
            : terrain === 'mud'
              ? '战场进入泥沼：移动消耗翻倍，移动后需通过敏捷豁免（DC 12），失败倒地。'
              : '战场恢复为普通地形。', deps);
  return next;
}

export function configureGrid(battle: Battle, grid: GridConfig | null, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  if (grid === null) {
    delete next.grid;
    delete next.difficult;
    delete next.walls;
    next.actors.forEach(actor => { delete actor.position; });
    delete next.hazards;
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
/** 岩浆：站在其中（或踏入）时受到 1d10 点火焰伤害。 */
function applyLavaAt(battle: Battle, actor: Actor, deps: CombatDeps, phase: '踏入' | '回合开始' = '踏入'): void {
  if (battle.terrain !== 'lava') return;
  if (combatantOf(actor).status === 'dead') return;
  const burned = rollDamage('1d10', randomOf(deps), false);
  const result = applyDamageToActor(actor, burned.total, '火焰', battle, deps);
  addLog(battle, `${actorLabel(battle, actor)} ${phase === '踏入' ? '踏入' : '在'}岩浆，受到 ${result.damage} 点火焰伤害。`, deps);
}

export type ScrollSpell = '治疗术' | '祝福术' | '加速术' | '群体治疗术';

const SCROLL_PREFIX = '法术卷轴';
const SCROLL_SPELLS: ScrollSpell[] = ['群体治疗术', '治疗术', '祝福术', '加速术'];

/** 从物品名解析卷轴法术：名称须以「法术卷轴」开头并含已支持的法术名。 */
export function scrollSpellOf(name: string): ScrollSpell | null {
  if (!name.startsWith(SCROLL_PREFIX)) return null;
  return SCROLL_SPELLS.find(spell => name.includes(spell)) ?? null;
}

/** 卷轴豁免 DC：名称里的「（N 环）」决定环阶，缺省按 1 环（DC 11）。 */
export function scrollDc(name: string): number {
  const level = Number(name.match(/[(（](\d+)\s*环[)）]/)?.[1] ?? 1);
  return 10 + (Number.isInteger(level) && level > 0 ? level : 1);
}

/** 摧毁掩体：动作，力量（运动）检定对抗 DC 15，成功移除相邻格的工事。 */
export function destroyCover(battle: Battle, actorId: string, cell: Position, deps: CombatDeps = {}): { battle: Battle; outcome: CheckOutcome } {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以摧毁掩体。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以摧毁掩体。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (!coverAt(next, cell.x, cell.y)) throw new Error('该格没有可摧毁的掩体。');
  if (actor.position && cellDistance(actor.position, cell) * (next.grid?.cellFt ?? 5) > 5) throw new Error('只能摧毁相邻格子的掩体。');
  state.actionUsed = true;
  const result = abilityCheck(next, { actorId, ability: 'str', skill: '运动', dc: 15 }, deps);
  const after = result.battle;
  const label = actorLabel(after, actorOf(after, actorId));
  if (result.outcome.success) {
    after.cover = (after.cover ?? []).filter(item => item.x !== cell.x || item.y !== cell.y);
    addLog(after, `${label} 摧毁了（${cell.x}, ${cell.y}）的掩体。`, deps);
  } else {
    addLog(after, `${label} 用力砸向（${cell.x}, ${cell.y}）的掩体，但没能撼动它。`, deps);
  }
  return { battle: after, outcome: result.outcome };
}
/** 抄写卷轴需要的材料。 */
export const SCRIBE_PAPER = '空白羊皮纸';
/** 目前可以抄写的法术。 */
export const SCRIBE_SPELLS: ScrollSpell[] = ['治疗术', '祝福术', '加速术', '群体治疗术'];

/** 抄写卷轴：动作，消耗 1 张空白羊皮纸，把已知法术做成 1 环卷轴。 */
export function scribeScroll(battle: Battle, actorId: string, spell: ScrollSpell, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以抄写卷轴。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以抄写卷轴。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (!SCRIBE_SPELLS.includes(spell)) throw new Error('目前只能抄写治疗术、祝福术、加速术或群体治疗术。');
  const items = state.items ?? [];
  const paper = items.find(item => item.name === SCRIBE_PAPER && item.quantity > 0);
  if (!paper) throw new Error(`需要一张${SCRIBE_PAPER}才能抄写卷轴。`);
  const name = `法术卷轴：${spell}（1 环）`;
  const existing = items.find(item => item.name === name);
  if (!existing && items.length >= 20) throw new Error('每名单位最多记录 20 种物品。');
  state.actionUsed = true;
  paper.quantity -= 1;
  if (paper.quantity <= 0) state.items = items.filter(item => item.name !== SCRIBE_PAPER);
  const target = (state.items ?? []).find(item => item.name === name);
  if (target) target.quantity = Math.min(99, target.quantity + 1);
  else state.items = [...(state.items ?? []), { name, quantity: 1 }];
  addLog(next, `${actorLabel(next, actor)} 抄写了 ${name}（消耗 1 张${SCRIBE_PAPER}）。`, deps);
  return next;
}
/** 阅读法术卷轴：动作，施法属性检定对抗 DC 10 + 环阶，成功则施放，失败则卷轴损毁。 */
export function readScroll(battle: Battle, actorId: string, name: string, deps: CombatDeps = {}): { battle: Battle; spell: ScrollSpell; success: boolean; outcome: { natural: number; total: number; dc: number } } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以阅读卷轴。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以阅读卷轴。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const item = (state.items ?? []).find(entry => entry.name === name);
  if (!item) throw new Error(`该单位没有「${name}」这个物品。`);
  if (item.quantity <= 0) throw new Error(`「${name}」已经用完。`);
  const spell = scrollSpellOf(name);
  if (!spell) throw new Error(`「${name}」不是可用的法术卷轴。`);
  requireVoice(next, actorId);
  const dc = scrollDc(name);
  const bonus = spellcastingBonus(actor);
  const natural = rollDie(20, randomOf(deps));
  const total = natural + bonus;
  const success = natural === 20 || (natural !== 1 && total >= dc);
  item.quantity -= 1;
  if (item.quantity <= 0) {
    state.items = (state.items ?? []).filter(entry => entry !== item);
    if (state.items.length === 0) delete state.items;
  }
  const outcome = { natural, total, dc };
  if (!success) {
    state.actionUsed = true;
    addLog(next, `${actorLabel(next, actor)} 阅读「${name}」失败（d20 ${natural}+${bonus}=${total} 对 DC ${dc}），卷轴化为灰烬。`, deps);
    return { battle: next, spell, success: false, outcome };
  }
  let applied = next;
  if (spell === '治疗术') {
    state.actionUsed = true;
    applied = healActor(next, actorId, rollDamage('2d4+2', randomOf(deps), false).total, deps);
  } else if (spell === '祝福术') {
    const targets = blessTargets(next, actorId).slice(0, 3);
    if (!targets.length) targets.push(actor);
    applied = castBless(next, actorId, targets.map(entry => entry.id), deps);
  } else if (spell === '加速术') {
    const target = spellTargets(next, actorId)[0];
    if (!target) throw new Error('加速术卷轴没有可以影响的目标。');
    applied = castHaste(next, actorId, target.id, deps);
  } else {
    applied = castMassHealingWord(next, actorId, healTargets(next, actorId).map(entry => entry.id), deps).battle;
  }
  addLog(applied, `${actorLabel(applied, actorOf(applied, actorId))} 借「${name}」施放${spell}（d20 ${natural}+${bonus}=${total} 对 DC ${dc} 成功），卷轴化为灰烬。`, deps);
  return { battle: applied, spell, success: true, outcome };
}

/** 瞄准：附赠动作，让下一次远程攻击检定获得优势。 */
export function takeAim(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以瞄准。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以瞄准。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.aimed) throw new Error('该单位已经在瞄准。');
  if (state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  state.bonusUsed = true;
  state.aimed = true;
  addLog(next, `${actorLabel(next, actor)} 稳住呼吸瞄准，下一次远程攻击检定具有优势。`, deps);
  return next;
}

/** 泥沼：移动后需通过敏捷豁免，失败倒地。 */
function mudSlip(battle: Battle, actor: Actor, deps: CombatDeps): void {
  if (battle.terrain !== 'mud') return;
  if (combatantOf(actor).flying === true) return;
  if (combatantOf(actor).status !== 'active') return;
  const slip = resolveSave(actor, { actorId: actor.id, ability: 'dex', dc: 12, bonus: defaultSaveBonus(actor, 'dex') + auraBonus(battle, actor.id, 'saves') }, randomOf(deps));
  if (slip.success) {
    addLog(battle, `${actorLabel(battle, actor)} 在泥沼里稳住了脚步。`, deps);
    return;
  }
  const state = combatantOf(actor);
  if (!state.conditions.includes('倒地')) state.conditions.push('倒地');
  addLog(battle, `${actorLabel(battle, actor)} 在泥沼中滑倒，倒地。`, deps);
}

/** 荆棘：每次移动每 5 尺受到 1 点穿刺伤害。 */
function applyBrambles(battle: Battle, actor: Actor, steps: number, deps: CombatDeps): void {
  if (battle.terrain !== 'brambles' || steps <= 0) return;
  if (combatantOf(actor).status === 'dead') return;
  const result = applyDamageToActor(actor, steps, '穿刺', battle, deps);
  addLog(battle, `${actorLabel(battle, actor)} 穿过荆棘，受到 ${result.damage} 点穿刺伤害。`, deps);
}

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
    if (combatantOf(actor).flying !== true) {
      applyHazardAt(next, actor, x, y, deps);
      applyLavaAt(next, actor, deps);
    }
    return next;
  }
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以移动。');
  const state = combatantOf(actor);
  if (actor.combat?.conditions.includes('擒抱')) throw new Error('被擒抱的单位无法移动。');
  if (actor.combat?.conditions.includes('束缚')) throw new Error('被蛛网束缚的单位无法移动，需先用动作挣脱。');
  if (actor.combat?.conditions.includes('麻痹')) throw new Error('处于麻痹状态的单位无法移动。');
  const fearSource = actor.combat?.frightenedBy ? next.actors.find(item => item.id === actor.combat!.frightenedBy) : undefined;
  if ((actor.combat?.frightened ?? 0) > 0 && fearSource?.position && cellDistance({ x, y }, fearSource.position) < cellDistance(from, fearSource.position)) throw new Error('处于恐慌状态，无法朝恐惧源移动。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (lineCells(from, { x, y }).some(cell => isWallCell(next, cell.x, cell.y))) throw new Error('移动路径被墙体阻挡。');
  const rough = isDifficultCell(next, x, y);
  const swimming = next.terrain === 'underwater';
  const climbing = next.terrain === 'climbing';
  const icy = next.terrain === 'ice';
  const lava = next.terrain === 'lava';
  const brambles = next.terrain === 'brambles';
  const muddy = next.terrain === 'mud';
  const webbed = webAt(next, x, y);
  const entwined = entangleAt(next, x, y);
  const flying = state.flying === true;
  const cost = cellDistance(from, { x, y }) * next.grid!.cellFt * (flying ? 1 : rough ? 2 : 1) * (flying ? 1 : swimming || climbing || icy || lava || brambles || muddy || webbed || entwined ? 2 : 1);
  const speed = movementAllowance(actor);
  if (state.movementUsed + cost > speed) throw new Error(`移动距离超出速度上限（${speed} 尺）。`);
  state.movementUsed += cost;
  actor.position = { x, y };
  addLog(next, `${actorLabel(next, actor)} 移动到 (${x}, ${y})，消耗 ${cost} 尺（共 ${state.movementUsed}/${speed} 尺）${flying ? '，飞行忽略地形消耗' : ''}${!flying && rough ? '，困难地形使消耗翻倍' : ''}${!flying && swimming ? '，水下游泳使消耗翻倍' : ''}${!flying && climbing ? '，攀爬使消耗翻倍' : ''}${!flying && icy ? '，冰面使消耗翻倍' : ''}${!flying && lava ? '，岩浆使消耗翻倍' : ''}${!flying && brambles ? '，荆棘使消耗翻倍' : ''}${!flying && muddy ? '，泥沼使消耗翻倍' : ''}${!flying && webbed ? '，蛛网使消耗翻倍' : ''}${!flying && entwined ? '，藤蔓使消耗翻倍' : ''}。`, deps);
  if (greaseAt(next, x, y) && !flying) greaseFall(next, actor, deps);
  if (sleepCloudAt(next, x, y)) sleepDust(next, actor, deps);
  if (webbed && !flying) webStuck(next, actor, deps);
  if (entwined && !flying) entangleSnare(next, actor, deps);
  if (icy && !flying) {
    const stumble = resolveSave(actor, { actorId: actor.id, ability: 'dex', dc: 10, bonus: defaultSaveBonus(actor, 'dex') + auraBonus(next, actor.id, 'saves') }, randomOf(deps));
    if (!stumble.success) {
      const slipState = combatantOf(actor);
      if (!slipState.conditions.includes('倒地')) slipState.conditions.push('倒地');
      addLog(next, `${actorLabel(next, actor)} 在冰面上滑倒，倒地。`, deps);
    }
  }
  if (muddy && !flying) mudSlip(next, actor, deps);
  if (!flying) {
    applyHazardAt(next, actor, x, y, deps);
    applyLavaAt(next, actor, deps);
    applyBrambles(next, actor, cellDistance(from, { x, y }), deps);
  }
  const triggered = threatPrompts(next, actor, from, { x, y });
  const entered = enteringReachPrompts(next, actor, from, { x, y });
  if (entered.length) {
    const combat = requireCombat(next);
    const list = [...(combat.pendingOpportunity ?? [])];
    for (const prompt of entered) {
      if (list.some(item => item.reactorId === prompt.reactorId && item.targetId === prompt.targetId)) continue;
      list.push(prompt);
      const reactor = actorOf(next, prompt.reactorId);
      addLog(next, `${actorLabel(next, actor)} 进入 ${actorLabel(next, reactor)} 的触及范围，${actorLabel(next, reactor)} 可以借机攻击。`, deps);
    }
    combat.pendingOpportunity = list.slice(-8);
  }
  const prepared = readyPrompts(next, actor, from, { x, y });
  if (prepared.length) {
    const combat = requireCombat(next);
    const list = [...(combat.pendingOpportunity ?? [])];
    for (const prompt of prepared) {
      if (list.some(item => item.reactorId === prompt.reactorId && item.targetId === prompt.targetId)) continue;
      list.push(prompt);
      const reactor = actorOf(next, prompt.reactorId);
      addLog(next, `${actorLabel(next, actor)} 触发了 ${actorLabel(next, reactor)} 准备好的「${reactor.combat?.ready?.action ?? ''}」。`, deps);
    }
    combat.pendingOpportunity = list.slice(-8);
  }
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
  if (inDarkness(next, reactorId) !== inDarkness(next, prompt.targetId)) throw new Error('在魔法黑暗中看不清目标，无法进行借机攻击。');
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
  addLog(next, `${actorLabel(next, actorOf(next, reactorId))} 放弃${prompt.kind === 'ready' ? '准备好的动作' : '借机攻击'}。`, deps);
  return next;
}

/** 结算「准备动作」在敌人进入触及范围时生成的提示。 */
export function resolveReadyPrompt(battle: Battle, reactorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const prompt = (combat.pendingOpportunity ?? []).find(item => item.reactorId === reactorId && item.kind === 'ready');
  if (!prompt) throw new Error('该单位没有待确认的准备动作。');
  const rest = (combat.pendingOpportunity ?? []).filter(item => item !== prompt);
  if (rest.length) combat.pendingOpportunity = rest;
  else delete combat.pendingOpportunity;
  return triggerReadyAction(next, reactorId, deps);
}

/** 撤离：消耗动作，本回合移动不引发借机攻击。 */
export function disengage(battle: Battle, actorId: string, deps: CombatDeps = {}, cost: 'action' | 'bonus' = 'action'): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以撤离。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以撤离。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  spendActionSlot(state, cost);
  state.disengaged = true;
  addLog(next, `${actorLabel(next, actor)} 使用撤离，本回合移动不会引发借机攻击。`, deps);
  return next;
}

/** 闪避：消耗动作，直到自己下个回合开始前，针对自己的攻击检定具有劣势。 */
export function dodge(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以闪避。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以闪避。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  state.actionUsed = true;
  state.dodging = true;
  addLog(next, `${actorLabel(next, actor)} 使用闪避，直到下个回合开始前针对它的攻击检定具有劣势。`, deps);
  return next;
}

/** 疾跑：消耗动作，本回合额外获得等同于速度的移动力。 */
/** 消耗动作或附赠动作；对应槽位已被占用时抛错。 */
function spendActionSlot(state: CombatantState, cost: 'action' | 'bonus'): void {
  if (cost === 'action') {
    if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
    state.actionUsed = true;
    return;
  }
  if (state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
  state.bonusUsed = true;
}

export type CunningActionKind = 'dash' | 'disengage' | 'hide';

/** 灵巧动作：游荡者 2 级起，用附赠动作疾跑、撤离或躲藏。 */
export function cunningAction(battle: Battle, actorId: string, kind: CunningActionKind, deps: CombatDeps = {}, stealthTotal?: number): Battle {
  const actor = actorOf(structuredClone(battle), actorId);
  if (!hasCunningAction(actor)) throw new Error('只有 2 级以上的游荡者可以使用灵巧动作。');
  if (kind === 'dash') return dash(battle, actorId, deps, 'bonus');
  if (kind === 'disengage') return disengage(battle, actorId, deps, 'bonus');
  if (kind === 'hide') return hide(battle, actorId, stealthTotal, deps, 'bonus');
  throw new Error('灵巧动作类型无效。');
}

/** 鲁莽攻击：野蛮人 2 级起，不消耗动作；本回合攻击优势，但到自身下个回合开始前被攻击也有优势。 */
export function recklessAttack(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (next.combat && currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用鲁莽攻击。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以使用鲁莽攻击。');
  if (!hasRecklessAttack(actor)) throw new Error('只有 2 级以上的野蛮人可以使用鲁莽攻击。');
  if (state.reckless) throw new Error('本回合已经使用过鲁莽攻击。');
  state.reckless = true;
  addLog(next, `${actorLabel(next, actor)} 使用鲁莽攻击：本回合攻击检定具有优势，直到下个回合开始前针对它的攻击也具有优势。`, deps);
  return next;
}

export function dash(battle: Battle, actorId: string, deps: CombatDeps = {}, cost: 'action' | 'bonus' = 'action'): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以疾跑。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以疾跑。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  spendActionSlot(state, cost);
  state.dashMovement = actorSpeed(actor);
  addLog(next, `${actorLabel(next, actor)} 使用疾跑，本回合移动力增加 ${state.dashMovement} 尺。`, deps);
  return next;
}

/** 躲藏：消耗动作，用敏捷（隐匿）对抗敌人的被动察觉，成功则进入躲藏状态。 */
export function hide(battle: Battle, actorId: string, stealthTotal?: number, deps: CombatDeps = {}, cost: 'action' | 'bonus' = 'action'): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以躲藏。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'active') throw new Error('只有在场的单位可以躲藏。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (cost === 'action' && state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (stealthTotal !== undefined && (!Number.isInteger(stealthTotal) || stealthTotal < 0 || stealthTotal > 60)) throw new Error('隐匿检定结果须为 0 至 60 的整数。');
  const stealth = stealthTotal ?? abilityCheckBonus(actor, 'dex', '隐匿');
  const passive = next.actors
    .filter(item => item.id !== actor.id && item.side !== actor.side && item.combat?.status === 'active')
    .reduce((best, item) => Math.max(best, 10 + abilityCheckBonus(item, 'wis', '察觉')), 0);
  spendActionSlot(state, cost);
  const success = stealth > passive;
  state.hidden = success;
  addLog(next, `${actorLabel(next, actor)} 躲藏${success ? '成功' : '失败'}（隐匿 ${stealth} 对被动察觉 ${passive || '无'}）。`, deps);
  return next;
}

/** 协助检定：消耗动作，让同阵营的另一个单位下一次属性检定具有优势。 */
export function helpCheck(battle: Battle, helperId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (helperId === targetId) throw new Error('不能协助自己。');
  if (currentActorId(next) !== helperId) throw new Error('只有当前回合的单位可以协助。');
  const helper = actorOf(next, helperId);
  const target = actorOf(next, targetId);
  const state = combatantOf(helper);
  if (state.status !== 'active') throw new Error('只有在场的单位可以协助。');
  const blocker = actionBlocker(helper);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (combatantOf(target).status !== 'active') throw new Error('只能协助在场的单位。');
  if (helper.side !== target.side || helper.side === '中立') throw new Error('只能协助同阵营的单位。');
  state.actionUsed = true;
  combatantOf(target).helpedCheck = true;
  addLog(next, `${actorLabel(next, helper)} 协助 ${actorLabel(next, target)} 进行检定，${actorLabel(next, target)} 的下一次属性检定具有优势。`, deps);
  return next;
}

/** 协助：消耗动作，让同阵营的另一个单位下一次攻击检定具有优势。 */
export function help(battle: Battle, helperId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (helperId === targetId) throw new Error('不能协助自己。');
  if (currentActorId(next) !== helperId) throw new Error('只有当前回合的单位可以协助。');
  const helper = actorOf(next, helperId);
  const target = actorOf(next, targetId);
  const state = combatantOf(helper);
  if (state.status !== 'active') throw new Error('只有在场的单位可以协助。');
  const blocker = actionBlocker(helper);
  if (blocker) throw new Error(blocker);
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (combatantOf(target).status !== 'active') throw new Error('只能协助在场的单位。');
  if (helper.side !== target.side || helper.side === '中立') throw new Error('只能协助同阵营的单位。');
  state.actionUsed = true;
  combatantOf(target).helpedAttack = true;
  addLog(next, `${actorLabel(next, helper)} 协助 ${actorLabel(next, target)}，${actorLabel(next, target)} 的下一次攻击检定具有优势。`, deps);
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
  combat.dodging = false;
  combat.delayed = false;
  combat.nickUsed = false;
  delete combat.parryBonus;
  delete combat.shield;
  delete combat.aimed;
  delete combat.guarding;
  if (typeof combat.blessed === 'number') {
    combat.blessed -= 1;
    if (combat.blessed <= 0) {
      delete combat.blessed;
      addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 身上的祝福术结束了。`, {});
    }
  }
  for (const [key, name] of [['hasted', '加速术'], ['invisible', '隐形术'], ['slowed', '缓慢术'], ['polymorphed', '变形术'], ['barkskin', '树肤术']] as const) {
    const left = combat[key];
    if (typeof left !== 'number') continue;
    if (left > 1) { combat[key] = left - 1; continue; }
    delete combat[key];
    addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 身上的${name}结束了。`, {});
  }
  if (typeof combat.poisoned === 'number') {
    combat.poisoned -= 1;
    if (combat.poisoned <= 0) {
      delete combat.poisoned;
      combat.conditions = combat.conditions.filter(condition => condition !== '中毒');
      addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 的毒素失效了。`, {});
    }
  }
  if (typeof combat.blinded === 'number') {
    combat.blinded -= 1;
    if (combat.blinded <= 0) {
      delete combat.blinded;
      delete combat.blindedBy;
      combat.conditions = combat.conditions.filter(condition => condition !== '目盲');
      addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 的致盲术结束了。`, {});
    }
  }
  if (typeof combat.charmed === 'number') {
    combat.charmed -= 1;
    if (combat.charmed <= 0) {
      delete combat.charmed;
      delete combat.charmedBy;
      combat.conditions = combat.conditions.filter(condition => condition !== '魅惑');
      addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 摆脱了魅惑术。`, {});
    }
  }
  if (typeof combat.frightened === 'number') {
    combat.frightened -= 1;
    if (combat.frightened <= 0) {
      delete combat.frightened;
      delete combat.frightenedBy;
      combat.conditions = combat.conditions.filter(condition => condition !== '恐慌');
      addLog(battle, `${actorLabel(battle, actorOf(battle, actorId))} 摆脱了恐惧术。`, {});
    }
  }
  combat.sneakUsed = false;
  combat.reckless = false;
  for (const other of battle.actors) {
    if (other.combat?.slowSourceId === actorId) {
      other.combat.speedPenaltyFt = 0;
      delete other.combat.slowSourceId;
    }
  }
  combat.dashMovement = 0;
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
    .sort((a, b) => (combatantOf(b).initiative - combatantOf(a).initiative) || initiativeTiebreak(a, b))
    .map(a => a.id);
  if (!combat.order.length) throw new Error('战场上没有可行动的单位，请先添加单位。');
  const first = actorOf(next, combat.order[0]);
  resetTurnResources(next, first.id);
  addLog(next, `战斗开始：第 1 轮，${actorLabel(next, first)} 先攻 ${combatantOf(first).initiative}。`, deps);
  return next;
}
/** 战斗中调整某个单位的先攻值：重新排序，但保持当前行动者仍是同一人。 */
export function setInitiative(battle: Battle, actorId: string, initiative: number, deps: CombatDeps = {}): Battle {
  if (!Number.isInteger(initiative) || initiative < -20 || initiative > 60) throw new Error('先攻值须为 -20 至 60 的整数。');
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const actor = next.actors.find(item => item.id === actorId);
  if (!actor) throw new Error('该单位不在战斗中。');
  if (!actor.combat) throw new Error('该单位还没有先攻值。');
  const current = combat.order[combat.turnIndex];
  const previous = actor.combat.initiative;
  actor.combat.initiative = initiative;
  const rank = new Map(combat.order.map((id, index) => [id, index]));
  const initiativeOf = (id: string) => next.actors.find(item => item.id === id)?.combat?.initiative ?? 0;
  const actorById = (id: string) => next.actors.find(item => item.id === id)!;
  combat.order = combat.order.slice().sort((left, right) => initiativeOf(right) - initiativeOf(left) || initiativeTiebreak(actorById(left), actorById(right)) || (rank.get(left) ?? 0) - (rank.get(right) ?? 0));
  const index = combat.order.indexOf(current);
  combat.turnIndex = index >= 0 ? index : 0;
  if (previous !== initiative) addLog(next, `${actorLabel(next, actor)} 的先攻改为 ${initiative}。`, deps);
  return next;
}

/** 为所有在场单位重掷先攻（d20 + 先攻加值），并按新顺序重排；当前行动者保持不变。 */
export function rerollInitiative(battle: Battle, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const current = combat.order[combat.turnIndex];
  const random = randomOf(deps);
  for (const actor of next.actors) {
    if (!actor.combat) continue;
    if (actor.combat.status === 'dead') continue;
    const bonus = actorInitiativeBonus(actor);
    const face = 1 + Math.floor(random() * 20);
    actor.combat.initiative = face + bonus;
  }
  const rank = new Map(combat.order.map((id, index) => [id, index]));
  const initiativeOf = (id: string) => next.actors.find(item => item.id === id)?.combat?.initiative ?? 0;
  const actorById = (id: string) => next.actors.find(item => item.id === id)!;
  combat.order = combat.order.slice().sort((left, right) => initiativeOf(right) - initiativeOf(left) || initiativeTiebreak(actorById(left), actorById(right)) || (rank.get(left) ?? 0) - (rank.get(right) ?? 0));
  const index = combat.order.indexOf(current);
  combat.turnIndex = index >= 0 ? index : 0;
  addLog(next, `重新掷先攻：${combat.order.map(id => `${actorLabel(next, next.actors.find(item => item.id === id)!)} ${initiativeOf(id)}`).join('、')}。`, deps);
  return next;
}

export function endTurn(battle: Battle, deps: CombatDeps = {}): Battle {
  requireCombat(battle);
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const endingId = combat.order[combat.turnIndex];
  if (endingId) applyOngoingDamage(next, deps, 'end', endingId);
  const ending = endingId ? next.actors.find(item => item.id === endingId) : undefined;
  if (ending?.combat?.suppressed) {
    delete ending.combat.suppressed;
    addLog(next, `${actorLabel(next, ending)} 摆脱了掩护射击的压制。`, deps);
  }
  const actor = nextTurnIndex(next);
  resetTurnResources(next, actor.id);
  addLog(next, `第 ${combat.round} 轮 · 轮到 ${actorLabel(next, actor)}（先攻 ${combatantOf(actor).initiative}）。`, deps);
  if (actor.combat?.commanded === 'halt') {
    delete actor.combat.commanded;
    addLog(next, `${actorLabel(next, actor)} 受命令术影响，整个回合无法行动。`, deps);
    return endTurn(next, deps);
  }
  if (actor.combat?.surprised) {
    delete actor.combat.surprised;
    addLog(next, `${actorLabel(next, actor)} 措手不及，本回合无法行动。`, deps);
    return endTurn(next, deps);
  }
  if (actor.combat?.ready) { delete actor.combat.ready; addLog(next, `${actorLabel(next, actor)} 的准备动作在回合开始时失效。`, deps); }
  applyOngoingDamage(next, deps);
  holdRecover(next, actor, deps);
  charmRecover(next, actor, deps);
  fearRecover(next, actor, deps);
  blindRecover(next, actor, deps);
  entangleSnare(next, actor, deps);
  if (actor.position) {
    applyHazardAt(next, actor, actor.position.x, actor.position.y, deps, '回合开始');
    applyLavaAt(next, actor, deps, '回合开始');
  }
  if (next.autoDeathSaves && actor.combat?.status === 'down' && actor.combat?.stable !== true && actor.characterSnapshot) {
    resolveDeathSave(next, actor, deps);
  }
  syncSummonsInPlace(next, deps);
  tickSummonDurations(next, deps);
  delete combat.pendingOpportunity;
  return next;
}

/** 设置战场遮蔽度：轻度遮蔽仅影响察觉，重度遮蔽让所有攻击检定承受劣势。 */
export function setObscured(battle: Battle, obscured: 'none' | 'light' | 'heavy', deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (obscured !== 'none' && obscured !== 'light' && obscured !== 'heavy') throw new Error('遮蔽度取值无效。');
  if (obscured === 'none') delete next.obscured;
  else next.obscured = obscured;
  addLog(next, obscured === 'heavy' ? '战场进入重度遮蔽：攻击检定具有劣势。' : obscured === 'light' ? '战场进入轻度遮蔽：只影响察觉。' : '战场恢复为明亮环境。', deps);
  return next;
}

/** 开关：敌对单位进入长武器持有者的触及范围时是否也能借机攻击。 */
export function setEnterReachOpportunity(battle: Battle, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (enabled) next.enterReachOpportunity = true;
  else delete next.enterReachOpportunity;
  addLog(next, enabled ? '已开启：敌对单位进入长武器触及范围时也可以借机攻击。' : '已关闭：长武器只在目标离开触及范围时借机。', deps);
  return next;
}

/** 开关：回合开始时是否为倒地的角色自动掷死亡豁免。 */
export function setAutoDeathSaves(battle: Battle, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (enabled) next.autoDeathSaves = true;
  else delete next.autoDeathSaves;
  addLog(next, enabled ? '已开启：倒地的角色在回合开始时自动掷死亡豁免。' : '已关闭：死亡豁免改为手动掷。', deps);
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
  requireReactionAllowed(actor);
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
  if (kind === 'reaction') requireReactionAllowed(actor);
  if (kind === 'reaction' && state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  if (kind === 'action') state.actionUsed = true;
  if (kind === 'bonus') state.bonusUsed = true;
  if (kind === 'reaction') state.reactionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 使用了${kind === 'action' ? '动作' : kind === 'bonus' ? '附赠动作' : '反应'}。`, deps);
  return next;
}
/** 跳跃：以力量值尺为跳远上限，按直线距离消耗移动力，忽略困难地形与危险地形，也不引发借机攻击。 */
export function jumpToCell(battle: Battle, actorId: string, x: number, y: number, deps: CombatDeps = {}): Battle {
  if (!battle.grid) throw new Error('请先启用方格战场。');
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error('格子坐标须为整数。');
  if (x < 0 || y < 0 || x >= battle.grid.width || y >= battle.grid.height) throw new Error('目标格子超出战场范围。');
  const from = positionOf(battle, actorId);
  if (!from) throw new Error('请先把单位放到方格战场上。');
  if (from.x === x && from.y === y) throw new Error('单位已经在该格。');
  const occupied = battle.actors.find(actor => actor.id !== actorId && actor.position?.x === x && actor.position?.y === y);
  if (occupied) throw new Error(`该格已有单位：${occupied.name}。`);
  if (isWallCell(battle, x, y)) throw new Error('不能跳到墙体格子。');
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以跳跃。');
  const state = combatantOf(actor);
  if (actor.combat?.conditions.includes('擒抱')) throw new Error('被擒抱的单位无法跳跃。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (lineCells(from, { x, y }).some(cell => isWallCell(next, cell.x, cell.y))) throw new Error('跳跃路径被墙体阻挡。');
  const distance = cellDistance(from, { x, y }) * next.grid!.cellFt;
  const maxJump = jumpDistance(actor, 'long');
  if (distance > maxJump) throw new Error(`跳跃距离超出上限（${maxJump} 尺）。`);
  const speed = movementAllowance(actor);
  if (state.movementUsed + distance > speed) throw new Error(`移动距离超出速度上限（${speed} 尺）。`);
  state.movementUsed += distance;
  actor.position = { x, y };
  addLog(next, `${actorLabel(next, actor)} 跳跃到 (${x}, ${y})，消耗 ${distance} 尺（共 ${state.movementUsed}/${speed} 尺）。`, deps);
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
  const speed = movementAllowance(actor);
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
function terrainDefense(battle: Battle | undefined, type: DamageType): { multiplier: number; label: string } {
  if (battle?.terrain === 'underwater' && type === '火焰') return { multiplier: 0.5, label: '水下：火焰抗性' };
  if (battle?.weather === 'rain' && type === '火焰') return { multiplier: 0.5, label: '暴雨：火焰抗性' };
  return { multiplier: 1, label: '' };
}
function applyDamageToActor(actor: Actor, amount: number, type: DamageType, battle?: Battle, deps: CombatDeps = {}, options: { nonLethal?: boolean } = {}): DamageOutcome {
  if (!Number.isInteger(amount) || amount < 0) throw new Error('伤害须为非负整数。');
  const state = combatantOf(actor);
  const defense = defenseOf(actor, type);
  const terrain = terrainDefense(battle, type);
  const adjusted = Math.floor(amount * defense.multiplier * terrain.multiplier);
  const takenStats = statsOf(state);
  takenStats.damageTaken += adjusted;
  if (adjusted > 0) takenStats.damageByType = { ...(takenStats.damageByType ?? {}), [type]: (takenStats.damageByType?.[type] ?? 0) + adjusted };
  const absorbed = Math.min(state.tempHp, adjusted);
  state.tempHp -= absorbed;
  const remaining = adjusted - absorbed;
  if (actor.currentHp === 0 && state.status === 'down') {
    if (remaining > 0 && state.stable === true && !options.nonLethal) delete state.stable;
    if (remaining > 0 && !options.nonLethal) state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 1);
    if (state.deathSaves.failures >= 3) state.status = 'dead';
    if (battle && state.status === 'dead') settleDeath(battle, actor, deps);
    return { damage: adjusted, tempAbsorbed: absorbed, status: state.status };
  }
  const before = actor.currentHp;
  actor.currentHp = Math.max(0, before - remaining);
  if (actor.currentHp === 0) {
    const overflow = Math.max(0, remaining - before);
    if (options.nonLethal) {
      state.status = 'down';
      state.stable = true;
      state.deathSaves = { successes: 0, failures: 0 };
      if (battle) addLog(battle, `${actorLabel(battle, actor)} 被非致命攻击打晕，陷入昏迷但伤势稳定。`, deps);
    } else {
      state.status = actor.characterSnapshot && overflow < actor.maxHp ? 'down' : 'dead';
      state.deathSaves = { successes: 0, failures: 0 };
    }
  }
  if (battle && state.status === 'dead') settleDeath(battle, actor, deps);
  if (battle && adjusted > 0 && state.sleeping === true) {
    delete state.sleeping;
    state.conditions = state.conditions.filter(condition => condition !== '失能' && condition !== '倒地');
    addLog(battle, `${actorLabel(battle, actor)} 受到伤害，从沉睡中醒来。`, deps);
  }
  return { damage: adjusted, tempAbsorbed: absorbed, status: state.status };
}
/** 取（或初始化）某个单位的战斗统计。 */
function statsOf(state: CombatantState): CombatStats {
  state.stats = state.stats ?? { attacks: 0, hits: 0, crits: 0, misses: 0, damageDealt: 0, damageTaken: 0, healing: 0 };
  return state.stats;
}

/** 单位死亡后的收尾：中断专注并驱散召唤物、清除自身持续效果与回合标记、移除其产生的灵光。 */
function settleDeath(battle: Battle, actor: Actor, deps: CombatDeps = {}): void {
  const state = actor.combat;
  if (!state || state.status !== 'dead') return;
  if (state.riderId) {
    const rider = battle.actors.find(item => item.id === state.riderId);
    if (rider?.combat) {
      delete rider.combat.mountedOn;
      delete rider.combat.mountSpeedFt;
      if (!rider.combat.conditions.includes('倒地')) rider.combat.conditions.push('倒地');
      addLog(battle, `${actorLabel(battle, rider)} 的坐骑倒下了，骑手落马倒地。`, deps);
    }
    delete state.riderId;
  }
  if (state.concentration) {
    const spell = state.concentration.spell;
    delete state.concentration;
    dismissSummonsOf(battle, actor.id, `施法者死亡，无法维持「${spell}」`, deps);
    addLog(battle, `${actorLabel(battle, actor)} 死亡，中断了对「${spell}」的专注。`, deps);
    clearFocusBuffs(battle, actor.id, `${actorLabel(battle, actor)} 死亡`, deps);
  }
  if (state.ongoing?.length) {
    delete state.ongoing;
    addLog(battle, `${actorLabel(battle, actor)} 死亡，身上的持续效果一并清除。`, deps);
  }
  delete state.ready;
  state.dodging = false;
  state.helpedAttack = false;
  delete state.vexTargetId;
  const auras = battle.auras ?? [];
  const lost = auras.filter(aura => aura.ownerId === actor.id);
  if (lost.length) {
    const rest = auras.filter(aura => aura.ownerId !== actor.id);
    if (rest.length) battle.auras = rest; else delete battle.auras;
    for (const aura of lost) addLog(battle, `${actorLabel(battle, actor)} 倒下，「${aura.name}」灵光随之消失。`, deps);
  }
}
export function damageActor(battle: Battle, actorId: string, amount: number, type: DamageType, deps: CombatDeps = {}): { battle: Battle; outcome: DamageOutcome } {
  if (!damageTypes.includes(type)) throw new Error('请选择有效的伤害类型。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const wasDown = state.status === 'down';
  const outcome = applyDamageToActor(actor, amount, type, next);
  const terrain = terrainDefense(next, type);
  const notes: string[] = [];
  if (terrain.label) notes.push(terrain.label);
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
  const wasDown = state.status === 'down';
  const healed = Math.min(actor.maxHp - actor.currentHp, amount);
  statsOf(state).healing += healed;
  actor.currentHp += healed;
  if (wasDown && actor.currentHp > 0) {
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
    delete state.stable;
  }
  addLog(next, wasDown && actor.currentHp > 0
    ? `${actorLabel(next, actor)} 被治疗，恢复 ${healed} 点生命值并重新站起，当前 ${actor.currentHp}/${actor.maxHp}。`
    : `${actorLabel(next, actor)} 恢复 ${healed} 点生命值，当前 ${actor.currentHp}/${actor.maxHp}。`, deps);
  return next;
}
/** 给战斗单位添加物品（同名合并，最多 99 个）。 */
export function addItem(battle: Battle, actorId: string, name: string, quantity: number, healExpression?: string, deps: CombatDeps = {}): Battle {
  const next = structuredClone(battle);
  const actor = actorOf(next, actorId);
  const label = name.trim();
  if (!label) throw new Error('请填写物品名称。');
  if (label.length > 40) throw new Error('物品名称不能超过 40 个字符。');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('物品数量须为 1 至 99 的整数。');
  if (healExpression !== undefined) parseDice(healExpression);
  const state = combatantOf(actor);
  const items = state.items ?? [];
  const existing = items.find(item => item.name === label);
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + quantity);
    if (healExpression) existing.healExpression = healExpression;
  } else {
    if (items.length >= 20) throw new Error('每名单位最多记录 20 种物品。');
    items.push({ name: label, quantity, ...(healExpression ? { healExpression } : {}) });
  }
  state.items = items;
  if (battle.combat) addLog(next, `${actorLabel(next, actor)} 获得物品「${label}」×${quantity}。`, deps);
  return next;
}

/** 使用物品：默认消耗动作，可治疗自己或 5 尺内的同伴。 */
export function useItem(battle: Battle, actorId: string, name: string, targetId?: string, deps: CombatDeps = {}): { battle: Battle; healed: number } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用物品。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const item = (state.items ?? []).find(entry => entry.name === name);
  if (!item) throw new Error(`该单位没有「${name}」这个物品。`);
  if (item.quantity <= 0) throw new Error(`「${name}」已经用完。`);
  if (item.identified === false) throw new Error(`「${name}」尚未鉴定，无法使用。`);
  if (!item.healExpression) throw new Error(`「${name}」没有可结算的效果。`);
  const target = actorOf(next, targetId ?? actorId);
  const targetState = combatantOf(target);
  if (targetState.status === 'dead') throw new Error('已死亡的单位无法通过物品恢复。');
  if (target.id !== actor.id && actor.position && target.position && cellDistance(actor.position, target.position) > 1) throw new Error('只能对自己或 5 尺内的同伴使用物品。');
  const rolled = rollDamage(item.healExpression, randomOf(deps), false);
  const wasDown = targetState.status === 'down';
  const healed = Math.min(target.maxHp - target.currentHp, rolled.total);
  target.currentHp += healed;
  if (wasDown && target.currentHp > 0) {
    targetState.status = 'active';
    targetState.deathSaves = { successes: 0, failures: 0 };
    delete targetState.stable;
  }
  state.actionUsed = true;
  item.quantity -= 1;
  if (item.quantity <= 0) {
    const rest = (state.items ?? []).filter(entry => entry !== item);
    if (rest.length) state.items = rest;
    else delete state.items;
  }
  addLog(next, `${actorLabel(next, actor)} 使用「${item.name}」${target.id === actor.id ? '' : `为 ${actorLabel(next, target)} `}恢复 ${healed} 点生命值${wasDown && target.currentHp > 0 ? '并重新站起' : ''}，当前 ${target.currentHp}/${target.maxHp}。`, deps);
  return { battle: next, healed };
}

/** 搜刮：把阵亡单位身上的物品转移到存活单位（5 尺内），同名物品合并。 */

/** 搜刮周围：一次性把 5 尺内所有尸体的物品收进背包，跳过会超过 20 种的尸体。 */
export function lootAll(battle: Battle, looterId: string, deps: CombatDeps = {}): { battle: Battle; looted: string[] } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const looter = actorOf(next, looterId);
  const looterState = combatantOf(looter);
  if (looterState.status !== 'active') throw new Error('只有在场的单位可以搜刮。');
  const near = (item: Actor) => !looter.position || !item.position || cellDistance(looter.position, item.position) <= 1;
  const corpses = next.actors.filter(item => item.id !== looter.id && item.combat?.status === 'dead' && (item.combat?.items ?? []).length > 0 && near(item));
  if (!corpses.length) throw new Error('5 尺内没有可搜刮的尸体。');
  const owned = looterState.items ?? [];
  const known = new Set(owned.map(entry => entry.name));
  const looted: string[] = [];
  const skipped: string[] = [];
  for (const corpse of corpses) {
    const loot = corpse.combat?.items ?? [];
    const incoming = loot.filter(entry => !known.has(entry.name));
    if (owned.length + incoming.length > 20) { skipped.push(actorLabel(next, corpse)); continue; }
    for (const entry of loot) {
      const existing = owned.find(item => item.name === entry.name);
      if (existing) existing.quantity = Math.min(99, existing.quantity + entry.quantity);
      else { owned.push({ ...entry, quantity: Math.min(99, entry.quantity) }); known.add(entry.name); }
      looted.push(entry.name);
    }
    if (corpse.combat) delete corpse.combat.items;
  }
  if (owned.length) looterState.items = owned;
  const summary = looted.length ? `搜刮了 ${Array.from(new Set(looted)).join('、')}` : '没有可搜刮的物品';
  const note = skipped.length ? `；${skipped.join('、')} 身上的物品太多，背不下了` : '';
  addLog(next, `${actorLabel(next, looter)} 从左近的尸体上${summary}${note}。`, deps);
  return { battle: next, looted };
}

export function lootCorpse(battle: Battle, looterId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; looted: string[] } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const looter = actorOf(next, looterId);
  const target = actorOf(next, targetId);
  const looterState = combatantOf(looter);
  const targetState = combatantOf(target);
  if (looterState.status !== 'active') throw new Error('只有在场的单位可以搜刮。');
  if (targetState.status !== 'dead') throw new Error('只能搜刮已经死亡的单位。');
  if (looter.position && target.position && cellDistance(looter.position, target.position) > 1) throw new Error('只能搜刮 5 尺内的尸体。');
  const loot = targetState.items ?? [];
  if (!loot.length) throw new Error('该单位身上没有可搜刮的物品。');
  const owned = looterState.items ?? [];
  const known = new Set(owned.map(entry => entry.name));
  const incoming = loot.filter(entry => !known.has(entry.name));
  if (owned.length + incoming.length > 20) throw new Error('每名单位最多记录 20 种物品，无法再拾取。');
  for (const entry of loot) {
    const existing = owned.find(item => item.name === entry.name);
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + entry.quantity);
      if (entry.healExpression) existing.healExpression = existing.healExpression ?? entry.healExpression;
    } else {
      owned.push({ name: entry.name, quantity: Math.min(99, entry.quantity), ...(entry.healExpression ? { healExpression: entry.healExpression } : {}) });
    }
  }
  looterState.items = owned;
  delete targetState.items;
  const summary = loot.map(entry => `「${entry.name}」×${entry.quantity}`).join('、');
  addLog(next, `${actorLabel(next, looter)} 从 ${actorLabel(next, target)} 身上搜刮了 ${summary}。`, deps);
  return { battle: next, looted: loot.map(entry => entry.name) };
}

/** 传递物品：把身上的物品交给 5 尺内的同伴，同名物品合并。 */
export function giveItem(battle: Battle, fromId: string, toId: string, name: string, quantity = 1, deps: CombatDeps = {}): { battle: Battle; moved: number } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const giver = actorOf(next, fromId);
  const receiver = actorOf(next, toId);
  const giverState = combatantOf(giver);
  const receiverState = combatantOf(receiver);
  if (giver.id === receiver.id) throw new Error('不能把物品递给自己。');
  if (giverState.status !== 'active' || receiverState.status !== 'active') throw new Error('只有在场的单位可以传递物品。');
  if (giver.side !== receiver.side || giver.side === '中立') throw new Error('只能把物品递给同阵营的同伴。');
  if (giver.position && receiver.position && cellDistance(giver.position, receiver.position) > 1) throw new Error('只能把物品传递给 5 尺内的同伴。');
  const item = (giverState.items ?? []).find(entry => entry.name === name);
  if (!item) throw new Error(`该单位没有「${name}」这个物品。`);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > item.quantity) throw new Error(`传递数量须为 1 至 ${item.quantity} 的整数。`);
  const owned = receiverState.items ?? [];
  const existing = owned.find(entry => entry.name === name);
  if (!existing && owned.length + 1 > 20) throw new Error('接收方已经记录了 20 种物品，无法再接收。');
  if (existing) {
    existing.quantity = Math.min(99, existing.quantity + quantity);
    if (item.healExpression) existing.healExpression = existing.healExpression ?? item.healExpression;
  } else {
    owned.push({ name: item.name, quantity: Math.min(99, quantity), ...(item.healExpression ? { healExpression: item.healExpression } : {}) });
  }
  receiverState.items = owned;
  item.quantity -= quantity;
  if (item.quantity <= 0) {
    const rest = (giverState.items ?? []).filter(entry => entry !== item);
    if (rest.length) giverState.items = rest;
    else delete giverState.items;
  }
  addLog(next, `${actorLabel(next, giver)} 把「${item.name}」×${quantity} 递给 ${actorLabel(next, receiver)}。`, deps);
  return { battle: next, moved: quantity };
}

/** 记录一件未鉴定的物品：效果先隐藏，鉴定后才能使用。 */
export function addUnidentifiedItem(battle: Battle, actorId: string, name: string, quantity: number, healExpression?: string, deps: CombatDeps = {}): Battle {
  const next = addItem(battle, actorId, name, quantity, healExpression, deps);
  const actor = actorOf(next, actorId);
  const item = (combatantOf(actor).items ?? []).find(entry => entry.name === name);
  if (!item) return next;
  item.identified = false;
  addLog(next, `${actorLabel(next, actor)} 记录了一件未鉴定的物品「${name}」×${quantity}。`, deps);
  return next;
}

/** 鉴定物品：消耗动作，成功后可以使用。 */
export function identifyItem(battle: Battle, actorId: string, name: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以鉴定物品。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const item = (state.items ?? []).find(entry => entry.name === name);
  if (!item) throw new Error(`该单位没有「${name}」这个物品。`);
  if (item.identified !== false) throw new Error(`「${name}」已经鉴定过了。`);
  item.identified = true;
  state.actionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 鉴定了「${name}」${item.healExpression ? `：${item.healExpression} 治疗` : ''}。`, deps);
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
  if (!options.ignoreCostCheck) {
    if (cost === 'action' && state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
    if (cost === 'bonus' && state.bonusUsed) throw new Error('该单位本回合已经使用过附赠动作。');
    if (cost === 'reaction' && state.reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  }
  const criticalRange = options.criticalRange ?? criticalThreshold(attacker);
  if (!Number.isInteger(criticalRange) || criticalRange < 15 || criticalRange > 20) throw new Error('重击范围须为 15 至 20。');
  const range: AttackRange = options.range ?? 'melee';
  if (range !== 'melee' && range !== 'ranged') throw new Error('请选择近战或远程攻击。');
  if (options.nonLethal && range !== 'melee') throw new Error('只有近战攻击可以选择非致命。');
  if (range === 'ranged' && attacker.position && target.position && !hasLineOfSight(battle, attacker.position, target.position)) {
    throw new Error('视线被墙体阻挡，无法进行远程攻击。');
  }
  const reachFt = options.reachFt ?? 5;
  if (!Number.isInteger(reachFt) || reachFt < 5 || reachFt > 30) throw new Error('近战触及范围须为 5 至 30 尺的整数。');
  if (options.cover !== undefined && !coverTypes.includes(options.cover)) throw new Error('掩体取值无效。');
  if (options.weaponId !== undefined && !attackSources(attacker).some(item => item.id === options.weaponId)) throw new Error('攻击来源无效。');
  if (options.weaponId !== undefined) {
    const weapon = attackSources(attacker).find(item => item.id === options.weaponId);
    if (weapon?.properties?.includes('装填') && (options.attacks ?? 1) > 1) throw new Error('装填武器每个动作只能射击一次。');
      if (weapon?.properties?.includes('弹药')) {
        const shots = options.attacks ?? 1;
        const remaining = attacker.combat?.ammo ?? defaultAmmo;
        if (remaining < shots) throw new Error(`弹药不足：剩余 ${remaining} 发，需要 ${shots} 发。`);
      }
  }
  if (options.twoHanded) {
    const versatile = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId)?.versatileDamage : undefined;
    if (!versatile) throw new Error('该武器没有两用形态，无法双手持用。');
  }
  if (options.powerAttack) {
    const heavy = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
    if (!heavy?.properties?.includes('重型')) throw new Error('只有重型武器可以使用强力攻击。');
  }
  const measured = actorDistance(battle, attacker.id, target.id);
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'melee' && measured > reachFt) throw new Error(`目标距离 ${measured} 尺，超出近战触及范围（${reachFt} 尺）。`);
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'ranged' && measured > 600) throw new Error('目标距离超出远程攻击范围（600 尺）。');
  if (options.weaponId) {
    const source = attackSources(attacker).find(item => item.id === options.weaponId);
    if (source && source.origin === 'weapon' && range === 'ranged') {
      const maxRange = source.longRangeFt ?? source.thrownMaxRangeFt;
      if (!maxRange) throw new Error('该武器不能进行远程攻击。');
      const distance = measured ?? options.distanceFt ?? 30;
      if (distance > maxRange) throw new Error('目标距离超出该武器的最大射程（' + maxRange + ' 尺）。');
    }
  }
  if (measured !== undefined && !options.ignoreDistanceCheck && range === 'ranged' && attacker.position && target.position && !hasLineOfSight(battle, attacker.position, target.position)) throw new Error('视线被墙体阻挡，无法进行远程攻击。');
  const distanceFt = options.ignoreDistanceCheck ? (options.distanceFt ?? reachFt) : (measured ?? options.distanceFt ?? (range === 'melee' ? reachFt : 30));
  if (!Number.isInteger(distanceFt) || distanceFt < 0 || distanceFt > 600) throw new Error('距离须为 0 至 600 尺的整数。');
  let cover = options.cover ?? (options.autoCover && attacker.position && target.position ? coverFromWalls(battle, attacker.position, target.position) : undefined);
  if (cover === '全掩体') throw new Error('目标处于全掩体，无法被直接攻击。');
  if (options.sharpshooter) {
    const weapon = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
    const shootable = weapon && (weapon.range === 'ranged' || weapon.properties?.includes('投掷'));
    if (!shootable) throw new Error('只有远程或投掷武器可以使用神射手。');
    cover = undefined;
  }
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
  if (!options.weaponId || options.range === 'melee' || options.sharpshooter) return null;
  const source = attackSources(actor).find(item => item.id === options.weaponId);
  const normalRange = source?.longRangeFt ? source.distanceFt : source?.thrownRangeFt;
  if (!normalRange || distanceFt <= normalRange) return null;
  return { mode: 'disadvantage', notes: [`距离 ${distanceFt} 尺超出常规射程 ${normalRange} 尺：攻击检定劣势`] };
}

/** 找出正在保护该目标的同伴（同阵营、相邻或未启用方格）。 */
function guardingProtector(battle: Battle, target: Actor): Actor | undefined {
  return battle.actors.find(item => {
    if (item.id === target.id) return false;
    if (item.combat?.guarding !== target.id) return false;
    if (item.combat.status !== 'active') return false;
    if (item.position && target.position) return cellDistance(item.position, target.position) <= 1;
    return true;
  });
}

export function protectAlly(battle: Battle, protectorId: string, targetId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const protector = actorOf(next, protectorId);
  const target = actorOf(next, targetId);
  if (protectorId === targetId) throw new Error('不能保护自己。');
  if (!fightingStylesOf(protector).includes('保护')) throw new Error('只有选择「保护」战斗风格的单位可以保护同伴。');
  if (combatantOf(protector).status !== 'active') throw new Error('只有在场的单位可以保护同伴。');
  if (combatantOf(target).status !== 'active') throw new Error('只能保护在场的同伴。');
  if (protector.side !== target.side || protector.side === '中立') throw new Error('只能保护同阵营的同伴。');
  requireReactionAllowed(protector);
  if (combatantOf(protector).reactionUsed) throw new Error('该单位本回合已经使用过反应。');
  if (protector.position && target.position && cellDistance(protector.position, target.position) > 1) throw new Error('保护的目标需要在 5 尺内。');
  combatantOf(protector).reactionUsed = true;
  combatantOf(protector).guarding = targetId;
  addLog(next, `${actorLabel(next, protector)} 用保护风格挡在 ${actorLabel(next, target)} 身前：针对后者的下一次攻击具有劣势。`, deps);
  return next;
}

function resolveOneAttack(battle: Battle, options: AttackOptions, context: AttackContext, deps: CombatDeps, consumeCost: boolean): AttackOutcome {
  const attacker = actorOf(battle, options.attackerId);
  const target = actorOf(battle, options.targetId);
  const state = combatantOf(attacker);
  if (state.conditions.includes('魅惑') && state.charmedBy === target.id) throw new Error('被魅惑的单位无法攻击魅惑它的施法者。');
  const frightenedAdjustment: ModeAdjustment | null = (state.frightened ?? 0) > 0 && state.frightenedBy === target.id ? { mode: 'disadvantage', notes: ['处于恐慌：对恐惧源攻击检定劣势'] } : null;
  const poisonAdjustment: ModeAdjustment | null = state.conditions.includes('中毒') ? { mode: 'disadvantage', notes: ['中毒：攻击检定劣势'] } : null;
  const targetWasDown = combatantOf(target).status === 'down';
  const ammoWeapon = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
  if (ammoWeapon?.properties?.includes('弹药')) state.ammo = Math.max(0, (state.ammo ?? defaultAmmo) - 1);
  const random = randomOf(deps);
  const heavy = heavyWeaponAdjustment(attacker, options.weaponId);
  const far = longRangeAdjustment(attacker, options, context.distanceFt);
  const underwaterRanged = battle.terrain === 'underwater' && context.range === 'ranged';
  const underwaterAdjustment: ModeAdjustment | null = underwaterRanged ? { mode: 'disadvantage', notes: ['水下：远程攻击检定劣势'] } : null;
  const underwaterMiss = underwaterRanged && context.distanceFt > 30;
  const dodging = combatantOf(target).dodging === true;
  const helped = combatantOf(attacker).helpedAttack === true;
  const sapped = combatantOf(attacker).sapped === true;
  const vexed = combatantOf(attacker).vexTargetId === target.id;
  const hiddenAttacker = combatantOf(attacker).hidden === true;
  const elevationDelta = (attacker.elevation ?? 0) - (target.elevation ?? 0);
  const elevationAdjustment: ModeAdjustment | null = context.range === 'ranged' && elevationDelta >= 10
    ? { mode: 'advantage', notes: [`从高处（高 ${elevationDelta} 尺）射击：攻击检定优势`] }
    : context.range === 'ranged' && elevationDelta <= -10
      ? { mode: 'disadvantage', notes: [`仰射高处目标（低 ${-elevationDelta} 尺）：攻击检定劣势`] }
      : null;
  const engagedInMelee = context.range === 'ranged' && !!attacker.position && battle.actors.some(item => item.id !== attacker.id && item.side !== attacker.side && item.side !== '中立' && item.combat?.status === 'active' && !!item.position && cellDistance(item.position, attacker.position!) <= 1);
  const engagedAdjustment: ModeAdjustment | null = engagedInMelee ? { mode: 'disadvantage', notes: ['远程攻击时敌人贴身：攻击检定劣势'] } : null;
  const hiddenTarget = combatantOf(target).hidden === true;
  const invisibleAttacker = (combatantOf(attacker).invisible ?? 0) > 0;
  const invisibleTarget = (combatantOf(target).invisible ?? 0) > 0;
  const guard = guardingProtector(battle, target);
  const guardAdjustment: ModeAdjustment | null = guard ? { mode: 'disadvantage', notes: [`${actorLabel(battle, guard)} 用保护风格挡下攻击：攻击检定劣势`] } : null;
  const dodgeAdjustment: ModeAdjustment | null = dodging ? { mode: 'disadvantage', notes: ['目标在使用闪避：攻击检定劣势'] } : null;
  const helpAdjustment: ModeAdjustment | null = helped ? { mode: 'advantage', notes: ['得到协助：攻击检定优势'] } : null;
  const recklessAdjustment: ModeAdjustment | null = combatantOf(attacker).reckless === true ? { mode: 'advantage', notes: ['鲁莽攻击：攻击检定优势'] } : null;
  const recklessTargetAdjustment: ModeAdjustment | null = combatantOf(target).reckless === true ? { mode: 'advantage', notes: ['目标处于鲁莽攻击：攻击检定优势'] } : null;
  const sapAdjustment: ModeAdjustment | null = sapped ? { mode: 'disadvantage', notes: ['被削韧：攻击检定劣势'] } : null;
  const vexAdjustment: ModeAdjustment | null = vexed ? { mode: 'advantage', notes: ['精通·破绽：攻击检定优势'] } : null;
  const obscuredAdjustment: ModeAdjustment | null = battle.obscured === 'heavy' ? { mode: 'disadvantage', notes: ['重度遮蔽：攻击检定劣势'] } : null;
  const hideAdjustment: ModeAdjustment | null = hiddenAttacker ? { mode: 'advantage', notes: ['攻击者处于躲藏：攻击检定优势'] } : null;
  const unseenAdjustment: ModeAdjustment | null = hiddenTarget ? { mode: 'disadvantage', notes: ['目标处于躲藏：攻击检定劣势'] } : null;
  const inFog = (item: Actor) => !!item.position && (battle.fog ?? []).some(cell => cell.x === item.position!.x && cell.y === item.position!.y);
  const attackerFog = inFog(attacker);
  const targetFog = inFog(target);
  const fogAdjustment: ModeAdjustment | null = attackerFog !== targetFog ? { mode: 'disadvantage', notes: ['云雾遮蔽：攻击检定劣势'] } : null;
  const darknessAdjustment: ModeAdjustment | null = inDarkness(battle, attacker.id) !== inDarkness(battle, target.id) ? { mode: 'disadvantage', notes: ['魔法黑暗：看不清目标'] } : null;
  const weatherAdjustment: ModeAdjustment | null = battle.weather && context.range === 'ranged' ? { mode: 'disadvantage', notes: [battle.weather === 'rain' ? '暴雨：远程攻击检定劣势' : '强风：远程攻击检定劣势'] } : null;
  const invisibleAdjustment: ModeAdjustment | null = invisibleAttacker ? { mode: 'advantage', notes: ['攻击者处于隐形：攻击检定优势'] } : invisibleTarget ? { mode: 'disadvantage', notes: ['目标处于隐形：攻击检定劣势'] } : null;
  const aimAdjustment: ModeAdjustment | null = combatantOf(attacker).aimed === true && context.range === 'ranged' ? { mode: 'advantage', notes: ['瞄准：远程攻击检定优势'] } : null;
  const suppressedAdjustment: ModeAdjustment | null = combatantOf(attacker).suppressed === true ? { mode: 'disadvantage', notes: ['被压制：攻击检定劣势'] } : null;
  const combined = combineAttackModes(options.mode ?? 'normal', [attackerAdjustment(attacker), targetAdjustment(target, context.range), ...(heavy ? [heavy] : []), ...(far ? [far] : []), ...(underwaterAdjustment ? [underwaterAdjustment] : []), ...(engagedAdjustment ? [engagedAdjustment] : []), ...(elevationAdjustment ? [elevationAdjustment] : []), ...(dodgeAdjustment ? [dodgeAdjustment] : []), ...(guardAdjustment ? [guardAdjustment] : []), ...(helpAdjustment ? [helpAdjustment] : []), ...(sapAdjustment ? [sapAdjustment] : []), ...(vexAdjustment ? [vexAdjustment] : []), ...(hideAdjustment ? [hideAdjustment] : []), ...(unseenAdjustment ? [unseenAdjustment] : []), ...(invisibleAdjustment ? [invisibleAdjustment] : []), ...(fogAdjustment ? [fogAdjustment] : []), ...(darknessAdjustment ? [darknessAdjustment] : []), ...(weatherAdjustment ? [weatherAdjustment] : []), ...(frightenedAdjustment ? [frightenedAdjustment] : []),
    ...(poisonAdjustment ? [poisonAdjustment] : []), ...(obscuredAdjustment ? [obscuredAdjustment] : []), ...(recklessAdjustment ? [recklessAdjustment] : []), ...(recklessTargetAdjustment ? [recklessTargetAdjustment] : []), ...(aimAdjustment ? [aimAdjustment] : []), ...(suppressedAdjustment ? [suppressedAdjustment] : [])]);
  if (helped) combatantOf(attacker).helpedAttack = false;
  if (sapped) combatantOf(attacker).sapped = false;
  if (vexed) delete combatantOf(attacker).vexTargetId;
  if (hiddenAttacker) combatantOf(attacker).hidden = false;
  if (aimAdjustment) delete combatantOf(attacker).aimed;
  if (hiddenTarget) combatantOf(target).hidden = false;
  const mode = combined.mode;
  const notes = [...combined.notes];
  const first = rollDie(20, random);
  const second = mode === 'normal' ? first : rollDie(20, random);
  const natural = mode === 'advantage' ? Math.max(first, second) : mode === 'disadvantage' ? Math.min(first, second) : first;
  const archery = archeryBonus(attacker, options, context.range);
  if (archery > 0) notes.push('射术：远程攻击检定 +2');
  const blessDie = combatantOf(attacker).blessed ? rollDie(4, random) : 0;
  if (blessDie) notes.push(`祝福：攻击检定 +${blessDie}`);
  const total = natural + options.attackBonus + archery + blessDie - (options.powerAttack ? 5 : 0) - exhaustionPenalty(attacker);
  const blocker = context.range === 'ranged' && options.sharpshooter !== true ? creatureCover(battle, attacker.id, target.id) : null;
const baseAc = (combatantOf(target).polymorphed ? 10 : target.template.armorClass) + (context.cover ? coverAcBonus(context.cover) : 0) + (blocker ? 2 : 0) + auraBonus(battle, target.id, 'ac') + (combatantOf(target).dualWielder ? 1 : 0) + (combatantOf(target).parryBonus ?? 0) + (combatantOf(target).shield ?? 0) + (combatantOf(target).hasted ? 2 : 0) - (combatantOf(target).slowed ? 2 : 0) + defenseBonus(target);
  const targetAc = combatantOf(target).barkskin ? Math.max(baseAc, BARKSKIN_AC) : baseAc;
  if (guard) delete combatantOf(guard).guarding;
  const hit = !underwaterMiss && (natural === 20 || (natural !== 1 && total >= targetAc));
  if (underwaterMiss) notes.push('水下：远程攻击超出常规射程，自动失手');
  const automaticCritical = hit && isAutomaticCritical(target, context.range, context.distanceFt);
  const critical = hit && (natural >= context.criticalRange || automaticCritical);
  if (automaticCritical) notes.push('目标麻痹或昏迷且在 5 尺内：命中即重击');
  const nonLethalHit = options.nonLethal === true && context.range === 'melee';
  let damage = 0;
  let tempAbsorbed = 0;
  let status: CombatStatus = combatantOf(target).status;
  let defense = '';
  let concentration = '';
  let extraDamage = 0;
  let extraNote = '';
  let sneakNote = '';
  let masteryNote = '';
  const damageExpression = effectiveDamageExpression(attacker, options);
  const weaponSource = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
  if (hit) {
    const gwf = greatWeaponFighting(attacker, options);
    if (gwf) notes.push('巨武器战斗：1 或 2 点伤害骰重掷一次');
    const rolled = gwf ? rollGreatWeaponDamage(damageExpression, random, critical) : rollDamage(damageExpression, random, critical);
    const defenseResult = defenseOf(target, options.damageType);
    const terrainResult = terrainDefense(battle, options.damageType);
    defense = [defenseResult.label, terrainResult.label].filter(Boolean).join('，');
    const dueling = duelingBonus(attacker, options);
    if (dueling > 0) notes.push('对决：单手近战伤害 +2');
    const result = applyDamageToActor(target, rolled.total + (options.powerAttack ? 10 : 0) + dueling, options.damageType, battle, {}, { nonLethal: nonLethalHit });
    damage = result.damage;
    tempAbsorbed = result.tempAbsorbed;
    status = result.status;
    if (options.extraDamageExpression && options.extraDamageType) {
      const extraRoll = rollDamage(options.extraDamageExpression, random, critical && options.extraDamageCritical !== false);
      const extraDefense = defenseOf(target, options.extraDamageType);
      const extraResult = applyDamageToActor(target, extraRoll.total, options.extraDamageType, battle, {}, { nonLethal: nonLethalHit });
      extraDamage = extraResult.damage;
      damage += extraDamage;
      tempAbsorbed += extraResult.tempAbsorbed;
      status = extraResult.status;
      extraNote = `额外 ${extraRoll.total} 点${options.extraDamageType}伤害${extraDefense.label ? `（${extraDefense.label}）` : ''}`;
    }
    const sneakDice = sneakAttackDice(attacker);
    const targetPosition = target.position;
    const allyAdjacent = !!targetPosition && battle.actors.some(item => item.id !== attacker.id && item.id !== target.id
      && item.side !== target.side && item.side !== '中立' && item.combat?.status === 'active' && !!item.position
      && cellDistance(item.position, targetPosition) <= 1);
    if (sneakDice > 0 && combatantOf(attacker).sneakUsed !== true && (mode === 'advantage' || allyAdjacent)) {
      const sneakRoll = rollDamage(`${sneakDice}d6`, random, critical);
      const sneakResult = applyDamageToActor(target, sneakRoll.total, options.damageType, battle, {}, { nonLethal: nonLethalHit });
      damage += sneakResult.damage;
      tempAbsorbed += sneakResult.tempAbsorbed;
      status = sneakResult.status;
      combatantOf(attacker).sneakUsed = true;
      sneakNote = `偷袭 ${sneakRoll.total} 点${options.damageType}伤害（${sneakDice}d6${critical ? '，重击翻倍' : ''}）`;
    }
    if (status === 'active' && state.sentinel === true) sentinelSlowdown(target, weaponSource);
    concentration = concentrationCheck(battle, target, damage, random, deps)?.text ?? '';
    const mastery = weaponSource?.mastery;
    if (mastery && (combatantOf(target).status === 'active' || mastery === '顺劈')) {
      const targetState = combatantOf(target);
      if (mastery === '迟滞') {
        targetState.speedPenaltyFt = Math.min(50, (targetState.speedPenaltyFt ?? 0) + 10);
        targetState.slowSourceId = attacker.id;
        masteryNote = '精通·迟滞：目标速度 -10 尺，直到它的回合开始';
      } else if (mastery === '削韧') {
        targetState.sapped = true;
        masteryNote = '精通·削韧：目标下一次攻击检定劣势';
      } else if (mastery === '破绽') {
        state.vexTargetId = target.id;
        masteryNote = '精通·破绽：攻击者对目标的下一次攻击检定优势';
      } else if (mastery === '顺劈') {
        const targetPosition = target.position;
        if (!battle.grid || !targetPosition) {
          masteryNote = '精通·顺劈：未启用方格，无法判定邻近目标';
        } else {
          const neighbor = battle.actors.find(item => item.id !== target.id && item.id !== attacker.id
            && item.combat?.status === 'active' && item.side !== attacker.side && item.side !== '中立'
            && item.position !== undefined && cellDistance(targetPosition, item.position) <= 1);
          const abilities = attacker.characterSnapshot?.sheet.abilities ?? attacker.template.abilities ?? { str: 10 };
          const splash = Math.max(0, abilityModifier(abilities.str ?? 10));
          if (!neighbor) {
            masteryNote = '精通·顺劈：5 尺内没有其他敌对单位';
          } else if (splash > 0) {
            const result = applyDamageToActor(neighbor, splash, options.damageType, battle);
            masteryNote = `精通·顺劈：邻近的 ${actorLabel(battle, neighbor)} 受到 ${result.damage} 点${options.damageType}伤害`;
          } else {
            masteryNote = '精通·顺劈：力量调整值不足以造成额外伤害';
          }
        }
      } else if (mastery === '倾覆') {
        const abilities = attacker.characterSnapshot?.sheet.abilities ?? attacker.template.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const level = attacker.characterSnapshot?.sheet.level;
        const proficiency = level === undefined ? (attacker.template.proficiencyBonus ?? 2) : proficiencyBonus(level);
        const dc = 8 + proficiency + abilityModifier(abilities.str ?? 10);
        const save = resolveSave(target, { actorId: target.id, ability: 'con', dc, bonus: defaultSaveBonus(target, 'con') }, random);
        if (save.success) {
          masteryNote = `精通·倾覆：目标体质豁免成功（DC ${dc}）`;
        } else {
          targetState.conditions.push('倒地');
          masteryNote = `精通·倾覆：目标体质豁免失败（DC ${dc}），倒地`;
        }
      } else if (mastery === '推撞' && battle.grid && attacker.position && target.position) {
        const dx = Math.sign(target.position.x - attacker.position.x);
        const dy = Math.sign(target.position.y - attacker.position.y);
        const cell = { x: target.position.x + dx, y: target.position.y + dy };
        const blocked = cell.x < 0 || cell.y < 0 || cell.x >= battle.grid.width || cell.y >= battle.grid.height
          || isWallCell(battle, cell.x, cell.y)
          || battle.actors.some(item => item.id !== target.id && item.position?.x === cell.x && item.position?.y === cell.y);
        if (blocked) {
          masteryNote = '精通·推撞：目标无法被推开（边界、墙体或占用）';
        } else {
          target.position = cell;
          masteryNote = `精通·推撞：目标被推到 (${cell.x}, ${cell.y})`;
        }
      } else if (mastery === '推撞') {
        masteryNote = '精通·推撞：未启用方格，需手动移动目标 5 尺';
      }
    }
  }
  if (!hit && weaponSource?.mastery === '擦伤' && combatantOf(target).status === 'active') {
    const abilities = attacker.characterSnapshot?.sheet.abilities ?? attacker.template.abilities ?? { str: 10 };
    const graze = Math.max(0, abilityModifier(abilities.str ?? 10));
    if (graze > 0) {
      const result = applyDamageToActor(target, graze, options.damageType, battle);
      damage = result.damage;
      tempAbsorbed = result.tempAbsorbed;
      status = result.status;
      masteryNote = `精通·擦伤：未命中仍造成 ${damage} 点${options.damageType}伤害`;
    }
  }
  if (consumeCost) {
    if (context.cost === 'action') state.actionUsed = true;
    if (context.cost === 'bonus') state.bonusUsed = true;
    if (context.cost === 'reaction') state.reactionUsed = true;
  }
  const rollText = mode === 'normal' ? `d20(${natural})` : `${mode === 'advantage' ? '优势' : '劣势'} d20(${first},${second})→${natural}`;
  const damageText = hit ? `${damage} 点${options.damageType}伤害` : damage > 0 ? `${damage} 点${options.damageType}伤害（擦伤）` : '未造成伤害';
  const detail = [
    `${actorLabel(battle, attacker)} → ${actorLabel(battle, target)}`,
    `攻击检定 ${rollText}${options.attackBonus >= 0 ? '+' : ''}${options.attackBonus} = ${total} vs AC ${targetAc}`,
    context.measured ? `方格距离 ${context.distanceFt} 尺` : '',
    context.cover ? coverNote(context.cover) : '',
    blocker ? `生物掩体：${actorLabel(battle, blocker)} 挡在中间（AC +2）` : '',
    auraBonus(battle, target.id, 'ac') ? `灵光 AC +${auraBonus(battle, target.id, 'ac')}` : '',
    hit ? (critical ? '重击' : '命中') : (natural === 1 ? '大失败' : '未命中'),
    damageText,
    options.twoHanded && damageExpression !== options.damageExpression ? `双手持用：${damageExpression}` : '',
    options.powerAttack ? '强力攻击：攻击检定 -5，伤害 +10' : '',
    options.sharpshooter ? '神射手：忽略掩体与远程射程劣势' : '',
    nonLethalHit ? '非致命：命中后使目标昏迷而非死亡' : '',
    extraNote,
    sneakNote,
    masteryNote,
    defense,
    `目标剩余 ${target.currentHp}/${target.maxHp}`,
    tempAbsorbed ? `临时生命吸收 ${tempAbsorbed}` : '',
    targetWasDown && damage > tempAbsorbed ? '倒地受击：死亡豁免失败 +1（是否重击按距离人工裁定）' : '',
    status === 'down' ? '目标倒地' : status === 'dead' ? '目标死亡' : '',
    concentration,
    notes.join('；'),
  ].filter(Boolean).join(' · ');
  const sentinel = battle.actors.find(item =>
    item.id !== attacker.id &&
    item.id !== target.id &&
    item.combat?.status === 'active' &&
    item.combat?.sentinel === true &&
    item.side !== attacker.side &&
    item.side !== '中立' &&
    !!item.position && !!attacker.position &&
    cellDistance(item.position, attacker.position!) <= 1 &&
    item.combat.reactionUsed !== true);
  if (sentinel && options.cost !== 'reaction' && battle.combat) {
    const pending = battle.combat.pendingOpportunity ?? [];
    if (!pending.some(entry => entry.reactorId === sentinel.id && entry.targetId === attacker.id)) {
      battle.combat.pendingOpportunity = [...pending, { reactorId: sentinel.id, targetId: attacker.id }].slice(-8);
      addLog(battle, `${actorLabel(battle, sentinel)} 用哨兵专长盯住 ${actorLabel(battle, attacker)}（可花反应攻击）。`, deps);
    }
  }
  addLog(battle, `${actorLabel(battle, attacker)} 攻击 ${actorLabel(battle, target)}：${hit ? `命中，造成 ${damage} 点伤害${extraDamage > 0 ? `（含额外 ${extraDamage} 点${options.extraDamageType}伤害）` : ''}` : '未命中'}。`, deps, detail);
  const attackStats = statsOf(combatantOf(attacker));
  attackStats.attacks += 1;
  if (hit) {
    attackStats.hits += 1;
    if (critical) attackStats.crits += 1;
  } else {
    attackStats.misses += 1;
  }
  attackStats.damageDealt += damage;
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
  const requested = options.attacks ?? 1;
  if (!Number.isInteger(requested) || requested < 1) throw new Error('攻击次数须为正整数。');
  const targetIds = options.targets && options.targets.length > 0 ? options.targets : [options.targetId];
  if (new Set(targetIds).size !== targetIds.length) throw new Error('连续攻击的目标不能重复。');
  if (targetIds.some(item => item === options.attackerId)) throw new Error('不能攻击自己。');
  const contexts = targetIds.map(targetId => ({ targetId, context: validateAttackOptions(next, { ...options, targetId }) }));
  const limit = attacksPerAction(contexts[0].context.attacker);
  if (requested > limit) throw new Error(`该单位一次攻击动作最多攻击 ${limit} 次。`);
  if (requested > 1 && contexts[0].context.cost !== 'action') throw new Error('只有使用动作的攻击才能连续攻击多个目标。');
  const outcomes: AttackOutcome[] = [];
  for (let index = 0; index < requested; index++) {
    const alive = contexts.filter(item => actorOf(next, item.targetId).combat?.status !== 'dead');
    if (alive.length === 0) break;
    const pick = alive[index % alive.length];
    outcomes.push(resolveOneAttack(next, { ...options, targetId: pick.targetId }, pick.context, deps, index === 0));
  }
  const attacker = actorOf(next, options.attackerId);
  const names = targetIds.map(id => actorLabel(next, actorOf(next, id))).join('、');
  addLog(next, `${actorLabel(next, attacker)} 对 ${names} 完成攻击动作：${outcomes.length} 次攻击，命中 ${outcomes.filter(item => item.hit).length} 次。`, deps,
    outcomes.map((item, index) => `第 ${index + 1} 击：${item.hit ? `${item.critical ? '重击' : '命中'} ${item.damage} 点` : '未命中'}（d20 ${item.natural} vs AC ${item.targetAc}）`).join(' · '));
  return { battle: next, outcomes };
}

function lightProperty(source: AttackSource): boolean {
  return source.properties?.includes('轻型') === true;
}

function offhandDamageExpression(source: AttackSource): string {
  return source.damageExpression.replace(/\s*([+-])\s*(\d+)\s*$/, (_match: string, sign: string, value: string) => (sign === '-' ? `-${value}` : ''));
}

function fightingStylesOf(actor: Actor): string[] {
  const details = actor.characterSnapshot?.sheet?.details as { fighterCalculator?: { fightingStyle?: string; fightingStyles?: string[] }; fightingStyle?: string; fightingStyles?: string[] } | undefined;
  const config = details?.fighterCalculator ?? details;
  if (!config) return [];
  const list = Array.isArray(config.fightingStyles) ? [...config.fightingStyles] : [];
  if (config.fightingStyle && !list.includes(config.fightingStyle)) list.push(config.fightingStyle);
  return list;
}

/** 射术：远程武器攻击检定 +2。 */
function archeryBonus(actor: Actor, options: AttackOptions, range: AttackRange): number {
  if (range !== 'ranged') return 0;
  if (!fightingStylesOf(actor).includes('射术')) return 0;
  const source = options.weaponId ? attackSources(actor).find(item => item.id === options.weaponId) : undefined;
  return source && source.range === 'ranged' ? 2 : 0;
}

/** 对决：单手持用近战武器且未双手持用时伤害 +2。 */
function duelingBonus(actor: Actor, options: AttackOptions): number {
  if (!fightingStylesOf(actor).includes('对决')) return 0;
  if (options.twoHanded === true) return 0;
  const source = options.weaponId ? attackSources(actor).find(item => item.id === options.weaponId) : undefined;
  if (!source || source.range !== 'melee') return 0;
  if (source.properties?.includes('双手')) return 0;
  return 2;
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
  if (!state.actionUsed) throw new Error('副手攻击需要在用动作攻击之后进行。');
  const source = options.weaponId ? attackSources(attacker).find(item => item.id === options.weaponId) : undefined;
  if (!source) throw new Error('请选择副手武器。');
  if (!lightProperty(source) && state.dualWielder !== true) throw new Error('只有轻型武器可以进行副手攻击。');
  const style = hasTwoWeaponFighting(attacker);
  const nick = options.nick === true;
  if (nick) {
    if (source.mastery !== '迅击') throw new Error('该武器没有迅击精通，无法把副手攻击并入攻击动作。');
    if (state.nickUsed === true) throw new Error('本回合已经使用过迅击。');
  } else if (state.bonusUsed) {
    throw new Error('该单位本回合已经使用过附赠动作。');
  }
  const offhandOptions: AttackOptions = { ...options, nick: undefined, weaponId: source.id, damageExpression: style ? source.damageExpression : offhandDamageExpression(source), cost: 'bonus', range: source.range, ...(nick ? { ignoreCostCheck: true } : {}) };
  const context = validateAttackOptions(next, offhandOptions);
  const outcome = resolveOneAttack(next, offhandOptions, context, deps, !nick);
  if (nick) state.nickUsed = true;
  addLog(next, nick
    ? `${actorLabel(next, attacker)} 用副手武器「${source.label}」以迅击并入攻击动作（不消耗附赠动作）。`
    : style
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

export type CheckOptions = { actorId: string; ability: Ability; skill?: string; dc: number; bonus?: number; mode?: AttackMode };
export type CheckOutcome = { natural: number; total: number; dc: number; success: boolean; mode: AttackMode; notes: string[] };

function checkAdjustment(actor: Actor, ability: Ability): ModeAdjustment | null {
  const conditions = combatantOf(actor).conditions;
  const notes: string[] = [];
  if (conditions.includes('中毒')) notes.push('中毒：属性检定劣势');
  if (conditions.includes('恐慌')) notes.push('恐慌：属性检定劣势');
  if (ability === 'dex' && (conditions.includes('束缚') || conditions.includes('目盲'))) notes.push('敏捷检定劣势');
  return notes.length ? { mode: 'disadvantage', notes } : null;
}

/** 通用属性检定：可指定技能（用于熟练加值）与 DC。 */
/** 观察目标：消耗动作做一次智力（调查）检定，成功后在日志里列出它的防护与状态。 */
export function studyTarget(battle: Battle, actorId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; success: boolean } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const target = actorOf(next, targetId);
  if (actorId === targetId) throw new Error('不能观察自己。');
  if (combatantOf(actor).status !== 'active') throw new Error('只有在场的单位可以观察。');
  if (combatantOf(target).status === 'dead') throw new Error('无法观察已经死亡的单位。');
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以观察。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (combatantOf(actor).actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const bonus = abilityCheckBonus(actor, 'int', '调查') - exhaustionPenalty(actor);
  const random = randomOf(deps);
  const natural = rollDie(20, random);
  const total = natural + bonus;
  const success = natural === 20 ? true : natural === 1 ? false : total >= 10;
  combatantOf(actor).actionUsed = true;
  if (!success) {
    addLog(next, `${actorLabel(next, actor)} 观察 ${actorLabel(next, target)} 失败（调查 DC 10）。`, deps, `d20(${natural}) + ${bonus} = ${total}`);
    return { battle: next, success };
  }
  combatantOf(target).revealed = true;
  const template = target.template;
  const parts = [`AC ${template.armorClass}`, `HP ${target.currentHp}/${target.maxHp}`];
  if (template.damageResistances?.length) parts.push(`抗性：${template.damageResistances.join('、')}`);
  if (template.damageImmunities?.length) parts.push(`免疫：${template.damageImmunities.join('、')}`);
  if (template.damageVulnerabilities?.length) parts.push(`易伤：${template.damageVulnerabilities.join('、')}`);
  if (combatantOf(target).conditions.length) parts.push(`状态：${combatantOf(target).conditions.join('、')}`);
  addLog(next, `${actorLabel(next, actor)} 观察 ${actorLabel(next, target)} 成功（调查 DC 10）。`, deps, parts.join(' · '));
  return { battle: next, success };
}

export function abilityCheck(battle: Battle, options: CheckOptions, deps: CombatDeps = {}): { battle: Battle; outcome: CheckOutcome } {
  if (!Number.isInteger(options.dc) || options.dc < 1 || options.dc > 40) throw new Error('DC 须为 1 至 40 的整数。');
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, options.actorId);
  if (combatantOf(actor).status !== 'active') throw new Error('只有在场的单位可以进行检定。');
  const bonus = (options.bonus ?? abilityCheckBonus(actor, options.ability, options.skill ?? '')) - exhaustionPenalty(actor);
  const adjustment = checkAdjustment(actor, options.ability);
  const helped = combatantOf(actor).helpedCheck === true;
  const helpAdjustment = helped ? { mode: 'advantage' as const, notes: ['得到协助：属性检定优势'] } : null;
  const combined = combineAttackModes(options.mode ?? 'normal', [...(adjustment ? [adjustment] : []), ...(helpAdjustment ? [helpAdjustment] : [])]);
  const random = randomOf(deps);
  let natural = rollDie(20, random);
  if (combined.mode === 'advantage') natural = Math.max(natural, rollDie(20, random));
  if (combined.mode === 'disadvantage') natural = Math.min(natural, rollDie(20, random));
  const total = natural + bonus;
  if (helped) delete combatantOf(actor).helpedCheck;
  const success = natural === 20 ? true : natural === 1 ? false : total >= options.dc;
  const label = options.skill ? `${saveNames[options.ability]}（${options.skill}）` : saveNames[options.ability];
  addLog(
    next,
    `${actorLabel(next, actor)} 的${label}检定${success ? '成功' : '失败'}（DC ${options.dc}）。`,
    deps,
    `d20(${natural}) + ${bonus} = ${total} · ${success ? '成功' : '失败'}${combined.notes.length ? ` · ${combined.notes.join('；')}` : ''}`,
  );
  return { battle: next, outcome: { natural, total, dc: options.dc, success, mode: combined.mode, notes: combined.notes } };
}

function contestRoll(bonus: number, random: Random): { natural: number; total: number } {
  const natural = 1 + Math.floor(random() * 20);
  return { natural, total: natural + bonus };
}

/**
 * 属性检定掷骰：处于「中毒」的单位带劣势（掷两次取低），返回实际取值与两次原始点数。
 */
function poisonedCheckRoll(battle: Battle, actorId: string, bonus: number, random: Random): { natural: number; total: number; notes: string | null } {
  const poisoned = battle.actors.find(item => item.id === actorId)?.combat?.conditions.includes('中毒') ?? false;
  const first = 1 + Math.floor(random() * 20);
  if (!poisoned) return { natural: first, total: first + bonus, notes: null };
  const second = 1 + Math.floor(random() * 20);
  const natural = Math.min(first, second);
  return { natural, total: natural + bonus, notes: `中毒：属性检定劣势（${first}/${second} 取 ${natural}）` };
}

function grappleContest(next: Battle, attacker: Actor, target: Actor, deps: CombatDeps): ContestOutcome {
  const random = deps.random ?? Math.random;
  const attackerBonus = abilityCheckBonus(attacker, 'str', '运动');
  const targetStrength = abilityCheckBonus(target, 'str', '运动');
  const targetDexterity = abilityCheckBonus(target, 'dex', '体操');
  const targetBonus = Math.max(targetStrength, targetDexterity);
  const attackerRoll = poisonedCheckRoll(next, attacker.id, attackerBonus, random);
  const targetRoll = poisonedCheckRoll(next, target.id, targetBonus, random);
  const success = attackerRoll.total > targetRoll.total;
  addLog(next, success
    ? `${actorLabel(next, attacker)} 擒抱或推撞 ${actorLabel(next, target)} 成功（${attackerRoll.natural}+${attackerBonus} 对 ${targetRoll.natural}+${targetBonus}）。`
    : `${actorLabel(next, attacker)} 擒抱或推撞 ${actorLabel(next, target)} 失败（${attackerRoll.natural}+${attackerBonus} 对 ${targetRoll.natural}+${targetBonus}）。`, deps,
    `力量（运动）对抗目标的力量（运动）或敏捷（体操）：${attackerRoll.total} 对 ${targetRoll.total}`);
  const poisonNotes = [attackerRoll.notes, targetRoll.notes].filter((note): note is string => note !== null);
  if (poisonNotes.length) addLog(next, `${actorLabel(next, attacker)} 或 ${actorLabel(next, target)} 受中毒影响，${poisonNotes.join('；')}。`, deps);
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
    target.combat.grappledBy = attacker.id;
  }
    if (target.combat?.flying === true && (target.elevation ?? 0) >= 10) {
      const feet = target.elevation ?? 0;
      const fall = applyFallDamage(next, target.id, feet, deps);
      const dropped = actorOf(fall.battle, target.id);
      if (dropped.combat) dropped.combat.flying = false;
      delete dropped.elevation;
      addLog(fall.battle, `${actorLabel(fall.battle, dropped)} 被擒抱，失去飞行并从 ${feet} 尺坠落。`, deps);
      return { battle: fall.battle, outcome };
    }
  return { battle: next, outcome };
}

export function escapeGrapple(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; outcome: ContestOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以挣脱擒抱。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  const state = combatantOf(actor);
  if (!state.conditions.includes('擒抱')) throw new Error('该单位没有被擒抱。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const grappler = state.grappledBy ? next.actors.find(item => item.id === state.grappledBy) : undefined;
  const grapplerLevel = grappler?.characterSnapshot?.sheet?.level ?? 1;
  const grapplerAbilities = grappler?.characterSnapshot?.sheet?.abilities ?? grappler?.template.abilities;
  const dc = grappler ? 8 + abilityModifier(grapplerAbilities?.str ?? 10) + proficiencyBonus(grapplerLevel) : 10;
  const random = deps.random ?? Math.random;
  const bonus = Math.max(abilityCheckBonus(actor, 'str', '运动'), abilityCheckBonus(actor, 'dex', '体操'));
  const escapeRoll = poisonedCheckRoll(next, actorId, bonus, random);
  const natural = escapeRoll.natural;
  const total = escapeRoll.total;
  const success = natural === 20 || (natural !== 1 && total >= dc);
  state.actionUsed = true;
  if (success) {
    state.conditions = state.conditions.filter(condition => condition !== '擒抱');
    delete state.grappledBy;
  }
  addLog(next, success
    ? `${actorLabel(next, actor)} 挣脱了擒抱（d20 ${natural}+${bonus}=${total} 对 DC ${dc}）。${escapeRoll.notes ? `（${escapeRoll.notes}）` : ''}`
    : `${actorLabel(next, actor)} 未能挣脱擒抱（d20 ${natural}+${bonus}=${total} 对 DC ${dc}）。${escapeRoll.notes ? `（${escapeRoll.notes}）` : ''}`,
    deps,
    '力量（运动）或敏捷（体操）检定对抗擒抱者的力量豁免 DC');
  return { battle: next, outcome: { attackerTotal: total, targetTotal: dc, attackerNatural: natural, targetNatural: 0, success } };
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
  if (greaseAt(next, toX, toY)) greaseFall(next, target, deps);
  applyHazardAt(next, target, toX, toY, deps);
  applyLavaAt(next, target, deps);
  applyBrambles(next, target, 5, deps);
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
/** 使用治疗药水：消耗动作，恢复 2d4+2 点生命值，可唤醒倒地单位，对死亡单位无效。 */
export function drinkHealingPotion(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; healed: number } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以使用治疗药水。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('已经死亡的单位无法使用治疗药水。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const random = randomOf(deps);
  const rolled = rollDie(4, random) + rollDie(4, random) + 2;
  const healed = Math.min(actor.maxHp - actor.currentHp, rolled);
  actor.currentHp += healed;
  if (state.status === 'down' && actor.currentHp > 0) {
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
  }
  state.actionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 饮下治疗药水，恢复 ${healed} 点生命值（2d4+2 掷出 ${rolled}），当前 ${actor.currentHp}/${actor.maxHp}。`, deps);
  return { battle: next, healed };
}
/** 投掷物：圣水与炽火胶。 */
export type FlaskKind = 'holy-water' | 'alchemists-fire';
const FLASK_RULES: Record<FlaskKind, { item: string; damage: string; damageType: DamageType; ongoing: boolean }> = {
  'holy-water': { item: '圣水', damage: '2d6', damageType: '光耀', ongoing: false },
  'alchemists-fire': { item: '炽火胶', damage: '1d4', damageType: '火焰', ongoing: true },
};
const FLASK_RANGE_FT = 20;
const FLASK_ONGOING_DC = 10;

/**
 * 投掷圣水或炽火胶：消耗动作与背包里的一件物品，20 尺内做一次远程攻击。
 * 圣水命中造成 2d6 光耀伤害；炽火胶命中造成 1d4 火焰伤害，并附加受敏捷豁免 DC 10 终止的持续火焰伤害。
 */
export function throwFlask(battle: Battle, actorId: string, targetId: string, kind: FlaskKind, deps: CombatDeps = {}): {
  battle: Battle;
  outcome: { hit: boolean; natural: number; total: number; targetAc: number; damage: number; ongoing: boolean };
} {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const rule = FLASK_RULES[kind];
  if (!rule) throw new Error('未知的投掷物。');
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('已经死亡的单位无法投掷物品。');
  const blocker = actionBlocker(actor);
  if (blocker) throw new Error(blocker);
  if (currentActorId(next) !== actorId) throw new Error('只有当前回合的单位可以投掷物品。');
  if (state.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  const target = actorOf(next, targetId);
  if (target.combat?.status === 'dead') throw new Error('无法以已经死亡的单位为目标。');
  const distance = actorDistance(next, actorId, targetId);
  if (distance !== undefined && distance > FLASK_RANGE_FT) throw new Error(`投掷距离超出 ${FLASK_RANGE_FT} 尺。`);
  const items = state.items ?? [];
  const index = items.findIndex(item => item.name === rule.item && item.quantity > 0);
  if (index < 0) throw new Error(`背包里没有${rule.item}。`);
  const picked = items[index];
  if (picked.quantity > 1) picked.quantity -= 1;
  else items.splice(index, 1);

  const random = randomOf(deps);
  const natural = rollDie(20, random);
  const bonus = actorAttackProfile(actor).attackBonus;
  const total = natural + bonus;
  const baseAc = target.template.armorClass + auraBonus(next, target.id, 'ac') + (combatantOf(target).dualWielder ? 1 : 0) + (combatantOf(target).parryBonus ?? 0) + (combatantOf(target).shield ?? 0) + (combatantOf(target).hasted ? 2 : 0) - (combatantOf(target).slowed ? 2 : 0) + defenseBonus(target);
  const targetAc = combatantOf(target).barkskin ? Math.max(baseAc, BARKSKIN_AC) : baseAc;
  const hit = natural === 20 || (natural !== 1 && total >= targetAc);
  let damage = 0;
  if (hit) {
    damage = rollDamage(rule.damage, random).total;
    applyDamageToActor(target, damage, rule.damageType, next, deps);
  }
  let ongoing = false;
  if (hit && rule.ongoing) {
    const targetState = combatantOf(target);
    targetState.ongoing = [...(targetState.ongoing ?? []), { id: makeIdOf(deps)(), name: rule.item, damageExpression: '1d4', damageType: '火焰', saveEnds: { ability: 'dex', dc: FLASK_ONGOING_DC }, timing: 'start' }];
    ongoing = true;
    addLog(next, `${actorLabel(next, target)} 被炽火胶点燃，每回合开始受到 1d4 点火焰伤害（敏捷豁免 DC ${FLASK_ONGOING_DC} 终止）。`, deps);
  }
  state.actionUsed = true;
  addLog(next, `${actorLabel(next, actor)} 向 ${actorLabel(next, target)} 投掷${rule.item}：攻击检定 ${natural}${bonus >= 0 ? '+' : ''}${bonus} = ${total} vs AC ${targetAc}，${hit ? `命中造成 ${damage} 点${rule.damageType}伤害` : '未命中'}。`, deps);
  return { battle: next, outcome: { hit, natural, total, targetAc, damage, ongoing } };
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

/** 长休：恢复职业资源、弹药与法术位，并清除专注与每回合状态。 */
export function takeLongRest(battle: Battle, deps: CombatDeps = {}): Battle {
  let next = recoverClassResources(battle, deps);
  for (const actor of next.actors) {
    const aidBonus = actor.combat?.aided ?? 0;
    if (aidBonus > 0) {
      actor.maxHp = Math.max(1, actor.maxHp - aidBonus);
      actor.currentHp = Math.min(actor.currentHp, actor.maxHp);
    }
  }
  for (const actor of next.actors) {
    if (!actor.combat) continue;
    delete actor.combat.aided;
    delete actor.combat.barkskin;
    delete actor.combat.barkskinBy;
    actor.combat.nickUsed = false;
    actor.combat.sneakUsed = false;
    actor.combat.dodging = false;
    actor.combat.reckless = false;
    actor.combat.hidden = false;
    actor.combat.sapped = false;
    delete actor.combat.sleeping;
    delete actor.combat.entangled;
  delete actor.combat.paralyzed;
  delete actor.combat.paralyzedBy;
    delete actor.combat.suppressed;
    delete actor.combat.commanded;
    delete actor.combat.polymorphed;
    delete actor.combat.polymorphedBy;
    delete actor.combat.vexTargetId;
    delete actor.combat.helpedAttack;
    delete actor.combat.ready;
    delete actor.combat.concentration;
    delete actor.combat.blessed;
    delete actor.combat.blessedBy;
    delete actor.combat.hasted;
    delete actor.combat.hastedBy;
    delete actor.combat.slowed;
    delete actor.combat.slowedBy;
    delete actor.combat.charmed;
    delete actor.combat.charmedBy;
    delete actor.combat.frightened;
    delete actor.combat.blinded;
    delete actor.combat.blindedBy;
    delete actor.combat.frightenedBy;
    delete actor.combat.surprised;
    delete actor.combat.poisoned;
    actor.combat.conditions = actor.combat.conditions.filter(condition => condition !== '中毒');
    delete actor.combat.invisible;
    delete actor.combat.invisibleBy;
    delete actor.combat.shield;
    delete actor.combat.speedPenaltyFt;
    delete actor.combat.slowSourceId;
    delete actor.combat.ammo;
    delete actor.combat.stable;
    actor.combat.tempHp = 0;
    actor.combat.delayed = false;
    if (actor.combat.spellSlotsMax) actor.combat.spellSlots = actor.combat.spellSlotsMax.slice();
    if (actor.combat.status !== 'dead') {
      const wasDown = actor.combat.status === 'down';
      actor.currentHp = actor.maxHp;
      actor.combat.status = 'active';
      actor.combat.deathSaves = { successes: 0, failures: 0 };
      if (wasDown) actor.combat.conditions = actor.combat.conditions.filter(condition => condition !== '倒地');
    }
    if (actor.combat.exhaustion) {
      const reduced = actor.combat.exhaustion - 1;
      if (reduced <= 0) delete actor.combat.exhaustion;
      else actor.combat.exhaustion = reduced;
    }
  }
  delete next.fog;
  delete next.fogBy;
  delete next.darkness;
  delete next.darknessBy;
  delete next.cover;
  delete next.silence;
  delete next.silenceBy;
  delete next.sleepCloud;
  delete next.sleepCloudBy;
  delete next.entangle;
  delete next.entangleBy;
  addLog(next, '长休：恢复全部生命值，法术位、动作如潮、回气与弹药全部恢复，力竭减 1，专注与每回合状态清除。', deps);
  return next;
}

export type SaveOptions = { actorId: string; ability: Ability; dc: number; bonus?: number; mode?: AttackMode; /** 掩体：仅对敏捷豁免提供 +2／+5。 */ cover?: CoverType };
export type SaveOutcome = { natural: number; total: number; dc: number; success: boolean; mode: AttackMode; notes: string[]; automaticFailure: boolean; bless?: number };
export type AreaSaveOptions = {
  targetIds: string[];
  ability: Ability;
  dc: number;
  damageExpression: string;
  damageType: DamageType;
  /** 每个目标各自的掩体（仅对敏捷豁免生效）。 */
  covers?: Record<string, CoverType>;
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
  const bless = actor.combat?.blessed ? rollDie(4, random) : 0;
  const bonus = (options.bonus ?? defaultSaveBonus(actor, options.ability)) + bless;
  const automaticFailure = (options.ability === 'str' || options.ability === 'dex') && ['麻痹', '昏迷', '石化'].some(condition => conditions.includes(condition));
  const adjustments: ModeAdjustment[] = [];
  if (options.ability === 'dex' && conditions.includes('束缚')) adjustments.push({ mode: 'disadvantage', notes: ['目标束缚：敏捷豁免劣势'] });
  if (options.ability === 'dex' && (actor.combat?.hasted ?? 0) > 0) adjustments.push({ mode: 'advantage', notes: ['加速术：敏捷豁免优势'] });
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
  const notes = bless ? [...combined.notes, `祝福：豁免 +${bless}`] : combined.notes;
  return { natural, total, dc: options.dc, success, mode, automaticFailure: false, notes, bless };
}

function saveDetail(actor: Actor, battle: Battle, options: SaveOptions, outcome: SaveOutcome): string {
  const bonus = (options.bonus ?? defaultSaveBonus(actor, options.ability)) + (outcome.bless ?? 0);
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
  const auraSave = auraBonus(next, actor.id, 'saves');
  const coverBonus = options.ability === 'dex' && options.cover ? coverAcBonus(options.cover) : 0;
  const withAura = { ...options, bonus: (options.bonus ?? defaultSaveBonus(actor, options.ability) + auraSave) + coverBonus - exhaustionPenalty(actor) };
  const outcome = resolveSave(actor, withAura, randomOf(deps));
  addLog(next, `${actorLabel(next, actor)} 的${saveNames[options.ability]}豁免${outcome.success ? '成功' : '失败'}。`, deps, saveDetail(actor, next, withAura, outcome));
  return { battle: next, outcome };
}

/** 范围效果会波及的自己人：用于界面提示「会误伤队友」。
 */
export function friendlyFireTargets(battle: Battle, actorId: string, targetIds: string[]): Actor[] {
  const source = battle.actors.find(item => item.id === actorId);
  if (!source) return [];
  const wanted = new Set(targetIds);
  return battle.actors.filter(item => wanted.has(item.id) && item.id !== actorId && item.side === source.side && item.side !== '中立');
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
    const targetCover = options.ability === 'dex' ? options.covers?.[targetId] : undefined;
    const targetBonus = (options.bonuses?.[targetId] ?? (defaultSaveBonus(actor, options.ability) + auraBonus(next, targetId, 'saves'))) + (targetCover ? coverAcBonus(targetCover) : 0);
    const save = resolveSave(actor, { actorId: targetId, ability: options.ability, dc: options.dc, bonus: targetBonus, mode: options.mode }, random);
    const evasion = save.success && options.ability === 'dex' && hasEvasion(actor);
    const amount = evasion ? 0 : save.success ? (options.halfOnSuccess === false ? 0 : Math.floor(raw.total / 2)) : raw.total;
    const defense = defenseOf(actor, options.damageType);
    const damage = amount > 0 ? applyDamageToActor(actor, amount, options.damageType, next, deps) : { damage: 0, tempAbsorbed: 0, status: actor.combat?.status ?? 'active' };
    const concentration = damage.damage > 0 ? concentrationCheck(next, actor, damage.damage, random, deps) : null;
    results.push({ actorId: targetId, save, damage: damage.damage, tempAbsorbed: damage.tempAbsorbed, status: damage.status });
    addLog(next, `${actorLabel(next, actor)} 的${saveNames[options.ability]}豁免${save.success ? '成功' : '失败'}，承受 ${damage.damage} 点${options.damageType}伤害。`, deps,
      [saveDetail(actor, next, { actorId: targetId, ability: options.ability, dc: options.dc, bonus: targetBonus }, save), `伤害 ${raw.total}${evasion ? '（反射闪避：不受伤害）' : save.success ? `（减半 ${amount}）` : ''}`, defense.label, `剩余 ${actor.currentHp}/${actor.maxHp}`, concentration?.text].filter(Boolean).join(' · '));
  }
  addLog(next, `范围效果结算：${results.length} 个目标，${results.filter(item => item.save.success).length} 个豁免成功。`, deps,
    `${saveNames[options.ability]}豁免 DC ${options.dc} · ${options.damageExpression} ${options.damageType}${options.halfOnSuccess === false ? '' : '（成功减半）'}`);
  return { battle: next, results };
}

export type OngoingInput = { name: string; damageExpression: string; damageType: DamageType; saveEnds?: { ability: Ability; dc: number }; timing?: 'start' | 'end'; healExpression?: string };
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
    clearFocusBuffs(battle, actor.id, `${actorLabel(battle, actor)} 失去专注「${concentration.spell}」`, deps);
    return { lost: true, dc, natural: 0, total: 0, text: `失去对「${concentration.spell}」的专注` };
  }
  const warcaster = actor.combat?.warCaster === true;
  const outcome = resolveSave(actor, { actorId: actor.id, ability: 'con', dc, bonus: defaultSaveBonus(actor, 'con') + auraBonus(battle, actor.id, 'saves'), ...(warcaster ? { mode: 'advantage' as const } : {}) }, random);
  if (outcome.success) return { lost: false, dc, natural: outcome.natural, total: outcome.total, text: `专注检定 DC ${dc}：d20(${outcome.natural}) + ${outcome.total - outcome.natural} = ${outcome.total}，维持「${concentration.spell}」${warcaster ? '（战地施法者：优势）' : ''}` };
  delete actor.combat!.concentration;
  dismissSummonsOf(battle, actor.id, `施法者失去专注「${concentration.spell}」`, deps);
  clearFocusBuffs(battle, actor.id, `${actorLabel(battle, actor)} 失去专注「${concentration.spell}」`, deps);
  return { lost: true, dc, natural: outcome.natural, total: outcome.total, text: `专注检定 DC ${dc}：d20(${outcome.natural}) + ${outcome.total - outcome.natural} = ${outcome.total}，失去对「${concentration.spell}」的专注` };
}

function validateOngoing(input: OngoingInput): void {
  if (!input.name || !input.name.trim()) throw new Error('请填写持续效果名称。');
  parseDice(input.damageExpression);
  if (!damageTypes.includes(input.damageType)) throw new Error('请选择有效的伤害类型。');
  if (input.saveEnds && (!Number.isInteger(input.saveEnds.dc) || input.saveEnds.dc < 1 || input.saveEnds.dc > 40)) throw new Error('持续效果的豁免 DC 须为 1 至 40 的整数。');
  if (input.timing !== undefined && input.timing !== 'start' && input.timing !== 'end') throw new Error('持续效果的结算时机无效。');
  if (input.healExpression !== undefined) {
    if (!input.healExpression.trim()) throw new Error('请填写持续效果的治疗骰。');
    parseDice(input.healExpression);
  }
}

export function addOngoingEffect(battle: Battle, targetId: string, input: OngoingInput, deps: CombatDeps = {}): { battle: Battle; effectId: string } {
  validateOngoing(input);
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, targetId);
  const state = combatantOf(actor);
  if (state.ongoing && state.ongoing.length >= 8) throw new Error('单个单位最多记录 8 个持续效果。');
  const effectId = makeIdOf(deps)();
  state.ongoing = [...(state.ongoing ?? []), { id: effectId, name: input.name.trim(), damageExpression: input.damageExpression, damageType: input.damageType, saveEnds: input.saveEnds, timing: input.timing ?? 'start', ...(input.healExpression ? { healExpression: input.healExpression } : {}) }];
  const timingLabel = (input.timing ?? 'start') === 'start' ? '回合开始' : '回合结束';
  addLog(next, `${actorLabel(next, actor)} 受到持续效果「${input.name.trim()}」影响。`, deps,
    `${timingLabel}承受 ${input.damageExpression} 点${input.damageType}伤害${input.saveEnds ? `；${timingLabel}进行${saveNames[input.saveEnds.ability]}豁免 DC ${input.saveEnds.dc}，成功则移除` : ''}${input.healExpression ? `；同一时机恢复 ${input.healExpression} 点生命值` : ''}`);
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
  if (replaced && replaced !== spell.trim()) {
    dismissSummonsOf(next, actor.id, `施法者改用「${spell.trim()}」专注`, deps);
    clearFocusBuffs(next, actor.id, `${actorLabel(next, actor)} 改用「${spell.trim()}」专注`, deps);
  }
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
  clearFocusBuffs(next, actor.id, `${actorLabel(next, actor)} 结束了专注「${spell}」`, deps);
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
      const save = resolveSave(actor, { actorId: actor.id, ability: effect.saveEnds.ability, dc: effect.saveEnds.dc, bonus: defaultSaveBonus(actor, effect.saveEnds.ability) + auraBonus(battle, actor.id, 'saves') }, random);
      if (save.success) {
        ended = true;
        addLog(battle, `${actorLabel(battle, actor)} 通过${saveNames[effect.saveEnds.ability]}豁免，结束「${effect.name}」。`, deps, `d20(${save.natural}) = ${save.total}，DC ${effect.saveEnds.dc}`);
      }
    }
    if (!ended) {
      const rolled = rollDamage(effect.damageExpression, random, false);
      const outcome = applyDamageToActor(actor, rolled.total, effect.damageType, battle);
      const concentration = concentrationCheck(battle, actor, outcome.damage, random, deps);
      addLog(battle, `${timing === 'start' ? '回合开始' : '回合结束'}：「${effect.name}」对 ${actorLabel(battle, actor)} 造成 ${outcome.damage} 点${effect.damageType}伤害，剩余 ${actor.currentHp}/${actor.maxHp}。`, deps,
        [`${effect.damageExpression} → ${rolled.total}`, concentration?.text, statusNow() === 'down' ? '倒地，需要死亡豁免' : statusNow() === 'dead' ? '死亡' : ''].filter(Boolean).join('；'));
      survivors.push(effect);
    }
      if (effect.healExpression && statusNow() !== 'dead') {
        const heal = rollDamage(effect.healExpression, random, false);
        const recovered = Math.min(actor.maxHp - actor.currentHp, heal.total);
        if (recovered > 0) {
          actor.currentHp += recovered;
          addLog(battle, `${timing === 'start' ? '回合开始' : '回合结束'}：「${effect.name}」为 ${actorLabel(battle, actor)} 恢复 ${recovered} 点生命值，当前 ${actor.currentHp}/${actor.maxHp}。`, deps, `${effect.healExpression} → ${heal.total}`);
        }
      }
    if (statusNow() === 'dead') { addLog(battle, `${actorLabel(battle, actor)} 已死亡，其余持续效果清除。`, deps); return; }
  }
  state.ongoing = survivors;
}

export function tickTurnStart(battle: Battle, deps: CombatDeps = {}): Battle {
  requireCombat(battle);
  let next = recordUndo(structuredClone(battle));
  applyOngoingDamage(next, deps);
  const current = currentActorId(next);
  if (current) {
    const actor = next.actors.find(item => item.id === current);
    if (actor && (actor.combat?.status ?? 'active') === 'active') { greaseFall(next, actor, deps); webStuck(next, actor, deps); holdRecover(next, actor, deps); sleepDust(next, actor, deps); next = windGust(next, actor, deps); }
  }
  return next;
}

function resolveDeathSave(next: Battle, actor: Actor, deps: CombatDeps): DeathSaveOutcome {
  const state = combatantOf(actor);
  const natural = rollDie(20, randomOf(deps));
  if (natural === 20) {
    actor.currentHp = 1;
    state.status = 'active';
    state.deathSaves = { successes: 0, failures: 0 };
    addLog(next, `${actorLabel(next, actor)} 死亡豁免掷出 20，恢复 1 点生命值。`, deps);
    return { natural, successes: 0, failures: 0, status: 'active', revived: true };
  }
  if (natural === 1) state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 2);
  else if (natural >= 10) state.deathSaves.successes = Math.min(3, state.deathSaves.successes + 1);
  else state.deathSaves.failures = Math.min(3, state.deathSaves.failures + 1);
  if (state.deathSaves.failures >= 3) state.status = 'dead';
  addLog(next, `${actorLabel(next, actor)} 死亡豁免 d20(${natural})：${state.deathSaves.successes} 成功 / ${state.deathSaves.failures} 失败${state.status === 'dead' ? '，死亡' : state.deathSaves.successes >= 3 ? '，稳定' : ''}。`, deps);
  return { natural, successes: state.deathSaves.successes, failures: state.deathSaves.failures, status: state.status, revived: false };
}

/** 稳定伤势：用动作对 5 尺内倒地的同伴做 DC 10 医药检定，成功则该单位停止掷死亡豁免。 */
export function stabilize(battle: Battle, actorId: string, targetId: string, deps: CombatDeps = {}): { battle: Battle; outcome: SaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const healer = actorOf(next, actorId);
  const target = actorOf(next, targetId);
  const healerState = combatantOf(healer);
  const targetState = combatantOf(target);
  if (healerState.status !== 'active') throw new Error('只有在场的单位可以稳定伤势。');
  if (healer.id !== targetId && currentActorId(next) !== healer.id) throw new Error('只有当前回合的单位可以稳定伤势。');
  if (healerState.actionUsed) throw new Error('该单位本回合已经使用过动作。');
  if (targetState.status !== 'down') throw new Error('只有 0 点生命值倒地的单位需要稳定伤势。');
  if (healer.position && target.position && cellDistance(healer.position, target.position) > 1) throw new Error('稳定伤势需要目标在 5 尺内。');
  const bonus = abilityCheckBonus(healer, 'wis', '医术');
  const options: SaveOptions = { actorId: healer.id, ability: 'wis', dc: 10, bonus };
  const outcome = resolveSave(healer, options, randomOf(deps));
  healerState.actionUsed = true;
  if (outcome.success) {
    targetState.stable = true;
    addLog(next, `${actorLabel(next, healer)} 稳定了 ${actorLabel(next, target)} 的伤势（DC 10）。`, deps);
  } else {
    addLog(next, `${actorLabel(next, healer)} 稳定 ${actorLabel(next, target)} 的伤势失败（DC 10）。`, deps);
  }
  return { battle: next, outcome };
}

export function rollDeathSave(battle: Battle, actorId: string, deps: CombatDeps = {}): { battle: Battle; outcome: DeathSaveOutcome } {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status !== 'down') throw new Error('只有在 0 点生命值倒地的角色才需要死亡豁免。');
  if (state.stable === true) throw new Error('该单位已经稳定，不需要掷死亡豁免。');
  if (!actor.characterSnapshot) throw new Error('怪物在 0 点生命值时直接死亡，不需要死亡豁免。');
  return { battle: next, outcome: resolveDeathSave(next, actor, deps) };
}

export function undoCombat(battle: Battle): Battle {
  const combat = requireCombat(battle);
  const previous = combat.undo.at(-1);
  if (!previous) throw new Error('没有可以撤销的战斗操作。');
  const restored = structuredClone(previous);
  if (restored.combat) restored.combat.undo = combat.undo.slice(0, -1).map(entry => structuredClone(entry));
  return restored;
}
/** 连续撤销若干步（供回放面板跳转）。 */
export function jumpBack(battle: Battle, steps: number): Battle {
  const combat = requireCombat(battle);
  if (!Number.isInteger(steps) || steps < 1) throw new Error('撤销步数须为正整数。');
  if (steps > combat.undo.length) throw new Error('撤销步数超出可回退范围。');
  let next = battle;
  for (let index = 0; index < steps; index += 1) next = undoCombat(next);
  return next;
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
  const insertAt = combat.order.findIndex(id => {
    const other = next.actors.find(a => a.id === id);
    if (!other?.combat) return false;
    if (other.combat.initiative < initiative) return true;
    if (other.combat.initiative > initiative) return false;
    return initiativeTiebreak(other, actor) > 0;
  });
  const index = insertAt < 0 ? combat.order.length : insertAt;
  combat.order.splice(index, 0, actor.id);
  if (index <= combat.turnIndex) combat.turnIndex += 1;
  addLog(next, `${name} 以先攻 ${initiative} 加入战斗。`, deps);
  return { battle: next, actorId: actor.id, initiative };
}


/** 起身：消耗一半速度的移动力，移除倒地状态。 */
/** 延迟行动：把当前行动者挪到本轮最后，让下一位先行动。 */
/** 切换飞行状态：飞行单位移动时忽略地形消耗与危险地形伤害。 */
export function setFlying(battle: Battle, actorId: string, enabled: boolean, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (state.status === 'dead') throw new Error('已经死亡的单位无法飞行。');
  if (enabled) {
    state.flying = true;
    addLog(next, `${actorLabel(next, actor)} 起飞：移动忽略地形消耗与危险地形伤害。`, deps);
  } else {
    const feet = actor.elevation ?? 0;
    delete state.flying;
    if (feet >= 10) {
      const fall = applyFallDamage(next, actorId, feet, deps);
      const fallen = actorOf(fall.battle, actorId);
      delete fallen.elevation;
      addLog(fall.battle, `${actorLabel(fall.battle, fallen)} 失去飞行，从 ${feet} 尺坠落。`, deps);
      return fall.battle;
    }
    delete actor.elevation;
    addLog(next, `${actorLabel(next, actor)} 落地。`, deps);
  }
  return next;
}

export function delayTurn(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  const combat = requireCombat(next);
  const actor = actorOf(next, actorId);
  if (combat.order[combat.turnIndex] !== actorId) throw new Error('只有当前回合的单位可以延迟行动。');
  if (combat.order.length <= 1) throw new Error('只有一名行动者时无法延迟。');
  if (combat.turnIndex >= combat.order.length - 1) throw new Error('该单位已经是本轮的最后一个行动者。');
  const index = combat.turnIndex;
  combat.order = [...combat.order.slice(0, index), ...combat.order.slice(index + 1), actorId];
  combat.turnIndex = index;
  combatantOf(actor).delayed = true;
  addLog(next, `${actorLabel(next, actor)} 延迟行动，排到本轮最后。`, deps);
  return next;
}

export function standUp(battle: Battle, actorId: string, deps: CombatDeps = {}): Battle {
  const next = recordUndo(structuredClone(battle));
  requireCombat(next);
  const actor = actorOf(next, actorId);
  const state = combatantOf(actor);
  if (currentActorId(next) !== actor.id) throw new Error('只有当前回合的单位可以起身。');
  if (!state.conditions.includes('倒地')) throw new Error('该单位没有倒地。');
  if (state.status !== 'active') throw new Error('只有在场的单位可以起身。');
  const speed = movementAllowance(actor);
  const cost = Math.floor(actorSpeed(actor) / 2);
  const remaining = Math.max(0, speed - state.movementUsed);
  if (remaining < cost) throw new Error(`剩余移动力不足，起身需要 ${cost} 尺。`);
  state.movementUsed += cost;
  state.conditions = state.conditions.filter(item => item !== '倒地');
  addLog(next, `${actorLabel(next, actor)} 起身，消耗 ${cost} 尺移动力。`, deps);
  return next;
}












