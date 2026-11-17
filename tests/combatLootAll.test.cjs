const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emptyStore, addMonsters } = require('../apps/web/src/battle.ts');
const { startCombat, addItem, lootAll } = require('../apps/web/src/combat.ts');
const entry = require('../packages/contracts/examples/monster-entry.json');
const card = { entry, block: entry.statBlocks[0] };
let counter = 0;
const ids = () => () => `loot-${++counter}`;
const slain = (battle, id) => { const next = structuredClone(battle); const actor = next.actors.find(item => item.id === id); actor.currentHp = 0; actor.combat.status = 'dead'; return next; };

function setup() {
  let store = emptyStore();
  store = addMonsters(store, card, { newBattleName: '搜刮全部', side: '友方', count: 1 }, ids(), () => '2026-01-01T00:00:00Z').store;
  store = addMonsters(store, card, { battleId: store.battles[0].id, side: '敌方', count: 2 }, ids(), () => '2026-01-01T00:00:00Z').store;
  const base = store.battles[0];
  const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }];
  const placed = base.actors.map((actor, index) => ({ ...actor, position: cells[index] ?? { x: 0, y: 0 } }));
  return startCombat({ ...base, actors: placed }, Object.fromEntries(placed.map((actor, index) => [actor.id, 20 - index])));
}

test('一次收走 5 尺内所有尸体的物品', () => {
  let battle = setup();
  const [hero, first, second] = battle.actors;
  battle = addItem(battle, first.id, '金币袋', 3, undefined, ids());
  battle = addItem(battle, second.id, '银币袋', 2, undefined, ids());
  battle = slain(battle, first.id);
  battle = slain(battle, second.id);
  const loot = lootAll(battle, hero.id, { makeId: ids() });
  assert.deepEqual(loot.looted.sort(), ['金币袋', '银币袋'].sort());
  const items = loot.battle.actors.find(actor => actor.id === hero.id).combat.items;
  assert.equal(items.length, 2);
});

test('远处尸体不被收走', () => {
  let battle = setup();
  const [hero, first, second] = battle.actors;
  battle = addItem(battle, first.id, '近处袋子', 1, undefined, ids());
  battle = addItem(battle, second.id, '远处袋子', 1, undefined, ids());
  battle = slain(battle, first.id);
  battle = slain(battle, second.id);
  battle = { ...battle, actors: battle.actors.map(actor => actor.id === second.id ? { ...actor, position: { x: 9, y: 9 } } : actor) };
  const loot = lootAll(battle, hero.id, { makeId: ids() });
  assert.deepEqual(loot.looted, ['近处袋子']);
  assert.ok((loot.battle.actors.find(actor => actor.id === second.id).combat.items ?? []).length === 1);
});

test('5 尺内没有尸体时报错', () => {
  const battle = setup();
  assert.throws(() => lootAll(battle, battle.actors[0].id, { makeId: ids() }), /5 尺内没有可搜刮的尸体/);
});

test('超过 20 种时跳过该尸体并提示', () => {
  let battle = setup();
  const [hero, first] = battle.actors;
  for (let index = 0; index < 20; index += 1) battle = addItem(battle, hero.id, `杂物${index}`, 1, undefined, ids());
  battle = addItem(battle, first.id, '战利品', 1, undefined, ids());
  battle = slain(battle, first.id);
  const loot = lootAll(battle, hero.id, { makeId: ids() });
  assert.deepEqual(loot.looted, []);
  assert.ok(loot.battle.combat.log.some(entry => entry.text.includes('背不下')));
});
