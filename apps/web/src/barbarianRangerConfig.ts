import type { CharacterDraft } from './characters';

// T1 组（野蛮人 + 游侠）在角色详情里新增的选择字段。
// 这些字段暂时由本组模块以本地扩展类型读写；正式字段与生成校验由 Lead 按 handoff 合并进 characters.ts。
type BaseConfig = NonNullable<NonNullable<CharacterDraft['details']>['fighterCalculator']>;

export type BarbarianRangerConfig = BaseConfig & {
  /** 武器精通选择的武器名（野蛮人 / 游侠，最多各 2–5 种）。 */
  weaponMastery?: string[];
  /** 游侠战斗风格名称。 */
  fightingStyle?: string;
  /** 德鲁伊教战士选择的两道德鲁伊戏法。 */
  druidicCantrips?: string[];
  /** 猎人：猎杀技艺选择。 */
  hunterPrey?: string;
  /** 猎人：防守战术选择。 */
  hunterDefense?: string;
  /** 驯兽师：原初行侣数据卡（大地 / 海洋 / 天空）。 */
  beastCompanion?: string;
  /** 妖精漫游者：精野之赐（1–6）。 */
  feyGift?: number;
};

export function config(draft: CharacterDraft): BarbarianRangerConfig | undefined {
  return draft.details?.fighterCalculator as BarbarianRangerConfig | undefined;
}

export function updateConfig(draft: CharacterDraft, patch: Partial<BarbarianRangerConfig>): CharacterDraft {
  const details = draft.details;
  const current = details?.fighterCalculator;
  if (!details || !current) return draft;
  return { ...draft, details: { ...details, fighterCalculator: { ...current, ...patch } as BaseConfig } };
}

export const heavyArmors = ['ring', 'chain', 'splint', 'plate'] as const;

export function isHeavyArmor(armor: string | undefined): boolean {
  return !!armor && (heavyArmors as readonly string[]).includes(armor);
}

export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
}
