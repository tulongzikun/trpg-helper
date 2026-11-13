import type { CharacterDraft } from '../characters';
import { originFacts, speciesTraitFacts, type TraitFact } from '../speciesOriginFacts';

// 物种 10 + 背景 16 + 起源专长 10 的只读事实汇总；次数与激活状态在「物种与起源特性次数」等既有面板中记录。
const statusLabels: Record<TraitFact['status'], string> = { '自动': '已接入', '部分': '部分', '手动': '部分（需手动）', '战斗': '不适用（战斗）' };
function Facts({facts}:{facts:TraitFact[]}){
  return <>{facts.map(f=><div key={f.name}><div className="revision-row"><strong>{f.name}</strong><span className="character-help">{statusLabels[f.status]}</span></div><p className="character-help">{f.detail}</p></div>)}</>;
}
export function SpeciesOriginEditorGroup({draft}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
  const c = draft.details?.fighterCalculator; if (!c) return null;
  const origin = originFacts(draft);
  return <section className="character-section"><h2>物种特性与起源</h2><p className="character-help">当前物种：{c.species||'未选'}。以下特性中可自动计算的部分已计入角色卡；标注「部分」或「不适用（战斗）」的环节需手动处理。</p><Facts facts={speciesTraitFacts(draft)}/>{origin.background&&<><h2>背景：{origin.background.name}</h2><p className="character-help">属性候选：{origin.background.abilities}；技能：{origin.background.skills}；起源专长：{origin.background.feat}；工具：{origin.background.tool}</p><p className="character-help">{origin.background.note}</p></>}{origin.feats.length>0&&<><h2>起源专长</h2><Facts facts={origin.feats}/></>}</section>;
}
export function SpeciesOriginSheetGroup({draft}:{draft:CharacterDraft}){
  const c = draft.details?.fighterCalculator; if (!c) return null;
  const origin = originFacts(draft);
  return <><section className="character-section"><h2>物种特性与起源</h2><p className="sheet-text">{c.species||'未选'}</p>{speciesTraitFacts(draft).map(f=><div key={f.name}><p className="sheet-text">{f.name}：{statusLabels[f.status]}</p><p className="character-help">{f.detail}</p></div>)}</section>{origin.background&&<section className="character-section"><h2>背景：{origin.background.name}</h2><p className="sheet-text">属性候选：{origin.background.abilities}</p><p className="sheet-text">技能：{origin.background.skills}；工具：{origin.background.tool}</p>{origin.feats.map(f=><p key={f.name} className="sheet-text">起源专长 {f.name}：{f.detail}</p>)}</section>}</>;
}
