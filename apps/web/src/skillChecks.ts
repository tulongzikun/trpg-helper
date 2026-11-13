import type { CharacterDraft } from './characters';
import { skills } from './characterRules.ts';
import { skillState } from './skillEffects.ts';
export function skillCheckResult(draft:CharacterDraft,skill:string,roll:number){
 const c=draft.details?.fighterCalculator;if(!c||!Object.hasOwn(skills,skill)||!Number.isInteger(roll)||roll<1||roll>20)return null;
 const state=skillState(draft),reliable=c.characterClass==='游荡者'&&draft.level>=7&&state.proficient.has(skill);
 const effectiveRoll=reliable?Math.max(10,roll):roll;const modifier=state.modifier(skill);const beforeFloor=effectiveRoll+modifier;
 const indomitable=c.characterClass==='野蛮人'&&draft.level>=18&&skills[skill]==='str';
 return {roll,effectiveRoll,modifier,beforeFloor,total:indomitable?Math.max(beforeFloor,draft.abilities.str):beforeFloor,reliable,indomitable};
}
import type { Ability } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { toolProficiencies } from './toolProficiencies.ts';
import { savingThrows } from './savingThrows.ts';
const abilityKeys:Ability[]=['str','dex','con','int','wis','cha'];
export function proficientTools(draft:CharacterDraft){return [...new Set([...toolProficiencies(draft).granted,...skillState(draft).grantedTools])];}
export function toolCheckResult(draft:CharacterDraft,tool:string,ability:Ability,roll:number){
 const c=draft.details?.fighterCalculator;if(!c||!abilityKeys.includes(ability)||!Number.isInteger(roll)||roll<1||roll>20||!proficientTools(draft).includes(tool))return null;
 const reliable=c.characterClass==='游荡者'&&draft.level>=7;const effectiveRoll=reliable?Math.max(10,roll):roll;const modifier=abilityModifier(draft.abilities[ability])+proficiencyBonus(draft.level);const beforeFloor=effectiveRoll+modifier;const indomitable=c.characterClass==='野蛮人'&&draft.level>=18&&ability==='str';
 return {roll,effectiveRoll,modifier,beforeFloor,total:indomitable?Math.max(beforeFloor,draft.abilities.str):beforeFloor,reliable,indomitable};
}
export function savingThrowResult(draft:CharacterDraft,ability:Ability,roll:number){
 const c=draft.details?.fighterCalculator;if(!c||!abilityKeys.includes(ability)||!Number.isInteger(roll)||roll<1||roll>20)return null;
 const modifier=savingThrows(draft).modifier(ability),beforeFloor=roll+modifier,indomitable=c.characterClass==='野蛮人'&&draft.level>=18&&ability==='str';
 return {roll,effectiveRoll:roll,modifier,beforeFloor,total:indomitable?Math.max(beforeFloor,draft.abilities.str):beforeFloor,reliable:false,indomitable};
}
