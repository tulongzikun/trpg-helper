const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { configureGrid, declineOpportunity, endTurn, moveActorToCell, opportunityAttack, pendingOpportunities, spendResource, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };
const now = () => '2026-01-01T00:00:00Z';

function setup() {
  const first = addMonsters(emptyStore(), card, { newBattleName: '借机测试', side: '敌方', count: 1 }, ids(), now).store;
  const battle = first.battles[0];
  const store = addMonsters(first, card, { battleId: battle.id, side: '友方', count: 1 }, ids(), now).store;
  const base = store.battles[0];
  const [mover, reactor] = base.actors.map(actor => actor.id);
  const combat = startCombat(base, { [mover]: 20, [reactor]: 10 });
  let placed = configureGrid(combat, { width: 8, height: 8, cellFt: 5 });
  placed = moveActorToCell(placed, mover, 0, 0);
  placed = moveActorToCell(placed, reactor, 1, 0);
  return { placed, mover, reactor };
}

test('离开敌对单位的触及范围会触发借机攻击提示', () => {
  const { placed, mover } = setup();
  const moved = moveActorToCell(placed, mover, 3, 0);
  assert.equal(pendingOpportunities(moved).length, 1);
  assert.match(moved.combat.log.map(item => item.text).join(' '), /可以借机攻击/);
});

test('在触及范围内移动不会触发借机攻击', () => {
  const { placed, mover } = setup();
  const moved = moveActorToCell(placed, mover, 0, 1);
  assert.equal(pendingOpportunities(moved).length, 0);
});

test('借机攻击会消耗反应并移除提示', () => {
  const { placed, mover, reactor } = setup();
  const moved = moveActorToCell(placed, mover, 3, 0);
  const shot = opportunityAttack(moved, reactor, {}, { random: sequence(0.9, 0.5), makeId: ids() });
  assert.equal(shot.outcome.hit, true);
  assert.equal(shot.battle.actors.find(actor => actor.id === reactor).combat.reactionUsed, true);
  assert.equal(pendingOpportunities(shot.battle).length, 0);
});

test('可以放弃借机攻击，提示随之移除', () => {
  const { placed, mover, reactor } = setup();
  const moved = moveActorToCell(placed, mover, 3, 0);
  const declined = declineOpportunity(moved, reactor);
  assert.equal(pendingOpportunities(declined).length, 0);
  assert.match(declined.combat.log.at(-1).text, /放弃借机攻击/);
});

test('没有待结算提示时不能发起或放弃借机攻击', () => {
  const { placed, reactor } = setup();
  assert.throws(() => opportunityAttack(placed, reactor), /该单位没有待结算的借机攻击。/);
  assert.throws(() => declineOpportunity(placed, reactor), /该单位没有待结算的借机攻击。/);
});

test('反应已经用掉后不能再借机攻击', () => {
  const { placed, mover, reactor } = setup();
  const moved = moveActorToCell(placed, mover, 3, 0);
  const spent = spendResource(moved, reactor, 'reaction');
  assert.throws(() => opportunityAttack(spent, reactor), /该单位本回合已经使用过反应。/);
});

test('回合结束后未结算的借机攻击失效', () => {
  const { placed, mover } = setup();
  const moved = moveActorToCell(placed, mover, 3, 0);
  const ended = endTurn(moved, { makeId: ids() });
  assert.equal(pendingOpportunities(ended).length, 0);
});
