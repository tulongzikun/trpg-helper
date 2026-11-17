const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setElevation, dropDown } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dd-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++ % values.length]; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '跳下', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const foe = { ...base.actors[0], id: 'foe', name: '雾影兽', currentHp: 200, maxHp: 200 };
  return startCombat({ ...base, actors: [foe] }, { foe: 10 });
}

test('从 20 尺跳下受到 2d6 伤害并倒地、高度清零', () => {
  const battle = setElevation(setup(), 'foe', 20);
  const result = dropDown(battle, 'foe', { random: sequence(0.5, 0.5) });
  const foe = result.battle.actors[0];
  assert.equal(result.fallen, 20);
  assert.equal(foe.currentHp, 192);
  assert.ok(foe.combat.conditions.includes('倒地'));
  assert.equal(foe.elevation, undefined);
  assert.match(result.battle.combat.log.at(-1).text, /从 20 尺高处跳下/);
});

test('5 尺跳下不受伤但清除高度', () => {
  const battle = setElevation(setup(), 'foe', 5);
  const result = dropDown(battle, 'foe', { random: sequence(0.5) });
  const foe = result.battle.actors[0];
  assert.equal(foe.currentHp, 200);
  assert.equal(foe.combat.conditions.includes('倒地'), false);
  assert.equal(foe.elevation, undefined);
});

test('没有高度时拒绝', () => {
  assert.throws(() => dropDown(setup(), 'foe'), /该单位没有高度，无法跳下。/);
});

test('倒下的单位不能跳下', () => {
  const battle = setElevation(setup(), 'foe', 30);
  const down = { ...battle, actors: battle.actors.map(item => ({ ...item, combat: { ...item.combat, status: 'down' } })) };
  assert.throws(() => dropDown(down, 'foe'), /只有在场的单位可以跳下。/);
});
