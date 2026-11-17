const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { attack, castPolymorph, endConcentration, endTurn, startCombat, takeLongRest } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `polymorph-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '变形', side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const [first, second] = store.battles[0].actors.map(actor => actor.id);
  const battle = startCombat(store.battles[0], { [first]: 20, [second]: 10 });
  return { battle, first, second };
}

const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('变形术消耗动作与专注，失败者变成小兽', () => {
  const { battle, first, second } = setup();
  const cast = castPolymorph(battle, first, second, { random: sequence(0.1) });
  const state = stateOf(cast.battle, second);
  assert.equal(state.polymorphed, 10);
  assert.equal(state.polymorphedBy, first);
  assert.ok(state.conditions.includes('失能'));
  const casterState = stateOf(cast.battle, first);
  assert.equal(casterState.actionUsed, true);
  assert.equal(casterState.concentration.spell, '变形术');
  assert.ok(logs(cast.battle).includes('目标变成小兽'));
});

test('通过感知豁免的目标不受影响', () => {
  const { battle, first, second } = setup();
  const cast = castPolymorph(battle, first, second, { random: sequence(0.95) });
  assert.equal(stateOf(cast.battle, second).polymorphed, undefined);
  assert.ok(!stateOf(cast.battle, second).conditions.includes('失能'));
  assert.ok(logs(cast.battle).includes('抵抗了变形'));
});

test('变形期间 AC 变成 10', () => {
  const { battle, first, second } = setup();
  const baseAc = battle.actors.find(actor => actor.id === second).template.armorClass;
  assert.notEqual(baseAc, 10);
  const cast = castPolymorph(battle, first, second, { random: sequence(0.1) });
  const ready = structuredClone(cast.battle);
  ready.actors.find(actor => actor.id === first).combat.actionUsed = false;
  const shot = attack(ready, { attackerId: first, targetId: second, attackBonus: 3, damageExpression: '1d6', damageType: '挥砍' }, { random: sequence(0.5, 0.5, 0.5), makeId: ids() });
  assert.equal(shot.outcome.targetAc, 10);
});

test('变形术结束（专注中断）后恢复原状', () => {
  const { battle, first, second } = setup();
  const cast = castPolymorph(battle, first, second, { random: sequence(0.1) });
  const ended = endConcentration(cast.battle, first);
  const state = stateOf(ended, second);
  assert.equal(state.polymorphed, undefined);
  assert.equal(state.polymorphedBy, undefined);
  assert.ok(!state.conditions.includes('失能'));
  assert.ok(logs(ended).includes('变形术结束了'));
});

test('轮数随回合递减，归零后解除', () => {
  const { battle, first, second } = setup();
  const cast = castPolymorph(battle, first, second, { random: sequence(0.1) });
  const shortened = structuredClone(cast.battle);
  shortened.actors.find(actor => actor.id === second).combat.polymorphed = 1;
  const ended = endTurn(shortened, { random: sequence(0.5) });
  assert.equal(stateOf(ended, second).polymorphed, undefined);
  assert.ok(logs(ended).includes('变形术结束了'));
});

test('长休清除变形，且拒绝对自己、死亡目标与重复施放', () => {
  const { battle, first, second } = setup();
  const cast = castPolymorph(battle, first, second, { random: sequence(0.1) });
  const rested = takeLongRest(cast.battle);
  assert.equal(stateOf(rested, second).polymorphed, undefined);
  assert.throws(() => castPolymorph(battle, first, first), /无法对自己施放变形术/);
  assert.throws(() => castPolymorph(battle, first, second, { random: sequence(0.1) }) && castPolymorph(cast.battle, first, second, { random: sequence(0.1) }), /已经处于变形术的影响下/);
});
