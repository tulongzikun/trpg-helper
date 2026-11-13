import type { CharacterDraft } from '../characters';
import { DruidFeaturesEditor,DruidFeaturesSheet } from '../DruidFeaturesViews';
import { PaladinFeaturesEditor,PaladinFeaturesSheet } from '../PaladinFeaturesViews';
import {
 LandFeaturesEditor,LandFeaturesSheet,MoonFeaturesEditor,MoonFeaturesSheet,
 SeaFeaturesEditor,SeaFeaturesSheet,StarFeaturesEditor,StarFeaturesSheet,
 OathFeaturesEditor,OathFeaturesSheet,
} from '../DruidPaladinSubclassViews';
// 德鲁伊 + 圣武士（职业基础特性与子职业）聚合视图；由 druid-paladin 组维护。
export function DruidPaladinEditorGroup({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 return <>
  <DruidFeaturesEditor draft={draft} onChange={onChange}/>
  <PaladinFeaturesEditor draft={draft} onChange={onChange}/>
  <LandFeaturesEditor draft={draft} onChange={onChange}/>
  <MoonFeaturesEditor draft={draft} onChange={onChange}/>
  <SeaFeaturesEditor draft={draft} onChange={onChange}/>
  <StarFeaturesEditor draft={draft} onChange={onChange}/>
  <OathFeaturesEditor draft={draft} onChange={onChange}/>
 </>;
}
export function DruidPaladinSheetGroup({draft}:{draft:CharacterDraft}){
 return <>
  <DruidFeaturesSheet draft={draft}/>
  <PaladinFeaturesSheet draft={draft}/>
  <LandFeaturesSheet draft={draft}/>
  <MoonFeaturesSheet draft={draft}/>
  <SeaFeaturesSheet draft={draft}/>
  <StarFeaturesSheet draft={draft}/>
  <OathFeaturesSheet draft={draft}/>
 </>;
}
