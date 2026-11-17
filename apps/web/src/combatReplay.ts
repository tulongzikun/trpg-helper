import type { Battle } from './battle';

/** 一帧回放：某一步操作之后的局面，以及这一步新增的日志。 */
export type ReplayFrame = {
  /** 从 1 开始；最后一帧是当前局面。 */
  index: number;
  round: number;
  actor: string;
  added: string[];
};

function actorNameOf(battle: Battle): string {
  const combat = battle.combat;
  if (!combat) return '';
  const id = combat.order[combat.turnIndex];
  return battle.actors.find(item => item.id === id)?.name ?? '';
}

/** 按撤销栈给出可回放的步骤：每一步新增的日志文本与该步结束时的轮次与行动者。 */
export function replayFrames(battle: Battle): ReplayFrame[] {
  const undo = battle.combat?.undo ?? [];
  const snapshots = [...undo, battle];
  const frames: ReplayFrame[] = [];
  let previousCount = 0;
  snapshots.forEach((snapshot, position) => {
    const entries = snapshot.combat?.log ?? [];
    const added = entries.slice(previousCount).map(item => item.text);
    previousCount = entries.length;
    frames.push({
      index: position + 1,
      round: snapshot.combat?.round ?? 0,
      actor: actorNameOf(snapshot),
      added,
    });
  });
  return frames;
}

/** 回放摘要（纯文本），用于导出或面板展示。 */
export function replayText(battle: Battle): string {
  const frames = replayFrames(battle);
  if (frames.length <= 1) return '暂无可回放的步骤。';
  return frames
    .map(frame => {
      const head = `第 ${frame.index} 步（第 ${frame.round} 轮${frame.actor ? ` · ${frame.actor}` : ''}）`;
      const body = frame.added.length ? frame.added.join('；') : '（无新增记录）';
      return `${head}：${body}`;
    })
    .join('\n');
}

/** 可回退的步数（撤销栈深度）。 */
export function replayDepth(battle: Battle): number {
  return battle.combat?.undo.length ?? 0;
}
