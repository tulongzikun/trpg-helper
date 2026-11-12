import type { CharacterDraft } from './characters';
import { classResources, changeClassResource } from './classResources.ts';
export type StarryForm='archer'|'chalice'|'dragon';
const choices:StarryForm[]=['archer','chalice','dragon'];
export function activeStarryForm(draft:CharacterDraft):StarryForm|undefined{
 const c=draft.details?.fighterCalculator;
 return c?.characterClass==='德鲁伊'&&c.subclass==='stars'&&draft.level>=3&&c.starryForm&&choices.includes(c.starryForm)?c.starryForm:undefined;
}
export function startStarryForm(draft:CharacterDraft,form:StarryForm):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||c?.characterClass!=='德鲁伊'||c.subclass!=='stars'||draft.level<3||!choices.includes(form)||!classResources(draft).find(x=>x.id==='druid-wildshape')?.remaining)return draft;
 const next=changeClassResource(draft,'druid-wildshape',1);return {...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,starryForm:form}}};
}
export function switchStarryForm(draft:CharacterDraft,form:StarryForm):CharacterDraft{
 if(draft.level<10||!activeStarryForm(draft)||!choices.includes(form))return draft;
 const details=draft.details!,c=details.fighterCalculator!;return {...draft,details:{...details,fighterCalculator:{...c,starryForm:form}}};
}
export function endStarryForm(draft:CharacterDraft):CharacterDraft{
 if(!activeStarryForm(draft))return draft;const details=draft.details!,c=details.fighterCalculator!;
 return {...draft,details:{...details,fighterCalculator:{...c,starryForm:''}}};
}
