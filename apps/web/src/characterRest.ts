import type { CharacterDraft } from './characters';
import { restoreClassResources } from './classResources.ts';
import { restoreSpellSlots } from './spellSlotResources.ts';
import { restoreSpeciesResources, restoreShortSpeciesResources } from './speciesResources.ts';

export function completeRest(draft:CharacterDraft,rest:'short'|'long'):CharacterDraft{
 if(!draft.details?.fighterCalculator)return draft;
 let next=restoreSpellSlots(restoreClassResources(draft,rest),rest);
 if(rest==='short')next=restoreShortSpeciesResources(next);
 if(rest==='long'){next=restoreSpeciesResources(next);const details=next.details,c=details?.fighterCalculator;if(details&&c?.species==='人类')next={...next,details:{...details,fighterCalculator:{...c,heroicInspiration:true}}};const restDetails2=next.details,rc2=restDetails2?.fighterCalculator;if(restDetails2&&rc2&&(rc2.innateSorceryUses||rc2.fleshRevelation||rc2.portent||rc2.wildSurgeEffect))next={...next,details:{...restDetails2,fighterCalculator:{...rc2,innateSorceryActive:false,innateSorceryUses:0,fleshRevelation:undefined,wildSurgeEffect:'',portent:undefined}}};const restDetails=next.details,rc=restDetails?.fighterCalculator;if(restDetails&&rc&&(rc.wildShapeActive||rc.wildCompanionActive||rc.seaWrathActive||rc.natureMagicianUsed||rc.oathCapstoneActive))next={...next,details:{...restDetails,fighterCalculator:{...rc,wildShapeActive:undefined,wildCompanionActive:false,seaWrathActive:false,natureMagicianUsed:false,oathCapstoneActive:false}}};}
 const dragonDetails=next.details,dragonConfig=dragonDetails?.fighterCalculator;if(dragonDetails&&dragonConfig?.dragonFlightActive)next={...next,details:{...dragonDetails,fighterCalculator:{...dragonConfig,dragonFlightActive:false}}};
 const giantDetails=next.details,giantConfig=giantDetails?.fighterCalculator;if(giantDetails&&giantConfig?.giantFormActive)next={...next,details:{...giantDetails,fighterCalculator:{...giantConfig,giantFormActive:false}}};
 const pre=next.details,pc=pre?.fighterCalculator;if(pre&&pc?.celestialForm)next={...next,details:{...pre,fighterCalculator:{...pc,celestialForm:''}}};
 const before=next.details,bc=before?.fighterCalculator;if(before&&bc?.stonecunningActive)next={...next,details:{...before,fighterCalculator:{...bc,stonecunningActive:false}}};
 const current=next.details,active=current?.fighterCalculator;if(current&&active?.characterClass==='德鲁伊'&&active.subclass==='stars'&&active.starryForm)next={...next,details:{...current,fighterCalculator:{...active,starryForm:''}}};
 const details=next.details,c=details?.fighterCalculator;
 if(details&&c&&c.characterClass==='法师'&&c.subclass==='diviner'&&next.level>=10&&c.divinerSight)
  next={...next,details:{...details,fighterCalculator:{...c,divinerSight:''}}};
 return next;
}
