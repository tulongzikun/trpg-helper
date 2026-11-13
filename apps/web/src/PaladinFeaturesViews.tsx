import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { classResources } from './classResources.ts';
import {
 paladinMasteryProperties,paladinFightingStyles,weaponMasteryState,setWeaponMastery,fightingStyle,
 setFightingStyle,recoveryTouchConditions,recoveryTouchCost,useRecoveryTouch,paladinAura,
 paladinClassNotes,freeSmiteRemaining,
} from './paladinFeatures.ts';
import { epicBoon,setEpicBoon } from './druidPaladinShared.ts';
import { channelDivinityOptions } from './paladinFeatures.ts';
export function PaladinFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const [conditions,setConditions]=useState<string[]>([]);
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='圣武士')return null;
 const mastery=weaponMasteryState(draft),style=fightingStyle(draft),aura=paladinAura(draft);
 const pool=classResources(draft).find(x=>x.id==='paladin-hands'),cost=recoveryTouchCost(conditions);
 return <div className="character-section">
  <h3>圣武士特性</h3>
  <p className="character-help">圣疗池剩余 {pool?.remaining??0}/{pool?.maximum??0} 点；圣武斩免费施放剩余 {freeSmiteRemaining(draft)} 次。</p>
  <div><p className="section-label">武器精通（2 种）</p>{[0,1].map(index=>{const choice=mastery?.choices[index]??{weapon:'',property:''};return <div key={index}><input aria-label={`武器精通 ${index+1} 武器`} value={choice.weapon} placeholder="武器名称" onChange={e=>onChange(setWeaponMastery(draft,index,e.target.value,choice.property))}/><select aria-label={`武器精通 ${index+1} 词条`} value={choice.property} onChange={e=>onChange(setWeaponMastery(draft,index,choice.weapon,e.target.value))}><option value="">选择词条</option>{paladinMasteryProperties.map(x=><option key={x}>{x}</option>)}</select></div>;})}
   <p className="character-help">完成长休后可更换武器精通；词条效果由战斗结算。</p></div>
  {draft.level>=2&&<label>战斗风格<select aria-label="战斗风格" value={style} onChange={e=>onChange(setFightingStyle(draft,e.target.value))}>
   <option value="">请选择</option>{paladinFightingStyles.map(x=><option key={x}>{x}</option>)}
  </select><small>受祝福的勇士可另选 2 道牧师戏法，需在法术界面手动登记。</small></label>}
  {aura&&<p className="character-help">{aura.note}</p>}
  {draft.level>=14&&<div><p className="section-label">复原之触（每项 5 点圣疗）</p>{recoveryTouchConditions.map(x=><label key={x}><input type="checkbox" aria-label={`复原之触：${x}`} checked={conditions.includes(x)} onChange={e=>setConditions(e.target.checked?[...conditions,x]:conditions.filter(y=>y!==x))}/>{x}</label>)}<button type="button" className="button-secondary" disabled={!conditions.length||cost>(pool?.remaining??0)} onClick={()=>{onChange(useRecoveryTouch(draft,conditions));setConditions([]);}}>消耗 {cost} 点圣疗终止所选状态</button></div>}
  {draft.level>=19&&<label>传奇恩惠<input aria-label="传奇恩惠" value={epicBoon(draft)} onChange={e=>onChange(setEpicBoon(draft,e.target.value))} placeholder="如：真实视觉之恩惠"/></label>}
 </div>;
}
export function PaladinFeaturesSheet({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='圣武士')return null;
 const aura=paladinAura(draft),options=channelDivinityOptions(draft),boon=epicBoon(draft);
 return <><h3>圣武士职业特性</h3>
  {aura&&<p className="sheet-text">{aura.note}</p>}
  <p className="sheet-text">攻击动作攻击次数：{draft.level>=5?2:1}。</p>
  {paladinClassNotes(draft).map((note,index)=><p key={index} className="sheet-text">{note}</p>)}
  {options.map((option,index)=><p key={index} className="sheet-text">{option}</p>)}
  {boon&&<p className="sheet-text">传奇恩惠：{boon}</p>}
  <p className="sheet-text">职业资源：{classResources(draft).filter(r=>r.id.startsWith('paladin-')).map(r=>`${r.name} ${r.remaining}/${r.maximum}`).join('；')||'—'}。</p>
 </>;
}
