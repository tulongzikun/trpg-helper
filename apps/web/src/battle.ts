import type { Card, Block, Entry } from './catalog';
import type { Ability, CharacterSnapshot } from './characters';

export type Side = '友方' | '敌方' | '中立';
export type DamageType = '钝击' | '穿刺' | '挥砍' | '酸蚀' | '寒冷' | '火焰' | '力场' | '闪电' | '黯蚀' | '毒素' | '心灵' | '光耀' | '雷鸣';
export const damageTypes: DamageType[] = ['钝击', '穿刺', '挥砍', '酸蚀', '寒冷', '火焰', '力场', '闪电', '黯蚀', '毒素', '心灵', '光耀', '雷鸣'];
export type CombatStatus = 'active' | 'down' | 'dead';
export type DeathSaves = { successes: number; failures: number };
/** 回合开始时结算的持续效果，例如灼烧、酸液或毒雾。 */
export type OngoingEffect = {
  id: string;
  name: string;
  damageExpression: string;
  damageType: DamageType;
  /** 回合开始时进行豁免，成功则移除该效果。 */
  saveEnds?: { ability: Ability; dc: number };
  /** 结算时机：回合开始（默认）或回合结束。 */
  timing?: 'start' | 'end';
};
/** 正在维持的专注法术。 */
export type Concentration = { spell: string };
/** 借机攻击：reactorId 用反应攻击离开其触及范围的 targetId。 */
export type OpportunityPrompt = { reactorId: string; targetId: string };
/** 召唤物绑定：失去专注、施法者倒地或倒计时结束时消散。 */
export type Summon = { ownerId: string; spell: string; rounds?: number };
/** 准备动作：把动作换成「满足触发条件时用反应执行」。 */
export type ReadyAction = { action: string; trigger: string };
export type CombatantState = {
  initiative: number;
  tempHp: number;
  conditions: string[];
  actionUsed: boolean;
  bonusUsed: boolean;
  reactionUsed: boolean;
  movementUsed: number;
  status: CombatStatus;
  deathSaves: DeathSaves;
  /** 本场战斗已使用的动作如潮次数（战士），短休或长休恢复。 */
  actionSurgeUsed?: number;
  /** 本场战斗是否已经使用过回气（战士），短休或长休恢复。 */
  secondWindUsed?: boolean;
  /** 剩余弹药（带「弹药」特性的远程武器每次攻击消耗 1 发）。 */
  ammo?: number;
  /** 回合开始时结算的持续伤害效果。 */
  ongoing?: OngoingEffect[];
  /** 正在维持的专注。 */
  concentration?: Concentration;
  /** 本回合是否已撤离（移动不引发借机攻击）。 */
  disengaged?: boolean;
  /** 擒抱者 id，用于计算挣脱 DC。 */
  grappledBy?: string;
  /** 准备动作：已经准备好了什么，以及触发的条件。 */
  ready?: ReadyAction;
  /** 是否在使用闪避：直到自己下个回合开始前，针对它的攻击检定具有劣势。 */
  dodging?: boolean;
  /** 是否获得了协助：下一次攻击检定具有优势，用掉后清除。 */
  helpedAttack?: boolean;
  /** 使用疾跑后本回合额外获得的移动力（尺），回合开始时清零。 */
  dashMovement?: number;
  /** 是否处于躲藏状态：攻击时获得优势，攻击或被攻击后现身。 */
  hidden?: boolean;
};
export type CombatLogEntry = { id: string; round: number; text: string; detail?: string };
export type CombatState = {
  round: number;
  turnIndex: number;
  order: string[];
  log: CombatLogEntry[];
  undo: Battle[];
  /** 移动离开触及范围后待结算的借机攻击。 */
  pendingOpportunity?: OpportunityPrompt[];
};
export type ActorTemplate = Partial<Block> & Pick<Block, 'armorClass'>;
/** 方格战场：宽高以格为单位，cellFt 是每格代表的尺数。 */
export type GridConfig = { width: number; height: number; cellFt: number };
/** 单位在方格上的位置，左上角为 (0,0)。 */
export type Position = { x: number; y: number };
export type Actor = {
  id: string;
  name: string;
  side: Side;
  currentHp: number;
  maxHp: number;
  source: { entryId: string; blockId: string; entryName: string; source: Entry['source']; revision: number };
  template: ActorTemplate;
  characterSnapshot?: CharacterSnapshot;
  combat?: CombatantState;
  /** 该单位是某位施法者的召唤物。 */
  summon?: Summon;
  /** 在方格战场上的位置；未放置时不参与距离校验。 */
  position?: Position;
};
export type Aura = { id: string; name: string; ownerId: string; radiusFt: number; bonus: number; kind: 'ac' | 'saves' };
export type Battle = { id: string; name: string; createdAt: string; actors: Actor[]; combat?: CombatState; grid?: GridConfig; difficult?: Position[]; walls?: Position[]; auras?: Aura[] };
export type BattleStore = { version: 1; battles: Battle[] };
export const storageKey = 'trpg-helper.battles.v1';
export const emptyStore = (): BattleStore => ({ version: 1, battles: [] });

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isInteger = (value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const isSide = (value: unknown): value is Side => value === '友方' || value === '敌方' || value === '中立';
const abilityKeys: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
function isOngoingEffect(value: unknown): value is OngoingEffect {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.damageExpression !== 'string') return false;
  if (!damageTypes.includes(value.damageType as DamageType)) return false;
  if (value.timing !== undefined && value.timing !== 'start' && value.timing !== 'end') return false;
  if (value.saveEnds === undefined) return true;
  const saveEnds = value.saveEnds;
  return isObject(saveEnds) && abilityKeys.includes(saveEnds.ability as Ability) && isInteger(saveEnds.dc, 1, 40);
}
function isReadyAction(value: unknown): value is ReadyAction {
  if (!isObject(value)) return false;
  const text = (item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 120;
  return text(value.action) && text(value.trigger);
}
function isCombatant(value: unknown): value is CombatantState {
  if (!isObject(value)) return false;
  if (!isInteger(value.initiative, -99, 99)) return false;
  if (!isInteger(value.tempHp, 0) || !isInteger(value.movementUsed, 0)) return false;
  if (!Array.isArray(value.conditions) || !value.conditions.every(x => typeof x === 'string')) return false;
  if (![value.actionUsed, value.bonusUsed, value.reactionUsed].every(x => typeof x === 'boolean')) return false;
  if (value.actionSurgeUsed !== undefined && !isInteger(value.actionSurgeUsed, 0, 2)) return false;
  if (value.secondWindUsed !== undefined && typeof value.secondWindUsed !== 'boolean') return false;
  if (value.ammo !== undefined && !isInteger(value.ammo, 0, 999)) return false;
  if (value.disengaged !== undefined && typeof value.disengaged !== 'boolean') return false;
  if (value.grappledBy !== undefined && (typeof value.grappledBy !== 'string' || value.grappledBy.length === 0 || value.grappledBy.length > 64)) return false;
  if (value.ready !== undefined && !isReadyAction(value.ready)) return false;
  if (value.dodging !== undefined && typeof value.dodging !== 'boolean') return false;
  if (value.helpedAttack !== undefined && typeof value.helpedAttack !== 'boolean') return false;
  if (value.dashMovement !== undefined && !isInteger(value.dashMovement, 0, 300)) return false;
  if (value.hidden !== undefined && typeof value.hidden !== 'boolean') return false;
  if (value.ongoing !== undefined && (!Array.isArray(value.ongoing) || !value.ongoing.every(isOngoingEffect))) return false;
  if (value.concentration !== undefined && !(isObject(value.concentration) && typeof value.concentration.spell === 'string' && value.concentration.spell.length > 0)) return false;
  if (value.status !== 'active' && value.status !== 'down' && value.status !== 'dead') return false;
  return isObject(value.deathSaves) && isInteger(value.deathSaves.successes, 0, 3) && isInteger(value.deathSaves.failures, 0, 3);
}
function isBattleSnapshot(value: unknown): boolean {
  if (!isBattle(value)) return false;
  const combat = (value as { combat?: unknown }).combat;
  return combat === undefined || (isObject(combat) && Array.isArray(combat.undo) && combat.undo.length === 0);
}
function isCombatState(value: unknown): value is CombatState {
  if (!isObject(value)) return false;
  if (!isInteger(value.round, 1) || !isInteger(value.turnIndex, 0)) return false;
  if (!Array.isArray(value.order) || !value.order.every(x => typeof x === 'string')) return false;
  if (!Array.isArray(value.log) || value.log.length > 500) return false;
  if (!value.log.every(entry => isObject(entry) && typeof entry.id === 'string' && isInteger(entry.round, 0) && typeof entry.text === 'string' && (entry.detail === undefined || typeof entry.detail === 'string'))) return false;
  if (!Array.isArray(value.undo) || value.undo.length > 20) return false;
  if (value.pendingOpportunity !== undefined && (!Array.isArray(value.pendingOpportunity) || value.pendingOpportunity.length > 8 || !value.pendingOpportunity.every(isOpportunityPrompt))) return false;
  return value.undo.every(isBattleSnapshot);
}
function isOpportunityPrompt(value: unknown): value is OpportunityPrompt {
  return isObject(value) && typeof value.reactorId === 'string' && value.reactorId.length > 0 && typeof value.targetId === 'string' && value.targetId.length > 0;
}
function isSummon(value: unknown): value is Summon {
  if (!isObject(value)) return false;
  if (typeof value.ownerId !== 'string' || !value.ownerId.length) return false;
  if (typeof value.spell !== 'string' || !value.spell.length) return false;
  return value.rounds === undefined || isInteger(value.rounds, 1, 99);
}
function isGrid(value: unknown): value is GridConfig {
  return isObject(value) && isInteger(value.width, 1, 60) && isInteger(value.height, 1, 60) && isInteger(value.cellFt, 5, 30);
}
function isPosition(value: unknown): value is Position {
  return isObject(value) && isInteger(value.x, 0, 59) && isInteger(value.y, 0, 59);
}
function isActor(value: unknown): boolean {
  if (!isObject(value) || !isObject(value.source) || !isObject(value.source.source) || !isObject(value.template)) return false;
  return typeof value.id === 'string' && typeof value.name === 'string' && isSide(value.side)
    && isInteger(value.currentHp, 0) && isInteger(value.maxHp, 1) && value.maxHp >= value.currentHp
    && typeof value.source.source.name === 'string' && typeof value.template.armorClass === 'number'
    && (value.combat === undefined || isCombatant(value.combat))
    && (value.summon === undefined || isSummon(value.summon))
    && (value.position === undefined || isPosition(value.position));
}
function isAura(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim() || value.id.length > 64) return false;
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 64) return false;
  if (typeof value.ownerId !== 'string' || !value.ownerId.trim() || value.ownerId.length > 64) return false;
  if (!isInteger(value.radiusFt, 5, 60)) return false;
  if (!isInteger(value.bonus, 1, 5)) return false;
  return value.kind === 'ac' || value.kind === 'saves';
}
function isBattle(value: unknown): boolean {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.createdAt === 'string'
    && Array.isArray(value.actors) && value.actors.every(isActor)
    && (value.combat === undefined || isCombatState(value.combat))
    && (value.grid === undefined || isGrid(value.grid))
    && (value.difficult === undefined || (Array.isArray(value.difficult) && value.difficult.length <= 400 && value.difficult.every(isPosition)))
    && (value.walls === undefined || (Array.isArray(value.walls) && value.walls.length <= 400 && value.walls.every(isPosition)))
  && (value.auras === undefined || (Array.isArray(value.auras) && value.auras.length <= 8 && value.auras.every(isAura)));
}

/** 校验外部来源的战斗数据，失败时抛出中文错误，供导入功能使用。 */
export function validateBattle(value: unknown): Battle {
  if (!isBattle(value)) throw new Error('战斗数据格式无效，无法导入。');
  return value as Battle;
}

export function readBattles(storage: Pick<Storage, 'getItem'>): BattleStore {
  const raw = storage.getItem(storageKey);
  if (raw === null) return emptyStore();
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('本地战斗数据格式无效或版本不支持，请保留原数据并修复后重试。'); }
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.battles) || !value.battles.every(isBattle)) throw new Error('本地战斗数据格式无效或版本不支持，请保留原数据并修复后重试。');
  return value as unknown as BattleStore;
}
export function writeBattles(storage: Pick<Storage, 'setItem'>, store: BattleStore) { storage.setItem(storageKey, JSON.stringify(store)); }

function rejectStartedBattle(battle: Battle) {
  if (battle.combat) throw new Error('战斗已经开始，无法再添加单位；请先在战斗页重置战斗。');
}
export function addMonsters(store: BattleStore, card: Card, options: { battleId?: string; newBattleName?: string; side: Side; count: number }, makeId: () => string = () => crypto.randomUUID(), now: () => string = () => new Date().toISOString()): { store: BattleStore; battleId: string } {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) throw new Error('数量须为 1 到 50 的整数。');
  if (!isSide(options.side)) throw new Error('请选择有效阵营。');
  if (!card.block.id || !Number.isInteger(card.block.hitPoints.average) || card.block.hitPoints.average < 1) throw new Error('怪物数据卡缺少有效的生命值或标识。');
  const result = structuredClone(store);
  let battle = result.battles.find(b => b.id === options.battleId);
  if (options.battleId && !battle) throw new Error('战斗不存在，请重新选择。');
  if (battle) rejectStartedBattle(battle);
  if (!options.battleId) {
    const name = options.newBattleName?.trim();
    if (!name) throw new Error('请输入战斗名称。');
    battle = { id: makeId(), name, createdAt: now(), actors: [] };
    result.battles.push(battle);
  }
  if (!battle) throw new Error('无法创建战斗。');
  for (let i = 0; i < options.count; i++) {
    const template = structuredClone(card.block);
    battle.actors.push({ id: makeId(), name: card.block.name, side: options.side, currentHp: template.hitPoints.average, maxHp: template.hitPoints.average, source: { entryId: card.entry.id, blockId: card.block.id, entryName: card.entry.name, source: structuredClone(card.entry.source), revision: card.entry.revision }, template });
  }
  return { store: result, battleId: battle.id };
}
export function updateActorHp(store: BattleStore, battleId: string, actorId: string, hp: number): BattleStore {
  const result = structuredClone(store); const actor = result.battles.find(b => b.id === battleId)?.actors.find(a => a.id === actorId);
  if (!actor || !Number.isInteger(hp) || hp < 0 || hp > actor.maxHp) throw new Error('生命值须为 0 至最大生命值之间的整数。');
  actor.currentHp = hp; return result;
}
export function addCharacter(store: BattleStore, snapshot: CharacterSnapshot, options: { battleId?: string; newBattleName?: string; side: Side }, makeId: () => string = () => crypto.randomUUID(), now: () => string = () => new Date().toISOString()): { store: BattleStore; battleId: string } {
  if (snapshot.schemaVersion !== 'manual-character-snapshot/v1' || !snapshot.characterId || !Number.isInteger(snapshot.revision) || snapshot.revision < 1 || !snapshot.sheet.name.trim() || !Number.isInteger(snapshot.sheet.maxHp) || snapshot.sheet.maxHp < 1 || !Number.isInteger(snapshot.sheet.armorClass) || snapshot.sheet.armorClass < 0) throw Error('角色快照无效，无法导入。');
  if (!isSide(options.side)) throw Error('请选择有效阵营。');
  const result = structuredClone(store); let battle = result.battles.find(b => b.id === options.battleId);
  if (options.battleId && !battle) throw Error('战斗不存在，请重新选择。');
  if (battle) rejectStartedBattle(battle);
  if (!options.battleId) { const name = options.newBattleName?.trim(); if (!name) throw Error('请输入战斗名称。'); battle = { id: makeId(), name, createdAt: now(), actors: [] }; result.battles.push(battle); }
  if (!battle) throw Error('无法创建战斗。'); const copy = structuredClone(snapshot);
  battle.actors.push({ id: makeId(), name: copy.sheet.name, side: options.side, currentHp: copy.sheet.maxHp, maxHp: copy.sheet.maxHp, source: { entryId: copy.characterId, blockId: copy.characterId, entryName: copy.sheet.name, source: { name: '角色库' }, revision: copy.revision }, template: { armorClass: copy.sheet.armorClass }, characterSnapshot: copy });
  return { store: result, battleId: battle.id };
}
export function removeActor(store: BattleStore, battleId: string, actorId: string): BattleStore {
  const result = structuredClone(store); const battle = result.battles.find(b => b.id === battleId);
  if (!battle || !battle.actors.some(a => a.id === actorId)) throw new Error('未找到战斗单位。');
  battle.actors = battle.actors.filter(a => a.id !== actorId);
  if (battle.combat) {
    const combat = battle.combat;
    const removedIndex = combat.order.indexOf(actorId);
    combat.order = combat.order.filter(id => id !== actorId);
    if (removedIndex >= 0 && removedIndex < combat.turnIndex) combat.turnIndex -= 1;
    if (combat.turnIndex >= combat.order.length) combat.turnIndex = 0;
    combat.log.push({ id: `remove-${actorId}-${combat.log.length}`, round: combat.round, text: '移除单位。' });
    if (!combat.order.length) { delete battle.combat; for (const actor of battle.actors) delete actor.combat; }
  }
  return result;
}
export function replaceBattle(store: BattleStore, battle: Battle): BattleStore {
  const result = structuredClone(store);
  const index = result.battles.findIndex(b => b.id === battle.id);
  if (index < 0) throw new Error('战斗不存在，请重新选择。');
  result.battles[index] = battle;
  return result;
}



