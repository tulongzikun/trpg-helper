import type { CharacterDraft } from './characters';
import { classResources } from './classResources.ts';
import { wildShapeState } from './wildShapeForms.ts';
import {
 elementalFury,elementalFuryChoices,setElementalFury,wildShapeRemaining,activeWildShape,
 wildShapeTempHp,wildShapeAcOption,startWildShape,endWildShape,wildCompanionState,
 summonWildCompanion,dismissWildCompanion,natureMagicianState,useNatureMagician,druidGrandNotes,
} from './druidFeatures.ts';
import { epicBoon,setEpicBoon } from './druidPaladinShared.ts';
export function DruidFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='德鲁伊')return null;
 const shape=wildShapeState(draft),remaining=wildShapeRemaining(draft),active=activeWildShape(draft);
 const companion=wildCompanionState(draft),magician=natureMagicianState(draft),fury=elementalFury(draft);
 return <div className="character-section">
  <h3>德鲁伊特性</h3>
  {draft.level>=2&&shape&&<div>
   <p className="character-help">荒野变身剩余 {remaining} 次；当前形态：{active??'无'}。</p>
   <label>野性形态<select aria-label="荒野变形形态" value={active??''} onChange={e=>onChange(e.target.value?startWildShape(draft,e.target.value):endWildShape(draft))}>
    <option value="">未变形</option>{shape.known.map(x=><option key={x.id} value={x.name}>{x.name}（CR {x.challenge}）</option>)}
   </select></label>
   {active&&<p className="character-help">临时生命值 {wildShapeTempHp(draft)}{wildShapeAcOption(draft)!=null?`；变形期间可选择 AC ${wildShapeAcOption(draft)}（13+感知）`:''}。</p>}
   {!shape.known.length&&<p className="character-help">请先在「野性形态」界面登记已知野兽形态。</p>}
   {companion&&<div><p className="character-help">荒野伙伴：{companion.active?'已召唤':'未召唤'}。</p>
    <button type="button" className="button-secondary" disabled={companion.active||!companion.canUseSlot} onClick={()=>onChange(summonWildCompanion(draft,'slot'))}>消耗 1 环法术位召唤伙伴</button>
    <button type="button" className="button-secondary" disabled={companion.active||!companion.canUseWildShape} onClick={()=>onChange(summonWildCompanion(draft,'wildshape'))}>消耗一次荒野变身召唤伙伴</button>
    <button type="button" className="button-secondary" disabled={!companion.active} onClick={()=>onChange(dismissWildCompanion(draft))}>解除伙伴</button></div>}
  </div>}
  {fury&&<div><label>元素之怒<select aria-label="元素之怒选项" value={fury.choice} onChange={e=>onChange(setElementalFury(draft,e.target.value as 'potent'|'primal'|''))}>
   <option value="">请选择</option>{elementalFuryChoices.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}
  </select></label><p className="character-help">{fury.note}</p></div>}
  {magician&&<div><p className="character-help">自然术使：可用未使用的荒野变身次数换取法术位（每 2 环阶消耗 1 次，每次长休一次）。当前剩余变身 {magician.uses} 次{magician.used?'；本长休内已使用':''}。</p>
   {!magician.used&&[1,2,3,4,5].filter(l=>magician.recoverableLevels.includes(l)).map(l=><button key={l} type="button" className="button-secondary" onClick={()=>onChange(useNatureMagician(draft,l))}>恢复 {l} 环法术位（消耗 {Math.ceil(l/2)} 次变身）</button>)}
  </div>}
  {draft.level>=19&&<label>传奇恩惠<input aria-label="传奇恩惠" value={epicBoon(draft)} onChange={e=>onChange(setEpicBoon(draft,e.target.value))} placeholder="如：真实视觉之恩惠"/></label>}
 </div>;
}
export function DruidFeaturesSheet({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='德鲁伊')return null;
 const notes=druidGrandNotes(draft),remaining=wildShapeRemaining(draft),active=activeWildShape(draft),boon=epicBoon(draft);
 return <><h3>德鲁伊职业特性</h3>
  <p className="sheet-text">荒野变身剩余 {remaining} 次{active?`；当前形态：${active}`:''}。</p>
  {notes.map((note,index)=><p key={index} className="sheet-text">{note}</p>)}
  {boon&&<p className="sheet-text">传奇恩惠：{boon}</p>}
  <p className="sheet-text">职业资源：{classResources(draft).filter(r=>r.id.startsWith('druid-')).map(r=>`${r.name} ${r.remaining}/${r.maximum}`).join('；')||'—'}。</p>
 </>;
}
