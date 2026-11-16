const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, disengage, endTurn, moveActorToCell, pendingOpportunities, spendResource, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '撤离测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const first = store.battles[0];
  const withAlly = addMonsters(store, card, { battleId: first.id, side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = withAlly.battles[0];
  const [mover, reactor] = battle.actors.map(actor => actor.id);
  let combat = startCombat(battle, { [mover]: 20, [reactor]: 10 });
  combat = configureGrid(combat, { width: 8, height: 8, cellFt: 5 });
  combat = moveActorToCell(combat, mover, 0, 0);
  combat = moveActorToCell(combat, reactor, 1, 0);
  return { combat, mover, reactor };
}

test('撤离消耗动作并让本回合移动不再引发借机攻击', () => {
  const { combat, mover } = setup();
  const ready = disengage(combat, mover);
  const actor = ready.actors.find(item => item.id === mover);
  assert.equal(actor.combat.actionUsed, true);
  assert.equal(actor.combat.disengaged, true);
  assert.match(ready.combat.log.at(-1).text, /使用撤离/);
  const moved = moveActorToCell(ready, mover, 3, 0);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('没有撤离时同样的移动会触发借机攻击', () => {
  const { combat, mover } = setup();
  const moved = moveActorToCell(combat, mover, 3, 0);
  assert.equal(pendingOpportunities(moved).length, 1);
});

test('只有当前回合的单位可以撤离，且动作已用后不能再撤离', () => {
  const { combat, mover, reactor } = setup();
  assert.throws(() => disengage(combat, reactor), /只有当前回合的单位可以撤离。/);
  const spent = spendResource(combat, mover, 'action');
  assert.throws(() => disengage(spent, mover), /该单位本回合已经使用过动作。/);
});

test('轮到该单位的新回合时撤离状态会重置', () => {
  const { combat, mover } = setup();
  const ready = disengage(combat, mover);
  let next = endTurn(ready, { makeId: ids() });
  next = endTurn(next, { makeId: ids() });
  const actor = next.actors.find(item => item.id === mover);
  assert.equal(actor.combat.disengaged, false);
  assert.equal(actor.combat.actionUsed, false);
});
