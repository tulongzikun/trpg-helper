import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { classResources, changeClassResource } from './classResources.ts';
import { dpConfig, isDruid, patchConfig } from './druidPaladinShared.ts';
// 海洋结社：瀚海之怒光环、水生亲和、风暴降生、大洋慨赠。
function sea(draft:CharacterDraft){const c=dpConfig(draft);return isDruid(draft)&&c?.subclass==='sea'&&draft.level>=3?c:null;}
export function seaWrathState(draft:CharacterDraft){
 const c=sea(draft);if(!c)return null;
 const wis=Math.max(1,abilityModifier(draft.abilities.wis));
 return {
  active:!!c.seaWrathActive,
  radius:draft.level>=6?10:5,
  dice:wis,
  pushFt:15,
  damageType:'寒冷',
  flySpeed:draft.level>=10?draft.speedFt:0,
  resistances:draft.level>=10?['寒冷','闪电','雷鸣']:[],
  allyTarget:draft.level>=14,
  note:`瀚海之怒：${draft.level>=6?10:5} 尺光环，显现时及之后每回合附赠动作可选一名可见生物，体质豁免失败受 ${wis}d6 寒冷伤害并被推离至多 15 尺（大型或更小）。`,
 };
}
export function startSeaWrath(draft:CharacterDraft):CharacterDraft{
 const state=seaWrathState(draft);if(!state||state.active)return draft;
 if(!classResources(draft).find(x=>x.id==='druid-wildshape')?.remaining)return draft;
 return patchConfig(changeClassResource(draft,'druid-wildshape',1),{seaWrathActive:true});
}
export function endSeaWrath(draft:CharacterDraft):CharacterDraft{
 if(!seaWrathState(draft)?.active)return draft;return patchConfig(draft,{seaWrathActive:false});
}
export function swimSpeed(draft:CharacterDraft):number{
 return sea(draft)&&draft.level>=6?draft.speedFt:0;
}
export function seaCircleNotes(draft:CharacterDraft):string[]{
 const s=seaWrathState(draft);if(!s)return [];const notes=[s.note];
 if(draft.level>=6)notes.push(`水生亲和：光环范围提升至 10 尺；获得 ${draft.speedFt} 尺游泳速度。`);
 if(draft.level>=10)notes.push(`风暴降生：光环激活时获得 ${draft.speedFt} 尺飞行速度，以及寒冷、闪电、雷鸣伤害抗性。`);
 if(draft.level>=14)notes.push('大洋慨赠：光环可显现于 60 尺内一名自愿生物身上（使用你的豁免 DC 与感知调整值）；消耗两次荒野变身可同时维持两个光环。');
 return notes;
}
