import type { CharacterDraft } from './characters';
import { abilityModifier, skills } from './characterRules.ts';
import { skillState } from './skillEffects.ts';
export const primalSkills=['体操','威吓','察觉','隐匿','求生'] as const;
export function primalKnowledgeChecks(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='野蛮人'||draft.level<3)return [];
 const state=skillState(draft),strength=abilityModifier(draft.abilities.str);
 return primalSkills.map(name=>({name,modifier:state.modifier(name)-abilityModifier(draft.abilities[skills[name]])+strength}));
}
