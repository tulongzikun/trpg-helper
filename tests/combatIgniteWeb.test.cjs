const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, castWeb, igniteWeb, webAt } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `web-fire-${++counter}`;

function setup() {
  const store = addMonsters(emptyStore(), card, { newBattleName: '点燃蛛网', side: '敌方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const caster = { ...base.actors[0], id: 'caster-1', name: '法师', side: '友方' };
  const foe = { ...base.actors[0], id: 'foe-1', name: '巨蛛', side: '敌方' };
  const battle = {
    ...base,
    grid: { width: 10, height: 10, cellFt: 5 },
    actors: [
      { ...caster, position: { x: 0, y: 0 } },
      { ...foe, position: { x: 3, y: 2 } },
    ],
  };
  return { battle: startCombat(battle, { 'caster-1': 20, 'foe-1': 10 }), casterId: 'caster-1', foeId: 'foe-1' };
}

test('点燃蛛网后蛛网消失', () => {
  const { battle, casterId } = setup();
  const webbed = castWeb(battle, casterId, [{ x: 2, y: 2 }, { x: 3, y: 2 }]);
  const result = igniteWeb(webbed, 2, 2);
  assert.equal(result.burned, 2);
  assert.equal(webAt(result.battle, 2, 2), false);
  assert.equal(webAt(result.battle, 3, 2), false);
});

test('网内单位受到 2d4 火焰伤害', () => {
  const { battle, casterId, foeId } = setup();
  const webbed = castWeb(battle, casterId, [{ x: 3, y: 2 }]);
  const before = webbed.actors.find(actor => actor.id === foeId).currentHp;
  const result = igniteWeb(webbed, 3, 2, { random: () => 0.4 });
  const after = result.battle.actors.find(actor => actor.id === foeId).currentHp;
  assert.equal(before - after, 4);
  assert.deepEqual(result.victims, ['巨蛛']);
});

test('火焰不跨越断开的蛛网', () => {
  const { battle, casterId } = setup();
  const webbed = castWeb(battle, casterId, [{ x: 2, y: 2 }, { x: 6, y: 6 }]);
  const result = igniteWeb(webbed, 6, 6);
  assert.equal(result.burned, 1);
  assert.equal(webAt(result.battle, 2, 2), true);
});

test('没有蛛网的格子无法点燃', () => {
  const { battle } = setup();
  assert.throws(() => igniteWeb(battle, 1, 1), /该格没有蛛网可供点燃。/);
});

test('点燃蛛网会写进战报', () => {
  const { battle, casterId } = setup();
  const webbed = castWeb(battle, casterId, [{ x: 2, y: 2 }]);
  const result = igniteWeb(webbed, 2, 2, { random: () => 0.4 });
  const text = result.battle.combat.log.map(item => item.text).join('\n');
  assert.match(text, /点燃了 1 格蛛网/);
  assert.match(text, /随后蛛网烧尽/);
});
