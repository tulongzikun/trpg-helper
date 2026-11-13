import type { CharacterDraft } from './characters';
import { barbarianState } from './barbarianFeatures.ts';
import { config } from './barbarianRangerConfig.ts';
import { wildHeart } from './wildHeart.ts';

export function berserkerState(draft: CharacterDraft) {
  const base = barbarianState(draft);
  const c = config(draft);
  if (!base || c?.subclass !== 'berserker') return null;
  return {
    level: base.level,
    /** 狂怒：狂暴中鲁莽攻击首次命中额外 n d6，n = 狂暴伤害加值。 */
    frenzyExtraDie: `${base.rage.damage}d6`,
    mindlessRage: base.level >= 6,
    retaliation: base.level >= 10,
    intimidatingPresence: base.level >= 14
      ? { usesPerLongRest: 1, resetByRage: true, rangeFt: 30 }
      : null,
  };
}

export function wildHeartState(draft: CharacterDraft) {
  const base = barbarianState(draft);
  const c = config(draft);
  if (!base || c?.subclass !== 'wild-heart') return null;
  const heart = wildHeart(draft);
  const aspect = heart?.aspect;
  return {
    level: base.level,
    rituals: heart?.rituals ?? [],
    aspect: aspect ?? '',
    /** 兽性狂暴：进入狂暴时选择熊 / 鹰 / 狼。 */
    beastRage: { options: ['熊', '鹰', '狼'], level: 3 },
    /** 兽力威能：进入狂暴时选择猎鹰 / 雄狮 / 角羊。 */
    wildPower: base.level >= 14 ? { options: ['猎鹰', '雄狮', '角羊'] } : null,
    aspectEffects: {
      枭: '60 尺黑暗视觉；若已有黑暗视觉则范围 +60 尺。',
      豹: '攀爬速度等于你的速度。',
      鲑: '游泳速度等于你的速度。',
    },
    darkvision: aspect === '枭' ? 60 : 0,
    climb: aspect === '豹',
    swim: aspect === '鲑',
  };
}

export function worldTreeState(draft: CharacterDraft) {
  const base = barbarianState(draft);
  const c = config(draft);
  if (!base || c?.subclass !== 'world-tree') return null;
  return {
    level: base.level,
    /** 圣树活力：进入狂暴时获得等于野蛮人等级的临时生命值。 */
    vitalityTempHp: base.level,
    /** 生命之赐：狂暴中每回合开始可给 10 尺内另一生物 n d6 临时生命值。 */
    lifeGivingDie: `${base.rage.damage}d6`,
    reachBonus: base.level >= 10 ? 10 : 0,
    /** 世界树之奇旅：进入狂暴时传送 60 尺；狂暴中可用附赠动作传送。 */
    teleportFt: 60,
    greaterTeleport: base.level >= 14 ? { ft: 150, creatures: 6 } : null,
  };
}

export function zealotState(draft: CharacterDraft) {
  const base = barbarianState(draft);
  const c = config(draft);
  if (!base || c?.subclass !== 'zealot') return null;
  const level = base.level;
  return {
    level,
    /** 神性之怒：每回合首次武器 / 徒手命中额外 1d6 + 一半野蛮人等级。 */
    divineFury: `1d6+${Math.floor(level / 2)}`,
    /** 神之勇者：治疗池 d12 数量。 */
    healingPoolDice: level >= 17 ? 7 : level >= 12 ? 6 : level >= 6 ? 5 : 4,
    zealousPresence: level >= 10 ? { usesPerLongRest: 1, resetByRage: true } : null,
    rageOfGods: level >= 14 ? { usesPerLongRest: 1 } : null,
  };
}
