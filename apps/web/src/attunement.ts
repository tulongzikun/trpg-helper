import type { CharacterDraft } from './characters';
export function attunementState(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(!c)return null;
 const limit=c.characterClass==='游荡者'&&c.subclass==='thief'&&draft.level>=13?4:3;
 const raw=c.attunedItems,items=Array.isArray(raw)?raw:[];
 const invalid=(raw!==undefined&&!Array.isArray(raw))||items.length>limit||items.some(x=>typeof x!=='string'||!x.trim()||x.length>100);
 return {limit,items,invalid};
}
