const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, configureGrid } = require('../apps/web/src/battle.ts');
const { attack, configureGrid: grid, moveActorToCell, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = (equipment, actions) => ({
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-power', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '巨刃', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 44, armorClass: 17, speedFt: 30, actions, notes: '', details: { equipment },
  },
});

function setup(equipment, actions) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '强力攻击', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero(equipment, actions), { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = grid(started, { width: 10, height: 10, cellFt: 5 });
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, 2, 1);
  // 让目标足够耐打，便于观察伤害差异
  const tough = structuredClone(started);
  const target = tough.actors.find(actor => actor.id === monster.id);
  target.maxHp = 200;
  target.currentHp = 200;
  target.template = { ...target.template, armorClass: 16 };
  return { battle: tough, friend, monster };
}

const options = (friend, monster, extra = {}) => ({ attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '2d6+3', damageType: '挥砍', range: 'melee', weaponId: 'weapon:巨剑', ...extra });

test('强力攻击命中时伤害 +10', () => {
  const { battle, friend, monster } = setup('巨剑', '');
  const result = attack(battle, options(friend, monster, { powerAttack: true }), { random: sequence(0.9, 0.5, 0.5) });
  assert.equal(result.outcome.hit, true);
  assert.equal(result.outcome.damage, 21);
  assert.match(result.battle.combat.log.at(-1).detail, /强力攻击：攻击检定 -5，伤害 \+10/);
});

test('强力攻击使原本命中的攻击变为未命中', () => {
  const { battle, friend, monster } = setup('巨剑', '');
  const normal = attack(battle, options(friend, monster), { random: sequence(0.55, 0.5, 0.5) });
  assert.equal(normal.outcome.natural, 12);
  assert.equal(normal.outcome.hit, true);
  const power = attack(battle, options(friend, monster, { powerAttack: true }), { random: sequence(0.55, 0.5, 0.5) });
  assert.equal(power.outcome.total, 12);
  assert.equal(power.outcome.hit, false);
});

test('非重型武器不能使用强力攻击', () => {
  const { battle, friend, monster } = setup('长剑', '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺');
  assert.throws(() => attack(battle, { ...options(friend, monster, { powerAttack: true }), weaponId: 'weapon:长剑' }, { random: sequence(0.9) }), /只有重型武器可以使用强力攻击/);
});

test('未指定武器时同样拒绝强力攻击', () => {
  const { battle, friend, monster } = setup('巨剑', '');
  const { weaponId, ...rest } = options(friend, monster, { powerAttack: true });
  assert.throws(() => attack(battle, rest, { random: sequence(0.9) }), /只有重型武器可以使用强力攻击/);
});

test('不开启强力攻击时数值不变', () => {
  const { battle, friend, monster } = setup('巨剑', '');
  const result = attack(battle, options(friend, monster), { random: sequence(0.9, 0.5, 0.5) });
  assert.equal(result.outcome.total, 24);
  assert.equal(result.outcome.damage, 11);
});
