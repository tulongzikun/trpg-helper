import type { CharacterDraft } from './characters';
import { classResources, changeClassResource } from './classResources.ts';
import { spellSlotResources } from './spellSlotResources.ts';
export function recoverWizardSlots(draft:CharacterDraft,counts:Record<string,number>):CharacterDraft{
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='法师'||!classResources(draft).find(x=>x.id==='wizard-recovery')?.remaining)return draft;
 const slots=spellSlotResources(draft).filter(x=>/^法师:slot:[1-5]$/.test(x.id));let total=0,number=0;
 for(const [id,n] of Object.entries(counts)){const slot=slots.find(x=>x.id===id);if(!slot||!Number.isInteger(n)||n<0||n>Math.min(slot.spent,slot.maximum))return draft;total+=Number(id.split(':').at(-1))*n;number+=n;}
 if(!number||total>Math.ceil(draft.level/2))return draft;
 const next=changeClassResource(draft,'wizard-recovery',1);const details=next.details!,config=details.fighterCalculator!,spent={...config.spellSlotSpent};
 for(const [id,n] of Object.entries(counts))spent[id]=(spent[id]??0)-n;
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:spent}}};
}
export function recoverWarlockSlots(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator,slot=spellSlotResources(draft).find(x=>x.id==='邪术师:pact');
 if(c?.characterClass!=='邪术师'||!slot||!slot.spent||!classResources(draft).find(x=>x.id==='warlock-cunning')?.remaining)return draft;
 const restored=Math.min(slot.spent,draft.level>=20?slot.maximum:Math.ceil(slot.maximum/2));const next=changeClassResource(draft,'warlock-cunning',1),details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:{...config.spellSlotSpent,[slot.id]:Math.max(0,slot.spent-restored)}}}};
}
export function recoverSorceryPoints(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator,resources=classResources(draft),points=resources.find(x=>x.id==='sorcerer-points'),recovery=resources.find(x=>x.id==='sorcerer-restoration');
 if(c?.characterClass!=='术士'||!points?.spent||!recovery?.remaining)return draft;
 const restored=Math.min(points.spent,Math.floor(draft.level/2));
 return changeClassResource(changeClassResource(draft,'sorcerer-restoration',1),'sorcerer-points',-restored);
}
export function convertSlotToSorceryPoints(draft:CharacterDraft,level:number):CharacterDraft{
 const c=draft.details?.fighterCalculator,points=classResources(draft).find(x=>x.id==='sorcerer-points');
 const slot=spellSlotResources(draft).find(x=>x.id===`术士:slot:${level}`);
 if(c?.characterClass!=='术士'||!Number.isInteger(level)||!points||points.remaining>=points.maximum||!slot?.remaining)return draft;
 const details=draft.details!,spent={...c.spellSlotSpent,[slot.id]:slot.spent+1};
 const next={...draft,details:{...details,fighterCalculator:{...c,spellSlotSpent:spent}}};
 return changeClassResource(next,'sorcerer-points',-Math.min(level,points.spent));
}
const creationCost=[0,2,3,5,6,7];
export function createSorcererSlot(draft:CharacterDraft,level:number):CharacterDraft{
 const c=draft.details?.fighterCalculator,points=classResources(draft).find(x=>x.id==='sorcerer-points');
 if(c?.characterClass!=='术士'||!Number.isInteger(level)||level<1||level>5||draft.level<Math.max(2,level*2-1)||!points||points.remaining<creationCost[level])return draft;
 const raw=c.sorcererCreatedSlots?.[String(level)],current=typeof raw==='number'&&Number.isSafeInteger(raw)&&raw>=0?raw:0;
 if(!Number.isSafeInteger(current+1))return draft;
 const next=changeClassResource(draft,'sorcerer-points',creationCost[level]);const details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,sorcererCreatedSlots:{...config.sorcererCreatedSlots,[String(level)]:current+1}}}};
}
export function recoverBardInspiration(draft:CharacterDraft,slotLevel:number):CharacterDraft{
 const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='吟游诗人'||draft.level<5||!Number.isInteger(slotLevel)||slotLevel<1||slotLevel>9)return draft;
 const inspiration=classResources(draft).find(x=>x.id==='bard-inspiration');const slot=spellSlotResources(draft).find(x=>x.id===`吟游诗人:slot:${slotLevel}`);
 if(!inspiration?.spent||!slot?.remaining)return draft;
 const next=changeClassResource(draft,'bard-inspiration',-1),details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:{...config.spellSlotSpent,[slot.id]:slot.spent+1}}}};
}
export function wildShapeFromSpellSlot(draft:CharacterDraft,level:number):CharacterDraft{
 const c=draft.details?.fighterCalculator,wild=classResources(draft).find(x=>x.id==='druid-wildshape');const slot=spellSlotResources(draft).find(x=>x.id===`德鲁伊:slot:${level}`);
 if(c?.characterClass!=='德鲁伊'||draft.level<5||!Number.isInteger(level)||!wild||wild.remaining!==0||!wild.spent||!slot?.remaining)return draft;
 const next=changeClassResource(draft,'druid-wildshape',-1),details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:{...config.spellSlotSpent,[slot.id]:slot.spent+1}}}};
}
export function restoreFirstSlotFromWildShape(draft:CharacterDraft):CharacterDraft{
 const c=draft.details?.fighterCalculator,resources=classResources(draft),wild=resources.find(x=>x.id==='druid-wildshape'),resurgence=resources.find(x=>x.id==='druid-wild-resurgence');const slot=spellSlotResources(draft).find(x=>x.id==='德鲁伊:slot:1');
 if(c?.characterClass!=='德鲁伊'||draft.level<5||!wild?.remaining||!resurgence?.remaining||!slot?.spent)return draft;
 const next=changeClassResource(changeClassResource(draft,'druid-wildshape',1),'druid-wild-resurgence',1),details=next.details!,config=details.fighterCalculator!;
 return {...next,details:{...details,fighterCalculator:{...config,spellSlotSpent:{...config.spellSlotSpent,[slot.id]:Math.max(0,slot.spent-1)}}}};
}
