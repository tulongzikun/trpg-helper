import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources, changeClassResource } from './classResources.ts';
import { spellSlotResources, changeSpellSlot } from './spellSlotResources.ts';
import { dpConfig, isDruid } from './druidPaladinShared.ts';
// 月亮结社：结社形态、进阶结社形态、月光飞步、月辉形态。
function moon(draft:CharacterDraft){const c=dpConfig(draft);return isDruid(draft)&&c?.subclass==='moon'&&draft.level>=3?c:null;}
export function moonShapeState(draft:CharacterDraft){
 if(!moon(draft))return null;
 const wis=abilityModifier(draft.abilities.wis);
 return {maxChallenge:Math.floor(draft.level/3),acOption:13+wis,tempHp:draft.level*3,lunarRadiance:draft.level>=6,conSaveBonus:draft.level>=6?wis:0,improvedRadiance:draft.level>=14};
}
export function moonStepMax(draft:CharacterDraft):number{
 return Math.max(1,abilityModifier(draft.abilities.wis));
}
export function moonStepRemaining(draft:CharacterDraft):number{
 return classResources(draft).find(x=>x.id==='druid-moon-step')?.remaining??0;
}
export function useMoonStep(draft:CharacterDraft):CharacterDraft{
 if(!moon(draft)||draft.level<10||!moonStepRemaining(draft))return draft;
 return changeClassResource(draft,'druid-moon-step',1);
}
export function restoreMoonStepWithSlot(draft:CharacterDraft,slotLevel:number):CharacterDraft{
 if(!moon(draft)||draft.level<10||!Number.isInteger(slotLevel)||slotLevel<2||slotLevel>5)return draft;
 const resource=classResources(draft).find(x=>x.id==='druid-moon-step');if(!resource||resource.remaining>=resource.maximum)return draft;
 const slot=spellSlotResources(draft).find(x=>x.id===`德鲁伊:slot:${slotLevel}`);if(!slot?.remaining)return draft;
 return changeClassResource(changeSpellSlot(draft,`德鲁伊:slot:${slotLevel}`,1),'druid-moon-step',-1);
}
export function moonCircleNotes(draft:CharacterDraft):string[]{
 const state=moonShapeState(draft);if(!state)return [];const notes:string[]=[];
 notes.push(`结社形态：荒野变形最大挑战等级 ${state.maxChallenge}；变形时可选择 AC ${state.acOption}（13+感知），并获得 ${state.tempHp} 点临时生命值。`);
 if(draft.level>=6)notes.push('进阶结社形态：变形攻击命中时可选择造成光耀伤害；体质豁免加感知调整值。');
 if(draft.level>=10)notes.push('月光飞步：附赠动作传送 30 尺，本回合下一次攻击具有优势；可消耗 2 环及以上法术位恢复一次使用次数。');
 if(draft.level>=14)notes.push('月辉形态：每回合一次，变形攻击命中额外造成 2d10 光耀伤害；月光飞步可携带 10 尺内一名自愿生物。');
 return notes;
}
