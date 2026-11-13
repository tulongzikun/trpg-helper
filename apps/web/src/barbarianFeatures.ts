import type { CharacterDraft } from './characters';
import { abilityModifier, proficiencyBonus } from './characterRules.ts';
import { config, isHeavyArmor, stringList } from './barbarianRangerConfig.ts';
import { epicBoon } from './druidPaladinShared.ts';

// 可选取的简易 / 军用近战武器（2024 玩家手册武器表）。
export const barbarianWeapons = [
  '棍棒', '匕首', '巨棒', '手斧', '标枪', '轻锤', '硬头锤', '长棍', '镰刀', '长矛',
  '战斧', '连枷', '戟', '巨斧', '巨剑', '长戟', '骑枪', '长剑', '巨锤', '晨星',
  '长枪', '刺剑', '弯刀', '短剑', '三叉戟', '战锤', '战镐', '鞭',
] as const;

/** 狂暴次数：1 级 2 次，3 级 3 次，6 级 4 次，12 级 5 次，17 级 6 次。 */
export function rageUses(level: number): number {
  return level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2;
}

/** 狂暴伤害加值：1–8 级 +2，9–15 级 +3，16 级起 +4。 */
export function rageDamageBonus(level: number): number {
  return level >= 16 ? 4 : level >= 9 ? 3 : 2;
}

/** 武器精通可选武器数：1 级 2 种，4 级 3 种，10 级 4 种，16 级 5 种。 */
export function weaponMasteryLimit(level: number): number {
  return level >= 16 ? 5 : level >= 10 ? 4 : level >= 4 ? 3 : 2;
}

/** 凶蛮打击的额外伤害骰：9 级 1d10，17 级 2d10。 */
export function brutalStrikeDie(level: number): string | null {
  if (level < 9) return null;
  return level >= 17 ? '2d10' : '1d10';
}

export function barbarianState(draft: CharacterDraft) {
  const c = config(draft);
  if (c?.characterClass !== '野蛮人') return null;
  const level = draft.level;
  const heavy = isHeavyArmor(c.armor);
  const masteryLimit = weaponMasteryLimit(level);
  const masterySelected = stringList(c.weaponMastery);
  const masteryInvalid = masterySelected.filter((name) => !(barbarianWeapons as readonly string[]).includes(name));
  const masteryDuplicates = masterySelected.filter((name, index) => masterySelected.indexOf(name) !== index);
  return {
    level,
    rage: {
      uses: rageUses(level),
      damage: rageDamageBonus(level),
      /** 短休恢复 1 次、长休恢复全部；每场战斗开始视为满次数，实际以资源记录为准。 */
      shortRestOne: true,
      durationMinutes: 10,
    },
    weaponMastery: {
      limit: masteryLimit,
      selected: masterySelected,
      invalid: masteryInvalid,
      duplicates: [...new Set(masteryDuplicates)],
    },
    unarmoredDefense: c.armor === 'none'
      ? 10 + abilityModifier(draft.abilities.dex) + abilityModifier(draft.abilities.con) + (c.shield ? 2 : 0)
      : null,
    fastMovement: level >= 5 && !heavy,
    feralInstinct: level >= 7,
    instinctivePounce: level >= 7,
    brutalStrike: level >= 9
      ? { die: brutalStrikeDie(level) as string, effects: level >= 13 ? 2 : 1 }
      : null,
    relentlessRage: level >= 11,
    persistentRage: level >= 15,
    indomitableMight: level >= 18 ? { floor: draft.abilities.str } : null,
    epicBoon: level >= 19,
    epicBoonName: epicBoon(draft),
    primalChampion: level >= 20 ? { strength: 4, constitution: 4, cap: 25 } : null,
    proficiencyBonus: proficiencyBonus(level),
  };
}

/** 武器精通的保存校验；通过返回 null。 */
export function weaponMasteryError(draft: CharacterDraft): string | null {
  const state = barbarianState(draft);
  if (!state) return null;
  const { limit, selected, invalid, duplicates } = state.weaponMastery;
  if (duplicates.length) return `武器精通不能重复选择同一种武器（${duplicates.join('、')}）。`;
  if (invalid.length) return `武器精通只能选择简易或军用近战武器（无效：${invalid.join('、')}）。`;
  if (selected.length > limit) return `武器精通最多选择 ${limit} 种武器。`;
  return null;
}
