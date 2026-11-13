import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { speciesResources } from './speciesResources';
import { startCelestialRevelation, endCelestialRevelation, type CelestialForm } from './celestialRevelation';
const labels:Record<CelestialForm,string>={wings:'天界之翼',radiance:'内在光辉',shroud:'黯蚀斗篷'};
export function CelestialRevelationEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const [chosen,setChosen]=useState<CelestialForm>('wings');const c=draft.details?.fighterCalculator;if(c?.species!=='阿斯莫'||draft.level<3)return null;
 const remaining=speciesResources(draft).find(x=>x.id==='aasimar-celestial-revelation')?.remaining??0;
 return <div><h3>天界启示</h3><p className="character-help">持续 1 分钟；选择天界之翼时飞行速度等于当前速度。持续时间和其他效果需自行管理。</p><label>本次形态<select value={chosen} onChange={e=>setChosen(e.target.value as CelestialForm)}>{Object.entries(labels).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><p className="sheet-text">当前：{c.celestialForm?labels[c.celestialForm]:'未激活'}。</p><button type="button" className="button-secondary" disabled={!remaining||!!c.celestialForm} onClick={()=>onChange(startCelestialRevelation(draft,chosen))}>使用天界启示</button>{c.celestialForm&&<button type="button" className="button-secondary" onClick={()=>onChange(endCelestialRevelation(draft))}>结束效果</button>}</div>;
}
