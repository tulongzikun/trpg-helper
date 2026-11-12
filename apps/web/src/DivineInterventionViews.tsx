import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { classResources } from './classResources';
import { useDivineIntervention, type InterventionSpell } from './divineIntervention';
import { findSpellDescription, type SpellDescription } from './spellDescriptions';
const catalog=Object.values(import.meta.glob('./data/imported-origin-spells.json',{eager:true,import:'default'}) as Record<string,Record<string,{spells?:InterventionSpell[]}>>)[0];
const descriptions=Object.values(import.meta.glob('./data/imported-spell-descriptions.json',{eager:true,import:'default'}) as Record<string,SpellDescription[]>)[0]??[];
export function DivineInterventionEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const [chosen,setChosen]=useState('');const c=draft.details?.fighterCalculator;if(c?.characterClass!=='牧师'||draft.level<10)return null;
 const entries=(catalog?.['牧师']?.spells??[]).filter(s=>s.level>=1&&s.level<=5);const selected=entries.find(x=>x.name===chosen);const time=selected?findSpellDescription(descriptions,selected.name,selected.level)?.actionType:undefined;const available=!!classResources(draft).find(x=>x.id==='cleric-divine-intervention')?.remaining;
 return <div><h3>神圣干预</h3><p className="character-help">选择不以反应施放的 1 至 5 环牧师法术；使用时无需法术位和材料成分。此处不自动执行法术效果。</p>{!entries.length&&<p className="battle-error">缺少牧师法术索引，请先导入。</p>}<label>法术<select value={chosen} onChange={e=>setChosen(e.target.value)}><option value="">请选择</option>{entries.map(x=>{const action=findSpellDescription(descriptions,x.name,x.level)?.actionType;return <option key={x.level+':'+x.name} value={x.name} disabled={action==='reaction'}>{x.level} 环 · {x.name}{!action?'（施法时间待核对）':action==='reaction'?'（反应，不可选）':''}</option>})}</select></label>{selected&&!time&&<p className="character-help">未找到该法术的施法时间，请先确认它不以反应施放。</p>}<button type="button" className="button-secondary" disabled={!selected||!available||time==='reaction'} onClick={()=>{if(selected)onChange(useDivineIntervention(draft,selected,entries,descriptions));}}>使用神圣干预</button>{c.divineInterventionLast&&<p className="character-help">最近选择：{c.divineInterventionLast.name}（{c.divineInterventionLast.level} 环）。</p>}</div>;
}
