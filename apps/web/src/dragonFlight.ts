import type { CharacterDraft } from './characters';
import { changeSpeciesResource, speciesResources } from './speciesResources.ts';
export function activateDragonFlight(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator;if(c?.species!=='龙裔'||draft.level<5||c.dragonFlightActive||!speciesResources(draft).find(x=>x.id==='dragon-flight')?.remaining)return draft;
 const next=changeSpeciesResource(draft,'dragon-flight',1);return {...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,dragonFlightActive:true}}};
}
export function endDragonFlight(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.species!=='龙裔'||!c.dragonFlightActive)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,dragonFlightActive:false}}};
}
