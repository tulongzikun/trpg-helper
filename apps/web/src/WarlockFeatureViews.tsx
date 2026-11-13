import type { CharacterDraft } from './characters';
import { epicBoon, setEpicBoon } from './druidPaladinShared.ts';
import {
 warlockFeatureState, warlockSheetLines, patchWarlockConfig, isWarlock, hexAbilities, fiendResistanceTypes, celestialHealingDice,
} from './warlockFeatures.ts';

export function WarlockFeaturesEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
 if (!isWarlock(draft)) return null;
 const state = warlockFeatureState(draft);
 const derived = state.derived;
 return (
  <div className="character-section">
   <h3 className="section-label">邪术师特性</h3>
   {state.errors.map((error) => <p key={error} className="battle-error">{error}</p>)}
   <p className="character-help">契约法术位 {state.level >= 17 ? 4 : state.level >= 11 ? 3 : state.level >= 2 ? 2 : 1} 枚（短休或长休恢复全部）；法术选择见「戏法与准备法术」，祈唤见「魔能祈唤」。</p>
   {state.arcanum.length > 0 && <div>
    <p className="section-label">玄奥秘法</p>
    <ul className="sheet-text">{state.arcanum.map((entry) => <li key={entry.level}>{entry.level} 环：{entry.name}（1 次/长休）</li>)}</ul>
    <p className="character-help">替换秘法需在获得邪术师等级时进行，所选法术须为同环阶魔契师法术；升级记录在此处人工核对。</p>
   </div>}
   {state.subclass === 'celestial' && <p className="character-help">治愈之光骰池：{celestialHealingDice(draft.level)} 枚 d6，长休恢复；单次最多消耗魅力调整值（至少 1）枚。</p>}
   {state.subclass === 'archfey' && <p className="character-help">妖精步伐 {derived.feyStepsUses} 次/长休；雾遁、斗转星移与醉心魔法的触发与反伤需人工结算。</p>}
   {state.subclass === 'fiend' && draft.level >= 10 && <label>邪魔体魄·抗性类型<select aria-label="邪魔体魄抗性类型" value={state.fiendResistance} onChange={(e) => onChange(patchWarlockConfig(draft, { fiendResistance: e.target.value }))}>
    <option value="">未选</option>{fiendResistanceTypes.map((type) => <option key={type} value={type}>{type}</option>)}
   </select></label>}
   {state.subclass === 'great-old-one' && draft.level >= 10 && <label>骇异恶咒·脆弱诅咒属性<select aria-label="骇异恶咒脆弱诅咒属性" value={state.hexAbility} onChange={(e) => onChange(patchWarlockConfig(draft, { hexAbility: e.target.value }))}>
    <option value="">未选</option>{hexAbilities.map((ability) => <option key={ability} value={ability}>{ability}</option>)}
   </select></label>}
   {state.subclass === 'great-old-one' && <p className="character-help">唤醒心灵范围 {derived.awakenMindRangeMiles} 英里；锐眼斗士与创造奴仆需按规则手动处理。</p>}
   {draft.level >= 19 && <label>传奇恩惠<input aria-label="传奇恩惠" value={epicBoon(draft)} placeholder="如：扭曲命运之恩惠" onChange={(e) => onChange(setEpicBoon(draft, e.target.value))} /></label>}
  </div>
 );
}

export function WarlockFeaturesSheet({ draft }: { draft: CharacterDraft }) {
 if (!isWarlock(draft)) return null;
 const lines = warlockSheetLines(draft);
 if (!lines.length) return null;
 return <><h3 className="section-label">邪术师职业特性</h3>{lines.map((line, index) => <p key={index} className="sheet-text">{line}</p>)}</>;
}
