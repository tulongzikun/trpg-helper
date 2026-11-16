import { useState } from 'react';
import type { Actor, Battle, DamageType } from './battle';
import { damageTypes } from './battle';
import type { AttackCost, AttackMode, AttackOptions, AreaSaveOptions, SaveOptions } from './combat';
import { actorAttackProfile, actorInitiativeBonus, actorLabel, actorSpeed, availableTargets, combatantSummary, conditions, currentActor, currentActorId } from './combat';
import { actionSurgeMax, attacksPerAction, hasSecondWind } from './combatModifiers';
import type { AttackRange } from './combatModifiers';
import type { Ability } from './characters';

const abilityNames: Record<Ability, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' };

export type CombatHandlers = {
  onStart: (initiatives: Record<string, number>) => void;
  onEndTurn: () => void;
  onUndo: () => void;
  onReset: () => void;
  onAttack: (options: AttackOptions) => void;
  onAttackSequence: (options: AttackOptions) => void;
  onSave: (options: SaveOptions) => void;
  onAreaSave: (options: AreaSaveOptions) => void;
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
    <ClassActions actor={actor} onSurge={() => handlers.onActionSurge(actor.id)} onSecondWind={() => handlers.onSecondWind(actor.id)} />
    <AttackForm key={actor.id} battle={battle} attacker={actor} onAttack={handlers.onAttack} onAttackSequence={handlers.onAttackSequence} />
    <AreaEffectForm key={`area-${actor.id}`} battle={battle} onSave={handlers.onSave} onAreaSave={handlers.onAreaSave} />
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

function AttackForm({ battle, attacker, onAttack, onAttackSequence }: { battle: Battle; attacker: Actor; onAttack: (options: AttackOptions) => void; onAttackSequence: (options: AttackOptions) => void }) {
  const profile = actorAttackProfile(attacker);
  const targets = availableTargets(battle, attacker.id);
  const maxAttacks = attacksPerAction(attacker);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [bonus, setBonus] = useState(String(profile.attackBonus));
  const [damage, setDamage] = useState(profile.damage);
  const [type, setType] = useState<DamageType>(profile.damageType);
  const [mode, setMode] = useState<AttackMode>('normal');
  const [cost, setCost] = useState<AttackCost>('action');
  const [range, setRange] = useState<AttackRange>('melee');
  const [distance, setDistance] = useState('5');
  const [attacks, setAttacks] = useState('1');
  const [message, setMessage] = useState('');
  const target = targets.find(item => item.id === targetId);
  if (!targets.length) return <p className="cmb-hint">当前没有可攻击的目标。</p>;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const attackBonus = Number(bonus);
    if (!Number.isInteger(attackBonus)) { setMessage('攻击加值须为整数。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 2d6+3 的写法。'); return; }
    const distanceFt = Number(distance);
    if (!Number.isInteger(distanceFt) || distanceFt < 0 || distanceFt > 600) { setMessage('距离须为 0 至 600 尺的整数。'); return; }
    const count = Number(attacks);
    if (!Number.isInteger(count) || count < 1 || count > maxAttacks) { setMessage(`本回合的攻击次数须为 1 至 ${maxAttacks} 次。`); return; }
    setMessage('');
    const options: AttackOptions = { attackerId: attacker.id, targetId: target?.id ?? targetId, attackBonus, damageExpression: damage, damageType: type, mode, cost, range, distanceFt, attacks: count };
    if (count > 1) onAttackSequence(options); else onAttack(options);
  };
  return <form className="cmb-attack" onSubmit={submit}>
    <div className="cmb-attack-head"><h4>攻击</h4><small>目标 AC {target?.template.armorClass ?? '—'}</small></div>
    <div className="cmb-attack-grid">
      <label>目标<select value={targetId} onChange={event => setTargetId(event.target.value)} aria-label="攻击目标">{targets.map(item => <option key={item.id} value={item.id}>{actorLabel(battle, item)}（{item.side}，HP {item.currentHp}/{item.maxHp}，AC {item.template.armorClass}）</option>)}</select></label>
      <label>攻击加值<input type="number" step={1} value={bonus} onChange={event => setBonus(event.target.value)} aria-label="攻击加值" /></label>
      <label>伤害骰<input value={damage} onChange={event => setDamage(event.target.value)} aria-label="伤害骰" placeholder="2d6+3" /></label>
      <label>伤害类型<select value={type} onChange={event => setType(event.target.value as DamageType)} aria-label="伤害类型">{damageTypes.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>距离<select value={range} aria-label="攻击距离" onChange={event => { const next = event.target.value as AttackRange; setRange(next); setDistance(next === 'melee' ? '5' : '30'); }}><option value="melee">近战</option><option value="ranged">远程</option></select></label>
      <label>距离（尺）<input type="number" min={0} max={600} step={5} value={distance} onChange={event => setDistance(event.target.value)} aria-label="与目标距离" /></label>
      <label>攻击次数<input type="number" min={1} max={maxAttacks} step={1} value={attacks} onChange={event => setAttacks(event.target.value)} aria-label="攻击次数" title={`额外攻击：本回合最多 ${maxAttacks} 次`} /></label>
      <label>检定<select value={mode} onChange={event => setMode(event.target.value as AttackMode)} aria-label="检定方式"><option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>
      <label>消耗<select value={cost} onChange={event => setCost(event.target.value as AttackCost)} aria-label="消耗动作"><option value="action">动作</option><option value="bonus">附赠动作</option><option value="reaction">反应</option></select></label>
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <div className="cmb-attack-actions"><span className="cmb-hint">伤害由本地掷骰；状态（目盲、倒地、麻痹等）会自动修正检定并结算重击，抗性、易伤、免疫与临时生命照常处理。</span><button className="button-primary" type="submit">{Number(attacks) > 1 ? `投掷 ${attacks} 次攻击` : '投掷攻击'}</button></div>
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
    onSave({ actorId: selected[0], ability, dc: parsedDc, bonus: parsedBonus });
  };
  const area = (event: React.FormEvent) => {
    event.preventDefault();
    const parsedDc = readDc();
    if (parsedDc === null) return;
    if (!selected.length) { setMessage('请至少选择一个目标。'); return; }
    if (!/^\s*\d{1,2}\s*d\s*\d{1,3}\s*([+-]\s*\d{1,3})?\s*$/i.test(damage)) { setMessage('伤害骰格式无效，请使用如 8d6 的写法。'); return; }
    setMessage('');
    onAreaSave({ targetIds: selected, ability, dc: parsedDc, damageExpression: damage, damageType: type, halfOnSuccess });
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
      <label className="cmb-check"><input type="checkbox" checked={halfOnSuccess} onChange={event => setHalfOnSuccess(event.target.checked)} />豁免成功伤害减半</label>
    </div>
    {message && <p role="alert" className="battle-error">{message}</p>}
    <div className="cmb-attack-actions"><span className="cmb-hint">单体豁免只掷骰并写入日志；范围效果对每个目标分别掷豁免，成功减半（可关闭），抗性与临时生命照常结算。</span>
      <div className="cmb-area-actions"><button className="button-secondary" type="button" onClick={single}>单体豁免</button><button className="button-primary" type="submit" onClick={area}>结算范围伤害</button></div></div>
  </div>;
}

export function CombatLog({ battle }: { battle: Battle }) {
  const log = battle.combat?.log ?? [];
  return <section className="cmb-log">
    <div className="cmb-panel-head"><div><div className="section-label">COMBAT LOG</div><h3>战斗日志</h3></div><span>{log.length} 条</span></div>
    {log.length ? <ol>{[...log].reverse().slice(0, 30).map(entry => <li key={entry.id}><div><strong>R{entry.round}</strong> {entry.text}</div>{entry.detail && <p>{entry.detail}</p>}</li>)}</ol> : <p className="cmb-hint">开始战斗后，攻击、伤害与回合变化会记录在这里。</p>}
  </section>;
}
