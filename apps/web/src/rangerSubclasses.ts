import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { config } from './barbarianRangerConfig.ts';
import { huntersMarkDie, wisdomUses } from './rangerFeatures.ts';

export const beastCompanions = ['大地', '海洋', '天空'] as const;
export type BeastCompanion = typeof beastCompanions[number];

const beastCards: Record<BeastCompanion, {
  name: string;
  hp: (level: number) => number;
  speed: string;
  darkvision: number;
  strike: string;
  damageType: string;
  traits: string[];
}> = {
  大地: {
    name: '大地原初野兽',
    hp: (level) => 5 + 5 * level,
    speed: '40 尺，攀爬 40 尺',
    darkvision: 60,
    strike: '1d8+2+感知调整值',
    damageType: '穿刺、挥砍或钝击（召唤时选择）',
    traits: ['冲锋：直线移动至少 20 尺后命中，额外造成 1d6 伤害；目标不超过大型则倒地。'],
  },
  海洋: {
    name: '海洋原初野兽',
    hp: (level) => 5 + 5 * level,
    speed: '5 尺，游泳 60 尺',
    darkvision: 90,
    strike: '1d6+2+感知调整值',
    damageType: '钝击或穿刺（召唤时选择）',
    traits: ['水陆两栖。', '野兽打击命中后目标受擒，逃脱 DC 等于你的法术豁免 DC。'],
  },
  天空: {
    name: '天空原初野兽',
    hp: (level) => 4 + 4 * level,
    speed: '10 尺，飞行 60 尺',
    darkvision: 60,
    strike: '1d4+3+感知调整值',
    damageType: '挥砍',
    traits: ['飞掠：飞行离开敌人触及时不引发借机攻击。'],
  },
};

export function beastMasterState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '游侠' || c.subclass !== 'beast-master' || draft.level < 3) return null;
  const choice = (beastCompanions as readonly string[]).includes(c.beastCompanion ?? '')
    ? c.beastCompanion as BeastCompanion
    : null;
  const wis = abilityModifier(draft.abilities.wis);
  const pb = proficiencyBonus(draft.level);
  const card = choice ? beastCards[choice] : null;
  return {
    level: draft.level,
    choice,
    options: beastCompanions.map((id) => ({ id, name: beastCards[id].name })),
    ac: 13 + wis,
    hp: card ? card.hp(draft.level) : null,
    speed: card?.speed ?? '',
    darkvision: card?.darkvision ?? 0,
    strike: card?.strike ?? '',
    damageType: card?.damageType ?? '',
    traits: card?.traits ?? [],
    attackBonus: pb + wis,
    spellDc: 8 + pb + wis,
    saveBonus: pb,
    huntersMarkDie: huntersMarkDie(draft.level),
    advancedTraining: draft.level >= 7,
    bestialFury: draft.level >= 11,
    spellSharing: draft.level >= 15,
  };
}

export const feyGifts = [
  '长休或短休时，缥缈的蝴蝶在你周身振翅。',
  '每天黎明，花朵在你的头发中生长。',
  '你身上有淡淡的肉桂、薰衣草或肉豆蔻等舒适香气。',
  '你的影子会在没人直视它时起舞。',
  '你的头发中长出纤细的触角或鹿角。',
  '你的肤色和发色会在每个黎明时改变。',
];

export function feyWandererState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '游侠' || c.subclass !== 'fey-wanderer' || draft.level < 3) return null;
  const level = draft.level;
  const gift = typeof c.feyGift === 'number' && Number.isInteger(c.feyGift) && c.feyGift >= 1 && c.feyGift <= 6 ? c.feyGift : null;
  return {
    level,
    dreadfulDie: level >= 11 ? '1d6' : '1d4',
    gift,
    giftText: gift ? feyGifts[gift - 1] : '',
    otherworldlyGrace: Math.max(1, abilityModifier(draft.abilities.wis)),
    mistyStepFreeUses: level >= 15 ? wisdomUses(draft) : 0,
    feyReinforcements: level >= 11,
    beguilingStrike: level >= 7,
  };
}

export function gloomStalkerState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '游侠' || c.subclass !== 'gloom-stalker' || draft.level < 3) return null;
  const level = draft.level;
  const wis = abilityModifier(draft.abilities.wis);
  return {
    level,
    dreadAmbusherUses: wisdomUses(draft),
    dreadStrikeDie: level >= 11 ? '2d8' : '2d6',
    initiativeBonus: wis,
    umbralSight: true,
    ironMind: level >= 7,
    stalkersFlurry: level >= 11,
    shadowyDodge: level >= 15,
  };
}

export const hunterPreyOptions = ['巨像屠夫', '灭族者'] as const;
export const hunterDefenseOptions = ['冲出重围', '多重防御'] as const;

export function hunterState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '游侠' || c.subclass !== 'hunter' || draft.level < 3) return null;
  const prey = (hunterPreyOptions as readonly string[]).includes(c.hunterPrey ?? '') ? c.hunterPrey as string : '';
  const defense = (hunterDefenseOptions as readonly string[]).includes(c.hunterDefense ?? '') ? c.hunterDefense as string : '';
  return {
    level: draft.level,
    prey,
    defense,
    preyOptions: [...hunterPreyOptions],
    defenseOptions: [...hunterDefenseOptions],
    hunterLore: true,
    superiorPrey: draft.level >= 11,
    superiorDefense: draft.level >= 15,
  };
}
