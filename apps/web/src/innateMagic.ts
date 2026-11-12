import type { Ability, CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
const elfSpells:Record<string,{cantrip:string;third:string;fifth:string}>={
 '卓尔':{cantrip:'舞光术',third:'妖火',fifth:'黑暗术'},'高等精灵':{cantrip:'魔法伎俩',third:'侦测魔法',fifth:'迷踪步'},'木精灵':{cantrip:'德鲁伊伎俩',third:'大步奔行',fifth:'行踪无迹'},
};
const fiend:Record<string,{cantrip:string;third:string;fifth:string;resistance:string}>={
 '深渊':{cantrip:'毒液喷溅',third:'致病射线',fifth:'人类定身术',resistance:'毒素'},'冥府':{cantrip:'冻寒之触',third:'虚假生命',fifth:'衰弱射线',resistance:'黯蚀'},'炼狱':{cantrip:'火焰箭',third:'地狱斥喝',fifth:'黑暗术',resistance:'火焰'},
};
export function innateMagic(d:CharacterDraft){
 const c=d.details?.fighterCalculator;if(!c)return null;
 const spells:{name:string;level:number;usage:string}[]=[];let resistance:string|undefined;
 const cantrip=(name:string)=>spells.push({name,level:0,usage:'随意施放'});
 const free=(name:string,level:number)=>spells.push({name,level,usage:'长休后免费一次，也可消耗法术位'});
 if(c.species==='阿斯莫'){resistance='黯蚀、光耀';cantrip('光亮术');}
 else if(c.species==='精灵'&&Object.hasOwn(elfSpells,c.elfLineage)){const elf=elfSpells[c.elfLineage];cantrip(c.elfLineage==='高等精灵'&&typeof c.highElfCantrip==='string'&&c.highElfCantrip.trim()?c.highElfCantrip:elf.cantrip);if(d.level>=3)free(elf.third,1);if(d.level>=5)free(elf.fifth,2);}
 else if(c.species==='提夫林'&&c.tieflingLegacy&&Object.hasOwn(fiend,c.tieflingLegacy)){const f=fiend[c.tieflingLegacy];resistance=f.resistance;cantrip('奇术');cantrip(f.cantrip);if(d.level>=3)free(f.third,1);if(d.level>=5)free(f.fifth,2);}
 else if(c.species==='侏儒'&&c.gnomeLineage==='森林侏儒'){cantrip('次级幻影');spells.push({name:'动物交谈',level:1,usage:`长休后免费 ${proficiencyBonus(d.level)} 次，也可消耗法术位`});}
 else if(c.species==='侏儒'&&c.gnomeLineage==='岩石侏儒'){cantrip('修复术');cantrip('魔法伎俩');}
 else return null;
 const ability=c.species==='阿斯莫'?'cha':c.lineageAbility;const chosen:Ability|undefined=ability&&(['int','wis','cha'] as string[]).includes(ability)?ability:undefined;
 return {spells,resistance,ability:chosen,attack:chosen?abilityModifier(d.abilities[chosen])+proficiencyBonus(d.level):null,dc:chosen?8+abilityModifier(d.abilities[chosen])+proficiencyBonus(d.level):null,highElf:c.species==='精灵'&&c.elfLineage==='高等精灵'};
}
