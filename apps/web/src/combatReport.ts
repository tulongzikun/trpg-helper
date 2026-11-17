import type { Battle } from './battle';
import { encounterXp, defeatedActors, encounterReward } from './encounterReward.ts';

const statusLabels: Record<string, string> = { active: '在场', down: '倒地待救', dead: '阵亡' };

/** 把一场战斗渲染成可直接贴进跑团记录的 Markdown。 */
export function battleReport(battle: Battle): string {
  const reward = encounterReward(battle);
  const round = battle.combat ? `第 ${battle.combat.round} 轮` : '尚未开战';
  const current = battle.combat ? battle.actors.find(actor => actor.id === battle.combat?.order[battle.combat?.turnIndex ?? 0]) : undefined;
  const lines: string[] = [];
  lines.push(`# 战斗记录：${battle.name}`);
  lines.push('');
  lines.push(`- 状态：${reward.completed ? '已结束' : `进行中（剩 ${reward.remaining} 个敌方单位）`}`);
  lines.push(`- 进度：${round}${current ? `，当前行动者 ${current.name}` : ''}`);
  lines.push(`- 经验：${encounterXp(battle)} 点，已击败 ${defeatedActors(battle).length} 个单位`);
  lines.push('');
  lines.push('| 单位 | 阵营 | 生命 | 状态 | 条件 | 专注 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const actor of battle.actors) {
    const state = actor.combat?.status ?? 'active';
    const conditions = (actor.combat?.conditions ?? []).join('、') || '—';
    const concentration = actor.combat?.concentration?.spell ?? '—';
    lines.push(`| ${actor.name} | ${actor.side} | ${actor.currentHp}/${actor.maxHp} | ${statusLabels[state] ?? state} | ${conditions} | ${concentration} |`);
  }
  const log = battle.combat?.log ?? [];
  lines.push('');
  lines.push('## 战报');
  lines.push('');
  if (!log.length) lines.push('（暂无记录）');
  for (const entry of log) lines.push(`- ${entry.text}`);
  lines.push('');
  return lines.join('\n');
}

/** 导出战报时用的文件名：带上战斗名并替换掉文件系统不接受的字符。 */
export function reportFileName(battle: Battle): string {
  const safe = battle.name.replace(/[\\/:*?"<>|]/g, '_').trim() || '战斗';
  return `${safe}-战报.md`;
}
