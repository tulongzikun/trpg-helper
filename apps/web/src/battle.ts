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
  /** 同一时机额外恢复的生命值骰（如再生）。 */
  healExpression?: string;
};
/** 正在维持的专注法术。 */
export type Concentration = { spell: string };
export type PendingCastPlan = {
  casterId: string;
  spell: string;
  level: number;
  cost: 'action' | 'bonus';
  concentration: boolean;
  attack?: { targetId: string; attackBonus: number; damageExpression: string; damageType: DamageType };
  save?: { ability: Ability; dc: number; targetIds: string[]; damageExpression: string; damageType: DamageType; halfOnSuccess?: boolean };
};

export type CombatItem = {
  name: string;
  quantity: number;
  healExpression?: string;
  identified?: boolean;
};
/** 借机攻击：reactorId 用反应攻击离开其触及范围的 targetId。 */
export type OpportunityPrompt = { reactorId: string; targetId: string; kind?: 'opportunity' | 'ready' };
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
  /** 是否被沉睡术陷入沉睡（失能 + 倒地，受伤或唤醒时解除）。 */
  sleeping?: boolean;
  /** 本回合是否已撤离（移动不引发借机攻击）。 */
  disengaged?: boolean;
  /** 擒抱者 id，用于计算挣脱 DC。 */
  grappledBy?: string;
  /** 准备动作：已经准备好了什么，以及触发的条件。 */
  ready?: ReadyAction;
  /** 是否在使用闪避：直到自己下个回合开始前，针对它的攻击检定具有劣势。 */
  dodging?: boolean;
  nickUsed?: boolean;
  /** 是否持有「防守决斗」专长：可用反应让 AC 加上熟练加值直到下个回合开始。 */
  defensiveDuelist?: boolean;
  /** 防守决斗带来的临时 AC 加值，回合开始时清零。 */
  parryBonus?: number;
  /** 是否持有「双持战斗者」专长：AC +1，且副手攻击可用非轻型武器。 */
  dualWielder?: boolean;
  sentinel?: boolean;
  stable?: boolean;
  /** 是否已被队友观察过（观察动作成功）。 */
  revealed?: boolean;
  /** 战地施法者专长：专注检定时具有优势。 */
  warCaster?: boolean;
  /** 是否学会了法术反制（可用反应反制待结算的法术）。 */
  counterspell?: boolean;
  guarding?: string;
  items?: CombatItem[];
  delayed?: boolean;
  flying?: boolean;
  /** 力竭等级（0–6）：每级使攻击、豁免、属性检定 -2，速度 -5 尺。 */
  exhaustion?: number;
  /** 已记录的法术位（剩余个数，索引 0 为 1 环）；未设置时不追踪法术位。 */
  spellSlots?: number[];
  /** 记录时的法术位上限（长休恢复到这一组数值）。 */
  spellSlotsMax?: number[];
  /** 本回合是否已经用掉偷袭（每回合只能偷袭一次）。 */
  sneakUsed?: boolean;
  /** 鲁莽攻击：本回合自己的攻击具有优势，直到下个回合开始前针对它的攻击也具有优势。 */
  reckless?: boolean;
  /** 武器精通「迟滞」造成的速度削减（尺），回合开始时清零。 */
  speedPenaltyFt?: number;
  /** 武器精通「削韧」标记：下一次攻击检定劣势，用掉后清除。 */
  sapped?: boolean;
  /** 施加减速的来源 id：该来源的回合开始时清除速度削减。 */
  slowSourceId?: string;
  /** 精通「破绽」：对指定目标的下一次攻击检定优势，用掉后清除。 */
  vexTargetId?: string;
  /** 是否获得了协助：下一次攻击检定具有优势，用掉后清除。 */
  helpedAttack?: boolean;
  helpedCheck?: boolean;
  /** 使用疾跑后本回合额外获得的移动力（尺），回合开始时清零。 */
  dashMovement?: number;
  /** 是否处于躲藏状态：攻击时获得优势，攻击或被攻击后现身。 */
  hidden?: boolean;
  /** 祝福术：剩余轮数（攻击检定与豁免 +1d4）。 */
  blessed?: number;
  /** 施加祝福术的施法者 id：施法者失去专注时祝福立刻结束。 */
  blessedBy?: string;
  /** 加速术：剩余轮数（速度翻倍、AC +2、敏捷豁免优势）。 */
  hasted?: number;
  /** 施加加速术的施法者 id。 */
  hastedBy?: string;
  /** 隐形术：剩余轮数（针对它的攻击检定劣势，它自己的攻击检定优势）。 */
  invisible?: number;
  paralyzed?: number;
  /** 施加隐形术的施法者 id。 */
  invisibleBy?: string;
  paralyzedBy?: string;
  /** 命令术「停止」：轮到它时整个回合无法行动，跳过并清除。 */
  commanded?: 'halt';
  /** 耳聋术：剩余轮数。 */
  deafened?: number;
  /** 耳聋术的施法者。 */
  deafenedBy?: string;
  /** 撤离战场：仍留在战斗记录里，但不再行动、不计入胜负判定。 */
  fled?: boolean;
  /** 投降：退出战斗但仍留在战场上，可被搜刮，也计入击败经验。 */
  surrendered?: boolean;
  /** 缓慢术：剩余轮数（速度减半、AC -2、无法使用反应）。 */
  slowed?: number;
  /** 施加缓慢术的施法者 id。 */
  slowedBy?: string;
  /** 魅惑术：剩余轮数（无法攻击施法者）。 */
  charmed?: number;
  /** 施加魅惑术的施法者 id。 */
  charmedBy?: string;
  /** 致盲术：剩余轮数（目盲：攻击劣势，被攻击时对方优势）。 */
  blinded?: number;
  /** 施加致盲术的施法者 id。 */
  blindedBy?: string;
  /** 是否被纠缠术的藤蔓缠住（束缚来源，挣脱后清除）。 */
  entangled?: boolean;
  /** 恐惧术：剩余轮数（无法靠近恐惧源，对其攻击劣势）。 */
  frightened?: number;
  /** 施加恐惧术的施法者 id。 */
  frightenedBy?: string;
  surprised?: boolean;
  suppressed?: boolean;
  /** 骑手：所骑坐骑的 id。 */
  mountedOn?: string;
  /** 坐骑：骑手的 id。 */
  riderId?: string;
  /** 骑乘时继承的坐骑速度（尺）。 */
  mountSpeedFt?: number;
  /** 本场战斗的统计（攻击、命中、伤害与治疗）。 */
  stats?: CombatStats;
  aimed?: boolean;
  /** 树肤术：AC 不低于 17 的剩余轮数。 */
  barkskin?: number;
  barkskinBy?: string;
  /** 援助术：额外生命上限（长休时移除）。 */
  aided?: number;
  /** 变形术：剩余轮数（变成小兽：失能、AC 10、速度上限 25 尺）。 */
  polymorphed?: number;
  /** 施加变形术的施法者 id。 */
  polymorphedBy?: string;
  /** 中毒剩余轮数（攻击检定劣势），归零时自动解除。 */
  poisoned?: number;
  /** 护盾术：AC 加值，直到自己下个回合开始。 */
  shield?: number;
};
/** 单个单位在本场战斗中的统计（攻击次数、命中、伤害与治疗）。 */
export type CombatStats = {
  attacks: number;
  hits: number;
  crits: number;
  misses: number;
  damageDealt: number;
  damageTaken: number;
  /** 承受伤害按类型累计（类型 → 点数）。 */
  damageByType?: Record<string, number>;
  healing: number;
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
/** 战场环境：水下会让远程攻击变得困难。 */
export type Obscured = 'light' | 'heavy';

export type Terrain = 'normal' | 'underwater' | 'climbing' | 'ice' | 'lava' | 'brambles' | 'mud';
/** 天气：暴雨让远程攻击变难、火焰伤害减半；强风让远程攻击变难，还会吹落飞行单位。 */
export type Weather = 'rain' | 'wind';
/** 危险地形格：单位进入该格时立即受到伤害。 */
export type Hazard = { x: number; y: number; damageExpression: string; damageType: DamageType };
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
  /** 相对地面的高度（尺），用于高低差判定。 */
  elevation?: number;
};
export type Aura = { id: string; name: string; ownerId: string; radiusFt: number; bonus: number; kind: 'ac' | 'saves' };
export type AttackPreset = {
  id: string;
  name: string;
  attackerId: string;
  targetId: string;
  attackBonus: number;
  damageExpression: string;
  damageType: DamageType;
  range: 'melee' | 'ranged';
  weaponId?: string;
  sharpshooter?: boolean;
  powerAttack?: boolean;
  twoHanded?: boolean;
};
export type Battle = { id: string; name: string; createdAt: string; actors: Actor[]; combat?: CombatState; grid?: GridConfig; autoDeathSaves?: boolean; enterReachOpportunity?: boolean; obscured?: Obscured; terrain?: Terrain; weather?: Weather; difficult?: Position[]; walls?: Position[]; cover?: Position[]; hazards?: Hazard[]; grease?: Position[]; fog?: Position[]; fogBy?: string; darkness?: Position[]; darknessBy?: string; silence?: Position[]; silenceBy?: string; sleepCloud?: Position[]; sleepCloudBy?: string; webs?: Position[]; entangle?: Position[]; entangleBy?: string; auras?: Aura[]; pendingCast?: PendingCastPlan; attackPresets?: AttackPreset[] };
export type BattleStore = { version: 1; battles: Battle[] };
export const storageKey = 'trpg-helper.battles.v1';
export const emptyStore = (): BattleStore => ({ version: 1, battles: [] });

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isInteger = (value: unknown, minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
const isSide = (value: unknown): value is Side => value === '友方' || value === '敌方' || value === '中立';
const abilityKeys: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
function isPendingCastPlan(value: unknown): value is PendingCastPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  if (typeof plan.casterId !== 'string' || !plan.casterId) return false;
  if (typeof plan.spell !== 'string' || !plan.spell.trim()) return false;
  if (!isInteger(plan.level, 0, 9)) return false;
  if (plan.cost !== 'action' && plan.cost !== 'bonus') return false;
  if (typeof plan.concentration !== 'boolean') return false;
  if (plan.attack !== undefined) {
    if (!plan.attack || typeof plan.attack !== 'object') return false;
    const attack = plan.attack as Record<string, unknown>;
    if (typeof attack.targetId !== 'string') return false;
    if (typeof attack.damageExpression !== 'string') return false;
    if (!damageTypes.includes(attack.damageType as DamageType)) return false;
  }
  if (plan.save !== undefined) {
    if (!plan.save || typeof plan.save !== 'object') return false;
    const save = plan.save as Record<string, unknown>;
    if (!Array.isArray(save.targetIds)) return false;
    if (typeof save.damageExpression !== 'string') return false;
    if (!damageTypes.includes(save.damageType as DamageType)) return false;
  }
  return true;
}

function isOngoingEffect(value: unknown): value is OngoingEffect {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.damageExpression !== 'string') return false;
  if (!damageTypes.includes(value.damageType as DamageType)) return false;
  if (value.timing !== undefined && value.timing !== 'start' && value.timing !== 'end') return false;
  if (value.healExpression !== undefined && (typeof value.healExpression !== 'string' || value.healExpression.length === 0 || value.healExpression.length > 20)) return false;
  if (value.saveEnds === undefined) return true;
  const saveEnds = value.saveEnds;
  return isObject(saveEnds) && abilityKeys.includes(saveEnds.ability as Ability) && isInteger(saveEnds.dc, 1, 40);
}
function isReadyAction(value: unknown): value is ReadyAction {
  if (!isObject(value)) return false;
  const text = (item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 120;
  return text(value.action) && text(value.trigger);
}
function isCombatItem(value: unknown): value is CombatItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as CombatItem;
  if (typeof item.name !== 'string' || item.name.length === 0 || item.name.length > 40) return false;
  if (!isInteger(item.quantity, 0, 99)) return false;
  if (item.healExpression !== undefined && (typeof item.healExpression !== 'string' || item.healExpression.length === 0 || item.healExpression.length > 20)) return false;
  if (item.identified !== undefined && typeof item.identified !== 'boolean') return false;
  return true;
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
  if (value.nickUsed !== undefined && typeof value.nickUsed !== 'boolean') return false;
  if (value.sneakUsed !== undefined && typeof value.sneakUsed !== 'boolean') return false;
  if (value.defensiveDuelist !== undefined && typeof value.defensiveDuelist !== 'boolean') return false;
  if (value.parryBonus !== undefined && !isInteger(value.parryBonus, 0, 10)) return false;
  if (value.dualWielder !== undefined && typeof value.dualWielder !== 'boolean') return false;
  if (value.sentinel !== undefined && typeof value.sentinel !== 'boolean') return false;
  if (value.stable !== undefined && typeof value.stable !== 'boolean') return false;
  if (value.sleeping !== undefined && typeof value.sleeping !== 'boolean') return false;
  if (value.paralyzed !== undefined && !isInteger(value.paralyzed, 0, 100)) return false;
  if (value.paralyzedBy !== undefined && (typeof value.paralyzedBy !== 'string' || value.paralyzedBy.length === 0 || value.paralyzedBy.length > 64)) return false;
  if (value.commanded !== undefined && value.commanded !== 'halt') return false;
  if (value.deafened !== undefined && !isInteger(value.deafened, 0, 100)) return false;
  if (value.fled !== undefined && typeof value.fled !== 'boolean') return false;
  if (value.surrendered !== undefined && typeof value.surrendered !== 'boolean') return false;
  if (value.deafenedBy !== undefined && (typeof value.deafenedBy !== 'string' || value.deafenedBy.length === 0 || value.deafenedBy.length > 64)) return false;
  if (value.slowed !== undefined && !isInteger(value.slowed, 0, 100)) return false;
  if (value.slowedBy !== undefined && (typeof value.slowedBy !== 'string' || value.slowedBy.length === 0 || value.slowedBy.length > 64)) return false;
  if (value.charmed !== undefined && !isInteger(value.charmed, 0, 100)) return false;
  if (value.charmedBy !== undefined && (typeof value.charmedBy !== 'string' || value.charmedBy.length === 0 || value.charmedBy.length > 64)) return false;
  if (value.blinded !== undefined && !isInteger(value.blinded, 0, 100)) return false;
  if (value.blindedBy !== undefined && (typeof value.blindedBy !== 'string' || value.blindedBy.length === 0 || value.blindedBy.length > 64)) return false;
  if (value.frightened !== undefined && !isInteger(value.frightened, 0, 100)) return false;
  if (value.frightenedBy !== undefined && (typeof value.frightenedBy !== 'string' || value.frightenedBy.length < 1 || value.frightenedBy.length > 64)) return false; if (value.surprised !== undefined && typeof value.surprised !== 'boolean') return false;
  if (value.aimed !== undefined && typeof value.aimed !== 'boolean') return false;
  if (value.suppressed !== undefined && typeof value.suppressed !== 'boolean') return false;
  if (value.mountedOn !== undefined && (typeof value.mountedOn !== 'string' || value.mountedOn.length === 0 || value.mountedOn.length > 64)) return false;
  if (value.riderId !== undefined && (typeof value.riderId !== 'string' || value.riderId.length === 0 || value.riderId.length > 64)) return false;
  if (value.mountSpeedFt !== undefined && !isInteger(value.mountSpeedFt, 0, 500)) return false;
  if (value.stats !== undefined) {
    if (typeof value.stats !== 'object' || value.stats === null) return false;
    for (const key of ['attacks', 'hits', 'crits', 'misses', 'damageDealt', 'damageTaken', 'healing']) {
      const entry = (value.stats as Record<string, unknown>)[key];
      if (entry !== undefined && !isInteger(entry, 0, 1000000)) return false;
    }
  }
  if (value.barkskin !== undefined && !isInteger(value.barkskin, 0, 100)) return false;
  if (value.barkskinBy !== undefined && (typeof value.barkskinBy !== 'string' || value.barkskinBy.length === 0 || value.barkskinBy.length > 64)) return false;
  if (value.aided !== undefined && !isInteger(value.aided, 0, 100)) return false;
  if (value.polymorphed !== undefined && !isInteger(value.polymorphed, 0, 100)) return false;
  if (value.polymorphedBy !== undefined && (typeof value.polymorphedBy !== 'string' || value.polymorphedBy.length === 0 || value.polymorphedBy.length > 64)) return false;
  if (value.revealed !== undefined && typeof value.revealed !== 'boolean') return false;
  if (value.warCaster !== undefined && typeof value.warCaster !== 'boolean') return false;
  if (value.counterspell !== undefined && typeof value.counterspell !== 'boolean') return false;
  if (value.guarding !== undefined && (typeof value.guarding !== 'string' || value.guarding.length === 0 || value.guarding.length > 64)) return false;
  if (value.items !== undefined && (!Array.isArray(value.items) || value.items.length > 20 || !value.items.every(isCombatItem))) return false;
  if (value.delayed !== undefined && typeof value.delayed !== 'boolean') return false;
  if (value.flying !== undefined && typeof value.flying !== 'boolean') return false;

  if (value.exhaustion !== undefined && !isInteger(value.exhaustion, 0, 6)) return false;
  if (value.spellSlots !== undefined && (!Array.isArray(value.spellSlots) || value.spellSlots.length > 9 || value.spellSlots.some(item => !isInteger(item, 0, 20)))) return false;
  if (value.spellSlotsMax !== undefined && (!Array.isArray(value.spellSlotsMax) || value.spellSlotsMax.length > 9 || value.spellSlotsMax.some(item => !isInteger(item, 0, 20)))) return false;
  if (value.reckless !== undefined && typeof value.reckless !== 'boolean') return false;
  if (value.speedPenaltyFt !== undefined && !isInteger(value.speedPenaltyFt, 0, 50)) return false;
  if (value.sapped !== undefined && typeof value.sapped !== 'boolean') return false;
  if (value.slowSourceId !== undefined && (typeof value.slowSourceId !== 'string' || !value.slowSourceId || value.slowSourceId.length > 64)) return false;
  if (value.vexTargetId !== undefined && (typeof value.vexTargetId !== 'string' || !value.vexTargetId || value.vexTargetId.length > 64)) return false;
  if (value.helpedAttack !== undefined && typeof value.helpedAttack !== 'boolean') return false;
    if (value.helpedCheck !== undefined && typeof value.helpedCheck !== 'boolean') return false;
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
  if (!isObject(value)) return false;
  if (typeof value.reactorId !== 'string' || value.reactorId.length === 0) return false;
  if (typeof value.targetId !== 'string' || value.targetId.length === 0) return false;
  const kind = value.kind;
  if (kind !== undefined && kind !== 'opportunity' && kind !== 'ready') return false;
  return true;
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
function isTerrain(value: unknown): value is Terrain {
  return value === 'normal' || value === 'underwater' || value === 'climbing' || value === 'ice' || value === 'lava';
}
function isHazard(value: unknown): value is Hazard {
  return isObject(value) && isInteger(value.x, 0, 59) && isInteger(value.y, 0, 59)
    && typeof value.damageExpression === 'string' && value.damageExpression.trim().length > 0 && value.damageExpression.length <= 40
    && typeof value.damageType === 'string' && (damageTypes as readonly string[]).includes(value.damageType);
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
    && (value.position === undefined || isPosition(value.position))
    && (value.elevation === undefined || isInteger(value.elevation, 0, 500));
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
function isAttackPreset(value: unknown): value is AttackPreset {
  for (const key of ['weaponId'] as const) {
    const item = (value as Record<string, unknown>)[key];
    if (item !== undefined && (typeof item !== 'string' || item.length === 0 || item.length > 64)) return false;
  }
  for (const key of ['sharpshooter', 'powerAttack', 'twoHanded'] as const) {
    const item = (value as Record<string, unknown>)[key];
    if (item !== undefined && typeof item !== 'boolean') return false;
  }
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || !value.id.length) return false;
  if (typeof value.name !== 'string' || !value.name.length || value.name.length > 30) return false;
  if (typeof value.attackerId !== 'string' || !value.attackerId.length) return false;
  if (typeof value.targetId !== 'string' || !value.targetId.length) return false;
  if (!isInteger(value.attackBonus, -10, 30)) return false;
  if (typeof value.damageExpression !== 'string' || !value.damageExpression.length) return false;
  if (!damageTypes.includes(value.damageType as DamageType)) return false;
  return value.range === 'melee' || value.range === 'ranged';
}
function isBattle(value: unknown): boolean {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string' && typeof value.createdAt === 'string'
    && Array.isArray(value.actors) && value.actors.every(isActor)
    && (value.combat === undefined || isCombatState(value.combat))
    && (value.grid === undefined || isGrid(value.grid))
    && (value.autoDeathSaves === undefined || typeof value.autoDeathSaves === 'boolean')
    && (value.enterReachOpportunity === undefined || typeof value.enterReachOpportunity === 'boolean')
    && (value.obscured === undefined || value.obscured === 'light' || value.obscured === 'heavy')
    && (value.terrain === undefined || isTerrain(value.terrain))
    && (value.weather === undefined || value.weather === 'rain' || value.weather === 'wind')
    && (value.difficult === undefined || (Array.isArray(value.difficult) && value.difficult.length <= 400 && value.difficult.every(isPosition)))
    && (value.walls === undefined || (Array.isArray(value.walls) && value.walls.length <= 400 && value.walls.every(isPosition)))
    && (value.cover === undefined || (Array.isArray(value.cover) && value.cover.length <= 400 && value.cover.every(isPosition)))
    && (value.hazards === undefined || (Array.isArray(value.hazards) && value.hazards.length <= 200 && value.hazards.every(isHazard)))
    && (value.grease === undefined || (Array.isArray(value.grease) && value.grease.length <= 400 && value.grease.every(isPosition)))
    && (value.fog === undefined || (Array.isArray(value.fog) && value.fog.length <= 400 && value.fog.every(isPosition)))
    && (value.fogBy === undefined || (typeof value.fogBy === 'string' && value.fogBy.length > 0 && value.fogBy.length <= 64))
    && (value.darkness === undefined || (Array.isArray(value.darkness) && value.darkness.length <= 400 && value.darkness.every(isPosition)))
    && (value.darknessBy === undefined || (typeof value.darknessBy === 'string' && value.darknessBy.length > 0 && value.darknessBy.length <= 64))
    && (value.silence === undefined || (Array.isArray(value.silence) && value.silence.length <= 400 && value.silence.every(isPosition)))
    && (value.silenceBy === undefined || (typeof value.silenceBy === 'string' && value.silenceBy.length > 0 && value.silenceBy.length <= 64))
    && (value.sleepCloud === undefined || (Array.isArray(value.sleepCloud) && value.sleepCloud.length <= 400 && value.sleepCloud.every(isPosition)))
    && (value.sleepCloudBy === undefined || (typeof value.sleepCloudBy === 'string' && value.sleepCloudBy.length > 0 && value.sleepCloudBy.length <= 64))
    && (value.webs === undefined || (Array.isArray(value.webs) && value.webs.length <= 400 && value.webs.every(isPosition)))
    && (value.entangle === undefined || (Array.isArray(value.entangle) && value.entangle.length <= 400 && value.entangle.every(isPosition)))
    && (value.entangleBy === undefined || (typeof value.entangleBy === 'string' && value.entangleBy.length > 0 && value.entangleBy.length <= 64))
    && (value.attackPresets === undefined || (Array.isArray(value.attackPresets) && value.attackPresets.length <= 10 && value.attackPresets.every(isAttackPreset)))
  && (value.pendingCast === undefined || isPendingCastPlan(value.pendingCast)) && (value.auras === undefined || (Array.isArray(value.auras) && value.auras.length <= 8 && value.auras.every(isAura)));
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



