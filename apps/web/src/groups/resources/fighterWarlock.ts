import type { CharacterDraft } from '../../characters';
import type { ClassResourceDef } from '../../classResources';
import { abilityModifier } from '../../characterRules.ts';
import { spellSlots } from '../../spellSlots.ts';
import { classSpellState } from '../../classSpellChoices.ts';
import { invocationState } from '../../explorationInvocations.ts';

// 战士 + 邪术师 的额外职业资源定义（T4 组维护）。
export function fighterWarlockResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
 const defs: ClassResourceDef[] = [];
 const c = draft.details?.fighterCalculator;
 const level = draft.level;
 const cha = abilityModifier(draft.abilities.cha);
 if (c?.characterClass === '战士') {
  if (level >= 2) defs.push({ id: 'fighter-action-surge', name: '动作如潮', maximum: level >= 17 ? 2 : 1, shortRest: true, unit: '次', note: '回合内额外一个非魔法动作；每回合至多一次；短休或长休恢复全部。' });
  if (level >= 9) defs.push({ id: 'fighter-indomitable', name: '不屈', maximum: level >= 17 ? 3 : level >= 13 ? 2 : 1, shortRest: false, unit: '次', note: '豁免失败时重骰并加战士等级加值；长休恢复全部。' });
  if (c.subclass === 'battle-master' && level >= 3) {
   const count = level >= 15 ? 6 : level >= 7 ? 5 : 4;
   const die = level >= 18 ? 12 : level >= 10 ? 10 : 8;
   defs.push({ id: 'battle-master-superiority', name: '卓越骰', maximum: count, shortRest: true, unit: '枚', note: `d${die}；短休或长休恢复全部；每回合可使用多枚，但单次攻击只能应用一种战技。` });
   if (level >= 7) defs.push({ id: 'battle-master-know-enemy', name: '料敌机先', maximum: 1, shortRest: false, unit: '次', note: '附赠动作获知 30 尺内可见生物的抗性、免疫与易伤；长休恢复，可消耗 1 枚卓越骰重置。' });
  }
  if (c.subclass === 'psi-warrior' && level >= 3) {
   const die = level >= 15 ? 12 : level >= 13 ? 10 : level >= 9 ? 8 : 6;
   const count = level >= 17 ? 12 : level >= 15 ? 10 : level >= 13 ? 10 : level >= 11 ? 8 : level >= 9 ? 8 : level >= 7 ? 6 : level >= 5 ? 6 : 4;
   defs.push({ id: 'psi-dice', name: '灵能骰', maximum: count, shortRest: 'one', unit: '枚', note: `d${die}；短休恢复 1 枚，长休恢复全部；可用于庇护力场、灵能打击等。` });
   defs.push({ id: 'psi-telekinetic-move', name: '念力控物', maximum: 1, shortRest: true, unit: '次', note: '魔法动作移动 30 尺内生物或物件；短休或长休恢复，可消耗 1 枚灵能骰重置。' });
   if (level >= 7) defs.push({ id: 'psi-leap', name: '灵力跃动', maximum: 1, shortRest: true, unit: '次', note: '附赠动作获得至回合结束的飞行速度；短休或长休恢复，可消耗 1 枚灵能骰重置。' });
   if (level >= 15) defs.push({ id: 'psi-bulwark', name: '力场壁垒', maximum: 1, shortRest: false, unit: '次', note: '附赠动作给至多智力调整值个生物半身掩护 1 分钟；长休恢复，可消耗 1 枚灵能骰重置。' });
  }
 }
 if (c?.characterClass === '邪术师') {
  const slots = spellSlots(draft);
  const spells = classSpellState(draft);
  if (slots?.kind === 'pact') {
   for (const arcanumLevel of slots.arcanumLevels) {
    const name = spells?.arcanum?.[String(arcanumLevel)] ?? '';
    if (!name.trim()) continue;
    defs.push({ id: `warlock-arcanum-${arcanumLevel}`, name: `玄奥秘法（${arcanumLevel} 环 ${name}）`, maximum: 1, shortRest: false, unit: '次', note: '免费施展该秘法；长休恢复全部秘法使用次数；替换需在获得邪术师等级时人工核对。' });
   }
  }
  if (c.subclass === 'archfey' && level >= 3) {
   defs.push({ id: 'archfey-fey-steps', name: '妖精步伐', maximum: Math.max(1, cha), shortRest: false, unit: '次', note: '免费施展迷踪步；长休恢复全部；每次可附带复苏步伐或嘲弄步伐。' });
   if (level >= 10) defs.push({ id: 'archfey-beguiling-deflection', name: '斗转星移', maximum: 1, shortRest: false, unit: '次', note: '被命中时反应减半伤害并反伤；长休恢复，可消耗契约法术位重置。' });
  }
  if (c.subclass === 'celestial' && level >= 3) {
   defs.push({ id: 'celestial-healing-light', name: '治愈之光', maximum: Math.max(1, 1 + level), shortRest: false, unit: '枚 d6', note: `骰池 ${1 + level} 枚 d6；附赠动作治疗 60 尺内可见生物，单次最多消耗 ${Math.max(1, cha)} 枚；长休恢复全部。` });
   if (level >= 14) defs.push({ id: 'celestial-revive', name: '灼光复仇', maximum: 1, shortRest: false, unit: '次', note: '60 尺内生物将进行死亡豁免时，可恢复其半数生命并造成光耀伤害；长休恢复。' });
  }
  if (c.subclass === 'fiend' && level >= 6) {
   defs.push({ id: 'fiend-dark-luck', name: '黑暗强运', maximum: Math.max(1, cha), shortRest: false, unit: '次', note: '属性检定或豁免时加 d10；长休恢复全部。' });
   if (level >= 14) defs.push({ id: 'fiend-hurl-through-hell', name: '直坠噩梦', maximum: 1, shortRest: false, unit: '次', note: '攻击命中时迫使目标魅力豁免，失败被放逐并受心灵伤害；长休恢复，可消耗契约法术位重置。' });
  }
  if (c.subclass === 'great-old-one') {
   if (level >= 6) defs.push({ id: 'goo-clairvoyant-combatant', name: '锐眼斗士', maximum: 1, shortRest: true, unit: '次', note: '建立心灵连结时可迫使目标感知豁免；短休或长休恢复，可消耗契约法术位重置。' });
  }
  if (invocationState(draft).active.includes('thief-five-fates')) defs.push({ id: 'invocation-thief-five-fates', name: '五运窃贼：免费灾祸术', maximum: 1, shortRest: false, unit: '次', note: '可免费施放一次灾祸术；长休恢复。' });
 }
 return defs;
}
