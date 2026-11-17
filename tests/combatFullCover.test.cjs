const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { attack, configureGrid, coverFromWalls, moveActorToCell, startCombat, toggleWallCell } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-cover-full', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '', notes: '', details: { equipment: '' },
  },
};

function setup(walls) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '全掩体', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  let next = added.store.battles[0];
  const friend = next.actors.find(actor => actor.side === '友方');
  const monster = next.actors.find(actor => actor.side === '敌方');
  next = startCombat(next, { [friend.id]: 20, [monster.id]: 10 });
  next = configureGrid(next, { width: 10, height: 10, cellFt: 5 });
  next = moveActorToCell(next, friend.id, 0, 0);
  next = moveActorToCell(next, monster.id, 1, 0);
  for (const [x, y] of walls) next = toggleWallCell(next, x, y);
  return { battle: next, friend, monster };
}

const strike = (battle, friend, monster, extra = {}) => attack(battle, {
  attackerId: friend.id, targetId: monster.id, attackBonus: 5, damageExpression: '1d8+3', damageType: '挥砍', range: 'melee', ...extra,
}, { random: sequence(0.5, 0.5), makeId: ids() });

test('显式选择全掩体时无法被攻击', () => {
  const { battle, friend, monster } = setup([]);
  assert.throws(() => strike(battle, friend, monster, { cover: '全掩体' }), /目标处于全掩体，无法被直接攻击/);
});

test('三面墙自动判定为全掩体并阻止攻击', () => {
  const { battle, friend, monster } = setup([[0, 1], [1, 1], [2, 0]]);
  assert.throws(() => strike(battle, friend, monster, { autoCover: true }), /目标处于全掩体，无法被直接攻击/);
});

test('两面墙仍是四分之三掩体，可以攻击', () => {
  const { battle, friend, monster } = setup([[0, 1], [1, 1]]);
  const result = strike(battle, friend, monster, { autoCover: true });
  assert.ok(result.outcome);
  assert.match(result.battle.combat.log.at(-1).detail ?? '', /四分之三掩体（AC \+5）/);
});

test('coverFromWalls 在无墙体时返回无', () => {
  const { battle } = setup([]);
  assert.equal(coverFromWalls(battle, { x: 0, y: 0 }, { x: 1, y: 0 }), '无');
});
