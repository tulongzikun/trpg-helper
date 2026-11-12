import type { CharacterDraft } from './characters';
import { divinerSight, divinerSightOptions } from './diviner';
export function DivinerEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c||c.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<10)return null;
 return <label>天眼通：当前效果<select value={c.divinerSight??''} onChange={e=>onChange({...draft,details:{...details,fighterCalculator:{...c,divinerSight:e.target.value as typeof divinerSightOptions[number]|''}}})}>
  <option value="">未激活</option>{divinerSightOptions.map(option=><option key={option}>{option}</option>)}
 </select><small>所选增益持续至开始短休或长休；法术时长按法术规则计算。休息和使用次数需手动记录。</small></label>;
}
export function DivinerSheet({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<10)return null;
 const choice=divinerSight(draft);
 return <><h3>天眼通：{choice||'未激活'}</h3><p className="character-help">{choice==='黑暗视觉'?'具有 120 尺黑暗视觉。':choice==='高等通晓'?'可以阅读任何语言。':choice==='识破隐形'?'可不消耗法术位施放识破隐形。':'以附赠动作选择一种效果。'}所选增益持续至开始短休或长休；法术时长按法术规则计算。休息及使用次数需手动记录。</p></>;
}
