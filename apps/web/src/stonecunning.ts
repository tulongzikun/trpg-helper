import type { CharacterDraft } from './characters';
import { changeSpeciesResource, speciesResources } from './speciesResources.ts';
export function activateStonecunning(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator;if(c?.species!=='矮人'||!speciesResources(draft).find(x=>x.id==='dwarf-stonecunning')?.remaining)return draft;
 const next=changeSpeciesResource(draft,'dwarf-stonecunning',1);return {...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,stonecunningActive:true}}};
}
export function setStoneContact(draft:CharacterDraft,contact:boolean):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.species!=='矮人'||typeof contact!=='boolean')return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,stoneContact:contact}}};
}
export function endStonecunning(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.species!=='矮人'||!c.stonecunningActive)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,stonecunningActive:false}}};
}
