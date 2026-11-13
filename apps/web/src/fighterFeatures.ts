import type { CharacterDraft } from './characters';
import { proficiencyBonus } from './characterRules.ts';
import { artisanTools } from './tools2024.ts';

// 战士职业与 4 个子职在角色卡上可自动化的非战斗内容：选择项、次数上限与派生数值。
export type FighterFeatureConfig = {
 fightingStyles?: string[];
 weaponMastery?: string[];
 epicBoon?: string;
 maneuvers?: string[];
 martialTool?: string;
 martialSkill?: string;
 weaponBond?: string[];
};

export function fighterConfig(draft: CharacterDraft): FighterFeatureConfig {
 const c = draft.details?.fighterCalculator;
 return (c ?? {}) as FighterFeatureConfig;
}

type FighterConfigRecord = NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;

export function patchFighterConfig(draft: CharacterDraft, patch: FighterFeatureConfig): CharacterDraft {
 const details = draft.details;
 if (!details) return draft;
 return { ...draft, details: { ...details, fighterCalculator: { ...details.fighterCalculator, ...patch } as FighterConfigRecord } };
}

export function isFighter(draft: CharacterDraft) {
 return draft.details?.fighterCalculator?.characterClass === '战士';
}

export function fighterSubclass(draft: CharacterDraft): string | undefined {
 const c = draft.details?.fighterCalculator;
 return c?.characterClass === '战士' ? c.subclass : undefined;
}

export const fightingStyles = [
 { id: 'archery', name: '箭术', note: '远程武器攻击检定 +2。' },
 { id: 'blind-fighting', name: '盲斗', note: '10 尺内看不见的生物不因隐形获得攻击优势；可察觉未藏匿的隐形生物。' },
 { id: 'defense', name: '防御', note: '着装护甲时 AC +1。' },
 { id: 'dueling', name: '决斗', note: '单手持一把近战武器且另一手无武器时，伤害 +2。' },
 { id: 'great-weapon-fighting', name: '巨武器战斗', note: '双手持握武器时，伤害骰的 1 或 2 可按 3 结算。' },
 { id: 'interception', name: '拦截', note: '持盾或武器时，可用反应减少 5 尺内生物受到的伤害。' },
 { id: 'protection', name: '守护', note: '持盾时，可用反应令 5 尺内对他人的攻击检定具有劣势。' },
 { id: 'thrown-weapon-fighting', name: '投掷武器战斗', note: '投掷武器攻击检定 +2。' },
 { id: 'two-weapon-fighting', name: '双武器战斗', note: '双武器攻击的额外那次攻击可把属性调整值加入伤害。' },
 { id: 'unarmed-fighting', name: '徒手战斗', note: '徒手打击伤害骰提高，并可对受擒目标追加伤害。' },
] as const;

// 2024 武器精通词条；角色卡在选择武器后直接展示对应词条，战斗内结算仍需人工。
export const weapons = [
 { id: 'club', name: '短棒', property: '缓速' },
 { id: 'dagger', name: '匕首', property: '迅击' },
 { id: 'greatclub', name: '巨棒', property: '推离' },
 { id: 'handaxe', name: '手斧', property: '侵扰' },
 { id: 'javelin', name: '标枪', property: '缓速' },
 { id: 'light-hammer', name: '轻锤', property: '迅击' },
 { id: 'mace', name: '硬头锤', property: '削弱' },
 { id: 'quarterstaff', name: '长棍', property: '击倒' },
 { id: 'sickle', name: '镰刀', property: '迅击' },
 { id: 'spear', name: '矛', property: '削弱' },
 { id: 'dart', name: '飞镖', property: '侵扰' },
 { id: 'light-crossbow', name: '轻弩', property: '缓速' },
 { id: 'shortbow', name: '短弓', property: '侵扰' },
 { id: 'sling', name: '投石索', property: '缓速' },
 { id: 'battleaxe', name: '战斧', property: '击倒' },
 { id: 'flail', name: '连枷', property: '削弱' },
 { id: 'glaive', name: '长柄刀', property: '劈斩' },
 { id: 'greataxe', name: '巨斧', property: '劈斩' },
 { id: 'greatsword', name: '巨剑', property: '擦伤' },
 { id: 'halberd', name: '戟', property: '劈斩' },
 { id: 'lance', name: '骑枪', property: '击倒' },
 { id: 'longsword', name: '长剑', property: '削弱' },
 { id: 'maul', name: '巨锤', property: '击倒' },
 { id: 'morningstar', name: '晨星', property: '削弱' },
 { id: 'pike', name: '长矛', property: '推离' },
 { id: 'rapier', name: '刺剑', property: '侵扰' },
 { id: 'scimitar', name: '弯刀', property: '迅击' },
 { id: 'shortsword', name: '短剑', property: '侵扰' },
 { id: 'trident', name: '三叉戟', property: '击倒' },
 { id: 'war-pick', name: '战镐', property: '削弱' },
 { id: 'warhammer', name: '战锤', property: '推离' },
 { id: 'whip', name: '鞭', property: '缓速' },
 { id: 'blowgun', name: '吹箭筒', property: '侵扰' },
 { id: 'hand-crossbow', name: '手弩', property: '侵扰' },
 { id: 'heavy-crossbow', name: '重弩', property: '推离' },
 { id: 'longbow', name: '长弓', property: '缓速' },
] as const;

export const maneuvers = [
 '伏击', '换位诈术', '指挥官奇袭', '领导风范', '缴械攻击', '扰乱打击', '灵巧步法', '诡诈攻击', '挑衅攻击', '突刺攻击',
 '灵动攻击', '恐吓攻击', '格挡', '精准攻击', '推撞攻击', '重整旗鼓', '反击', '横扫攻击', '战术预估', '摔绊攻击',
] as const;

export const fighterSkills = ['体操', '驯兽', '运动', '历史', '洞悉', '威吓', '察觉', '游说', '求生'] as const;

// 灵能骰：3 级起 4d6，随等级提升数量与骰面。
export const psiDieTable = [
 { level: 3, count: 4, die: 6 }, { level: 5, count: 6, die: 6 }, { level: 7, count: 6, die: 8 }, { level: 9, count: 8, die: 8 },
 { level: 11, count: 8, die: 10 }, { level: 13, count: 10, die: 10 }, { level: 15, count: 10, die: 12 }, { level: 17, count: 12, die: 12 },
] as const;

export function fightingStyleLimit(draft: CharacterDraft) {
 return fighterSubclass(draft) === 'champion' && draft.level >= 7 ? 2 : 1;
}

export function weaponMasteryLimit(level: number) {
 return level >= 13 ? 6 : level >= 9 ? 5 : level >= 4 ? 4 : 3;
}

export function maneuverLimit(level: number) {
 return level >= 15 ? 9 : level >= 10 ? 7 : level >= 7 ? 5 : level >= 3 ? 3 : 0;
}

export function superiorityDice(level: number) {
 return { count: level >= 15 ? 6 : level >= 7 ? 5 : 4, die: level >= 18 ? 12 : level >= 10 ? 10 : 8 };
}

export function psiDie(level: number) {
 let current: { count: number; die: number } | null = null;
 for (const row of psiDieTable) if (level >= row.level) current = { count: row.count, die: row.die };
 return current;
}

export function criticalRange(draft: CharacterDraft): [number, number] | null {
 if (fighterSubclass(draft) !== 'champion' || draft.level < 3) return null;
 return draft.level >= 15 ? [18, 20] : [19, 20];
}

export function weaponMasteryLabel(id: string) {
 const weapon = weapons.find((item) => item.id === id);
 return weapon ? `精通武器：${weapon.name}（${weapon.property}）` : undefined;
}

export type FighterFeatureState = {
 level: number;
 subclass?: string;
 fightingStyles: string[];
 weaponMastery: string[];
 epicBoon: string;
 maneuvers: string[];
 martialTool: string;
 martialSkill: string;
 weaponBond: string[];
 limits: {
  fightingStyles: number;
  weaponMastery: number;
  maneuvers: number;
  superiorityDice: { count: number; die: number };
  psiDie: { count: number; die: number } | null;
  criticalRange: [number, number] | null;
 };
 masteryLines: string[];
 errors: string[];
};

export function fighterFeatureState(draft: CharacterDraft): FighterFeatureState {
 const c = fighterConfig(draft);
 const level = draft.level;
 const subclass = fighterSubclass(draft);
 const styles = Array.isArray(c.fightingStyles) ? c.fightingStyles : [];
 const mastery = Array.isArray(c.weaponMastery) ? c.weaponMastery : [];
 const chosenManeuvers = Array.isArray(c.maneuvers) ? c.maneuvers : [];
 const bond = Array.isArray(c.weaponBond) ? c.weaponBond : [];
 const epicBoon = typeof c.epicBoon === 'string' ? c.epicBoon : '';
 const errors: string[] = [];
 const styleLimit = fightingStyleLimit(draft);
 const masteryLimit = weaponMasteryLimit(level);
 if (isFighter(draft)) {
  if (styles.length > styleLimit) errors.push(`战斗风格最多选择 ${styleLimit} 项。`);
  if (new Set(styles).size !== styles.length) errors.push('战斗风格不能重复选择。');
  if (styles.some((id) => !fightingStyles.some((item) => item.id === id))) errors.push('战斗风格选项无效。');
  if (mastery.length > masteryLimit) errors.push(`武器精通最多选择 ${masteryLimit} 种武器。`);
  if (new Set(mastery).size !== mastery.length) errors.push('武器精通不能重复选择同一种武器。');
  if (mastery.some((id) => !weapons.some((item) => item.id === id))) errors.push('武器精通选项无效。');
  if (epicBoon && level < 19) errors.push('传奇恩惠需 19 级才能选择。');
  if (subclass === 'battle-master') {
   if (chosenManeuvers.length > maneuverLimit(level)) errors.push(`战技最多习得 ${maneuverLimit(level)} 项。`);
   if (new Set(chosenManeuvers).size !== chosenManeuvers.length) errors.push('战技不能重复习得。');
   if (chosenManeuvers.some((name) => !maneuvers.includes(name as (typeof maneuvers)[number]))) errors.push('战技选项无效。');
   if (typeof c.martialTool === 'string' && c.martialTool && !artisanTools.includes(c.martialTool)) errors.push('战争学者的工匠工具无效。');
   if (typeof c.martialSkill === 'string' && c.martialSkill && !fighterSkills.includes(c.martialSkill as (typeof fighterSkills)[number])) errors.push('战争学者的技能选项必须来自战士技能列表。');
  }
  if (subclass === 'eldritch-knight' && level >= 3) {
   if (bond.filter((name) => typeof name === 'string' && name.trim()).length > 2) errors.push('战争联结最多联结两把武器。');
  }
 }
 const masteryLines = mastery.filter((id) => weapons.some((item) => item.id === id)).map((id) => weaponMasteryLabel(id)!);
 return {
  level, subclass, fightingStyles: styles, weaponMastery: mastery, epicBoon, maneuvers: chosenManeuvers,
  martialTool: typeof c.martialTool === 'string' ? c.martialTool : '',
  martialSkill: typeof c.martialSkill === 'string' ? c.martialSkill : '',
  weaponBond: bond.filter((name) => typeof name === 'string' && name.trim()),
  limits: {
   fightingStyles: styleLimit, weaponMastery: masteryLimit, maneuvers: maneuverLimit(level),
   superiorityDice: superiorityDice(level), psiDie: psiDie(level), criticalRange: criticalRange(draft),
  },
  masteryLines, errors,
 };
}

// 角色卡只显示与当前职业/子职相关的派生值，避免其他职业角色出现战士内容。
export function fighterSheetLines(draft: CharacterDraft): string[] {
 if (!isFighter(draft)) return [];
 const state = fighterFeatureState(draft);
 const lines: string[] = [];
 const styleNames = state.fightingStyles.map((id) => fightingStyles.find((item) => item.id === id)?.name ?? id);
 if (styleNames.length) lines.push(`战斗风格：${styleNames.join('、')}`);
 if (state.masteryLines.length) lines.push(state.masteryLines.join('；'));
 if (state.epicBoon) lines.push(`传奇恩惠：${state.epicBoon}`);
 if (state.subclass === 'battle-master') {
  const dice = state.limits.superiorityDice;
  lines.push(`卓越骰：${dice.count} 枚 d${dice.die}（短休或长休恢复全部）；战技 ${state.maneuvers.length} / ${state.limits.maneuvers} 项`);
  if (state.martialTool || state.martialSkill) lines.push(`战争学者：工匠工具 ${state.martialTool || '未选'}；技能 ${state.martialSkill || '未选'}`);
  lines.push(`战技豁免 DC：8 + 力量或敏捷调整值 + 熟练加值（当前熟练 +${proficiencyBonus(draft.level)}）`);
 }
 if (state.subclass === 'champion') {
  const range = state.limits.criticalRange;
  if (range) lines.push(`重击范围：d20 掷出 ${range[0]}–${range[1]} 即为重击（武器或徒手打击）`);
 }
 if (state.subclass === 'eldritch-knight') {
  lines.push(`战争联结：${state.weaponBond.length} / 2 把武器`);
 }
 if (state.subclass === 'psi-warrior') {
  const die = state.limits.psiDie;
  if (die) lines.push(`灵能骰：${die.count} 枚 d${die.die}（短休恢复 1 枚，长休恢复全部）`);
 }
 return lines;
}
