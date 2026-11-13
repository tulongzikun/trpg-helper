import type { CharacterDraft } from './characters';
import { landAidNote,landRecoveryState,useLandFreeCast,recoverLandSlots,landSanctuaryNote } from './landCircleFeatures.ts';
import { moonStepMax,moonStepRemaining,useMoonStep,restoreMoonStepWithSlot,moonCircleNotes } from './moonCircleFeatures.ts';
import { seaWrathState,startSeaWrath,endSeaWrath,seaCircleNotes } from './seaCircleFeatures.ts';
import { starryFormEffects,cosmicOmenState,starCircleNotes,starryFormResistances } from './starCircleFeatures.ts';
import { capstoneState,activateCapstone,endCapstone,restoreCapstoneWithSlot,oathAuraState,oathFeatureNotes,oathChannelOptions } from './paladinOaths.ts';
// 子职业特性视图：大地/月亮/海洋/星辰结社与圣武士四个誓约。
function druidLand(draft:CharacterDraft){const c=draft.details?.fighterCalculator;return c?.characterClass==='德鲁伊'&&c.subclass==='land'&&draft.level>=3;}
function moon(draft:CharacterDraft){const c=draft.details?.fighterCalculator;return c?.characterClass==='德鲁伊'&&c.subclass==='moon'&&draft.level>=3;}
function sea(draft:CharacterDraft){const c=draft.details?.fighterCalculator;return c?.characterClass==='德鲁伊'&&c.subclass==='sea'&&draft.level>=3;}
function stars(draft:CharacterDraft){const c=draft.details?.fighterCalculator;return c?.characterClass==='德鲁伊'&&c.subclass==='stars'&&draft.level>=3;}
function paladin(draft:CharacterDraft){const c=draft.details?.fighterCalculator;return c?.characterClass==='圣武士'&&draft.level>=3;}
export function LandFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 if(!druidLand(draft))return null;const recovery=landRecoveryState(draft);
 return <div className="character-section"><h3>大地结社特性</h3>
  <p className="character-help">{landAidNote(draft)}</p>
  {draft.level>=14&&<p className="character-help">{landSanctuaryNote(draft)}</p>}
  {recovery&&<div><p className="section-label">自然恢复</p>
   <button type="button" className="button-secondary" disabled={!recovery.freeCastRemaining} onClick={()=>onChange(useLandFreeCast(draft))}>免费施展一道 1 环及以上结社法术</button>
   <p className="character-help">短休时可恢复总环阶不超过 {recovery.maxSlotLevels} 的法术位（不含 6 环及以上），长休前一次。</p>
   {[1,2,3,4,5].map(level=><button key={level} type="button" className="button-secondary" disabled={!recovery.slotRecoveryRemaining} onClick={()=>onChange(recoverLandSlots(draft,{[`德鲁伊:slot:${level}`]:1}))}>恢复 1 个 {level} 环法术位</button>)}
  </div>}
 </div>;
}
export function LandFeaturesSheet({draft}:{draft:CharacterDraft}){
 if(!druidLand(draft))return null;const notes=[landAidNote(draft)];
 if(draft.level>=6)notes.push(`自然恢复：可免费施展一道结社法术（长休恢复）；短休时可恢复总环阶不超过 ${Math.ceil(draft.level/2)} 的法术位（长休前一次）。`);
 if(draft.level>=10)notes.push('自然守御：免疫中毒状态，并获得当前地形对应的伤害抗性。');
 if(draft.level>=14)notes.push(landSanctuaryNote(draft));
 return <><h3>大地结社</h3>{notes.map((note,index)=><p key={index} className="sheet-text">{note}</p>)}</>;
}
export function MoonFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 if(!moon(draft)||draft.level<10)return null;const remaining=moonStepRemaining(draft),maximum=moonStepMax(draft);
 return <div className="character-section"><h3>月亮结社特性</h3>
  <p className="character-help">月光飞步剩余 {remaining} 次；附赠动作传送最多 30 尺，本回合下一次攻击具有优势。</p>
  <button type="button" className="button-secondary" disabled={!remaining} onClick={()=>onChange(useMoonStep(draft))}>使用月光飞步</button>
  <p className="character-help">也可消耗一个 2 环及以上法术位恢复一次使用次数。</p>
  {[2,3,4,5].map(level=><button key={level} type="button" className="button-secondary" disabled={remaining>=maximum} onClick={()=>onChange(restoreMoonStepWithSlot(draft,level))}>消耗 {level} 环法术位恢复一次</button>)}
 </div>;
}
export function MoonFeaturesSheet({draft}:{draft:CharacterDraft}){
 if(!moon(draft))return null;return <><h3>月亮结社</h3>{moonCircleNotes(draft).map((note,index)=><p key={index} className="sheet-text">{note}</p>)}</>;
}
export function SeaFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 const state=seaWrathState(draft);if(!sea(draft)||!state)return null;
 return <div className="character-section"><h3>海洋结社特性</h3>
  <p className="character-help">{state.note}</p>
  {state.active?<button type="button" className="button-secondary" onClick={()=>onChange(endSeaWrath(draft))}>解除瀚海之怒光环</button>:<button type="button" className="button-secondary" onClick={()=>onChange(startSeaWrath(draft))}>消耗一次荒野变身显现瀚海之怒</button>}
 </div>;
}
export function SeaFeaturesSheet({draft}:{draft:CharacterDraft}){
 if(!sea(draft))return null;return <><h3>海洋结社</h3>{seaCircleNotes(draft).map((note,index)=><p key={index} className="sheet-text">{note}</p>)}</>;
}
export function StarFeaturesEditor({draft}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 if(!stars(draft))return null;const effects=starryFormEffects(draft),omen=cosmicOmenState(draft);
 return <div className="character-section"><h3>星辰结社特性</h3>
  {effects?<p className="character-help">{effects.title}：{effects.detail}</p>:<p className="character-help">当前未激活星耀形态；星耀形态与星图可在「星辰结社」界面管理。</p>}
  {omen&&<p className="character-help">宇宙预兆：{omen.roll!==undefined?`本日 ${omen.omen}（${omen.roll}）`:'本日尚未掷骰'}；剩余 {omen.remaining}/{omen.maximum} 次。</p>}
 </div>;
}
export function StarFeaturesSheet({draft}:{draft:CharacterDraft}){
 if(!stars(draft))return null;const effects=starryFormEffects(draft),resistance=starryFormResistances(draft);
 return <><h3>星辰结社</h3>
  {effects&&<p className="sheet-text">{effects.title}：{effects.detail}</p>}
  {draft.level>=14&&<p className="sheet-text">灿若繁星：{resistance.length?`星耀形态期间获得${resistance.join('、')}伤害抗性。`:'星耀形态期间获得钝击、穿刺、挥砍伤害抗性。'}</p>}
  {starCircleNotes(draft).map((note,index)=><p key={index} className="sheet-text">{note}</p>)}</>;
}
export function OathFeaturesEditor({draft,onChange}:{draft:CharacterDraft;onChange:(draft:CharacterDraft)=>void}){
 if(!paladin(draft))return null;const capstone=capstoneState(draft);
 if(!capstone)return null;
 return <div className="character-section"><h3>{capstone.name}</h3>
  <p className="character-help">{capstone.note}剩余 {capstone.remaining} 次{capstone.active?'；当前已激活':''}。</p>
  <button type="button" className="button-secondary" disabled={!capstone.remaining||capstone.active} onClick={()=>onChange(activateCapstone(draft))}>激活 {capstone.name}</button>
  <button type="button" className="button-secondary" disabled={!capstone.active} onClick={()=>onChange(endCapstone(draft))}>结束效果</button>
  <button type="button" className="button-secondary" disabled={!!capstone.remaining} onClick={()=>onChange(restoreCapstoneWithSlot(draft))}>消耗 5 环法术位恢复使用次数</button>
 </div>;
}
export function OathFeaturesSheet({draft}:{draft:CharacterDraft}){
 if(!paladin(draft))return null;const aura=oathAuraState(draft),notes=oathFeatureNotes(draft),options=oathChannelOptions(draft);
 return <><h3>誓约子职业特性</h3>
  {aura&&<p className="sheet-text">{aura.title}（{aura.radius} 尺）：{aura.benefits.join(' ')}</p>}
  {notes.map((note,index)=><p key={index} className="sheet-text">{note}</p>)}
  {options.map((option,index)=><p key={index} className="sheet-text">{option}</p>)}
 </>;
}
