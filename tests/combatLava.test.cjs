const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter, configureGrid } = require('../apps/web/src/battle.ts');
const { configureGrid: grid, endTurn, moveActorToCell, setTerrain, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `id-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[index++] ?? 0.5; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-lava', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup(cellX = 2) {
  const store = addMonsters(emptyStore(), card, { newBattleName: '岩浆', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = grid(started, { width: 12, height: 8, cellFt: 5 });
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, 1 + cellX, 1);
  return { battle: started, friend, monster };
}

test('切换岩浆地形会写入战场状态与日志', () => {
  const { battle } = setup();
  const lava = setTerrain(battle, 'lava');
  assert.equal(lava.terrain, 'lava');
  assert.ok(lava.combat.log.at(-1).text.includes('岩浆'));
  const plain = setTerrain(lava, 'normal');
  assert.equal(plain.terrain, undefined);
});

test('踏入岩浆受到 1d10 点火焰伤害', () => {
  const { battle, friend } = setup();
  const lava = setTerrain(battle, 'lava');
  const moved = moveActorToCell(lava, friend.id, 2, 2, { random: sequence(0.5) });
  const burned = moved.actors.find(actor => actor.id === friend.id);
  assert.equal(burned.currentHp, 34);
  assert.ok(moved.combat.log.some(item => item.text.includes('踏入岩浆，受到 6 点火焰伤害')), 'missing lava log');
});

test('岩浆中的移动消耗翻倍', () => {
  const { battle, friend } = setup();
  const lava = setTerrain(battle, 'lava');
  const moved = moveActorToCell(lava, friend.id, 1, 2, { random: sequence(0.5) });
  assert.equal(moved.actors.find(actor => actor.id === friend.id).combat.movementUsed, 10);
  assert.ok(moved.combat.log.some(item => item.text.includes('岩浆使消耗翻倍')));
});

test('在岩浆中开始回合会再次受伤', () => {
  const { battle, friend } = setup();
  let current = setTerrain(battle, 'lava');
  current = moveActorToCell(current, friend.id, 2, 2, { random: sequence(0.5) });
  const hpAfterStep = current.actors.find(actor => actor.id === friend.id).currentHp;
  assert.equal(hpAfterStep, 34);
  current = endTurn(current, { random: sequence(0.5) });
  current = endTurn(current, { random: sequence(0.5) });
  const burned = current.actors.find(actor => actor.id === friend.id);
  assert.equal(burned.currentHp, 28);
  assert.ok(current.combat.log.some(item => item.text.includes('在岩浆，受到 6 点火焰伤害')));
});

test('切回普通地形后不再受到岩浆伤害', () => {
  const { battle, friend } = setup();
  const lava = setTerrain(battle, 'lava');
  const plain = setTerrain(lava, 'normal');
  const moved = moveActorToCell(plain, friend.id, 2, 2, { random: sequence(0.5) });
  assert.equal(moved.actors.find(actor => actor.id === friend.id).currentHp, 40);
  assert.equal(moved.combat.log.some(item => item.text.includes('踏入岩浆') || item.text.includes('在岩浆')), false);
});
