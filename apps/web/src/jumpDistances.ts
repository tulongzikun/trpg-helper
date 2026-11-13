import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
export function jumpDistances(draft:CharacterDraft){
 if(!draft.details?.fighterCalculator)return null;
 const options:{ability:'力量'|'敏捷';score:number}[]=[{ability:'力量',score:draft.abilities.str}];
 const c=draft.details.fighterCalculator;
 if(c.characterClass==='游荡者'&&c.subclass==='thief'&&draft.level>=3)options.push({ability:'敏捷' as const,score:draft.abilities.dex});
 return options.map(({ability,score})=>{const high=Math.max(0,3+abilityModifier(score));return {ability,longRunning:score,longStanding:score/2,highRunning:high,highStanding:high/2};});
}
