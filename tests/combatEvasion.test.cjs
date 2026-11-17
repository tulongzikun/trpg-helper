const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { areaSave, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (characterClass, level) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-evasion', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass, level,
    abilities: { str: 10, dex: 16, con: 14, int: 12, wis: 12, cha: 10 },
    maxHp: 40, armorClass: 15, speedFt: 30, actions: '', notes: '', details: { equipment: '' },
  },
});

function setup(characterClass, level) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '反射闪避', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(characterClass, level), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  const started = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  return { battle: started, friend, monster };
}

const fire = (battle, targetId, dc, ability = 'dex') => areaSave(battle, {
  targetIds: [targetId], ability, dc, damageExpression: '2d6', damageType: '火焰',
}, { random: sequence(0.5, 0.5, 0.5, 0.4), makeId: ids() });

test('游荡者 7 级敏捷豁免成功时不受伤害', () => {
  const { battle, friend } = setup('游荡者', 7);
  const result = fire(battle, friend.id, 5);
  assert.equal(result.results[0].save.success, true);
  assert.equal(result.results[0].damage, 0);
  assert.ok(result.battle.combat.log.some(item => /反射闪避：不受伤害/.test(item.detail ?? '')));
});

test('游荡者 7 级豁免失败时照常受伤', () => {
  const { battle, friend } = setup('游荡者', 7);
  const result = fire(battle, friend.id, 30);
  assert.equal(result.results[0].save.success, false);
  assert.equal(result.results[0].damage, 8);
});

test('游荡者 5 级豁免成功仍受一半伤害', () => {
  const { battle, friend } = setup('游荡者', 5);
  const result = fire(battle, friend.id, 5);
  assert.equal(result.results[0].save.success, true);
  assert.equal(result.results[0].damage, 4);
});

test('武僧 7 级同样拥有反射闪避', () => {
  const { battle, friend } = setup('武僧', 7);
  const result = fire(battle, friend.id, 5);
  assert.equal(result.results[0].damage, 0);
});

test('力量豁免不受反射闪避影响', () => {
  const { battle, friend } = setup('游荡者', 7);
  const result = fire(battle, friend.id, 5, 'str');
  assert.equal(result.results[0].save.success, true);
  assert.equal(result.results[0].damage, 4);
});
