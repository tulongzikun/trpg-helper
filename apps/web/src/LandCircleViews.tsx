import type { CharacterDraft } from './characters';
import { landResistance, landTypes } from './preparedSpells';

export function LandCircleEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c||c.characterClass!=='德鲁伊'||c.subclass!=='land'||draft.level<3)return null;
 return <label>大地结社地形<select value={c.landType??''} onChange={e=>onChange({...draft,details:{...details,fighterCalculator:{...c,landType:e.target.value as typeof landTypes[number]|''}}})}>
  <option value="">请选择</option>{landTypes.map(t=><option key={t}>{t}</option>)}
 </select><small>每次长休后可以重新选择；常备法术及 10 级起的抗性随选择变化。</small></label>;
}
export function LandCircleSheet({draft}:{draft:CharacterDraft}){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='德鲁伊'||c.subclass!=='land'||draft.level<3)return null;
 const resistance=landResistance(draft);
 return <><h3>大地结社：{c.landType||'尚未选择地形'}</h3>{draft.level>=6&&<p className="character-help">自然恢复：长休后可免费施放一次当前地形的 1 环或以上常备法术。</p>}{draft.level>=10&&<p className="character-help">自然守御：免疫中毒状态{resistance?`，具有${resistance}伤害抗性`:'；选择地形后获得对应伤害抗性'}。</p>}</>;
}
