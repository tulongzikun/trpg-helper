import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { spellSlots } from './spellSlots.ts';
import { classSpellState } from './classSpellChoices.ts';
import { epicBoon } from './druidPaladinShared.ts';

// 邪术师职业与 4 个宗主在角色卡上可自动化的非战斗内容：次数、骰池与派生数值。
export type WarlockFeatureConfig = {
 epicBoon?: string;
 hexAbility?: string;
 fiendResistance?: string;
};

export function warlockConfig(draft: CharacterDraft): WarlockFeatureConfig {
 return (draft.details?.fighterCalculator ?? {}) as WarlockFeatureConfig;
}

type WarlockConfigRecord = NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;

export function patchWarlockConfig(draft: CharacterDraft, patch: WarlockFeatureConfig): CharacterDraft {
 const details = draft.details;
 if (!details) return draft;
 return { ...draft, details: { ...details, fighterCalculator: { ...details.fighterCalculator, ...patch } as WarlockConfigRecord } };
}

export function isWarlock(draft: CharacterDraft) {
 return draft.details?.fighterCalculator?.characterClass === '邪术师';
}

export function warlockSubclass(draft: CharacterDraft): string | undefined {
 const c = draft.details?.fighterCalculator;
 return c?.characterClass === '邪术师' ? c.subclass : undefined;
}

// 脆弱诅咒可选的属性；骇异恶咒让目标对该属性的豁免具有劣势。
export const hexAbilities = ['力量', '敏捷', '体质', '智力', '感知', '魅力'] as const;

// 邪魔体魄可选的伤害类型（力场除外）。
export const fiendResistanceTypes = ['强酸', '寒冷', '火焰', '闪电', '毒素', '雷鸣'] as const;

export function charismaModifier(draft: CharacterDraft) {
 return abilityModifier(draft.abilities.cha);
}

export function celestialHealingDice(level: number) {
 return Math.max(0, 1 + level);
}

export function feyStepsUses(draft: CharacterDraft) {
 return Math.max(1, charismaModifier(draft));
}

export function darkLuckUses(draft: CharacterDraft) {
 return Math.max(1, charismaModifier(draft));
}

export function darkBlessingTempHp(draft: CharacterDraft) {
 return Math.max(1, draft.level + charismaModifier(draft));
}

export function celestialResilienceTempHp(draft: CharacterDraft) {
 return Math.max(1, draft.level + charismaModifier(draft));
}

export function awakenMindRangeMiles(draft: CharacterDraft) {
 return Math.max(1, charismaModifier(draft));
}

export function supernaturalDefenseDc(draft: CharacterDraft) {
 return 8 + charismaModifier(draft) + proficiencyBonus(draft.level);
}

// 玄奥秘法：按已解锁环阶列出所选秘法与每项 1 次/长休的可使用次数。
export function arcanumEntries(draft: CharacterDraft) {
 const slots = spellSlots(draft);
 const state = classSpellState(draft);
 if (slots?.kind !== 'pact') return [] as { level: number; name: string }[];
 return slots.arcanumLevels.map((level) => ({ level, name: state?.arcanum?.[String(level)] ?? '' })).filter((entry) => entry.name.trim());
}

export type WarlockFeatureState = {
 level: number;
 subclass?: string;
 epicBoon: string;
 hexAbility: string;
 fiendResistance: string;
 arcanum: { level: number; name: string }[];
 derived: {
  charismaModifier: number;
  pactSpellSaveDc: number;
  celestialHealingDice: number;
  feyStepsUses: number;
  darkLuckUses: number;
  darkBlessingTempHp: number;
  celestialResilienceTempHp: number;
  awakenMindRangeMiles: number;
 };
 errors: string[];
};

export function warlockFeatureState(draft: CharacterDraft): WarlockFeatureState {
 const c = warlockConfig(draft);
 const level = draft.level;
 const subclass = warlockSubclass(draft);
 const errors: string[] = [];
 const chosenBoon = epicBoon(draft);
 const hexAbility = typeof c.hexAbility === 'string' ? c.hexAbility : '';
 const fiendResistance = typeof c.fiendResistance === 'string' ? c.fiendResistance : '';
 if (isWarlock(draft)) {
  if (chosenBoon && level < 19) errors.push('传奇恩惠需 19 级才能选择。');
  if (hexAbility && !hexAbilities.includes(hexAbility as (typeof hexAbilities)[number])) errors.push('骇异恶咒选择的属性无效。');
  if (fiendResistance && !fiendResistanceTypes.includes(fiendResistance as (typeof fiendResistanceTypes)[number])) errors.push('邪魔体魄选择的伤害类型无效。');
  if (fiendResistance && !(subclass === 'fiend' && level >= 10)) errors.push('邪魔体魄的抗性需邪魔宗主 10 级。');
  const arcanum = arcanumEntries(draft);
  const slots = spellSlots(draft);
  if (slots?.kind === 'pact' && arcanum.length < slots.arcanumLevels.length) {
   errors.push('已解锁的每个秘法环阶都需要选择一道秘法法术。');
  }
 }
 return {
  level, subclass, epicBoon: chosenBoon, hexAbility, fiendResistance,
  arcanum: arcanumEntries(draft),
  derived: {
   charismaModifier: charismaModifier(draft),
   pactSpellSaveDc: supernaturalDefenseDc(draft),
   celestialHealingDice: celestialHealingDice(level),
   feyStepsUses: feyStepsUses(draft),
   darkLuckUses: darkLuckUses(draft),
   darkBlessingTempHp: darkBlessingTempHp(draft),
   celestialResilienceTempHp: celestialResilienceTempHp(draft),
   awakenMindRangeMiles: awakenMindRangeMiles(draft),
  },
  errors,
 };
}

// 角色卡只显示与当前宗主相关的数值；法术位与祈唤由各自界面负责。
export function warlockSheetLines(draft: CharacterDraft): string[] {
 if (!isWarlock(draft)) return [];
 const state = warlockFeatureState(draft);
 const lines: string[] = [];
 const slots = spellSlots(draft);
 if (slots?.kind === 'pact') lines.push(`契约魔法：${slots.count} 枚 ${slots.slotLevel} 环契约法术位（短休或长休恢复全部）`);
 if (state.epicBoon) lines.push(`传奇恩惠：${state.epicBoon}`);
 if (state.arcanum.length) {
  lines.push(`玄奥秘法：${state.arcanum.map((entry) => `${entry.name}（${entry.level} 环，1 次/长休）`).join('；')}`);
 }
 if (state.subclass === 'archfey') {
  lines.push(`妖精步伐：${state.derived.feyStepsUses} 次/长休（免费迷踪步）`);
  if (state.level >= 6) lines.push('雾遁：受伤时可用反应施展迷踪步，并附带无踪步伐或惊惧步伐');
  if (state.level >= 10) lines.push('斗转星移：免疫魅惑；被命中时可反应减半伤害并反伤，1 次/长休（可消耗契约法术位重置）');
  if (state.level >= 14) lines.push('醉心魔法：消耗法术位施展惑控或幻术法术时可免费附带迷踪步');
 }
 if (state.subclass === 'celestial') {
  lines.push(`治愈之光：骰池 ${state.derived.celestialHealingDice} 枚 d6，附赠动作治疗，单次最多消耗 ${Math.max(1, state.derived.charismaModifier)} 枚，长休恢复`);
  if (state.level >= 6) lines.push('光耀之魂：光耀抗性；每回合一次法术造成光耀或火焰伤害时，对一个目标加魅力调整值');
  if (state.level >= 10) lines.push(`天界韧性：短休或长休后获得 ${state.derived.celestialResilienceTempHp} 点临时生命，并可分给至多 5 个生物`);
  if (state.level >= 14) lines.push('灼光复仇：60 尺内生物将进行死亡豁免时，可恢复其半数生命并造成光耀伤害，1 次/长休');
 }
 if (state.subclass === 'fiend') {
  lines.push(`黑暗赐福：把敌人降至 0 时获得 ${state.derived.darkBlessingTempHp} 点临时生命`);
  if (state.level >= 6) lines.push(`黑暗强运：属性检定或豁免 +d10，${state.derived.darkLuckUses} 次/长休`);
  if (state.level >= 10) lines.push(`邪魔体魄：短休或长休后选择一种伤害类型获得抗性（当前：${state.fiendResistance || '未选'}）`);
  if (state.level >= 14) lines.push('直坠噩梦：攻击命中时迫使目标魅力豁免，失败被放逐并受心灵伤害，1 次/长休（可消耗契约法术位重置）');
 }
 if (state.subclass === 'great-old-one') {
  lines.push(`唤醒心灵：与 30 尺内生物建立心灵连结，范围 ${state.derived.awakenMindRangeMiles} 英里，持续 ${state.level} 分钟`);
  if (state.level >= 6) lines.push('锐眼斗士：建立心灵连结时可迫使目标感知豁免，失败则连结期间你对其攻击有优势，1 次/短长休');
  if (state.level >= 10) lines.push(`骇异恶咒：始终准备脆弱诅咒；所选属性（${state.hexAbility || '未选'}）的豁免具有劣势`);
  if (state.level >= 10) lines.push('思维之盾：心灵伤害抗性，思维不可被读取，受心灵伤害时攻击者受等量伤害');
  if (state.level >= 14) lines.push('创造奴仆：施展异怪召唤术时可不需专注 1 分钟，召唤物获得临时生命');
 }
 return lines;
}
