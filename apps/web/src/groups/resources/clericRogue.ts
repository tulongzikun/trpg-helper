import type { CharacterDraft } from '../../characters';
import { abilityModifier } from '../../characterRules.ts';
import type { ClassResourceDef } from '../../classResources';
import { psiDiceFor } from '../../clericRogueRules.ts';

// 牧师 + 游荡者 的额外职业资源定义（T2 组维护）。
export function clericRogueResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
 const c = draft.details?.fighterCalculator;
 if (!c) return [];
 const defs: ClassResourceDef[] = [];
 const level = draft.level;
 const uses = Math.max(1, abilityModifier(draft.abilities.wis));
 if (c.characterClass === '牧师' && c.subclass === 'light' && level >= 3) {
  defs.push({ id: 'cleric-light-warding', name: '守御之光', maximum: uses, shortRest: level >= 6, unit: '次', note: '30 尺内可见生物发动攻击时，以反应使其攻击检定具有劣势；6 级起短休或长休恢复全部，且使用时给被攻击目标 2d6+感知调整值临时生命值。' });
 }
 if (c.characterClass === '牧师' && c.subclass === 'light' && level >= 17) {
  defs.push({ id: 'cleric-light-corona', name: '光冕', maximum: uses, shortRest: false, unit: '次', note: '魔法动作散发 1 分钟日光灵光；长休恢复。' });
 }
 if (c.characterClass === '牧师' && c.subclass === 'war' && level >= 3) {
  defs.push({ id: 'cleric-war-priest', name: '战争祭司', maximum: uses, shortRest: true, unit: '次', note: '以附赠动作进行一次武器攻击或徒手打击；短休或长休恢复全部。' });
 }
 if (c.characterClass === '游荡者' && c.subclass === 'soulknife' && level >= 3) {
  const psi = psiDiceFor(level);
  defs.push({ id: 'soulknife-psi', name: '灵能骰', maximum: psi.count, shortRest: 'one', unit: '枚', note: `骰面 d${psi.die}；短休恢复 1 枚，长休恢复全部。` });
  defs.push({ id: 'soulknife-whispers', name: '心灵低语免费使用', maximum: 1, shortRest: false, unit: '次', note: '每次长休后免费使用一次；其余每次使用消耗 1 枚灵能骰。' });
 }
 if (c.characterClass === '游荡者' && c.subclass === 'soulknife' && level >= 13) {
  defs.push({ id: 'soulknife-veil', name: '灵能面纱', maximum: 1, shortRest: false, unit: '次', note: '魔法动作隐形至多 1 小时；长休恢复。可消耗 1 枚灵能骰重置使用权。' });
 }
 if (c.characterClass === '游荡者' && c.subclass === 'soulknife' && level >= 17) {
  defs.push({ id: 'soulknife-rend-mind', name: '撕裂心智', maximum: 1, shortRest: false, unit: '次', note: '念刃造成偷袭伤害时迫使感知豁免；长休恢复。可消耗 3 枚灵能骰重置使用权。' });
 }
 if (c.characterClass === '游荡者' && c.subclass === 'arcane-trickster' && level >= 17) {
  defs.push({ id: 'rogue-spell-thief', name: '法术窃贼', maximum: 1, shortRest: false, unit: '次', note: '以反应阻止一个以你为目标的法术；长休恢复。偷学与准备法术需手动处理。' });
 }
 if (c.characterClass === '游荡者' && level >= 20) {
  defs.push({ id: 'rogue-lucky-strike', name: '幸运一击', maximum: 1, shortRest: true, unit: '次', note: 'D20 检定失败时可改为 20；短休或长休恢复。' });
 }
 return defs;
}
