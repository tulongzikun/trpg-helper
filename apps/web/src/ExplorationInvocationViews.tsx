import type { CharacterDraft } from './characters';
import { explorationInvocations, invocationState } from './explorationInvocations';

export function InvocationEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
 const details = draft.details, c = details?.fighterCalculator;
 if (!details || !c || c.characterClass !== '邪术师') return null;
 const state = invocationState(draft);
 const change = (ids: string[]) => onChange({ ...draft, details: { ...details, fighterCalculator: { ...c, explorationInvocations: ids } } });
 return (
  <div className="character-section">
   <h3 className="section-label">魔能祈唤</h3>
   <p className="character-help">已选 {state.selected.length} / {state.limit} 项。此处校验祈唤数量、等级先决与替换（先决祈唤需先选）；战斗与叙事效果需按规则手动结算。</p>
   {state.errors.map((error) => <p key={error} className="battle-error">{error}</p>)}
   {state.invalid && <button type="button" className="button-secondary" onClick={() => change([])}>清除祈唤选择</button>}
   <div className="proficiency-grid">
    {explorationInvocations.map((item) => {
     const checked = state.selected.includes(item.id);
     const missing = (item.requires ?? []).filter((need) => !state.selected.includes(need)).map((need) => explorationInvocations.find((x) => x.id === need)?.name ?? need);
     const disabled = !checked && (draft.level < item.level || state.selected.length >= state.limit || missing.length > 0);
     return (
      <label key={item.id} title={item.note}>
       <input type="checkbox" checked={checked} disabled={disabled} aria-label={`魔能祈唤：${item.name}`} onChange={(e) => change(e.target.checked ? [...state.selected, item.id] : state.selected.filter((x) => x !== item.id))} />
       {item.name}（{item.level} 级{missing.length ? `；需先选：${missing.join('、')}` : ''}）
      </label>
     );
    })}
   </div>
  </div>
 );
}

export function InvocationSheet({ draft }: { draft: CharacterDraft }) {
 const state = invocationState(draft);
 if (!state.active.length) return null;
 const chosen = explorationInvocations.filter((x) => state.active.includes(x.id));
 return <><h3 className="section-label">魔能祈唤</h3><ul className="sheet-text">{chosen.map((x) => <li key={x.id}><strong>{x.name}：</strong>{x.note}</li>)}</ul></>;
}
