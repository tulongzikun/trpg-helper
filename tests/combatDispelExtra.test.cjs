const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { startCombat, castDispelMagic, castBlindness, castDeafness, castBarkskin, castPolymorph, castAid } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `dsp-${++counter}`;

const mage = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dsp', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '米娅', species: '人类', characterClass: '法师', level: 7,
    abilities: { str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10 },
    maxHp: 38, armorClass: 13, speedFt: 30, actions: '火焰箭：+4 命中，1d10 火焰伤害，射程 60 尺', notes: '', details: {},
  },
};
const ally = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-dsp-ally', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '格罗', species: '人类', characterClass: '战士', level: 7,
    abilities: { str: 16, dex: 12, con: 16, int: 10, wis: 10, cha: 8 },
    maxHp: 50, armorClass: 16, speedFt: 30, actions: '战锤：+6 命中，1d8+3 钝击伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '驱散新增', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const withMage = addCharacter(store, mage, { battleId: store.battles[0].id, side: '友方' }, ids());
  const withAlly = addCharacter(withMage.store, ally, { battleId: withMage.store.battles[0].id, side: '友方' }, ids());
  const battle = withAlly.store.battles[0];
  const mageId = battle.actors.find(actor => actor.name === '米娅').id;
  const allyId = battle.actors.find(actor => actor.name === '格罗').id;
  const foeId = battle.actors.find(actor => actor.side === '敌方').id;
  const initiatives = {};
  battle.actors.forEach((actor) => { initiatives[actor.id] = actor.id === mageId ? 20 : actor.id === allyId ? 15 : 10; });
  const started = startCombat(battle, initiatives);
  const placed = {
    ...started,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: started.actors.map(actor => actor.id === mageId ? { ...actor, position: { x: 0, y: 0 } }
      : actor.id === allyId ? { ...actor, position: { x: 0, y: 1 } }
        : { ...actor, position: { x: 0, y: 3 } }),
  };
  return { battle: placed, mageId, allyId, foeId };
}

const freeAction = battle => ({ ...battle, actors: battle.actors.map(actor => actor.combat ? { ...actor, combat: { ...actor.combat, actionUsed: false } } : actor) });
const highRoll = () => ({ random: () => 0.99 });

test('驱散致盲术会恢复视力', () => {
  const { battle, mageId, foeId } = setup();
  const blinded = castBlindness(battle, mageId, foeId, { random: () => 0.01 }).battle;
  assert.ok(blinded.actors.find(actor => actor.id === foeId).combat.blinded);
  const result = castDispelMagic(freeAction(blinded), mageId, foeId, highRoll());
  const after = result.battle.actors.find(actor => actor.id === foeId).combat;
  assert.equal(after.blinded, undefined);
  assert.equal(after.conditions.includes('目盲'), false);
  assert.ok(result.outcome.dispelled.includes('致盲术'));
});

test('驱散耳聋术会恢复听觉', () => {
  const { battle, mageId, foeId } = setup();
  const deafened = castDeafness(battle, mageId, foeId, { random: () => 0.01 }).battle;
  assert.ok(deafened.actors.find(actor => actor.id === foeId).combat.deafened);
  const result = castDispelMagic(freeAction(deafened), mageId, foeId, highRoll());
  assert.equal(result.battle.actors.find(actor => actor.id === foeId).combat.deafened, undefined);
  assert.ok(result.outcome.dispelled.includes('耳聋术'));
});

test('驱散树肤术会让 AC 回落', () => {
  const { battle, mageId } = setup();
  const barked = castBarkskin(battle, mageId, mageId);
  assert.ok(barked.actors.find(actor => actor.id === mageId).combat.barkskin);
  const result = castDispelMagic(freeAction(barked), mageId, mageId, highRoll());
  assert.equal(result.battle.actors.find(actor => actor.id === mageId).combat.barkskin, undefined);
  assert.ok(result.outcome.dispelled.includes('树肤术'));
});

test('驱散变形术会解除失能', () => {
  const { battle, mageId, foeId } = setup();
  const shaped = castPolymorph(battle, mageId, foeId, { random: () => 0.01 }).battle;
  assert.ok(shaped.actors.find(actor => actor.id === foeId).combat.polymorphed);
  const result = castDispelMagic(freeAction(shaped), mageId, foeId, highRoll());
  const after = result.battle.actors.find(actor => actor.id === foeId).combat;
  assert.equal(after.polymorphed, undefined);
  assert.equal(after.conditions.includes('失能'), false);
});

test('驱散援助术会收回额外生命上限', () => {
  const { battle, mageId } = setup();
  const before = battle.actors.find(actor => actor.id === mageId);
  const aided = castAid(battle, mageId, [mageId]);
  const boosted = aided.actors.find(actor => actor.id === mageId);
  assert.equal(boosted.maxHp, before.maxHp + 5);
  const result = castDispelMagic(freeAction(aided), mageId, mageId, highRoll());
  const after = result.battle.actors.find(actor => actor.id === mageId);
  assert.equal(after.maxHp, before.maxHp);
  assert.ok(after.currentHp <= after.maxHp);
  assert.ok(result.outcome.dispelled.includes('援助术'));
});
