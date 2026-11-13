import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources, changeClassResource } from './classResources.ts';
import { dpConfig, patchConfig, isPaladin, setEpicBoon, type WeaponMasteryChoice } from './druidPaladinShared.ts';
// 圣武士职业基础特性中角色卡可自动化的部分：武器精通、战斗风格、圣疗附加效果、灵光、引导神力提示。
export const paladinMasteryProperties=['顺劈','擦伤','迅击','推撞','削弱','缓速','倾覆','反制'];
export const paladinFightingStyles=['防御','对决','巨武器战斗','受祝福的勇士'];
export const recoveryTouchConditions=['目盲','魅惑','耳聋','恐慌','麻痹','震慑'];
export function paladinMasteries(draft:CharacterDraft):WeaponMasteryChoice[]{
 const raw=dpConfig(draft)?.weaponMasteries;return Array.isArray(raw)?raw.filter(x=>x&&typeof x.weapon==='string'&&typeof x.property==='string'):[];
}
export function weaponMasteryState(draft:CharacterDraft){
 if(!isPaladin(draft))return null;
 const choices=paladinMasteries(draft);const weapons=choices.map(x=>x.weapon.trim()).filter(Boolean);
 return {choices,invalid:choices.length>2||weapons.some(x=>!x)||new Set(weapons).size!==weapons.length||choices.some(x=>x.property&&!paladinMasteryProperties.includes(x.property)),slots:2};
}
export function setWeaponMastery(draft:CharacterDraft,index:number,weapon:string,property:string):CharacterDraft{
 if(!isPaladin(draft)||!Number.isInteger(index)||index<0||index>1)return draft;
 const list=[...paladinMasteries(draft)];
 while(list.length<2)list.push({weapon:'',property:''});
 list[index]={weapon:weapon.trim(),property:paladinMasteryProperties.includes(property)?property:''};
 return patchConfig(draft,{weaponMasteries:list.filter(x=>x.weapon||x.property)});
}
export function fightingStyle(draft:CharacterDraft):string{
 const value=dpConfig(draft)?.fightingStyle;if(!isPaladin(draft)||draft.level<2||typeof value!=='string'||!paladinFightingStyles.includes(value))return '';
 return value;
}
export function setFightingStyle(draft:CharacterDraft,style:string):CharacterDraft{
 if(!isPaladin(draft)||draft.level<2||(style&&!paladinFightingStyles.includes(style)))return draft;
 return patchConfig(draft,{fightingStyle:style});
}
export function freeSmiteRemaining(draft:CharacterDraft):number{
 return classResources(draft).find(x=>x.id==='paladin-free-smite')?.remaining??0;
}
export function recoveryTouchCost(conditions:string[]):number{
 return conditions.filter(x=>recoveryTouchConditions.includes(x)).length*5;
}
export function useRecoveryTouch(draft:CharacterDraft,conditions:string[]):CharacterDraft{
 const pool=classResources(draft).find(x=>x.id==='paladin-hands');const cost=recoveryTouchCost(conditions);
 if(!isPaladin(draft)||draft.level<14||!pool||!conditions.length||new Set(conditions).size!==conditions.length||!cost||pool.remaining<cost)return draft;
 return changeClassResource(draft,'paladin-hands',cost);
}
export function paladinAura(draft:CharacterDraft){
 if(!isPaladin(draft)||draft.level<6)return null;
 const bonus=Math.max(1,abilityModifier(draft.abilities.cha));const radius=draft.level>=18?30:10;
 return {bonus,radius,frightenedImmune:draft.level>=10,note:`${radius} 尺灵光：自己与盟友豁免加 ${bonus}（失能时失效，同类光环不叠加）。${draft.level>=10?'光环内自己与盟友免疫恐慌。':''}`};
}
export function attacksPerAttackAction(draft:CharacterDraft):number{
 return isPaladin(draft)&&draft.level>=5?2:1;
}
export function channelDivinityOptions(draft:CharacterDraft):string[]{
 if(!isPaladin(draft)||draft.level<3)return [];
 const options=['神圣感知：附赠动作，10 分钟内感知 60 尺内的天族、邪魔、亡灵，以及圣居或亵渎地点。'];
 if(draft.level>=9)options.push(`弃绝众敌：魔法动作消耗一次引导神力，60 尺内至多 ${Math.max(1,abilityModifier(draft.abilities.cha))} 个可见生物进行感知豁免，失败恐慌 1 分钟（回合结束可重豁免）。`);
 return options;
}
export function paladinClassNotes(draft:CharacterDraft):string[]{
 if(!isPaladin(draft))return [];const notes:string[]=[];
 notes.push('施法：魅力为施法属性，准备法术与环阶由「职业戏法与准备法术」界面校验；圣徽法器需自行记录。');
 notes.push('圣武斩：至圣斩始终准备，并可使用 1 次不消耗法术位的免费施放（见职业资源）。');
 if(draft.level>=5)notes.push('信实坐骑：寻获坐骑始终准备，每天可免费施放一次（见职业资源）。');
 if(draft.level>=11)notes.push('光耀打击：近战武器或徒手打击命中时额外造成 1d8 光耀伤害（战斗结算）。');
 if(draft.level>=14)notes.push(`复原之触：圣疗可额外终止目盲、魅惑、耳聋、恐慌、麻痹、震慑，每项 5 点；下方可一次扣除对应点数。`);
 return notes;
}
export const setPaladinEpicBoon=setEpicBoon;
