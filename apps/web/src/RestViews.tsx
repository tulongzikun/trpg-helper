import type { CharacterDraft } from './characters';
import { completeRest } from './characterRest';
export function RestEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 if(!draft.details?.fighterCalculator)return null;
 return <section className="character-section"><h2>完成休息</h2><p className="character-help">恢复已支持的职业资源、法术位和物种及起源次数。可选择的特殊恢复、生命骰及未接入的能力仍需手动处理；预言师的天眼通会结束；人类长休后获得英雄激励。</p><div className="card-actions"><button type="button" className="button-secondary" onClick={()=>onChange(completeRest(draft,'short'))}>完成短休</button><button type="button" className="button-secondary" onClick={()=>onChange(completeRest(draft,'long'))}>完成长休</button></div></section>;
}
