const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { cancelReadyAction, endTurn, readyAction, startCombat, triggerReadyAction } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup(count = 1) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '准备动作测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const order = {};
  let initiative = 20;
  for (const actor of battle.actors) order[actor.id] = initiative--;
  const started = startCombat(battle, order);
  return { battle: started, actor: started.actors[0], other: started.actors[1] };
}

test('准备动作消耗动作并记录动作与触发条件', () => {
  const { battle, actor } = setup();
  const ready = readyAction(battle, actor.id, { action: '用短弓射击', trigger: '敌人进入 30 尺' });
  const state = ready.actors[0].combat;
  assert.equal(state.actionUsed, true);
  assert.deepEqual(state.ready, { action: '用短弓射击', trigger: '敌人进入 30 尺' });
  assert.match(ready.combat.log.at(-1).text, /准备「用短弓射击」，触发条件：敌人进入 30 尺/);
});

test('非当前回合、动作已用或已经准备过都会被拒绝', () => {
  const { battle, actor, other } = setup(2);
  assert.throws(() => readyAction(battle, other.id, { action: '射击', trigger: '敌人移动' }), /只有当前回合的单位可以准备动作。/);
  assert.throws(() => readyAction(battle, actor.id, { action: ' ', trigger: '敌人移动' }), /请填写准备执行的动作。/);
  assert.throws(() => readyAction(battle, actor.id, { action: '射击', trigger: '' }), /请填写触发条件。/);
  const ready = readyAction(battle, actor.id, { action: '射击', trigger: '敌人移动' });
  assert.throws(() => readyAction(ready, actor.id, { action: '射击', trigger: '敌人移动' }), /该单位本回合已经使用过动作。/);
});

test('触发准备好的动作会消耗反应并清空准备', () => {
  const { battle, actor } = setup();
  const ready = readyAction(battle, actor.id, { action: '射击', trigger: '敌人移动' });
  const fired = triggerReadyAction(ready, actor.id);
  const state = fired.actors[0].combat;
  assert.equal(state.reactionUsed, true);
  assert.equal(state.ready, undefined);
  assert.match(fired.combat.log.at(-1).text, /用反应执行准备好的「射击」/);
  assert.throws(() => triggerReadyAction(fired, actor.id), /该单位没有准备好的动作。/);
});

test('反应已用时无法触发准备好的动作', () => {
  const { battle, actor } = setup();
  const ready = readyAction(battle, actor.id, { action: '射击', trigger: '敌人移动' });
  const spent = structuredClone(ready);
  spent.actors[0].combat.reactionUsed = true;
  assert.throws(() => triggerReadyAction(spent, actor.id), /该单位本回合已经使用过反应。/);
});

test('轮到该单位的新回合时准备动作失效', () => {
  const { battle, actor } = setup();
  const ready = readyAction(battle, actor.id, { action: '射击', trigger: '敌人移动' });
  const next = endTurn(ready, { makeId: ids() });
  const state = next.actors[0].combat;
  assert.equal(state.ready, undefined);
  assert.match(next.combat.log.map(item => item.text).join(' '), /准备动作在回合开始时失效/);
});

test('可以主动放弃准备好的动作且不返还动作', () => {
  const { battle, actor } = setup();
  const ready = readyAction(battle, actor.id, { action: '射击', trigger: '敌人移动' });
  const canceled = cancelReadyAction(ready, actor.id);
  const state = canceled.actors[0].combat;
  assert.equal(state.ready, undefined);
  assert.equal(state.actionUsed, true);
  assert.match(canceled.combat.log.at(-1).text, /放弃准备好的「射击」/);
  assert.throws(() => cancelReadyAction(canceled, actor.id), /该单位没有准备好的动作。/);
});
