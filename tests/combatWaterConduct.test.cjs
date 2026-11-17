const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setTerrain, damageActor } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `water-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '水下导电', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const foe = battle.actors[0];
  return { battle: startCombat(battle, { [foe.id]: 10 }), foeId: foe.id };
}

test('水下受到闪电伤害翻倍', () => {
  const { battle, foeId } = setup();
  const wet = setTerrain(battle, 'underwater');
  const result = damageActor(wet, foeId, 5, '闪电');
  assert.equal(result.outcome.damage, 10);
});

test('水下受到雷鸣伤害同样翻倍', () => {
  const { battle, foeId } = setup();
  const wet = setTerrain(battle, 'underwater');
  const result = damageActor(wet, foeId, 4, '雷鸣');
  assert.equal(result.outcome.damage, 8);
});

test('陆地上的闪电伤害不变', () => {
  const { battle, foeId } = setup();
  const result = damageActor(battle, foeId, 5, '闪电');
  assert.equal(result.outcome.damage, 5);
});

test('水下火焰抗性与导电可以并存', () => {
  const { battle, foeId } = setup();
  const wet = setTerrain(battle, 'underwater');
  const fire = damageActor(wet, foeId, 6, '火焰');
  assert.equal(fire.outcome.damage, 3);
  const shock = damageActor(wet, foeId, 3, '闪电');
  assert.equal(shock.outcome.damage, 6);
});

test('水下的挥砍伤害不受影响', () => {
  const { battle, foeId } = setup();
  const wet = setTerrain(battle, 'underwater');
  const result = damageActor(wet, foeId, 7, '挥砍');
  assert.equal(result.outcome.damage, 7);
});
