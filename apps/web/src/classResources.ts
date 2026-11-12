import type { CharacterDraft } from './characters';
import { abilityModifier } from './characterRules.ts';
import { invocationState } from './explorationInvocations.ts';
import { classSpellState } from './classSpellChoices.ts';

type Definition={id:string;name:string;maximum:number;shortRest:boolean|'one';unit:string;note?:string};
export function classResources(draft:CharacterDraft){
 const c=draft.details?.fighterCalculator;if(!c)return [];
 const defs:Definition[]=[];const level=draft.level;
 if(c.characterClass==='吟游诗人')defs.push({id:'bard-inspiration',name:'吟游诗人激励',maximum:Math.max(1,abilityModifier(draft.abilities.cha)),shortRest:level>=5,unit:'次',note:`激励骰 d${level>=15?12:level>=10?10:level>=5?8:6}`});
 if(c.characterClass==='圣武士')defs.push({id:'paladin-hands',name:'圣疗池',maximum:level*5,shortRest:false,unit:'点'});
 if(c.characterClass==='圣武士'&&level>=5)defs.push({id:'paladin-steed',name:'寻获坐骑免费施法',maximum:1,shortRest:false,unit:'次'});
 if(c.characterClass==='游侠')defs.push({id:'ranger-mark',name:'猎人印记免费施法',maximum:Math.min(6,2+Math.floor((level-1)/4)),shortRest:false,unit:'次'});
 if(c.characterClass==='游侠'&&level>=10)defs.push({id:'ranger-tireless',name:'不知疲倦',maximum:Math.max(1,abilityModifier(draft.abilities.wis)),shortRest:false,unit:'次',note:`以魔法动作获得 1d8 ${abilityModifier(draft.abilities.wis)>=0?'+':''}${abilityModifier(draft.abilities.wis)} 临时生命值（至少 1）；短休后力竭等级降低 1。`});
 if(c.characterClass==='圣武士'&&level>=3)defs.push({id:'paladin-channel',name:'引导神力',maximum:level>=11?3:2,shortRest:'one',unit:'次',note:'短休恢复一次，长休恢复全部。'});
 if(c.characterClass==='牧师'&&level>=2)defs.push({id:'cleric-channel',name:'引导神力',maximum:level>=18?4:level>=6?3:2,shortRest:'one',unit:'次',note:'短休恢复一次，长休恢复全部。'});
 if(c.characterClass==='牧师'&&level>=10)defs.push({id:'cleric-divine-intervention',name:'神圣干预',maximum:1,shortRest:false,unit:'次',note:'施放一项不需反应施放的 5 环及以下牧师法术，无需法术位及材料成分。'});
 if(c.characterClass==='德鲁伊'&&level>=2)defs.push({id:'druid-wildshape',name:'荒野变身',maximum:level>=17?4:level>=6?3:2,shortRest:'one',unit:'次',note:'短休恢复一次，长休恢复全部；荒野伙伴也消耗此次数。'});
 if(c.characterClass==='战士')defs.push({id:'fighter-secondwind',name:'回气',maximum:level>=10?4:level>=4?3:2,shortRest:'one',unit:'次',note:'短休恢复一次，长休恢复全部；战术思维也使用此资源。'});
 if(c.characterClass==='术士'&&level>=2)defs.push({id:'sorcerer-points',name:'术法点',maximum:level,shortRest:false,unit:'点',note:level>=5?`术法回想可在短休后恢复至多 ${Math.floor(level/2)} 点，长休后可再次使用；需手动记录。`:undefined});
 if(c.characterClass==='术士'&&level>=5)defs.push({id:'sorcerer-restoration',name:'术法回想',maximum:1,shortRest:false,unit:'次',note:'短休后可选择使用；可在法术位区域使用。'});
 if(c.characterClass==='武僧'&&level>=2)defs.push({id:'monk-focus',name:'专注点',maximum:level,shortRest:true,unit:'点'});
 if(c.characterClass==='法师')defs.push({id:'wizard-recovery',name:'奥术回想',maximum:1,shortRest:false,unit:'次',note:`短休时可恢复总环数不超过 ${Math.ceil(level/2)} 的法术位（不含 6 环及以上）；可在法术位区域选择恢复。`});
 if(c.characterClass==='法师'&&c.subclass==='diviner'&&level>=10)defs.push({id:'diviner-third-eye',name:'天眼通',maximum:1,shortRest:true,unit:'次',note:'激活后选择一项效果，开始休息时结束；完成短休或长休恢复。'});
 if(c.characterClass==='法师'&&level>=20){const state=classSpellState(draft);for(const name of state?.signature??[])if(typeof name==='string'&&state?.book.some(x=>x?.name===name&&x.level===3))defs.push({id:`wizard-signature:${encodeURIComponent(name)}`,name:`招牌法术：${name}`,maximum:1,shortRest:true,unit:'次',note:'可不消耗法术位按 3 环施放；短休或长休后恢复。'});}
 if(c.characterClass==='邪术师'&&level>=2)defs.push({id:'warlock-cunning',name:'魔法狡黠',maximum:1,shortRest:false,unit:'次',note:'可按规则恢复契约法术位；可在法术位区域使用。'});
 if(c.characterClass==='邪术师'&&level>=9)defs.push({id:'warlock-contact',name:'联络宗主免费施法',maximum:1,shortRest:false,unit:'次',note:'只能以此方式联系宗主，且自动通过法术豁免。'});
 if(c.characterClass==='邪术师'&&invocationState(draft).active.includes('gift-depths'))defs.push({id:'warlock-depths',name:'深海赐礼：水下呼吸免费施法',maximum:1,shortRest:false,unit:'次'});
 return defs.map(def=>{const raw=c.classResourceSpent?.[def.id];const spent=typeof raw==='number'&&Number.isInteger(raw)&&raw>=0?raw:0;return {...def,spent,remaining:Math.max(0,def.maximum-spent)}});
}
export function changeClassResource(draft:CharacterDraft,id:string,delta:number):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator,r=classResources(draft).find(x=>x.id===id);
 if(!details||!c||!r||!Number.isInteger(delta))return draft;
 return {...draft,details:{...details,fighterCalculator:{...c,classResourceSpent:{...c.classResourceSpent,[id]:Math.max(0,Math.min(r.maximum,r.spent+delta))}}}};
}
export function restoreClassResources(draft:CharacterDraft,rest:'short'|'long'):CharacterDraft{
 const details=draft.details,c=details?.fighterCalculator;if(!details||!c)return draft;const spent={...c.classResourceSpent};
 for(const r of classResources(draft)){if(rest==='long'||r.shortRest===true)spent[r.id]=0;else if(r.shortRest==='one')spent[r.id]=Math.max(0,r.spent-1);}
 return {...draft,details:{...details,fighterCalculator:{...c,classResourceSpent:spent}}};
}
