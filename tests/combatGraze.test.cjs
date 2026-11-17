const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment, str = 16) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-graze', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment },
  },
});

function setup(equipment, str = 16) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '擦伤', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment, str), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const friend = withHero.actors.find(actor => actor.side === '友方');
  const monster = withHero.actors.find(actor => actor.side === '敌方');
  let next = startCombat(withHero, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: 8, height: 3, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 1, 1);
  next = moveActorToCell(next, monster.id, 2, 1);
  return { battle: next, friend, monster };
}

test('巨剑未命中时按力量调整值造成擦伤伤害', () => {
  const { battle, friend, monster } = setup('巨剑');
  const before = battle.actors.find(actor => actor.id === monster.id).currentHp;
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', weaponId: 'weapon:巨剑' }, { random: sequence(0.0), makeId: ids() });
  assert.equal(result.outcome.hit, false);
  const after = result.battle.actors.find(actor => actor.id === monster.id).currentHp;
  assert.equal(before - after, 3);
  assert.equal(result.outcome.damage, 3);
  assert.match(result.battle.combat.log.at(-1).detail, /精通·擦伤：未命中仍造成 3 点挥砍伤害/);
});

test('擦伤伤害受武器抗性影响', () => {
  const { battle, friend, monster } = setup('巨剑');
  const prepared = structuredClone(battle);
  prepared.actors.find(actor => actor.id === monster.id).template.damageResistances = ['挥砍'];
  const before = prepared.actors.find(actor => actor.id === monster.id).currentHp;
  const result = attack(prepared, { attackerId: friend.id, targetId: monster.id, attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', weaponId: 'weapon:巨剑' }, { random: sequence(0.0), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === monster.id).currentHp;
  assert.equal(before - after, 1);
});

test('非擦伤武器未命中不造成伤害', () => {
  const { battle, friend, monster } = setup('长剑');
  const before = battle.actors.find(actor => actor.id === monster.id).currentHp;
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 0, damageExpression: '1d8+3', damageType: '挥砍', weaponId: 'weapon:长剑' }, { random: sequence(0.0), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === monster.id).currentHp;
  assert.equal(before, after);
  assert.equal(result.outcome.damage, 0);
});

test('力量调整值为负时擦伤不造成伤害', () => {
  const { battle, friend, monster } = setup('巨剑', 8);
  const before = battle.actors.find(actor => actor.id === monster.id).currentHp;
  const result = attack(battle, { attackerId: friend.id, targetId: monster.id, attackBonus: 0, damageExpression: '2d6-1', damageType: '挥砍', weaponId: 'weapon:巨剑' }, { random: sequence(0.0), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === monster.id).currentHp;
  assert.equal(before, after);
  assert.equal(result.outcome.damage, 0);
});

test('擦伤可以打死目标', () => {
  const { battle, friend, monster } = setup('巨剑');
  const weak = structuredClone(battle);
  const target = weak.actors.find(actor => actor.id === monster.id);
  target.currentHp = 2;
  const result = attack(weak, { attackerId: friend.id, targetId: monster.id, attackBonus: 0, damageExpression: '2d6+3', damageType: '挥砍', weaponId: 'weapon:巨剑' }, { random: sequence(0.0), makeId: ids() });
  const after = result.battle.actors.find(actor => actor.id === monster.id);
  assert.equal(after.currentHp, 0);
  assert.notEqual(after.combat.status, 'active');
});
