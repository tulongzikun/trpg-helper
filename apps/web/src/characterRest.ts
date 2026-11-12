import type { CharacterDraft } from './characters';
import { restoreClassResources } from './classResources.ts';
import { restoreSpellSlots } from './spellSlotResources.ts';
import { restoreSpeciesResources } from './speciesResources.ts';

export function completeRest(draft:CharacterDraft,rest:'short'|'long'):CharacterDraft{
 if(!draft.details?.fighterCalculator)return draft;
 let next=restoreSpellSlots(restoreClassResources(draft,rest),rest);
 if(rest==='long'){next=restoreSpeciesResources(next);const details=next.details,c=details?.fighterCalculator;if(details&&c?.species==='人类')next={...next,details:{...details,fighterCalculator:{...c,heroicInspiration:true}}};}
 const before=next.details,bc=before?.fighterCalculator;if(before&&bc?.stonecunningActive)next={...next,details:{...before,fighterCalculator:{...bc,stonecunningActive:false}}};
 const current=next.details,active=current?.fighterCalculator;if(current&&active?.characterClass==='德鲁伊'&&active.subclass==='stars'&&active.starryForm)next={...next,details:{...current,fighterCalculator:{...active,starryForm:''}}};
 const details=next.details,c=details?.fighterCalculator;
 if(details&&c&&c.characterClass==='法师'&&c.subclass==='diviner'&&next.level>=10&&c.divinerSight)
  next={...next,details:{...details,fighterCalculator:{...c,divinerSight:''}}};
 return next;
}
