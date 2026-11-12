import type { Ability, CharacterDraft } from './characters';
const keys:Ability[]=['str','dex','con','int','wis','cha'];
export function advancementLevels(cls:string,level:number):number[]{const all=[4,8,12,16];if(cls==='战士')all.push(6,14);if(cls==='游荡者')all.push(10);return all.filter(n=>n<=level).sort((a,b)=>a-b);}
export function advancementState(d:CharacterDraft){
 const details=d.details;const config=details?.fighterCalculator;const slots=config?.advancements;
 if(!config)return {abilities:d.abilities,error:null as string|null,active:[] as number[]};
 const active=advancementLevels(config.characterClass??'战士',d.level);
 if(slots&&(typeof slots!=='object'||Array.isArray(slots)))return {abilities:d.abilities,error:'属性提升选项无效。',active};
 if(!details?.baseAbilities||!details.abilityBonuses||details.abilityMethod==='manual')return {abilities:d.abilities,error:slots?'属性提升需要先选择购点或掷骰。':null,active};
 const result={...details.baseAbilities};for(const key of keys)result[key]+=details.abilityBonuses[key];
 let error:string|null=null;
 for(const level of active){const slot=slots?.[String(level)];if(slot===undefined)continue;
  if(!Array.isArray(slot)||slot.length!==2||slot.some(x=>x!==''&&!keys.includes(x))){error='属性提升选项无效。';continue;}
  const chosen=slot.filter((x):x is Ability=>x!=='');if(chosen.length===1)error='每次属性提升须选择两点，或清空该项。';
  for(const key of chosen)result[key]++;
  if(keys.some(k=>result[k]>20))error=`${level} 级属性提升后的属性不能超过 20。`;
 }
 if(d.level>=20){const cls=config.characterClass??'战士';const bonus=cls==='野蛮人'?['str','con']:cls==='武僧'?['dex','wis']:[];for(const key of bonus as Ability[])result[key]=Math.min(25,result[key]+4);}
 return {abilities:result,error,active};
}
export function abilityMaximum(d:CharacterDraft,key:Ability):number {const cls=d.details?.fighterCalculator?.characterClass;if(d.level>=20&&((cls==='野蛮人'&&(key==='str'||key==='con'))||(cls==='武僧'&&(key==='dex'||key==='wis'))))return 25;return 20;}
