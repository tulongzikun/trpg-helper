import type { CharacterDraft } from './characters';
import { changeSpellSlot, spellSlotResources } from './spellSlotResources.ts';
/** Records spending a slot to cast a Divination spell and recovering one lower slot. */
export function useExpertDivination(draft:CharacterDraft,castLevel:number,recoverLevel:number):CharacterDraft{
 const c=draft.details?.fighterCalculator;
 if(c?.characterClass!=='法师'||c.subclass!=='diviner'||draft.level<6||!Number.isInteger(castLevel)||!Number.isInteger(recoverLevel)||castLevel<2||recoverLevel<1||recoverLevel>=castLevel||recoverLevel>5)return draft;
 const slots=spellSlotResources(draft),cast=slots.find(x=>x.id===`法师:slot:${castLevel}`),recover=slots.find(x=>x.id===`法师:slot:${recoverLevel}`);
 if(!cast?.remaining||!recover?.spent)return draft;
 return changeSpellSlot(changeSpellSlot(draft,cast.id,1),recover.id,-1);
}
