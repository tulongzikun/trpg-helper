import type { CharacterDraft } from '../characters';
import { BarbarianRangerEditorGroup, BarbarianRangerSheetGroup } from './BarbarianRangerViews';
import { ClericRogueEditorGroup, ClericRogueSheetGroup } from './ClericRogueViews';
import { DruidPaladinEditorGroup, DruidPaladinSheetGroup } from './DruidPaladinViews';
import { FighterWarlockEditorGroup, FighterWarlockSheetGroup } from './FighterWarlockViews';
import { MonkBardEditorGroup, MonkBardSheetGroup } from './MonkBardViews';
import { WizardSorcererEditorGroup, WizardSorcererSheetGroup } from './WizardSorcererViews';
import { SpeciesOriginEditorGroup, SpeciesOriginSheetGroup } from './SpeciesOriginViews';
// 7 个执行组的聚合入口：CharacterDetails.tsx 只挂这两个组件，各组只维护自己的 *Views.tsx。
export function FeatureGroupsEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 return <><BarbarianRangerEditorGroup draft={draft} onChange={onChange}/><ClericRogueEditorGroup draft={draft} onChange={onChange}/><DruidPaladinEditorGroup draft={draft} onChange={onChange}/><FighterWarlockEditorGroup draft={draft} onChange={onChange}/><MonkBardEditorGroup draft={draft} onChange={onChange}/><WizardSorcererEditorGroup draft={draft} onChange={onChange}/><SpeciesOriginEditorGroup draft={draft} onChange={onChange}/></>;
}
export function FeatureGroupsSheet({draft}:{draft:CharacterDraft}){
 return <><BarbarianRangerSheetGroup draft={draft}/><ClericRogueSheetGroup draft={draft}/><DruidPaladinSheetGroup draft={draft}/><FighterWarlockSheetGroup draft={draft}/><MonkBardSheetGroup draft={draft}/><WizardSorcererSheetGroup draft={draft}/><SpeciesOriginSheetGroup draft={draft}/></>;
}
