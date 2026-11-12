import type { CharacterDraft } from './characters';
import { spellSlots } from './spellSlots.ts';
type SlotResource={id:string;label:string;maximum:number;spent:number;remaining:number;shortRest:boolean;temporary?:number};
export function spellSlotResources(draft:CharacterDraft):SlotResource[]{
 const c=draft.details?.fighterCalculator,slots=spellSlots(draft);if(!c||!slots)return [];
 const cls=c.characterClass??'战士';
 const defs=slots.kind==='standard'?slots.slots.map((maximum,i)=>{const value=cls==='术士'?c.sorcererCreatedSlots?.[String(i+1)]:0;const temporary=typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:0;return {id:`${cls}:slot:${i+1}`,label:`${i+1} 环法术位`,maximum:maximum+temporary,temporary,shortRest:false}}):[{id:'邪术师:pact',label:`${slots.slotLevel} 环契约法术位`,maximum:slots.count,shortRest:true},...slots.arcanumLevels.map(level=>({id:`邪术师:arcanum:${level}`,label:`${level} 环秘法${typeof c.classSpellChoices?.['邪术师']?.arcanum?.[String(level)]==='string'?'：'+c.classSpellChoices['邪术师']!.arcanum![String(level)]:''}`,maximum:1,shortRest:false}))];
 return defs.map(item=>{const v=c.spellSlotSpent?.[item.id];const spent=typeof v==='number'&&Number.isInteger(v)&&v>=0?v:0;return {...item,spent,remaining:Math.max(0,item.maximum-spent)}});
}
export function changeSpellSlot(draft:CharacterDraft,id:string,delta:1|-1):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator,slot=spellSlotResources(draft).find(x=>x.id===id);if(!details||!c||!slot)return draft;
 const spent=Math.max(0,Math.min(slot.maximum,slot.spent+delta));
 return {...draft,details:{...details,fighterCalculator:{...c,spellSlotSpent:{...c.spellSlotSpent,[id]:spent}}}};
}
export function restoreSpellSlots(draft:CharacterDraft,rest:'short'|'long'):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c)return draft;const spent={...c.spellSlotSpent};
 for(const resource of spellSlotResources(draft))if(rest==='long'||resource.shortRest)spent[resource.id]=0;
 return {...draft,details:{...details,fighterCalculator:{...c,spellSlotSpent:spent,...(rest==='long'?{sorcererCreatedSlots:{}}:{})}}};
}
