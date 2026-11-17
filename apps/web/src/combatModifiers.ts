import type { Actor } from './battle';

export type AttackRange = 'melee' | 'ranged';
export type AttackMode = 'normal' | 'advantage' | 'disadvantage';

export type ModeAdjustment = { mode: AttackMode; notes: string[] };

/** 掩体：半掩体 AC +2、四分之三掩体 AC +5；由攻击方在面板选择。 */
export type CoverType = '无' | '半掩体' | '四分之三掩体';
export const coverTypes: CoverType[] = ['无', '半掩体', '四分之三掩体'];
export function coverAcBonus(cover: CoverType): number {
  return cover === '半掩体' ? 2 : cover === '四分之三掩体' ? 5 : 0;
}
export function coverNote(cover: CoverType): string {
  return cover === '无' ? '' : `目标处于${cover}（AC +${coverAcBonus(cover)}）`;
}

const conditionOf = (actor: Actor, condition: string) => actor.combat?.conditions.includes(condition) ?? false;
const hasAny = (actor: Actor, list: string[]) => list.some(condition => conditionOf(actor, condition));

/** 2024 规则中无法进行动作、附赠动作或反应的状态。 */
export const actionBlockingConditions = ['失能', '麻痹', '昏迷', '石化'] as const;

export function actionBlocker(actor: Actor): string | null {
  const status = actor.combat?.status;
  if (status === 'dead') return '已死亡的单位无法行动。';
  if (status === 'down') return '倒地的单位无法行动。';
  const blocker = actionBlockingConditions.find(condition => conditionOf(actor, condition));
  return blocker ? `处于${blocker}状态，无法进行动作、附赠动作或反应。` : null;
}

const summarize = (advantages: string[], disadvantages: string[]): ModeAdjustment => {
  const notes: string[] = [];
  if (advantages.length) notes.push(`攻击方优势：${advantages.join('、')}`);
  if (disadvantages.length) notes.push(`攻击方劣势：${disadvantages.join('、')}`);
  const mode: AttackMode = advantages.length && !disadvantages.length ? 'advantage'
    : disadvantages.length && !advantages.length ? 'disadvantage'
      : 'normal';
  return { mode, notes };
};

/** 攻击者自身状态带来的检定修正。 */
export function attackerAdjustment(actor: Actor): ModeAdjustment {
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  if (conditionOf(actor, '隐形')) advantages.push('隐形');
  if (conditionOf(actor, '目盲')) disadvantages.push('目盲');
  if (conditionOf(actor, '中毒')) disadvantages.push('中毒');
  if (conditionOf(actor, '恐慌')) disadvantages.push('恐慌（能看到恐惧源）');
  if (conditionOf(actor, '束缚')) disadvantages.push('束缚');
  if (conditionOf(actor, '擒抱')) disadvantages.push('擒抱（目标不是擒抱者）');
  return summarize(advantages, disadvantages);
}

/** 目标状态给攻击者带来的检定修正；倒地按近战／远程区分。 */
export function targetAdjustment(actor: Actor, range: AttackRange): ModeAdjustment {
  const advantages: string[] = [];
  const disadvantages: string[] = [];
  if (conditionOf(actor, '麻痹')) advantages.push('目标麻痹');
  if (conditionOf(actor, '昏迷')) advantages.push('目标昏迷');
  if (conditionOf(actor, '石化')) advantages.push('目标石化');
  if (conditionOf(actor, '束缚')) advantages.push('目标束缚');
  if (conditionOf(actor, '目盲')) advantages.push('目标目盲');
  if (conditionOf(actor, '倒地')) (range === 'melee' ? advantages : disadvantages).push(range === 'melee' ? '目标倒地（近战）' : '目标倒地（远程）');
  if (conditionOf(actor, '隐形')) disadvantages.push('目标隐形');
  return summarize(advantages, disadvantages);
}

/** 把手工选择的检定方式与状态修正合并：优势与劣势同时存在时互相抵消。 */
export function combineAttackModes(explicit: AttackMode, adjustments: ModeAdjustment[]): ModeAdjustment {
  let advantages = 0;
  let disadvantages = 0;
  const notes: string[] = [];
  const bump = (mode: AttackMode) => {
    if (mode === 'advantage') advantages += 1;
    if (mode === 'disadvantage') disadvantages += 1;
  };
  bump(explicit);
  if (explicit !== 'normal') notes.push(`手工指定${explicit === 'advantage' ? '优势' : '劣势'}`);
  for (const adjustment of adjustments) {
    bump(adjustment.mode);
    notes.push(...adjustment.notes);
  }
  if (advantages && disadvantages) {
    notes.push('优势与劣势相互抵消，按正常检定。');
    return { mode: 'normal', notes };
  }
  return { mode: advantages ? 'advantage' : disadvantages ? 'disadvantage' : 'normal', notes };
}

/** 对麻痹或昏迷目标、在 5 尺内用近战攻击命中即重击。 */
export function isAutomaticCritical(target: Actor, range: AttackRange, distanceFt: number): boolean {
  if (range !== 'melee' || distanceFt > 5) return false;
  return hasAny(target, ['麻痹', '昏迷']);
}

const sheetOf = (actor: Actor) => actor.characterSnapshot?.sheet;
const classOf = (actor: Actor): string => {
  const sheet = sheetOf(actor);
  return sheet?.characterClass ?? sheet?.details?.fighterCalculator?.characterClass ?? '';
};

/** 一次“攻击动作”能打出的攻击次数（含额外攻击）。 */
export function attacksPerAction(actor: Actor): number {
  const sheet = sheetOf(actor);
  if (!sheet) return 1;
  const level = sheet.level;
  const subclass = sheet.details?.fighterCalculator?.subclass ?? '';
  if (classOf(actor) === '战士') return level >= 20 ? 4 : level >= 11 ? 3 : level >= 5 ? 2 : 1;
  if (['野蛮人', '武僧', '圣武士', '游侠'].includes(classOf(actor))) return level >= 5 ? 2 : 1;
  if (classOf(actor) === '吟游诗人' && subclass === 'valor' && level >= 6) return 2;
  return 1;
}

/** 动作如潮次数：战士 2 级 1 次、17 级 2 次，短休或长休恢复。 */
export function actionSurgeMax(actor: Actor): number {
  const sheet = sheetOf(actor);
  if (!sheet || classOf(actor) !== '战士') return 0;
  return sheet.level >= 17 ? 2 : sheet.level >= 2 ? 1 : 0;
}

/** 回气：战士 1 级起可用，附赠动作恢复 1d10 + 战士等级，短休或长休恢复。 */
/** 反射闪避：游荡者／武僧 7 级起，敏捷豁免成功时完全不受范围伤害。 */
export function hasEvasion(actor: Actor): boolean {
  const sheet = sheetOf(actor);
  if (!sheet) return false;
  const cls = classOf(actor);
  return (cls === '游荡者' || cls === '武僧') && sheet.level >= 7;
}

export function hasSecondWind(actor: Actor): boolean {
  const sheet = sheetOf(actor);
  return !!sheet && classOf(actor) === '战士' && sheet.level >= 1;
}
