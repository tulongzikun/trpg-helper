import type { Battle } from './battle.ts';
import { validateBattle } from './battle.ts';

/** 战斗档案的格式标识，导入时用来拒绝不认识的版本。 */
export const battleExportSchema = 'trpg-helper.battle-export/v1';

export type BattleExport = { schema: string; exportedAt: string; battle: Battle };
/** 把旧版本档案补齐为当前结构：缺失的撤销栈、日志、轮次、行动顺序与单位状态字段会被填成默认值。 */
export function upgradeBattlePayload(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const battle = (record.combat || record.actors ? record : record.battle) as Record<string, unknown> | undefined;
  if (!battle || typeof battle !== 'object') return value;
  const actors = Array.isArray(battle.actors) ? (battle.actors as Record<string, unknown>[]) : [];
  for (const actor of actors) {
    const state = actor.combat as Record<string, unknown> | undefined;
    if (!state || typeof state !== 'object') continue;
    if (!Array.isArray(state.conditions)) state.conditions = [];
    if (state.movementUsed === undefined) state.movementUsed = 0;
    if (state.actionUsed === undefined) state.actionUsed = false;
    if (state.bonusUsed === undefined) state.bonusUsed = false;
    if (state.reactionUsed === undefined) state.reactionUsed = false;
    if (state.status === undefined) state.status = 'active';
  }
  const combat = battle.combat as Record<string, unknown> | undefined;
  if (combat && typeof combat === 'object') {
    if (!Array.isArray(combat.undo)) combat.undo = [];
    if (!Array.isArray(combat.log)) combat.log = [];
    if (!Number.isInteger(combat.round)) combat.round = 1;
    if (!Number.isInteger(combat.turnIndex)) combat.turnIndex = 0;
    if (!Array.isArray(combat.order)) combat.order = actors.map(actor => actor.id).filter((id): id is string => typeof id === 'string');
  }
  return value;
}



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
  const battle = validateBattle(clone(upgradeBattlePayload(battleValue)));
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
  const terrainLabels: Record<string, string> = { underwater: '水下', climbing: '攀爬', ice: '冰面', lava: '岩浆' };
  const field: string[] = [];
  if (battle.grid) field.push(`方格 ${battle.grid.width}×${battle.grid.height}（每格 ${battle.grid.cellFt} 尺）`);
  if (battle.terrain) field.push(`地形：${terrainLabels[battle.terrain] ?? battle.terrain}`);
  if (battle.obscured) field.push(`遮蔽：${battle.obscured === 'heavy' ? '重度' : '轻度'}`);
  if (battle.walls?.length) field.push(`墙体 ${battle.walls.length} 格`);
  if (battle.difficult?.length) field.push(`困难地形 ${battle.difficult.length} 格`);
  if (battle.hazards?.length) field.push(`危险地形 ${battle.hazards.length} 格`);
  if (battle.auras?.length) field.push(`灵光：${battle.auras.map(item => `${item.name}（${item.kind === 'ac' ? 'AC' : '豁免'} +${item.bonus}，半径 ${item.radiusFt} 尺）`).join('、')}`);
  if (field.length) lines.push('', '## 战场', '', ...field.map(item => `- ${item}`));
  lines.push('', '## 参战单位', '');
  for (const actor of battle.actors) {
    const parts = [`${actor.name}（${actor.side}）`, `AC ${actor.template.armorClass}`, `HP ${actor.currentHp}/${actor.maxHp}`];
    if (actor.combat) {
      parts.push(statusLabels[actor.combat.status] ?? actor.combat.status);
      if (actor.combat.conditions.length > 0) parts.push(`状态：${actor.combat.conditions.join('、')}`);
      if (actor.combat.concentration) parts.push(`专注：${actor.combat.concentration.spell}`);
      if (actor.combat.ongoing && actor.combat.ongoing.length > 0) parts.push(`持续：${actor.combat.ongoing.map(x => x.name).join('、')}`);
      parts.push(`资源：动作${actor.combat.actionUsed ? '已用' : '未用'}／附赠${actor.combat.bonusUsed ? '已用' : '未用'}／反应${actor.combat.reactionUsed ? '已用' : '未用'}／移动已用 ${actor.combat.movementUsed ?? 0} 尺`);
      if (actor.combat.spellSlots?.length) parts.push(`法术位：${actor.combat.spellSlots.join('/')}`);
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
