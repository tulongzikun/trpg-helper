import type { CharacterDraft } from '../characters';
import { ClericFeatureEditor, ClericFeatureSheet } from '../ClericFeatureViews';
import { RogueFeatureEditor, RogueFeatureSheet } from '../RogueFeatureViews';
// 牧师 + 游荡者（职业基础特性与子职业）聚合视图；由 cleric-rogue 组维护。
export function ClericRogueEditorGroup({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 return <><ClericFeatureEditor draft={draft} onChange={onChange}/><RogueFeatureEditor draft={draft} onChange={onChange}/></>;
}
export function ClericRogueSheetGroup({draft}:{draft:CharacterDraft}){
 return <><ClericFeatureSheet draft={draft}/><RogueFeatureSheet draft={draft}/></>;
}
