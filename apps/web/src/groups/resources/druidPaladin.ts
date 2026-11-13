import type { CharacterDraft } from '../../characters';
import type { ClassResourceDef } from '../../classResources';
import { abilityModifier } from '../../characterRules.ts';
// 德鲁伊 + 圣武士 的额外职业资源定义（T3 组维护）。
export function druidPaladinResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
 const c=draft.details?.fighterCalculator;if(!c)return [];const level=draft.level,wis=abilityModifier(draft.abilities.wis),cha=abilityModifier(draft.abilities.cha),defs:ClassResourceDef[]=[];
 if(c.characterClass==='德鲁伊'&&c.subclass==='moon'&&level>=10)defs.push({id:'druid-moon-step',name:'月光飞步',maximum:Math.max(1,wis),shortRest:false,unit:'次',note:'附赠动作传送最多 30 尺，本回合下一次攻击具有优势；可消耗一个 2 环及以上法术位恢复一次。'});
 if(c.characterClass==='德鲁伊'&&c.subclass==='land'&&level>=6){
  defs.push({id:'druid-land-free-cast',name:'自然恢复：免费施法',maximum:1,shortRest:false,unit:'次',note:'可施展一道以大地结社法术准备的 1 环及以上法术而不消耗法术位；长休恢复。'});
  defs.push({id:'druid-land-slot-recovery',name:'自然恢复：短休恢复法术位',maximum:1,shortRest:false,unit:'次',note:`短休时可恢复总环阶不超过 ${Math.ceil(level/2)} 的法术位（不含 6 环及以上）；长休前一次。`});
 }
 if(c.characterClass==='德鲁伊'&&level>=20)defs.push({id:'druid-nature-magician',name:'自然术使',maximum:1,shortRest:false,unit:'次',note:'可将未使用的荒野变身次数转化为法术位（每次消耗两点环阶，需消耗相应次数）；长休前一次。'});
 if(c.characterClass==='圣武士'&&level>=2)defs.push({id:'paladin-free-smite',name:'圣武斩：免费至圣斩',maximum:1,shortRest:false,unit:'次',note:'无需消耗法术位施展一次至圣斩；长休恢复。'});
 if(c.characterClass==='圣武士'&&c.subclass==='ancients'&&level>=15)defs.push({id:'paladin-undying-sentinel',name:'不灭哨卫',maximum:1,shortRest:false,unit:'次',note:`生命值降至 0（非直接死亡）时可改为降至 1 并恢复 ${level*3} 点生命值；长休恢复。`});
 if(c.characterClass==='圣武士'&&c.subclass==='glory'&&level>=15)defs.push({id:'paladin-glorious-defense',name:'辉煌防御',maximum:Math.max(1,cha),shortRest:false,unit:'次',note:'自己或 10 尺内可见生物被击中时，反应使 AC 加魅力调整值（最低 +1）；长休恢复。'});
 if(c.characterClass==='圣武士'&&['devotion','glory','ancients','vengeance'].includes(c.subclass??'')&&level>=20)defs.push({id:'paladin-oath-capstone',name:'誓约终极特性',maximum:1,shortRest:false,unit:'次',note:'附赠动作激活，持续 10 分钟；长休恢复一次，也可消耗一个 5 环法术位恢复使用次数。'});
 return defs;
}
