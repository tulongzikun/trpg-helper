import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';

// 牧师 / 游荡者（T2 组）纯规则与派生数值；不读写草稿，只供视图、资源定义与测试使用。
export type ClericRogueFields = {
 clericBlessedStrike?: 'divine' | 'potent' | '';
 weaponMasteryChoices?: string[];
};
type Calculator = NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;
export type ClericRogueConfig = Calculator & ClericRogueFields;

export function clericRogueConfig(draft: CharacterDraft): ClericRogueConfig | undefined {
 return draft.details?.fighterCalculator as ClericRogueConfig | undefined;
}
export function isCleric(draft: CharacterDraft) { return clericRogueConfig(draft)?.characterClass === '牧师'; }
export function isRogue(draft: CharacterDraft) { return clericRogueConfig(draft)?.characterClass === '游荡者'; }
export function signed(value: number) { return value >= 0 ? `+${value}` : `${value}`; }
const wisMod = (draft: CharacterDraft) => abilityModifier(draft.abilities.wis);
const dexMod = (draft: CharacterDraft) => abilityModifier(draft.abilities.dex);
const spellDC = (draft: CharacterDraft) => 8 + proficiencyBonus(draft.level) + wisMod(draft);

export type DivineOrderState = {
 order: 'protector' | 'thaumaturge' | '';
 bonus: number;
 options: { id: 'protector' | 'thaumaturge'; label: string; note: string }[];
};
export function divineOrderState(draft: CharacterDraft): DivineOrderState | null {
 if (!isCleric(draft)) return null;
 const order = clericRogueConfig(draft)?.classOrder;
 const selected = order === 'protector' || order === 'thaumaturge' ? order : '';
 return {
  order: selected,
  bonus: Math.max(1, wisMod(draft)),
  options: [
   { id: 'protector', label: '保护者', note: '获得军用武器熟练与重甲受训。' },
   { id: 'thaumaturge', label: '奇术使', note: `额外获得一道牧师戏法；智力（奥秘、宗教）检定加值等于感知调整值（至少 +1，当前 ${signed(Math.max(1, wisMod(draft)))}）。` },
  ],
 };
}

export type ChannelDivinityState = {
 sparkDice: number;
 sparkHeal: string;
 sparkDamage: string;
 searUndead: boolean;
 searDice: number;
 saveDC: number;
};
export function channelDivinityState(draft: CharacterDraft): ChannelDivinityState | null {
 if (!isCleric(draft) || draft.level < 2) return null;
 const level = draft.level;
 const sparkDice = level >= 18 ? 4 : level >= 13 ? 3 : level >= 7 ? 2 : 1;
 return {
  sparkDice,
  sparkHeal: `${sparkDice}d8${signed(wisMod(draft))}`,
  sparkDamage: `${sparkDice}d8`,
  searUndead: level >= 5,
  searDice: level >= 5 ? Math.max(1, wisMod(draft)) : 0,
  saveDC: spellDC(draft),
 };
}

export type BlessedStrikeState = {
 choice: 'divine' | 'potent' | '';
 improved: boolean;
 divineDice: number;
 potentBonus: number;
 tempHp: number;
 options: { id: 'divine' | 'potent'; label: string; note: string }[];
};
export function blessedStrikeState(draft: CharacterDraft): BlessedStrikeState | null {
 if (!isCleric(draft) || draft.level < 7) return null;
 const raw = clericRogueConfig(draft)?.clericBlessedStrike;
 const choice = raw === 'divine' || raw === 'potent' ? raw : '';
 const improved = draft.level >= 14;
 const wis = wisMod(draft);
 const divineDice = improved ? 2 : 1;
 const tempHp = improved ? 2 * Math.max(0, wis) : 0;
 return {
  choice,
  improved,
  divineDice,
  potentBonus: wis,
  tempHp,
  options: [
   { id: 'divine', label: '神圣打击', note: `每回合一次，武器命中时额外造成 ${divineDice}d8 光耀或暗蚀伤害。` },
   { id: 'potent', label: '强力施法', note: `牧师戏法造成伤害时加上感知调整值（${signed(wis)}）。${improved ? `14 级起造成伤害时，还可给自己或 60 尺内另一生物 ${tempHp} 点临时生命值。` : ''}` },
  ],
 };
}

export function lifeHealingBonus(draft: CharacterDraft, slotLevel: number, target: 'self' | 'other') {
 const c = clericRogueConfig(draft);
 if (!isCleric(draft) || c?.subclass !== 'life' || draft.level < 3 || !Number.isInteger(slotLevel) || slotLevel < 1) return null;
 const valid = slotLevel <= 9;
 const disciple = valid ? 2 + slotLevel : 0;
 const healer = valid && draft.level >= 6 && target === 'other' ? 2 + slotLevel : 0;
 return { disciple, healer, maximized: draft.level >= 17 };
}
export function lifePreserveHealing(draft: CharacterDraft) {
 if (!isCleric(draft) || clericRogueConfig(draft)?.subclass !== 'life' || draft.level < 3) return 0;
 return draft.level * 5;
}

export type LightDomainState = {
 wardingUses: number;
 improved: boolean;
 wardingTempHp: string;
 radianceDamage: string;
 radianceDC: number;
 corona: boolean;
 coronaUses: number;
};
export function lightDomainState(draft: CharacterDraft): LightDomainState | null {
 const c = clericRogueConfig(draft);
 if (!isCleric(draft) || c?.subclass !== 'light' || draft.level < 3) return null;
 const uses = Math.max(1, wisMod(draft));
 return {
  wardingUses: uses,
  improved: draft.level >= 6,
  wardingTempHp: `2d6${signed(wisMod(draft))}`,
  radianceDamage: `2d10+${draft.level}`,
  radianceDC: spellDC(draft),
  corona: draft.level >= 17,
  coronaUses: uses,
 };
}

export type TrickeryDomainState = { blessing: boolean; duplicity: boolean; swap: boolean; improved: boolean };
export function trickeryDomainState(draft: CharacterDraft): TrickeryDomainState | null {
 const c = clericRogueConfig(draft);
 if (!isCleric(draft) || c?.subclass !== 'trickery' || draft.level < 3) return null;
 return { blessing: true, duplicity: true, swap: draft.level >= 6, improved: draft.level >= 17 };
}

export type WarDomainState = {
 warPriestUses: number;
 guidedStrikeBonus: number;
 godBlessing: boolean;
 avatar: boolean;
};
export function warDomainState(draft: CharacterDraft): WarDomainState | null {
 const c = clericRogueConfig(draft);
 if (!isCleric(draft) || c?.subclass !== 'war' || draft.level < 3) return null;
 return {
  warPriestUses: Math.max(1, wisMod(draft)),
  guidedStrikeBonus: 10,
  godBlessing: draft.level >= 6,
  avatar: draft.level >= 17,
 };
}

export function sneakAttackDice(level: number) { return Math.max(0, Math.ceil(level / 2)); }
export function cunningStrikeDC(draft: CharacterDraft) { return 8 + proficiencyBonus(draft.level) + dexMod(draft); }

export type CunningStrikeOption = { name: string; dice: number; save: '体质' | '敏捷' | null; note: string };
export function cunningStrikeOptions(level: number, isThief = false): CunningStrikeOption[] {
 const options: CunningStrikeOption[] = [];
 if (level >= 5) {
  options.push(
   { name: '淬毒', dice: 1, save: '体质', note: '豁免失败则中毒 1 分钟，每回合结束可重豁免；需要制毒工具。' },
   { name: '摔绊', dice: 1, save: '敏捷', note: '大型或更小目标应豁免失败则倒地。' },
   { name: '撤步', dice: 1, save: null, note: '攻击后移动至多一半速度，且不引发借机攻击。' },
  );
 }
 if (level >= 14) {
  options.push(
   { name: '恍惚', dice: 2, save: '体质', note: '豁免失败则目标下回合只能选择移动、动作或附赠动作之一。' },
   { name: '击昏', dice: 6, save: '体质', note: '豁免失败则昏迷 1 分钟，受伤或回合结束重豁免可结束。' },
   { name: '眩目', dice: 3, save: '敏捷', note: '豁免失败则目盲至其下回合结束。' },
  );
 }
 if (isThief && level >= 9) {
  options.push({ name: '无声袭击', dice: 1, save: null, note: '处于躲藏动作的隐形状态时，若在四分之三或全身掩护后结束回合，本次攻击不终止隐形。' });
 }
 return options;
}

export type RogueState = {
 sneakDice: number;
 cunningStrikeDC: number;
 options: CunningStrikeOption[];
 advanced: boolean;
 deadly: boolean;
 reliable: boolean;
 slipperyMind: boolean;
 elusive: boolean;
 luckyStrike: boolean;
 weaponMasteryChoices: string[];
};
export function rogueState(draft: CharacterDraft): RogueState | null {
 if (!isRogue(draft)) return null;
 const level = draft.level;
 const isThief = clericRogueConfig(draft)?.subclass === 'thief';
 return {
  sneakDice: sneakAttackDice(level),
  cunningStrikeDC: cunningStrikeDC(draft),
  options: cunningStrikeOptions(level, isThief),
  advanced: level >= 11,
  deadly: level >= 14,
  reliable: level >= 7,
  slipperyMind: level >= 15,
  elusive: level >= 18,
  luckyStrike: level >= 20,
  weaponMasteryChoices: clericRogueConfig(draft)?.weaponMasteryChoices ?? [],
 };
}

export function psiDiceFor(level: number) {
 if (level >= 17) return { count: 12, die: 12 };
 if (level >= 13) return { count: 10, die: 10 };
 if (level >= 11) return { count: 8, die: 10 };
 if (level >= 9) return { count: 8, die: 8 };
 if (level >= 5) return { count: 6, die: 8 };
 return { count: 4, die: 6 };
}

export type SoulknifeState = {
 count: number;
 die: number;
 label: string;
 soulBlades: boolean;
 veil: boolean;
 rendMind: boolean;
 veilCost: number;
 rendCost: number;
};
export function soulknifeState(draft: CharacterDraft): SoulknifeState | null {
 const c = clericRogueConfig(draft);
 if (!isRogue(draft) || c?.subclass !== 'soulknife' || draft.level < 3) return null;
 const psi = psiDiceFor(draft.level);
 return {
  count: psi.count,
  die: psi.die,
  label: `${psi.count}d${psi.die}`,
  soulBlades: draft.level >= 9,
  veil: draft.level >= 13,
  rendMind: draft.level >= 17,
  veilCost: 1,
  rendCost: 3,
 };
}

export type ArcaneTricksterState = { cantripLimit: number; magicalAmbush: boolean; versatileTrickster: boolean; spellThief: boolean };
export function arcaneTricksterState(draft: CharacterDraft): ArcaneTricksterState | null {
 const c = clericRogueConfig(draft);
 if (!isRogue(draft) || c?.subclass !== 'arcane-trickster' || draft.level < 3) return null;
 return {
  cantripLimit: 2 + (draft.level >= 10 ? 1 : 0),
  magicalAmbush: draft.level >= 9,
  versatileTrickster: draft.level >= 13,
  spellThief: draft.level >= 17,
 };
}

export type AssassinState = { assassinate: boolean; tools: boolean; infiltration: boolean; poisoner: boolean; deathStrike: boolean };
export function assassinState(draft: CharacterDraft): AssassinState | null {
 const c = clericRogueConfig(draft);
 if (!isRogue(draft) || c?.subclass !== 'assassin' || draft.level < 3) return null;
 return {
  assassinate: true,
  tools: true,
  infiltration: draft.level >= 9,
  poisoner: draft.level >= 13,
  deathStrike: draft.level >= 17,
 };
}

export type ThiefState = { fastHands: boolean; secondStoryWork: boolean; supremeSneak: boolean; useMagicDevice: boolean; reflexes: boolean };
export function thiefState(draft: CharacterDraft): ThiefState | null {
 const c = clericRogueConfig(draft);
 if (!isRogue(draft) || c?.subclass !== 'thief' || draft.level < 3) return null;
 return {
  fastHands: true,
  secondStoryWork: true,
  supremeSneak: draft.level >= 9,
  useMagicDevice: draft.level >= 13,
  reflexes: draft.level >= 17,
 };
}
