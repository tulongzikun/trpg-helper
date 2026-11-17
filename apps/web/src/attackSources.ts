import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { damageTypes } from './battle.ts';
import type { Actor, DamageType } from './battle';
import type { AttackRange } from './combatModifiers.ts';

/** 攻击来源：怪物动作文本、角色装备中的武器，或按属性估算的兜底值。 */
export type AttackOrigin = 'monster-action' | 'character-action' | 'weapon' | 'estimate';
export type AttackSource = {
  id: string;
  label: string;
  attackBonus: number;
  damageExpression: string;
  damageType: DamageType;
  range: AttackRange;
  distanceFt: number;
  origin: AttackOrigin;
  /** 武器特性（重型、灵巧、双手等），仅装备武器来源有值。 */
  properties?: string[];
  /** 两用武器的双手伤害骰。 */
  versatileDamage?: string;
  /** 远程武器的最大射程（尺）。 */
  longRangeFt?: number;
  /** 投掷武器的常规射程（尺）：持有投掷特性的近战武器也能远程攻击。 */
  thrownRangeFt?: number;
  /** 投掷武器的最大射程（尺）。 */
  thrownMaxRangeFt?: number;
};
export type ParsedAttackText = {
  attackBonus?: number;
  damageExpression?: string;
  damageType?: DamageType;
  range?: AttackRange;
  distanceFt?: number;
};

const typePattern = damageTypes.join('|');
const dicePattern = String.raw`\d{1,2}\s*d\s*\d{1,3}(?:\s*[+-]\s*\d{1,3})?`;

function asDamageType(value: string | undefined): DamageType | undefined {
  return value && (damageTypes as string[]).includes(value) ? value as DamageType : undefined;
}
function normalizeDice(value: string): string {
  return value.replace(/\s+/g, '');
}
function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/**
 * 从中文攻击描述里解析加值、伤害骰、伤害类型与射程。
 * 支持「近战武器攻击：+5 命中，触及 5 尺……命中：7 (1d8 + 3) 钝击伤害」这类 SRD／怪物卡写法。
 */
export function parseAttackText(text: string): ParsedAttackText {
  const source = text ?? '';
  const parsed: ParsedAttackText = {};
  const bonus = source.match(/([+-]\s*\d{1,2})\s*命中/) ?? source.match(/命中\s*[:：]?\s*([+-]\s*\d{1,2})/) ?? source.match(/攻击加值\s*[:：]?\s*([+-]?\d{1,2})/);
  if (bonus) {
    const value = Number(bonus[1].replace(/\s+/g, ''));
    if (Number.isInteger(value)) parsed.attackBonus = value;
  }
  const rolled = source.match(new RegExp(`\\(\\s*(${dicePattern})\\s*\\)\\s*([^\\s，。；、]{1,6}?)\\s*伤害`))
    ?? source.match(new RegExp(`(${dicePattern})\\s*([^\\s，。；、]{1,6}?)\\s*伤害`));
  if (rolled) {
    parsed.damageExpression = normalizeDice(rolled[1]);
    const type = asDamageType(rolled[2]);
    if (type) parsed.damageType = type;
  }
  const reach = source.match(/触及\s*(\d{1,3})\s*尺/);
  const range = source.match(/射程\s*(\d{1,3})\s*(?:\/\s*\d{1,4})?\s*尺/);
  if (reach) {
    parsed.range = 'melee';
    parsed.distanceFt = Number(reach[1]);
  } else if (range) {
    parsed.range = 'ranged';
    parsed.distanceFt = Number(range[1]);
  } else if (/远程|射击/.test(source)) {
    parsed.range = 'ranged';
  }
  return parsed;
}

/** 怪物卡上的动作：只有能解析出加值与伤害骰的才成为攻击来源。 */
export function monsterAttackSources(actor: Actor): AttackSource[] {
  const actions = actor.template.actions ?? [];
  const sources: AttackSource[] = [];
  for (const action of actions) {
    const parsed = parseAttackText(action.description ?? '');
    if (parsed.attackBonus === undefined || !parsed.damageExpression) continue;
    const range = parsed.range ?? 'melee';
    sources.push({
      id: `action:${action.id}`,
      label: action.name,
      attackBonus: parsed.attackBonus,
      damageExpression: parsed.damageExpression,
      damageType: parsed.damageType ?? '钝击',
      range,
      distanceFt: parsed.distanceFt ?? (range === 'ranged' ? 30 : 5),
      origin: 'monster-action',
    });
  }
  return sources;
}

type Weapon = { name: string; aliases: string[]; damage: string; damageType: DamageType; ability: 'str' | 'dex' | 'best'; range: AttackRange; distanceFt: number; properties?: string[]; versatile?: string; longRangeFt?: number; thrownRangeFt?: number; thrownMaxRangeFt?: number };

/** 2024 常用武器表；命中加值 = 属性调整值 + 熟练加值，武器熟练未建模时按已熟练处理。 */
export const weapons: Weapon[] = [
  { name: '长剑', aliases: ['longsword'], damage: '1d8', damageType: '挥砍', ability: 'best', range: 'melee', distanceFt: 5, versatile: '1d10' },
  { name: '短剑', aliases: ['shortsword'], damage: '1d6', damageType: '穿刺', ability: 'best', range: 'melee', distanceFt: 5, properties: ['轻型'] },
  { name: '匕首', aliases: ['dagger'], damage: '1d4', damageType: '穿刺', ability: 'best', range: 'melee', distanceFt: 5, properties: ['轻型'] },
  { name: '刺剑', aliases: ['rapier'], damage: '1d8', damageType: '穿刺', ability: 'dex', range: 'melee', distanceFt: 5 },
  { name: '巨剑', aliases: ['greatsword'], damage: '2d6', damageType: '挥砍', ability: 'str', range: 'melee', distanceFt: 5, properties: ['重型', '双手'] },
  { name: '巨斧', aliases: ['greataxe'], damage: '1d12', damageType: '挥砍', ability: 'str', range: 'melee', distanceFt: 5, properties: ['重型', '双手'] },
  { name: '战锤', aliases: ['warhammer'], damage: '1d8', damageType: '钝击', ability: 'str', range: 'melee', distanceFt: 5, properties: ['重型'], versatile: '1d10' },
  { name: '长棍', aliases: ['quarterstaff'], damage: '1d6', damageType: '钝击', ability: 'best', range: 'melee', distanceFt: 5, properties: ['重型'], versatile: '1d8' },
  { name: '长矛', aliases: ['spear'], damage: '1d6', damageType: '穿刺', ability: 'str', range: 'melee', distanceFt: 5, versatile: '1d8', properties: ['投掷'], thrownRangeFt: 20, thrownMaxRangeFt: 60 },
  { name: '手斧', aliases: ['handaxe'], damage: '1d6', damageType: '挥砍', ability: 'str', range: 'melee', distanceFt: 5, properties: ['轻型', '投掷'], thrownRangeFt: 20, thrownMaxRangeFt: 60 },
  { name: '轻锤', aliases: ['light hammer'], damage: '1d4', damageType: '钝击', ability: 'str', range: 'melee', distanceFt: 5, properties: ['轻型', '投掷'], thrownRangeFt: 20, thrownMaxRangeFt: 60 },
  { name: '戟', aliases: ['halberd'], damage: '1d10', damageType: '挥砍', ability: 'str', range: 'melee', distanceFt: 10, properties: ['重型', '双手'] },
  { name: '长弓', aliases: ['longbow'], damage: '1d8', damageType: '穿刺', ability: 'dex', range: 'ranged', distanceFt: 150, longRangeFt: 600, properties: ['弹药'] },
  { name: '短弓', aliases: ['shortbow'], damage: '1d6', damageType: '穿刺', ability: 'dex', range: 'ranged', distanceFt: 80, longRangeFt: 320, properties: ['弹药'] },
  { name: '轻弩', aliases: ['light crossbow'], damage: '1d8', damageType: '穿刺', ability: 'dex', range: 'ranged', distanceFt: 80, longRangeFt: 320, properties: ['弹药', '装填'] },
  { name: '手弩', aliases: ['hand crossbow'], damage: '1d6', damageType: '穿刺', ability: 'dex', range: 'ranged', distanceFt: 30, longRangeFt: 120, properties: ['弹药', '轻型', '装填'] },
  { name: '投石索', aliases: ['sling'], damage: '1d4', damageType: '钝击', ability: 'dex', range: 'ranged', distanceFt: 30, longRangeFt: 120, properties: ['弹药'] },
  { name: '标枪', aliases: ['javelin'], damage: '1d6', damageType: '穿刺', ability: 'str', range: 'ranged', distanceFt: 30, longRangeFt: 120 },
];

function abilityScores(actor: Actor): Record<string, number> {
  return actor.characterSnapshot?.sheet.abilities ?? actor.template.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}
function proficiencyFor(actor: Actor): number {
  const level = actor.characterSnapshot?.sheet.level;
  return level === undefined ? (actor.template.proficiencyBonus ?? 2) : proficiencyBonus(Math.min(20, Math.max(1, level)));
}
function modifierFor(actor: Actor, ability: Weapon['ability']): number {
  const abilities = abilityScores(actor);
  const str = abilityModifier(abilities.str ?? 10);
  const dex = abilityModifier(abilities.dex ?? 10);
  if (ability === 'str') return str;
  if (ability === 'dex') return dex;
  return Math.max(str, dex);
}
function weaponSource(actor: Actor, weapon: Weapon): AttackSource {
  const modifier = modifierFor(actor, weapon.ability);
  const damage = modifier === 0 ? weapon.damage : `${weapon.damage}${signed(modifier)}`;
  return {
    id: `weapon:${weapon.name}`,
    label: weapon.name,
    attackBonus: modifier + proficiencyFor(actor),
    damageExpression: damage,
    damageType: weapon.damageType,
    range: weapon.range,
    distanceFt: weapon.distanceFt,
    origin: 'weapon',
    ...(weapon.properties ? { properties: weapon.properties } : {}),
    ...(weapon.versatile ? { versatileDamage: weapon.versatile } : {}),
    ...(weapon.longRangeFt ? { longRangeFt: weapon.longRangeFt } : {}),
    ...(weapon.thrownRangeFt ? { thrownRangeFt: weapon.thrownRangeFt } : {}),
    ...(weapon.thrownMaxRangeFt ? { thrownMaxRangeFt: weapon.thrownMaxRangeFt } : {}),
  };
}

/** 从角色装备文本里识别武器；同一把武器只出现一次。 */
export function characterWeaponSources(actor: Actor): AttackSource[] {
  const equipment = actor.characterSnapshot?.sheet.details?.equipment ?? '';
  if (!equipment.trim()) return [];
  const segments = equipment.split(/[、,，;；\n/|]+/).map(item => item.trim()).filter(Boolean);
  const used = new Set<string>();
  const sources: AttackSource[] = [];
  for (const segment of segments) {
    const weapon = weapons.find(item => !used.has(item.name) && (segment.includes(item.name) || item.aliases.some(alias => segment.toLowerCase().includes(alias))));
    if (!weapon) continue;
    used.add(weapon.name);
    sources.push(weaponSource(actor, weapon));
  }
  return sources;
}

/** 角色「攻击与法术」文本里的自定义攻击：每行以「名称：+X 命中……」给出。 */
export function characterTextSources(actor: Actor): AttackSource[] {
  const text = actor.characterSnapshot?.sheet.actions ?? '';
  if (!text.trim()) return [];
  const sources: AttackSource[] = [];
  for (const line of text.split(/\n+/).map(item => item.trim()).filter(Boolean)) {
    const parsed = parseAttackText(line);
    if (parsed.attackBonus === undefined || !parsed.damageExpression) continue;
    const label = line.split(/[：:]/)[0].trim().slice(0, 20) || '自定义攻击';
    const range = parsed.range ?? 'melee';
    sources.push({
      id: `text:${label}:${sources.length}`,
      label,
      attackBonus: parsed.attackBonus,
      damageExpression: parsed.damageExpression,
      damageType: parsed.damageType ?? '钝击',
      range,
      distanceFt: parsed.distanceFt ?? (range === 'ranged' ? 30 : 5),
      origin: 'character-action',
    });
  }
  return sources;
}

function estimateSource(actor: Actor): AttackSource {
  const modifier = modifierFor(actor, 'best');
  return {
    id: 'estimate:best',
    label: '按属性估算',
    attackBonus: modifier + proficiencyFor(actor),
    damageExpression: `1d8${modifier === 0 ? '' : signed(modifier)}`,
    damageType: '挥砍',
    range: 'melee',
    distanceFt: 5,
    origin: 'estimate',
  };
}

/** 界面的攻击来源候选：怪物动作 → 角色文本攻击 → 装备武器 → 按属性估算。 */
export function attackSources(actor: Actor): AttackSource[] {
  const sources = actor.characterSnapshot
    ? [...characterTextSources(actor), ...characterWeaponSources(actor)]
    : monsterAttackSources(actor);
  return sources.length ? sources : [estimateSource(actor)];
}

export const originLabels: Record<AttackOrigin, string> = {
  'monster-action': '怪物动作',
  'character-action': '角色文本',
  weapon: '装备武器',
  estimate: '属性估算',
};









