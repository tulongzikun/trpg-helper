import type { Ability, CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';

export function savingThrows(draft:CharacterDraft){
 const details=draft.details,config=details?.fighterCalculator;
 const aura=config?.characterClass==='圣武士'&&draft.level>=6?Math.max(1,abilityModifier(draft.abilities.cha)):0;
 return {aura,modifier:(ability:Ability)=>abilityModifier(draft.abilities[ability])+(details?.saveProficiencies.includes(ability)?proficiencyBonus(draft.level):0)};
}
