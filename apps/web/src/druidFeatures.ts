import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources, changeClassResource } from './classResources.ts';
import { spellSlotResources, changeSpellSlot } from './spellSlotResources.ts';
import { dpConfig, patchConfig, isDruid, setEpicBoon, type DruidPaladinConfig } from './druidPaladinShared.ts';
// 德鲁伊职业基础特性中角色卡可自动化的部分：荒野变形状态、荒野伙伴、元素之怒、大德鲁伊。
export const elementalFuryChoices=[{id:'potent' as const,label:'强力施法'},{id:'primal' as const,label:'原力蛮击'}];
export function elementalFury(draft:CharacterDraft):{choice:'potent'|'primal'|'';label:string;note:string}|null{
 const c=dpConfig(draft);if(!isDruid(draft)||draft.level<7||!c)return null;
 const choice=c.elementalFury==='potent'||c.elementalFury==='primal'?c.elementalFury:'';
 const label=elementalFuryChoices.find(x=>x.id===choice)?.label??'未选择';
 const note=choice==='potent'?`德鲁伊戏法伤害加感知调整值（${Math.max(0,abilityModifier(draft.abilities.wis))>=0?'+':''}${abilityModifier(draft.abilities.wis)}）；${draft.level>=15?'射程 10 尺及以上的德鲁伊戏法射程再增加 300 尺。':'15 级起射程 10 尺及以上的德鲁伊戏法射程增加 300 尺。'}`:choice==='primal'?`每回合一次，武器攻击或野兽形态攻击命中时额外造成 ${draft.level>=15?'2d8':'1d8'} 寒冷、火焰、闪电或雷鸣伤害（命中时选择）。`:'请在下方选择元素之怒形态；伤害与射程属战斗结算。';
 return {choice,label,note};
}
export function setElementalFury(draft:CharacterDraft,choice:'potent'|'primal'|''):CharacterDraft{
 if(!isDruid(draft)||draft.level<7||!['potent','primal',''].includes(choice))return draft;
 return patchConfig(draft,{elementalFury:choice});
}
// 荒野变形：记录当前形态并消耗次数；数据替换与战斗数值仍由玩家在战斗轮处理。
export function wildShapeRemaining(draft:CharacterDraft):number{
 return classResources(draft).find(x=>x.id==='druid-wildshape')?.remaining??0;
}
export function activeWildShape(draft:CharacterDraft):string|undefined{
 const c=dpConfig(draft);if(!isDruid(draft)||draft.level<2)return undefined;
 return typeof c?.wildShapeActive==='string'&&c.wildShapeActive.trim()?c.wildShapeActive:undefined;
}
export function wildShapeTempHp(draft:CharacterDraft):number|null{
 const form=activeWildShape(draft);if(!form)return null;
 return draft.level*(dpConfig(draft)?.subclass==='moon'&&draft.level>=3?3:1);
}
export function wildShapeAcOption(draft:CharacterDraft):number|null{
 if(!activeWildShape(draft)||dpConfig(draft)?.subclass!=='moon'||draft.level<3)return null;
 return 13+abilityModifier(draft.abilities.wis);
}
export function startWildShape(draft:CharacterDraft,formName:string):CharacterDraft{
 if(!isDruid(draft)||draft.level<2||activeWildShape(draft)||!wildShapeRemaining(draft))return draft;
 const known=dpConfig(draft)?.knownWildShapes;if(!Array.isArray(known)||!known.some(x=>x?.name===formName))return draft;
 const next=changeClassResource(draft,'druid-wildshape',1);
 return patchConfig(next,{wildShapeActive:formName});
}
export function endWildShape(draft:CharacterDraft):CharacterDraft{
 if(!activeWildShape(draft))return draft;return patchConfig(draft,{wildShapeActive:''});
}
// 荒野伙伴：消耗一个法术位或一次荒野变身施展寻获魔宠；长休或解除时消失。
export function wildCompanionState(draft:CharacterDraft){
 const c=dpConfig(draft);if(!isDruid(draft)||draft.level<2||!c)return null;
 const slot=spellSlotResources(draft).find(x=>x.id==='德鲁伊:slot:1');
 return {active:!!c.wildCompanionActive,canUseSlot:!!slot?.remaining,canUseWildShape:wildShapeRemaining(draft)>0};
}
export function summonWildCompanion(draft:CharacterDraft,via:'slot'|'wildshape'):CharacterDraft{
 const state=wildCompanionState(draft);if(!state||state.active)return draft;
 if(via==='slot'){
  const slot=spellSlotResources(draft).find(x=>x.id==='德鲁伊:slot:1');if(!slot?.remaining)return draft;
  return patchConfig(changeSpellSlot(draft,slot.id,1),{wildCompanionActive:true});
 }
 if(via!=='wildshape'||!state.canUseWildShape)return draft;
 return patchConfig(changeClassResource(draft,'druid-wildshape',1),{wildCompanionActive:true});
}
export function dismissWildCompanion(draft:CharacterDraft):CharacterDraft{
 if(!wildCompanionState(draft)?.active)return draft;return patchConfig(draft,{wildCompanionActive:false});
}
// 大德鲁伊：把未使用的荒野变身次数转换为法术位（每次 2 环阶，长休前一次）。
export function natureMagicianState(draft:CharacterDraft){
 const c=dpConfig(draft);if(!isDruid(draft)||draft.level<20||!c)return null;
 const uses=wildShapeRemaining(draft),used=!!c.natureMagicianUsed;
 const recoverable=spellSlotResources(draft).filter(x=>/^德鲁伊:slot:[1-5]$/.test(x.id)&&x.spent>0&&Number(x.id.split(':').at(-1))*1<=uses*2);
 return {used,uses,recoverableLevels:recoverable.map(x=>Number(x.id.split(':').at(-1))).sort((a,b)=>a-b)};
}
export function useNatureMagician(draft:CharacterDraft,slotLevel:number):CharacterDraft{
 const state=natureMagicianState(draft);if(!state||state.used||!Number.isInteger(slotLevel)||slotLevel<1||slotLevel>5)return draft;
 if(!state.recoverableLevels.includes(slotLevel))return draft;
 const cost=Math.ceil(slotLevel/2);if(cost>state.uses)return draft;
 let next=draft;for(let i=0;i<cost;i++)next=changeClassResource(next,'druid-wildshape',1);
 next=changeSpellSlot(next,`德鲁伊:slot:${slotLevel}`,-1);
 return patchConfig(next,{natureMagicianUsed:true});
}
export function druidGrandNotes(draft:CharacterDraft):string[]{
 if(!isDruid(draft))return [];const notes:string[]=[];
 notes.push('施法：感知为施法属性，戏法与准备法术数量由「职业戏法与准备法术」界面校验；德鲁伊法器需自行记录。');
 notes.push('德鲁伊语：已掌握德鲁伊语且始终准备动物交谈（见常备法术）。');
 if(draft.level>=2)notes.push('荒野变形：次数与已知形态由资源与野兽选择界面管理；变形期间的属性、攻击与技能替换需按怪物数据人工处理。');
 if(draft.level>=5)notes.push('荒野复苏：可在「荒野复苏」界面用法术位换回变身次数，或消耗变身恢复 1 环法术位。');
 if(draft.level>=7)notes.push('元素之怒：在下方选择强力施法或原力蛮击；每回合一次的额外伤害由战斗轮结算。');
 if(draft.level>=15)notes.push('元素狂怒：强力施法戏法射程 +300 尺（射程 10 尺及以上），或原力蛮击提升为 2d8。');
 if(draft.level>=18)notes.push('兽形施法：荒野变形下可以施法，但仍有价值或会被消耗的材料成分不能使用；请在施法时人工核对。');
 if(draft.level>=20){notes.push('不凋化形：掷先攻时若没有荒野变身次数，可立即获得一次（战斗轮内处理）。');notes.push('青春永驻：每 10 年衰老 1 岁，无需记录。');}
 return notes;
}
export const setDruidEpicBoon=setEpicBoon;
export type { DruidPaladinConfig };
