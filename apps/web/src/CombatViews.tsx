import { Fragment, useEffect, useState } from 'react';
import type { Actor, Battle, DamageType, GridConfig, Obscured, Position, Side, Terrain } from './battle';
import { damageTypes } from './battle';
import type { AttackCost, AttackMode, AttackOptions, AreaSaveOptions, AuraInput, CheckOptions, SaveOptions, OngoingInput, AttackPresetInput } from './combat';
import { actorDistance, actorInitiativeBonus, actorLabel, actorSpeed, aurasOf, availableTargets, combatantSummary, conditions, currentActor, currentActorId, pendingOpportunities, summonsOf } from './combat';
import { attackSources, originLabels } from './attackSources';
import { expectedDamage, hitChanceLabel } from './combatProbability';
import type { AttackSuggestion } from './combatAi';
import { suggestAttacks } from './combatAi';
import { actionSurgeMax, attacksPerAction, coverTypes, hasCunningAction, hasRecklessAttack, hasSecondWind } from './combatModifiers';
import { battleTranscript, exportBattle } from './battleTransfer';
import type { AttackRange, CoverType } from './combatModifiers';
import type { Ability } from './characters';
import type { Card } from './catalog';
import { fallAverageDamage, jumpDistance } from './combatMovement';
import type { SpellCastOptions } from './combatSpells';
import { filterLog, logRounds } from './combatLog';
import { replayFrames } from './combatReplay';
import { spellAreaTargets } from './combatSpells';
import { settlementText } from './combatSettlement';

const abilityNames: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

export type CombatHandlers = {
  onStart: (initiatives: Record<string, number>) => void;
  onEndTurn: () => void;
  onTerrain: (terrain: Terrain) => void;
  onAutoDeathSaves: (enabled: boolean) => void;
  onEnterReachOpportunity: (enabled: boolean) => void;
  onObscured: (level: 'none' | 'light' | 'heavy') => void;
  onLongRest: () => void;
  onExhaustion: (actorId: string, level: number) => void;
  onElevation: (actorId: string, feet: number) => void;
  onDualWielder: (actorId: string, enabled: boolean) => void;
  onSentinel: (actorId: string, enabled: boolean) => void;
  onDelay: (actorId: string) => void;
  onFlying: (actorId: string, enabled: boolean) => void;
  onDefensiveDuelist: (actorId: string, enabled: boolean) => void;
  onWarCaster: (actorId: string, enabled: boolean) => void;
  onSetCounterspell: (actorId: string, enabled: boolean) => void;
  onCounterspell: (reactorId: string) => void;
  onResolveCast: () => void;
  onSavePreset: (input: AttackPresetInput) => void;
  onUsePreset: (presetId: string) => void;
  onRemovePreset: (presetId: string) => void;
  onParry: (actorId: string) => void;
  onInitiative: (actorId: string, initiative: number) => void;
  onRerollInitiative: () => void;
  onCheck: (options: CheckOptions) => void;
  onStudy: (targetId: string) => void;
  onHeal: (targetId: string, amount: number) => void;
  onStabilize: (targetId: string) => void;
  onUndo: () => void;
  onReset: () => void;
  onAttack: (options: AttackOptions) => void;
  onAttackSequence: (options: AttackOptions) => void;
  onOffhand: (options: AttackOptions) => void;
  onButtEnd: (options: AttackOptions) => void;
  onDive: (options: AttackOptions) => void;
  onGrapple: (targetId: string) => void;
  onShove: (targetId: string, effect: 'prone' | 'push') => void;
  onEscapeGrapple: (actorId: string) => void;
  onAuto: (actorId: string) => void;
  onAutoTurn: (actorId: string) => void;
  onAutoSide: (side: Side) => void;
  onFall: (actorId: string, feet: number) => void;
  onCast: (options: SpellCastOptions) => void;
  onSetSlots: (actorId: string, slots: number[]) => void;
  onSave: (options: SaveOptions) => void;
  onAreaSave: (options: AreaSaveOptions) => void;
  onConcentration: (actorId: string, spell: string | null) => void;
  onAddOngoing: (targetId: string, input: OngoingInput) => void;
  onRemoveOngoing: (targetId: string, effectId: string) => void;
  onSummon: (actorId: string, ownerId: string, spell: string, rounds?: number) => void;
  onDismissSummon: (actorId: string) => void;
  onReloadAmmo: (actorId: string) => void;
  onAura: (input: AuraInput) => void;
  onRemoveAura: (auraId: string) => void;
  onGrid: (grid: GridConfig | null) => void;
  onPlace: (actorId: string, x: number, y: number) => void;
  onJump: (actorId: string, x: number, y: number) => void;
  onHazard: (x: number, y: number, damageExpression: string, damageType: DamageType) => void;
  onDifficult: (x: number, y: number) => void;
  onWall: (x: number, y: number) => void;
  onDisengage: (actorId: string) => void;
  onDodge: (actorId: string) => void;
  onDash: (actorId: string) => void;
  onHide: (actorId: string) => void;
  onPotion: (actorId: string) => void;
  onCunning: (kind: 'dash' | 'disengage' | 'hide') => void;
  onReckless: (actorId: string) => void;
  onHelp: (helperId: string, targetId: string) => void;
  onProtect: (protectorId: string, targetId: string) => void;
  onAddItem: (actorId: string, name: string, quantity: number, healExpression: string, identified: boolean) => void;
  onIdentify: (actorId: string, name: string) => void;
  onUseItem: (actorId: string, name: string, targetId?: string) => void;
  onLoot: (looterId: string, targetId: string) => void;
  onGive: (fromId: string, toId: string, name: string) => void;
  onStand: (actorId: string) => void;
  onReady: (actorId: string, input: { action: string; trigger: string }) => void;
  onTriggerReady: (actorId: string) => void;
  onCancelReady: (actorId: string) => void;
  onOpportunity: (reactorId: string) => void;
  onDeclineOpportunity: (reactorId: string) => void;
  onReadyPrompt: (reactorId: string) => void;
  onActionSurge: (actorId: string) => void;
  onSecondWind: (actorId: string) => void;
  onDeathSave: (actorId: string) => void;
  onCondition: (actorId: string, condition: string) => void;
  onMove: (actorId: string, feet: number) => void;
  onSpend: (actorId: string, kind: AttackCost) => void;
  onTempHp: (actorId: string, tempHp: number) => void;
};

const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`;
const sideClass = (side: Actor['side']) => side === '敌方' ? 'enemy' : side === '友方' ? 'ally' : 'neutral';

export function CombatSetup({ battle, onStart }: { battle: Battle; onStart: (initiatives: Record<string, number>) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const submit = () => {
    const initiatives: Record<string, number> = {};
    for (const [id, value] of Object.entries(values)) {
      if (value.trim() === '') continue;
      const parsed = Number(value);
      if (!Number.isInteger(parsed)) return;
      initiatives[id] = parsed;
    }
    onStart(initiatives);
  };
  return <section className="cmb-setup">
    <div className="cmb-panel-head">
      <div><div className="section-label">ROLL FOR INITIATIVE</div><h3>投掷先攻</h3></div>
      <button className="button-primary" type="button" onClick={submit}>开始战斗</button>
    </div>
    <p className="cmb-hint">留空则自动投掷 d20 + 先攻加值；也可以先手工掷骰再填入。开始后不能再添加单位，可随时重置。</p>
    <div className="cmb-setup-list">
      {battle.actors.map(actor => <label className="cmb-setup-row" key={actor.id}>
        <span className={`side-dot ${sideClass(actor.side)}`} aria-hidden="true" />
        <span className="cmb-setup-name">{actor.name}<small>{actor.side} · 先攻 {signed(actorInitiativeBonus(actor))} · HP {actor.currentHp}/{actor.maxHp}</small></span>
        <input type="number" min={-20} max={60} step={1} placeholder="自动" aria-label={`${actor.name} 的先攻`} value={values[actor.id] ?? ''} onChange={event => setValues({ ...values, [actor.id]: event.target.value })} />
      </label>)}
    </div>
  </section>;
}

export function CombatToolbar({ battle, onEndTurn, onUndo, onReset, onTerrain, onAutoDeathSaves, onEnterReachOpportunity, onObscured, onLongRest }: { battle: Battle; onEndTurn: () => void; onUndo: () => void; onReset: () => void; onTerrain?: (terrain: Terrain) => void; onAutoDeathSaves?: (enabled: boolean) => void; onEnterReachOpportunity?: (enabled: boolean) => void; onObscured?: (level: 'none' | 'light' | 'heavy') => void; onLongRest?: () => void }) {
  const combat = battle.combat;
  if (!combat) return null;
  const current = currentActor(battle);
  return <div className="cmb-toolbar">
    <div className="cmb-toolbar-info"><strong>第 {combat.round} 轮</strong><span>{current ? `当前：${current.name}` : '等待行动'}</span></div>
    <div className="cmb-toolbar-actions">
      <button className="button-primary" type="button" onClick={onEndTurn}>结束回合</button>
      <button className="button-secondary" type="button" onClick={onUndo} disabled={!combat.undo.length}>撤销上一步</button>
      <button className="button-secondary" type="button" onClick={onReset} title="清除先攻与回合记录；生命值不会恢复">重置战斗</button>
      {onEnterReachOpportunity ? <label className="cmb-check"><input type="checkbox" checked={battle.enterReachOpportunity === true} onChange={event => onEnterReachOpportunity(event.target.checked)} aria-label="长武器进入触及时借机" />长武器进入触及时借机</label> : null}
      {onAutoDeathSaves ? <label className="cmb-check"><input type="checkbox" checked={battle.autoDeathSaves === true} onChange={event => onAutoDeathSaves(event.target.checked)} aria-label="回合开始自动掷死亡豁免" />回合开始自动掷死亡豁免</label> : null}
      {onLongRest ? <button className="button-secondary" type="button" onClick={onLongRest} title="恢复法术位、动作如潮、回气与弹药；生命值不变">长休恢复</button> : null}
      {onObscured ? <label className="cmb-inline-action">遮蔽<select value={battle.obscured ?? 'none'} onChange={event => onObscured(event.target.value as 'none' | 'light' | 'heavy')} aria-label="战场遮蔽"><option value="none">明亮</option><option value="light">轻度</option><option value="heavy">重度</option></select></label> : null}
      {onTerrain ? <label className="cmb-inline-action">地形<select value={battle.terrain ?? 'normal'} onChange={event => onTerrain(event.target.value as Terrain)} aria-label="战场地形"><option value="normal">普通</option><option value="underwater">水下</option><option value="climbing">攀爬</option><option value="ice">冰面</option><option value="lava">岩浆</option></select></label> : null}
    </div>
  </div>;
}

export function InitiativeRail({ battle, onInitiative, onReroll }: { battle: Battle; onInitiative?: (actorId: string, initiative: number) => void; onReroll?: () => void }) {
  const combat = battle.combat;
  if (!combat) return null;
  const current = currentActorId(battle);
  return <section className="cmb-rail">
    <div className="cmb-rail-head"><div className="section-label">INITIATIVE ORDER</div><span>第 {combat.round} 轮</span></div>
    {onReroll ? <button type="button" className="button-secondary cmb-reroll" onClick={onReroll} aria-label="重掷先攻" title="为所有在场单位重掷 d20 + 先攻加值，并按新顺序重排">重掷先攻</button> : null}
    <ol>
      {combat.order.map(id => {
        const actor = battle.actors.find(item => item.id === id);
        if (!actor) return null;
        const active = id === current;
        return <li className={`cmb-turn${active ? ' active' : ''}${actor.combat?.status === 'dead' ? ' dead' : ''}`} key={id}>
          {onInitiative
            ? <input className="cmb-init-input" type="number" min={-20} max={60} defaultValue={actor.combat?.initiative ?? 0} aria-label={`${actorLabel(battle, actor)} 先攻`} onBlur={event => { const value = Number(event.target.value); if (Number.isInteger(value)) onInitiative(actor.id, value); }} />
            : <span className="cmb-init">{actor.combat?.initiative ?? '—'}</span>}
          <div className="cmb-turn-body"><strong>{actorLabel(battle, actor)}</strong><small>{actor.side} · HP {actor.currentHp}/{actor.maxHp} · {combatantSummary(actor)}</small></div>
          {active && <em>当前</em>}
        </li>;
      })}
    </ol>
    <p className="cmb-hint">先攻相同按敏捷调整值、再按名称排序。</p>
  </section>;
}

export function TurnPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const [suggestion, setSuggestion] = useState<AttackSuggestion | null>(null);
  const actor = currentActor(battle);
  if (!actor || !actor.combat) return null;
  const state = actor.combat;
  if (state.status === 'dead') {
    return <section className="cmb-panel"><h3>{actor.name} 已死亡</h3><p className="cmb-hint">该单位不再参与先攻顺序。</p><button className="button-secondary" type="button" onClick={handlers.onEndTurn}>结束回合</button></section>;
  }
  if (state.status === 'down') {
    const stable = state.deathSaves.successes >= 3;
    return <section className="cmb-panel">
      <div className="cmb-panel-head"><div><div className="section-label">DEATH SAVES</div><h3>{actor.name} 倒地</h3></div><button className="button-secondary" type="button" onClick={handlers.onEndTurn}>结束回合</button></div>
      <p className="cmb-hint">{stable ? '该角色已稳定，不再需要死亡豁免；受到伤害或治疗会改变状态。' : '在 0 点生命值时，回合开始阶段掷死亡豁免：10 以上成功，1 记两次失败，20 立即以 1 点生命苏醒。'}</p>
      <div className="cmb-death"><span>成功 {state.deathSaves.successes}/3</span><span>失败 {state.deathSaves.failures}/3</span>{!stable && <button className="button-primary" type="button" onClick={() => handlers.onDeathSave(actor.id)}>投死亡豁免</button>}</div>
    </section>;
  }
  return <section className="cmb-panel">
    <div className="cmb-panel-head">
      <div><div className="section-label">CURRENT TURN</div><h3>{actorLabel(battle, actor)}</h3></div>
      <button className="button-secondary" type="button" onClick={handlers.onEndTurn}>结束回合</button>
    </div>
    <div className="cmb-resources">
      <Resource label="动作" used={state.actionUsed} onClick={() => handlers.onSpend(actor.id, 'action')} />
      <Resource label="附赠动作" used={state.bonusUsed} onClick={() => handlers.onSpend(actor.id, 'bonus')} />
      <Resource label="反应" used={state.reactionUsed} onClick={() => handlers.onSpend(actor.id, 'reaction')} />
      <Movement actor={actor} used={state.movementUsed} onMove={feet => handlers.onMove(actor.id, feet)} />
    </div>
    <div className="cmb-area-actions">
      <button type="button" className="button-secondary" disabled={state.actionUsed || state.disengaged} onClick={() => handlers.onDisengage(actor.id)}>{state.disengaged ? '本回合已撤离' : '撤离（消耗动作，本回合移动不引发借机攻击）'}</button>
      <button type="button" className="button-secondary" onClick={() => handlers.onDelay(actor.id)} aria-label="延迟行动" title="把本回合挪到本轮最后，让下一位先行动">延迟行动</button>
        <button type="button" className="button-secondary" disabled={state.actionUsed || state.dodging === true} onClick={() => handlers.onDodge(actor.id)}>{state.dodging ? '正在闪避' : '闪避（消耗动作，下回合前针对它的攻击劣势）'}</button>
      <button type="button" className="button-secondary" disabled={state.actionUsed} onClick={() => handlers.onDash(actor.id)}>疾跑（消耗动作，本回合移动力 +{actorSpeed(actor)} 尺）</button>
      <button type="button" className="button-secondary" disabled={state.actionUsed || state.hidden === true} onClick={() => handlers.onHide(actor.id)}>{state.hidden ? '躲藏中' : '躲藏（消耗动作，敏捷隐匿对抗被动察觉）'}</button>
      <button type="button" className="button-secondary" disabled={state.actionUsed} onClick={() => handlers.onPotion(actor.id)}>使用治疗药水（2d4+2）</button>
      <button type="button" className="button-secondary" onClick={() => handlers.onAuto(actor.id)}>自动行动（攻击或靠近）</button>
      {hasRecklessAttack(actor) ? (
        <button type="button" className="button-secondary" disabled={state.reckless === true} onClick={() => handlers.onReckless(actor.id)}>{state.reckless ? '鲁莽攻击中' : '鲁莽攻击（本回合攻击优势，敌人也对你优势）'}</button>
      ) : null}
      {hasCunningAction(actor) ? (
        <>
          <button type="button" className="button-secondary" disabled={state.bonusUsed === true} onClick={() => handlers.onCunning('dash')}>灵巧疾跑（附赠动作）</button>
          <button type="button" className="button-secondary" disabled={state.bonusUsed === true} onClick={() => handlers.onCunning('disengage')}>灵巧撤离（附赠动作）</button>
          <button type="button" className="button-secondary" disabled={state.bonusUsed === true} onClick={() => handlers.onCunning('hide')}>灵巧躲藏（附赠动作）</button>
        </>
      ) : null}
      <button type="button" className="button-secondary" onClick={() => handlers.onAutoTurn(actor.id)}>自动回合（行动后结束）</button>
      <button type="button" className="button-secondary" onClick={() => handlers.onAutoSide(actor.side)}>本阵营整轮自动</button>
    </div>
    <SpellPanel key={`spell-${actor.id}`} battle={battle} actor={actor} onCast={handlers.onCast} onSetSlots={handlers.onSetSlots} />
    <FallPanel actor={actor} onFall={handlers.onFall} />
    <ClassActions actor={actor} onSurge={() => handlers.onActionSurge(actor.id)} onSecondWind={() => handlers.onSecondWind(actor.id)} />
    <ReadyPanel key={`ready-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <AiPanel key={`ai-${actor.id}`} battle={battle} actor={actor} onApply={setSuggestion} />
    <AttackForm key={actor.id} battle={battle} attacker={actor} suggestion={suggestion} onAttack={handlers.onAttack} onAttackSequence={handlers.onAttackSequence} onOffhand={handlers.onOffhand} onButtEnd={handlers.onButtEnd} onDive={handlers.onDive} onReloadAmmo={handlers.onReloadAmmo} />
        <GrapplePanel key={`grapple-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    {actor.combat?.conditions.includes('擒抱') ? <div className="cmb-attack-actions"><span className="cmb-hint">被擒抱：可用一个动作挣脱（力量／敏捷对抗擒抱者的豁免 DC）。</span><button className="button-secondary" type="button" onClick={() => handlers.onEscapeGrapple(actor.id)} aria-label="挣脱擒抱">挣脱擒抱</button></div> : null}
    <AreaEffectForm key={`area-${actor.id}`} battle={battle} onSave={handlers.onSave} onAreaSave={handlers.onAreaSave} />
    <OngoingPanel key={`ongoing-${actor.id}`} battle={battle} handlers={handlers} />
    <SummonPanel key={`summon-${actor.id}`} battle={battle} handlers={handlers} />
    <AuraPanel key={`aura-${actor.id}`} battle={battle} handlers={handlers} />
    <HelpPanel key={`help-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <ProtectionPanel key={`protect-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <ItemPanel key={`item-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
            <CounterspellPanel key={`counter-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <CheckPanel key={`check-${actor.id}`} actor={actor} handlers={handlers} />
    <HealPanel key={`heal-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <StudyPanel key={`study-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <AttackPresetPanel key={`preset-${actor.id}`} battle={battle} actor={actor} handlers={handlers} />
    <OpportunityPanel key={`opportunity-${actor.id}`} battle={battle} handlers={handlers} />
    <div className="cmb-extras">
      <ConditionPicker actor={actor} onChange={condition => handlers.onCondition(actor.id, condition)} />
              {actor.combat?.conditions.includes('倒地') && <button type="button" className="button-secondary" onClick={() => handlers.onStand(actor.id)}>起身（消耗一半移动力）</button>}
      <label className="cmb-check"><input type="checkbox" checked={state.defensiveDuelist === true} onChange={event => handlers.onDefensiveDuelist(actor.id, event.target.checked)} aria-label="防守决斗" title="用反应让自己 AC 加上熟练加值" />防守决斗</label>
      <label className="cmb-check"><input type="checkbox" checked={state.warCaster === true} onChange={event => handlers.onWarCaster(actor.id, event.target.checked)} aria-label="战地施法者" />战地施法者（专注检定优势）</label>
      {state.defensiveDuelist === true ? <button type="button" className="button-secondary" disabled={state.reactionUsed} onClick={() => handlers.onParry(actor.id)} aria-label="格挡">格挡（反应，AC +{state.parryBonus ?? '熟练'}）</button> : null}
      <label className="cmb-check"><input type="checkbox" checked={state.dualWielder === true} onChange={event => handlers.onDualWielder(actor.id, event.target.checked)} aria-label="双持战斗者" title="AC +1，副手攻击可用非轻型武器" />双持战斗者（AC +1，副手可用非轻型）</label>
      <label className="cmb-check"><input type="checkbox" checked={state.sentinel === true} onChange={event => handlers.onSentinel(actor.id, event.target.checked)} aria-label="哨兵" title="长武器命中使目标本回合移动力清零；邻近敌人攻击他人时可花反应反击" />哨兵（长武器减速、可反击）</label>
      <label className="cmb-check"><input type="checkbox" checked={state.flying === true} onChange={event => handlers.onFlying(actor.id, event.target.checked)} aria-label="飞行" title="飞行时移动忽略地形消耗与危险地形伤害" />飞行</label>
      <label className="cmb-temp">力竭<input key={`ex-${state.exhaustion ?? 0}`} type="number" min={0} max={6} step={1} defaultValue={state.exhaustion ?? 0} aria-label="力竭等级" title="每级：攻击、豁免、属性检定 -2，速度 -5 尺" onBlur={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 6) handlers.onExhaustion(actor.id, value); }} /></label>
      <label className="cmb-temp">高度<input key={`el-${actor.elevation ?? 0}`} type="number" min={0} max={500} step={5} defaultValue={actor.elevation ?? 0} aria-label="高度（尺）" title="高空射击 10 尺以上有优势，仰射高空目标有劣势" onBlur={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= 500) handlers.onElevation(actor.id, value); }} /></label>
      <label className="cmb-temp">临时生命<input key={state.tempHp} type="number" min={0} step={1} defaultValue={state.tempHp} aria-label="临时生命值" onBlur={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0) handlers.onTempHp(actor.id, value); }} /></label>
    </div>
    {state.conditions.length > 0 && <div className="cmb-conditions">{state.conditions.map(condition => <span key={condition}>{condition}</span>)}</div>}
  </section>;
}

function Resource({ label, used, onClick }: { label: string; used: boolean; onClick: () => void }) {
  return <button type="button" className={`cmb-resource${used ? ' used' : ''}`} onClick={onClick} disabled={used} aria-pressed={used}>
    <strong>{label}</strong><small>{used ? '已使用' : '可用'}</small>
  </button>;
}

function ClassActions({ actor, onSurge, onSecondWind }: { actor: Actor; onSurge: () => void; onSecondWind: () => void }) {
  const state = actor.combat;
  if (!state) return null;
  const surgeMax = actionSurgeMax(actor);
  const surgeUsed = state.actionSurgeUsed ?? 0;
  const secondWind = hasSecondWind(actor);
  if (!surgeMax && !secondWind) return null;
  return <div className="cmb-class-actions">
    {surgeMax > 0 && <button type="button" className="button-secondary" disabled={surgeUsed >= surgeMax} onClick={onSurge} title="战士：本场战斗额外获得一个动作，短休或长休恢复">动作如潮 {surgeUsed}/{surgeMax}</button>}
    {secondWind && <button type="button" className="button-secondary" disabled={state.secondWindUsed === true || state.bonusUsed} onClick={onSecondWind} title="战士：附赠动作恢复 1d10 + 战士等级，短休或长休恢复">回气{state.secondWindUsed ? '（已用）' : ''}</button>}
  </div>;
}

function Movement({ actor, used, onMove }: { actor: Actor; used: number; onMove: (feet: number) => void }) {
  const speed = actorSpeed(actor);
  const remaining = Math.max(0, speed - used);
  const [value, setValue] = useState('');
  return <label className="cmb-move">移动<small>{remaining}/{speed} 尺</small><div><input type="number" min={0} max={remaining} step={5} aria-label="移动距离（尺）" value={value} onChange={event => setValue(event.target.value)} /><button type="button" disabled={remaining <= 0} onClick={() => { const feet = Number(value); if (!Number.isInteger(feet) || feet < 0 || feet > remaining) return; onMove(feet); setValue(''); }}>移动</button></div></label>;
}

function ConditionPicker({ actor, onChange }: { actor: Actor; onChange: (condition: string) => void }) {
  const [value, setValue] = useState('');
  return <label className="cmb-condition">状态
    <select value={value} aria-label="添加状态" onChange={event => setValue(event.target.value)}>
      <option value="">选择状态</option>
      {conditions.filter(condition => !actor.combat?.conditions.includes(condition)).map(condition => <option key={condition} value={condition}>{condition}</option>)}
    </select>
    <button type="button" disabled={!value} onClick={() => { onChange(value); setValue(''); }}>添加</button>
  </label>;
}

export function GridPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const [width, setWidth] = useState('12');
  const [height, setHeight] = useState('12');
  const [selected, setSelected] = useState('');
  const [mode, setMode] = useState<'move' | 'terrain' | 'wall' | 'hazard'>('move');
  const [message, setMessage] = useState('');
  const [hazardDice, setHazardDice] = useState('1d6');
  const [hazardType, setHazardType] = useState<DamageType>('火焰');
  const [jumpMode, setJumpMode] = useState(false);
  const grid = battle.grid;
  const current = currentActorId(battle);
  if (!grid) {
    return <div className="cmb-grid-panel">
      <div className="cmb-attack-head"><h4>方格战场</h4><small>可选</small></div>
      <p className="cmb-hint">启用后可以把单位放到格子上，攻击会自动按格子计算距离；近战超出触及会被拒绝。未放置的单位仍按手工填写的距离结算。</p>
      <form className="cmb-attack-grid" onSubmit={event => {
        event.preventDefault();
        const w = Number(width), h = Number(height);
        if (!Number.isInteger(w) || w < 1 || w > 60 || !Number.isInteger(h) || h < 1 || h > 60) { setMessage('宽高须为 1 至 60 的整数。'); return; }
        setMessage('');
        handlers.onGrid({ width: w, height: h, cellFt: 5 });
      }}>
        <label>宽（格）<input type="number" min={1} max={60} value={width} onChange={event => setWidth(event.target.value)} aria-label="方格宽度" /></label>
        <label>高（格）<input type="number" min={1} max={60} value={height} onChange={event => setHeight(event.target.value)} aria-label="方格高度" /></label>
        <label className="cmb-inline-action"><button className="button-secondary" type="submit">启用方格（每格 5 尺）</button></label>
      </form>
      {message && <p role="alert" className="battle-error">{message}</p>}
    </div>;
  }
  const placed = new Map<string, Actor>();
  for (const actor of battle.actors) if (actor.position) placed.set(`${actor.position.x},${actor.position.y}`, actor);
  const unplaced = battle.actors.filter(actor => !actor.position && actor.combat?.status !== 'dead');
  const selectedActor = battle.actors.find(actor => actor.id === selected);
  const click = (x: number, y: number) => {
    if (mode === 'terrain') {
      setMessage('');
      handlers.onDifficult(x, y);
      return;
    }
    if (mode === 'wall') {
      setMessage('');
      handlers.onWall(x, y);
      return;
    }
    if (mode === 'hazard') {
      setMessage('');
      if (!/^\\s*\\d{1,2}\\s*d\\s*\\d{1,3}\\s*([+-]\\s*\\d{1,3})?\\s*$/i.test(hazardDice)) { setMessage('伤害骰格式无效，请使用如 1d6 的写法。'); return; }
      handlers.onHazard(x, y, hazardDice.trim(), hazardType);
      return;
    }
    const occupant = placed.get(`${x},${y}`);
    if (occupant) { setSelected(occupant.id); setMessage(''); return; }
    if (!selected) { setMessage('先选择一个单位，再点击目标格。'); return; }
    setMessage('');
    if (jumpMode) handlers.onJump(selected, x, y);
    else handlers.onPlace(selected, x, y);
  };
  const rows = Array.from({ length: grid.height }, (_, y) => y);
  const columns = Array.from({ length: grid.width }, (_, x) => x);
  const rough = new Set((battle.difficult ?? []).map(cell => `${cell.x},${cell.y}`));
  const walls = new Set((battle.walls ?? []).map(cell => `${cell.x},${cell.y}`));
  const hazards = new Set((battle.hazards ?? []).map(cell => `${cell.x},${cell.y}`));
  const distances = current
    ? battle.actors.filter(actor => actor.position && actor.id !== current).map(actor => {
      const feet = actorDistance(battle, current, actor.id);
      return { id: actor.id, label: `${actor.name}：${feet ?? '—'} 尺` };
    })
    : [];
  return <div className="cmb-grid-panel">
    <div className="cmb-attack-head"><h4>方格战场</h4><small>{grid.width}×{grid.height} · 每格 {grid.cellFt} 尺</small></div>
    <p className="cmb-hint">点击格子上的单位选中它，再点击空白的格子放置或移动。{mode === 'terrain' ? '地形模式：点击格子切换困难地形（进入时移动消耗翻倍）。' : mode === 'wall' ? '墙体模式：点击格子切换墙体（阻挡移动与远程视线）。' : mode === 'hazard' ? `危险地形模式：点击格子切换危险地形（进入即受到 ${hazardDice} ${hazardType}伤害）。` : ''}{selectedActor ? `当前选中：${selectedActor.name}${selectedActor.position ? `（${selectedActor.position.x}, ${selectedActor.position.y}）` : '（未放置）'}` : '尚未选中单位。'}</p>
    {unplaced.length ? <div className="cmb-ongoing-list">{unplaced.map(actor => <button key={actor.id} type="button" className="cmb-chip cmb-chip-action" onClick={() => setSelected(actor.id)}>{actor.name}（未放置）</button>)}</div> : null}
    <div className="cmb-grid" style={{ gridTemplateColumns: `repeat(${grid.width}, 2.4rem)` }}>
      {rows.map(y => columns.map(x => {
        const occupant = placed.get(`${x},${y}`);
        const difficult = rough.has(`${x},${y}`);
        const wall = walls.has(`${x},${y}`);
        const hazard = hazards.has(`${x},${y}`);
        return <button key={`${x}-${y}`} type="button" className={`cmb-cell${occupant ? ` occupied ${occupant.side === '敌方' ? 'enemy' : occupant.side === '友方' ? 'ally' : 'neutral'}` : ''}${selected === occupant?.id ? ' selected' : ''}${difficult ? ' difficult' : ''}${wall ? ' wall' : ''}${hazard ? ' hazard' : ''}${mode !== 'move' ? ' terrain-edit' : ''}`} title={`(${x}, ${y})${occupant ? ` ${occupant.name}` : ''}${difficult ? ' 困难地形' : ''}${wall ? ' 墙体' : ''}${hazard ? ' 危险地形' : ''}`} aria-label={`格子 ${x},${y}${occupant ? `，${occupant.name}` : ''}${difficult ? '，困难地形' : ''}${wall ? '，墙体' : ''}${hazard ? '，危险地形' : ''}`} onClick={() => click(x, y)}>{wall ? '' : occupant ? occupant.name.slice(0, 1) : ''}</button>;
      }))}
    </div>
    {distances.length ? <p className="cmb-hint">当前行动者距离：{distances.map(item => <span key={item.id} className="cmb-muted">{item.label}　</span>)}</p> : null}
    {message && <p role="alert" className="battle-error">{message}</p>}
    <div className="cmb-area-actions">
      <button type="button" className={mode === 'move' ? 'button-primary' : 'button-secondary'} aria-pressed={mode === 'move'} onClick={() => setMode('move')}>移动模式</button>
      <button type="button" className={mode === 'terrain' ? 'button-primary' : 'button-secondary'} aria-pressed={mode === 'terrain'} onClick={() => setMode('terrain')}>标记困难地形</button>
      <button type="button" className={mode === 'wall' ? 'button-primary' : 'button-secondary'} aria-pressed={mode === 'wall'} onClick={() => setMode('wall')}>标记墙体</button>
      <button type="button" className={mode === 'hazard' ? 'button-primary' : 'button-secondary'} aria-pressed={mode === 'hazard'} onClick={() => setMode('hazard')}>标记危险地形</button>
      <label className="cmb-check"><input type="checkbox" checked={jumpMode} onChange={event => setJumpMode(event.target.checked)} aria-label="跳跃移动" />跳跃移动（按直线距离消耗，忽略困难与危险地形）</label>
      {mode === 'hazard' ? <span className="cmb-inline-action">
        <input className="cmb-dice" value={hazardDice} onChange={event => setHazardDice(event.target.value)} aria-label="危险地形伤害骰" placeholder="1d6" />
        <select value={hazardType} onChange={event => setHazardType(event.target.value as DamageType)} aria-label="危险地形伤害类型">{damageTypes.map(type => <option key={type} value={type}>{type}</option>)}</select>
      </span> : null}
      <button type="button" className="button-secondary" onClick={() => { setSelected(''); setMode('move'); handlers.onGrid(null); }}>关闭方格</button>
    </div>
  </div>;
}

function ReadyPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const state = actor.combat;
  const [action, setAction] = useState('');
  const [trigger, setTrigger] = useState('');
  if (!state) return null;
  if (state.ready) {
    return <div className="cmb-ongoing-list">
      <span className="cmb-chip">准备中：{state.ready.action}（触发：{state.ready.trigger}）
        <button type="button" className="cmb-chip-remove" aria-label="放弃准备动作" onClick={() => handlers.onCancelReady(actor.id)}>×</button>
      </span>
      <button type="button" className="button-secondary" disabled={state.reactionUsed} onClick={() => handlers.onTriggerReady(actor.id)}>触发（消耗反应）</button>
    </div>;
  }
  return <div className="cmb-ready">
    <label>准备动作<input value={action} maxLength={120} placeholder="例如：用短弓射击" aria-label="准备执行的动作" onChange={event => setAction(event.target.value)} /></label>
    <label>触发条件<input value={trigger} maxLength={120} placeholder="例如：敌人进入射程" aria-label="触发条件" onChange={event => setTrigger(event.target.value)} /></label>
    <button type="button" className="button-secondary" disabled={state.actionUsed || !action.trim() || !trigger.trim()} onClick={() => { handlers.onReady(actor.id, { action, trigger }); setAction(''); setTrigger(''); }}>准备动作（消耗动作）</button>
  </div>;
}

function AiPanel({ battle, actor, onApply }: { battle: Battle; actor: Actor; onApply: (suggestion: AttackSuggestion) => void }) {  const suggestions = suggestAttacks(battle, actor.id);
  if (!suggestions.length) return null;
  const nameOf = (targetId: string) => {
    const target = battle.actors.find(item => item.id === targetId);
    return target ? actorLabel(battle, target) : '未知目标';
  };
  return <div className="cmb-ai">
    <div className="cmb-ai-head"><h4>战术建议</h4><small>按能否立即攻击、目标血量与平均伤害排序</small></div>
    <ul>
      {suggestions.map(item => <li key={`${item.targetId}:${item.source.id}`}>
        <span className={item.inRange ? 'cmb-ai-ready' : 'cmb-ai-wait'}>{nameOf(item.targetId)} · {item.source.label}</span>
        <small>{item.reason}</small>
        <button type="button" className="button-secondary" disabled={!item.inRange} onClick={() => onApply(item)}>填入攻击表单</button>
      </li>)}
    </ul>
  </div>;
}

function AttackForm({ battle, attacker, suggestion, onAttack, onAttackSequence, onOffhand, onButtEnd, onDive, onReloadAmmo }: { battle: Battle; attacker: Actor; suggestion?: AttackSuggestion | null; onAttack: (options: AttackOptions) => void; onAttackSequence: (options: AttackOptions) => void; onOffhand: (options: AttackOptions) => void; onButtEnd: (options: AttackOptions) => void; onDive: (options: AttackOptions) => void; onReloadAmmo: (actorId: string) => void }) {
  const sources = attackSources(attacker);
  const first = sources[0];
  const targets = availableTargets(battle, attacker.id);
  const selectedSource = sources.find(item => item.id === sourceId);
  const loading = selectedSource?.properties?.includes('装填') === true;
  const maxAttacks = loading ? 1 : attacksPerAction(attacker);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [sourceId, setSourceId] = useState(first?.id ?? '');
  const [bonus, setBonus] = useState(String(first?.attackBonus ?? 0));
  const [damage, setDamage] = useState(first?.damageExpression ?? '1d8');
  const [type, setType] = useState<DamageType>(first?.damageType ?? '挥砍');
  const [mode, setMode] = useState<AttackMode>('normal');
  const [cost, setCost] = useState<AttackCost>('action');
  const [range, setRange] = useState<AttackRange>(first?.range ?? 'melee');
  const [distance, setDistance] = useState(String(first?.distanceFt ?? 5));
  const [cover, setCover] = useState<CoverType>('无');
  const [autoCover, setAutoCover] = useState(true);
  const [twoHanded, setTwoHanded] = useState(false);
  const [powerAttack, setPowerAttack] = useState(false);
  const [criticalRange, setCriticalRange] = useState('');
  const [sharpshooter, setSharpshooter] = useState(false);
  const [nick, setNick] = useState(false);
  const [extraDamage, setExtraDamage] = useState('');
  const [extraType, setExtraType] = useState<DamageType | '无'>('无');
  const [extraCritical, setExtraCritical] = useState(true);
  const [attacks, setAttacks] = useState('1');
  const [extraTargets, setExtraTargets] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!suggestion) return;
    setTargetId(suggestion.targetId);
    const source = sources.find(item => item.id === suggestion.source.id);
    if (!source) return;
    setSourceId(source.id);
    setBonus(String(source.attackBonus));
    setDamage(source.damageExpression);
    setType(source.damageType);
    setRange(source.range);
    setDistance(String(source.distanceFt));
  }, [suggestion]);
  const target = targets.find(item => item.id === targetId);
  if (!targets.length) return <p className="cmb-hint">当前没有可攻击的目标。</p>;
  const applySource = (id: string) => {
    const source = sources.find(item => item.id === id);
    setSourceId(id);
    setTwoHanded(false);
    setPowerAttack(false);
    setSharpshooter(false);
    setNick(false);
    if (!source) return;
    setBonus(String(source.attackBonus));
    setDamage(source.damageExpression);
    setType(source.damageType);
    setRange(source.range);
    setDistance(String(source.distanceFt));
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 2d6+3 的写法。'); return; }
    const distanceFt = Number(distance);
    if (!Number.isInteger(distanceFt) || distanceFt < 0 || distanceFt > 600) { setMessage('距离须为 0 至 600 尺的整数。'); return; }
    const extra = extraDamage.trim();
    if (extra && !/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(extra)) { setMessage('额外伤害骰格式无效，请使用如 1d6 的写法。'); return; }
    if (extra && extraType === '无') { setMessage('有额外伤害时请选择它的伤害类型。'); return; }
    const count = Number(attacks);
    if (!Number.isInteger(count) || count < 1 || count > maxAttacks) { setMessage(`本回合的攻击次数须为 1 至 ${maxAttacks} 次。`); return; }
    setMessage('');
    const reachFt = range === 'melee' ? sources.find(item => item.id === sourceId)?.distanceFt : undefined;
    const options: AttackOptions = { attackerId: attacker.id, targetId: target?.id ?? targetId, attackBonus, damageExpression: damage, damageType: type, mode, cost, range, distanceFt, attacks: count, ...(reachFt === undefined ? {} : { reachFt }), ...(cover === '无' ? {} : { cover }), ...(autoCover ? { autoCover: true } : {}), ...(extra ? { extraDamageExpression: extra, extraDamageType: extraType === '无' ? undefined : extraType, extraDamageCritical: extraCritical } : {}), ...(sourceId ? { weaponId: sourceId } : {}), ...(twoHanded ? { twoHanded: true } : {}), ...(powerAttack ? { powerAttack: true } : {}), ...(sharpshooter ? { sharpshooter: true } : {}), ...(criticalRange.trim() && Number.isInteger(Number(criticalRange)) ? { criticalRange: Number(criticalRange) } : {}) };
    if (count > 1) onAttackSequence({ ...options, ...(extraTargets.length ? { targets: [target?.id ?? targetId, ...extraTargets] } : {}) }); else onAttack(options);
  };
  const submitDive = () => {
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 2d6+3 的写法。'); return; }
    const target2 = targets.find(item => item.id === targetId);
    if (!target2) { setMessage('请选择俯冲的目标。'); return; }
    setMessage('');
    onDive({ attackerId: attacker.id, targetId: target2.id, attackBonus, damageExpression: damage, damageType: type, range: 'melee', ...(sourceId ? { weaponId: sourceId } : {}) });
  };
  const submitButtEnd = () => {
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    if (!target) { setMessage('请选择攻击目标。'); return; }
    if (!sourceId) { setMessage('请选择长武器。'); return; }
    setMessage('');
    onButtEnd({ attackerId: attacker.id, targetId: target.id, attackBonus, damageExpression: '1d4', damageType: '钝击', range: 'melee', weaponId: sourceId });
  };
  const submitOffhand = () => {
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    const distanceFt = Number(distance);
    if (!Number.isInteger(distanceFt) || distanceFt < 0 || distanceFt > 600) { setMessage('距离须为 0 至 600 尺的整数。'); return; }
    if (!target) { setMessage('请选择攻击目标。'); return; }
    if (!sourceId) { setMessage('请选择副手武器。'); return; }
    setMessage('');
    onOffhand({ attackerId: attacker.id, targetId: target.id, attackBonus, damageExpression: damage, damageType: type, mode, range, distanceFt, weaponId: sourceId, cost: 'bonus', ...(nick ? { nick: true } : {}) });
  };
  return <form className="cmb-attack" onSubmit={submit}>
    <div className="cmb-attack-head"><h4>攻击</h4><small>目标 AC {target?.template.armorClass ?? '—'}</small></div>
    <div className="cmb-attack-grid">
      <label>攻击来源<select value={sourceId} onChange={event => applySource(event.target.value)} aria-label="攻击来源">{sources.map(item => <option key={item.id} value={item.id}>{item.label}（{originLabels[item.origin]}{item.mastery ? `，精通：${item.mastery}` : ''}）</option>)}</select></label>
      <label>目标<select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="攻击目标">{targets.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}（{item.side}，HP {item.currentHp}/{item.maxHp}，AC {item.template.armorClass}）</option>)}</select></label>
      <label>攻击加值<input type="number" step={1} value={bonus} onChange={event => setBonus(event.target.value)} aria-label="攻击加值" /></label>
      <label>伤害骰<input value={damage} onChange={event => setDamage(event.target.value)} aria-label="伤害骰" placeholder="2d6+3" /></label>
      <label>伤害类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="伤害类型">{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>距离<select value={range} aria-label="攻击距离" onChange={event => { const next = event.target.value as AttackRange; setRange(next); setDistance(next === 'melee' ? '5' : '30'); }}><option value="melee">近战</option><option value="ranged">远程</option></select></label>
      <label>距离（尺）<input type="number" min={0} max={600} step={5} value={distance} onChange={event => setDistance(event.target.value)} aria-label="与目标距离" /></label>
      <label>目标掩体<select value={cover} onChange={event => setCover(event.target.value as CoverType)} aria-label="目标掩体">{coverTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="cmb-check"><input type="checkbox" checked={autoCover} onChange={event => setAutoCover(event.target.checked)} aria-label="自动判定掩体" />按墙体自动判定掩体</label>
      <label>重击范围<input type="number" min={15} max={20} step={1} value={criticalRange} placeholder="自动" title="留空时按职业与等级自动判定（勇士冠军 19–20／18–20）" onChange={event => setCriticalRange(event.target.value)} aria-label="重击范围" /></label>
      {sources.find(item => item.id === sourceId)?.versatileDamage ? <label className="cmb-check"><input type="checkbox" checked={twoHanded} onChange={event => setTwoHanded(event.target.checked)} aria-label="双手持用" />双手持用（{sources.find(item => item.id === sourceId)?.versatileDamage}）</label> : null}
      {(() => { const picked = sources.find(item => item.id === sourceId); return picked && (picked.range === 'ranged' || picked.properties?.includes('投掷')) ? <label className="cmb-check"><input type="checkbox" checked={sharpshooter} onChange={event => setSharpshooter(event.target.checked)} aria-label="神射手" />神射手（忽略半掩体／四分之三掩体与远程射程劣势）</label> : null; })()}
      {sources.find(item => item.id === sourceId)?.properties?.includes('重型') ? <label className="cmb-check"><input type="checkbox" checked={powerAttack} onChange={event => setPowerAttack(event.target.checked)} aria-label="强力攻击" />强力攻击（攻击 -5，伤害 +10）</label> : null}
      {sources.find(item => item.id === sourceId)?.mastery === '迅击' ? <label className="cmb-check"><input type="checkbox" checked={nick} onChange={event => setNick(event.target.checked)} aria-label="迅击" />迅击（副手攻击并入攻击动作，不消耗附赠动作）</label> : null}
      <label>额外伤害<input value={extraDamage} onChange={event => setExtraDamage(event.target.value)} aria-label="额外伤害骰" placeholder="如 1d6（可留空）" /></label>
      <label>额外伤害类型<select value={extraType} onChange={event => setExtraType(event.target.value as DamageType | '无')} aria-label="额外伤害类型"><option value="无">无</option>{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="cmb-check"><input type="checkbox" checked={extraCritical} onChange={event => setExtraCritical(event.target.checked)} aria-label="额外伤害随重击翻倍" />额外伤害随重击翻倍</label>
      <label>攻击次数<input type="number" min={1} max={maxAttacks} step={1} value={attacks} onChange={event => setAttacks(event.target.value)} aria-label="攻击次数" title={loading ? '装填武器每次动作只能射击一次' : `额外攻击：本回合最多 ${maxAttacks} 次`} />{loading ? <small>装填：每次动作只能射击一次</small> : null}</label>
      {Number(attacks) > 1 && targets.length > 1 ? <fieldset className="cmb-targets"><legend>分散攻击（可选，按顺序轮流分配）</legend>{targets.filter(item => item.id !== targetId).map(item => <label key={item.id} className="cmb-check"><input type="checkbox" checked={extraTargets.includes(item.id)} onChange={event => setExtraTargets(prev => event.target.checked ? [...prev, item.id] : prev.filter(id => id !== item.id))} aria-label={`分散目标 ${actorLabel(battle, item)}`} />{actorLabel(battle, item)}</label>)}</fieldset> : null}
      {sources.find(item => item.id === sourceId)?.properties?.includes('弹药') ? <label className="cmb-inline-action">弹药：{attacker.combat?.ammo ?? 20} 发<button type="button" className="button-secondary" onClick={() => onReloadAmmo(attacker.id)} aria-label="补充弹药">补充弹药</button></label> : null}
      <label>检定<select value={mode} onChange={event => setMode(event.target.value as AttackMode)} aria-label="检定方式"><option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>
      <label>消耗<select value={cost} onChange={event => setCost(event.target.value as AttackCost)} aria-label="消耗动作"><option value="action">动作</option><option value="bonus">附赠动作</option><option value="reaction">反应</option></select></label>
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
        {(() => { const accurate = bonus.trim() && Number.isInteger(Number(bonus)) && target; if (!accurate) return null; const value = expectedDamage(Number(bonus), target.template.armorClass, mode, damage); return <p className="cmb-hint">命中率 {hitChanceLabel(Number(bonus), target.template.armorClass, mode)}，期望伤害 {value}</p>; })()}
    <div className="cmb-attack-actions"><span className="cmb-hint">伤害由本地掷骰；状态（目盲、倒地、麻痹等）会自动修正检定并结算重击，抗性、易伤、免疫与临时生命照常处理。</span><button className="button-primary" type="submit">{Number(attacks) > 1 ? `投掷 ${attacks} 次攻击` : '投掷攻击'}</button><button className="button-secondary" type="button" onClick={submitOffhand} aria-label="副手攻击">副手攻击（附赠动作）</button>
        {attacker.combat?.flying === true && (attacker.elevation ?? 0) >= 10 ? <button type="button" className="button-secondary" onClick={submitDive} aria-label="俯冲攻击">俯冲攻击（优势，落地）</button> : null}
      {(() => { const picked = sources.find(item => item.id === sourceId); const polearm = picked ? picked.properties?.includes('长武器') || ['戟', '长棍', '长矛'].some(name => picked.label.includes(name)) : false; return polearm ? <button className="button-secondary" type="button" onClick={submitButtEnd} aria-label="柄端攻击">柄端攻击（附赠动作，1d4+力量钝击）</button> : null; })()}</div>
  </form>;
}

export function AreaEffectForm({ battle, onSave, onAreaSave }: { battle: Battle; onSave: (options: SaveOptions) => void; onAreaSave: (options: AreaSaveOptions) => void }) {
  const actors = battle.actors.filter(actor => actor.combat?.status !== 'dead');
  const [selected, setSelected] = useState<string[]>(() => actors.map(actor => actor.id));
  const [ability, setAbility] = useState<Ability>('dex');
  const [dc, setDc] = useState('13');
  const [bonus, setBonus] = useState('0');
  const [damage, setDamage] = useState('2d6');
  const [type, setType] = useState<DamageType>('火焰');
  const [halfOnSuccess, setHalfOnSuccess] = useState(true);
  const [cover, setCover] = useState<CoverType>('无');
  const [message, setMessage] = useState('');
  if (!actors.length) return null;
  const toggle = (id: string) => setSelected(old => old.includes(id) ? old.filter(item => item !== id) : [...old, id]);
  const readDc = () => {
    const value = Number(dc);
    if (!Number.isInteger(value) || value < 1 || value > 40) { setMessage('豁免 DC 须为 1 至 40 的整数。'); return null; }
    return value;
  };
  const readBonus = () => {
    const value = Number(bonus);
    if (!Number.isInteger(value) || value < -10 || value > 30) { setMessage('豁免加值须为 -10 至 30 的整数。'); return null; }
    return value;
  };
  const single = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedDc = readDc(); const parsedBonus = readBonus();
    if (parsedDc === null || parsedBonus === null) return;
    if (selected.length !== 1) { setMessage('单体豁免需要恰好选择一个目标。'); return; }
    setMessage('');
    onSave({ actorId: selected[0], ability, dc: parsedDc, bonus: parsedBonus, ...(ability === 'dex' && cover !== '无' ? { cover } : {}) });
  };
  const area = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedDc = readDc();
    if (parsedDc === null) return;
    if (!selected.length) { setMessage('请至少选择一个目标。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 8d6 的写法。'); return; }
    setMessage('');
    onAreaSave({ targetIds: selected, ability, dc: parsedDc, damageExpression: damage, damageType: type, halfOnSuccess, ...(ability === 'dex' && cover !== '无' ? { covers: Object.fromEntries(selected.map(id => [id, cover])) } : {}) });
  };
  return <div className="cmb-area">
    <div className="cmb-attack-head"><h4>豁免与范围效果</h4><small>已选 {selected.length} / {actors.length}</small></div>
    <div className="cmb-targets">
      {actors.map(actor => <label key={actor.id} className="cmb-target"><input type="checkbox" checked={selected.includes(actor.id)} onChange={() => toggle(actor.id)} />{actorLabel(battle, actor)}<small>HP {actor.currentHp}/{actor.maxHp}</small></label>)}
    </div>
    <div className="cmb-attack-grid">

      <label>豁免属性<select value={ability} onChange={event => setAbility(event.target.value as Ability)} aria-label="豁免属性">{(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(item => <option key={item} value={item}>{abilityNames[item]}</option>)}</select></label>
      <label>豁免 DC<input type="number" min={1} max={40} value={dc} onChange={event => setDc(event.target.value)} aria-label="豁免 DC" /></label>
      <label>豁免加值（单体）<input type="number" min={-10} max={30} value={bonus} onChange={event => setBonus(event.target.value)} aria-label="豁免加值" /></label>
      <label>伤害骰<input value={damage} onChange={event => setDamage(event.target.value)} aria-label="范围伤害骰" placeholder="8d6" /></label>
      <label>伤害类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="范围伤害类型">{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>目标掩体<select value={cover} onChange={event => setCover(event.target.value as CoverType)} aria-label="目标掩体">{coverTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="cmb-check"><input type="checkbox" checked={halfOnSuccess} onChange={event => setHalfOnSuccess(event.target.checked)} />豁免成功伤害减半</label>
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <div className="cmb-attack-actions"><span className="cmb-hint">单体豁免只掷骰并写入日志；范围效果对每个目标分别掷豁免，成功减半（可关闭），抗性与临时生命照常结算。</span>
      <div className="cmb-area-actions"><button className="button-secondary" type="button" onClick={single}>单体豁免</button><button className="button-primary" type="submit" onClick={area}>结算范围伤害</button></div></div>
  </div>;
}

function GrapplePanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const targets = availableTargets(battle, actor.id);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  if (!targets.length) return null;
  const target = targets.find(item => item.id === targetId) ?? targets[0];
  const grappled = target?.combat?.conditions.includes('擒抱') === true;
  return <div className="cmb-attack">
    <div className="cmb-attack-head"><h4>擒抱与推撞</h4><small>消耗一个动作 · 力量（运动）对抗</small></div>
    <div className="cmb-attack-grid">
      <label>目标<select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="擒抱目标">{targets.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}（{item.side}，HP {item.currentHp}/{item.maxHp}）</option>)}</select></label>
    </div>
    <div className="cmb-attack-actions">
      <span className="cmb-hint">{grappled ? '目标已被擒抱，可以在其回合开始前手动解除。' : '目标是力量（运动）或敏捷（体操）中较高的一项进行对抗；平局视为失败。'}</span>
      <button className="button-primary" type="button" onClick={() => handlers.onGrapple(target.id)} aria-label="擒抱">擒抱</button>
      <button className="button-secondary" type="button" onClick={() => handlers.onShove(target.id, 'prone')} aria-label="推倒">推倒</button>
      <button className="button-secondary" type="button" onClick={() => handlers.onShove(target.id, 'push')} aria-label="推开五尺">推开 5 尺</button>
    </div>
  </div>;
}

function OngoingPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const actor = currentActor(battle);
  const [spell, setSpell] = useState('');
  const [name, setName] = useState('');
  const [dice, setDice] = useState('1d4');
  const [type, setType] = useState<DamageType>('火焰');
  const [saveAbility, setSaveAbility] = useState<Ability | ''>('');
  const [saveDc, setSaveDc] = useState('13');
  const [timing, setTiming] = useState<'start' | 'end'>('start');
  const [heal, setHeal] = useState('');
  const [message, setMessage] = useState('');
  if (!actor?.combat) return null;
  const ongoing = actor.combat.ongoing ?? [];
  const concentration = actor.combat.concentration;
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setMessage('请填写持续效果名称。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(dice)) { setMessage('伤害骰格式无效，请使用如 1d4 的写法。'); return; }
    let saveEnds: OngoingInput['saveEnds'];
    if (saveAbility) {
      const dc = Number(saveDc);
      if (!Number.isInteger(dc) || dc < 1 || dc > 40) { setMessage('持续效果的豁免 DC 须为 1 至 40 的整数。'); return; }
      saveEnds = { ability: saveAbility, dc };
    }
    const healExpression = heal.trim();
    if (healExpression && !/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(healExpression)) { setMessage('治疗骰格式无效，请使用如 1d4 的写法。'); return; }
    setMessage('');
    handlers.onAddOngoing(actor.id, { name: name.trim(), damageExpression: dice, damageType: type, saveEnds, timing, ...(healExpression ? { healExpression } : {}) });
    setName('');
  };
  const start = (event: React.FormEvent) => {
    event.preventDefault();
    if (!spell.trim()) { setMessage('请填写专注的法术名称。'); return; }
    setMessage('');
    handlers.onConcentration(actor.id, spell.trim());
    setSpell('');
  };
  return <div className="cmb-area">
    <div className="cmb-attack-head"><h4>持续效果与专注</h4><small>{ongoing.length} 个持续效果</small></div>
    <p className="cmb-hint">持续效果在自己回合的开始或结束时机自动结算（按键入时选择的时机）；带豁免的效果会在同一时机掷豁免，成功即移除。专注会在受到伤害时自动检定（DC = max(10, 伤害 ÷ 2)）。</p>
    <div className="cmb-ongoing-list">
      {concentration ? <span className="cmb-chip">专注：{concentration.spell}<button type="button" className="cmb-chip-remove" onClick={() => handlers.onConcentration(actor.id, null)} aria-label="结束专注">×</button></span> : null}
      {ongoing.map(effect => <span key={effect.id} className="cmb-chip">{effect.name}（{effect.damageExpression} {effect.damageType}，{(effect.timing ?? 'start') === 'start' ? '回合开始' : '回合结束'}{effect.saveEnds ? `，${abilityNames[effect.saveEnds.ability]}豁免 DC ${effect.saveEnds.dc}` : ''}${effect.healExpression ? `，同时恢复 ${effect.healExpression}` : ''}）<button type="button" className="cmb-chip-remove" onClick={() => handlers.onRemoveOngoing(actor.id, effect.id)} aria-label={`移除${effect.name}`}>×</button></span>)}
      {!concentration && !ongoing.length ? <span className="cmb-muted">当前没有专注或持续效果。</span> : null}
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <form className="cmb-attack-grid" onSubmit={start}>
      <label>专注法术<input value={spell} onChange={event => setSpell(event.target.value)} placeholder="如：灼热金属" aria-label="专注法术" /></label>
      <label className="cmb-inline-action"><button className="button-secondary" type="submit">开始专注</button></label>
    </form>
    <form className="cmb-attack-grid" onSubmit={add}>
      <label>效果名称<input value={name} onChange={event => setName(event.target.value)} placeholder="如：燃烧" aria-label="持续效果名称" /></label>
      <label>伤害骰<input value={dice} onChange={event => setDice(event.target.value)} aria-label="持续伤害骰" /></label>
      <label>伤害类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="持续伤害类型">{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>结算时机<select value={timing} onChange={event => setTiming(event.target.value as 'start' | 'end')} aria-label="持续效果结算时机"><option value="start">回合开始</option><option value="end">回合结束</option></select></label>
      <label>治疗骰（可选）<input value={heal} onChange={event => setHeal(event.target.value)} placeholder="如：1d4" aria-label="持续效果治疗骰" /></label>
      <label>豁免属性<select value={saveAbility} onChange={event => setSaveAbility(event.target.value as Ability | '')} aria-label="持续效果豁免属性"><option value="">无</option>{(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(item => <option key={item} value={item}>{abilityNames[item]}</option>)}</select></label>
      <label>豁免 DC<input type="number" min={1} max={40} value={saveDc} onChange={event => setSaveDc(event.target.value)} aria-label="持续效果豁免 DC" disabled={!saveAbility} /></label>
      <label className="cmb-inline-action"><button className="button-secondary" type="submit">添加效果</button></label>
    </form>
  </div>;
}

function OpportunityPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const prompts = pendingOpportunities(battle);
  if (!prompts.length) return null;
  return <div className="cmb-attack">
    <div className="cmb-attack-head"><h4>借机攻击与准备动作</h4><small>{prompts.length} 个待结算</small></div>
    <p className="cmb-hint">单位离开敌对单位的触及范围会触发借机攻击；结算时消耗反应，出刀按触发瞬间的触及关系计算。</p>
    <div className="cmb-ongoing-list">{prompts.map(prompt => {
      const reactor = battle.actors.find(actor => actor.id === prompt.reactorId);
      const target = battle.actors.find(actor => actor.id === prompt.targetId);
      const prepared = prompt.kind === 'ready';
      return <span className="cmb-chip" key={`${prompt.reactorId}-${prompt.targetId}`}>{reactor ? actorLabel(battle, reactor) : '—'} → {target ? actorLabel(battle, target) : '—'}{prepared ? '（准备）' : ''}
        <button type="button" className="cmb-chip-remove" onClick={() => (prepared ? handlers.onReadyPrompt(prompt.reactorId) : handlers.onOpportunity(prompt.reactorId))} aria-label={prepared ? '执行准备好的动作' : `${reactor ? reactor.name : ''} 借机攻击`}>{prepared ? '✓' : '⚔'}</button>
        <button type="button" className="cmb-chip-remove" onClick={() => handlers.onDeclineOpportunity(prompt.reactorId)} aria-label="放弃借机攻击">×</button>
      </span>;
    })}</div>
  </div>;
}

function SummonPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const actor = currentActor(battle);
  const [target, setTarget] = useState('');
  const [rounds, setRounds] = useState('');
  const [message, setMessage] = useState('');
  if (!actor?.combat) return null;
  const concentration = actor.combat.concentration;
  const summons = summonsOf(battle, actor.id);
  if (!concentration && !summons.length) return null;
  const candidates = battle.actors.filter(item => item.id !== actor.id && !item.summon && item.combat?.status !== 'dead');
  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const chosen = target || candidates[0]?.id || '';
    if (!chosen) { setMessage('没有可以标记为召唤物的单位。'); return; }
    const value = rounds.trim() === '' ? undefined : Number(rounds);
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 99)) { setMessage('持续轮数须为 1 至 99 的整数。'); return; }
    setMessage('');
    handlers.onSummon(chosen, actor.id, concentration?.spell ?? '', value);
    setTarget('');
    setRounds('');
  };
  return <div className="cmb-area">
    <div className="cmb-attack-head"><h4>召唤物</h4><small>{summons.length} 个</small></div>
    <p className="cmb-hint">召唤物随施法者失去专注、倒地或死亡而消散；填写持续轮数后，每轮到施法者时递减，归零即消散。</p>
    <div className="cmb-ongoing-list">
      {summons.map(summon => <span key={summon.id} className="cmb-chip">{summon.name}（{summon.summon?.spell}{summon.summon?.rounds === undefined ? '' : `，剩余 ${summon.summon.rounds} 轮`}）<button type="button" className="cmb-chip-remove" onClick={() => handlers.onDismissSummon(summon.id)} aria-label={`解除${summon.name}的召唤`}>×</button></span>)}
      {!summons.length ? <span className="cmb-muted">当前没有召唤物。</span> : null}
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    {concentration
      ? <form className="cmb-attack-grid" onSubmit={add}>
        <label>标记单位<select value={target} onChange={event => setTarget(event.target.value)} aria-label="要标记为召唤物的单位"><option value="">{candidates.length ? '请选择单位' : '没有可用的单位'}</option>{candidates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>持续轮数<input type="number" min={1} max={99} value={rounds} onChange={event => setRounds(event.target.value)} placeholder="留空为不限" aria-label="召唤持续轮数" /></label>
        <label className="cmb-inline-action"><button className="button-secondary" type="submit" disabled={!candidates.length}>标记为「{concentration.spell}」的召唤物</button></label>
      </form>
      : <p className="cmb-hint">先开始专注，才能把单位标记为召唤物。</p>}
  </div>;
}

export function CheckPanel({ actor, handlers }: { actor: Actor; handlers: CombatHandlers }) {
  const [ability, setAbility] = useState<Ability>('str');
  const [skill, setSkill] = useState('');
  const [dc, setDc] = useState(15);
  const [notice, setNotice] = useState('');
  const checkNames: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };
  return <section className="cmb-ready">
    <div className="section-label">属性检定</div>
    <label>属性
      <select value={ability} onChange={event => setAbility(event.target.value as Ability)} aria-label="检定属性">
        {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(key => <option key={key} value={key}>{checkNames[key]}</option>)}
      </select>
    </label>
    <label>技能（可留空）
      <input value={skill} onChange={event => setSkill(event.target.value)} placeholder="运动 / 隐匿 / 察觉" aria-label="检定技能" />
    </label>
    <label>DC
      <input type="number" min={1} max={40} value={dc} onChange={event => setDc(Number(event.target.value))} aria-label="检定 DC" />
    </label>
    <button type="button" className="button-secondary" onClick={() => {
      if (!Number.isInteger(dc) || dc < 1 || dc > 40) { setNotice('DC 须为 1 至 40 的整数。'); return; }
      setNotice('');
      handlers.onCheck({ actorId: actor.id, ability, skill: skill.trim() || undefined, dc });
    }}>{checkNames[ability]}检定</button>
    {notice ? <small className="cmb-muted">{notice}</small> : null}
  </section>;
}

export function HealPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const candidates = battle.actors.filter(item => item.combat?.status !== 'dead');
  const [targetId, setTargetId] = useState(candidates[0]?.id ?? '');
  const [amount, setAmount] = useState(5);
  if (!candidates.length) return null;
  return <section className="cmb-ready">
    <div className="section-label">治疗</div>
    <label>目标
      <select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="治疗目标">
        {candidates.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}（{item.currentHp}/{item.maxHp}）</option>)}
      </select>
    </label>
    <label>治疗量
      <input type="number" min={1} max={999} value={amount} onChange={event => setAmount(Number(event.target.value))} aria-label="治疗量" />
    </label>
    <button type="button" className="button-secondary" disabled={actor.combat?.actionUsed === true} onClick={() => { if (Number.isInteger(amount) && amount > 0) handlers.onHeal(targetId, amount); }}>治疗（消耗动作）</button>
    <button type="button" className="button-secondary" disabled={actor.combat?.actionUsed === true} onClick={() => handlers.onStabilize(targetId)} aria-label="稳定伤势">稳定伤势（动作，医药 DC 10）</button>
    <small className="cmb-muted">治疗倒地单位会让其重新站起并清空死亡豁免；稳定伤势则让它停止掷死亡豁免。</small>
  </section>;
}

export function HelpPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const allies = battle.actors.filter(item => item.id !== actor.id && item.side === actor.side && item.side !== '中立' && item.combat?.status === 'active');
  if (!allies.length) return null;
  const ready = actor.combat?.helpedAttack === true;
  return <div className="cmb-help">
    <div className="cmb-ai-head">协助</div>
    {ready ? <p className="cmb-hint">{actor.name} 已获得协助：下一次攻击检定具有优势。</p> : null}
    <div className="cmb-ai-actions">
      {allies.map(ally => <button key={ally.id} type="button" className="button-secondary" disabled={actor.combat?.actionUsed === true} onClick={() => handlers.onHelp(actor.id, ally.id)}>协助 {ally.name}</button>)}
    </div>
    <p className="cmb-hint">协助消耗动作；受协助的单位下一次攻击检定具有优势，用掉即消失。</p>
  </div>;
}

export function AuraPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
  const actor = currentActor(battle);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('10');
  const [bonus, setBonus] = useState('1');
  const [kind, setKind] = useState<'ac' | 'saves'>('ac');
  const [message, setMessage] = useState('');
  const auras = aurasOf(battle);
  const ownerLabel = (id: string) => battle.actors.find(item => item.id === id)?.name ?? id;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!actor) return;
    const radiusFt = Number(radius);
    const bonusValue = Number(bonus);
    if (!Number.isInteger(radiusFt) || radiusFt < 5 || radiusFt > 60) { setMessage('半径须为 5 至 60 尺的整数。'); return; }
    if (!Number.isInteger(bonusValue) || bonusValue < 1 || bonusValue > 5) { setMessage('加值须为 1 至 5 的整数。'); return; }
    if (!name.trim()) { setMessage('请填写灵光名称。'); return; }
    handlers.onAura({ name: name.trim(), ownerId: actor.id, radiusFt, bonus: bonusValue, kind });
    setName(''); setMessage('');
  };
  return <div className="cmb-area">
    <div className="cmb-attack-head"><h4>灵光</h4><small>{auras.length} 个</small></div>
    <p className="cmb-hint">灵光由当前行动者产生，只影响同阵营且在其半径内的单位；AC 灵光计入攻击目标的 AC，豁免灵光计入豁免检定。</p>
    <div className="cmb-ongoing-list">
      {auras.map(aura => <span key={aura.id} className="cmb-chip">{aura.name}（{ownerLabel(aura.ownerId)} · {aura.radiusFt} 尺 · {aura.kind === 'ac' ? 'AC' : '豁免'} +{aura.bonus}）<button type="button" className="cmb-chip-remove" onClick={() => handlers.onRemoveAura(aura.id)} aria-label={`结束${aura.name}的灵光`}>×</button></span>)}
      {!auras.length ? <span className="cmb-muted">当前没有灵光。</span> : null}
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <form className="cmb-attack-grid" onSubmit={submit}>
      <label>名称<input value={name} onChange={event => setName(event.target.value)} placeholder="守护灵光" aria-label="灵光名称" /></label>
      <label>半径（尺）<input type="number" min={5} max={60} step={5} value={radius} onChange={event => setRadius(event.target.value)} aria-label="灵光半径" /></label>
      <label>加值<input type="number" min={1} max={5} value={bonus} onChange={event => setBonus(event.target.value)} aria-label="灵光加值" /></label>
      <label>效果<select value={kind} onChange={event => setKind(event.target.value === 'saves' ? 'saves' : 'ac')} aria-label="灵光效果"><option value="ac">AC</option><option value="saves">豁免</option></select></label>
      <label className="cmb-inline-action"><button className="button-secondary" type="submit">添加灵光</button></label>
    </form>
  </div>;
}

export function CombatLog({ battle }: { battle: Battle }) {
  const log = battle.combat?.log ?? [];
  const [keyword, setKeyword] = useState('');
  const [round, setRound] = useState<'all' | number>('all');
  const rounds = logRounds(log);
  const visible = filterLog(log, { keyword, round: round === 'all' ? undefined : round, limit: 60 });
  return <section className="cmb-log">
    <div className="cmb-panel-head"><div><div className="section-label">COMBAT LOG</div><h3>战斗日志</h3></div><span>{visible.length} / {log.length} 条</span></div>
    {log.length ? <>
      <div className="cmb-log-filter">
        <label>筛选<input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="关键字或单位名" aria-label="日志筛选" /></label>
        <label>轮次<select value={String(round)} onChange={event => setRound(event.target.value === 'all' ? 'all' : Number(event.target.value))} aria-label="日志轮次">
          <option value="all">全部</option>
          {rounds.map(item => <option key={item} value={item}>第 {item} 轮</option>)}
        </select></label>
      </div>
      {visible.length
        ? <ol>{[...visible].reverse().map(entry => <li key={entry.id}><div><strong>R{entry.round}</strong> {entry.text}</div>{entry.detail && <p>{entry.detail}</p>}</li>)}</ol>
        : <p className="cmb-hint">没有符合筛选条件的记录。</p>}
    </> : <p className="cmb-hint">开始战斗后，攻击、伤害与回合变化会记录在这里。</p>}
  </section>;
}

/** 战斗档案的导出、导入与战报。 */
export function BattleIo({ battle, onImport }: { battle: Battle; onImport: (text: string) => void }) {
  const [importText, setImportText] = useState('');
  const [transcript, setTranscript] = useState('');
  const [notice, setNotice] = useState('');
  const exportText = exportBattle(battle);
  const download = () => {
    const blob = new Blob([exportText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${battle.name || 'battle'}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice('已开始下载战斗档案。');
  };
  return <section className="cmb-io">
    <details>
      <summary><span>导入 / 导出战斗</span><small>JSON 档案与 Markdown 战报</small></summary>
      <div className="cmb-io-body">
        <label>导出档案
          <textarea readOnly rows={6} value={exportText} onFocus={event => event.currentTarget.select()} />
        </label>
        <div className="cmb-io-actions">
          <button className="button-secondary" type="button" onClick={download}>下载 JSON</button>
          <button className="button-secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(exportText); setNotice('已复制到剪贴板。'); } catch { setNotice('当前环境不支持复制，请手动选择文本。'); } }}>复制</button>
          <button className="button-secondary" type="button" onClick={() => setTranscript(battleTranscript(battle))}>生成战报</button>
        </div>
        {transcript && <textarea readOnly rows={8} value={transcript} onFocus={event => event.currentTarget.select()} />}
        <label>导入档案
          <textarea rows={5} value={importText} placeholder="粘贴导出的 JSON，或导出文件的内容" onChange={event => setImportText(event.target.value)} />
        </label>
        <div className="cmb-io-actions">
          <button className="button-primary" type="button" disabled={!importText.trim()} onClick={() => { onImport(importText); setImportText(''); setNotice('已导入战斗档案。'); }}>导入战斗</button>
        </div>
        {notice && <p className="cmb-hint">{notice}</p>}
      </div>
    </details>
  </section>;
}








export function ReinforcePanel({ battle, cards, onReinforce }: { battle: Battle; cards: Card[]; onReinforce: (card: Card, input: { side: Side; initiative?: number; position?: Position; name?: string }) => void }) {
  const [key, setKey] = useState('');
  const [side, setSide] = useState<Side>('敌方');
  const [name, setName] = useState('');
  const [initiative, setInitiative] = useState('');
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [message, setMessage] = useState('');
  if (!cards.length) return null;
  const cardOf = (value: string) => cards.find(item => `${item.entry.id}|${item.block.id}` === value);
  const selected = cardOf(key) ?? cards[0];
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const card = cardOf(key) ?? cards[0];
    if (!card) { setMessage('请选择要加入的怪物卡。'); return; }
    let manual: number | undefined;
    if (initiative.trim()) {
      manual = Number(initiative);
      if (!Number.isInteger(manual) || manual < -20 || manual > 60) { setMessage('先攻须为 -20 至 60 的整数。'); return; }
    }
    let position: Position | undefined;
    if (x.trim() || y.trim()) {
      const px = Number(x); const py = Number(y);
      if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0) { setMessage('格子坐标须为非负整数。'); return; }
      position = { x: px, y: py };
    }
    setMessage('');
    onReinforce(card, { side, ...(manual === undefined ? {} : { initiative: manual }), ...(position ? { position } : {}), ...(name.trim() ? { name: name.trim() } : {}) });
    setName(''); setInitiative(''); setX(''); setY('');
  };
  return <form className="cmb-reinforce" onSubmit={submit}>
    <div className="cmb-reinforce-head"><h4>增援</h4><small>战斗中插入新单位，按先攻排序，不打断当前回合</small></div>
    <div className="cmb-reinforce-grid">
      <label>怪物卡<select value={key || (selected ? `${selected.entry.id}|${selected.block.id}` : '')} onChange={event => setKey(event.target.value)} aria-label="增援怪物卡">{cards.map(item => <option key={`${item.entry.id}|${item.block.id}`} value={`${item.entry.id}|${item.block.id}`}>{item.entry.name}</option>)}</select></label>
      <label>阵营<select value={side} onChange={event => setSide(event.target.value as Side)} aria-label="增援阵营">{['友方', '敌方', '中立'].map(item => <option key={item}>{item}</option>)}</select></label>
      <label>名称<input value={name} onChange={event => setName(event.target.value)} placeholder="留空用怪物名" aria-label="增援名称" /></label>
      <label>先攻<input type="number" step={1} value={initiative} onChange={event => setInitiative(event.target.value)} placeholder="留空自动掷" aria-label="增援先攻" /></label>
      {battle.grid ? <>
        <label>格子 X<input type="number" min={0} step={1} value={x} onChange={event => setX(event.target.value)} placeholder="可选" aria-label="增援格子 X" /></label>
        <label>格子 Y<input type="number" min={0} step={1} value={y} onChange={event => setY(event.target.value)} placeholder="可选" aria-label="增援格子 Y" /></label>
      </> : null}
    </div>
    <div className="cmb-reinforce-actions"><button type="submit" className="button-secondary">加入增援</button>{message && <span className="cmb-muted">{message}</span>}</div>
  </form>;
}














function FallPanel({ actor, onFall }: { actor: Actor; onFall: (actorId: string, feet: number) => void }) {
  const [feet, setFeet] = useState(10);
  return (
    <div className="cmb-fall">
      <span className="cmb-muted">跳远 {jumpDistance(actor, 'long')} 尺 · 跳高 {jumpDistance(actor, 'high')} 尺</span>
      <label className="cmb-temp">坠落高度（尺）
        <input type="number" min={0} max={1000} step={5} value={feet} aria-label="坠落高度" onChange={event => setFeet(Number(event.target.value))} />
      </label>
      <span className="cmb-muted">预计 {fallAverageDamage(feet)} 点钝击伤害</span>
      <button type="button" className="button-secondary" aria-label="结算坠落" onClick={() => onFall(actor.id, feet)}>结算坠落</button>
    </div>
  );
}

function SpellPanel({ battle, actor, onCast, onSetSlots }: { battle: Battle; actor: Actor; onCast: (options: SpellCastOptions) => void; onSetSlots: (actorId: string, slots: number[]) => void }) {
  const [spell, setSpell] = useState('');
  const [level, setLevel] = useState(1);
  const [mode, setMode] = useState<'save' | 'attack'>('save');
  const [targetId, setTargetId] = useState('');
  const [damage, setDamage] = useState('2d6');
  const [type, setType] = useState<DamageType>('火焰');
  const [bonus, setBonus] = useState(7);
  const [dc, setDc] = useState(15);
  const [ability, setAbility] = useState<Ability>('dex');
  const [bonusAction, setBonusAction] = useState(false);
  const [concentration, setConcentration] = useState(false);
  const [slotText, setSlotText] = useState('');
  const [shape, setShape] = useState<'single' | 'sphere' | 'cone' | 'line' | 'cube'>('single');
  const [defer, setDefer] = useState(false);
  const [sizeFt, setSizeFt] = useState(20);
  const slotSummary = (actor.combat?.spellSlots ?? []).map((count, index) => count > 0 ? `${index + 1} 环 ${count}` : '').filter(Boolean).join(' · ') || '未记录';
  const targets = battle.actors.filter(item => item.id !== actor.id && item.combat?.status === 'active');
  const target = targetId || targets[0]?.id || '';
  const area = (() => {
    if (mode !== 'save' || shape === 'single' || !target) return [target];
    try {
      const ids = spellAreaTargets(battle, actor.id, shape, sizeFt);
      return ids.length ? ids : [target];
    } catch {
      return [target];
    }
  })();
  return (
    <div className="cmb-spell">
      <span className="cmb-muted">施放法术</span>
      <label>法术位<input value={slotText} onChange={event => setSlotText(event.target.value)} placeholder="如 4,3,2" aria-label="法术位" title={`当前：${slotSummary}`} /></label>
      <button type="button" className="button-secondary" aria-label="记录法术位" onClick={() => { const slots = slotText.split(/[^0-9]+/).filter(Boolean).map(item => Number(item)); if (!slots.length) { onSetSlots(actor.id, []); return; } onSetSlots(actor.id, slots); }}>记录法术位（{slotSummary}）</button>
      <label>名称<input value={spell} onChange={event => setSpell(event.target.value)} aria-label="法术名称" /></label>
      <label>环阶<input type="number" min={0} max={9} value={level} onChange={event => setLevel(Number(event.target.value))} aria-label="法术环阶" /></label>
      <label>结算<select value={mode} onChange={event => setMode(event.target.value as 'save' | 'attack')} aria-label="结算方式">
        <option value="save">目标豁免</option>
        <option value="attack">法术攻击</option>
      </select></label>
      <label>目标<select value={target} onChange={event => setTargetId(event.target.value)} aria-label="法术目标">
        {targets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>伤害骰<input value={damage} onChange={event => setDamage(event.target.value)} aria-label="法术伤害骰" /></label>
      <label>类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="法术伤害类型">
        {damageTypes.map(item => <option key={item} value={item}>{item}</option>)}
      </select></label>
      {mode === 'save'
        ? <><label>DC<input type="number" min={1} max={40} value={dc} onChange={event => setDc(Number(event.target.value))} aria-label="法术豁免 DC" /></label>
          <label>豁免<select value={ability} onChange={event => setAbility(event.target.value as Ability)} aria-label="豁免属性">
            {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map(key => <option key={key} value={key}>{abilityNames[key]}</option>)}
          </select></label>
          <label>范围<select value={shape} onChange={event => setShape(event.target.value as 'single' | 'sphere' | 'cone' | 'line' | 'cube')} aria-label="法术范围形状">
            <option value="single">单体</option>
            <option value="sphere">球形</option>
            <option value="cone">锥形</option>
            <option value="line">线形</option>
            <option value="cube">立方</option>
          </select></label>
          {shape !== 'single' ? <label>尺寸<input type="number" min={5} max={120} step={5} value={sizeFt} onChange={event => setSizeFt(Number(event.target.value))} aria-label="范围尺寸" /></label> : null}
          </>
        : <label>攻击加值<input type="number" value={bonus} onChange={event => setBonus(Number(event.target.value))} aria-label="法术攻击加值" /></label>}
      <label className="cmb-check"><input type="checkbox" checked={bonusAction} onChange={event => setBonusAction(event.target.checked)} aria-label="附赠动作施法" />附赠动作</label>
      <label className="cmb-check"><input type="checkbox" checked={concentration} onChange={event => setConcentration(event.target.checked)} aria-label="需要专注" />专注</label>
      <label className="cmb-check"><input type="checkbox" checked={defer} onChange={event => setDefer(event.target.checked)} aria-label="延后结算" />延后结算（等待反制）</label>
      <button type="button" className="button-secondary" aria-label="施放法术" disabled={!spell.trim() || !target} onClick={() => onCast({
        casterId: actor.id, spell: spell.trim(), level,
        ...(bonusAction ? { cost: 'bonus' as const } : {}),
        ...(concentration ? { concentration: true } : {}),
        ...(defer ? { defer: true } : {}),
        ...(mode === 'save'
          ? { save: { ability, dc, targetIds: area, damageExpression: damage, damageType: type } }
          : { attack: { targetId: target, attackBonus: bonus, damageExpression: damage, damageType: type } }),
      })}>施放{area.length > 1 ? `（${area.length} 个目标）` : ''}</button>
    </div>
  );
}


export function CounterspellPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const pending = battle.pendingCast;
  const learner = actor.combat?.counterspell === true;
  return (
    <div className="cmb-aura">
      <span className="cmb-muted">法术反制</span>
      <label className="cmb-check"><input type="checkbox" checked={learner} onChange={event => handlers.onSetCounterspell(actor.id, event.target.checked)} aria-label="会法术反制" />会法术反制（反应）</label>
      {pending ? <>
        <span className="cmb-chip cmb-chip-action">待结算：{pending.spell}（{pending.level} 环）</span>
        <button type="button" className="button-secondary" disabled={!learner || actor.combat?.reactionUsed === true} onClick={() => handlers.onCounterspell(actor.id)} aria-label="反制法术">反制（反应）</button>
        <button type="button" className="button-secondary" onClick={() => handlers.onResolveCast()} aria-label="让法术生效">让法术生效</button>
      </> : <span className="cmb-muted">当前没有待结算的法术。</span>}
    </div>
  );
}

export function ReplayPanel({ battle, onJump }: { battle: Battle; onJump: (steps: number) => void }) {
  const frames = replayFrames(battle);
  if (frames.length <= 1) return null;
  return (
    <details className="cmb-io">
      <summary>回放（{frames.length - 1} 步可回退）</summary>
      <div className="cmb-io-body">
        <ul className="cmb-replay">
          {frames.map(frame => (
            <li key={frame.index}>
              <span className="cmb-muted">第 {frame.index} 步（第 {frame.round} 轮{frame.actor ? ` · ${frame.actor}` : ''}）</span>
              {frame.added.length ? `：${frame.added.join('；')}` : '：（无新增记录）'}
              {frame.index < frames.length
                ? <button type="button" className="button-secondary" onClick={() => onJump(frames.length - frame.index)} aria-label={`回到第 ${frame.index} 步`}>回到此处</button>
                : null}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function AttackPresetPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const presets = (battle.attackPresets ?? []).filter(item => item.attackerId === actor.id);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const sources = attackSources(actor);
  const targets = availableTargets(battle, actor.id);
  if (!targets.length) return null;
  const first = sources[0];
  const save = () => {
    if (!name.trim()) { setMessage('请填写常用攻击的名称。'); return; }
    if (!first) { setMessage('该单位没有可用的攻击来源。'); return; }
    handlers.onSavePreset({ name: name.trim(), attackerId: actor.id, targetId: targets[0].id, attackBonus: first.attackBonus, damageExpression: first.damageExpression, damageType: first.damageType, range: first.range });
    setName('');
    setMessage('');
  };
  return (
    <div className="cmb-aura">
      <span className="cmb-muted">常用攻击</span>
      {presets.length ? presets.map(preset => <span key={preset.id} className="cmb-chip">{preset.name}
        <button type="button" className="cmb-chip-remove" onClick={() => handlers.onUsePreset(preset.id)} aria-label={`使用常用攻击 ${preset.name}`}>⚔</button>
        <button type="button" className="cmb-chip-remove" onClick={() => handlers.onRemovePreset(preset.id)} aria-label={`删除常用攻击 ${preset.name}`}>×</button>
      </span>) : <span className="cmb-muted">还没有保存的常用攻击。</span>}
      <label>名称<input value={name} onChange={event => setName(event.target.value)} placeholder="如：巨剑猛砍" aria-label="常用攻击名称" /></label>
      <button type="button" className="button-secondary" onClick={save} aria-label="保存常用攻击">保存当前武器快捷攻击</button>
      {message ? <span className="cmb-hint">{message}</span> : null}
    </div>
  );
}

export function SettlementPanel({ battle }: { battle: Battle }) {
  const [copied, setCopied] = useState('');
  const text = settlementText(battle);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('已复制结算摘要。');
    } catch {
      setCopied('当前环境不支持复制，请手动选中文本。');
    }
  };
  return (
    <details className="cmb-io">
      <summary>战斗结算（可回写角色卡）</summary>
      <div className="cmb-io-body">
        <label>结算摘要
          <textarea readOnly rows={8} value={text} onFocus={event => event.currentTarget.select()} aria-label="战斗结算摘要" />
        </label>
        <div className="cmb-io-actions">
          <button type="button" className="button-secondary" onClick={copy}>复制结算摘要</button>
        </div>
        {copied && <p className="cmb-muted">{copied}</p>}
      </div>
    </details>
  );
}

export function StudyPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const enemies = battle.actors.filter(item => item.id !== actor.id && item.side !== actor.side && item.side !== '中立' && item.combat?.status === 'active');
  const [targetId, setTargetId] = useState(enemies[0]?.id ?? '');
  if (!enemies.length) return null;
  const disabled = actor.combat?.actionUsed === true;
  return <section className="cmb-study">
    <h4>观察</h4>
    <label>目标<select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="观察目标">{enemies.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}</option>)}</select></label>
    <button type="button" className="button-secondary" disabled={disabled} onClick={() => handlers.onStudy(targetId)} aria-label="观察目标">观察（动作，调查 DC 10）</button>
    <p className="cmb-hint">成功后在战斗日志里列出目标的 AC、生命值、抗性与状态。</p>
  </section>;
}

export function ProtectionPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const allies = battle.actors.filter(item => item.id !== actor.id && item.side === actor.side && item.side !== '中立' && item.combat?.status === 'active');
  if (!allies.length) return null;
  if (!actor.combat?.guarding && actor.combat?.reactionUsed) return null;
  return (
    <div className="cmb-help">
      <div className="cmb-ai-head">保护</div>
      {actor.combat?.guarding ? <p className="cmb-muted">正在保护：{[actor.combat.guarding]}</p> : null}
      <div className="cmb-ai-actions">
        {allies.map(ally => (
          <button key={ally.id} type="button" className="button-secondary" disabled={actor.combat?.reactionUsed === true} onClick={() => handlers.onProtect(actor.id, ally.id)}>保护 {ally.name}</button>
        ))}
      </div>
      <p className="cmb-muted">保护消耗反应；被保护的同伴受到的下一次攻击具有劣势，结算后失效。</p>
    </div>
  );
}


export function ItemPanel({ battle, actor, handlers }: { battle: Battle; actor: Actor; handlers: CombatHandlers }) {
  const [name, setName] = useState('治疗药水');
  const [dice, setDice] = useState('2d4+2');
  const [quantity, setQuantity] = useState('1');
  const [unidentified, setUnidentified] = useState(false);
  const [notice, setNotice] = useState('');
  const items = actor.combat?.items ?? [];
  const corpses = battle.actors.filter(item => item.combat?.status === 'dead' && (item.combat?.items ?? []).length > 0);
  const allies = battle.actors.filter(item => item.id !== actor.id && item.combat?.status === 'active' && item.side === actor.side && item.side !== '中立');
  const [giveTo, setGiveTo] = useState(allies[0]?.id ?? '');
  const add = () => {
    const count = Number(quantity);
    if (!name.trim()) return setNotice('请填写物品名称。');
    if (!Number.isInteger(count) || count < 1 || count > 99) return setNotice('物品数量须为 1 至 99 的整数。');
    setNotice('');
    handlers.onAddItem(actor.id, name.trim(), count, dice.trim(), !unidentified);
  };
  return (
    <div className="cmb-help">
      <div className="cmb-ai-head">物品</div>
      {items.length ? (
        <div className="cmb-ai-actions">
          {items.map(item => (
            <Fragment key={item.name}>
              <button key={item.name} type="button" className="button-secondary" disabled={actor.combat?.actionUsed === true} onClick={() => handlers.onUseItem(actor.id, item.name)}>
                使用 {item.name}（×{item.quantity}）{item.identified === false ? '（未鉴定）' : ''}
              </button>
              {item.identified === false ? (
                <button key={`identify-${item.name}`} type="button" className="button-secondary" disabled={actor.combat?.actionUsed === true} onClick={() => handlers.onIdentify(actor.id, item.name)} aria-label={`鉴定 ${item.name}`}>
                  鉴定 {item.name}
                </button>
              ) : null}
            </Fragment>
          ))}
        </div>
      ) : <p className="cmb-muted">还没有记录物品。</p>}
      {items.length && allies.length ? (
        <label>递给<select value={giveTo} onChange={event => setGiveTo(event.target.value)} aria-label="递给同伴">
          {allies.map(ally => <option key={ally.id} value={ally.id}>{ally.name}</option>)}
        </select></label>
      ) : null}
      {items.length && allies.length ? (
        <div className="cmb-ai-actions">
          {items.map(item => (
            <button key={`give-${item.name}`} type="button" className="button-secondary" onClick={() => handlers.onGive(actor.id, giveTo, item.name)} aria-label={`递给同伴 ${item.name}`}>
              递出 {item.name}（×1）
            </button>
          ))}
        </div>
      ) : null}
      {corpses.length ? (
        <div className="cmb-ai-actions">
          {corpses.map(corpse => (
            <button key={corpse.id} type="button" className="button-secondary" onClick={() => handlers.onLoot(actor.id, corpse.id)} aria-label={`搜刮 ${corpse.name}`}>
              搜刮 {corpse.name}（{(corpse.combat?.items ?? []).length} 种）
            </button>
          ))}
        </div>
      ) : null}
      <label>名称<input value={name} onChange={event => setName(event.target.value)} /></label>
      <label>治疗骰<input value={dice} onChange={event => setDice(event.target.value)} placeholder="2d4+2" /></label>
      <label>数量<input value={quantity} onChange={event => setQuantity(event.target.value)} inputMode="numeric" /></label>
      <label className="cmb-check"><input type="checkbox" checked={unidentified} onChange={event => setUnidentified(event.target.checked)} aria-label="未鉴定" />未鉴定（需先花动作鉴定）</label>
      <div className="cmb-ai-actions"><button type="button" className="button-secondary" onClick={add}>记录物品</button></div>
      {notice ? <p className="cmb-muted">{notice}</p> : null}
      <p className="cmb-muted">使用物品消耗动作；治疗骰按本地掷骰结算。</p>
    </div>
  );
}
