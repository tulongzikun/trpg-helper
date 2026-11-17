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
      healing: sum.healing + row.healing,
    }),
    { attacks: 0, hits: 0, crits: 0, damageDealt: 0, damageTaken: 0, healing: 0 },
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
        healing: sum.healing + (stats?.healing ?? 0),
      };
    },
    { attacks: 0, hits: 0, crits: 0, damageDealt: 0, damageTaken: 0, healing: 0 },
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
