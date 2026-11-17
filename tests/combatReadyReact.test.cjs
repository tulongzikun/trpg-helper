const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, configureGrid, moveActorToCell, readyAction, triggerReadyAction, pendingOpportunities, endTurn } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ready-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '准备动作', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  let battle = structuredClone(created.battles[0]);
  const foe = battle.actors[0];
  foe.position = { x: 0, y: 0 };
  const hero = { ...structuredClone(foe), id: 'hero-1', name: '英雄', side: '友方', position: { x: 0, y: 3 } };
  hero.combat = undefined;
  battle.actors.push(hero);
  battle = structuredClone(startCombat(battle, { [foe.id]: 20, 'hero-1': 10 }));
  battle = configureGrid(battle, { width: 10, height: 10, cellFt: 5 });
  return { battle, foeId: foe.id };
}

function withReady(mutate) {
  const { battle, foeId } = setup();
  let next = readyAction(battle, foeId, { action: '攻击靠近的敌人', trigger: '有人进入 5 尺' });
  if (mutate) mutate(next.actors.find(actor => actor.id === foeId));
  next = endTurn(next, { random: () => 0.5 });
  return { battle: next, foeId };
}

test('能行动的单位可以正常执行准备好的动作', () => {
  const { battle, foeId } = withReady();
  const fired = triggerReadyAction(battle, foeId);
  const state = fired.actors.find(actor => actor.id === foeId).combat;
  assert.equal(state.ready, undefined);
  assert.equal(state.reactionUsed, true);
});

test('麻痹的单位不能执行准备好的动作，准备状态保留', () => {
  const { battle, foeId } = withReady(actor => actor.combat.conditions.push('麻痹'));
  assert.throws(() => triggerReadyAction(battle, foeId), /现在无法行动，不能执行准备好的动作/);
  const state = battle.actors.find(actor => actor.id === foeId).combat;
  assert.equal(state.ready.action, '攻击靠近的敌人');
  assert.notEqual(state.reactionUsed, true);
});

test('失能的单位不能执行准备好的动作', () => {
  const { battle, foeId } = withReady(actor => actor.combat.conditions.push('失能'));
  assert.throws(() => triggerReadyAction(battle, foeId), /现在无法行动/);
});

test('已撤离的单位不能执行准备好的动作', () => {
  const { battle, foeId } = withReady(actor => { actor.combat.fled = true; });
  assert.throws(() => triggerReadyAction(battle, foeId), /现在无法行动/);
});

test('投降的单位不能执行准备好的动作', () => {
  const { battle, foeId } = withReady(actor => { actor.combat.surrendered = true; });
  assert.throws(() => triggerReadyAction(battle, foeId), /现在无法行动/);
});

test('准备状态在能行动时会正常进入提示队列', () => {
  const { battle } = withReady();
  const moved = moveActorToCell(battle, 'hero-1', 0, 1);
  const readyPrompts = pendingOpportunities(moved).filter(item => item.kind === 'ready');
  assert.equal(readyPrompts.length, 1);
});

test('麻痹时不再进入准备动作提示队列', () => {
  const { battle } = withReady(actor => actor.combat.conditions.push('麻痹'));
  const moved = moveActorToCell(battle, 'hero-1', 0, 1);
  assert.equal(pendingOpportunities(moved).filter(item => item.kind === 'ready').length, 0);
});
