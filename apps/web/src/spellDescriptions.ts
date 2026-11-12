export type SpellDescription={name:string;level:number;description:string;higherLevelSlot?:string;range?:string;duration?:string;actionType?:string};
const normalize=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
export function findSpellDescription(items:SpellDescription[],name:string,level:number){const english=name.match(/[A-Za-z].*$/)?.[0];if(!english)return undefined;const key=normalize(english);return items.find(spell=>spell.level===level&&normalize(spell.name)===key);}
