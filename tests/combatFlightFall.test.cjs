const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, setFlying, setElevation, grapple } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `fall-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

function setup() {
  let store = emptyStore();
  store = addMonsters(store, card, { newBattleName: '坠落', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  return startCombat(base, Object.fromEntries(base.actors.map((actor, index) => [actor.id, 20 - index])));
}

test('取消飞行时从高空坠落并倒地', () => {
  const battle = setup();
  const flyer = battle.actors[1];
  flyer.currentHp = 60; flyer.maxHp = 60;
  let next = setFlying(battle, flyer.id, true, ids());
  next = setElevation(next, flyer.id, 20, ids());
  next = setFlying(next, flyer.id, false, { random: sequence(0.5, 0.5), makeId: ids() });
  const after = next.actors.find(actor => actor.id === flyer.id);
  assert.equal(after.currentHp, 52);
  assert.equal(after.elevation, undefined);
  assert.equal(after.combat.flying, undefined);
  assert.ok(after.combat.conditions.includes('倒地'));
  assert.ok(next.combat.log.some(entry => entry.text.includes('失去飞行，从 20 尺坠落')));
});

test('低空取消飞行不受伤', () => {
  const battle = setup();
  const flyer = battle.actors[1];
  flyer.currentHp = 60; flyer.maxHp = 60;
  let next = setFlying(battle, flyer.id, true, ids());
  next = setElevation(next, flyer.id, 5, ids());
  next = setFlying(next, flyer.id, false, { random: sequence(0.5), makeId: ids() });
  const after = next.actors.find(actor => actor.id === flyer.id);
  assert.equal(after.currentHp, 60);
  assert.equal(after.elevation, undefined);
});

test('擒抱飞行单位会让它坠落', () => {
  const battle = setup();
  const hero = battle.actors[0];
  const flyer = battle.actors[1];
  flyer.currentHp = 60; flyer.maxHp = 60;
  let next = { ...battle, actors: battle.actors.map(actor => actor.id === flyer.id ? { ...actor, position: { x: 1, y: 0 } } : actor.id === hero.id ? { ...actor, position: { x: 0, y: 0 } } : actor) };
  next = setElevation(next, flyer.id, 20, ids());
  next = setFlying(next, flyer.id, true, ids());
  next = grapple(next, { attackerId: hero.id, targetId: flyer.id }, { random: sequence(0.9, 0.1, 0.5, 0.5), makeId: ids() });
  const after = next.battle.actors.find(actor => actor.id === flyer.id);
  assert.equal(after.elevation, undefined);
  assert.equal(after.currentHp, 52);
  assert.ok(next.battle.combat.log.some(entry => entry.text.includes('被擒抱，失去飞行')));
});

test('擒抱地面单位不产生坠落日志', () => {
  const battle = setup();
  const hero = battle.actors[0];
  const flyer = battle.actors[1];
  const next = { ...battle, actors: battle.actors.map(actor => actor.id === flyer.id ? { ...actor, position: { x: 1, y: 0 } } : actor.id === hero.id ? { ...actor, position: { x: 0, y: 0 } } : actor) };
  const result = grapple(next, { attackerId: hero.id, targetId: flyer.id }, { random: sequence(0.9, 0.1), makeId: ids() });
  assert.ok(!result.battle.combat.log.some(entry => entry.text.includes('坠落')));
});
