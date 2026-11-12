import type { CharacterDraft } from './characters';
import { classResources, changeClassResource } from './classResources.ts';
import { findSpellDescription, type SpellDescription } from './spellDescriptions.ts';
export type InterventionSpell={name:string;level:number};
export function useDivineIntervention(draft:CharacterDraft,spell:InterventionSpell,catalog:InterventionSpell[],descriptions:SpellDescription[]):CharacterDraft{
 const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='牧师'||draft.level<10||!classResources(draft).find(x=>x.id==='cleric-divine-intervention')?.remaining||!spell||!Number.isInteger(spell.level)||spell.level<1||spell.level>5||!catalog.some(x=>x.name===spell.name&&x.level===spell.level)||findSpellDescription(descriptions,spell.name,spell.level)?.actionType==='reaction')return draft;
 const next=changeClassResource(draft,'cleric-divine-intervention',1),details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,divineInterventionLast:{name:spell.name,level:spell.level}}}};
}
