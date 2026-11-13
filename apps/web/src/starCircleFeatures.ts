import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources } from './classResources.ts';
import { activeStarryForm } from './starryForm.ts';
import { dpConfig, isDruid } from './druidPaladinShared.ts';
// 星辰结社：星图、星耀形态、宇宙预兆、闪烁星座、灿若繁星 的角色卡派生与提示。
function stars(draft:CharacterDraft){const c=dpConfig(draft);return isDruid(draft)&&c?.subclass==='stars'&&draft.level>=3?c:null;}
export function starryFormEffects(draft:CharacterDraft){
 const form=activeStarryForm(draft);if(!form)return null;
 const wis=abilityModifier(draft.abilities.wis),die=draft.level>=10?'2d8':'1d8';
 if(form==='archer')return {form,title:'射手座',detail:`激活时及之后每回合可用附赠动作发动远程法术攻击（60 尺），造成 ${die}${wis>=0?'+':''}${wis} 光耀伤害。`};
 if(form==='chalice')return {form,title:'圣杯座',detail:`消耗法术位施展治疗法术时，自己或 30 尺内另一生物额外恢复 ${die}${wis>=0?'+':''}${wis} 生命值。`};
 return {form,title:'巨龙座',detail:`智力、感知检定或维持专注的体质豁免掷出 9 或更低时视为 10。${draft.level>=10?'另获得 20 尺飞行速度与悬浮。':''}`};
}
export function starMapState(draft:CharacterDraft){
 const c=stars(draft);if(!c)return null;
 const guidingBolt=classResources(draft).find(x=>x.id==='stars-guiding-bolt');
 return {held:!!c.starMapHeld,guidingBoltRemaining:guidingBolt?.remaining??0,maxGuidingBolt:Math.max(1,abilityModifier(draft.abilities.wis))};
}
export function cosmicOmenState(draft:CharacterDraft){
 const c=stars(draft);if(!c||draft.level<6)return null;
 const roll=c.cosmicOmenRoll;
 const recorded=typeof roll==='number'&&Number.isSafeInteger(roll)&&roll>0?roll:undefined;
 const resource=classResources(draft).find(x=>x.id==='stars-cosmic-omen');
 return {roll:recorded,omen:recorded===undefined?undefined:recorded%2===0?'吉兆':'凶兆' as const,maximum:Math.max(1,abilityModifier(draft.abilities.wis)),remaining:resource?.remaining??0};
}
export function starCircleNotes(draft:CharacterDraft):string[]{
 if(!stars(draft))return [];const notes:string[]=[];
 notes.push('星图：持握时始终准备神导术与光导箭，光导箭可免费施放；星图遗失后可用 1 小时仪式重造（需手动记录丢失与重造）。');
 if(draft.level>=10)notes.push('闪烁星座：自己回合开始时可以切换星耀形态的星座；射手座与圣杯座的骰子提升为 2d8。');
 if(draft.level>=14)notes.push('灿若繁星：星耀形态期间获得钝击、穿刺、挥砍伤害抗性。');
 return notes;
}
export function starryFormResistances(draft:CharacterDraft):string[]{
 return activeStarryForm(draft)&&draft.level>=14?['钝击','穿刺','挥砍']:[];
}
