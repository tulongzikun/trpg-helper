const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, friendlyFireTargets } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `ff-${++counter}`;

function setup() {
  let store = emptyStore();
  store = addMonsters(store, card, { newBattleName: '误伤检查', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  return startCombat(base, Object.fromEntries(base.actors.map((actor, index) => [actor.id, 20 - index])));
}

test('范围内只有敌人时不提示', () => {
  const battle = setup();
  const hero = battle.actors[0];
  const enemy = battle.actors[2];
  assert.deepEqual(friendlyFireTargets(battle, hero.id, [enemy.id]), []);
});

test('范围内混入同伴时返回同伴', () => {
  const battle = setup();
  const hero = battle.actors[0];
  const ally = battle.actors[1];
  const enemy = battle.actors[2];
  const result = friendlyFireTargets(battle, hero.id, [ally.id, enemy.id]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, ally.id);
});

test('施法者自己不计入误伤', () => {
  const battle = setup();
  const hero = battle.actors[0];
  assert.deepEqual(friendlyFireTargets(battle, hero.id, [hero.id]), []);
});

test('未知单位或空目标返回空数组', () => {
  const battle = setup();
  assert.deepEqual(friendlyFireTargets(battle, 'missing', [battle.actors[1].id]), []);
  assert.deepEqual(friendlyFireTargets(battle, battle.actors[0].id, []), []);
});
