import { useState } from 'react';
import type { Actor, Battle, DamageType } from './battle';
import { damageTypes } from './battle';
import type { AttackCost, AttackMode, AttackOptions } from './combat';
import { actorAttackProfile, actorInitiativeBonus, actorLabel, actorSpeed, availableTargets, combatantSummary, conditions, currentActor, currentActorId } from './combat';

export type CombatHandlers = {
  onStart: (initiatives: Record<string, number>) => void;
  onEndTurn: () => void;
  onUndo: () => void;
  onReset: () => void;
  onAttack: (options: AttackOptions) => void;
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

export function CombatToolbar({ battle, onEndTurn, onUndo, onReset }: { battle: Battle; onEndTurn: () => void; onUndo: () => void; onReset: () => void }) {
  const combat = battle.combat;
  if (!combat) return null;
  const current = currentActor(battle);
  return <div className="cmb-toolbar">
    <div className="cmb-toolbar-info"><strong>第 {combat.round} 轮</strong><span>{current ? `当前：${current.name}` : '等待行动'}</span></div>
    <div className="cmb-toolbar-actions">
      <button className="button-primary" type="button" onClick={onEndTurn}>结束回合</button>
      <button className="button-secondary" type="button" onClick={onUndo} disabled={!combat.undo.length}>撤销上一步</button>
      <button className="button-secondary" type="button" onClick={onReset} title="清除先攻与回合记录；生命值不会恢复">重置战斗</button>
    </div>
  </div>;
}

export function InitiativeRail({ battle }: { battle: Battle }) {
  const combat = battle.combat;
  if (!combat) return null;
  const current = currentActorId(battle);
  return <section className="cmb-rail">
    <div className="cmb-rail-head"><div className="section-label">INITIATIVE ORDER</div><span>第 {combat.round} 轮</span></div>
    <ol>
      {combat.order.map(id => {
        const actor = battle.actors.find(item => item.id === id);
        if (!actor) return null;
        const active = id === current;
        return <li className={`cmb-turn${active ? ' active' : ''}${actor.combat?.status === 'dead' ? ' dead' : ''}`} key={id}>
          <span className="cmb-init">{actor.combat?.initiative ?? '—'}</span>
          <div className="cmb-turn-body"><strong>{actorLabel(battle, actor)}</strong><small>{actor.side} · HP {actor.currentHp}/{actor.maxHp} · {combatantSummary(actor)}</small></div>
          {active && <em>当前</em>}
        </li>;
      })}
    </ol>
    <p className="cmb-hint">先攻相同按敏捷调整值、再按名称排序。</p>
  </section>;
}

export function TurnPanel({ battle, handlers }: { battle: Battle; handlers: CombatHandlers }) {
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
    <AttackForm key={actor.id} battle={battle} attacker={actor} onAttack={handlers.onAttack} />
    <div className="cmb-extras">
      <ConditionPicker actor={actor} onChange={condition => handlers.onCondition(actor.id, condition)} />
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

function AttackForm({ battle, attacker, onAttack }: { battle: Battle; attacker: Actor; onAttack: (options: AttackOptions) => void }) {
  const profile = actorAttackProfile(attacker);
  const targets = availableTargets(battle, attacker.id);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [bonus, setBonus] = useState(String(profile.attackBonus));
  const [damage, setDamage] = useState(profile.damage);
  const [type, setType] = useState<DamageType>(profile.damageType);
  const [mode, setMode] = useState<AttackMode>('normal');
  const [cost, setCost] = useState<AttackCost>('action');
  const [message, setMessage] = useState('');
  const target = targets.find(item => item.id === targetId);
  if (!targets.length) return <p className="cmb-hint">当前没有可攻击的目标。</p>;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 2d6+3 的写法。'); return; }
    setMessage('');
    onAttack({ attackerId: attacker.id, targetId: target?.id ?? targetId, attackBonus, damageExpression: damage, damageType: type, mode, cost });
  };
  return <form className="cmb-attack" onSubmit={submit}>
    <div className="cmb-attack-head"><h4>攻击</h4><small>目标 AC {target?.template.armorClass ?? '—'}</small></div>
    <div className="cmb-attack-grid">
      <label>目标<select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="攻击目标">{targets.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}（{item.side}，HP {item.currentHp}/{item.maxHp}，AC {item.template.armorClass}）</option>)}</select></label>
      <label>攻击加值<input type="number" step={1} value={bonus} onChange={event => setBonus(event.target.value)} aria-label="攻击加值" /></label>
      <label>伤害骰<input value={damage} onChange={event => setDamage(event.target.value)} aria-label="伤害骰" placeholder="2d6+3" /></label>
      <label>伤害类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="伤害类型">{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>检定<select value={mode} onChange={event => setMode(event.target.value as AttackMode)} aria-label="检定方式"><option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>
      <label>消耗<select value={cost} onChange={event => setCost(event.target.value as AttackCost)} aria-label="消耗动作"><option value="action">动作</option><option value="bonus">附赠动作</option><option value="reaction">反应</option></select></label>
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <div className="cmb-attack-actions"><span className="cmb-hint">伤害由本地掷骰；抗性、易伤、免疫、临时生命与倒地会自动结算。</span><button className="button-primary" type="submit">投掷攻击</button></div>
  </form>;
}

export function CombatLog({ battle }: { battle: Battle }) {
  const log = battle.combat?.log ?? [];
  return <section className="cmb-log">
    <div className="cmb-panel-head"><div><div className="section-label">COMBAT LOG</div><h3>战斗日志</h3></div><span>{log.length} 条</span></div>
    {log.length ? <ol>{[...log].reverse().slice(0, 30).map(entry => <li key={entry.id}><div><strong>R{entry.round}</strong> {entry.text}</div>{entry.detail && <p>{entry.detail}</p>}</li>)}</ol> : <p className="cmb-hint">开始战斗后，攻击、伤害与回合变化会记录在这里。</p>}
  </section>;
}
