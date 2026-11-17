const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { areaSave, savingThrow, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-cover', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '长剑' },
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '掩体豁免测试', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  return { battle: startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 }), friend, monster };
}

test('半掩体给敏捷豁免 +2，让临界失败变成成功', () => {
  const { battle, friend } = setup();
  const bare = savingThrow(battle, { actorId: friend.id, ability: 'dex', dc: 15, bonus: 0 }, { random: sequence(0.6), makeId: ids() });
  assert.equal(bare.outcome.natural, 13);
  assert.equal(bare.outcome.success, false);
  const covered = savingThrow(battle, { actorId: friend.id, ability: 'dex', dc: 15, bonus: 0, cover: '半掩体' }, { random: sequence(0.6), makeId: ids() });
  assert.equal(covered.outcome.total, 15);
  assert.equal(covered.outcome.success, true);
});

test('四分之三掩体给敏捷豁免 +5', () => {
  const { battle, friend } = setup();
  const result = savingThrow(battle, { actorId: friend.id, ability: 'dex', dc: 15, bonus: 0, cover: '四分之三掩体' }, { random: sequence(0.45), makeId: ids() });
  assert.equal(result.outcome.natural, 10);
  assert.equal(result.outcome.total, 15);
  assert.equal(result.outcome.success, true);
});

test('掩体对非敏捷豁免没有加值', () => {
  const { battle, friend } = setup();
  const result = savingThrow(battle, { actorId: friend.id, ability: 'str', dc: 15, bonus: 0, cover: '四分之三掩体' }, { random: sequence(0.65), makeId: ids() });
  assert.equal(result.outcome.natural, 14);
  assert.equal(result.outcome.total, 14);
  assert.equal(result.outcome.success, false);
});

test('范围伤害可以逐目标指定掩体', () => {
  const { battle, friend, monster } = setup();
  const result = areaSave(battle, {
    targetIds: [monster.id, friend.id], ability: 'dex', dc: 15, damageExpression: '2d6', damageType: '火焰',
    bonuses: { [monster.id]: 0, [friend.id]: 0 }, covers: { [monster.id]: '半掩体' },
  }, { random: sequence(0.5, 0.5, 0.6, 0.6), makeId: ids() });
  const covered = result.results.find(item => item.actorId === monster.id);
  const bare = result.results.find(item => item.actorId === friend.id);
  assert.equal(covered.save.success, true);
  assert.equal(covered.damage, 4);
  assert.equal(bare.save.success, false);
  assert.equal(bare.damage, 8);
});

test('显式豁免加值可以与掩体叠加', () => {
  const { battle, friend } = setup();
  const result = savingThrow(battle, { actorId: friend.id, ability: 'dex', dc: 15, bonus: 2, cover: '半掩体' }, { random: sequence(0.5), makeId: ids() });
  assert.equal(result.outcome.natural, 11);
  assert.equal(result.outcome.total, 15);
  assert.equal(result.outcome.success, true);
});
