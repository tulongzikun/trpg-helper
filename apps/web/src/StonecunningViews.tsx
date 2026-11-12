import type { CharacterDraft } from './characters';
import { activateStonecunning, endStonecunning, setStoneContact } from './stonecunning';
import { speciesResources } from './speciesResources';
export function StonecunningEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const c=draft.details?.fighterCalculator;if(c?.species!=='矮人')return null;const remaining=speciesResources(draft).find(x=>x.id==='dwarf-stonecunning')?.remaining??0;
 return <div><h3>石中精明</h3><p className="character-help">激活后持续 10 分钟；站在石质表面或接触石质表面时具有 60 尺震颤感知。持续时间请自行记录。</p><label><input type="checkbox" checked={!!c.stoneContact} onChange={e=>onChange(setStoneContact(draft,e.target.checked))}/> 当前接触石质表面</label><p className="sheet-text">状态：{c.stonecunningActive?'已激活':'未激活'}；剩余 {remaining} 次。</p><button type="button" className="button-secondary" disabled={!remaining||!!c.stonecunningActive} onClick={()=>onChange(activateStonecunning(draft))}>使用石中精明</button>{c.stonecunningActive&&<button type="button" className="button-secondary" onClick={()=>onChange(endStonecunning(draft))}>结束效果</button>}</div>;
}
