import type { CharacterDraft } from './characters';
export function recordCosmicOmen(draft:CharacterDraft,roll:number):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;
 if(!details||c?.characterClass!=='德鲁伊'||c.subclass!=='stars'||draft.level<6||c.cosmicOmenRoll!==undefined||!Number.isSafeInteger(roll)||roll<1)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,cosmicOmenRoll:roll}}};
}
