const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, castGrease, igniteGrease, greaseAt } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `grease-fire-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '点燃油污', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const caster = { ...base.actors[0], id: 'caster-1', name: '法师', side: '友方' };
  const foe = { ...base.actors[0], id: 'foe-1', name: '哥布林', side: '敌方' };
  const battle = {
    ...base,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: [
      { ...caster, position: { x: 0, y: 0 } },
      { ...foe, position: { x: 3, y: 2 } },
    ],
  };
  return { battle: startCombat(battle, { 'caster-1': 20, 'foe-1': 10 }), foeId: 'foe-1', casterId: 'caster-1' };
}

test('点燃油污后油污消失', () => {
  const { battle, casterId } = setup();
  const greased = castGrease(battle, casterId, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
  assert.equal(greaseAt(greased, 2, 2), true);
  const result = igniteGrease(greased, 2, 2);
  assert.equal(result.burned, 2);
  assert.equal(greaseAt(result.battle, 2, 2), false);
  assert.equal(greaseAt(result.battle, 3, 2), false);
});

test('站在油污里的单位受到 1d6 火焰伤害', () => {
  const { battle, casterId, foeId } = setup();
  const greased = castGrease(battle, casterId, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
  const before = greased.actors.find(actor => actor.id === foeId).currentHp;
  const result = igniteGrease(greased, 3, 2, { random: () => 0.9 });
  const after = result.battle.actors.find(actor => actor.id === foeId).currentHp;
  assert.equal(before - after, 6);
  assert.deepEqual(result.victims, ['哥布林']);
});

test('火焰只沿着相连的油污蔓延', () => {
  const { battle, casterId } = setup();
  const greased = castGrease(battle, casterId, [{ x: 2, y: 2 }, { x: 5, y: 5 }]);
  const result = igniteGrease(greased, 5, 5);
  assert.equal(result.burned, 1);
  assert.equal(greaseAt(result.battle, 2, 2), true);
  assert.equal(greaseAt(result.battle, 5, 5), false);
});

test('没有油污的格子无法点燃', () => {
  const { battle } = setup();
  assert.throws(() => igniteGrease(battle, 1, 1), /该格没有油污可供点燃。/);
});

test('点燃会写进战报', () => {
  const { battle, casterId } = setup();
  const greased = castGrease(battle, casterId, [{ x: 2, y: 2 }]);
  const result = igniteGrease(greased, 2, 2);
  const text = result.battle.combat.log.map(item => item.text).join('\n');
  assert.match(text, /点燃了 1 格油污/);
  assert.match(text, /随后油污烧尽/);
});
