const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, setFlying, setTerrain, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `mud-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-mud', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '泥沼', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battle = store.battles[0];
  const added = addCharacter(store, hero, { battleId: battle.id, side: '友方' }, ids());
  const withHero = added.store.battles[0];
  const initiatives = {};
  withHero.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  let started = startCombat(withHero, initiatives);
  started = configureGrid(started, { width: 12, height: 8, cellFt: 5 });
  const friend = started.actors.find(actor => actor.side === '友方');
  const monster = started.actors.find(actor => actor.side === '敌方');
  started = moveActorToCell(started, friend.id, 1, 1);
  started = moveActorToCell(started, monster.id, 1, 5);
  return { battle: started, friend, monster };
}

const stateOf = (battle, id) => battle.actors.find(actor => actor.id === id).combat;
const logs = battle => battle.combat.log.map(line => line.text).join('\n');
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

test('切换泥沼地形会写入战场状态与日志', () => {
  const { battle } = setup();
  const mud = setTerrain(battle, 'mud');
  assert.equal(mud.terrain, 'mud');
  assert.ok(logs(mud).includes('泥沼'));
  assert.equal(setTerrain(mud, 'normal').terrain, undefined);
});

test('泥沼中移动消耗翻倍，豁免失败倒地', () => {
  const { battle: base, friend } = setup();
  const battle = setTerrain(base, 'mud');
  const moved = moveActorToCell(battle, friend.id, 3, 1, { random: sequence(0.05) });
  const state = stateOf(moved, friend.id);
  assert.equal(state.movementUsed, 20);
  assert.ok(state.conditions.includes('倒地'));
  assert.ok(logs(moved).includes('在泥沼中滑倒，倒地'));
});

test('敏捷豁免成功则稳住脚步', () => {
  const { battle: base, friend } = setup();
  const battle = setTerrain(base, 'mud');
  const moved = moveActorToCell(battle, friend.id, 3, 1, { random: sequence(0.9) });
  const state = stateOf(moved, friend.id);
  assert.ok(!state.conditions.includes('倒地'));
  assert.ok(logs(moved).includes('在泥沼里稳住了脚步'));
});

test('飞行单位忽略泥沼的消耗与滑倒', () => {
  const { battle: base, friend } = setup();
  const battle = setFlying(setTerrain(base, 'mud'), friend.id, true);
  const moved = moveActorToCell(battle, friend.id, 3, 1, { random: sequence(0.05) });
  const state = stateOf(moved, friend.id);
  assert.equal(state.movementUsed, 10);
  assert.ok(!state.conditions.includes('倒地'));
  assert.ok(!logs(moved).includes('泥沼中滑倒'));
});

test('普通地形不会滑倒', () => {
  const { battle, friend } = setup();
  const moved = moveActorToCell(battle, friend.id, 3, 1, { random: sequence(0.05) });
  const state = stateOf(moved, friend.id);
  assert.equal(state.movementUsed, 10);
  assert.ok(!state.conditions.includes('倒地'));
});
