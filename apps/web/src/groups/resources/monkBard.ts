import type { CharacterDraft } from '../../characters';
import type { ClassResourceDef } from '../../classResources';
import { abilityModifier } from '../../characterRules.ts';
// 武僧 + 吟游诗人（含子职业）的额外职业资源定义（T5 组维护）。
// 只记录次数与恢复规则；骰值与战斗轮内结算由玩家手动处理。
export function monkBardResourceDefs(draft: CharacterDraft): ClassResourceDef[] {
  const c = draft.details?.fighterCalculator;
  if (!c) return [];
  const level = draft.level, cls = c.characterClass, sub = c.subclass, defs: ClassResourceDef[] = [];
  if (cls === '武僧' && level >= 2) {
    defs.push({ id: 'monk-uncanny-metabolism', name: '运转周天', maximum: 1, shortRest: false, unit: '次', note: '投先攻时重获全部功力，并恢复「1 武艺骰 + 武僧等级」的生命值；每长休一次。' });
  }
  if (cls === '武僧' && sub === 'mercy' && level >= 11) {
    defs.push({ id: 'monk-mercy-flurry', name: '生杀予夺：免费予命之手', maximum: Math.max(1, abilityModifier(draft.abilities.wis)), shortRest: false, unit: '次', note: '疾风连击可把攻击替换为予命之手且不消耗功力；夺命之手也可免费使用，但仍每回合一次。感知调整值次，长休恢复。' });
  }
  if (cls === '武僧' && sub === 'mercy' && level >= 17) {
    defs.push({ id: 'monk-mercy-ultimate', name: '命极之手', maximum: 1, shortRest: false, unit: '次', note: '以魔法动作消耗 5 点功力触碰死亡不超过 24 小时的生物，使其以 4d10 + 感知调整值的生命值复活；每长休一次。' });
  }
  if (cls === '武僧' && sub === 'open-hand' && level >= 6) {
    defs.push({ id: 'monk-openhand-wholeness', name: '混元体', maximum: Math.max(1, abilityModifier(draft.abilities.wis)), shortRest: false, unit: '次', note: '以附赠动作恢复「1 武艺骰 + 感知调整值」的生命值；感知调整值次，长休恢复。' });
  }
  if (cls === '吟游诗人' && sub === 'glamour' && level >= 3) {
    defs.push({ id: 'bard-glamour-beguiling', name: '惑心魔法', maximum: 1, shortRest: false, unit: '次', note: '施放惑控或幻术学派法术后可令 60 尺内生物进行感知豁免；长休恢复一次，也可消耗一次激励重置。' });
  }
  if (cls === '吟游诗人' && sub === 'glamour' && level >= 6) {
    defs.push({ id: 'bard-glamour-majesty', name: '威仪作锦', maximum: 1, shortRest: false, unit: '次', note: '以附赠动作免法术位施放命令术并获得 1 分钟威仪；长休恢复一次，也可消耗三环或更高法术位重置。' });
  }
  if (cls === '吟游诗人' && sub === 'glamour' && level >= 14) {
    defs.push({ id: 'bard-glamour-unbreakable', name: '不破威仪', maximum: 1, shortRest: 'one', unit: '次', note: '以附赠动作获得 1 分钟威仪；每回合首次被命中时可令攻击者进行魅力豁免，失败则攻击失手。短休恢复一次，长休恢复全部。' });
  }
  return defs;
}
