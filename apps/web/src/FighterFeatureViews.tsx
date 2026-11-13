import type { CharacterDraft } from './characters';
import { artisanTools } from './tools2024.ts';
import { epicBoon, setEpicBoon } from './druidPaladinShared.ts';
import {
 fighterFeatureState, fighterSheetLines, patchFighterConfig, fightingStyles, weapons, maneuvers, fighterSkills,
} from './fighterFeatures.ts';

export function FighterFeaturesEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
 const c = draft.details?.fighterCalculator;
 if (c?.characterClass !== '战士') return null;
 const state = fighterFeatureState(draft);
 const config = c as typeof c & { fightingStyles?: string[]; weaponMastery?: string[]; maneuvers?: string[]; martialTool?: string; martialSkill?: string; weaponBond?: string[] };
 const toggle = (field: 'fightingStyles' | 'weaponMastery' | 'maneuvers', value: string) => {
  const current = Array.isArray(config[field]) ? config[field]! : [];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  onChange(patchFighterConfig(draft, { [field]: next }));
 };
 return (
  <div className="character-section">
   <h3 className="section-label">战士特性</h3>
   {state.errors.map((error) => <p key={error} className="battle-error">{error}</p>)}
   <div>
    <p className="section-label">战斗风格（{state.fightingStyles.length}/{state.limits.fightingStyles}）</p>
    <div className="proficiency-grid">
     {fightingStyles.map((item) => {
      const checked = state.fightingStyles.includes(item.id);
      return <label key={item.id} title={item.note}><input type="checkbox" checked={checked} disabled={!checked && state.fightingStyles.length >= state.limits.fightingStyles} aria-label={`战斗风格：${item.name}`} onChange={() => toggle('fightingStyles', item.id)} />{item.name}</label>;
     })}
    </div>
   </div>
   <div>
    <p className="section-label">武器精通（{state.weaponMastery.length}/{state.limits.weaponMastery}）</p>
    <p className="character-help">选择武器后记录对应精通词条；战斗内如何触发仍需按规则结算。</p>
    <div className="proficiency-grid">
     {weapons.map((item) => {
      const checked = state.weaponMastery.includes(item.id);
      return <label key={item.id}><input type="checkbox" checked={checked} disabled={!checked && state.weaponMastery.length >= state.limits.weaponMastery} aria-label={`武器精通：${item.name}`} onChange={() => toggle('weaponMastery', item.id)} />{item.name}（{item.property}）</label>;
     })}
    </div>
   </div>
   {state.subclass === 'battle-master' && <div>
    <p className="section-label">战技（{state.maneuvers.length}/{state.limits.maneuvers}）</p>
    <p className="character-help">卓越骰 {state.limits.superiorityDice.count} 枚 d{state.limits.superiorityDice.die}，短休或长休恢复全部；豁免 DC = 8 + 力量或敏捷调整值 + 熟练。</p>
    <div className="proficiency-grid">
     {maneuvers.map((name) => {
      const checked = state.maneuvers.includes(name);
      return <label key={name}><input type="checkbox" checked={checked} disabled={!checked && state.maneuvers.length >= state.limits.maneuvers} aria-label={`战技：${name}`} onChange={() => toggle('maneuvers', name)} />{name}</label>;
     })}
    </div>
    <label>战争学者·工匠工具<select aria-label="战争学者工匠工具" value={state.martialTool} onChange={(e) => onChange(patchFighterConfig(draft, { martialTool: e.target.value }))}>
     <option value="">未选</option>{artisanTools.map((tool) => <option key={tool} value={tool}>{tool}</option>)}
    </select></label>
    <label>战争学者·技能<select aria-label="战争学者技能" value={state.martialSkill} onChange={(e) => onChange(patchFighterConfig(draft, { martialSkill: e.target.value }))}>
     <option value="">未选</option>{fighterSkills.map((skill) => <option key={skill} value={skill}>{skill}</option>)}
    </select></label>
   </div>}
   {state.subclass === 'champion' && <p className="character-help">{state.limits.criticalRange ? `重击范围：d20 掷出 ${state.limits.criticalRange[0]} 至 ${state.limits.criticalRange[1]} 即为重击。` : ''}运动健将：先攻与力量（运动）检定优势；勇战英豪与百折不挠的战斗触发需人工结算。</p>}
   {state.subclass === 'eldritch-knight' && <div>
    <p className="section-label">战争联结（{state.weaponBond.length}/2）</p>
    <p className="character-help">记录已联结的武器；召唤、缴械免疫与附赠动作召唤按规则手动处理。法术选择见「戏法与准备法术」。</p>
    {[0, 1].map((index) => <label key={index}>联结武器 {index + 1}<input aria-label={`战争联结武器 ${index + 1}`} value={state.weaponBond[index] ?? ''} onChange={(e) => {
     const next = [state.weaponBond[0] ?? '', state.weaponBond[1] ?? '']; next[index] = e.target.value;
     onChange(patchFighterConfig(draft, { weaponBond: next.filter((name) => name.trim()) }));
    }} placeholder="武器名称" /></label>)}
   </div>}
   {state.subclass === 'psi-warrior' && <p className="character-help">{state.limits.psiDie ? `灵能骰 ${state.limits.psiDie.count} 枚 d${state.limits.psiDie.die}；短休恢复 1 枚、长休恢复全部。` : '灵能骰需 3 级。'}灵能力量与念力系效果的战斗结算需人工处理。</p>}
   {draft.level >= 19 && <label>传奇恩惠<input aria-label="传奇恩惠" value={epicBoon(draft)} placeholder="如：扭曲命运之恩惠" onChange={(e) => onChange(setEpicBoon(draft, e.target.value))} /></label>}
  </div>
 );
}

export function FighterFeaturesSheet({ draft }: { draft: CharacterDraft }) {
 const c = draft.details?.fighterCalculator;
 if (c?.characterClass !== '战士') return null;
 const lines = fighterSheetLines(draft);
 if (!lines.length) return null;
 return <><h3 className="section-label">战士职业特性</h3>{lines.map((line, index) => <p key={index} className="sheet-text">{line}</p>)}</>;
}
