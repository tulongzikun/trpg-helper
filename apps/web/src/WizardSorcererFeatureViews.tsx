import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { classSpellState } from './classSpellChoices';
import type { CatalogSpell } from './wizardSorcererFeatures';
import {
  activateFleshRevelation, addMetamagic, arcaneRecoveryState, arcaneWardState, clearPortent,
  draconicAffinities, draconicAffinityState, endFleshRevelation, epicBoonState, fleshRevelationEffects,
  fleshRevelationState, innateSorceryState, masteryState, metamagicState, portentState, removeMetamagic,
  ritualState, setArcaneWardHp, setDraconicAffinity, setEpicBoon, setPortentValue, setWildSurgeEffect,
  signatureState, sorcerousRestorationState, spellcastingSummary, toggleInnateSorcery, togglePortentUsed,
  subclassFeatureNotes, telepathyState, psionicSorceryState, psionicSorceryCost,
  wildSurgeState, wizardMemorySpell, wizardScholarState,
} from './wizardSorcererFeatures';

const catalogs = Object.values(import.meta.glob('./data/imported-origin-spells.json', { eager: true, import: 'default' }) as Record<string, Record<string, { spells?: CatalogSpell[] }>>)[0];
const wizardCatalog: CatalogSpell[] = catalogs?.['法师']?.spells ?? [];

export function WizardSorcererFeatureEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
  const [metamagicDraft, setMetamagicDraft] = useState('');
  const [memoryFrom, setMemoryFrom] = useState('');
  const [memoryTo, setMemoryTo] = useState('');
  const [fleshPoints, setFleshPoints] = useState(1);
  const [fleshEffects, setFleshEffects] = useState<string[]>([]);
  const summary = spellcastingSummary(draft);
  if (!summary) return null;
  const config = draft.details?.fighterCalculator;
  const subclass = config?.subclass ?? '';
  const isSorcerer = summary.cls === '术士', isWizard = summary.cls === '法师';
  const innate = innateSorceryState(draft);
  const metamagic = metamagicState(draft);
  const restoration = sorcerousRestorationState(draft);
  const recovery = arcaneRecoveryState(draft);
  const ritual = ritualState(draft);
  const epic = epicBoonState(draft);
  const state = classSpellState(draft);
  const memory = isWizard && draft.level >= 5 ? wizardMemorySpell(draft, memoryFrom, memoryTo) : null;
  const draconic = draconicAffinityState(draft);
  const flesh = fleshRevelationState(draft);
  const wild = wildSurgeState(draft);
  const ward = arcaneWardState(draft);
  const portent = portentState(draft);
  const scholar = wizardScholarState(draft, wizardCatalog);
  const mastery = masteryState(draft);
  const signature = signatureState(draft);
  const notes = subclassFeatureNotes(draft);
  const telepathy = telepathyState(draft);
  const psionic = psionicSorceryState(draft);
  return <section className="character-section">
    <div className="section-label">T6 · 法师 / 术士</div><h2>{summary.cls}施法与职业特性</h2>
    <p className="character-help">施法属性{summary.abilityName}（调整值 {summary.modifier >= 0 ? '+' : ''}{summary.modifier}）；法术豁免 DC {summary.saveDC}；法术攻击加值 {summary.attackBonus >= 0 ? '+' : ''}{summary.attackBonus}。戏法 {summary.cantrips} / {summary.cantripLimit}；准备法术 {summary.prepared} / {summary.preparedLimit}{isWizard ? `；法术书 ${summary.book} 道` : ''}。戏法与准备法术在下方「法师 / 术士戏法与准备法术」区域选择。</p>
    {isSorcerer && <>
      <h3>先天术法</h3><p className="character-help">附赠动作激活，持续 1 分钟：术士法术的攻击检定具有优势，法术豁免 DC +1。{innate.active ? '当前已激活。' : ''}剩余 {innate.remaining} / {innate.maximum} 次；长休恢复全部。{innate.incarnation ? '（术法化身：次数耗尽后可花 2 术法点再次激活。）' : ''}{innate.apotheosis ? '（奥术化神：激活期间每回合可免费使用一次超魔法。）' : ''}</p>
      <button type="button" className="button-secondary" onClick={() => onChange(toggleInnateSorcery(draft))}>{innate.active ? '结束先天术法' : innate.remaining > 0 ? '激活先天术法' : innate.incarnation ? '花 2 术法点激活' : '无法激活（次数已用尽）'}</button>
      <h3>超魔法（{metamagic.chosen.length} / {metamagic.limit}）</h3>
      <p className="character-help">2 级选 2 项，10 级与 17 级各再选 2 项；每次施法通常只能应用一项（术法化身激活期间最多两项）。规则文本未提供本地超魔法中文列表，请按来源页填写所选项目名称；具体效果在战斗轮内手动结算。</p>
      {metamagic.chosen.map(name => <div className="revision-row" key={name}><span>{name}</span><button type="button" className="button-secondary" onClick={() => onChange(removeMetamagic(draft, name))}>移除</button></div>)}
      {metamagic.invalid && <p className="battle-error" role="alert">已选超魔法数量或重复项超过上限，请调整。</p>}
      <label>添加超魔法<input value={metamagicDraft} maxLength={40} aria-label="超魔法名称" placeholder="例如：谨慎法术" onChange={e => setMetamagicDraft(e.target.value)} /></label>
      <button type="button" className="button-secondary" disabled={!metamagicDraft.trim() || metamagic.chosen.length >= metamagic.limit} onClick={() => { onChange(addMetamagic(draft, metamagicDraft)); setMetamagicDraft(''); }}>加入已选超魔法</button>
      <h3>术法复苏（5 级）</h3><p className="character-help">{restoration.available ? `短休后最多恢复 ${restoration.maximumPoints} 点已消耗术法点，之后须完成长休才能再次使用（当前${restoration.used ? '已使用' : '未使用'}）。在「职业资源 / 特殊恢复」区域的术法回想按钮结算。` : '5 级起获得。'}</p>
    </>}
    {isWizard && <>
      <h3>奥术回想 / 仪式学家</h3><p className="character-help">奥术回想：短休时恢复总环数不超过 {recovery.maximumTotalLevels} 的法术位（不含 6 环及以上），每次长休只能用一次（当前{recovery.used ? '已使用' : '未使用'}）；在「法术位」区域选择恢复。仪式学家：{ritual.note}法术书当前 {ritual.bookCount} 道。</p>
      <h3>记忆法术（5 级，短休）</h3><p className="character-help">完成短休时，可把一道已准备的 1 环及更高环阶法师法术替换为法术书中的另一道 1 环及更高环阶法术。此按钮直接改写准备列表。</p>
      {state && <div className="character-fields">
        <label>替换已准备<select value={memoryFrom} onChange={e => setMemoryFrom(e.target.value)}><option value="">暂不选择</option>{state.prepared.filter(spell => spell && spell.level >= 1).map(spell => <option key={spell.name} value={spell.name}>{spell.level} 环 · {spell.name}</option>)}</select></label>
        <label>替换为法术书<select value={memoryTo} onChange={e => setMemoryTo(e.target.value)}><option value="">暂不选择</option>{state.book.filter(spell => spell && spell.level >= 1).map(spell => <option key={spell.name} value={spell.name} disabled={state.prepared.some(item => item && item.name === spell.name)}>{spell.level} 环 · {spell.name}</option>)}</select></label>
        <button type="button" className="button-secondary" disabled={!memoryFrom || !memoryTo} onClick={() => { if (memory?.error) return; onChange(memory!.draft); setMemoryFrom(''); setMemoryTo(''); }}>用记忆法术替换</button>
      </div>}
      {memoryFrom && memoryTo && memory?.error && <p className="battle-error" role="alert">{memory.error}</p>}
      {mastery && <p className="character-help">法术精通（18 级）：{[1, 2].map(level => `${level} 环 ${mastery.mastery[String(level)] || '未选择'}`).join('；')}。在「法师 / 术士戏法与准备法术」区域选择或长休后替换。</p>}
      {signature && <p className="character-help">招牌法术（20 级）：{signature.signature.join('、') || '未选择'}。在「法师 / 术士戏法与准备法术」区域选择。</p>}
    </>}
    {epic.available && <><h3>传奇恩惠（19 级）</h3><label>所选传奇恩惠<input value={epic.chosen} maxLength={120} aria-label="传奇恩惠" placeholder="记录所选传奇恩惠专长" onChange={e => onChange(setEpicBoon(draft, e.target.value))} /></label><p className="character-help">传奇恩惠专长的效果需手动应用。</p></>}
    {draconic.available && <><h3>元素亲和</h3><label>伤害类型<select value={draconic.chosen} onChange={e => onChange(setDraconicAffinity(draft, e.target.value as typeof draconic.chosen))}><option value="">暂不选择</option>{draconicAffinities.map(name => <option key={name} value={name}>{name}</option>)}</select></label><p className="character-help">获得所选伤害类型的抗性；施展造成该类型伤害的术士法术后，可把魅力调整值加到其中一次伤害骰上（战斗轮内结算）。</p></>}
    {flesh.available && <><h3>血肉启示</h3><p className="character-help">附赠动作并消耗 1 至 4 点术法点，变身 10 分钟；每点选择一项增益：{fleshRevelationEffects.join('、')}。当前{flesh.active ? `已激活（${flesh.points} 点：${flesh.effects.join('、')}）` : '未激活'}；剩余术法点 {flesh.remainingPoints}。</p>
      <div className="proficiency-grid">{fleshRevelationEffects.map(name => <label key={name}><input type="checkbox" checked={fleshEffects.includes(name)} onChange={e => setFleshEffects(e.target.checked ? [...fleshEffects, name] : fleshEffects.filter(item => item !== name))} />{name}</label>)}</div>
      <div className="character-fields"><label>消耗术法点<input type="number" min="1" max={fleshRevelationEffects.length} value={fleshPoints} aria-label="血肉启示消耗术法点" onChange={e => setFleshPoints(Number(e.target.value))} /></label>
        <button type="button" className="button-secondary" disabled={flesh.active || fleshPoints !== fleshEffects.length || flesh.remainingPoints < fleshPoints} onClick={() => { const result = activateFleshRevelation(draft, fleshPoints, fleshEffects); if (!result.error) { onChange(result.draft); setFleshEffects([]); setFleshPoints(1); } }}>激活血肉启示</button>
        {flesh.active && <button type="button" className="button-secondary" onClick={() => onChange(endFleshRevelation(draft))}>结束血肉启示</button>}
      </div>
      {fleshPoints !== fleshEffects.length && <p className="character-help">消耗点数需与所选增益数量一致。</p>}</>}
    {wild.available && <><h3>狂野魔法浪涌效果记录</h3><label>当前浪涌效果<input value={wild.effect} maxLength={200} aria-label="狂野魔法浪涌效果" placeholder="记录驯服浪涌选择的浪涌表效果" onChange={e => onChange(setWildSurgeEffect(draft, e.target.value))} /></label><p className="character-help">浪涌检定、d20、先攻改变与随机效果需在战斗轮内手动处理；驯服浪涌可免掷骰选择浪涌表效果（最后一行除外）。</p></>}
    {ward.available && <><h3>奥术守御结界</h3><label>结界当前生命值<input type="number" min="0" max={ward.maximum} value={ward.hp} aria-label="奥术守御结界生命值" onChange={e => onChange(setArcaneWardHp(draft, Number(e.target.value)))} /></label><p className="character-help">结界上限 = 法师等级 × 2 + 智力调整值 = {ward.maximum}。每次长休只能创建一次；用消耗法术位的方式施展防护法术时创建或恢复 2 × 环阶生命值（也可附赠动作消耗法术位恢复，无需施法）。投射守御代受伤害在战斗轮内结算。</p></>}
    {portent.available && <><h3>预兆{portent.higher ? '（高等预兆：3 颗）' : ''}</h3><p className="character-help">每完成长休掷 {portent.count}d20 并记录；可替换自己或可见生物的 D20 检定（掷前宣布，每回合一次，每颗骰使用一次）。长休后清空重掷。</p>
      <div className="character-fields">{portent.values.map((value, index) => <label key={index}>预兆 {index + 1}<input type="number" min="1" max="20" value={value || ''} aria-label={`预兆骰 ${index + 1}`} onChange={e => onChange(setPortentValue(draft, index, Number(e.target.value)))} /><button type="button" className="button-secondary" disabled={value < 1} onClick={() => onChange(togglePortentUsed(draft, index))}>{portent.used[index] ? '已使用' : '标记使用'}</button></label>)}</div>
      <button type="button" className="button-secondary" onClick={() => onChange(clearPortent(draft))}>清空并准备重掷</button></>}
    {scholar && <><h3>{scholar.school}学者免费法术</h3><p className="character-help">3 级时两道环阶不超过 2 的{schoolPlaceholder(scholar.school)}法术免费加入法术书，此后每获得一个新环阶法术位再免费加入一道。当前法术书中有 {scholar.inBook} 道{schoolPlaceholder(scholar.school)}法术，要求至少 {scholar.required} 道。{scholar.met ? '数量满足。' : '数量不足，请在法术书区域补充。'}</p>{!scholar.met && <p className="battle-error" role="alert">法术书中的{schoolPlaceholder(scholar.school)}学派法术数量少于免费习得要求，请核查。</p>}</>}
    {(notes.length > 0 || telepathy.available) && <><h3>子职特性（数值与提示）</h3>
      {telepathy.available && <p className="character-help">传心谈话：附赠动作与 30 尺内一名可见生物建立心灵链接，持续 {telepathy.durationMinutes} 分钟，范围 {telepathy.rangeMiles} 英里，双方需共享至少一种语言。</p>}
      {psionic.available && <p className="character-help">灵能术法：施展灵能法术表中的一环或更高环法术时，可花等同环阶的术法点代替法术位（例如 3 环法术需 {psionicSorceryCost(3)} 点），并忽略言语、姿势与无价值的材料成分。</p>}
      <ul className="character-help">{notes.map(note => <li key={note.name}><strong>{note.name}</strong>（{note.level} 级）：{note.text}</li>)}</ul></>}
  </section>;
}
function schoolPlaceholder(school: string): string { return `${school}学派`; }

export function WizardSorcererFeatureSheet({ draft }: { draft: CharacterDraft }) {
  const summary = spellcastingSummary(draft); if (!summary) return null;
  const innate = innateSorceryState(draft), metamagic = metamagicState(draft), epic = epicBoonState(draft);
  const draconic = draconicAffinityState(draft), flesh = fleshRevelationState(draft), ward = arcaneWardState(draft);
  const portent = portentState(draft), scholar = wizardScholarState(draft, wizardCatalog), wild = wildSurgeState(draft);
  const notes = subclassFeatureNotes(draft);
  return <section className="character-section"><h2>{summary.cls}施法</h2>
    <p className="sheet-text">施法属性{summary.abilityName}；法术豁免 DC {summary.saveDC}；法术攻击 {summary.attackBonus >= 0 ? '+' : ''}{summary.attackBonus}；戏法 {summary.cantrips} / {summary.cantripLimit}；准备法术 {summary.prepared} / {summary.preparedLimit}{summary.cls === '法师' ? `；法术书 ${summary.book} 道` : ''}。</p>
    {summary.cls === '术士' && <p className="sheet-text">先天术法：{innate.active ? `激活中（DC +1，剩余 ${innate.remaining} 次）` : `未激活（剩余 ${innate.remaining} / ${innate.maximum} 次）`}；超魔法：{metamagic.chosen.join('、') || '未选择'}（{metamagic.chosen.length} / {metamagic.limit}）。</p>}
    {epic.available && <p className="sheet-text">传奇恩惠：{epic.chosen || '未记录'}。</p>}
    {draconic.available && <p className="sheet-text">元素亲和：{draconic.chosen || '未选择'}。</p>}
    {flesh.available && <p className="sheet-text">血肉启示：{flesh.active ? `激活中（${flesh.points} 点：${flesh.effects.join('、')}）` : '未激活'}。</p>}
    {wild.available && wild.effect && <p className="sheet-text">狂野魔法浪涌：{wild.effect}。</p>}
    {ward.available && <p className="sheet-text">奥术守御结界：{ward.hp} / {ward.maximum} 生命值。</p>}
    {portent.available && <p className="sheet-text">预兆：{portent.values.map((value, index) => `${value || '未掷'}${portent.used[index] ? '（已用）' : ''}`).join('、')}。</p>}
    {scholar && <p className="sheet-text">{schoolPlaceholder(scholar.school)}免费法术：法术书 {scholar.inBook} 道 / 要求 {scholar.required} 道。</p>}
    {notes.length > 0 && <p className="sheet-text">子职特性：{notes.map(note => note.name).join('、')}。</p>}
    <p className="character-help">战斗轮内的伤害、豁免与条件结算需手动处理；本区域只记录次数与选择。</p>
  </section>;
}
