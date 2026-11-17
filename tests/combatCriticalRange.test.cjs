const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (level, subclass) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-crit', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, saveProficiencies: [],
    actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '',
    details: { equipment: '长剑', fighterCalculator: { subclass } },
  },
});

function setup(level, subclass) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '重击', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(level, subclass), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  const started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  return { battle: started, friend, monster };
}

const strike = (battle, friend, monster, random) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee',
}, { random });

test('3 级勇士冠军 19 即重击且伤害翻倍', () => {
  const { battle, friend, monster } = setup(3, 'champion');
  const result = strike(battle, friend, monster, sequence(0.9, 0.5, 0.5));
  assert.equal(result.outcome.natural, 19);
  assert.equal(result.outcome.critical, true);
  assert.equal(result.outcome.damage, 13);
});

test('2 级勇士冠军 19 只是普通命中', () => {
  const { battle, friend, monster } = setup(2, 'champion');
  const result = strike(battle, friend, monster, sequence(0.9, 0.5, 0.5));
  assert.equal(result.outcome.natural, 19);
  assert.equal(result.outcome.critical, false);
  assert.equal(result.outcome.damage, 8);
});

test('15 级勇士冠军 18 即重击', () => {
  const { battle, friend, monster } = setup(15, 'champion');
  const result = strike(battle, friend, monster, sequence(0.85, 0.5, 0.5));
  assert.equal(result.outcome.natural, 18);
  assert.equal(result.outcome.critical, true);
});

test('15 级勇士冠军 17 仍是普通命中', () => {
  const { battle, friend, monster } = setup(15, 'champion');
  const result = strike(battle, friend, monster, sequence(0.8, 0.5, 0.5));
  assert.equal(result.outcome.natural, 17);
  assert.equal(result.outcome.critical, false);
});

test('非勇士冠军不会自动扩大重击范围，可用参数覆盖', () => {
  const { battle, friend, monster } = setup(10, 'battle-master');
  const plain = strike(battle, friend, monster, sequence(0.9, 0.5, 0.5));
  assert.equal(plain.outcome.critical, false);
  const forced = attack(battle, {
    attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', criticalRange: 19,
  }, { random: sequence(0.9, 0.5, 0.5) });
  assert.equal(forced.outcome.critical, true);
});
