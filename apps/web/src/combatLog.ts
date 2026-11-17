import type { CombatLogEntry } from './battle';

export type LogFilter = {
  /** 只看某一轮。 */
  round?: number;
  /** 关键字，匹配正文与明细（不区分大小写）。 */
  keyword?: string;
  /** 只看与某个单位名相关的条目。 */
  actorName?: string;
  /** 只保留最后 N 条。 */
  limit?: number;
};

/** 按轮次、关键字与单位名筛选战斗日志，返回原始顺序（由旧到新）。 */
export function filterLog(entries: readonly CombatLogEntry[], filter: LogFilter = {}): CombatLogEntry[] {
  const keyword = filter.keyword?.trim().toLowerCase() ?? '';
  const actorName = filter.actorName?.trim() ?? '';
  const matched = entries.filter(entry => {
    if (filter.round !== undefined && entry.round !== filter.round) return false;
    if (actorName && !entry.text.includes(actorName) && !(entry.detail ?? '').includes(actorName)) return false;
    if (keyword) {
      const haystack = entry.text.toLowerCase() + ' ' + (entry.detail ?? '').toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
  if (filter.limit !== undefined && filter.limit >= 0 && matched.length > filter.limit) return matched.slice(matched.length - filter.limit);
  return matched;
}

/** 日志里出现过的轮次，由新到旧。 */
export function logRounds(entries: readonly CombatLogEntry[]): number[] {
  return [...new Set(entries.map(entry => entry.round))].sort((a, b) => b - a);
}
