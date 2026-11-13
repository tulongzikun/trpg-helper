import type { CharacterDraft } from './characters';
export type KnownWildShape={id:string;name:string;challenge:number;flies:boolean};
export function wildShapeState(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(c?.characterClass!=='德鲁伊'||draft.level<2)return null;
 const limit=draft.level>=8?8:draft.level>=4?6:4,normalMax=draft.level>=8?1:draft.level>=4?0.5:0.25;
 const maxChallenge=c.subclass==='moon'&&draft.level>=3?Math.max(normalMax,Math.floor(draft.level/3)):normalMax,allowFlight=draft.level>=8;
 const raw=c.knownWildShapes,known=Array.isArray(raw)?raw:[];
 const invalid=(raw!==undefined&&!Array.isArray(raw))||known.length>limit||new Set(known.map(x=>x?.id)).size!==known.length||known.some(x=>!x||typeof x.id!=='string'||!x.id.trim()||typeof x.name!=='string'||!x.name.trim()||typeof x.challenge!=='number'||!Number.isFinite(x.challenge)||x.challenge<0||x.challenge>maxChallenge||typeof x.flies!=='boolean'||(x.flies&&!allowFlight));
 return {limit,maxChallenge,allowFlight,known,invalid};
}
