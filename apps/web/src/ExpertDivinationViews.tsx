import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { spellSlotResources } from './spellSlotResources';
import { useExpertDivination } from './expertDivination';
export function ExpertDivinationEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const [castLevel,setCastLevel]=useState(0),[recoverLevel,setRecoverLevel]=useState(0);const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<6)return null;
 const slots=spellSlotResources(draft);const cast=slots.filter(s=>Number(s.id.split(':').at(-1))>=2&&s.remaining>0);const recover=slots.filter(s=>{const level=Number(s.id.split(':').at(-1));return level>=1&&level<=5&&level<castLevel&&s.spent>0});
 const valid=cast.some(x=>x.id===`法师:slot:${castLevel}`)&&recover.some(x=>x.id===`法师:slot:${recoverLevel}`);
 return <div><h3>预言专家</h3><p className="character-help">以 2 环或更高法术位施放预言学派法术时，恢复一个较低环阶、最高 5 环的已消耗法术位。法术是否符合条件需自行确认；按钮会同时消耗施法的法术位并恢复所选法术位。</p><label>施法消耗<select value={castLevel} onChange={e=>{setCastLevel(Number(e.target.value));setRecoverLevel(0)}}><option value={0}>请选择</option>{cast.map(x=><option key={x.id} value={Number(x.id.split(':').at(-1))}>{x.label}（剩余 {x.remaining}）</option>)}</select></label><label>恢复法术位<select value={recoverLevel} onChange={e=>setRecoverLevel(Number(e.target.value))}><option value={0}>请选择</option>{recover.map(x=><option key={x.id} value={Number(x.id.split(':').at(-1))}>{x.label}（已消耗 {x.spent}）</option>)}</select></label><button type="button" className="button-secondary" disabled={!valid} onClick={()=>{onChange(useExpertDivination(draft,castLevel,recoverLevel));setCastLevel(0);setRecoverLevel(0)}}>记录施法并恢复法术位</button></div>;
}
