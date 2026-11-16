import type { Battle } from './battle.ts';
import { validateBattle } from './battle.ts';

/** 战斗档案的格式标识，导入时用来拒绝不认识的版本。 */
export const battleExportSchema = 'trpg-helper.battle-export/v1';

export type BattleExport = { schema: string; exportedAt: string; battle: Battle };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * 导出战斗为可读的 JSON 文本。
 * 撤销历史（undo）不会写进档案，避免把整棵快照树一起导出。
 */
export function exportBattle(battle: Battle, now: Date = new Date()): string {
  const copy = clone(battle);
  if (copy.combat) copy.combat.undo = [];
  const payload: BattleExport = { schema: battleExportSchema, exportedAt: now.toISOString(), battle: copy };
  return JSON.stringify(payload, null, 2);
}

/**
 * 从 JSON 文本导入战斗。
 * `takenIds` 里已存在的 id 会自动加后缀，避免覆盖本地已有的战斗。
 */
export function importBattle(text: string, takenIds: readonly string[] = []): Battle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('战斗档案不是有效的 JSON。');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('战斗档案的格式或版本不受支持。');
  const record = parsed as Record<string, unknown>;
  let battleValue: unknown = parsed;
  if ('schema' in record) {
    if (record.schema !== battleExportSchema) throw new Error('战斗档案的格式或版本不受支持。');
    battleValue = record.battle;
  }
  const battle = validateBattle(clone(battleValue));
  if (takenIds.includes(battle.id)) {
    let suffix = 2;
    while (takenIds.includes(`${battle.id}-${suffix}`)) suffix += 1;
    battle.id = `${battle.id}-${suffix}`;
  }
  if (battle.combat) battle.combat.undo = [];
  return battle;
}

const statusLabels: Record<string, string> = { active: '在场', down: '倒地', dead: '死亡' };

/** 生成 Markdown 战报，便于贴进文档或聊天记录。 */
export function battleTranscript(battle: Battle): string {
  const lines: string[] = [`# 战斗记录：${battle.name}`, '', `- 建立时间：${battle.createdAt}`];
  if (battle.combat) {
    const current = battle.combat.order[battle.combat.turnIndex];
    const actor = battle.actors.find(x => x.id === current);
    lines.push(`- 进度：第 ${battle.combat.round} 轮${actor ? `，当前行动者 ${actor.name}` : ''}`);
  } else {
    lines.push('- 进度：尚未开始');
  }
  lines.push('', '## 参战单位', '');
  for (const actor of battle.actors) {
    const parts = [`${actor.name}（${actor.side}）`, `AC ${actor.template.armorClass}`, `HP ${actor.currentHp}/${actor.maxHp}`];
    if (actor.combat) {
      parts.push(statusLabels[actor.combat.status] ?? actor.combat.status);
      if (actor.combat.conditions.length > 0) parts.push(`状态：${actor.combat.conditions.join('、')}`);
      if (actor.combat.concentration) parts.push(`专注：${actor.combat.concentration.spell}`);
      if (actor.combat.ongoing && actor.combat.ongoing.length > 0) parts.push(`持续：${actor.combat.ongoing.map(x => x.name).join('、')}`);
    }
    lines.push(`- ${parts.join(' · ')}`);
  }
  const log = battle.combat?.log ?? [];
  lines.push('', '## 战斗日志', '');
  if (log.length === 0) lines.push('（暂无记录）');
  let round = 0;
  for (const entry of log) {
    if (entry.round !== round) {
      round = entry.round;
      lines.push('', `### 第 ${round} 轮`, '');
    }
    lines.push(`- ${entry.text}${entry.detail ? ` —— ${entry.detail}` : ''}`);
  }
  return `${lines.join('\n')}\n`;
}
