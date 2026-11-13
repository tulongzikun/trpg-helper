import type { CharacterDraft } from './characters';
import { speciesResources, changeSpeciesResource } from './speciesResources.ts';
export function activateGiantForm(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator;if(c?.species!=='歌利亚'||draft.level<5||c.giantFormActive||!speciesResources(draft).find(x=>x.id==='goliath-large')?.remaining)return draft;
 const next=changeSpeciesResource(draft,'goliath-large',1);return {...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,giantFormActive:true}}};
}
export function endGiantForm(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.species!=='歌利亚'||!c.giantFormActive)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,giantFormActive:false}}};
}
