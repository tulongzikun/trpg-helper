const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters, addCharacter } = require('../apps/web/src/battle.ts');
const { configureGrid, startCombat, shove, addHazard, setTerrain } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `push-${++counter}`;
const sequence = (...values) => { let index = 0; return () => values[Math.min(index++, values.length - 1)]; };

const hero = {
  schemaVersion: 'manual-character-snapshot/v1', characterId: 'char-push', revision: 1, publishedAt: '2026-01-01T00:00:00Z',
  sheet: {
    name: '布鲁诺', species: '人类', characterClass: '战士', level: 3,
    abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 10 },
    maxHp: 34, armorClass: 16, speedFt: 30, actions: '长剑：+5 命中，1d8+3 挥砍伤害，近战 5 尺', notes: '', details: {},
  },
};

function setup() {
  let store = addMonsters(emptyStore(), card, { newBattleName: '推撞', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const battleId = store.battles[0].id;
  store = addCharacter(store, hero, { battleId, side: '友方' }, ids()).store;
  let next = configureGrid(store.battles[0], { width: 8, height: 6, cellFt: 5 });
  const initiatives = {};
  next.actors.forEach((actor, index) => { initiatives[actor.id] = actor.side === '友方' ? 20 : 10 - index; });
  next = structuredClone(startCombat(next, initiatives));
  const attacker = next.actors.find(actor => actor.side === '友方');
  const target = next.actors.find(actor => actor.side === '敌方');
  attacker.position = { x: 0, y: 0 };
  target.position = { x: 1, y: 0 };
  return { battle: next, attacker, target };
}

const push = (battle, attackerId, targetId, random = sequence(0.99, 0.01)) =>
  shove(battle, { attackerId, targetId, effect: 'push' }, { random });

test('推撞把目标推入危险地形并结算伤害', () => {
  const { battle, attacker, target } = setup();
  const withHazard = addHazard(battle, { x: 2, y: 0, damageExpression: '1d6', damageType: '火焰' });
  const before = withHazard.actors.find(actor => actor.id === target.id).currentHp;
  const result = push(withHazard, attacker.id, target.id, sequence(0.99, 0.01, 0.5));
  const moved = result.battle.actors.find(actor => actor.id === target.id);
  assert.deepEqual(moved.position, { x: 2, y: 0 });
  assert.ok(moved.currentHp < before);
  assert.match(result.battle.combat.log.map(item => item.text).join('\n'), /踏入危险地形/);
});

test('推入岩浆造成火焰伤害', () => {
  const { battle, attacker, target } = setup();
  const lava = setTerrain(battle, 'lava');
  const before = lava.actors.find(actor => actor.id === target.id).currentHp;
  const result = push(lava, attacker.id, target.id, sequence(0.99, 0.01, 0.5));
  const moved = result.battle.actors.find(actor => actor.id === target.id);
  assert.equal(before - moved.currentHp, 6);
  assert.match(result.battle.combat.log.map(item => item.text).join('\n'), /岩浆/);
});

test('推入荆棘受到 5 点穿刺伤害', () => {
  const { battle, attacker, target } = setup();
  const brambles = setTerrain(battle, 'brambles');
  const before = brambles.actors.find(actor => actor.id === target.id).currentHp;
  const result = push(brambles, attacker.id, target.id);
  const moved = result.battle.actors.find(actor => actor.id === target.id);
  assert.equal(before - moved.currentHp, 5);
  assert.match(result.battle.combat.log.map(item => item.text).join('\n'), /穿过荆棘/);
});

test('推入油污要过敏捷豁免，失败倒地', () => {
  const { battle, attacker, target } = setup();
  const greasy = structuredClone(battle);
  greasy.grease = [{ x: 2, y: 0 }];
  const slipped = push(greasy, attacker.id, target.id, sequence(0.99, 0.01, 0.01));
  const moved = slipped.battle.actors.find(actor => actor.id === target.id);
  assert.ok(moved.combat.conditions.includes('倒地'));
  assert.match(slipped.battle.combat.log.map(item => item.text).join('\n'), /油污/);
});

test('普通推撞不会额外造成伤害或状态', () => {
  const { battle, attacker, target } = setup();
  const before = battle.actors.find(actor => actor.id === target.id);
  const result = push(battle, attacker.id, target.id);
  const moved = result.battle.actors.find(actor => actor.id === target.id);
  assert.equal(moved.currentHp, before.currentHp);
  assert.equal(moved.combat.conditions.includes('倒地'), false);
  assert.match(result.battle.combat.log.map(item => item.text).join('\n'), /被推开 5 尺到 \(2, 0\)/);
});

test('推撞方向越界时直接拒绝', () => {
  const { battle, attacker, target } = setup();
  const edge = structuredClone(battle);
  edge.actors.find(actor => actor.id === target.id).position = { x: 7, y: 0 };
  edge.actors.find(actor => actor.id === attacker.id).position = { x: 6, y: 0 };
  assert.throws(() => push(edge, attacker.id, target.id), /推撞方向超出战场边界/);
});

test('推撞方向被墙体阻挡时拒绝且不结算地形', () => {
  const { battle, attacker, target } = setup();
  const walled = structuredClone(battle);
  walled.walls = [{ x: 2, y: 0 }, { x: 2, y: 1 }];
  const before = walled.actors.find(actor => actor.id === target.id).currentHp;
  assert.throws(() => push(walled, attacker.id, target.id), /推撞方向是墙体/);
  assert.equal(walled.actors.find(actor => actor.id === target.id).currentHp, before);
});
