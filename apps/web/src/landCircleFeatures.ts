import type { CharacterDraft } from './characters';
import { classResources, changeClassResource } from './classResources.ts';
import { spellSlotResources } from './spellSlotResources.ts';
import { dpConfig, isDruid, patchConfig } from './druidPaladinShared.ts';
// 大地结社：3 级大地之援、6 级自然恢复、10 级自然守御、14 级自然庇护。
export const landResistanceTypes:Record<string,string>={'荒漠':'火焰','极地':'寒冷','温带':'闪电','热带':'毒素'};
function land(draft:CharacterDraft){const c=dpConfig(draft);return isDruid(draft)&&c?.subclass==='land'?c:null;}
export function landAidDice(draft:CharacterDraft):number|null{
 if(!land(draft)||draft.level<3)return null;return 2+(draft.level>=10?1:0)+(draft.level>=14?1:0);
}
export function landAidNote(draft:CharacterDraft):string{
 const dice=landAidDice(draft);return `大地之援：魔法动作消耗 1 次荒野变身，60 尺内一点为中心 10 尺球域；所选生物体质豁免失败受 ${dice}d6 暗蚀伤害（成功半伤），另一名所选生物恢复 ${dice}d6 生命值。`;
}
export function landSanctuaryNote(draft:CharacterDraft):string{
 return `自然庇护：魔法动作消耗 1 次荒野变身，120 尺内 15 尺立方灵体丛林持续 1 分钟；区域内自己与盟友获得半身掩护${draft.level>=10?'，盟友还获得地形对应的伤害抗性':''}，附赠动作可移动最多 60 尺。`;
}
export function landRecoveryState(draft:CharacterDraft){
 if(!land(draft)||draft.level<6)return null;
 const resources=classResources(draft);
 const freeCast=resources.find(x=>x.id==='druid-land-free-cast'),slotRecovery=resources.find(x=>x.id==='druid-land-slot-recovery');
 return {freeCastRemaining:freeCast?.remaining??0,slotRecoveryRemaining:slotRecovery?.remaining??0,maxSlotLevels:Math.ceil(draft.level/2)};
}
export function useLandFreeCast(draft:CharacterDraft):CharacterDraft{
 const state=landRecoveryState(draft);if(!state?.freeCastRemaining)return draft;
 return changeClassResource(draft,'druid-land-free-cast',1);
}
export function recoverLandSlots(draft:CharacterDraft,counts:Record<string,number>):CharacterDraft{
 const state=landRecoveryState(draft);if(!state?.slotRecoveryRemaining)return draft;
 const slots=spellSlotResources(draft).filter(x=>/^德鲁伊:slot:[1-5]$/.test(x.id));let total=0,number=0;
 for(const [id,n] of Object.entries(counts)){
  const slot=slots.find(x=>x.id===id);if(!slot||!Number.isInteger(n)||n<0||n>slot.spent)return draft;
  total+=Number(id.split(':').at(-1))*n;number+=n;
 }
 if(!number||total>state.maxSlotLevels)return draft;
 const next=changeClassResource(draft,'druid-land-slot-recovery',1);const details=next.details!,config=details.fighterCalculator!,spent={...config.spellSlotSpent};
 for(const [id,n] of Object.entries(counts))spent[id]=Math.max(0,(spent[id]??0)-n);
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:spent}}};
}
export function setLandType(draft:CharacterDraft,type:string):CharacterDraft{
 if(!land(draft)||!['荒漠','极地','温带','热带'].includes(type))return draft;
 return patchConfig(draft,{landType:type as '荒漠'|'极地'|'温带'|'热带'});
}
