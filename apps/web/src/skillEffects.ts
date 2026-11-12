import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus, skills } from './characterRules.ts';
import { getBackground } from './backgrounds.ts';
import { classTraits } from './classTraits.ts';
import { tools2024 } from './tools2024.ts';
import { toolProficiencies } from './toolProficiencies.ts';
const knowledge=['奥秘','历史','调查','医药','自然','宗教'];
export function expertiseLimit(cls:string,level:number):number {
 if(cls==='游荡者')return level>=6?4:2;
 if(cls==='吟游诗人')return level>=9?4:level>=2?2:0;
 if(cls==='游侠')return level>=9?3:level>=2?1:0;
 if(cls==='法师')return level>=2?1:0;
 return 0;
}
export function skillState(draft:CharacterDraft){
 const details=draft.details;const c=details?.fighterCalculator;const cls=c?.characterClass??'战士';const pb=proficiencyBonus(draft.level);
 const background=c?getBackground(details?.background):undefined;
 const allowedSpeciesSkill=c?.species==='人类'?Object.keys(skills):c?.species==='精灵'?['察觉','洞悉','求生']:[];
 const speciesSkill=c?.speciesSkill&&allowedSpeciesSkill.includes(c.speciesSkill)?[c.speciesSkill]:[];
 const subclassActive=!!c&&draft.level>=3;
 const fixedSubclassSkills=subclassActive&&cls==='武僧'&&c?.subclass==='mercy'?['洞悉','医药']:[];
 const base=new Set([...(details?.skillProficiencies??[]),...(c?.classSkills??[]),...(background?.skills??[]),...speciesSkill,...fixedSubclassSkills]);
 const primalAvailable=!!c&&cls==='野蛮人'&&draft.level>=3;
 const primalSkill=primalAvailable?c?.primalSkill:undefined;
 const primalInvalid=!!primalSkill&&(typeof primalSkill!=='string'||!classTraits['野蛮人'].skills.includes(primalSkill)||base.has(primalSkill));
 if(primalSkill&&!primalInvalid)base.add(primalSkill);
 let subclassLimit=0;let subclassPool:string[]=[];
 if(subclassActive&&cls==='吟游诗人'&&c?.subclass==='lore'){subclassLimit=3;subclassPool=Object.keys(skills);}
 if(subclassActive&&cls==='战士'&&c?.subclass==='battle-master'){subclassLimit=1;subclassPool=classTraits['战士'].skills;}
 if(subclassActive&&cls==='游侠'&&c?.subclass==='fey-wanderer'){subclassLimit=1;subclassPool=['欺瞒','表演','游说'];}
 const subclassSelected=Array.isArray(c?.subclassSkills)?c.subclassSkills:[];
 const subclassInvalid=subclassLimit>0&&((c?.subclassSkills!==undefined&&!Array.isArray(c.subclassSkills))||subclassSelected.length>subclassLimit||new Set(subclassSelected).size!==subclassSelected.length||subclassSelected.some(x=>!subclassPool.includes(x)||base.has(x)));
 const activeSubclassSkills=subclassSelected.filter((x,i)=>subclassLimit>0&&i<subclassLimit&&subclassPool.includes(x)&&!base.has(x)&&subclassSelected.indexOf(x)===i);
 const featBase=new Set([...base,...activeSubclassSkills]);
 for(const tool of toolProficiencies(draft).granted)featBase.add(`工具:${tool}`);
 const skilledSources=(['background','human'] as const).filter(source=>source==='background'?background?.feat==='娴熟':c?.species==='人类'&&c?.humanOriginFeat==='娴熟');
 const featSelections:Partial<Record<'background'|'human',string[]>>={};const granted:string[]=[];let skilledInvalid=false;
 for(const source of skilledSources){const raw=c?.skilledChoices?.[source];const chosen=Array.isArray(raw)?raw:[];featSelections[source]=chosen;
  if((raw!==undefined&&!Array.isArray(raw))||(chosen.length>0&&chosen.length!==3)||new Set(chosen).size!==chosen.length||chosen.some(name=>!(typeof name==='string'&&(Object.hasOwn(skills,name)||(name.startsWith('工具:')&&tools2024.some(t=>t===name.slice(3)))))||featBase.has(name)||granted.includes(name)))skilledInvalid=true;
  for(const name of chosen.slice(0,3))if((typeof name==='string'&&(Object.hasOwn(skills,name)||(name.startsWith('工具:')&&tools2024.some(t=>t===name.slice(3)))))&&!featBase.has(name)&&!granted.includes(name))granted.push(name);
 }
 const grantedSkills=granted.filter(x=>Object.hasOwn(skills,x));const grantedTools=granted.filter(x=>x.startsWith('工具:')).map(x=>x.slice(3));
 const proficient=new Set([...base,...activeSubclassSkills,...grantedSkills]);
 const limit=c?expertiseLimit(cls,draft.level):0;
 const eligible=Object.keys(skills).filter(x=>proficient.has(x)&&(cls!=='法师'||knowledge.includes(x)));
 const selected=Array.isArray(c?.expertiseSkills)?c.expertiseSkills:[];
 const invalid=(c?.expertiseSkills!==undefined&&!Array.isArray(c.expertiseSkills))||selected.some(x=>!eligible.includes(x))||new Set(selected).size!==selected.length||selected.length>limit;
 const active=new Set(selected.filter((x,i)=>i<limit&&eligible.includes(x)&&selected.indexOf(x)===i));
 const jack=!!c&&cls==='吟游诗人'&&draft.level>=2;
 const orderBonus=(cls==='牧师'&&c?.classOrder==='thaumaturge')||(cls==='德鲁伊'&&c?.classOrder==='magician')?Math.max(1,abilityModifier(draft.abilities.wis)):0;
 const feyBonus=subclassActive&&cls==='游侠'&&c?.subclass==='fey-wanderer'?Math.max(1,abilityModifier(draft.abilities.wis)):0;
 return {eligible,limit,selected,invalid,proficient,active,primalAvailable,primalSkill,primalInvalid,subclassLimit,subclassPool,subclassSelected,subclassInvalid,base,activeSubclassSkills,fixedSubclassSkills,feyBonus,skilledSources,featSelections,featBase,granted:grantedSkills,grantedTools,skilledInvalid,modifier:(skill:string)=>{
  const ability=skills[skill];if(!ability)throw Error('未知技能。');
  return abilityModifier(draft.abilities[ability])+(active.has(skill)?2*pb:proficient.has(skill)?pb:jack?Math.floor(pb/2):0)+(ability==='cha'?feyBonus:0)+((skill==='奥秘'||(cls==='牧师'&&skill==='宗教')||(cls==='德鲁伊'&&skill==='自然'))?orderBonus:0);
 }};
}
