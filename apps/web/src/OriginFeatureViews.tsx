import type { CharacterDraft } from './characters';
import { getBackground } from './backgrounds';
import { proficiencyBonus } from './characterRules';
function isMusician(d:CharacterDraft){const c=d.details?.fighterCalculator;return !!c&&(getBackground(d.details?.background)?.feat==='音乐家'||(c.species==='人类'&&c.humanOriginFeat==='音乐家'));}
export function OriginFeatureEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c)return null;
 return <section className="character-section"><h2>英雄激励</h2><label className="inspiration-toggle"><input type="checkbox" checked={!!c.heroicInspiration} onChange={e=>onChange({...draft,details:{...details,fighterCalculator:{...c,heroicInspiration:e.target.checked}}})}/> 当前拥有英雄激励</label><p className="character-help">消耗时可重掷一枚骰子；同一时间只能拥有一个。人类完成长休时会获得英雄激励。</p>{isMusician(draft)&&<p className="character-help">音乐家：短休或长休结束时演奏乐器，可让至多 {proficiencyBonus(draft.level)} 名盟友获得英雄激励；盟友的状态需分别记录。</p>}</section>;
}
export function OriginFeatureSheet({draft}:{draft:CharacterDraft}){const c=draft.details?.fighterCalculator;if(!c)return null;return <section className="character-section"><h2>英雄激励</h2><p className="sheet-text">{c.heroicInspiration?'拥有':'未拥有'}</p>{isMusician(draft)&&<p className="character-help">音乐家：短休或长休结束时演奏乐器，可让至多 {proficiencyBonus(draft.level)} 名盟友获得英雄激励。</p>}</section>}
