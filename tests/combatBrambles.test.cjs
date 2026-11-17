const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, moveActorToCell, setFlying, setTerrain, startCombat } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `bramble-${++counter}`;

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-brambles', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '艾拉', species: '人类', characterClass: '战士', level: 5,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    maxHp: 40, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，触及 5 尺', notes: '', details: {},
  },
};

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '荆棘', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
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

test('切换荆棘地形会写入战场状态与日志', () => {
  const { battle } = setup();
  const brambles = setTerrain(battle, 'brambles');
  assert.equal(brambles.terrain, 'brambles');
  assert.ok(brambles.combat.log.at(-1).text.includes('荆棘'));
  assert.ok(setTerrain(brambles, 'normal').terrain === undefined);
});

test('荆棘中移动消耗翻倍并受到穿刺伤害', () => {
  const { battle: base, friend } = setup();
  const battle = setTerrain(base, 'brambles');
  const hpBefore = battle.actors.find(actor => actor.id === friend.id).currentHp;
  const moved = moveActorToCell(battle, friend.id, 3, 1);
  const actor = moved.actors.find(item => item.id === friend.id);
  assert.equal(actor.combat.movementUsed, 20);
  assert.equal(actor.currentHp, hpBefore - 2);
  assert.ok(moved.combat.log.some(line => line.text.includes('荆棘') && line.text.includes('穿刺')));
});

test('飞行单位穿过荆棘不受影响', () => {
  const { battle: base, friend } = setup();
  const battle = setFlying(setTerrain(base, 'brambles'), friend.id, true);
  const hpBefore = battle.actors.find(actor => actor.id === friend.id).currentHp;
  const moved = moveActorToCell(battle, friend.id, 3, 1);
  const actor = moved.actors.find(item => item.id === friend.id);
  assert.equal(actor.combat.movementUsed, 10);
  assert.equal(actor.currentHp, hpBefore);
  assert.ok(!moved.combat.log.some(line => line.text.includes('穿过荆棘')));
});

test('普通地形不触发穿刺伤害', () => {
  const { battle, friend } = setup();
  const hpBefore = battle.actors.find(actor => actor.id === friend.id).currentHp;
  const moved = moveActorToCell(battle, friend.id, 3, 1);
  const actor = moved.actors.find(item => item.id === friend.id);
  assert.equal(actor.combat.movementUsed, 10);
  assert.equal(actor.currentHp, hpBefore);
});
