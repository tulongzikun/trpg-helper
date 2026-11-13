import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources, changeClassResource } from './classResources.ts';
import { spellSlotResources, changeSpellSlot } from './spellSlotResources.ts';
import { dpConfig, isPaladin, patchConfig } from './druidPaladinShared.ts';
// 圣武士四个子职的常驻灵光、引导神力选项与 20 级终极特性记录。
export const paladinOathNames:Record<string,string>={devotion:'奉献之誓',glory:'荣耀之誓',ancients:'远古之誓',vengeance:'复仇之誓'};
export const paladinOathCapstoneNames:Record<string,string>={devotion:'至圣光轮',glory:'现世传说',ancients:'上古斗士',vengeance:'复仇天使'};
export function paladinOath(draft:CharacterDraft):string|undefined{
 if(!isPaladin(draft)||draft.level<3)return undefined;
 const key=dpConfig(draft)?.subclass;return key&&Object.hasOwn(paladinOathNames,key)?key:undefined;
}
export function oathAuraState(draft:CharacterDraft){
 const oath=paladinOath(draft);if(!oath||draft.level<7)return null;
 const radius=draft.level>=18?30:10;
 if(oath==='devotion')return {title:'奉献灵光',radius,benefits:[`守护灵光内自己与盟友免疫魅惑。`]};
 if(oath==='glory')return {title:'迅捷灵光',radius,benefits:['自己速度 +10 尺。','盟友在自己的回合首次进入灵光或在灵光内开始回合时，速度 +10 尺直至其下回合结束。']};
 if(oath==='ancients')return {title:'守御灵光',radius,benefits:['守护灵光内自己与盟友获得暗蚀、心灵、光耀伤害抗性。']};
 return null;
}
export function oathChannelOptions(draft:CharacterDraft):string[]{
 const oath=paladinOath(draft);if(!oath)return [];
 if(oath==='devotion')return ['圣洁武器：攻击动作时消耗 1 次引导神力，10 分钟内一把近战武器攻击加魅力调整值（最低 +1），命中时可造成光耀伤害，并发出 20 尺明亮光与额外 20 尺微光。'];
 if(oath==='glory')return ['鼓舞斩：施展至圣斩后可立即消耗 1 次引导神力，30 尺内自己与所选生物共获 2d8+圣武士等级的临时生命值，可任意分配。','绝伦健将：附赠动作消耗 1 次引导神力，1 小时内力量（运动）与敏捷（特技）检定具有优势，跳远与跳高距离 +10 尺。'];
 if(oath==='ancients')return ['自然之怒：魔法动作消耗 1 次引导神力，15 尺内任意数量可见生物进行力量豁免，失败被束缚 1 分钟（其回合结束可重豁免）。'];
 return ['仇敌誓言：攻击动作时消耗 1 次引导神力，30 尺内可见生物立誓 1 分钟，你对其攻击具有优势；目标降至 0 时可无动作转移誓言。'];
}
export function oathFeatureNotes(draft:CharacterDraft):string[]{
 const oath=paladinOath(draft);if(!oath)return [];const notes:string[]=[];
 if(oath==='glory'&&draft.level>=15)notes.push(`辉煌防御：自己或 10 尺内可见生物被击中时，反应使其 AC 加 ${Math.max(1,abilityModifier(draft.abilities.cha))}（最低 +1），可能使攻击失手；次数见职业资源。`);
 if(oath==='ancients'&&draft.level>=15)notes.push(`不灭哨卫：生命降至 0（非直接死亡）时可改为降至 1 并恢复 ${draft.level*3} 点生命值，长休恢复；不会因魔法衰老。`);
 if(oath==='devotion'&&draft.level>=15)notes.push('卫护斩：施展至圣斩后至你下回合开始，灵光内自己与盟友获得半身掩护。');
 if(oath==='vengeance'&&draft.level>=15)notes.push('复仇之魂：受仇敌誓言影响的生物攻击后（无论命中），若在触及内可反应发动一次近战攻击。');
 if(oath==='vengeance'&&draft.level>=7)notes.push('无情复仇：借机攻击命中可令目标速度变为 0 直至当前回合结束，并立即移动至多一半速度且不引发借机攻击。');
 return notes;
}
export function capstoneState(draft:CharacterDraft){
 const oath=paladinOath(draft);if(!oath||draft.level<20)return null;
 const resource=classResources(draft).find(x=>x.id==='paladin-oath-capstone');
 return {name:paladinOathCapstoneNames[oath],remaining:resource?.remaining??0,active:!!dpConfig(draft)?.oathCapstoneActive,note:`附赠动作激活 ${paladinOathCapstoneNames[oath]}，持续 10 分钟；长休恢复一次，也可消耗一个 5 环法术位恢复使用次数。`};
}
export function activateCapstone(draft:CharacterDraft):CharacterDraft{
 const state=capstoneState(draft);if(!state||!state.remaining||state.active)return draft;
 return patchConfig(changeClassResource(draft,'paladin-oath-capstone',1),{oathCapstoneActive:true});
}
export function endCapstone(draft:CharacterDraft):CharacterDraft{
 if(!capstoneState(draft)?.active)return draft;return patchConfig(draft,{oathCapstoneActive:false});
}
export function restoreCapstoneWithSlot(draft:CharacterDraft):CharacterDraft{
 const state=capstoneState(draft);if(!state||state.remaining)return draft;
 const resource=classResources(draft).find(x=>x.id==='paladin-oath-capstone');if(!resource?.spent)return draft;
 const slot=spellSlotResources(draft).find(x=>x.id==='圣武士:slot:5');if(!slot?.remaining)return draft;
 return changeClassResource(changeSpellSlot(draft,'圣武士:slot:5',1),'paladin-oath-capstone',-1);
}
