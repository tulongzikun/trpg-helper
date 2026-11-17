const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, castHoldPerson, castBlindness, castFear, takeLongRest, castSleep, castEntangle } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `rest-cond-${++counter}`;

const cleric = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-rest-cond', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '薇拉', species: '人类', characterClass: '牧师', level: 6,
    abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 17, cha: 12 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '锤矛：+4 命中，1d6+2 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '长休条件', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withCleric = addCharacter(store, cleric, { battleId: store.battles[0].id, side: '友方' }, ids());
  const battle = withCleric.store.battles[0];
  const clericId = battle.actors.find(actor => actor.name === '薇拉').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === clericId ? 20 : 10; });
  const started = startCombat(battle, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === clericId ? { ...actor, position: { x: 0, y: 0 } }
      : { ...actor, position: { x: 0, y: 2 } }),
  };
  return { battle: placed, clericId, foeId };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;

test('长休清除定身术留下的麻痹条件', () => {
  const { battle, clericId, foeId } = setup();
  const held = castHoldPerson(battle, clericId, foeId, { random: () => 0.01 });
  assert.ok(stateOf(held, foeId).conditions.includes('麻痹'));
  const rested = takeLongRest(held);
  assert.equal(stateOf(rested, foeId).conditions.includes('麻痹'), false);
});

test('长休清除致盲留下的目盲条件', () => {
  const { battle, clericId, foeId } = setup();
  const blinded = castBlindness(battle, clericId, foeId, { random: () => 0.01 }).battle;
  assert.ok(stateOf(blinded, foeId).conditions.includes('目盲'));
  const rested = takeLongRest(blinded);
  assert.equal(stateOf(rested, foeId).conditions.includes('目盲'), false);
});

test('长休清除恐惧留下的恐慌条件', () => {
  const { battle, clericId, foeId } = setup();
  const feared = castFear(battle, clericId, [foeId], { random: () => 0.01 });
  assert.ok(stateOf(feared, foeId).conditions.includes('恐慌'));
  const rested = takeLongRest(feared);
  assert.equal(stateOf(rested, foeId).conditions.includes('恐慌'), false);
});

test('长休清除藤蔓留下的束缚条件', () => {
  const { battle, clericId, foeId } = setup();
  const snared = castEntangle(battle, clericId, [{ x: 0, y: 2 }, { x: 0, y: 1 }], { random: () => 0.01 });
  assert.ok(stateOf(snared, foeId).conditions.includes('束缚'));
  const rested = takeLongRest(snared);
  assert.equal(stateOf(rested, foeId).conditions.includes('束缚'), false);
});

test('长休清除沉睡留下的失能与倒地条件', () => {
  const { battle, clericId, foeId } = setup();
  const thinned = { ...battle, actors: battle.actors.map(actor => actor.id === foeId ? { ...actor, currentHp: 5 } : actor) };
  const slept = castSleep(thinned, clericId, [foeId], { random: () => 0 }).battle;
  assert.ok(stateOf(slept, foeId).conditions.includes('失能'));
  const rested = takeLongRest(slept);
  const after = stateOf(rested, foeId);
  assert.equal(after.conditions.includes('失能'), false);
  assert.equal(after.conditions.includes('倒地'), false);
  assert.equal(after.sleepingBy, undefined);
});
