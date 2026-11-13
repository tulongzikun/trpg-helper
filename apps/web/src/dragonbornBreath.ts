import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { dragonAncestry } from './speciesExploration.ts';

export const breathShapes = ['15 尺锥形', '30 尺线形'] as const;
export type BreathShape = (typeof breathShapes)[number];

export function breathDamageDice(level: number): number {
  return level >= 17 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
}

export type DragonbornBreath = {
  ancestry: string | undefined;
  damageType: string | undefined;
  dice: string;
  uses: number;
  save: '敏捷';
  dc: number;
  shapes: readonly BreathShape[];
  halfOnSuccess: true;
};

export function dragonbornBreath(draft: CharacterDraft): DragonbornBreath | null {
  const c = draft.details?.fighterCalculator;
  if (c?.species !== '龙裔') return null;
  const ancestry = c.dragonAncestry;
  const damageType = ancestry && Object.hasOwn(dragonAncestry, ancestry) ? dragonAncestry[ancestry] : undefined;
  return {
    ancestry: damageType ? ancestry : undefined,
    damageType,
    dice: `${breathDamageDice(draft.level)}d10`,
    uses: proficiencyBonus(draft.level),
    save: '敏捷',
    dc: 8 + abilityModifier(draft.abilities.con) + proficiencyBonus(draft.level),
    shapes: breathShapes,
    halfOnSuccess: true,
  };
}
