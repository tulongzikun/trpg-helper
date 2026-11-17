const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { applyPoison, attack, configureGrid, drinkAntitoxin, endTurn, moveActorToCell, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `poison-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup(items = [{ name: '解毒剂', quantity: 2 }]) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '中毒', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const build = (id, name, side) => ({ ...base.actors[0], id, name, side });
  const seeded = { ...base, actors: [build('hero', '艾拉', '友方'), build('foe', '哥布林', '敌方')] };
  const config = configureGrid(seeded, { width: 20, height: 20, cellFt: 5 });
  let battle = startCombat(config, { hero: 20, foe: 10 });
  battle = moveActorToCell(battle, 'hero', 2, 2);
  battle = moveActorToCell(battle, 'foe', 3, 2);
  const clone = structuredClone(battle);
  clone.actors.find(actor => actor.id === 'hero').combat.items = items.map(item => ({ ...item }));
  return clone;
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('体质豁免失败的单位陷入中毒并附加中毒条件', () => {
  const battle = setup();
  const result = applyPoison(battle, 'hero', { random: sequence(0) });
  assert.equal(result.outcome.success, false);
  const state = stateOf(result.battle, 'hero');
  assert.ok(state.conditions.includes('中毒'));
  assert.equal(state.poisoned, 10);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('中毒了')));
});

test('体质豁免成功时不中毒', () => {
  const battle = setup();
  const result = applyPoison(battle, 'hero', { random: sequence(0.99) });
  assert.equal(result.outcome.success, true);
  const state = stateOf(result.battle, 'hero');
  assert.ok(!state.conditions.includes('中毒'));
  assert.equal(state.poisoned, undefined);
  assert.ok(result.battle.combat.log.some(line => line.text.includes('抵抗了毒素')));
});

test('中毒时攻击检定劣势', () => {
  const battle = setup();
  const poisoned = applyPoison(battle, 'hero', { random: sequence(0) }).battle;
  const strike = attack(poisoned, { attackerId: 'hero', targetId: 'foe', attackBonus: 5, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5), makeId: ids() });
  assert.equal(strike.outcome.mode, 'disadvantage');
  assert.ok(strike.outcome.notes.some(note => note.includes('中毒')));
});

test('解毒剂解除中毒并消耗物品与动作', () => {
  const battle = setup();
  const poisoned = applyPoison(battle, 'hero', { random: sequence(0) }).battle;
  const cured = drinkAntitoxin(poisoned, 'hero');
  const state = stateOf(cured, 'hero');
  assert.ok(!state.conditions.includes('中毒'));
  assert.equal(state.poisoned, undefined);
  assert.equal(state.actionUsed, true);
  assert.equal(state.items[0].quantity, 1);
  assert.ok(cured.combat.log.some(line => line.text.includes('解除了中毒')));
});

test('解毒剂会拒绝未中毒、无解毒剂与动作已用的单位', () => {
  const battle = setup();
  assert.throws(() => drinkAntitoxin(battle, 'hero'), /没有中毒/);
  const poisoned = applyPoison(battle, 'hero', { random: sequence(0) }).battle;
  const noItem = structuredClone(poisoned);
  noItem.actors.find(actor => actor.id === 'hero').combat.items = [];
  assert.throws(() => drinkAntitoxin(noItem, 'hero'), /背包里没有解毒剂/);
  const cured = drinkAntitoxin(poisoned, 'hero');
  const again = applyPoison(cured, 'hero', { random: sequence(0) }).battle;
  assert.throws(() => drinkAntitoxin(again, 'hero'), /已经使用过动作/);
});

test('中毒轮数会逐回合递减，归零自动解除；长休也会清除', () => {
  const battle = setup();
  const poisoned = applyPoison(battle, 'hero', { random: sequence(0) }, 1).battle;
  const afterTurn = endTurn(endTurn(poisoned, { random: sequence(0.5) }), { random: sequence(0.5) });
  assert.ok(!stateOf(afterTurn, 'hero').conditions.includes('中毒'));
  assert.ok(afterTurn.combat.log.some(line => line.text.includes('毒素失效了')));
  const longRest = takeLongRest(poisoned);
  assert.ok(!stateOf(longRest, 'hero').conditions.includes('中毒'));
  assert.equal(stateOf(longRest, 'hero').poisoned, undefined);
});
