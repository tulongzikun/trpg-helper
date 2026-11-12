import type { CharacterDraft } from './characters';
import { wildAspects, wildHeart } from './wildHeart';
export function WildHeartEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c||!wildHeart(draft)||draft.level<6)return null;
 return <label>兽之形貌<select value={c.wildAspect??''} onChange={e=>onChange({...draft,details:{...details,fighterCalculator:{...c,wildAspect:e.target.value as typeof wildAspects[number]|''}}})}>
  <option value="">请选择</option><option value="枭">枭：黑暗视觉</option><option value="豹">豹：攀爬速度</option><option value="鲑">鲑：游泳速度</option>
 </select><small>长休后可以更换；感官和移动数值会自动更新。</small></label>;
}
export function WildHeartSheet({draft}:{draft:CharacterDraft}){
 const w=wildHeart(draft);if(!w)return null;
 return <><h3>兽心：仪式法术</h3><p className="character-help">{w.rituals.join('、')}（只能以仪式施放；施法属性为感知）。{draft.level>=6?`兽之形貌：${w.aspect||'尚未选择'}，长休后可更换。`:''}</p></>;
}
