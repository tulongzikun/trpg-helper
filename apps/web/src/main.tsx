import { SpellLibrary } from './SpellLibrary';
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { cards, errors, filterCards, crValue, normalizedType, type Card, type Feature } from './catalog';
import './style.css';
import { AddMonsterDialog, BattleView } from './BattleViews';
import { Characters } from './CharacterViews';
import type { CharacterSnapshot } from './characters';
import { addCharacter, addMonsters, emptyStore, readBattles, removeActor, writeBattles, type BattleStore, type Side } from './battle';
import { importBattle } from './battleTransfer';
import { autoAct, autoSide, autoTurn } from './combatAuto';
import { applyFallDamage } from './combatMovement';
import { castSpell, setSpellSlots, counterspell, resolvePendingCast, setCounterspell } from './combatSpells';
import { addHazard, addOngoingEffect, addAura, areaSave, attack, attackSequence, currentActorId, escapeGrapple, offhandAttack, grapple, shove, addReinforcement, configureGrid, setAutoDeathSaves, setEnterReachOpportunity, setObscured, setTerrain, parry, castBless, blessTargets, castShieldReaction, castHaste, castInvisible, spellTargets, castGrease, castWeb, escapeWeb, castFogCloud, castDarkness, castSleepCloud, castHoldPerson, castCommand, castSilence, castSlow, castCharmPerson, castFear, castDispelMagic, markSurprised, castSleep, hostileTargets, wakeUp, setDefensiveDuelist, setDualWielder, setExhaustion, takeLongRest, declineOpportunity, standUp, disengage, dodge, dash, help, helpCheck, hide, drinkHealingPotion, throwFlask, drinkAntitoxin, dismissSummon, endConcentration, endTurn, markSummon, jumpToCell, moveActorToCell, opportunityAttack, readyAction, cancelReadyAction, triggerReadyAction, reloadAmmo, removeAura, removeHazard, hazardAt, removeOngoingEffect, resetCombat, rollDeathSave, savingThrow, secondWind, setActorHp, setTempHp, spendMovement, spendResource, startCombat, addItem, addUnidentifiedItem, protectAlly, useItem, startConcentration, rerollInitiative, studyTarget, setWarCaster, setInitiative, abilityCheck, healActor, cunningAction, recklessAttack, toggleCondition, toggleDifficultCell, toggleWallCell, undoCombat, useActionSurge, buttEndAttack, setSentinel, stabilize, delayTurn, setFlying, setElevation, diveAttack, dropDown, resolveReadyPrompt, jumpBack, saveAttackPreset, removeAttackPreset, attackWithPreset, lootCorpse, lootAll, giveItem, identifyItem } from './combat';
import type { CombatHandlers } from './CombatViews';

const unique = (xs: string[]) => [...new Set(xs)].sort((a,b) => a.localeCompare(b, 'zh-CN'));
const types = unique(cards.flatMap(c => c.block.creatureTypes.map(normalizedType)));
const habitats = unique(cards.flatMap(c => c.entry.habitats ?? []));
const crs = unique(cards.flatMap(c => c.block.challengeRating ? [c.block.challengeRating] : [])).sort((a,b) => crValue(a)-crValue(b));
const initial = new URLSearchParams(location.search);
const abilityNames: Record<string,string> = { str:'力量', dex:'敏捷', con:'体质', int:'智力', wis:'感知', cha:'魅力' };
const sign = (n: number) => n >= 0 ? `+${n}` : `${n}`;
function Features({ title, features }: {title: string; features?: Feature[]}) { if (!features?.length) return null; return <section className="feature-section"><h3>{title}</h3>{features.map(f => <div className="feature" key={f.id}><div className="feature-heading"><strong>{f.name}</strong><span className="manual">{f.automation === 'manual' ? '人工裁定' : f.automation === 'partial' ? '部分支持' : '可自动结算'}</span></div><p>{f.description}</p>{f.automationNotes && <p>{f.automationNotes}</p>}</div>)}</section> }
function Detail({ card, close, onAdd }: { card: Card; close: () => void; onAdd: () => void }) { const {entry:e, block:b} = card; const rows: [string, string | undefined][] = [['先攻', b.initiativeBonus === undefined ? undefined : sign(b.initiativeBonus)], ['熟练加值', b.proficiencyBonus === undefined ? undefined : sign(b.proficiencyBonus)], ['经验值', b.experiencePoints === undefined ? undefined : String(b.experiencePoints)], ['速度', Object.entries(b.speedFt).map(([k,v])=>`${k} ${v} 尺`).join('，')], ['豁免（不同于属性调整值）', b.savingThrows && Object.entries(b.savingThrows).filter(([k,v])=>b.abilities[k] === undefined || v !== Math.floor((b.abilities[k]-10)/2)).map(([k,v])=>`${abilityNames[k] ?? k} ${sign(v)}`).join('，')], ['技能', b.skills && Object.entries(b.skills).map(([k,v])=>`${k} ${sign(v)}`).join('，')], ['感官', b.senses?.join('，')], ['语言', b.languages?.join('，')], ['伤害抗性', b.damageResistances?.join('，')], ['伤害免疫', b.damageImmunities?.join('，')], ['伤害易伤', b.damageVulnerabilities?.join('，')], ['状态免疫', b.conditionImmunities?.join('，')], ['装备', b.gear?.join('，')]]; return <article className="detail"><button className="back" onClick={close}>← 返回图鉴</button><div className="detail-top"><div><div className="eyebrow">BESTIARY / 怪物资料</div><h1>{b.name}</h1><p className="english">{e.englishName ?? 'Monster entry'}</p></div><div className="detail-actions"><span className="detail-cr"><small>挑战等级</small>{b.challengeRating ?? '—'}</span><button className="button-primary" onClick={onAdd}>＋ 加入战斗</button></div></div><div className="detail-grid"><section className="statblock"><div className="stat-header"><span>CREATURE STAT BLOCK</span><span>数据卡 / 01</span></div><h2>{b.name}</h2><p className="stat-sub">{b.size} · {b.creatureTypes.join('、')} · {b.rule.edition === 'dnd5e-2014' ? '2014' : '2024'} 规则格式</p><div className="stat-summary"><div><small>护甲等级</small><strong>{b.armorClass}</strong></div><div><small>生命值</small><strong>{b.hitPoints.average} <i>{b.hitPoints.dice && `(${b.hitPoints.dice})`}</i></strong></div><div><small>挑战等级</small><strong>{b.challengeRating ?? '—'}</strong></div></div><div className="abilities">{Object.entries(abilityNames).map(([key,name]) => <div key={key}><small>{name}</small><strong>{b.abilities[key]}</strong><span>{sign(Math.floor((b.abilities[key]-10)/2))}</span></div>)}</div><div className="stat-rows">{rows.filter(([,v])=>v).map(([k,v])=><p key={k}><strong>{k}</strong> {v}</p>)}</div><Features title="特性" features={b.traits}/><Features title="动作" features={b.actions}/><Features title="附赠动作" features={b.bonusActions}/><Features title="反应" features={b.reactions}/><Features title="传奇动作" features={b.legendaryActions}/>{b.sourceText && <details className="original"><summary>查看原始数据卡文本</summary><pre>{b.sourceText}</pre></details>}</section><div><section className="story"><div className="section-label">01 / 生物档案</div><h2>关于{e.name}</h2><p>{e.description || '暂无背景介绍。'}</p><div className="metadata"><div><small>栖息地</small><strong>{e.habitats?.join('、') || '未提供'}</strong></div><div><small>宝藏</small><strong>{e.treasure || '未提供'}</strong></div><div><small>资料来源</small><strong>{e.source.url ? <a href={e.source.url} target="_blank" rel="noreferrer">{e.source.name} ↗</a> : e.source.name}</strong></div></div>{e.lair && <><h3>巢穴</h3><p>{e.lair}</p></>}</section><div className="notice"><span>✦</span><div><strong>关于这些资料</strong><p>自动提取的数据可能存在遗漏，请核对原始数据卡；能力效果需由主持人裁定。</p></div></div></div></div></article> }

function App() {
 const [view,setView]=useState<'catalog'|'battles'|'characters'|'spells'>('catalog'); const [showAdd,setShowAdd]=useState(false); const [activeBattle,setActiveBattle]=useState('');
 const [state,setState]=useState<{store:BattleStore; error:string; blocked:boolean}>(()=>{ try{return {store:readBattles(localStorage),error:'',blocked:false}}catch(e){return {store:emptyStore(),error:e instanceof Error?e.message:'无法读取本地战斗。',blocked:true}} });
 const commit=(next:BattleStore)=>{ if(state.blocked) throw new Error(state.error); writeBattles(localStorage,next); setState({store:next,error:'',blocked:false}); };
 const onAdd=(options:{battleId?:string;newBattleName?:string;side:Side;count:number}):string|null=>{try{if(!chosen) throw new Error('未找到怪物数据。'); const result=addMonsters(state.store,chosen,options);commit(result.store);setActiveBattle(result.battleId);setShowAdd(false);setView('battles');window.scrollTo(0,0);return null}catch(e){return e instanceof Error?e.message:'无法保存战斗。'}};
 const onImportCharacter=(snapshot:CharacterSnapshot,options:{battleId?:string;newBattleName?:string;side:Side}):string|null=>{try{const result=addCharacter(state.store,snapshot,options);commit(result.store);setActiveBattle(result.battleId);setView('battles');window.scrollTo(0,0);return null}catch(e){return e instanceof Error?e.message:'无法保存战斗。'}};
 const importBattleText=(text:string)=>{try{const battle=importBattle(text,state.store.battles.map(b=>b.id));commit({...state.store,battles:[...state.store.battles,battle]});setActiveBattle(battle.id);setView('battles');window.scrollTo(0,0)}catch(e){setState(old=>({...old,error:e instanceof Error?e.message:'无法导入战斗。'}))}};
 const changeHp=(battleId:string,actorId:string,hp:number)=>{try{changeBattle(battleId,battle=>setActorHp(battle,actorId,hp))}catch(e){setState(old=>({...old,error:e instanceof Error?e.message:'无法保存生命值。'}))}};
 const changeBattle=(battleId:string,change:(battle:BattleStore['battles'][number])=>BattleStore['battles'][number])=>{const next=structuredClone(state.store);const index=next.battles.findIndex(b=>b.id===battleId);if(index<0)throw new Error('战斗不存在，请重新选择。');next.battles[index]=change(next.battles[index]);commit(next)};
 const bindCombat=(battleId:string):CombatHandlers=>({
  onStart:initiatives=>tryBattle(()=>changeBattle(battleId,battle=>startCombat(battle,initiatives))),
  onEndTurn:()=>tryBattle(()=>changeBattle(battleId,battle=>endTurn(battle))),
  onUndo:()=>tryBattle(()=>changeBattle(battleId,battle=>undoCombat(battle))),
  onReset:()=>tryBattle(()=>changeBattle(battleId,battle=>resetCombat(battle))),
  onAttack:options=>tryBattle(()=>changeBattle(battleId,battle=>attack(battle,options).battle)),
  onAttackSequence:options=>tryBattle(()=>changeBattle(battleId,battle=>attackSequence(battle,options).battle)),
  onOffhand:options=>tryBattle(()=>changeBattle(battleId,battle=>offhandAttack(battle,options).battle)),
  onButtEnd:options=>tryBattle(()=>changeBattle(battleId,battle=>buttEndAttack(battle,options).battle)),
  onDive:options=>tryBattle(()=>changeBattle(battleId,battle=>diveAttack(battle,options).battle)),
  onDropDown:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>dropDown(battle,actorId).battle)),
  onGrapple:targetId=>tryBattle(()=>changeBattle(battleId,battle=>grapple(battle,{attackerId:currentActorId(battle)??'',targetId}).battle)),
  onShove:(targetId,effect)=>tryBattle(()=>changeBattle(battleId,battle=>shove(battle,{attackerId:currentActorId(battle)??'',targetId,effect}).battle)),
  onEscapeGrapple:actorId=>tryBattle(()=>changeBattle(battleId,battle=>escapeGrapple(battle,actorId).battle)),
  onAuto:actorId=>tryBattle(()=>changeBattle(battleId,battle=>autoAct(battle,actorId).battle)),
  onAutoTurn:actorId=>tryBattle(()=>changeBattle(battleId,battle=>autoTurn(battle,actorId).battle)),
  onAutoSide:side=>tryBattle(()=>changeBattle(battleId,battle=>autoSide(battle,side).battle)),
  onFall:(actorId,feet)=>tryBattle(()=>changeBattle(battleId,battle=>applyFallDamage(battle,actorId,feet).battle)),
  onCast:options=>tryBattle(()=>changeBattle(battleId,battle=>castSpell(battle,options).battle)),
  onSetSlots:(actorId,slots)=>tryBattle(()=>changeBattle(battleId,battle=>setSpellSlots(battle,actorId,slots))),
  onObscured:level=>tryBattle(()=>changeBattle(battleId,battle=>setObscured(battle,level))),
  onLongRest:()=>tryBattle(()=>changeBattle(battleId,battle=>takeLongRest(battle))),
  onExhaustion:(actorId,level)=>tryBattle(()=>changeBattle(battleId,battle=>setExhaustion(battle,actorId,level))),
  onElevation:(actorId,feet)=>tryBattle(()=>changeBattle(battleId,battle=>setElevation(battle,actorId,feet))),
  onFlying:(actorId,enabled)=>tryBattle(()=>changeBattle(battleId,battle=>setFlying(battle,actorId,enabled))),
  onDelay:actorId=>tryBattle(()=>changeBattle(battleId,battle=>delayTurn(battle,actorId))),
  onSentinel:(actorId,enabled)=>tryBattle(()=>changeBattle(battleId,battle=>setSentinel(battle,actorId,enabled))),
  onDualWielder:(actorId,enabled)=>tryBattle(()=>changeBattle(battleId,battle=>setDualWielder(battle,actorId,enabled))),
  onDefensiveDuelist:(actorId,enabled)=>tryBattle(()=>changeBattle(battleId,battle=>setDefensiveDuelist(battle,actorId,enabled))),
      onWarCaster:(actorId:string,enabled:boolean)=>tryBattle(()=>changeBattle(battleId,battle=>setWarCaster(battle,actorId,enabled))),
  onSetCounterspell:(actorId,enabled)=>tryBattle(()=>changeBattle(battleId,battle=>setCounterspell(battle,actorId,enabled))),
  onCounterspell:reactorId=>tryBattle(()=>changeBattle(battleId,battle=>counterspell(battle,reactorId).battle)),
  onResolveCast:()=>tryBattle(()=>changeBattle(battleId,battle=>resolvePendingCast(battle).battle)),
  onSavePreset:input=>tryBattle(()=>changeBattle(battleId,battle=>saveAttackPreset(battle,input).battle)),
  onUsePreset:presetId=>tryBattle(()=>changeBattle(battleId,battle=>attackWithPreset(battle,presetId).battle)),
  onRemovePreset:presetId=>tryBattle(()=>changeBattle(battleId,battle=>removeAttackPreset(battle,presetId))),
  onParry:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>parry(battle,actorId))),
      onBless:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>castBless(battle,actorId,blessTargets(battle,actorId).map(item=>item.id).slice(0,3)))),
      onShield:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>castShieldReaction(battle,actorId))),
      onGrease:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castGrease(battle,actorId,cells))),
      onWeb:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castWeb(battle,actorId,cells))),
      onEscapeWeb:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>escapeWeb(battle,actorId).battle)),
      onFog:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castFogCloud(battle,actorId,cells))),
      onDarkness:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castDarkness(battle,actorId,cells))),
  onSleepCloud:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castSleepCloud(battle,actorId,cells))),
      onHold:(actorId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>castHoldPerson(battle,actorId,targetId||hostileTargets(battle,actorId,60)[0]?.id||''))),
      onCommand:(actorId,targetId,command)=>tryBattle(()=>changeBattle(battleId,battle=>castCommand(battle,actorId,targetId||hostileTargets(battle,actorId,60)[0]?.id||'',command))),
      onSlow:(actorId,targetIds)=>tryBattle(()=>changeBattle(battleId,battle=>castSlow(battle,actorId,targetIds))),
      onCharm:(actorId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>castCharmPerson(battle,actorId,targetId||hostileTargets(battle,actorId,30)[0]?.id||''))),
onFear:(actorId,targetIds)=>tryBattle(()=>changeBattle(battleId,battle=>castFear(battle,actorId,targetIds.length?targetIds:hostileTargets(battle,actorId,30).slice(0,3).map(item=>item.id)))),
      onDispel:(actorId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>castDispelMagic(battle,actorId,targetId||hostileTargets(battle,actorId,120)[0]?.id||'').battle)),
      onSurprise:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>markSurprised(battle,[actorId]))),
      onSilence:(actorId,cells)=>tryBattle(()=>changeBattle(battleId,battle=>castSilence(battle,actorId,cells))),
      onSleep:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>castSleep(battle,actorId,spellTargets(battle,actorId,20).map(item=>item.id)).battle)),
      onWake:(actorId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>wakeUp(battle,actorId,targetId))),
      onHaste:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>castHaste(battle,actorId,spellTargets(battle,actorId)[0]?.id??''))),
      onInvisible:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>castInvisible(battle,actorId,spellTargets(battle,actorId)[0]?.id??''))),
  onSave:options=>tryBattle(()=>changeBattle(battleId,battle=>savingThrow(battle,options).battle)),
  onAreaSave:options=>tryBattle(()=>changeBattle(battleId,battle=>areaSave(battle,options).battle)),
  onConcentration:(actorId,spell)=>tryBattle(()=>changeBattle(battleId,battle=>spell?startConcentration(battle,actorId,spell):endConcentration(battle,actorId))),
  onAddOngoing:(targetId,input)=>tryBattle(()=>changeBattle(battleId,battle=>addOngoingEffect(battle,targetId,input).battle)),
  onRemoveOngoing:(targetId,effectId)=>tryBattle(()=>changeBattle(battleId,battle=>removeOngoingEffect(battle,targetId,effectId))),
  onSummon:(actorId,ownerId,spell,rounds)=>tryBattle(()=>changeBattle(battleId,battle=>markSummon(battle,actorId,{ownerId,spell,rounds}))),
  onDismissSummon:actorId=>tryBattle(()=>changeBattle(battleId,battle=>dismissSummon(battle,actorId))),
  onReloadAmmo:actorId=>tryBattle(()=>changeBattle(battleId,battle=>reloadAmmo(battle,actorId))),
  onAura:input=>tryBattle(()=>changeBattle(battleId,battle=>addAura(battle,input))),
  onRemoveAura:auraId=>tryBattle(()=>changeBattle(battleId,battle=>removeAura(battle,auraId))),
  onGrid:grid=>tryBattle(()=>changeBattle(battleId,battle=>configureGrid(battle,grid))),
  onPlace:(actorId,x,y)=>tryBattle(()=>changeBattle(battleId,battle=>moveActorToCell(battle,actorId,x,y))),
  onJump:(actorId,x,y)=>tryBattle(()=>changeBattle(battleId,battle=>jumpToCell(battle,actorId,x,y))),
  onDifficult:(x,y)=>tryBattle(()=>changeBattle(battleId,battle=>toggleDifficultCell(battle,x,y))),
  onWall:(x,y)=>tryBattle(()=>changeBattle(battleId,battle=>toggleWallCell(battle,x,y))),
  onHazard:(x,y,expression,type)=>tryBattle(()=>changeBattle(battleId,battle=>hazardAt(battle,x,y)?removeHazard(battle,x,y):addHazard(battle,{x,y,damageExpression:expression,damageType:type}))),
  onDisengage:actorId=>tryBattle(()=>changeBattle(battleId,battle=>disengage(battle,actorId))),
    onTerrain:(terrain)=>tryBattle(()=>changeBattle(battleId,battle=>setTerrain(battle,terrain))),
      onAutoDeathSaves:(enabled:boolean)=>tryBattle(()=>changeBattle(battleId,battle=>setAutoDeathSaves(battle,enabled))),
      onEnterReachOpportunity:(enabled:boolean)=>tryBattle(()=>changeBattle(battleId,battle=>setEnterReachOpportunity(battle,enabled))),
      onInitiative:(actorId:string,initiative:number)=>tryBattle(()=>changeBattle(battleId,battle=>setInitiative(battle,actorId,initiative))),
      onRerollInitiative:()=>tryBattle(()=>changeBattle(battleId,battle=>rerollInitiative(battle))),
      onCheck:(options)=>tryBattle(()=>changeBattle(battleId,battle=>abilityCheck(battle,options).battle)),
      onStudy:(targetId:string)=>tryBattle(()=>changeBattle(battleId,battle=>studyTarget(battle,currentActorId(battle) ?? '',targetId).battle)),
      onStabilize:targetId=>tryBattle(()=>changeBattle(battleId,battle=>stabilize(battle,currentActorId(battle) ?? '',targetId).battle)),
  onHeal:(targetId,amount)=>tryBattle(()=>changeBattle(battleId,battle=>healActor(spendResource(battle,currentActorId(battle) ?? '', 'action'),targetId,amount))),
  onDodge:actorId=>tryBattle(()=>changeBattle(battleId,battle=>dodge(battle,actorId))),
  onDash:actorId=>tryBattle(()=>changeBattle(battleId,battle=>dash(battle,actorId))),
  onHide:actorId=>tryBattle(()=>changeBattle(battleId,battle=>hide(battle,actorId))),
  onPotion:actorId=>tryBattle(()=>changeBattle(battleId,battle=>drinkHealingPotion(battle,actorId).battle)),
  onThrowFlask:(actorId,kind,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>throwFlask(battle,actorId,targetId,kind).battle)),
  onAntitoxin:(actorId)=>tryBattle(()=>changeBattle(battleId,battle=>drinkAntitoxin(battle,actorId))),
  onReckless:actorId=>tryBattle(()=>changeBattle(battleId,battle=>recklessAttack(battle,actorId))),
  onCunning:kind=>tryBattle(()=>changeBattle(battleId,battle=>cunningAction(battle,currentActorId(battle) ?? '',kind))),
  onHelp:(helperId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>help(battle,helperId,targetId))),
  onHelpCheck:(helperId,targetId)=>tryBattle(()=>changeBattle(battleId,battle=>helpCheck(battle,helperId,targetId))),
      onProtect:(protectorId:string,targetId:string)=>tryBattle(()=>changeBattle(battleId,battle=>protectAlly(battle,protectorId,targetId))),
      onAddItem:(actorId:string,name:string,quantity:number,healExpression:string,identified:boolean)=>tryBattle(()=>changeBattle(battleId,battle=>identified ? addItem(battle,actorId,name,quantity,healExpression || undefined) : addUnidentifiedItem(battle,actorId,name,quantity,healExpression || undefined))),
      onIdentify:(actorId:string,name:string)=>tryBattle(()=>changeBattle(battleId,battle=>identifyItem(battle,actorId,name))),
      onLoot:(looterId:string,targetId:string)=>tryBattle(()=>changeBattle(battleId,battle=>lootCorpse(battle,looterId,targetId).battle)),
  onLootAll:(looterId)=>tryBattle(()=>changeBattle(battleId,battle=>lootAll(battle,looterId).battle)),
      onGive:(fromId:string,toId:string,name:string)=>tryBattle(()=>changeBattle(battleId,battle=>giveItem(battle,fromId,toId,name).battle)),
      onUseItem:(actorId:string,name:string,targetId?:string)=>tryBattle(()=>changeBattle(battleId,battle=>useItem(battle,actorId,name,targetId).battle)),
  onStand:actorId=>tryBattle(()=>changeBattle(battleId,battle=>standUp(battle,actorId))),
  onReady:(actorId,input)=>tryBattle(()=>changeBattle(battleId,battle=>readyAction(battle,actorId,input))),
  onTriggerReady:actorId=>tryBattle(()=>changeBattle(battleId,battle=>triggerReadyAction(battle,actorId))),
  onCancelReady:actorId=>tryBattle(()=>changeBattle(battleId,battle=>cancelReadyAction(battle,actorId))),
  onOpportunity:reactorId=>tryBattle(()=>changeBattle(battleId,battle=>opportunityAttack(battle,reactorId).battle)),
  onDeclineOpportunity:reactorId=>tryBattle(()=>changeBattle(battleId,battle=>declineOpportunity(battle,reactorId))),
  onReadyPrompt:reactorId=>tryBattle(()=>changeBattle(battleId,battle=>resolveReadyPrompt(battle,reactorId))),
  onActionSurge:actorId=>tryBattle(()=>changeBattle(battleId,battle=>useActionSurge(battle,actorId))),
  onSecondWind:actorId=>tryBattle(()=>changeBattle(battleId,battle=>secondWind(battle,actorId).battle)),
  onDeathSave:actorId=>tryBattle(()=>changeBattle(battleId,battle=>rollDeathSave(battle,actorId).battle)),
  onCondition:(actorId,condition)=>tryBattle(()=>changeBattle(battleId,battle=>toggleCondition(battle,actorId,condition))),
  onMove:(actorId,feet)=>tryBattle(()=>changeBattle(battleId,battle=>spendMovement(battle,actorId,feet))),
  onSpend:(actorId,kind)=>tryBattle(()=>changeBattle(battleId,battle=>spendResource(battle,actorId,kind))),
  onTempHp:(actorId,tempHp)=>tryBattle(()=>changeBattle(battleId,battle=>setTempHp(battle,actorId,tempHp))),
 });
 const tryBattle=(action:()=>void)=>{try{action();setState(old=>({...old,error:''}))}catch(e){setState(old=>({...old,error:e instanceof Error?e.message:'无法保存战斗。'}))}};
 const deleteActor=(battleId:string,actorId:string)=>{try{commit(removeActor(state.store,battleId,actorId))}catch(e){setState(old=>({...old,error:e instanceof Error?e.message:'无法保存战斗。'}))}};
 const [page,setPage]=useState(1); const [query,setQuery]=useState(initial.get('q') ?? ''); const [type,setType]=useState(initial.get('type') ?? ''); const [cr,setCr]=useState(initial.get('cr') ?? ''); const [habitat,setHabitat]=useState(initial.get('habitat') ?? ''); const [sort,setSort]=useState(initial.get('sort') ?? 'name'); const [selected,setSelected]=useState(initial.get('monster') ?? '');
 const results=useMemo(()=>filterCards(cards,query,type,cr,habitat,sort),[query,type,cr,habitat,sort]);
 useEffect(()=>{ const p=new URLSearchParams(); if(query)p.set('q',query);if(type)p.set('type',type);if(cr)p.set('cr',cr);if(habitat)p.set('habitat',habitat);if(sort!=='name')p.set('sort',sort);if(selected)p.set('monster',selected); history.replaceState(null,'',`${location.pathname}${p.size ? `?${p}` : ''}`); },[query,type,cr,habitat,sort,selected]);
 useEffect(()=>{setPage(1)},[query,type,cr,habitat,sort]);
 const chosen=cards.find(c=>c.block.id===selected); const clear=()=>{setQuery('');setType('');setCr('');setHabitat('');setSort('name')};
 return <div className="app"><header className="topbar"><div className="brand"><span className="brand-mark">✳</span><div><strong>TRPG HELPER</strong><small>冒险者的案头手册</small></div></div><nav aria-label="主导航"><button className={view==='catalog'?'nav-active':'nav-button'} onClick={()=>setView('catalog')}>怪物图鉴</button><button className={view==='spells'?'nav-active':'nav-button'} onClick={()=>setView('spells')}>法术库</button><button className={view==='characters'?'nav-active':'nav-button'} onClick={()=>setView('characters')}>角色库</button><button className={view==='battles'?'nav-active':'nav-button'} onClick={()=>setView('battles')}>战斗</button></nav><div className="edition">THE BESTIARY <span> / </span> 01</div></header>
 <main>{view==='spells' ? <SpellLibrary/> : view==='characters' ? <Characters battles={state.store} onImport={onImportCharacter}/> : view==='battles' ? <BattleView store={state.store} selectedId={activeBattle} onSelect={setActiveBattle} onCatalog={()=>{setView('catalog');setSelected('')}} onHp={changeHp} onRemove={deleteActor} bindCombat={bindCombat} onImportBattle={importBattleText} onReplayJump={steps=>tryBattle(()=>changeBattle(activeBattle,battle=>jumpBack(battle,steps)))} onReinforce={(battleId,card,input)=>tryBattle(()=>changeBattle(battleId,battle=>addReinforcement(battle,card,input).battle))} cards={cards} error={state.error}/> : chosen ? <Detail card={chosen} close={()=>setSelected('')} onAdd={()=>setShowAdd(true)}/> : <><div className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-line"/> THE ADVENTURER'S ARCHIVE <span className="dot">✦</span> VOL. 01</div><h1>怪物图鉴<span>。</span></h1><p>翻开未知的篇章，遇见旅途中的每一种生灵。</p></div><div className="hero-emblem" aria-hidden="true"><span>✳</span><small>FIELD NOTES<br/>OF THE UNKNOWN</small></div><div className="hero-index">INDEX <strong>{cards.length} 条数据卡</strong></div></div>
 {errors.length>0 && <div className="error" role="alert">部分怪物数据无效，已跳过：{errors.join('；')}</div>}{selected && !chosen && <div className="error" role="alert">未找到该怪物数据卡，请从列表中选择。</div>}
 <div className="content"><aside className="filters"><div className="filters-head"><div><span className="section-label">REFINE YOUR SEARCH</span><h2>筛选图鉴</h2></div><button className="clear" onClick={clear}>清除</button></div><label>生物类型<select value={type} onChange={e=>setType(e.target.value)}><option value="">全部类型</option>{types.map(x=><option key={x}>{x}</option>)}</select></label><label>挑战等级<select value={cr} onChange={e=>setCr(e.target.value)}><option value="">全部等级</option>{crs.map(x=><option key={x}>{x}</option>)}</select></label><label>栖息环境<select value={habitat} onChange={e=>setHabitat(e.target.value)}><option value="">全部环境</option>{habitats.map(x=><option key={x}>{x}</option>)}</select></label><div className="filter-note"><span>✦</span><p>每一种生灵，都有属于自己的故事。</p></div></aside>
 <section className="results"><div className="search-row"><label className="search"><span aria-hidden="true">⌕</span><input aria-label="搜索怪物名称" placeholder="搜索怪物名称、英文名或别名..." value={query} onChange={e=>setQuery(e.target.value)}/>{query && <button aria-label="清除搜索" onClick={()=>setQuery('')}>×</button>}</label><label className="sort-label">排序 <select aria-label="排序" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">名称</option><option value="cr">挑战等级</option></select></label></div><div className="results-heading"><div><span className="section-label">THE COLLECTION</span><h2>探索生灵 <span>／ {String(results.length).padStart(2,'0')}</span></h2></div><p>共 {results.length} 条资料 <span>·</span> 数据来自本地</p></div>{results.length ? <div className="card-grid">{results.slice((page-1)*24,page*24).map(({entry:e,block:b})=><button className="monster-card" key={`${e.id}-${b.id}`} onClick={()=>{setSelected(b.id);window.scrollTo(0,0)}}><div className={`card-art art-${['mist','ember','stone','tide','moss'][cards.findIndex(x=>x.block.id===b.id)%5]}`}><div className="art-top"><span>NO. {String(cards.findIndex(x=>x.block.id===b.id)+1).padStart(3,'0')}</span><span>✦</span></div><div className="art-symbol">{['✧','✺','⬡','◌','✳'][cards.findIndex(x=>x.block.id===b.id)%5]}</div><div className="art-bottom"><span>FIELD GUIDE</span><span>CR {b.challengeRating ?? '—'}</span></div></div><div className="card-body"><div className="card-kicker">{b.creatureTypes.join(' / ')} <span>·</span> {b.size}</div><div className="card-title"><h3>{b.name}</h3><span>↗</span></div><p className="card-english">{e.englishName}</p><div className="card-footer"><span>{e.habitats?.join(' / ') || '栖息地未知'}</span><span>AC {b.armorClass} <b>·</b> HP {b.hitPoints.average}</span></div></div></button>)}</div> : <div className="empty"><span>✧</span><h3>没有找到匹配的生灵</h3><p>试试其他名称或调整筛选条件。</p><button onClick={clear}>清除筛选</button></div>}{results.length > 24 && <div className="pagination"><button disabled={page===1} onClick={()=>{setPage(page-1);window.scrollTo(0,0)}}>← 上一页</button><span>第 {page} / {Math.ceil(results.length/24)} 页</span><button disabled={page>=Math.ceil(results.length/24)} onClick={()=>{setPage(page+1);window.scrollTo(0,0)}}>下一页 →</button></div>}</section></div></>}</main>{showAdd && chosen && <AddMonsterDialog card={chosen} store={state.store} onClose={()=>setShowAdd(false)} onAdd={onAdd}/>}<footer><span>✳ &nbsp; TRPG HELPER</span><span>为每一场冒险，留下一点想象。</span><span>怪物图鉴 · 本地资料</span></footer></div>
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);












