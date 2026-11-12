import type { CharacterDraft } from './characters';
import { toolProficiencies } from './toolProficiencies';
import { skillState } from './skillEffects';

export function ToolProficiencyEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}) {
  const details = draft.details, config = details?.fighterCalculator;
  if (!details || !config) return null;
  const state = toolProficiencies(draft);
  const skilled = skillState(draft).grantedTools;
  const change = (patch: NonNullable<typeof config.toolChoices>) => onChange({...draft,details:{...details,fighterCalculator:{...config,toolChoices:{...config.toolChoices,...patch}}}});
  return <>
    {state.pool && <label>背景工具熟练<select value={state.backgroundChoice} onChange={e=>change({background:e.target.value})}>
      <option value="">请选择</option>
      {state.backgroundChoice && !state.pool.includes(state.backgroundChoice) && <option value={state.backgroundChoice}>{state.backgroundChoice}（已不符合背景）</option>}
      {state.pool.map(tool=><option key={tool} value={tool}>{tool}</option>)}
    </select></label>}
    {state.subclassPool.length>0&&<label>战争学者：工匠工具<select value={state.subclassChoice} onChange={e=>onChange({...draft,details:{...details,fighterCalculator:{...config,subclassTool:e.target.value}}})}>
      <option value="">请选择</option>
      {state.subclassChoice&&!state.subclassPool.includes(state.subclassChoice)&&<option value={state.subclassChoice}>{state.subclassChoice}（无效）</option>}
      {state.subclassPool.map(tool=><option key={tool} value={tool} disabled={tool!==state.subclassChoice&&(state.fixed.has(tool)||skilled.includes(tool)||state.feats.some(feat=>feat.selected.includes(tool)))}>{tool}</option>)}
    </select></label>}
    {state.classLimit>0&&<div><h3>职业工具熟练（选 {state.classLimit} 项）</h3>
      {state.classInvalid&&<p className="battle-error" role="alert">职业工具选择无效、重复或尚未选满，请调整。</p>}
      <div className="proficiency-grid">{[...new Set([...state.classPool,...state.classSelected])].map(tool=>{
        const chosen=state.classSelected.includes(tool);
        const taken=(!chosen&&state.fixed.has(tool))||skilled.includes(tool)||state.feats.some(feat=>feat.selected.includes(tool));
        return <label key={tool}><input type="checkbox" checked={chosen} disabled={!chosen&&(taken||state.classSelected.length>=state.classLimit)} onChange={e=>{
          const classTools=e.target.checked?[...state.classSelected,tool]:state.classSelected.filter(x=>x!==tool);
          onChange({...draft,details:{...details,fighterCalculator:{...config,classTools}}});
        }}/>{tool}{!state.classPool.includes(tool)?'（已不符合职业）':''}</label>;
      })}</div>
    </div>}
    {state.feats.map(item=><div key={item.source}>
      <h3>{item.feat}：{item.source==='background'?'背景':'人类'}工具熟练（选 3 项）</h3>
      <p className="character-help">从尚未熟练的{item.feat==='工匠'?'工匠工具':'乐器'}中选择三项；也可暂时全部留空。</p>
      {item.invalid && <p className="battle-error" role="alert">工具选择无效、重复或尚未选满，请调整。</p>}
      <div className="proficiency-grid">{[...new Set([...item.options,...item.selected])].map(tool=>{
        const taken = state.fixed.has(tool) || skilled.includes(tool) || state.feats.some(other=>other.source!==item.source&&other.selected.includes(tool));
        return <label key={tool}><input type="checkbox" checked={item.selected.includes(tool)} disabled={!item.selected.includes(tool)&&(taken||item.selected.length>=3)} onChange={e=>{
          const selected=e.target.checked?[...item.selected,tool]:item.selected.filter(x=>x!==tool);
          change({feats:{...config.toolChoices?.feats,[item.source]:selected}});
        }}/>{tool}{!item.options.includes(tool)?'（已不符合专长）':''}</label>;
      })}</div>
    </div>)}
  </>;
}
