import type { CharacterDraft } from './characters';
import { classLanguageOptions, languageState } from './languages';

export function ClassLanguageEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const details=draft.details,config=details?.fighterCalculator;if(!details||!config)return null;
 const state=languageState(draft);
 return <>{state.fixed.length>0&&<p className="character-help">职业语言：{state.fixed.join('、')}。</p>}{state.invalid&&<p className="battle-error" role="alert">职业语言无效或与已有语言重复，请调整。</p>}{Array.from({length:state.limit},(_,i)=><label key={i}>职业额外语言 {i+1}<select value={state.selected[i]??''} onChange={e=>{const values=[...state.selected];while(values.length<state.limit)values.push('');values[i]=e.target.value;onChange({...draft,details:{...details,fighterCalculator:{...config,classLanguages:values}}})}}><option value="">暂不选择</option>{state.selected[i]&&!classLanguageOptions.includes(state.selected[i])&&<option value={state.selected[i]}>{state.selected[i]}（无效）</option>}{classLanguageOptions.map(name=><option key={name} value={name} disabled={state.known.includes(name)&&state.selected[i]!==name}>{name}</option>)}</select></label>)}</>;
}
