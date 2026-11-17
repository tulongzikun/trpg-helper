import { encounterXp, defeatedActors, encounterReward } from './encounterReward.ts';
import type { Battle } from './battle';

export type ActorSettlement = {
  actorId: string;
  name: string;
  side: string;
  status: string;
  currentHp: number;
  maxHp: number;
  tempHp: number;
  conditions: string[];
  concentration?: string;
  ongoing: number;
  items: { total: number; unidentified: number };
  resources: {
    actionUsed: boolean;
    bonusUsed: boolean;
    reactionUsed: boolean;
    movementUsed: number;
  };
};

export type BattleSettlement = {
  completed: boolean;
  xp: number;
  defeated: number;
  actors: ActorSettlement[];
  notes: string[];
};

/** 把战斗结束时的单位状态整理成可回写角色卡的结构。 */
export function settleBattle(battle: Battle): BattleSettlement {
  const actors: ActorSettlement[] = battle.actors.map(actor => ({
    actorId: actor.id,
    name: actor.name,
    side: actor.side,
    status: actor.combat?.status ?? 'active',
    currentHp: actor.currentHp,
    maxHp: actor.maxHp,
    tempHp: actor.combat?.tempHp ?? 0,
    conditions: [...(actor.combat?.conditions ?? [])],
    ...(actor.combat?.concentration ? { concentration: actor.combat.concentration.spell } : {}),
    ongoing: actor.combat?.ongoing?.length ?? 0,
    items: { total: actor.combat?.items?.length ?? 0, unidentified: (actor.combat?.items ?? []).filter(item => item.identified === false).length },
    resources: {
      actionUsed: actor.combat?.actionUsed ?? false,
      bonusUsed: actor.combat?.bonusUsed ?? false,
      reactionUsed: actor.combat?.reactionUsed ?? false,
      movementUsed: actor.combat?.movementUsed ?? 0,
    },
  }));
  const reward = encounterReward(battle);
  const notes: string[] = [];
  const dead = actors.filter(actor => actor.status === 'dead');
  if (dead.length) notes.push(`阵亡：${dead.map(actor => actor.name).join('、')}。`);
  const down = actors.filter(actor => actor.status === 'down');
  if (down.length) notes.push(`倒地待救：${down.map(actor => actor.name).join('、')}。`);
  const hurt = actors.filter(actor => actor.side !== '敌方' && actor.currentHp < actor.maxHp && actor.status !== 'dead');
  if (hurt.length) notes.push(`需要回血：${hurt.map(actor => `${actor.name} ${actor.currentHp}/${actor.maxHp}`).join('、')}。`);
  if (!reward.completed) notes.push(`战斗尚未结束，仍有 ${reward.remaining} 个敌方单位在场。`);
  return { completed: reward.completed, xp: encounterXp(battle), defeated: defeatedActors(battle).length, actors, notes };
}

/** 便于粘贴回角色卡／战报的多行文本。 */
export function settlementText(battle: Battle): string {
  const summary = settleBattle(battle);
  const lines: string[] = [];
  lines.push(summary.completed ? `战斗结束：共 ${summary.xp} 点经验。` : `战斗进行中：已击败 ${summary.defeated} 个单位，累计 ${summary.xp} 点经验。`);
  for (const actor of summary.actors) {
    const parts = [`${actor.name}（${actor.side}）`, `${actor.currentHp}/${actor.maxHp} HP`];
    if (actor.tempHp) parts.push(`${actor.tempHp} 临时生命`);
    if (actor.items.total) parts.push(`物品 ${actor.items.total} 种${actor.items.unidentified ? `（${actor.items.unidentified} 未鉴定）` : ''}`);
    if (actor.status !== 'active') parts.push(actor.status === 'dead' ? '阵亡' : actor.status === 'down' ? '倒地' : actor.status);
    if (actor.conditions.length) parts.push(actor.conditions.join('、'));
    if (actor.concentration) parts.push(`专注「${actor.concentration}」`);
    if (actor.ongoing) parts.push(`${actor.ongoing} 个持续效果`);
    lines.push(`- ${parts.join(' · ')}`);
  }
  if (summary.notes.length) lines.push('', ...summary.notes.map(note => `※ ${note}`));
  return `${lines.join('\n')}\n`;
}
