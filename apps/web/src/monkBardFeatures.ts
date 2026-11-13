import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { derivedCharacter } from './characterDerived.ts';
import { changeClassResource, classResources } from './classResources.ts';
import { changeSpellSlot, spellSlotResources } from './spellSlotResources.ts';
// 武僧 + 吟游诗人（含子职业）在角色卡上可自动计算或可记录的部分。
// 纯函数，不渲染界面、不做战斗轮内结算；战斗结算与主持人裁定仍由玩家手动处理。

export type ElementalDamage = '强酸' | '寒冷' | '火焰' | '闪电' | '雷鸣';
export const elementalDamageTypes: ElementalDamage[] = ['强酸', '寒冷', '火焰', '闪电', '雷鸣'];
export type MonkBardFlagState = { elementalAttunement: boolean; elementalResistance: ElementalDamage | '' };

type FighterConfig = NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;
type StoredFlagState = { elementalAttunement?: boolean; elementalResistance?: string };
type ConfigWithState = FighterConfig & { monkBard?: StoredFlagState };

function configOf(draft: CharacterDraft): ConfigWithState | undefined {
  return draft.details?.fighterCalculator as ConfigWithState | undefined;
}
function className(draft: CharacterDraft) {
  return draft.details?.fighterCalculator?.characterClass ?? '';
}
function subclassName(draft: CharacterDraft) {
  return draft.details?.fighterCalculator?.subclass ?? '';
}
function spentOf(draft: CharacterDraft, id: string) {
  const raw = configOf(draft)?.classResourceSpent?.[id];
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

export function martialArtsDie(level: number) {
  return level >= 17 ? 'd12' : level >= 11 ? 'd10' : level >= 5 ? 'd8' : 'd6';
}
export function bardInspirationDie(level: number) {
  return level >= 15 ? 'd12' : level >= 10 ? 'd10' : level >= 5 ? 'd8' : 'd6';
}
export function monkFocusMaximum(draft: CharacterDraft) {
  return className(draft) === '武僧' && draft.level >= 2 ? draft.level : 0;
}
export function bardInspirationMaximum(draft: CharacterDraft) {
  return className(draft) === '吟游诗人' ? Math.max(1, abilityModifier(draft.abilities.cha)) : 0;
}
export function monkFocusSaveDC(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || draft.level < 2) return null;
  return 8 + proficiencyBonus(draft.level) + abilityModifier(draft.abilities.wis);
}
export function bardSpellSaveDC(draft: CharacterDraft) {
  if (className(draft) !== '吟游诗人') return null;
  return 8 + proficiencyBonus(draft.level) + abilityModifier(draft.abilities.cha);
}
// 无甲防御：10 + 敏捷 + 感知（无甲且无盾）。
export function monkUnarmoredArmorClass(draft: CharacterDraft) {
  const c = configOf(draft);
  if (className(draft) !== '武僧' || !c || c.armor !== 'none' || c.shield) return null;
  return 10 + abilityModifier(draft.abilities.dex) + abilityModifier(draft.abilities.wis);
}
// 舞蹈学院：10 + 敏捷 + 魅力（无甲且无盾）。
export function danceArmorClass(draft: CharacterDraft) {
  const c = configOf(draft);
  if (className(draft) !== '吟游诗人' || subclassName(draft) !== 'dance' || draft.level < 3 || !c || c.armor !== 'none' || c.shield) return null;
  return 10 + abilityModifier(draft.abilities.dex) + abilityModifier(draft.abilities.cha);
}
// 无甲移动：2 级 +10，6 级 +15，10 级 +20，14 级 +25，18 级 +30。
export function monkUnarmoredMovementBonus(draft: CharacterDraft) {
  const c = configOf(draft);
  if (className(draft) !== '武僧' || draft.level < 2 || !c || c.armor !== 'none' || c.shield) return 0;
  return 5 * (Math.floor((Math.min(draft.level, 18) - 2) / 4) + 2);
}
export function bardicInspirationRemaining(draft: CharacterDraft) {
  const maximum = bardInspirationMaximum(draft);
  return maximum ? Math.max(0, maximum - spentOf(draft, 'bard-inspiration')) : 0;
}
export function monkFocusRemaining(draft: CharacterDraft) {
  const maximum = monkFocusMaximum(draft);
  return maximum ? Math.max(0, maximum - spentOf(draft, 'monk-focus')) : 0;
}

export function monkBardState(draft: CharacterDraft): MonkBardFlagState {
  const stored = configOf(draft)?.monkBard;
  const resistance = stored?.elementalResistance;
  return {
    elementalAttunement: stored?.elementalAttunement === true,
    elementalResistance: elementalDamageTypes.includes(resistance as ElementalDamage) ? (resistance as ElementalDamage) : '',
  };
}
// 把可切换状态写回 fighterCalculator.monkBard（characters.ts 的正式字段由 Lead 合并补齐）。
export function setMonkBardState(draft: CharacterDraft, patch: Partial<MonkBardFlagState>): CharacterDraft {
  const details = draft.details, c = configOf(draft);
  if (!details || !c) return draft;
  const next: ConfigWithState = { ...c, monkBard: { ...monkBardState(draft), ...patch } };
  return { ...draft, details: { ...details, fighterCalculator: next } };
}

function spentNotFound(draft: CharacterDraft, id: string) {
  return spentOf(draft, id) > 0;
}
function setSpent(draft: CharacterDraft, values: Record<string, number>): CharacterDraft {
  const details = draft.details, c = configOf(draft);
  if (!details || !c) return draft;
  const spent = { ...c.classResourceSpent };
  for (const [id, value] of Object.entries(values)) spent[id] = Math.max(0, value);
  const next: ConfigWithState = { ...c, classResourceSpent: spent };
  return { ...draft, details: { ...details, fighterCalculator: next } };
}

// 运转周天：投先攻时重获全部功力并恢复「武艺骰 + 武僧等级」生命值；每长休一次。
export function useUncannyMetabolism(draft: CharacterDraft): CharacterDraft {
  if (className(draft) !== '武僧' || draft.level < 2) return draft;
  if (spentOf(draft, 'monk-uncanny-metabolism') > 0) return draft;
  return setSpent(draft, { 'monk-focus': 0, 'monk-uncanny-metabolism': 1 });
}
export function uncannyMetabolismHealing(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || draft.level < 2) return null;
  return { dice: `1${martialArtsDie(draft.level)}`, bonus: draft.level };
}
// 明镜止水：先攻且未使用运转周天、功力剩余不超过 3 时，恢复至 4 点。
export function usePerfectFocus(draft: CharacterDraft): CharacterDraft {
  if (className(draft) !== '武僧' || draft.level < 15) return draft;
  if (spentNotFound(draft, 'monk-uncanny-metabolism')) return draft;
  if (monkFocusRemaining(draft) > 3) return draft;
  return setSpent(draft, { 'monk-focus': Math.max(0, draft.level - 4) });
}
// 先发激励：投先攻时若激励次数不足 2，补至 2 次。
export function useSuperiorInspiration(draft: CharacterDraft): CharacterDraft {
  if (className(draft) !== '吟游诗人' || draft.level < 18) return draft;
  const maximum = bardInspirationMaximum(draft);
  if (bardicInspirationRemaining(draft) >= 2) return draft;
  return setSpent(draft, { 'bard-inspiration': Math.max(0, maximum - 2) });
}
// 激励之源：消耗一个法术位（无需动作）恢复一次激励。
export function spendSpellSlotForInspiration(draft: CharacterDraft, slotLevel?: number): CharacterDraft {
  if (className(draft) !== '吟游诗人' || draft.level < 5) return draft;
  const maximum = bardInspirationMaximum(draft);
  if (bardicInspirationRemaining(draft) >= maximum) return draft;
  const slot = spellSlotResources(draft)
    .filter(s => s.id.includes(':slot:') && s.remaining > 0 && (slotLevel === undefined || s.id.endsWith(`:${slotLevel}`)))
    .sort((a, b) => Number(a.id.split(':').at(-1)) - Number(b.id.split(':').at(-1)))[0];
  if (!slot) return draft;
  return changeClassResource(changeSpellSlot(draft, slot.id, 1), 'bard-inspiration', -1);
}
// 惑心魔法：消耗一次激励重置该特性（无需动作）。
export function spendInspirationToResetBeguiling(draft: CharacterDraft): CharacterDraft {
  if (className(draft) !== '吟游诗人' || subclassName(draft) !== 'glamour' || draft.level < 3) return draft;
  if (bardicInspirationRemaining(draft) < 1 || spentOf(draft, 'bard-glamour-beguiling') < 1) return draft;
  return changeClassResource(changeClassResource(draft, 'bard-glamour-beguiling', -1), 'bard-inspiration', 1);
}
// 威仪作锦：消耗一个三环或更高法术位重置该特性。
export function spendSlotToResetMajesty(draft: CharacterDraft): CharacterDraft {
  if (className(draft) !== '吟游诗人' || subclassName(draft) !== 'glamour' || draft.level < 6) return draft;
  if (spentOf(draft, 'bard-glamour-majesty') < 1) return draft;
  const slot = spellSlotResources(draft)
    .filter(s => s.id.includes(':slot:') && s.remaining > 0 && Number(s.id.split(':').at(-1)) >= 3)
    .sort((a, b) => Number(a.id.split(':').at(-1)) - Number(b.id.split(':').at(-1)))[0];
  if (!slot) return draft;
  return changeClassResource(changeSpellSlot(draft, slot.id, 1), 'bard-glamour-majesty', -1);
}

export type AlwaysPreparedEntry = { name: string; source: string; detail: string };
// 各子职业的常备法术/戏法（角色卡上只列事实，不占准备数量）。
export function alwaysPreparedMonkBard(draft: CharacterDraft): AlwaysPreparedEntry[] {
  const cls = className(draft), sub = subclassName(draft), level = draft.level, out: AlwaysPreparedEntry[] = [];
  if (cls === '吟游诗人') {
    if (sub === 'glamour' && level >= 3) {
      out.push({ name: '魅惑类人', source: '惑心魔法', detail: '始终准备，不占吟游诗人准备法术数量。' });
      out.push({ name: '镜影术', source: '惑心魔法', detail: '始终准备，不占吟游诗人准备法术数量。' });
    }
    if (sub === 'glamour' && level >= 6) out.push({ name: '命令术', source: '威仪作锦', detail: '始终准备；可控时以附赠动作免法术位施放。' });
    if (level >= 20) {
      out.push({ name: '律令医疗', source: '创生圣言', detail: '始终准备，可额外指定 10 尺内第二个目标。' });
      out.push({ name: '律令死亡', source: '创生圣言', detail: '始终准备，可额外指定 10 尺内第二个目标。' });
    }
  }
  if (cls === '武僧') {
    if (sub === 'shadow' && level >= 3) out.push({ name: '次级幻象', source: '暗影技艺', detail: '戏法，施法属性为感知。' });
    if (sub === 'elements' && level >= 3) out.push({ name: '四象法门', source: '掌控元素', detail: '戏法，施法属性为感知。' });
  }
  return out;
}

// 元素同调与四象系列。
export function elementalAttunementActive(draft: CharacterDraft) {
  return className(draft) === '武僧' && subclassName(draft) === 'elements' && draft.level >= 3 && monkBardState(draft).elementalAttunement;
}
export function elementalReachBonus(draft: CharacterDraft) {
  return elementalAttunementActive(draft) ? 10 : 0;
}
export function elementalFlySpeed(draft: CharacterDraft) {
  if (!elementalAttunementActive(draft) || draft.level < 11) return 0;
  const derived = derivedCharacter(draft);
  return derived ? derived.currentSpeed : draft.speedFt;
}
export function elementalResistance(draft: CharacterDraft) {
  return elementalAttunementActive(draft) && draft.level >= 17 ? monkBardState(draft).elementalResistance : '';
}
// 四象神通：疾步如风时速度 +20 尺，持续到回合结束。
export function elementalStrideSpeed(draft: CharacterDraft) {
  return elementalAttunementActive(draft) && draft.level >= 17 ? 20 : 0;
}

// 慈悲学院治疗公式（骰值仍需在战斗中手动掷）。
export function mercyHandHealing(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || subclassName(draft) !== 'mercy' || draft.level < 3) return null;
  return { dice: `1${martialArtsDie(draft.level)}`, bonus: abilityModifier(draft.abilities.wis) };
}
export function wholenessOfBodyHealing(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || subclassName(draft) !== 'open-hand' || draft.level < 6) return null;
  return { dice: `1${martialArtsDie(draft.level)}`, bonus: abilityModifier(draft.abilities.wis) };
}
// 命极之手：4d10 + 感知调整值。
export function handOfUltimateMercyHealing(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || subclassName(draft) !== 'mercy' || draft.level < 17) return null;
  return { dice: '4d10', bonus: abilityModifier(draft.abilities.wis) };
}
// 渗透劲：10d12 力场伤害，体质豁免成功半伤。
export function quiveringPalmDamage(draft: CharacterDraft) {
  if (className(draft) !== '武僧' || subclassName(draft) !== 'open-hand' || draft.level < 17) return null;
  return '10d12';
}
// 舞蹈学院：炫目舞步的徒手伤害可用激励骰 + 敏捷（不消耗激励）。
export function danceBladeDamage(draft: CharacterDraft) {
  if (className(draft) !== '吟游诗人' || subclassName(draft) !== 'dance' || draft.level < 3) return null;
  return { dice: `1${bardInspirationDie(draft.level)}`, bonus: abilityModifier(draft.abilities.dex) };
}
// 灵感织衣：至多魅力调整值（至少 1）个生物获得 2×激励骰的临时生命值。
export function inspiringMovementTargets(draft: CharacterDraft) {
  if (className(draft) !== '吟游诗人' || subclassName(draft) !== 'glamour' || draft.level < 3) return 0;
  return Math.max(1, abilityModifier(draft.abilities.cha));
}
export function inspiringMovementTempHp(draft: CharacterDraft) {
  return `2${bardInspirationDie(draft.level)}`;
}

// 校验状态数据是否完整（由 Lead 接入 generationError）；职业/等级不匹配时只是不生效，不产硬错误。
export function monkBardError(draft: CharacterDraft): string | null {
  const stored = configOf(draft)?.monkBard;
  const resistance = stored?.elementalResistance;
  if (typeof resistance === 'string' && resistance !== '' && !elementalDamageTypes.includes(resistance as ElementalDamage)) return '元素抗性选择无效，请重新选择。';
  if (stored?.elementalAttunement !== undefined && typeof stored.elementalAttunement !== 'boolean') return '元素同调状态无效，请重新记录。';
  return null;
}
