import type { Ability } from './characters';
export const skills:Record<string,Ability>={'运动':'str','体操':'dex','巧手':'dex','隐匿':'dex','奥秘':'int','历史':'int','调查':'int','自然':'int','宗教':'int','驯兽':'wis','察觉':'wis','洞悉':'wis','医药':'wis','求生':'wis','欺瞒':'cha','威吓':'cha','表演':'cha','游说':'cha'};
export const abilityModifier=(value:number)=>Math.floor((value-10)/2);
export const proficiencyBonus=(level:number)=>2+Math.floor((level-1)/4);
