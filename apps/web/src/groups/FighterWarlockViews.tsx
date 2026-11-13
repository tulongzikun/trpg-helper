import type { CharacterDraft } from '../characters';
import { FighterFeaturesEditor, FighterFeaturesSheet } from '../FighterFeatureViews.tsx';
import { WarlockFeaturesEditor, WarlockFeaturesSheet } from '../WarlockFeatureViews.tsx';
// 战士 + 邪术师（职业基础特性与子职业）聚合视图；由 fighter-warlock 组维护。
export function FighterWarlockEditorGroup({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 return <><FighterFeaturesEditor draft={draft} onChange={onChange}/><WarlockFeaturesEditor draft={draft} onChange={onChange}/></>;
}
export function FighterWarlockSheetGroup({draft}:{draft:CharacterDraft}){
 return <><FighterFeaturesSheet draft={draft}/><WarlockFeaturesSheet draft={draft}/></>;
}
