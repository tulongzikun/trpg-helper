import { classResources, changeClassResource } from './classResources';
import type { CharacterDraft } from './characters';
import { divinerSight, divinerSightOptions } from './diviner';
export function DivinerEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c||c.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<10)return null;
 const available=!!classResources(draft).find(r=>r.id==='diviner-third-eye')?.remaining;
 return <label>天眼通：当前效果<select value={c.divinerSight??''} onChange={e=>{const choice=e.target.value as typeof divinerSightOptions[number]|'';if(choice&&!available)return;const next=choice?changeClassResource(draft,'diviner-third-eye',1):draft;onChange({...next,details:{...next.details!,fighterCalculator:{...next.details!.fighterCalculator!,divinerSight:choice}}})}}>
  <option value="">未激活</option>{divinerSightOptions.map(option=><option key={option} disabled={!available&&c.divinerSight!==option}>{option}</option>)}
 </select><small>激活消耗一次使用机会，效果持续至开始短休或长休；完成休息后恢复使用次数。法术时长按法术规则计算。</small></label>;
}
export function DivinerSheet({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<10)return null;
 const choice=divinerSight(draft);
 return <><h3>天眼通：{choice||'未激活'}</h3><p className="character-help">{choice==='黑暗视觉'?'具有 120 尺黑暗视觉。':choice==='高等通晓'?'可以阅读任何语言。':choice==='识破隐形'?'可不消耗法术位施放识破隐形。':'以附赠动作选择一种效果。'}所选增益持续至开始短休或长休；法术时长按法术规则计算。开始休息时效果结束，完成短休或长休后恢复使用次数。</p></>;
}
