import type { CharacterDraft, Ability } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { skillState } from './skillEffects.ts';
import { wildHeart } from './wildHeart.ts';
import { divinerSight } from './diviner.ts';
import { invocationState } from './explorationInvocations.ts';
const spellAbilities:Record<string,Ability>={'吟游诗人':'cha','牧师':'wis','德鲁伊':'wis','圣武士':'cha','游侠':'wis','术士':'cha','邪术师':'cha','法师':'int'};
export function derivedCharacter(d:CharacterDraft){
 const config=d.details?.fighterCalculator;if(!config)return null;
 const cls=config.characterClass??'战士';const species=config.species;const pb=proficiencyBonus(d.level);const s=skillState(d);
 let darkvision=0;if(['龙裔','侏儒','提夫林','阿斯莫','精灵'].includes(species))darkvision=60;
 if(['矮人','兽人'].includes(species)||(species==='精灵'&&config.elfLineage==='卓尔'))darkvision=120;
 if(d.level>=3&&((cls==='游侠'&&config.subclass==='gloom-stalker')||(cls==='武僧'&&config.subclass==='shadow')))darkvision=darkvision?darkvision+60:60;
 const wild=wildHeart(d);if(wild?.aspect==='枭')darkvision=darkvision?darkvision+60:60;if(divinerSight(d)==='黑暗视觉')darkvision=Math.max(darkvision,120);
 const ability=spellAbilities[cls]??((d.level>=3&&((cls==='战士'&&config.subclass==='eldritch-knight')||(cls==='游荡者'&&config.subclass==='arcane-trickster')))?'int':undefined);
 const spell=ability?{ability,attack:pb+abilityModifier(d.abilities[ability]),dc:8+pb+abilityModifier(d.abilities[ability])}:null;
 const ranger=cls==='游侠'&&d.level>=6&&!['ring','chain','splint','plate'].includes(config.armor);
 const invocation=invocationState(d);const thief=cls==='游荡者'&&config.subclass==='thief'&&d.level>=3;
 return {darkvision,blindsight:cls==='游侠'&&d.level>=18?30:0,devilsSight:invocation.active.includes('devils-sight')?120:0,truesight:invocation.active.includes('witch-sight')?30:0,spell,passivePerception:10+s.modifier('察觉'),passiveInsight:10+s.modifier('洞悉'),climb:(ranger||thief||wild?.aspect==='豹')?d.speedFt:null,swim:(ranger||wild?.aspect==='鲑'||invocation.active.includes('gift-depths'))?d.speedFt:null};
}
