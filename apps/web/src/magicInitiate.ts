import type { Ability, CharacterDraft } from './characters';
import { getBackground } from './backgrounds.ts';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
export type MagicList='牧师'|'德鲁伊'|'法师';
export type MagicInitiateChoice={list:MagicList;ability:Extract<Ability,'int'|'wis'|'cha'>|'';cantrips:[string,string];spell:string};
const sources=['background','human'] as const;
export type MagicSource=typeof sources[number];
export function magicSources(d:CharacterDraft):{source:MagicSource;list:MagicList;choice:MagicInitiateChoice|undefined}[]{
 const details=d.details,c=details?.fighterCalculator;if(!c)return [];
 return sources.flatMap(source=>{const feat=source==='background'?getBackground(details.background)?.feat:c.species==='人类'?c.humanOriginFeat:undefined;const match=feat?.match(/^魔法学徒（(牧师|德鲁伊|法师)）$/);if(!match)return [];return [{source,list:match[1] as MagicList,choice:c.magicInitiate?.[source]}]});
}
export function magicInitiateError(d:CharacterDraft):string|null {
 for(const source of magicSources(d)){const x=source.choice;if(!x)continue;
  if(x.list!==source.list||!['int','wis','cha'].includes(x.ability)||!Array.isArray(x.cantrips)||x.cantrips.length!==2||x.cantrips.some(v=>typeof v!=='string'||!v.trim())||x.cantrips[0]===x.cantrips[1]||typeof x.spell!=='string'||!x.spell.trim())return '请完成魔法学徒的施法属性、两项不同戏法和一项一环法术选择。';
 }
 return null;
}
export function magicNumbers(d:CharacterDraft,ability:Ability){const mod=abilityModifier(d.abilities[ability]),pb=proficiencyBonus(d.level);return{attack:mod+pb,dc:8+mod+pb};}
