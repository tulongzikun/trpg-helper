import type { CharacterDraft } from './characters';
import { activateDragonFlight, endDragonFlight } from './dragonFlight';
import { speciesResources } from './speciesResources';
export function DragonFlightEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const c=draft.details?.fighterCalculator;if(c?.species!=='龙裔'||draft.level<5)return null;
 const remaining=speciesResources(draft).find(x=>x.id==='dragon-flight')?.remaining??0;
 return <div><h3>龙族飞行</h3><p className="character-help">激活后飞行速度等于当前速度，持续 10 分钟；收回龙翼或失能时结束。持续时间和失能状态需自行管理。</p><p className="sheet-text">当前：{c.dragonFlightActive?'已激活':'未激活'}；剩余 {remaining} 次。</p><button type="button" className="button-secondary" disabled={!remaining||!!c.dragonFlightActive} onClick={()=>onChange(activateDragonFlight(draft))}>使用龙族飞行</button>{c.dragonFlightActive&&<button type="button" className="button-secondary" onClick={()=>onChange(endDragonFlight(draft))}>收回龙翼</button>}</div>;
}
