import type { CharacterDraft } from './characters';
import { speciesResources } from './speciesResources';
import { activateGiantForm, endGiantForm } from './giantForm';
export function GiantFormEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const c=draft.details?.fighterCalculator;if(c?.species!=='歌利亚'||draft.level<5)return null;
 const remaining=speciesResources(draft).find(x=>x.id==='goliath-large')?.remaining??0;
 return <div><h3>巨人形态</h3><p className="character-help">在足够大的空间中激活后，体型变为大型，速度增加 10 尺，力量检定具有优势；持续 10 分钟，时间和空间条件需自行管理。</p><p className="sheet-text">当前：{c.giantFormActive?'已激活':'未激活'}；剩余 {remaining} 次。</p><button type="button" className="button-secondary" disabled={!remaining||!!c.giantFormActive} onClick={()=>onChange(activateGiantForm(draft))}>使用巨人形态</button>{c.giantFormActive&&<button type="button" className="button-secondary" onClick={()=>onChange(endGiantForm(draft))}>结束效果</button>}</div>;
}
