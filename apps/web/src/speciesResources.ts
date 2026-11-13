import type { CharacterDraft } from './characters';
import { proficiencyBonus } from './characterRules.ts';
import { giantAncestry } from './speciesExploration.ts';
import { dragonbornBreath } from './dragonbornBreath.ts';
import { innateMagic } from './innateMagic.ts';
import { magicSources } from './magicInitiate.ts';
import { getBackground } from './backgrounds.ts';

export type SpeciesResource={id:string;name:string;maximum:number;spent:number;remaining:number};
export function speciesResources(draft:CharacterDraft):SpeciesResource[]{
 const c=draft.details?.fighterCalculator;if(!c)return [];
 const pb=proficiencyBonus(draft.level);const definitions:{id:string;name:string;maximum:number}[]=[];
 if(c.species==='阿斯莫'){
  definitions.push({id:'aasimar-healing-hands',name:`治疗之手（${pb}d4）`,maximum:1});
  if(draft.level>=3)definitions.push({id:'aasimar-celestial-revelation',name:'天界启示',maximum:1});
 }
 if(c.species==='矮人')definitions.push({id:'dwarf-stonecunning',name:'石中精明',maximum:pb});
 if(c.species==='兽人'){definitions.push({id:'orc-adrenaline-rush',name:`肾上腺素激增（${pb} 临时生命值）`,maximum:pb});definitions.push({id:'orc-relentless-endurance',name:'不懈耐力',maximum:1});}
 if(c.species==='龙裔'){const breath=dragonbornBreath(draft);definitions.push({id:'dragonborn-breath',name:`吐息武器（${breath?.dice??'1d10'}${breath?.damageType?` ${breath.damageType}`:''}）`,maximum:breath?.uses??pb});}
 if(c.species==='歌利亚'){
  if(c.giantAncestry&&Object.hasOwn(giantAncestry,c.giantAncestry))definitions.push({id:'goliath-ancestry',name:`巨人血脉（${c.giantAncestry}）`,maximum:pb});
  if(draft.level>=5)definitions.push({id:'goliath-large',name:'巨人形态',maximum:1});
 }
 if(c.species==='龙裔'&&draft.level>=5)definitions.push({id:'dragon-flight',name:'龙族飞行',maximum:1});
 const lineage=c.species==='精灵'?c.elfLineage:c.species==='提夫林'?c.tieflingLegacy:c.species==='侏儒'?c.gnomeLineage:undefined;
 if(lineage){for(const spell of innateMagic(draft)?.spells??[]){if(spell.level>0)definitions.push({id:`innate:${c.species}:${lineage}:${spell.level}`,name:`血统法术：${spell.name}`,maximum:c.species==='侏儒'?pb:1});}}
 for(const {source,list,choice} of magicSources(draft)){if(choice?.list===list&&typeof choice.spell==='string'&&choice.spell.trim())definitions.push({id:`magic-initiate:${source}:${list}`,name:`魔法学徒（${source==='background'?'背景':'人类'}）：${choice.spell}`,maximum:1});}
 if(getBackground(draft.details?.background)?.feat==='幸运'||(c.species==='人类'&&c.humanOriginFeat==='幸运'))definitions.push({id:'origin-lucky',name:'幸运点',maximum:pb});
 return definitions.map(item=>{const value=c.speciesResourceSpent?.[item.id];const spent=typeof value==='number'&&Number.isInteger(value)&&value>=0?value:0;return {...item,spent,remaining:Math.max(0,item.maximum-spent)}});
}
export function changeSpeciesResource(draft:CharacterDraft,id:string,delta:1|-1):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;const resource=speciesResources(draft).find(x=>x.id===id);if(!details||!c||!resource)return draft;
 const spent=Math.max(0,Math.min(resource.maximum,resource.spent+delta));
 return {...draft,details:{...details,fighterCalculator:{...c,speciesResourceSpent:{...c.speciesResourceSpent,[id]:spent}}}};
}
export function restoreSpeciesResources(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c)return draft;const spent={...c.speciesResourceSpent};
 for(const resource of speciesResources(draft))spent[resource.id]=0;
 return {...draft,details:{...details,fighterCalculator:{...c,speciesResourceSpent:spent,stonecunningActive:false,dragonFlightActive:false,giantFormActive:false,celestialForm:''}}};
}
export function restoreShortSpeciesResources(draft:CharacterDraft):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;
 if(!details||!c||c.species!=='兽人')return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,speciesResourceSpent:{...c.speciesResourceSpent,'orc-adrenaline-rush':0}}}};
}
