import type { CharacterDraft } from './characters';
import { changeSpeciesResource, speciesResources } from './speciesResources.ts';
export type CelestialForm='wings'|'radiance'|'shroud';
const choices:CelestialForm[]=['wings','radiance','shroud'];
export function startCelestialRevelation(draft:CharacterDraft,form:CelestialForm):CharacterDraft{
 const c=draft.details?.fighterCalculator;if(c?.species!=='阿斯莫'||draft.level<3||!choices.includes(form)||!speciesResources(draft).find(x=>x.id==='aasimar-celestial-revelation')?.remaining)return draft;
 const next=changeSpeciesResource(draft,'aasimar-celestial-revelation',1);return {...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,celestialForm:form}}};
}
export function endCelestialRevelation(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.species!=='阿斯莫'||!c.celestialForm)return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,celestialForm:''}}};
}
