const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, currentActorId, endTurn, spendMovement, standUp, startCombat, toggleCondition } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(count = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '起身测试', side: '敌方', count }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const order = {};
  let initiative = 20;
  for (const actor of battle.actors) order[actor.id] = initiative--;
  const started = startCombat(battle, order);
  return { battle: started, actor: started.actors[0], other: started.actors[1] };
}

test('起身消耗一半速度的移动力并移除倒地', () => {
  const { battle, actor } = setup();
  const downed = toggleCondition(battle, actor.id, '倒地');
  const stood = standUp(downed, actor.id);
  const state = stood.actors.find(item => item.id === actor.id).combat;
  assert.equal(state.conditions.includes('倒地'), false);
  assert.equal(state.movementUsed, 15, '速度 30 时起身消耗 15 尺');
  assert.match(stood.combat.log.at(-1).text, /起身，消耗 15 尺移动力/);
});

test('未倒地、非当前回合或已死亡的单位不能起身', () => {
  const { battle, actor, other } = setup();
  assert.throws(() => standUp(battle, actor.id), /该单位没有倒地。/);
  const downed = toggleCondition(battle, actor.id, '倒地');
  assert.throws(() => standUp(downed, other.id), /只有当前回合的单位可以起身。/);
  const dead = structuredClone(downed);
  dead.actors.find(item => item.id === actor.id).combat.status = 'dead';
  assert.throws(() => standUp(dead, actor.id), /只有在场的单位可以起身。/);
});

test('剩余移动力不足时拒绝起身', () => {
  const { battle, actor } = setup();
  const downed = toggleCondition(battle, actor.id, '倒地');
  const moved = spendMovement(downed, actor.id, 20);
  assert.throws(() => standUp(moved, actor.id), /剩余移动力不足，起身需要 15 尺。/);
});

test('起身之后仍可正常攻击（倒地 condition 本身不拦截动作）', () => {
  const { battle, actor, other } = setup();
  const downed = toggleCondition(battle, actor.id, '倒地');
  const stood = standUp(downed, actor.id);
  const result = attack(stood, { attackerId: actor.id, targetId: other.id, attackBonus: 5, damageExpression: '1d6+3', damageType: '挥砍' }, { random: sequence(0.7, 0.5) });
  assert.equal(result.outcome.hit, true);
});

test('回合结束不自动起身，仍保持倒地', () => {
  const { battle, actor } = setup();
  const downed = toggleCondition(battle, actor.id, '倒地');
  const next = endTurn(downed, { makeId: ids() });
  assert.notEqual(currentActorId(next), actor.id);
  assert.equal(next.actors.find(item => item.id === actor.id).combat.conditions.includes('倒地'), true);
});

