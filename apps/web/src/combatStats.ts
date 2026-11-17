import type { Battle, Side } from './battle.ts';

export type StatRow = {
  id: string;
  name: string;
  side: Side;
  status: string;
  attacks: number;
  hits: number;
  crits: number;
  /** 命中率（0–1，保留两位小数）。 */
  accuracy: number;
  damageDealt: number;
  damageTaken: number;
  damageByType: Record<string, number>;
  healing: number;
};

export type BattleStatistics = {
  round: number;
  rows: StatRow[];
  totals: {
    attacks: number;
    hits: number;
    crits: number;
    damageDealt: number;
    damageTaken: number;
    damageByType: Record<string, number>;
    healing: number;
  };
};

/** 汇总每个单位的攻击、命中、伤害与治疗数据。 */
export function battleStatistics(battle: Battle): BattleStatistics {
  const rows: StatRow[] = battle.actors.map(actor => {
    const stats = actor.combat?.stats;
    const attacks = stats?.attacks ?? 0;
    const hits = stats?.hits ?? 0;
    return {
      id: actor.id,
      name: actor.name,
      side: actor.side,
      status: actor.combat?.status ?? 'active',
      attacks,
      hits,
      crits: stats?.crits ?? 0,
      accuracy: attacks === 0 ? 0 : Math.round((hits / attacks) * 100) / 100,
      damageDealt: stats?.damageDealt ?? 0,
      damageTaken: stats?.damageTaken ?? 0,
      damageByType: { ...(stats?.damageByType ?? {}) },
      healing: stats?.healing ?? 0,
    };
  });
  rows.sort((left, right) => right.damageDealt - left.damageDealt || left.name.localeCompare(right.name, 'zh-Hans-CN'));
  const totals = rows.reduce(
    (sum, row) => ({
      attacks: sum.attacks + row.attacks,
      hits: sum.hits + row.hits,
      crits: sum.crits + row.crits,
      damageDealt: sum.damageDealt + row.damageDealt,
      damageTaken: sum.damageTaken + row.damageTaken,
      damageByType: mergeType(sum.damageByType, row.damageByType),
      healing: sum.healing + row.healing,
    }),
    { attacks: 0, hits: 0, crits: 0, damageDealt: 0, damageTaken: 0, damageByType: {}, healing: 0 },
  );
  return { round: battle.combat?.round ?? 0, rows, totals };
}

/** 按阵营汇总某一方的数据。 */
export function sideStatistics(battle: Battle, side: Side): BattleStatistics['totals'] {
  const rows = battle.actors.filter(actor => actor.side === side);
  return rows.reduce(
    (sum, actor) => {
      const stats = actor.combat?.stats;
      return {
        attacks: sum.attacks + (stats?.attacks ?? 0),
        hits: sum.hits + (stats?.hits ?? 0),
        crits: sum.crits + (stats?.crits ?? 0),
        damageDealt: sum.damageDealt + (stats?.damageDealt ?? 0),
        damageTaken: sum.damageTaken + (stats?.damageTaken ?? 0),
        damageByType: mergeType(sum.damageByType, stats?.damageByType),
        healing: sum.healing + (stats?.healing ?? 0),
      };
    },
    { attacks: 0, hits: 0, crits: 0, damageDealt: 0, damageTaken: 0, damageByType: {}, healing: 0 },
  );
}

/** 一句话战斗节奏摘要，供界面与战报复用。 */
export function statsText(battle: Battle): string {
  const { round, totals } = battleStatistics(battle);
  if (totals.attacks === 0) return `第 ${round} 轮：还没有攻击记录。`;
  const parts = [`第 ${round} 轮`, `${totals.attacks} 次攻击`];
  const accuracy = Math.round((totals.hits / totals.attacks) * 100);
  parts.push(`命中 ${totals.hits}（${accuracy}%）`);
  if (totals.crits) parts.push(`重击 ${totals.crits}`);
  parts.push(`造成 ${totals.damageDealt} 点伤害`);
  if (totals.healing) parts.push(`治疗 ${totals.healing} 点`);
  return parts.join(' · ');
}

/** 合并两个「伤害类型 → 点数」表。 */
function mergeType(into: Record<string, number>, add?: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = { ...into };
  for (const [type, amount] of Object.entries(add ?? {})) merged[type] = (merged[type] ?? 0) + amount;
  return merged;
}

export type DamageTypeShare = { type: string; amount: number; share: number };

/** 承受伤害按类型占比，降序；占比为 0–1 并保留两位小数。 */
export function damageTypeShares(battle: Battle, limit = 4): DamageTypeShare[] {
  const totals = battleStatistics(battle).totals;
  const entries = Object.entries(totals.damageByType).filter(([, amount]) => amount > 0);
  const sum = entries.reduce((acc, [, amount]) => acc + amount, 0);
  if (sum === 0) return [];
  const shares = entries
    .map(([type, amount]) => ({ type, amount, share: Math.round((amount / sum) * 100) / 100 }))
    .sort((left, right) => right.amount - left.amount || left.type.localeCompare(right.type, 'zh-Hans-CN'));
  if (shares.length <= limit) return shares;
  const head = shares.slice(0, limit - 1);
  const rest = shares.slice(limit - 1).reduce((acc, item) => acc + item.amount, 0);
  return [...head, { type: '其他', amount: rest, share: Math.round((rest / sum) * 100) / 100 }];
}

/** 一句话伤害构成，例如「伤害构成：挥砍 42（50%）· 火焰 30（36%）」。 */
export function typeText(battle: Battle, limit = 3): string {
  const shares = damageTypeShares(battle, limit);
  if (!shares.length) return '伤害构成：尚无伤害记录。';
  return `伤害构成：${shares.map(item => `${item.type} ${item.amount}（${Math.round(item.share * 100)}%）`).join(' · ')}`;
}
