const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, endTurn } = require('../apps/web/src/combat.ts');
const { battleReport, initiativeOrder } = require('../apps/web/src/combatReport.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `order-${++counter}`;

function setup() {
  const created = addMonsters(emptyStore(), card, { newBattleName: '先攻顺序', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = structuredClone(created.battles[0]);
  const [first, second] = battle.actors;
  return { battle: structuredClone(startCombat(battle, { [first.id]: 18, [second.id]: 9 }),), firstId: first.id, secondId: second.id };
}

test('未开战时没有先攻顺序', () => {
  const { battle } = setup();
  const fresh = structuredClone(battle);
  delete fresh.combat;
  assert.deepEqual(initiativeOrder(fresh), []);
  assert.doesNotMatch(battleReport(fresh), /## 先攻顺序/);
});

test('按先攻高低列出顺序并标出当前行动者', () => {
  const { battle, firstId } = setup();
  const order = initiativeOrder(battle);
  assert.equal(order.length, 2);
  assert.equal(order[0].initiative, 18);
  assert.equal(order[0].current, true);
  assert.equal(order[0].acted, false);
  assert.equal(order[1].acted, false);
  assert.equal(battle.combat.order[0], firstId);
});

test('推进回合后前一位标记为已行动', () => {
  const { battle } = setup();
  const next = endTurn(battle, { random: () => 0.5 });
  const order = initiativeOrder(next);
  assert.equal(order[0].current, false);
  assert.equal(order[0].acted, true);
  assert.equal(order[1].current, true);
});

test('战报里按顺序列出单位与先攻值', () => {
  const { battle } = setup();
  const report = battleReport(battle);
  assert.match(report, /## 先攻顺序/);
  assert.match(report, /1\. .+（先攻 18） ← 当前行动者/);
  assert.match(report, /2\. .+（先攻 9）(?!.*已行动)/);
});

test('推进后战报标出已行动', () => {
  const { battle } = setup();
  const next = endTurn(battle, { random: () => 0.5 });
  const report = battleReport(next);
  assert.match(report, /1\. .+（先攻 18） （已行动）/);
  assert.match(report, /2\. .+（先攻 9） ← 当前行动者/);
});
