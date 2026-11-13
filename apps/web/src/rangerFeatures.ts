import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { config, isHeavyArmor, stringList } from './barbarianRangerConfig.ts';
import { epicBoon } from './druidPaladinShared.ts';
import { barbarianWeapons } from './barbarianFeatures.ts';

// 游侠可选取任意已熟练武器（含远程）；这里列出简易与军用武器的中文名。
export const rangerWeapons = [
  ...barbarianWeapons,
  '吹箭筒', '轻弩', '短弓', '投石索', '长弓', '重弩',
] as const;

/** 游侠武器精通固定为 2 种已熟练武器（长休可换）。 */
export const rangerWeaponMasteryLimit = 2;

export const rangerFightingStyles = [
  '箭术', '盲斗', '防御', '决斗', '拦截', '守护', '投掷武器战斗', '双武器战斗', '徒手战斗', '德鲁伊教战士',
] as const;

export const druidicWarriorStyle = '德鲁伊教战士';

/** 宿敌：猎人印记免费施放次数 = min(6, 2 + floor((等级-1)/4))。 */
export function favoredEnemyFreeUses(level: number): number {
  return Math.min(6, 2 + Math.floor((level - 1) / 4));
}

/** 不知疲倦 / 自然面纱等按感知调整值（最低 1）记录次数。 */
export function wisdomUses(draft: CharacterDraft): number {
  return Math.max(1, abilityModifier(draft.abilities.wis));
}

export function naturesVeilUses(draft: CharacterDraft): number {
  return wisdomUses(draft);
}

/** 20 级屠灭众敌：猎人印记的额外伤害骰从 d6 提升为 d10。 */
export function huntersMarkDie(level: number): 'd6' | 'd10' {
  return level >= 20 ? 'd10' : 'd6';
}

export function rangerState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '游侠') return null;
  const level = draft.level;
  const heavy = isHeavyArmor(c.armor);
  const wis = abilityModifier(draft.abilities.wis);
  const fightingStyle = typeof c.fightingStyle === 'string' ? c.fightingStyle : '';
  const druidicCantrips = stringList(c.druidicCantrips);
  const masterySelected = stringList(c.weaponMastery);
  const masteryInvalid = masterySelected.filter((name) => !(rangerWeapons as readonly string[]).includes(name));
  const masteryDuplicates = masterySelected.filter((name, index) => masterySelected.indexOf(name) !== index);
  return {
    level,
    proficiencyBonus: proficiencyBonus(level),
    favoredEnemyFreeUses: favoredEnemyFreeUses(level),
    huntersMarkDie: huntersMarkDie(level),
    weaponMastery: {
      limit: rangerWeaponMasteryLimit,
      selected: masterySelected,
      invalid: masteryInvalid,
      duplicates: [...new Set(masteryDuplicates)],
    },
    roving: level >= 6 && !heavy,
    rovingSpeedBonus: level >= 6 && !heavy ? 10 : 0,
    climbSwim: level >= 6 && !heavy,
    deftExplorer: level >= 2 ? { expertise: 1, languages: 2 } : null,
    expertiseCount: level >= 9 ? 3 : level >= 2 ? 1 : 0,
    tireless: level >= 10
      ? { uses: wisdomUses(draft), tempHp: `1d8${wis >= 0 ? '+' : ''}${wis}（至少 1）`, exhaustionOnShortRest: 1 }
      : null,
    naturesVeil: level >= 14 ? { uses: naturesVeilUses(draft) } : null,
    relentlessHunter: level >= 13,
    preciseHunter: level >= 17,
    feralSenses: level >= 18 ? 30 : null,
    foeSlayer: level >= 20,
    fightingStyle,
    druidicCantrips,
    wisdomModifier: wis,
    epicBoonAvailable: level >= 19,
    epicBoonName: epicBoon(draft),
  };
}

/** 战斗风格的保存校验；通过返回 null。 */
export function fightingStyleError(draft: CharacterDraft): string | null {
  const state = rangerState(draft);
  if (!state) return null;
  if (!state.fightingStyle) {
    return state.druidicCantrips.length ? '请选择德鲁伊教战士战斗风格后再选择德鲁伊戏法。' : null;
  }
  if (!(rangerFightingStyles as readonly string[]).includes(state.fightingStyle)) {
    return `战斗风格无效（${state.fightingStyle}）。`;
  }
  if (state.fightingStyle !== druidicWarriorStyle) {
    return state.druidicCantrips.length ? '只有德鲁伊教战士战斗风格需要选择德鲁伊戏法。' : null;
  }
  if (state.druidicCantrips.length !== 2) return '德鲁伊教战士需要选择 2 个不重复的德鲁伊戏法。';
  if (new Set(state.druidicCantrips).size !== 2) return '德鲁伊教战士的两个戏法不能重复。';
  return null;
}

/** 游侠武器精通的保存校验；通过返回 null。 */
export function rangerWeaponMasteryError(draft: CharacterDraft): string | null {
  const state = rangerState(draft);
  if (!state) return null;
  const { limit, selected, invalid, duplicates } = state.weaponMastery;
  if (duplicates.length) return `武器精通不能重复选择同一种武器（${duplicates.join('、')}）。`;
  if (invalid.length) return `武器精通只能选择已列出的简易或军用武器（无效：${invalid.join('、')}）。`;
  if (selected.length > limit) return `武器精通最多选择 ${limit} 种武器。`;
  return null;
}
