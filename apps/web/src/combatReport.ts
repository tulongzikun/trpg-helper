import type { Actor, Battle } from './battle';
import { encounterXp, defeatedActors, encounterReward } from './encounterReward.ts';
import { battleStatistics, statsText, typeText } from './combatStats.ts';

const statusLabels: Record<string, string> = { active: '在场', down: '倒地待救', dead: '阵亡' };

/** 战报与导出里的显示状态：阵亡优先，其次撤离、投降，最后才是生命状态。 */
export function statusOf(actor: Actor): string {
  const state = actor.combat;
  if (state?.status === 'dead') return statusLabels.dead;
  if (state?.fled === true) return '已撤离';
  if (state?.surrendered === true) return '已投降';
  const status = state?.status ?? 'active';
  return statusLabels[status] ?? status;
}

/** 单位的伤害防御摘要，例如「抗火焰、免毒素、弱寒冷」；没有时返回空串。 */
export function defenseOf(actor: Actor): string {
  const state = actor.combat;
  const parts = [
    ...(state?.damageResistances ?? []).map(item => `抗${item}`),
    ...(state?.damageImmunities ?? []).map(item => `免${item}`),
    ...(state?.damageVulnerabilities ?? []).map(item => `弱${item}`),
  ];
  return parts.join('、');
}

/** 单位准备动作的摘要，例如「准备「攻击靠近的敌人」（触发：有人进入 5 尺）」。 */
export function readyOf(actor: Actor): string {
  const ready = actor.combat?.ready;
  if (!ready) return '';
  const trigger = ready.trigger ? `（触发：${ready.trigger}）` : '';
  const used = actor.combat?.reactionUsed === true ? '，反应已用' : '';
  return `准备「${ready.action}」${trigger}${used}`;
}

/** 单位身上还在生效的状态，带剩余轮数，例如「祝福（10 轮）」「被藤蔓缠住」。 */
export function effectsOf(actor: Actor): string[] {
  const state = actor.combat;
  if (!state) return [];
  const parts: string[] = [];
  const add = (label: string, rounds?: number) => {
    if (rounds === undefined || rounds === null || rounds <= 0) return;
    parts.push(`${label}（${rounds} 轮）`);
  };
  if (state.sleeping === true) parts.push('沉睡');
  if (state.commanded === 'halt') parts.push('命令：停止');
  if (state.entangled === true) parts.push('被藤蔓缠住');
  if (state.suppressed === true) parts.push('被压制');
  if (state.exhaustion) parts.push(`力竭 ${state.exhaustion} 级（攻击／豁免／检定 -${2 * state.exhaustion}，速度 -${5 * state.exhaustion} 尺）`);
  if (state.aimed === true) parts.push('瞄准');
  if (state.shield) parts.push(`护盾（AC +${state.shield}）`);
  add('祝福', state.blessed);
  add('加速', state.hasted);
  add('隐形', state.invisible);
  add('麻痹', state.paralyzed);
  add('耳聋', state.deafened);
  add('缓慢', state.slowed);
  add('魅惑', state.charmed);
  add('目盲', state.blinded);
  add('恐慌', state.frightened);
  add('变形', state.polymorphed);
  add('树肤', state.barkskin);
  if (state.aided) parts.push(`援助（生命上限 +${state.aided}）`);
  return parts;
}

/** 先攻顺序：按出手次序排列，标出当前行动者与本轮已行动的单位。 */
export function initiativeOrder(battle: Battle): { name: string; initiative: number; current: boolean; acted: boolean }[] {
  const combat = battle.combat;
  if (!combat) return [];
  return combat.order.map((id, index) => {
    const actor = battle.actors.find(item => item.id === id);
    return {
      name: actor?.name ?? id,
      initiative: actor?.combat?.initiative ?? 0,
      current: index === combat.turnIndex,
      acted: index < combat.turnIndex,
    };
  });
}

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
    lines.push(`| ${actor.name} | ${actor.side} | ${actor.currentHp}/${actor.maxHp} | ${statusOf(actor)} | ${conditions} | ${concentration} |`);
  }
  const order = initiativeOrder(battle);
  if (order.length) {
    lines.push('');
    lines.push('## 先攻顺序');
    lines.push('');
    order.forEach((item, index) => {
      const marks = [item.current ? '← 当前行动者' : '', item.acted ? '（已行动）' : ''].filter(Boolean).join(' ');
      lines.push(`${index + 1}. ${item.name}（先攻 ${item.initiative}）${marks ? ` ${marks}` : ''}`);
    });
  }
  const prepared = battle.actors
    .map(actor => ({ actor, text: readyOf(actor) }))
    .filter(item => item.text.length > 0);
  if (prepared.length) {
    lines.push('');
    lines.push('## 准备动作');
    lines.push('');
    for (const item of prepared) lines.push(`- ${item.actor.name}：${item.text}`);
  }
  const guarded = battle.actors
    .map(actor => ({ actor, text: defenseOf(actor) }))
    .filter(item => item.text.length > 0);
  if (guarded.length) {
    lines.push('');
    lines.push('## 防御');
    lines.push('');
    for (const item of guarded) lines.push(`- ${item.actor.name}：${item.text}`);
  }
  const affected = battle.actors
    .map(actor => ({ actor, text: effectsOf(actor).join('、') }))
    .filter(item => item.text.length > 0);
  if (affected.length) {
    lines.push('');
    lines.push('## 状态');
    lines.push('');
    for (const item of affected) lines.push(`- ${item.actor.name}：${item.text}`);
  }
  const stats = battleStatistics(battle);
  const active = stats.rows.filter(row => row.attacks > 0 || row.damageDealt > 0 || row.damageTaken > 0 || row.healing > 0);
  lines.push('');
  lines.push('## 统计');
  lines.push('');
  if (!active.length) {
    lines.push('（暂无攻击记录）');
  } else {
    lines.push('| 单位 | 攻击 | 命中 | 重击 | 造成伤害 | 承受伤害 | 治疗 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const row of active) {
      lines.push(`| ${row.name} | ${row.attacks} | ${row.hits} | ${row.crits} | ${row.damageDealt} | ${row.damageTaken} | ${row.healing} |`);
    }
    lines.push('');
    lines.push(`- ${statsText(battle)}`);
    lines.push(`- ${typeText(battle)}`);
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

/** CSV 单元格：含逗号、引号或换行时用双引号包裹，内部引号翻倍。 */
function csvCell(value: string | number): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function typeSummary(entry: { damageByType?: Record<string, number> }): string {
  const pairs = Object.entries(entry.damageByType ?? {});
  return pairs.length ? pairs.map(([type, amount]) => `${type} ${amount}`).join('；') : '';
}

/** 把统计表导出成 CSV（带 BOM，Excel 直接打开不乱码）。 */
export function battleCsv(battle: Battle): string {
  const stats = battleStatistics(battle);
  const labelOf = new Map(battle.actors.map(actor => [actor.id, statusOf(actor)]));
  const defenseById = new Map(battle.actors.map(actor => [actor.id, defenseOf(actor)]));
  const effectsById = new Map(battle.actors.map(actor => [actor.id, effectsOf(actor).join('；')]));
  const header = ['单位', '阵营', '状态', '攻击', '命中', '重击', '命中率', '造成伤害', '承受伤害', '治疗', '伤害构成', '防御', '状态效果'];
  const rows = stats.rows.map(row => [
    row.name,
    row.side,
    labelOf.get(row.id) ?? statusLabels[row.status] ?? row.status,
    row.attacks,
    row.hits,
    row.crits,
    row.accuracy,
    row.damageDealt,
    row.damageTaken,
    row.healing,
    typeSummary(row),
    defenseById.get(row.id) ?? '',
    effectsById.get(row.id) ?? '',
  ]);
  const totals = [
    '合计',
    '',
    '',
    stats.totals.attacks,
    stats.totals.hits,
    stats.totals.crits,
    stats.totals.attacks === 0 ? 0 : Math.round((stats.totals.hits / stats.totals.attacks) * 100) / 100,
    stats.totals.damageDealt,
    stats.totals.damageTaken,
    stats.totals.healing,
    typeSummary(stats.totals),
    '',
    '',
  ];
  const lines = [header, ...rows, totals].map(cells => cells.map(csvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** 导出 CSV 时用的文件名。 */
export function csvFileName(battle: Battle): string {
  const safe = battle.name.replace(/[\\/:*?"<>|]/g, '_').trim() || '战斗';
  return `${safe}-统计.csv`;
}
