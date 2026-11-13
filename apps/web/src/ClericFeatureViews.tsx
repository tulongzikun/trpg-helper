import { useState } from 'react';
import type { CharacterDraft } from './characters';
import { classResources } from './classResources.ts';
import {
 blessedStrikeState, channelDivinityState, divineOrderState, lifeHealingBonus, lifePreserveHealing,
 lightDomainState, trickeryDomainState, warDomainState, signed,
} from './clericRogueRules.ts';
import { setBlessedStrike, setDivineOrder, useClericChannel, useGuidedStrike, useInvokeDuplicity, useLifePreserve, useRadianceOfDawn, useWarGodBlessing } from './clericRogue.ts';
import { alwaysPreparedSpells } from './preparedSpells.ts';

const remaining = (draft: CharacterDraft, id: string) => classResources(draft).find(x => x.id === id)?.remaining ?? 0;
const blessedLabel = (choice: 'divine' | 'potent' | '') => choice === 'divine' ? '神圣打击' : choice === 'potent' ? '强力施法' : '尚未选择';

export function ClericFeatureEditor({ draft, onChange }: { draft: CharacterDraft; onChange: (draft: CharacterDraft) => void }) {
 const c = draft.details?.fighterCalculator;
 const [slotLevel, setSlotLevel] = useState(1);
 const [target, setTarget] = useState<'self' | 'other'>('other');
 if (c?.characterClass !== '牧师') return null;
 const order = divineOrderState(draft), channel = channelDivinityState(draft), blessed = blessedStrikeState(draft);
 const life = lifeHealingBonus(draft, slotLevel, target), light = lightDomainState(draft), trickery = trickeryDomainState(draft), war = warDomainState(draft);
 const channelRemaining = remaining(draft, 'cleric-channel');
 const domainSpells = alwaysPreparedSpells(draft).filter(x => x.grantedAt <= draft.level);
 return <section className="character-section">
  <h2>牧师特性</h2>
  {order && <div>
   <h3>圣职</h3>
   <label>圣职选择<select aria-label="牧师圣职选择" value={order.order} onChange={e => onChange(setDivineOrder(draft, e.target.value as 'protector' | 'thaumaturge' | ''))}>
    <option value="">请选择</option>
    {order.options.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
   </select></label>
   <p className="character-help">{order.options.map(x => `${x.label}：${x.note}`).join(' ')}</p>
  </div>}
  {channel && <div>
   <h3>引导神力</h3>
   <p className="sheet-text">剩余 {channelRemaining} 次；豁免 DC {channel.saveDC}。</p>
   <p className="character-help">神圣火花：魔法动作，30 尺内恢复 {channel.sparkHeal} 点生命值，或迫使体质豁免失败的目标受到 {channel.sparkDamage} 光耀或暗蚀伤害。驱散亡灵：30 尺内感知豁免失败的目标恐慌且失能 1 分钟。</p>
   {channel.searUndead && <p className="character-help">灼净亡灵：使用驱散亡灵时投 {channel.searDice} 枚 d8（至少 1 枚），豁免失败的不死生物受到等量光耀伤害，且该效果不终止驱散。</p>}
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useClericChannel(draft))}>消耗 1 次引导神力</button>
  </div>}
  {blessed && <div>
   <h3>受祝击</h3>
   <label>受祝击选择<select aria-label="受祝击选择" value={blessed.choice} onChange={e => onChange(setBlessedStrike(draft, e.target.value as 'divine' | 'potent' | ''))}>
    <option value="">请选择</option>
    {blessed.options.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
   </select></label>
   <p className="sheet-text">当前：{blessedLabel(blessed.choice)}</p>
   <p className="character-help">{blessed.options.map(x => `${x.label}：${x.note}`).join(' ')}</p>
  </div>}
  {c?.subclass === 'life' && life && <div>
   <h3>生命领域</h3>
   <label>用于恢复生命的法术位环阶<select aria-label="生命领域治疗法术位环阶" value={slotLevel} onChange={e => setSlotLevel(Number(e.target.value))}>
    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n} 环</option>)}
   </select></label>
   <label>治疗目标<select aria-label="生命领域治疗目标" value={target} onChange={e => setTarget(e.target.value as 'self' | 'other')}>
    <option value="other">其他生物</option>
    <option value="self">自己</option>
   </select></label>
   <p className="sheet-text">生命门徒：目标额外恢复 {life.disciple} 点生命值。{life.healer ? `神祝医者：你自己恢复 ${life.healer} 点生命值。` : ''}</p>
   {life.maximized && <p className="character-help">极效治疗：法术或引导神力的治疗骰直接取最大值。</p>}
   <p className="character-help">维持生命：魔法动作展示圣徽并消耗 1 次引导神力，恢复总计 {lifePreserveHealing(draft)} 点生命值，分配给 30 尺内浴血生物（可包括自己）；每个目标至多恢复到其生命值上限的一半。</p>
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useLifePreserve(draft))}>维持生命（消耗 1 次引导神力）</button>
  </div>}
  {c?.subclass === 'light' && light && <div>
   <h3>光明领域</h3>
   <p className="sheet-text">守御之光：剩余 {remaining(draft, 'cleric-light-warding')} / {light.wardingUses} 次。{light.improved ? `6 级起短休或长休恢复全部，且使用时给被攻击目标 ${light.wardingTempHp} 点临时生命值。` : '长休恢复。'}</p>
   <p className="character-help">黎明曙光：魔法动作展示圣徽并消耗 1 次引导神力，解除 30 尺光环内的魔法黑暗；选中的生物体质豁免失败则受 {light.radianceDamage} 光耀伤害，成功半伤（DC {light.radianceDC}）。</p>
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useRadianceOfDawn(draft))}>黎明曙光（消耗 1 次引导神力）</button>
   {light.corona && <p className="sheet-text">光冕：剩余 {remaining(draft, 'cleric-light-corona')} / {light.coronaUses} 次；1 分钟内 60 尺明亮光照与额外 30 尺微光，光内敌人对抗黎明曙光及火焰/光耀法术的豁免具有劣势。</p>}
  </div>}
  {c?.subclass === 'trickery' && trickery && <div>
   <h3>诡术领域</h3>
   <p className="character-help">诡术祝福：魔法动作选择自己或 30 尺内自愿生物，其敏捷（隐匿）检定具有优势，持续至长休或再次使用。</p>
   <p className="character-help">召现分身：附赠动作消耗 1 次引导神力，在 30 尺内未占据空间创造持续 1 分钟的幻象；可从幻象位置施法、与幻象夹击时攻击具有优势，并可用附赠动作移动幻象至多 30 尺。</p>
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useInvokeDuplicity(draft))}>召现分身（消耗 1 次引导神力）</button>
   {trickery.swap && <p className="character-help">诡诈换位：用附赠动作创造或移动幻象时，可传送并与幻象交换位置。</p>}
   {trickery.improved && <p className="character-help">精通分身：幻象 5 尺内你与盟友的攻击具有优势；幻象消失时，你或 5 尺内一名生物恢复等于牧师等级的生命值。</p>}
  </div>}
  {c?.subclass === 'war' && war && <div>
   <h3>战争领域</h3>
   <p className="character-help">导引打击：你或 30 尺内生物的攻击检定失手时，消耗 1 次引导神力使该攻击检定 +{war.guidedStrikeBonus}；替其他生物使用时以反应进行。</p>
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useGuidedStrike(draft))}>导引打击（消耗 1 次引导神力）</button>
   <p className="sheet-text">战争祭司：剩余 {remaining(draft, 'cleric-war-priest')} / {war.warPriestUses} 次；附赠动作进行一次武器攻击或徒手打击，短休或长休恢复全部。</p>
   {war.godBlessing && <p className="character-help">战神祝福：可用引导神力施展虔诚护盾或灵体武器，无需法术位与专注，持续 1 分钟。</p>}
   <button type="button" className="button-secondary" disabled={!channelRemaining} onClick={() => onChange(useWarGodBlessing(draft))}>战神祝福（消耗 1 次引导神力）</button>
   {war.avatar && <p className="character-help">战争化身：获得钝击、穿刺、挥砍伤害抗性。</p>}
  </div>}
  {domainSpells.length > 0 && <><h3>领域法术</h3><p className="character-help">始终准备：{domainSpells.map(x => x.name).join('、')}。领域法术不计入准备数量，已在准备法术区域标注。</p></>}
 </section>;
}

export function ClericFeatureSheet({ draft }: { draft: CharacterDraft }) {
 const c = draft.details?.fighterCalculator;
 if (c?.characterClass !== '牧师') return null;
 const order = divineOrderState(draft), channel = channelDivinityState(draft), blessed = blessedStrikeState(draft);
 const life = lifeHealingBonus(draft, 1, 'other'), light = lightDomainState(draft), trickery = trickeryDomainState(draft), war = warDomainState(draft);
 const domainSpells = alwaysPreparedSpells(draft).filter(x => x.grantedAt <= draft.level);
 return <section className="character-section">
  <h2>牧师特性</h2>
  {order && <p className="sheet-text">圣职：{order.order ? (order.order === 'protector' ? '保护者' : `奇术使（奥秘/宗教 ${signed(order.bonus)}）`) : '尚未选择'}</p>}
  {channel && <p className="sheet-text">引导神力：剩 {remaining(draft, 'cleric-channel')} 次；神圣火花 {channel.sparkHeal}；驱散亡灵 DC {channel.saveDC}。{channel.searUndead ? `灼净亡灵：${channel.searDice} 枚 d8。` : ''}</p>}
  {blessed && <p className="sheet-text">受祝击：{blessedLabel(blessed.choice)}。{blessed.choice === 'divine' ? `武器命中额外 ${blessed.divineDice}d8。` : blessed.choice === 'potent' ? `戏法伤害 ${signed(blessed.potentBonus)}${blessed.improved ? `，造成伤害时获得 ${blessed.tempHp} 点临时生命。` : '。'}` : '未选择。'}</p>}
  {c?.subclass === 'life' && life && <p className="sheet-text">生命领域：生命门徒 +{life.disciple} 生命；{life.healer ? `神祝医者自身 +${life.healer}；` : ''}{life.maximized ? '极效治疗取满；' : ''}维持生命 {lifePreserveHealing(draft)} 点（消耗 1 次引导神力）。</p>}
  {c?.subclass === 'light' && light && <p className="sheet-text">光明领域：守御之光 {remaining(draft, 'cleric-light-warding')} / {light.wardingUses} 次；黎明曙光 {light.radianceDamage} 光耀（DC {light.radianceDC}）；{light.corona ? `光冕 ${remaining(draft, 'cleric-light-corona')} / ${light.coronaUses} 次。` : ''}</p>}
  {c?.subclass === 'trickery' && trickery && <p className="sheet-text">诡术领域：诡术祝福（隐匿优势）；召现分身；{trickery.swap ? '诡诈换位；' : ''}{trickery.improved ? '精通分身。' : ''}</p>}
  {c?.subclass === 'war' && war && <p className="sheet-text">战争领域：导引打击 +{war.guidedStrikeBonus}；战争祭司 {remaining(draft, 'cleric-war-priest')} / {war.warPriestUses} 次；{war.godBlessing ? '战神祝福；' : ''}{war.avatar ? '战争化身（钝击/穿刺/挥砍抗性）。' : ''}</p>}
  {domainSpells.length > 0 && <p className="character-help">领域法术始终准备：{domainSpells.map(x => x.name).join('、')}。</p>}
 </section>;
}
