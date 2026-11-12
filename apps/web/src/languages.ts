import type { CharacterDraft } from './characters';
import { originLanguages } from './backgrounds.ts';

export const rareLanguages=['深渊语','天界语','深潜语','德鲁伊语','炼狱语','原初语','精类语','盗贼黑话','地底通用语'];
export const classLanguageOptions=[...originLanguages,...rareLanguages];

export function languageState(draft:CharacterDraft){
 const details=draft.details,config=details?.fighterCalculator,cls=config?.characterClass;
 const fixed=cls==='德鲁伊'?['德鲁伊语']:cls==='游荡者'?['盗贼黑话']:[];
 const limit=cls==='游荡者'?1:cls==='游侠'&&draft.level>=2?2:0;
 const raw=config?.classLanguages;const selected=Array.isArray(raw)?raw:[];
 const existing=['通用语',...(details?.originLanguages??[]).filter(Boolean),...fixed];
 const invalid=limit>0&&((raw!==undefined&&!Array.isArray(raw))||selected.length>limit||new Set(selected.filter(Boolean)).size!==selected.filter(Boolean).length||selected.some(x=>typeof x!=='string'||(!!x&&(!classLanguageOptions.includes(x)||existing.includes(x)))));
 const active=limit?selected.slice(0,limit).filter(x=>!!x&&classLanguageOptions.includes(x)&&!existing.includes(x)):[];
 return {fixed,limit,selected,invalid,known:[...new Set([...existing,...active])]};
}
